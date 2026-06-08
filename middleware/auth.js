const jwt = require('jsonwebtoken');
const { errorResponse, asyncHandler } = require('../utils/helpers');
const User = require('../models/User');
const { USER_TYPE } = require('../utils/constants');

exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return errorResponse(res, '未授权访问，请先登录', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return errorResponse(res, '用户不存在', 401);
    }
    
    if (user.status !== 'active') {
      return errorResponse(res, '用户账号已被禁用', 403);
    }
    
    req.user = user;
    next();
  } catch (error) {
    return errorResponse(res, '无效的访问令牌，请重新登录', 401);
  }
});

exports.authorize = (...types) => {
  return (req, res, next) => {
    if (!types.includes(req.user.type)) {
      return errorResponse(res, '权限不足，无法执行此操作', 403);
    }
    next();
  };
};

exports.isApprover = asyncHandler(async (req, res, next) => {
  if (req.user.type !== USER_TYPE.APPROVER && req.user.type !== USER_TYPE.ADMIN) {
    return errorResponse(res, '需要审批人权限', 403);
  }
  next();
});

exports.isAdmin = asyncHandler(async (req, res, next) => {
  if (req.user.type !== USER_TYPE.ADMIN) {
    return errorResponse(res, '需要管理员权限', 403);
  }
  next();
});

exports.isSupervisor = asyncHandler(async (req, res, next) => {
  if (req.user.type !== USER_TYPE.SUPERVISOR && req.user.type !== USER_TYPE.ADMIN) {
    return errorResponse(res, '需要监督人员权限', 403);
  }
  next();
});

exports.isApplicant = asyncHandler(async (req, res, next) => {
  if (req.user.type !== USER_TYPE.PERSONAL && req.user.type !== USER_TYPE.ENTERPRISE) {
    return errorResponse(res, '需要申请人权限', 403);
  }
  next();
});

exports.canAccessApplication = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userType = req.user.type;
  
  if (userType === USER_TYPE.ADMIN || userType === USER_TYPE.SUPERVISOR) {
    return next();
  }
  
  const Application = require('../models/Application');
  const application = await Application.findById(id);
  
  if (!application) {
    return errorResponse(res, '申请不存在', 404);
  }
  
  if (application.applicant.toString() === req.user._id.toString()) {
    return next();
  }
  
  const currentAssignment = application.approvalAssignments.find(
    a => a.status !== 'completed' && a.approver.toString() === req.user._id.toString()
  );
  
  if (currentAssignment) {
    return next();
  }
  
  const parallelApproval = application.parallelApprovals.find(
    pa => pa.departments.some(d => d.approver && d.approver.toString() === req.user._id.toString())
  );
  
  if (parallelApproval) {
    return next();
  }
  
  return errorResponse(res, '无权访问此申请', 403);
});

exports.rateLimiter = (() => {
  const rateLimit = require('express-rate-limit');
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
      success: false,
      message: '请求过于频繁，请稍后再试'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
})();

exports.notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `未找到 ${req.method} ${req.originalUrl}`
  });
};

exports.errorHandler = (err, req, res, next) => {
  console.error('错误:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || '服务器内部错误',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
