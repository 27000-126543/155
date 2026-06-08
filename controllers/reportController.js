const performanceService = require('../services/performanceService');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');

exports.generateMonthlyReport = asyncHandler(async (req, res) => {
  const { year, month } = req.body;

  const targetYear = year || new Date().getFullYear();
  const targetMonth = month || (new Date().getMonth() + 1);

  const report = await performanceService.generateMonthlyReport(targetYear, targetMonth, req.user._id);

  successResponse(res, { report }, '月度报表生成成功', 201);
});

exports.generateReportByPeriod = asyncHandler(async (req, res) => {
  const { startDate, endDate, name } = req.body;

  if (!startDate || !endDate) {
    return errorResponse(res, '请提供开始和结束日期', 400);
  }

  const report = await performanceService.generateReportByPeriod(
    new Date(startDate),
    new Date(endDate),
    name || `自定义报表_${startDate}_${endDate}`,
    req.user._id
  );

  successResponse(res, { report }, '自定义报表生成成功', 201);
});

exports.getReports = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, type, year, month, startDate, endDate } = req.query;

  const result = await performanceService.getReports({
    page: parseInt(page),
    limit: parseInt(limit),
    type,
    year: year ? parseInt(year) : null,
    month: month ? parseInt(month) : null,
    startDate,
    endDate
  });

  successResponse(res, result);
});

exports.getReportById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const report = await performanceService.getReportById(id);

  if (!report) {
    return errorResponse(res, '报表不存在', 404);
  }

  successResponse(res, { report });
});

exports.exportReportToExcel = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await performanceService.exportReportToExcel(id);

  if (!result) {
    return errorResponse(res, '报表不存在或导出失败', 404);
  }

  const encodedFileName = encodeURIComponent(result.fileName);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
  
  res.send(result.buffer);
});

exports.exportReportByPeriodToExcel = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return errorResponse(res, '请提供开始和结束日期', 400);
  }

  const result = await performanceService.exportPerformanceReport(
    new Date(startDate),
    new Date(endDate)
  );

  const fileName = `效能报表_${startDate}_${endDate}.xlsx`;
  const encodedFileName = encodeURIComponent(fileName);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
  
  res.send(result);
});

exports.deleteReport = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const PerformanceReport = require('../models/PerformanceReport');
  const report = await PerformanceReport.findById(id);

  if (!report) {
    return errorResponse(res, '报表不存在', 404);
  }

  report.isDeleted = true;
  report.deletedAt = new Date();
  report.deletedBy = req.user._id;
  await report.save();

  successResponse(res, null, '报表已删除');
});

exports.getRealTimeStats = asyncHandler(async (req, res) => {
  const stats = await performanceService.getRealtimeStats();
  
  successResponse(res, { stats });
});

exports.getDepartmentPerformance = asyncHandler(async (req, res) => {
  const { departmentId, startDate, endDate } = req.query;

  if (!departmentId) {
    return errorResponse(res, '请提供部门ID', 400);
  }

  const stats = await performanceService.getDepartmentPerformance(
    departmentId,
    startDate ? new Date(startDate) : null,
    endDate ? new Date(endDate) : null
  );

  successResponse(res, { stats });
});

exports.getItemTypePerformance = asyncHandler(async (req, res) => {
  const { itemType, startDate, endDate } = req.query;

  if (!itemType) {
    return errorResponse(res, '请提供事项类型', 400);
  }

  const stats = await performanceService.getItemTypePerformance(
    itemType,
    startDate ? new Date(startDate) : null,
    endDate ? new Date(endDate) : null
  );

  successResponse(res, { stats });
});

exports.getTopDepartments = asyncHandler(async (req, res) => {
  const { limit = 10, sortBy = 'onTimeRate', startDate, endDate } = req.query;

  const PerformanceReport = require('../models/PerformanceReport');
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const query = {
    periodStart: { $gte: startDate ? new Date(startDate) : firstDay },
    periodEnd: { $lte: endDate ? new Date(endDate) : now }
  };

  const reports = await PerformanceReport.find(query)
    .sort({ [`departmentStats.${sortBy}`]: -1 })
    .limit(parseInt(limit));

  const departments = [];
  for (const report of reports) {
    for (const ds of report.departmentStats) {
      const existing = departments.find(d => d.departmentId.toString() === ds.departmentId.toString());
      if (!existing) {
        departments.push(ds);
      }
    }
  }

  departments.sort((a, b) => b[sortBy] - a[sortBy]);

  successResponse(res, {
    departments: departments.slice(0, parseInt(limit)),
    sortBy
  });
});

