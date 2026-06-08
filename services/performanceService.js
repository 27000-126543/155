const PerformanceReport = require('../models/PerformanceReport');
const Application = require('../models/Application');
const Department = require('../models/Department');
const ServiceItem = require('../models/ServiceItem');
const User = require('../models/User');
const ExcelJS = require('exceljs');
const { generateReportNo, getMonthRange, diffDays } = require('../utils/helpers');
const { APPLICATION_STATUS, ITEM_TYPE, REPORT_TYPE } = require('../utils/constants');
const notificationService = require('./notificationService');

class PerformanceService {
  async generateMonthlyReport(year, month, generatedBy = null) {
    const { startDate, endDate } = getMonthRange(year, month);

    const reportNo = generateReportNo();
    const report = new PerformanceReport({
      reportNo,
      reportType: REPORT_TYPE.MONTHLY,
      period: { year, month, startDate, endDate },
      generatedBy,
      status: 'generating'
    });

    await report.save();

    setImmediate(() => this.processReportGeneration(report._id, startDate, endDate, generatedBy));

    return report;
  }

  async processReportGeneration(reportId, startDate, endDate, generatedBy) {
    try {
      const applications = await Application.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).populate('serviceItem applicant');

      const completedApps = applications.filter(a => 
        [APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.REJECTED, 
         APPLICATION_STATUS.RETURNED, APPLICATION_STATUS.COMPLETED].includes(a.currentStatus)
      );

      const pendingApps = applications.filter(a => 
        ![APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.REJECTED, 
          APPLICATION_STATUS.RETURNED, APPLICATION_STATUS.COMPLETED,
          APPLICATION_STATUS.REVOKED].includes(a.currentStatus)
      );

      const timelyCompleted = completedApps.filter(a => a.isTimelyCompleted);
      const timeoutApps = completedApps.filter(a => a.hasTimeout);
      const returnedApps = completedApps.filter(a => a.currentStatus === APPLICATION_STATUS.RETURNED);
      const rejectedApps = completedApps.filter(a => a.currentStatus === APPLICATION_STATUS.REJECTED);
      const fastTrackApps = applications.filter(a => a.useFastTrack);
      const parallelApps = applications.filter(a => 
        a.approvalAssignments.some(aa => aa.isParallel)
      );

      const totalProcessingDays = completedApps.reduce((sum, a) => sum + (a.processingDays || 0), 0);

      const report = await PerformanceReport.findById(reportId);
      if (!report) return;

      report.overallStats = {
        totalApplications: applications.length,
        completedApplications: completedApps.length,
        pendingApplications: pendingApps.length,
        timelyCompleted: timelyCompleted.length,
        timelyCompletionRate: completedApps.length > 0 
          ? Math.round((timelyCompleted.length / completedApps.length) * 10000) / 100 
          : 100,
        timeoutApplications: timeoutApps.length,
        timeoutRate: completedApps.length > 0 
          ? Math.round((timeoutApps.length / completedApps.length) * 10000) / 100 
          : 0,
        returnedApplications: returnedApps.length,
        returnRate: applications.length > 0 
          ? Math.round((returnedApps.length / applications.length) * 10000) / 100 
          : 0,
        rejectedApplications: rejectedApps.length,
        averageProcessingDays: completedApps.length > 0 
          ? Math.round((totalProcessingDays / completedApps.length) * 100) / 100 
          : 0,
        fastTrackApplications: fastTrackApps.length,
        parallelApprovalApplications: parallelApps.length,
        certificatesGenerated: completedApps.filter(a => a.certificate).length
      };

      report.departmentStats = await this.generateDepartmentStats(completedApps, applications);
      report.itemStats = await this.generateItemStats(completedApps, applications);
      report.topItems = this.generateTopItems(applications);
      report.slowestDepartments = this.generateSlowestDepartments(report.departmentStats);
      report.timeoutRankings = this.generateTimeoutRankings(report.departmentStats);

      report.status = 'completed';
      await report.save();

      const supervisors = await User.find({ type: 'supervisor', status: 'active' });
      await notificationService.notifyReportGenerated(
        report, 
        supervisors.map(s => s._id)
      );

    } catch (error) {
      console.error('生成效能报表失败:', error);
      const report = await PerformanceReport.findById(reportId);
      if (report) {
        report.status = 'failed';
        await report.save();
      }
    }
  }

  async generateDepartmentStats(completedApps, allApps) {
    const departments = await Department.find({ status: 'active' });
    const stats = [];

    for (const dept of departments) {
      const deptAssignments = allApps.flatMap(a => 
        a.approvalAssignments.filter(aa => aa.department.toString() === dept._id.toString())
      );

      const deptCompleted = completedApps.filter(a => 
        a.approvalAssignments.some(aa => aa.department.toString() === dept._id.toString())
      );

      const deptTimely = deptCompleted.filter(a => a.isTimelyCompleted);
      const deptTimeout = deptCompleted.filter(a => a.hasTimeout);
      const deptReturned = deptCompleted.filter(a => a.currentStatus === APPLICATION_STATUS.RETURNED);

      const deptProcessingDays = deptCompleted.reduce((sum, a) => sum + (a.processingDays || 0), 0);

      const itemTypeMap = {};
      deptCompleted.forEach(a => {
        const itemType = a.serviceItem?.itemType || 'other';
        if (!itemTypeMap[itemType]) {
          itemTypeMap[itemType] = { total: 0, completed: 0, timely: 0, timeout: 0, returned: 0, totalDays: 0 };
        }
        itemTypeMap[itemType].total++;
        itemTypeMap[itemType].completed++;
        if (a.isTimelyCompleted) itemTypeMap[itemType].timely++;
        if (a.hasTimeout) itemTypeMap[itemType].timeout++;
        if (a.currentStatus === APPLICATION_STATUS.RETURNED) itemTypeMap[itemType].returned++;
        itemTypeMap[itemType].totalDays += a.processingDays || 0;
      });

      const itemTypeStats = Object.entries(itemTypeMap).map(([itemType, data]) => ({
        itemType,
        itemTypeName: this.getItemTypeName(itemType),
        total: data.total,
        completed: data.completed,
        timelyCompleted: data.timely,
        timelyCompletionRate: data.completed > 0 ? Math.round((data.timely / data.completed) * 10000) / 100 : 100,
        timeout: data.timeout,
        timeoutRate: data.completed > 0 ? Math.round((data.timeout / data.completed) * 10000) / 100 : 0,
        returned: data.returned,
        returnRate: data.total > 0 ? Math.round((data.returned / data.total) * 10000) / 100 : 0,
        averageProcessingDays: data.completed > 0 ? Math.round((data.totalDays / data.completed) * 100) / 100 : 0
      }));

      stats.push({
        department: dept._id,
        departmentCode: dept.code,
        departmentName: dept.name,
        totalApplications: deptAssignments.length,
        completedApplications: deptCompleted.length,
        timelyCompleted: deptTimely.length,
        timelyCompletionRate: deptCompleted.length > 0 
          ? Math.round((deptTimely.length / deptCompleted.length) * 10000) / 100 
          : 100,
        timeoutApplications: deptTimeout.length,
        timeoutRate: deptCompleted.length > 0 
          ? Math.round((deptTimeout.length / deptCompleted.length) * 10000) / 100 
          : 0,
        returnedApplications: deptReturned.length,
        returnRate: deptAssignments.length > 0 
          ? Math.round((deptReturned.length / deptAssignments.length) * 10000) / 100 
          : 0,
        rejectedApplications: deptCompleted.filter(a => a.currentStatus === APPLICATION_STATUS.REJECTED).length,
        averageProcessingDays: deptCompleted.length > 0 
          ? Math.round((deptProcessingDays / deptCompleted.length) * 100) / 100 
          : 0,
        maxProcessingDays: deptCompleted.length > 0 
          ? Math.max(...deptCompleted.map(a => a.processingDays || 0)) 
          : 0,
        minProcessingDays: deptCompleted.length > 0 
          ? Math.min(...deptCompleted.map(a => a.processingDays || 0)) 
          : 0,
        totalProcessingDays: deptProcessingDays,
        itemTypeStats
      });
    }

    return stats;
  }

  async generateItemStats(completedApps, allApps) {
    const serviceItems = await ServiceItem.find({ status: 'published' });
    const stats = [];

    for (const item of serviceItems) {
      const itemApps = allApps.filter(a => a.serviceItem?._id.toString() === item._id.toString());
      const itemCompleted = completedApps.filter(a => a.serviceItem?._id.toString() === item._id.toString());
      
      const timely = itemCompleted.filter(a => a.isTimelyCompleted);
      const timeout = itemCompleted.filter(a => a.hasTimeout);
      const returned = itemCompleted.filter(a => a.currentStatus === APPLICATION_STATUS.RETURNED);
      const totalDays = itemCompleted.reduce((sum, a) => sum + (a.processingDays || 0), 0);

      stats.push({
        serviceItem: item._id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        totalApplications: itemApps.length,
        completedApplications: itemCompleted.length,
        timelyCompleted: timely.length,
        timelyCompletionRate: itemCompleted.length > 0 
          ? Math.round((timely.length / itemCompleted.length) * 10000) / 100 
          : 100,
        timeoutApplications: timeout.length,
        timeoutRate: itemCompleted.length > 0 
          ? Math.round((timeout.length / itemCompleted.length) * 10000) / 100 
          : 0,
        returnedApplications: returned.length,
        returnRate: itemApps.length > 0 
          ? Math.round((returned.length / itemApps.length) * 10000) / 100 
          : 0,
        averageProcessingDays: itemCompleted.length > 0 
          ? Math.round((totalDays / itemCompleted.length) * 100) / 100 
          : 0
      });
    }

    return stats;
  }

  generateTopItems(applications) {
    const itemCount = {};
    applications.forEach(a => {
      const code = a.serviceItem?.itemCode;
      const name = a.serviceItem?.itemName;
      if (code) {
        if (!itemCount[code]) {
          itemCount[code] = { itemCode: code, itemName: name, count: 0 };
        }
        itemCount[code].count++;
      }
    });

    return Object.values(itemCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  generateSlowestDepartments(deptStats) {
    return deptStats
      .filter(d => d.completedApplications > 0)
      .sort((a, b) => b.averageProcessingDays - a.averageProcessingDays)
      .slice(0, 5)
      .map(d => ({
        department: d.departmentName,
        averageDays: d.averageProcessingDays
      }));
  }

  generateTimeoutRankings(deptStats) {
    return deptStats
      .filter(d => d.completedApplications > 0)
      .sort((a, b) => b.timeoutRate - a.timeoutRate)
      .slice(0, 5)
      .map(d => ({
        department: d.departmentName,
        timeoutCount: d.timeoutApplications,
        timeoutRate: d.timeoutRate
      }));
  }

  getItemTypeName(itemType) {
    const names = {
      [ITEM_TYPE.ADMINISTRATIVE_LICENSE]: '行政许可',
      [ITEM_TYPE.PUBLIC_SERVICE]: '公共服务',
      [ITEM_TYPE.OTHER]: '其他事项'
    };
    return names[itemType] || itemType;
  }

  async getReportById(id) {
    return await PerformanceReport.findById(id)
      .populate('generatedBy', 'name');
  }

  async getReports(options = {}) {
    const { page = 1, limit = 10, reportType, year, month, status } = options;
    const query = {};

    if (reportType) query.reportType = reportType;
    if (year) query['period.year'] = year;
    if (month) query['period.month'] = month;
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const reports = await PerformanceReport.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('generatedBy', 'name');

    const total = await PerformanceReport.countDocuments(query);

    return {
      reports,
      pagination: {
        currentPage: page,
        perPage: limit,
        totalPages: Math.ceil(total / limit),
        total
      }
    };
  }

  async getReportDetails(reportId, options = {}) {
    const report = await PerformanceReport.findById(reportId);
    if (!report) {
      throw new Error('报表不存在');
    }

    const { 
      page = 1, limit = 20, 
      departmentId, serviceItemId,
      filter: filterType, 
      status
    } = options;

    const query = {
      createdAt: { $gte: report.period.startDate, $lte: report.period.endDate }
    };

    if (departmentId) {
      query['approvalAssignments.department'] = departmentId;
    }
    if (serviceItemId) {
      query.serviceItem = serviceItemId;
    }
    if (status) {
      query.currentStatus = status;
    }

    if (filterType) {
      switch (filterType) {
        case 'timeout':
          query.hasTimeout = true;
          break;
        case 'returned':
          query.currentStatus = APPLICATION_STATUS.RETURNED;
          break;
        case 'rejected':
          query.currentStatus = APPLICATION_STATUS.REJECTED;
          break;
        case 'fastTrack':
          query.useFastTrack = true;
          break;
        case 'completed':
          query.currentStatus = { $in: [APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.COMPLETED] };
          break;
        case 'pending':
          query.currentStatus = { $in: [
            APPLICATION_STATUS.PENDING_APPROVAL, 
            APPLICATION_STATUS.PARALLEL_APPROVAL,
            APPLICATION_STATUS.SUBMITTED,
            APPLICATION_STATUS.TIMEOUT_ESCALATED
          ]};
          break;
      }
    }

    const total = await Application.countDocuments(query);
    const skip = (page - 1) * limit;

    const applications = await Application.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('serviceItem', 'itemCode itemName itemType')
      .populate('applicant', 'name type')
      .populate('approvalAssignments.department', 'name')
      .populate('approvalAssignments.approver', 'name')
      .populate('certificate', 'certificateNo');

    const details = applications.map(app => ({
      id: app._id,
      applicationNo: app.applicationNo,
      serviceItem: {
        id: app.serviceItem?._id,
        itemCode: app.serviceItem?.itemCode,
        itemName: app.serviceItem?.itemName,
        itemType: app.serviceItem?.itemType
      },
      applicant: {
        id: app.applicant?._id,
        name: app.applicantInfo?.name || app.applicant?.name,
        type: app.applicantType
      },
      currentStatus: app.currentStatus,
      currentStep: app.currentStep,
      useFastTrack: app.useFastTrack,
      hasTimeout: app.hasTimeout,
      timeoutCount: app.timeoutCount,
      processingDays: app.processingDays,
      isTimelyCompleted: app.isTimelyCompleted,
      submittedAt: app.submittedAt,
      completedAt: app.completedAt,
      createdAt: app.createdAt,
      departments: [...new Set(app.approvalAssignments.map(a => a.department?.name).filter(Boolean))],
      currentApprover: app.approvalAssignments.find(a => a.status === 'pending')?.approver?.name,
      certificateNo: app.certificate?.certificateNo
    }));

    return {
      details,
      pagination: {
        currentPage: parseInt(page),
        perPage: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        departmentId,
        serviceItemId,
        filterType,
        status
      },
      reportInfo: {
        id: report._id,
        reportNo: report.reportNo,
        period: report.period
      }
    };
  }

  async getAllReportDetailsForExport(reportId) {
    const report = await PerformanceReport.findById(reportId);
    if (!report) {
      throw new Error('报表不存在');
    }

    const query = {
      createdAt: { $gte: report.period.startDate, $lte: report.period.endDate }
    };

    const applications = await Application.find(query)
      .sort({ createdAt: -1 })
      .populate('serviceItem', 'itemCode itemName itemType')
      .populate('applicant', 'name type')
      .populate('approvalAssignments.department', 'name')
      .populate('approvalAssignments.approver', 'name')
      .populate('certificate', 'certificateNo');

    return applications.map(app => ({
      applicationNo: app.applicationNo,
      itemCode: app.serviceItem?.itemCode || '',
      itemName: app.serviceItem?.itemName || '',
      itemType: this.getItemTypeName(app.serviceItem?.itemType) || '',
      applicantName: app.applicantInfo?.name || app.applicant?.name || '',
      applicantType: app.applicantType === 'personal' ? '个人' : '企业',
      currentStatus: this.getStatusText(app.currentStatus),
      useFastTrack: app.useFastTrack ? '是' : '否',
      hasTimeout: app.hasTimeout ? '是' : '否',
      timeoutCount: app.timeoutCount || 0,
      processingDays: app.processingDays || 0,
      isTimelyCompleted: app.isTimelyCompleted ? '是' : '否',
      submittedAt: app.submittedAt ? app.submittedAt.toLocaleString() : '',
      completedAt: app.completedAt ? app.completedAt.toLocaleString() : '',
      departments: [...new Set(app.approvalAssignments.map(a => a.department?.name).filter(Boolean))].join('、'),
      currentApprover: app.approvalAssignments.find(a => a.status === 'pending')?.approver?.name || '',
      certificateNo: app.certificate?.certificateNo || ''
    }));
  }

  getStatusText(status) {
    const statusMap = {
      [APPLICATION_STATUS.DRAFT]: '草稿',
      [APPLICATION_STATUS.SUBMITTED]: '已提交',
      [APPLICATION_STATUS.MATERIAL_MISSING]: '材料缺失',
      [APPLICATION_STATUS.PENDING_APPROVAL]: '待审批',
      [APPLICATION_STATUS.PARALLEL_APPROVAL]: '并联审批中',
      [APPLICATION_STATUS.APPROVED]: '审批通过',
      [APPLICATION_STATUS.REJECTED]: '已驳回',
      [APPLICATION_STATUS.RETURNED]: '已退回',
      [APPLICATION_STATUS.TIMEOUT_ESCALATED]: '超时转交',
      [APPLICATION_STATUS.REVOKED]: '已撤销',
      [APPLICATION_STATUS.COMPLETED]: '已完成'
    };
    return statusMap[status] || status;
  }

  fillDetailsSheet(sheet, details) {
    sheet.columns = [
      { header: '申请编号', key: 'applicationNo', width: 20 },
      { header: '事项编码', key: 'itemCode', width: 15 },
      { header: '事项名称', key: 'itemName', width: 25 },
      { header: '事项类型', key: 'itemType', width: 12 },
      { header: '申请人', key: 'applicantName', width: 15 },
      { header: '申请人类型', key: 'applicantType', width: 10 },
      { header: '当前状态', key: 'currentStatus', width: 12 },
      { header: '快速通道', key: 'useFastTrack', width: 10 },
      { header: '是否超时', key: 'hasTimeout', width: 10 },
      { header: '超时次数', key: 'timeoutCount', width: 10 },
      { header: '办理时长(天)', key: 'processingDays', width: 12 },
      { header: '按时完成', key: 'isTimelyCompleted', width: 10 },
      { header: '提交时间', key: 'submittedAt', width: 20 },
      { header: '完成时间', key: 'completedAt', width: 20 },
      { header: '涉及部门', key: 'departments', width: 25 },
      { header: '当前审批人', key: 'currentApprover', width: 12 },
      { header: '证照编号', key: 'certificateNo', width: 20 }
    ];

    details.forEach(row => sheet.addRow(row));

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  }

  async exportReportToExcel(reportId) {
    const report = await PerformanceReport.findById(reportId);
    if (!report) {
      throw new Error('报表不存在');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '政务审批系统';
    workbook.created = new Date();

    const overallSheet = workbook.addWorksheet('总体统计');
    this.fillOverallSheet(overallSheet, report);

    const deptSheet = workbook.addWorksheet('部门统计');
    this.fillDepartmentSheet(deptSheet, report);

    const itemSheet = workbook.addWorksheet('事项统计');
    this.fillItemSheet(itemSheet, report);

    const topItemsSheet = workbook.addWorksheet('热门事项');
    this.fillTopItemsSheet(topItemsSheet, report);

    const timeoutSheet = workbook.addWorksheet('超时排行');
    this.fillTimeoutSheet(timeoutSheet, report);

    const details = await this.getAllReportDetailsForExport(reportId);
    const detailsSheet = workbook.addWorksheet('申请明细');
    this.fillDetailsSheet(detailsSheet, details);

    const fileName = `效能报表_${report.period.year}年${report.period.month}月_${report.reportNo}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();

    report.exportedFiles.push({
      format: 'xlsx',
      url: `/api/reports/${reportId}/export`,
      exportedAt: new Date()
    });
    await report.save();

    return { buffer, fileName };
  }

  async exportPerformanceReport(startDate, endDate) {
    const report = await this.generateReportByPeriod(startDate, endDate, '临时导出报表', null);
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '政务审批系统';
    workbook.created = new Date();

    const overallSheet = workbook.addWorksheet('总体统计');
    this.fillOverallSheet(overallSheet, report);

    const deptSheet = workbook.addWorksheet('部门统计');
    this.fillDepartmentSheet(deptSheet, report);

    const itemSheet = workbook.addWorksheet('事项统计');
    this.fillItemSheet(itemSheet, report);

    const topItemsSheet = workbook.addWorksheet('热门事项');
    this.fillTopItemsSheet(topItemsSheet, report);

    const timeoutSheet = workbook.addWorksheet('超时排行');
    this.fillTimeoutSheet(timeoutSheet, report);

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  fillOverallSheet(sheet, report) {
    sheet.columns = [
      { header: '指标', key: 'metric', width: 30 },
      { header: '数值', key: 'value', width: 20 }
    ];

    const stats = report.overallStats;
    const data = [
      { metric: '统计周期', value: `${report.period.year}年${report.period.month}月` },
      { metric: '总申请数', value: stats.totalApplications },
      { metric: '已办结数', value: stats.completedApplications },
      { metric: '办理中数', value: stats.pendingApplications },
      { metric: '按时办结数', value: stats.timelyCompleted },
      { metric: '按时办结率', value: `${stats.timelyCompletionRate}%` },
      { metric: '超时办结数', value: stats.timeoutApplications },
      { metric: '超时率', value: `${stats.timeoutRate}%` },
      { metric: '退件数', value: stats.returnedApplications },
      { metric: '退件率', value: `${stats.returnRate}%` },
      { metric: '驳回数', value: stats.rejectedApplications },
      { metric: '平均办理时长(天)', value: stats.averageProcessingDays },
      { metric: '快速通道申请数', value: stats.fastTrackApplications },
      { metric: '并联审批申请数', value: stats.parallelApprovalApplications },
      { metric: '生成证照数', value: stats.certificatesGenerated }
    ];

    data.forEach(row => sheet.addRow(row));

    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  }

  fillDepartmentSheet(sheet, report) {
    sheet.columns = [
      { header: '部门名称', key: 'name', width: 20 },
      { header: '总办理数', key: 'total', width: 12 },
      { header: '办结数', key: 'completed', width: 12 },
      { header: '按时办结率', key: 'timelyRate', width: 12 },
      { header: '超时数', key: 'timeout', width: 12 },
      { header: '超时率', key: 'timeoutRate', width: 12 },
      { header: '退件数', key: 'returned', width: 12 },
      { header: '退件率', key: 'returnRate', width: 12 },
      { header: '平均办理时长', key: 'avgDays', width: 15 }
    ];

    report.departmentStats.forEach(dept => {
      sheet.addRow({
        name: dept.departmentName,
        total: dept.totalApplications,
        completed: dept.completedApplications,
        timelyRate: `${dept.timelyCompletionRate}%`,
        timeout: dept.timeoutApplications,
        timeoutRate: `${dept.timeoutRate}%`,
        returned: dept.returnedApplications,
        returnRate: `${dept.returnRate}%`,
        avgDays: dept.averageProcessingDays
      });
    });

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  }

  fillItemSheet(sheet, report) {
    sheet.columns = [
      { header: '事项编码', key: 'code', width: 20 },
      { header: '事项名称', key: 'name', width: 30 },
      { header: '申请数', key: 'total', width: 12 },
      { header: '办结数', key: 'completed', width: 12 },
      { header: '按时办结率', key: 'timelyRate', width: 12 },
      { header: '超时率', key: 'timeoutRate', width: 12 },
      { header: '退件率', key: 'returnRate', width: 12 },
      { header: '平均办理时长', key: 'avgDays', width: 15 }
    ];

    report.itemStats.forEach(item => {
      sheet.addRow({
        code: item.itemCode,
        name: item.itemName,
        total: item.totalApplications,
        completed: item.completedApplications,
        timelyRate: `${item.timelyCompletionRate}%`,
        timeoutRate: `${item.timeoutRate}%`,
        returnRate: `${item.returnRate}%`,
        avgDays: item.averageProcessingDays
      });
    });

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  }

  fillTopItemsSheet(sheet, report) {
    sheet.columns = [
      { header: '排名', key: 'rank', width: 8 },
      { header: '事项编码', key: 'code', width: 20 },
      { header: '事项名称', key: 'name', width: 30 },
      { header: '申请量', key: 'count', width: 12 }
    ];

    report.topItems.forEach((item, index) => {
      sheet.addRow({
        rank: index + 1,
        code: item.itemCode,
        name: item.itemName,
        count: item.count
      });
    });

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  }

  fillTimeoutSheet(sheet, report) {
    sheet.columns = [
      { header: '排名', key: 'rank', width: 8 },
      { header: '部门', key: 'name', width: 25 },
      { header: '超时数', key: 'count', width: 12 },
      { header: '超时率', key: 'rate', width: 12 }
    ];

    report.timeoutRankings.forEach((item, index) => {
      sheet.addRow({
        rank: index + 1,
        name: item.department,
        count: item.timeoutCount,
        rate: `${item.timeoutRate}%`
      });
    });

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  }

  async getRealTimeStats(startDate, endDate) {
    const query = {};
    if (startDate) query.createdAt = { $gte: new Date(startDate) };
    if (endDate) query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };

    const applications = await Application.find(query);

    const total = applications.length;
    const pending = applications.filter(a => 
      ['pending_approval', 'parallel_approval', 'material_missing', 'submitted'].includes(a.currentStatus)
    ).length;
    const approved = applications.filter(a => 
      ['approved', 'completed'].includes(a.currentStatus)
    ).length;
    const rejected = applications.filter(a => a.currentStatus === 'rejected').length;
    const returned = applications.filter(a => a.currentStatus === 'returned').length;
    const timeout = applications.filter(a => a.hasTimeout).length;

    const totalDays = approved.reduce((sum, a) => sum + (a.processingDays || 0), 0);
    const avgDays = approved.length > 0 ? Math.round((totalDays / approved.length) * 100) / 100 : 0;

    return {
      totalApplications: total,
      pendingApplications: pending,
      approvedApplications: approved,
      rejectedApplications: rejected,
      returnedApplications: returned,
      timeoutApplications: timeout,
      approvalRate: total > 0 ? Math.round((approved / total) * 10000) / 100 : 0,
      averageProcessingDays: avgDays,
      timelyRate: approved > 0 ? Math.round(((approved - timeout) / approved) * 10000) / 100 : 100
    };
  }
}

module.exports = new PerformanceService();
