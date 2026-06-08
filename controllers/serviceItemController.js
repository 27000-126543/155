const ServiceItem = require('../models/ServiceItem');
const { successResponse, errorResponse, asyncHandler, paginate } = require('../utils/helpers');

exports.createServiceItem = asyncHandler(async (req, res) => {
  const { 
    itemCode, itemName, itemType, category, description, legalBasis,
    handlingTime, processingLocation, materials, approvalChain,
    supportsFastTrack, fastTrackTimeoutDays, requiredCreditScore,
    certificateTemplate, sharingPlatformCode, status
  } = req.body;

  const existingItem = await ServiceItem.findOne({ itemCode });
  if (existingItem) {
    return errorResponse(res, '事项编码已存在', 400);
  }

  if (approvalChain && approvalChain.length > 0) {
    const stepOrders = approvalChain.map(s => s.stepOrder);
    const uniqueOrders = [...new Set(stepOrders)];
    if (stepOrders.length !== uniqueOrders.length) {
      return errorResponse(res, '审批步骤序号不能重复', 400);
    }

    for (const step of approvalChain) {
      if (step.type === 'parallel' && (!step.parallelDepartments || step.parallelDepartments.length === 0)) {
        return errorResponse(res, '并联审批步骤需要指定联办部门', 400);
      }
    }
  }

  const serviceItem = new ServiceItem({
    itemCode,
    itemName,
    itemType,
    category,
    description,
    legalBasis,
    handlingTime,
    processingLocation,
    materials: materials || [],
    approvalChain: approvalChain || [],
    supportsFastTrack,
    fastTrackTimeoutDays,
    requiredCreditScore,
    certificateTemplate,
    sharingPlatformCode,
    status,
    createdBy: req.user._id
  });

  await serviceItem.save();

  successResponse(res, serviceItem, '事项创建成功', 201);
});

exports.getServiceItems = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, itemType, category, status, keyword } = req.query;
  const query = {};

  if (itemType) query.itemType = itemType;
  if (category) query.category = category;
  if (status) query.status = status;
  
  if (keyword) {
    query.$or = [
      { itemName: { $regex: keyword, $options: 'i' } },
      { itemCode: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } }
    ];
  }

  const total = await ServiceItem.countDocuments(query);
  const pagination = paginate(page, limit, total);

  const serviceItems = await ServiceItem.find(query)
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.perPage)
    .populate('createdBy', 'name');

  successResponse(res, {
    serviceItems,
    pagination
  });
});

exports.getServiceItemById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const serviceItem = await ServiceItem.findById(id)
    .populate('createdBy', 'name')
    .populate('approvalChain.department', 'code name')
    .populate('approvalChain.parallelDepartments', 'code name');

  if (!serviceItem) {
    return errorResponse(res, '事项不存在', 404);
  }

  successResponse(res, serviceItem);
});

exports.getServiceItemByCode = asyncHandler(async (req, res) => {
  const { code } = req.params;

  const serviceItem = await ServiceItem.findOne({ itemCode: code, status: 'published' })
    .populate('approvalChain.department', 'code name')
    .populate('approvalChain.parallelDepartments', 'code name');

  if (!serviceItem) {
    return errorResponse(res, '事项不存在或未发布', 404);
  }

  successResponse(res, serviceItem);
});

exports.updateServiceItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body, updatedAt: new Date() };

  if (updateData.itemCode) {
    const existingItem = await ServiceItem.findOne({ 
      itemCode: updateData.itemCode, 
      _id: { $ne: id } 
    });
    if (existingItem) {
      return errorResponse(res, '事项编码已存在', 400);
    }
  }

  if (updateData.approvalChain && updateData.approvalChain.length > 0) {
    const stepOrders = updateData.approvalChain.map(s => s.stepOrder);
    const uniqueOrders = [...new Set(stepOrders)];
    if (stepOrders.length !== uniqueOrders.length) {
      return errorResponse(res, '审批步骤序号不能重复', 400);
    }
  }

  const serviceItem = await ServiceItem.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!serviceItem) {
    return errorResponse(res, '事项不存在', 404);
  }

  successResponse(res, serviceItem, '事项更新成功');
});

exports.getPublishedItems = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, itemType, category, keyword } = req.query;
  const query = { status: 'published' };

  if (itemType) query.itemType = itemType;
  if (category) query.category = category;
  
  if (keyword) {
    query.$or = [
      { itemName: { $regex: keyword, $options: 'i' } },
      { itemCode: { $regex: keyword, $options: 'i' } }
    ];
  }

  const total = await ServiceItem.countDocuments(query);
  const pagination = paginate(page, limit, total);

  const serviceItems = await ServiceItem.find(query)
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.perPage)
    .select('itemCode itemName itemType category description handlingTime processingLocation supportsFastTrack requiredCreditScore');

  successResponse(res, {
    serviceItems,
    pagination
  });
});

exports.deleteServiceItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const Application = require('../models/Application');
  const applicationCount = await Application.countDocuments({ serviceItem: id });
  
  if (applicationCount > 0) {
    return errorResponse(res, '该事项已有申请记录，无法删除', 400);
  }

  const serviceItem = await ServiceItem.findByIdAndDelete(id);
  if (!serviceItem) {
    return errorResponse(res, '事项不存在', 404);
  }

  successResponse(res, null, '事项删除成功');
});