exports.getBottomDepartments = asyncHandler(async (req, res) => {
  const { limit = 10, sortBy = 'timeoutRate', startDate, endDate } = req.query;

  const PerformanceReport = require('../models/PerformanceReport');
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const query = {
    periodStart: { $gte: startDate ? new Date(startDate) : firstDay },
    periodEnd: { $lte: endDate ? new Date(endDate) : now }
  };

  const reports = await PerformanceReport.find(query)
    .limit(parseInt(limit));

  const departments = [];
  for (const report of reports) {
    for (const ds of report.departmentStats) {
      const existing = departments.find(d => d.departmentId.toString() === ds.departmentId.toString());
      if (!existing) {
        departments.push(ds);
      }
    }
  }

  departments.sort((a, b) => b[sortBy] - a[sortBy]);

  successResponse(res, {
    departments: departments.slice(0, parseInt(limit)),
    sortBy
  });
});

exports.getPerformanceTrend = asyncHandler(async (req, res) => {
  const { months = 6 } = req.query;

  const PerformanceReport = require('../models/PerformanceReport');
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - (parseInt(months) - 1), 1);

  const reports = await PerformanceReport.find({
    reportType: 'monthly',
    periodStart: { $gte: startDate }
  }).sort({ periodStart: 1 });

  const trend = reports.map(report => ({
    month: report.month,
    year: report.year,
    totalApplications: report.overallStats.totalApplications,
    approvedCount: report.overallStats.approvedCount,
    rejectedCount: report.overallStats.rejectedCount,
    returnedCount: report.overallStats.returnedCount,
    avgProcessingTime: report.overallStats.avgProcessingTime,
    onTimeRate: report.overallStats.onTimeRate,
    timeoutRate: report.overallStats.timeoutRate,
    returnRate: report.overallStats.returnRate
  }));

  successResponse(res, { trend, months: parseInt(months) });
});

exports.getApprovalRanking = asyncHandler(async (req, res) => {
  const { startDate, endDate, limit = 10 } = req.query;

  const Application = require('../models/Application');
  const User = require('../models/User');

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const match = {
    'statusHistory.status': 'approved',
    'statusHistory.timestamp': { 
      $gte: startDate ? new Date(startDate) : firstDay,
      $lte: endDate ? new Date(endDate) : now
    }
  };

  const approvals = await Application.aggregate([
    { $unwind: '$statusHistory' },
    { $match: match },
    {
      $group: {
        _id: '$statusHistory.operator',
        approvedCount: { $sum: 1 },
        avgProcessingTime: { $avg: '$statusHistory.processingTime' }
      }
    },
    { $sort: { approvedCount: -1 } },
    { $limit: parseInt(limit) }
  ]);

  const rankings = [];
  for (let i = 0; i < approvals.length; i++) {
    const approval = approvals[i];
    const user = await User.findById(approval._id, 'name department');
    if (user) {
      rankings.push({
        rank: i + 1,
        approverId: approval._id,
        approverName: user.name,
        department: user.department,
        approvedCount: approval.approvedCount,
        avgProcessingTime: Math.round(approval.avgProcessingTime * 100) / 100
      });
    }
  }

  successResponse(res, { rankings, limit: parseInt(limit) });
});

exports.getQuickStats = asyncHandler(async (req, res) => {
  const Application = require('../models/Application');
  const Certificate = require('../models/Certificate');
  const User = require('../models/User');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

  const [
    todayApplications,
    pendingApplications,
    weekApplications,
    monthApplications,
    totalCertificates,
    totalUsers,
    pendingApprovals
  ] = await Promise.all([
    Application.countDocuments({ createdAt: { $gte: today } }),
    Application.countDocuments({ currentStatus: 'pending' }),
    Application.countDocuments({ createdAt: { $gte: weekAgo } }),
    Application.countDocuments({ createdAt: { $gte: monthAgo } }),
    Certificate.countDocuments({ status: 'valid' }),
    User.countDocuments({ type: { $in: ['individual', 'enterprise'] } }),
    Application.countDocuments({ 
      currentStatus: { $in: ['in_progress', 'parallel_approval'] } 
    })
  ]);

  successResponse(res, {
    stats: {
      todayApplications,
      pendingApplications,
      weekApplications,
      monthApplications,
      totalCertificates,
      totalUsers,
      pendingApprovals
    }
  });
});

exports.getReportDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20, departmentId, serviceItemId, filter, status } = req.query;

  const result = await performanceService.getReportDetails(id, {
    page: parseInt(page),
    limit: parseInt(limit),
    departmentId,
    serviceItemId,
    filter,
    status
  });

  successResponse(res, result);
});
