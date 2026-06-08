const Credit = require('../models/Credit');
const User = require('../models/User');
const { successResponse, errorResponse, asyncHandler, paginate } = require('../utils/helpers');
const { CREDIT_RECORD_TYPE, SCORE_CHANGE } = require('../utils/constants');

exports.getMyCredit = asyncHandler(async (req, res) => {
  let credit = await Credit.findOne({ user: req.user._id });
  
  if (!credit) {
    credit = new Credit({ user: req.user._id });
    await credit.save();
  }

  successResponse(res, {
    credit: {
      score: credit.score,
      level: credit.level,
      timeoutCount: credit.timeoutCount,
      fraudCount: credit.fraudCount,
      lateSubmissionCount: credit.lateSubmissionCount,
      approvalLevel: credit.approvalLevel,
      fastTrackRestricted: credit.fastTrackRestricted,
      restrictionReason: credit.restrictionReason,
      restrictionUntil: credit.restrictionUntil,
      lastUpdated: credit.lastUpdated
    }
  });
});

exports.getCreditByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    return errorResponse(res, '用户不存在', 404);
  }

  let credit = await Credit.findOne({ user: userId });
  
  if (!credit) {
    credit = new Credit({ user: userId });
    await credit.save();
  }

  successResponse(res, {
    credit: {
      userId: user._id,
      userName: user.name,
      userType: user.type,
      score: credit.score,
      level: credit.level,
      timeoutCount: credit.timeoutCount,
      fraudCount: credit.fraudCount,
      lateSubmissionCount: credit.lateSubmissionCount,
      approvalLevel: credit.approvalLevel,
      fastTrackRestricted: credit.fastTrackRestricted,
      restrictionReason: credit.restrictionReason,
      restrictionUntil: credit.restrictionUntil,
      lastUpdated: credit.lastUpdated
    }
  });
});

exports.getMyCreditRecords = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, type } = req.query;

  const credit = await Credit.findOne({ user: req.user._id });
  if (!credit) {
    return successResponse(res, { records: [], pagination: { currentPage: 1, totalPages: 0, total: 0 } });
  }

  let records = credit.records;
  if (type) {
    records = records.filter(r => r.type === type);
  }

  records.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));

  const total = records.length;
  const pagination = paginate(page, limit, total);
  
  const pagedRecords = records.slice(pagination.skip, pagination.skip + pagination.perPage);

  successResponse(res, {
    records: pagedRecords,
    pagination
  });
});

exports.getAllCredits = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, level, minScore, maxScore, fastTrackRestricted } = req.query;
  const query = {};

  if (level) query.level = level;
  if (minScore) query.score = { ...query.score, $gte: parseInt(minScore) };
  if (maxScore) query.score = { ...query.score, $lte: parseInt(maxScore) };
  if (fastTrackRestricted !== undefined) query.fastTrackRestricted = fastTrackRestricted === 'true';

  const total = await Credit.countDocuments(query);
  const pagination = paginate(page, limit, total);

  const credits = await Credit.find(query)
    .sort({ score: -1 })
    .skip(pagination.skip)
    .limit(pagination.perPage)
    .populate('user', 'name type phone');

  successResponse(res, {
    credits,
    pagination
  });
});

exports.addCreditRecord = asyncHandler(async (req, res) => {
  const { userId, type, description, applicationId, scoreChange, evidence } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return errorResponse(res, '用户不存在', 404);
  }

  if (!Object.values(CREDIT_RECORD_TYPE).includes(type)) {
    return errorResponse(res, '无效的信用记录类型', 400);
  }

  let credit = await Credit.findOne({ user: userId });
  if (!credit) {
    credit = new Credit({ user: userId });
  }

  const record = {
    type,
    description,
    application: applicationId,
    scoreChange: scoreChange || SCORE_CHANGE[type.toUpperCase()] || 0,
    operator: req.user._id,
    evidence
  };

  credit.records.push(record);
  credit.score = Math.max(0, Math.min(100, credit.score + record.scoreChange));

  if (type === CREDIT_RECORD_TYPE.TIMEOUT_APPLICATION) {
    credit.timeoutCount++;
  } else if (type === CREDIT_RECORD_TYPE.MATERIAL_FRAUD) {
    credit.fraudCount++;
  } else if (type === CREDIT_RECORD_TYPE.LATE_MATERIAL_SUBMISSION) {
    credit.lateSubmissionCount++;
  }

  await credit.save();

  if (credit.fraudCount > 0 || credit.timeoutCount >= 3) {
    await User.findByIdAndUpdate(userId, {
      approvalLevel: credit.approvalLevel,
      fastTrackEnabled: false
    });
  }

  successResponse(res, { credit, record }, '信用记录添加成功');
});

