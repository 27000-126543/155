const User = require('../models/User');
const Credit = require('../models/Credit');
const { successResponse, errorResponse, asyncHandler, maskIdCard, maskPhone } = require('../utils/helpers');

exports.register = asyncHandler(async (req, res) => {
  const { username, password, name, idCard, phone, email, type, enterpriseInfo } = req.body;

  const existingUser = await User.findOne({ $or: [{ username }, { idCard }] });
  if (existingUser) {
    return errorResponse(res, '用户名或身份证号已存在', 400);
  }

  if (!['personal', 'enterprise'].includes(type)) {
    return errorResponse(res, '用户类型不正确', 400);
  }

  const user = new User({
    username,
    password,
    name,
    idCard,
    phone,
    email,
    type,
    enterpriseInfo: type === 'enterprise' ? enterpriseInfo : undefined
  });

  await user.save();

  const credit = new Credit({ user: user._id });
  await credit.save();

  const token = user.getSignedJwtToken();

  successResponse(res, {
    token,
    user: {
      id: user._id,
      username: user.username,
      name: user.name,
      type: user.type,
      phone: maskPhone(user.phone),
      idCard: maskIdCard(user.idCard)
    }
  }, '注册成功', 201);
});

exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return errorResponse(res, '请提供用户名和密码', 400);
  }

  const user = await User.findOne({ username }).select('+password');
  if (!user) {
    return errorResponse(res, '用户名或密码错误', 401);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return errorResponse(res, '用户名或密码错误', 401);
  }

  if (user.status !== 'active') {
    return errorResponse(res, '用户账号已被禁用', 403);
  }

  const token = user.getSignedJwtToken();

  successResponse(res, {
    token,
    user: {
      id: user._id,
      username: user.username,
      name: user.name,
      type: user.type,
      phone: maskPhone(user.phone),
      idCard: maskIdCard(user.idCard),
      department: user.department,
      position: user.position,
      approvalLevel: user.approvalLevel,
      fastTrackEnabled: user.fastTrackEnabled
    }
  }, '登录成功');
});

exports.logout = asyncHandler(async (req, res) => {
  successResponse(res, null, '退出登录成功');
});

exports.getMe = asyncHandler(async (req, res) => {
  const user = req.user;
  
  const credit = await Credit.findOne({ user: user._id });

  successResponse(res, {
    user: {
      id: user._id,
      username: user.username,
      name: user.name,
      type: user.type,
      phone: maskPhone(user.phone),
      email: user.email,
      idCard: maskIdCard(user.idCard),
      enterpriseInfo: user.enterpriseInfo ? {
        name: user.enterpriseInfo.name,
        creditCode: user.enterpriseInfo.creditCode
      } : undefined,
      department: user.department,
      position: user.position,
      approvalLevel: user.approvalLevel,
      fastTrackEnabled: user.fastTrackEnabled,
      status: user.status,
      createdAt: user.createdAt
    },
    credit: credit ? {
      score: credit.score,
      level: credit.level,
      fastTrackRestricted: credit.fastTrackRestricted,
      restrictionReason: credit.restrictionReason,
      approvalLevel: credit.approvalLevel
    } : null
  });
});

exports.getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id)
    .populate('department', 'code name')
    .select('-password');

  if (!user) {
    return errorResponse(res, '用户不存在', 404);
  }

  const credit = await Credit.findOne({ user: user._id });

  successResponse(res, {
    user: {
      id: user._id,
      username: user.username,
      name: user.name,
      type: user.type,
      phone: maskPhone(user.phone),
      email: user.email,
      idCard: maskIdCard(user.idCard),
      enterpriseInfo: user.enterpriseInfo,
      department: user.department,
      position: user.position,
      approvalLevel: user.approvalLevel,
      fastTrackEnabled: user.fastTrackEnabled,
      status: user.status,
      createdAt: user.createdAt
    },
    credit: credit ? {
      score: credit.score,
      level: credit.level,
      fastTrackRestricted: credit.fastTrackRestricted,
      restrictionReason: credit.restrictionReason,
      approvalLevel: credit.approvalLevel
    } : null
  });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, email } = req.body;
  
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, phone, email },
    { new: true, runValidators: true }
  );

  successResponse(res, {
    id: user._id,
    name: user.name,
    phone: maskPhone(user.phone),
    email: user.email
  }, '个人信息更新成功');
});

exports.updatePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return errorResponse(res, '请提供原密码和新密码', 400);
  }

  if (newPassword.length < 6) {
    return errorResponse(res, '新密码长度不能少于6位', 400);
  }

  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await user.comparePassword(oldPassword);
  
  if (!isMatch) {
    return errorResponse(res, '原密码错误', 400);
  }

  user.password = newPassword;
  await user.save();

  successResponse(res, null, '密码修改成功');
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return errorResponse(res, '请提供有效的新密码（至少6位）', 400);
  }

  const user = await User.findById(id);
  if (!user) {
    return errorResponse(res, '用户不存在', 404);
  }

  user.password = newPassword;
  await user.save();

  successResponse(res, null, '密码重置成功');
});

exports.createUser = asyncHandler(async (req, res) => {
  const { username, password, name, idCard, phone, email, type, department, position, approvalLevel } = req.body;

  const existingUser = await User.findOne({ $or: [{ username }, { idCard }] });
  if (existingUser) {
    return errorResponse(res, '用户名或身份证号已存在', 400);
  }

  const user = new User({
    username,
    password,
    name,
    idCard,
    phone,
    email,
    type,
    department,
    position,
    approvalLevel
  });

  await user.save();

  if (type === 'approver' && department) {
    const Department = require('../models/Department');
    await Department.findByIdAndUpdate(department, {
      $addToSet: { approvers: user._id }
    });
  }

  successResponse(res, {
    id: user._id,
    username: user.username,
    name: user.name,
    type: user.type
  }, '用户创建成功', 201);
});

exports.getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, type, status, department } = req.query;
  const query = {};

  if (type) query.type = type;
  if (status) query.status = status;
  if (department) query.department = department;

  const skip = (page - 1) * limit;

  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('department', 'code name')
    .select('-password');

  const total = await User.countDocuments(query);

  successResponse(res, {
    users,
    pagination: {
      currentPage: parseInt(page),
      perPage: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      total
    }
  });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, type, department, position, approvalLevel, status, fastTrackEnabled } = req.body;

  const oldUser = await User.findById(id);
  if (!oldUser) {
    return errorResponse(res, '用户不存在', 404);
  }

  const updateData = { name, phone, email, type, position, approvalLevel, status, fastTrackEnabled };

  if (department && department !== oldUser.department?.toString()) {
    const Department = require('../models/Department');
    
    if (oldUser.department) {
      await Department.findByIdAndUpdate(oldUser.department, {
        $pull: { approvers: oldUser._id }
      });
    }

    if (type === 'approver') {
      await Department.findByIdAndUpdate(department, {
        $addToSet: { approvers: oldUser._id }
      });
    }

    updateData.department = department;
  }

  const user = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

  successResponse(res, user, '用户信息更新成功');
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    return errorResponse(res, '用户不存在', 404);
  }

  if (user.department) {
    const Department = require('../models/Department');
    await Department.findByIdAndUpdate(user.department, {
      $pull: { approvers: user._id }
    });
  }

  await User.findByIdAndDelete(id);

  successResponse(res, null, '用户删除成功');
});