exports.publishServiceItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const serviceItem = await ServiceItem.findById(id);
  if (!serviceItem) {
    return errorResponse(res, '事项不存在', 404);
  }

  if (!serviceItem.approvalChain || serviceItem.approvalChain.length === 0) {
    return errorResponse(res, '请先配置审批流程', 400);
  }

  const requiredMaterials = serviceItem.materials.filter(m => m.type === 'required');
  if (requiredMaterials.length === 0) {
    return errorResponse(res, '请至少配置一个必备材料', 400);
  }

  serviceItem.status = 'published';
  serviceItem.updatedAt = new Date();
  await serviceItem.save();

  successResponse(res, serviceItem, '事项发布成功');
});

exports.unpublishServiceItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const serviceItem = await ServiceItem.findById(id);
  if (!serviceItem) {
    return errorResponse(res, '事项不存在', 404);
  }

  serviceItem.status = 'draft';
  serviceItem.updatedAt = new Date();
  await serviceItem.save();

  successResponse(res, serviceItem, '事项已下架');
});

exports.addMaterial = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const material = req.body;

  if (!material.code || !material.name) {
    return errorResponse(res, '材料编码和名称不能为空', 400);
  }

  const serviceItem = await ServiceItem.findById(id);
  if (!serviceItem) {
    return errorResponse(res, '事项不存在', 404);
  }

  const existingMaterial = serviceItem.materials.find(m => m.code === material.code);
  if (existingMaterial) {
    return errorResponse(res, '材料编码已存在', 400);
  }

  serviceItem.materials.push(material);
  serviceItem.updatedAt = new Date();
  await serviceItem.save();

  successResponse(res, serviceItem, '材料添加成功');
});

exports.updateMaterial = asyncHandler(async (req, res) => {
  const { id, materialId } = req.params;
  const updateData = req.body;

  const serviceItem = await ServiceItem.findById(id);
  if (!serviceItem) {
    return errorResponse(res, '事项不存在', 404);
  }

  const materialIndex = serviceItem.materials.findIndex(m => m._id && m._id.toString() === materialId.toString());
  if (materialIndex === -1) {
    return errorResponse(res, '材料不存在', 404);
  }

  serviceItem.materials[materialIndex] = {
    ...serviceItem.materials[materialIndex].toObject(),
    ...updateData
  };
  serviceItem.updatedAt = new Date();
  await serviceItem.save();

  successResponse(res, serviceItem, '材料更新成功');
});

exports.deleteMaterial = asyncHandler(async (req, res) => {
  const { id, materialId } = req.params;

  const serviceItem = await ServiceItem.findById(id);
  if (!serviceItem) {
    return errorResponse(res, '事项不存在', 404);
  }

  const initialLength = serviceItem.materials.length;
  serviceItem.materials = serviceItem.materials.filter(m => m._id && m._id.toString() !== materialId.toString());
  
  if (serviceItem.materials.length === initialLength) {
    return errorResponse(res, '材料不存在', 404);
  }

  serviceItem.updatedAt = new Date();
  await serviceItem.save();

  successResponse(res, serviceItem, '材料删除成功');
});

exports.addApprovalStep = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const step = req.body;

  const serviceItem = await ServiceItem.findById(id);
  if (!serviceItem) {
    return errorResponse(res, '事项不存在', 404);
  }

  if (serviceItem.approvalChain.some(s => s.stepOrder === step.stepOrder)) {
    return errorResponse(res, '步骤序号已存在', 400);
  }

  if (step.type === 'parallel' && (!step.parallelDepartments || step.parallelDepartments.length === 0)) {
    return errorResponse(res, '并联审批需要指定联办部门', 400);
  }

  serviceItem.approvalChain.push(step);
  serviceItem.approvalChain.sort((a, b) => a.stepOrder - b.stepOrder);
  serviceItem.updatedAt = new Date();
  await serviceItem.save();

  successResponse(res, serviceItem, '审批步骤添加成功');
});

exports.updateApprovalStep = asyncHandler(async (req, res) => {
  const { id, stepOrder } = req.params;
  const updateData = req.body;

  const serviceItem = await ServiceItem.findById(id);
  if (!serviceItem) {
    return errorResponse(res, '事项不存在', 404);
  }

  const stepIndex = serviceItem.approvalChain.findIndex(s => s.stepOrder === parseInt(stepOrder));
  if (stepIndex === -1) {
    return errorResponse(res, '审批步骤不存在', 404);
  }

  serviceItem.approvalChain[stepIndex] = {
    ...serviceItem.approvalChain[stepIndex].toObject(),
    ...updateData,
    stepOrder: parseInt(stepOrder)
  };
  serviceItem.updatedAt = new Date();
  await serviceItem.save();

  successResponse(res, serviceItem, '审批步骤更新成功');
});

exports.deleteApprovalStep = asyncHandler(async (req, res) => {
  const { id, stepOrder } = req.params;

  const serviceItem = await ServiceItem.findById(id);
  if (!serviceItem) {
    return errorResponse(res, '事项不存在', 404);
  }

  const initialLength = serviceItem.approvalChain.length;
  serviceItem.approvalChain = serviceItem.approvalChain.filter(s => s.stepOrder !== parseInt(stepOrder));
  
  if (serviceItem.approvalChain.length === initialLength) {
    return errorResponse(res, '审批步骤不存在', 404);
  }

  serviceItem.updatedAt = new Date();
  await serviceItem.save();

  successResponse(res, serviceItem, '审批步骤删除成功');
});
