const Department = require('../models/Department');
const User = require('../models/User');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');

exports.createDepartment = asyncHandler(async (req, res) => {
  const { code, name, parentDepartment, level, description, contact } = req.body;

  const existingDept = await Department.findOne({ code });
  if (existingDept) {
    return errorResponse(res, '部门编码已存在', 400);
  }

  if (parentDepartment) {
    const parent = await Department.findById(parentDepartment);
    if (!parent) {
      return errorResponse(res, '上级部门不存在', 400);
    }
  }

  const department = new Department({
    code,
    name,
    parentDepartment,
    level,
    description,
    contact
  });

  await department.save();

  successResponse(res, department, '部门创建成功', 201);
});

exports.getDepartments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 0, status, level, parentDepartment } = req.query;
  const query = {};

  if (status) query.status = status;
  if (level) query.level = level;
  if (parentDepartment) query.parentDepartment = parentDepartment;

  let departments;
  let total;

  if (limit > 0) {
    const skip = (page - 1) * limit;
    departments = await Department.find(query)
      .sort({ code: 1 })
      .skip(skip)
      .limit(limit)
      .populate('parentDepartment', 'code name')
      .populate('approvers', '_id name position approvalLevel');

    total = await Department.countDocuments(query);
  } else {
    departments = await Department.find(query)
      .sort({ code: 1 })
      .populate('parentDepartment', 'code name')
      .populate('approvers', '_id name position approvalLevel');

    total = departments.length;
  }

  successResponse(res, {
    departments,
    pagination: limit > 0 ? {
      currentPage: parseInt(page),
      perPage: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      total
    } : undefined
  });
});

exports.getDepartmentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const department = await Department.findById(id)
    .populate('parentDepartment', 'code name')
    .populate('approvers', '_id name position approvalLevel status');

  if (!department) {
    return errorResponse(res, '部门不存在', 404);
  }

  successResponse(res, department);
});

exports.updateDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code, name, parentDepartment, level, description, contact, status } = req.body;

  if (code) {
    const existingDept = await Department.findOne({ code, _id: { $ne: id } });
    if (existingDept) {
      return errorResponse(res, '部门编码已存在', 400);
    }
  }

  if (parentDepartment) {
    const parent = await Department.findById(parentDepartment);
    if (!parent) {
      return errorResponse(res, '上级部门不存在', 400);
    }

    if (parentDepartment === id) {
      return errorResponse(res, '不能将本部门设为上级部门', 400);
    }
  }

  const department = await Department.findByIdAndUpdate(
    id,
    { code, name, parentDepartment, level, description, contact, status },
    { new: true, runValidators: true }
  );

  if (!department) {
    return errorResponse(res, '部门不存在', 404);
  }

  successResponse(res, department, '部门信息更新成功');
});

exports.deleteDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const department = await Department.findById(id);
  if (!department) {
    return errorResponse(res, '部门不存在', 404);
  }

  const childDepts = await Department.countDocuments({ parentDepartment: id });
  if (childDepts > 0) {
    return errorResponse(res, '存在下级部门，无法删除', 400);
  }

  const approvers = await User.countDocuments({ department: id, type: 'approver', status: 'active' });
  if (approvers > 0) {
    return errorResponse(res, '部门下存在审批人员，无法删除', 400);
  }

  await Department.findByIdAndDelete(id);

  successResponse(res, null, '部门删除成功');
});

exports.addApprover = asyncHandler(async (req, res) => {
  const { id: departmentId } = req.params;
  const { userId, role } = req.body;

  const department = await Department.findById(departmentId);
  if (!department) {
    return errorResponse(res, '部门不存在', 404);
  }

  const user = await User.findById(userId);
  if (!user) {
    return errorResponse(res, '用户不存在', 404);
  }

  if (user.type !== 'approver' && user.type !== 'admin') {
    return errorResponse(res, '只有审批人员或管理员才能加入审批列表', 400);
  }

  if (user.status !== 'active') {
    return errorResponse(res, '用户状态不正确', 400);
  }

  const existingApprover = department.approvers.find(
    a => a.user && a.user.toString() === userId.toString()
  );
  if (existingApprover) {
    return errorResponse(res, '该用户已在审批列表中', 400);
  }

  department.approvers.push({
    user: userId,
    role: role || 'reviewer'
  });
  await department.save();

  if (!user.department || user.department.toString() !== departmentId.toString()) {
    await User.findByIdAndUpdate(userId, { department: departmentId });
  }

  successResponse(res, department, '审批人员添加成功');
});

exports.removeApprover = asyncHandler(async (req, res) => {
  const { id: departmentId, approverId } = req.params;

  const department = await Department.findById(departmentId);
  if (!department) {
    return errorResponse(res, '部门不存在', 404);
  }

  const initialLength = department.approvers.length;
  department.approvers = department.approvers.filter(
    a => a.user && a.user.toString() !== approverId.toString()
  );

  if (department.approvers.length === initialLength) {
    return errorResponse(res, '该用户不在审批列表中', 400);
  }

  await department.save();

  successResponse(res, department, '审批人员移除成功');
});

exports.updateApproverRole = asyncHandler(async (req, res) => {
  const { id: departmentId, approverId } = req.params;
  const { role } = req.body;

  if (!role || !['reviewer', 'approver', 'supervisor'].includes(role)) {
    return errorResponse(res, '请提供有效的角色（reviewer/approver/supervisor）', 400);
  }

  const department = await Department.findById(departmentId);
  if (!department) {
    return errorResponse(res, '部门不存在', 404);
  }

  const approver = department.approvers.find(
    a => a.user && a.user.toString() === approverId.toString()
  );

  if (!approver) {
    return errorResponse(res, '该用户不在审批列表中', 404);
  }

  approver.role = role;
  await department.save();

  successResponse(res, department, '审批人员角色更新成功');
});

exports.getDepartmentTree = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const buildTree = async (parentId) => {
    const departments = await Department.find({ parentDepartment: parentId })
      .populate('approvers.user', '_id name position approvalLevel');
    
    const result = [];
    for (const dept of departments) {
      const children = await buildTree(dept._id);
      result.push({
        ...dept.toObject(),
        children
      });
    }
    return result;
  };

  let tree;
  if (id && id !== 'root') {
    const rootDept = await Department.findById(id)
      .populate('approvers.user', '_id name position approvalLevel');
    if (!rootDept) {
      return errorResponse(res, '部门不存在', 404);
    }
    const children = await buildTree(id);
    tree = {
      ...rootDept.toObject(),
      children
    };
  } else {
    tree = await buildTree(null);
  }

  successResponse(res, { tree });
});