exports.adjustCreditScore = asyncHandler(async (req, res) => {
  const { userId, scoreChange, reason } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return errorResponse(res, '用户不存在', 404);
  }

  if (isNaN(scoreChange) || scoreChange === 0) {
    return errorResponse(res, '请提供有效的分数调整值', 400);
  }

  let credit = await Credit.findOne({ user: userId });
  if (!credit) {
    credit = new Credit({ user: userId });
  }

  const record = {
    type: scoreChange > 0 ? CREDIT_RECORD_TYPE.GOOD_BEHAVIOR : CREDIT_RECORD_TYPE.VOLUNTARY_CORRECTION,
    description: reason || (scoreChange > 0 ? '信用分奖励' : '信用分扣除'),
    scoreChange,
    operator: req.user._id
  };

  credit.records.push(record);
  credit.score = Math.max(0, Math.min(100, credit.score + scoreChange));

  await credit.save();

  successResponse(res, { credit, record }, `信用分已${scoreChange > 0 ? '增加' : '扣除'}${Math.abs(scoreChange)}分`);
});

exports.restrictFastTrack = asyncHandler(async (req, res) => {
  const { userId, reason, restrictionDays } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return errorResponse(res, '用户不存在', 404);
  }

  let credit = await Credit.findOne({ user: userId });
  if (!credit) {
    credit = new Credit({ user: userId });
  }

  credit.fastTrackRestricted = true;
  credit.restrictionReason = reason || '系统限制';
  if (restrictionDays) {
    const restrictionUntil = new Date();
    restrictionUntil.setDate(restrictionUntil.getDate() + restrictionDays);
    credit.restrictionUntil = restrictionUntil;
  }

  await credit.save();

  await User.findByIdAndUpdate(userId, {
    fastTrackEnabled: false
  });

  successResponse(res, { credit }, '快速通道已限制');
});

exports.unrestrictFastTrack = asyncHandler(async (req, res) => {
  const { userId, reason } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return errorResponse(res, '用户不存在', 404);
  }

  let credit = await Credit.findOne({ user: userId });
  if (!credit) {
    credit = new Credit({ user: userId });
  }

  credit.fastTrackRestricted = false;
  credit.restrictionReason = null;
  credit.restrictionUntil = null;

  const record = {
    type: CREDIT_RECORD_TYPE.GOOD_BEHAVIOR,
    description: reason || '快速通道限制已解除',
    scoreChange: 5,
    operator: req.user._id
  };
  credit.records.push(record);
  credit.score = Math.min(100, credit.score + 5);

  await credit.save();

  await User.findByIdAndUpdate(userId, {
    fastTrackEnabled: true
  });

  successResponse(res, { credit }, '快速通道限制已解除');
});

exports.getCreditStatistics = asyncHandler(async (req, res) => {
  const stats = await Credit.aggregate([
    {
      $group: {
        _id: '$level',
        count: { $sum: 1 },
        avgScore: { $avg: '$score' }
      }
    },
    {
      $project: {
        level: '$_id',
        count: 1,
        avgScore: { $round: ['$avgScore', 2] },
        _id: 0
      }
    }
  ]);

  const totalUsers = await Credit.countDocuments();
  const restrictedUsers = await Credit.countDocuments({ fastTrackRestricted: true });
  const avgScore = await Credit.aggregate([
    { $group: { _id: null, avg: { $avg: '$score' } } }
  ]);

  const timeoutStats = await Credit.aggregate([
    {
      $match: { timeoutCount: { $gt: 0 } }
    },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        totalTimeouts: { $sum: '$timeoutCount' },
        avgTimeouts: { $avg: '$timeoutCount' }
      }
    }
  ]);

  const fraudStats = await Credit.aggregate([
    {
      $match: { fraudCount: { $gt: 0 } }
    },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        totalFrauds: { $sum: '$fraudCount' }
      }
    }
  ]);

  successResponse(res, {
    levelDistribution: stats,
    totalUsers,
    restrictedUsers,
    averageScore: avgScore.length > 0 ? Math.round(avgScore[0].avg * 100) / 100 : 0,
    timeoutStats: timeoutStats.length > 0 ? {
      usersWithTimeout: timeoutStats[0].totalUsers,
      totalTimeoutCount: timeoutStats[0].totalTimeouts,
      averageTimeoutCount: Math.round(timeoutStats[0].avgTimeouts * 100) / 100
    } : null,
    fraudStats: fraudStats.length > 0 ? {
      usersWithFraud: fraudStats[0].totalUsers,
      totalFraudCount: fraudStats[0].totalFrauds
    } : null
  });
});

exports.checkExpiredRestrictions = asyncHandler(async (req, res) => {
  const now = new Date();
  const expiredRestrictions = await Credit.find({
    fastTrackRestricted: true,
    restrictionUntil: { $lt: now }
  });

  const results = [];
  for (const credit of expiredRestrictions) {
    credit.fastTrackRestricted = false;
    credit.restrictionReason = null;
    credit.restrictionUntil = null;
    await credit.save();

    await User.findByIdAndUpdate(credit.user, {
      fastTrackEnabled: true
    });

    results.push({
      userId: credit.user,
      message: '快速通道限制已自动解除'
    });
  }

  successResponse(res, { 
    processed: results.length,
    results 
  }, `已自动解除${results.length}个过期限制`);
});
