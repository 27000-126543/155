const Application = require('../models/Application');
const ServiceItem = require('../models/ServiceItem');
const User = require('../models/User');
const Credit = require('../models/Credit');
const approvalEngine = require('../services/approvalEngine');
const certificateService = require('../services/certificateService');
const notificationService = require('../services/notificationService');
const { successResponse, errorResponse, asyncHandler, paginate, generateApplicationNo, diffDays } = require('../utils/helpers');
const { APPLICATION_STATUS, APPROVAL_DECISION } = require('../utils/constants');

exports.createApplication = asyncHandler(async (req, res) => {
  const { serviceItemId, submittedMaterials, applicantInfo } = req.body;
  const applicant = req.user;

  const serviceItem = await ServiceItem.findById(serviceItemId);
  if (!serviceItem) {
    return errorResponse(res, '事项不存在', 404);
  }

  if (serviceItem.status !== 'published') {
    return errorResponse(res, '该事项尚未发布', 400);
  }

  const validation = await approvalEngine.validateMaterials(serviceItem, submittedMaterials, false);

  const applicationNo = generateApplicationNo();
  const application = new Application({
    applicationNo,
    serviceItem: serviceItemId,
    applicant: applicant._id,
    applicantType: applicant.type,
    applicantInfo: {
      name: applicant.name,
      idCard: applicant.idCard,
      phone: applicant.phone,
      enterpriseName: applicant.enterpriseInfo?.name,
      creditCode: applicant.enterpriseInfo?.creditCode,
      legalPerson: applicant.enterpriseInfo?.legalPerson,
      ...applicantInfo
    },
    submittedMaterials: submittedMaterials.map(m => ({
      ...m,
      uploadedAt: new Date()
    })),
    missingMaterials: validation.missingMaterials,
    currentStatus: validation.isComplete ? APPLICATION_STATUS.SUBMITTED : APPLICATION_STATUS.MATERIAL_MISSING,
    statusHistory: [{
      status: validation.isComplete ? APPLICATION_STATUS.SUBMITTED : APPLICATION_STATUS.MATERIAL_MISSING,
      remark: validation.isComplete ? '申请已提交' : '材料缺失',
      operator: applicant._id
    }],
    submittedAt: validation.isComplete ? new Date() : null
  });

  await application.save();

  if (validation.isComplete) {
    await approvalEngine.startApprovalProcess(application, serviceItem);
    await notificationService.notifyApplicationSubmitted(application, applicant, serviceItem);
  } else {
    await notificationService.notifyMaterialMissing(application, applicant, validation.missingMaterials);
  }

  const creditEligibility = await approvalEngine.checkFastTrackEligibility(applicant._id, serviceItem);

  successResponse(res, {
    application: {
      id: application._id,
      applicationNo: application.applicationNo,
      currentStatus: application.currentStatus,
      missingMaterials: validation.missingMaterials,
      isComplete: validation.isComplete,
      fastTrackEligibility: creditEligibility
    }
  }, validation.isComplete ? '申请提交成功' : '材料不完整，请补充', 201);
});

exports.submitWithFastTrack = asyncHandler(async (req, res) => {
  const { serviceItemId, submittedMaterials, applicantInfo } = req.body;
  const applicant = req.user;

  const serviceItem = await ServiceItem.findById(serviceItemId);
  if (!serviceItem) {
    return errorResponse(res, '事项不存在', 404);
  }

  const eligibility = await approvalEngine.checkFastTrackEligibility(applicant._id, serviceItem);
  if (!eligibility.eligible) {
    return errorResponse(res, eligibility.reason, 400);
  }

  const validation = await approvalEngine.validateMaterials(serviceItem, submittedMaterials, true);

  const applicationNo = generateApplicationNo();
  const application = new Application({
    applicationNo,
    serviceItem: serviceItemId,
    applicant: applicant._id,
    applicantType: applicant.type,
    applicantInfo: {
      name: applicant.name,
      idCard: applicant.idCard,
      phone: applicant.phone,
      ...applicantInfo
    },
    submittedMaterials: submittedMaterials.map(m => ({
      ...m,
      uploadedAt: new Date()
    })),
    missingMaterials: validation.missingMaterials,
    useFastTrack: true,
    fastTrackDeadline: eligibility.deadline,
    fastTrackMaterialsSubmitted: validation.isComplete,
    currentStatus: APPLICATION_STATUS.SUBMITTED,
    statusHistory: [{
      status: APPLICATION_STATUS.SUBMITTED,
      remark: '快速通道申请已提交',
      operator: applicant._id
    }],
    submittedAt: new Date()
  });

  await application.save();

  await approvalEngine.startApprovalProcess(application, serviceItem);
  await approvalEngine.enableFastTrack(application, eligibility.deadline);
  await notificationService.notifyApplicationSubmitted(application, applicant, serviceItem);

  successResponse(res, {
    application: {
      id: application._id,
      applicationNo: application.applicationNo,
      currentStatus: application.currentStatus,
      useFastTrack: true,
      fastTrackDeadline: eligibility.deadline,
      missingMaterials: validation.missingMaterials
    }
  }, '快速通道申请提交成功', 201);
});

exports.supplementMaterials = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { materials } = req.body;

  const application = await Application.findById(id);
  if (!application) {
    return errorResponse(res, '申请不存在', 404);
  }

  if (application.applicant.toString() !== req.user._id.toString()) {
    return errorResponse(res, '无权修改此申请', 403);
  }

  if (application.currentStatus !== APPLICATION_STATUS.MATERIAL_MISSING) {
    return errorResponse(res, '当前状态不允许补充材料', 400);
  }

  if (application.useFastTrack) {
    const result = await approvalEngine.submitPostMaterials(id, materials);
    return successResponse(res, { application: result }, '材料补充成功');
  }

  for (const material of materials) {
    application.submittedMaterials.push({
      ...material,
      uploadedAt: new Date()
    });
  }

  application.missingMaterials = application.missingMaterials.filter(
    mm => !materials.some(m => m.materialCode === mm.materialCode)
  );

  if (application.missingMaterials.length === 0) {
    application.currentStatus = APPLICATION_STATUS.SUBMITTED;
    application.submittedAt = new Date();
    application.statusHistory.push({
      status: APPLICATION_STATUS.SUBMITTED,
      remark: '材料已补充完整',
      operator: req.user._id
    });

    const serviceItem = await ServiceItem.findById(application.serviceItem);
    await approvalEngine.startApprovalProcess(application, serviceItem);
    await notificationService.notifyApplicationSubmitted(application, req.user, serviceItem);
  } else {
    application.statusHistory.push({
      status: APPLICATION_STATUS.MATERIAL_MISSING,
      remark: '已补充部分材料',
      operator: req.user._id
    });
  }

  await application.save();

  successResponse(res, {
    application: {
      id: application._id,
      applicationNo: application.applicationNo,
      currentStatus: application.currentStatus,
      missingMaterials: application.missingMaterials
    }
  }, application.missingMaterials.length === 0 ? '材料已补充完整，审批已启动' : '材料补充成功');
});

exports.getMyApplications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, serviceItemId, startDate, endDate } = req.query;
  const query = { applicant: req.user._id };

  if (status) query.currentStatus = status;
  if (serviceItemId) query.serviceItem = serviceItemId;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const total = await Application.countDocuments(query);
  const pagination = paginate(page, limit, total);

  const applications = await Application.find(query)
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.perPage)
    .populate('serviceItem', 'itemCode itemName itemType')
    .populate('certificate', 'certificateNo certificateName status');

  successResponse(res, {
    applications,
    pagination
  });
});

exports.getApplications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, applicantId, serviceItemId, department, startDate, endDate } = req.query;
  const query = {};

  if (status) query.currentStatus = status;
  if (applicantId) query.applicant = applicantId;
  if (serviceItemId) query.serviceItem = serviceItemId;
  if (department) {
    query['approvalAssignments.department'] = department;
  }
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const total = await Application.countDocuments(query);
  const pagination = paginate(page, limit, total);

  const applications = await Application.find(query)
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.perPage)
    .populate('serviceItem', 'itemCode itemName itemType')
    .populate('applicant', 'name type')
    .populate('certificate', 'certificateNo');

  successResponse(res, {
    applications,
    pagination
  });
});

exports.getMyPendingApprovals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const query = {
    $or: [
      {
        'approvalAssignments.approver': req.user._id,
        'approvalAssignments.status': { $in: ['pending', 'reminded', 'escalated'] },
        'approvalAssignments.isParallel': false
      },
      {
        'parallelApprovals.departments.approver': req.user._id,
        'parallelApprovals.departments.status': 'pending'
      }
    ]
  };

  const total = await Application.countDocuments(query);
  const pagination = paginate(page, limit, total);

  const applications = await Application.find(query)
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.perPage)
    .populate('serviceItem', 'itemCode itemName')
    .populate('applicant', 'name');

  successResponse(res, {
    applications,
    pagination
  });
});

exports.getApplicationById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const application = await Application.findById(id)
    .populate('serviceItem')
    .populate('applicant', 'name phone type')
    .populate('certificate')
    .populate('approvalAssignments.approver', 'name')
    .populate('approvalAssignments.department', 'name')
    .populate('parallelApprovals.departments.approver', 'name')
    .populate('parallelApprovals.departments.department', 'name')
    .populate('statusHistory.operator', 'name');

  if (!application) {
    return errorResponse(res, '申请不存在', 404);
  }

  successResponse(res, application);
});

exports.processApproval = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { decision, remark } = req.body;

  if (![APPROVAL_DECISION.APPROVE, APPROVAL_DECISION.REJECT, APPROVAL_DECISION.RETURN].includes(decision)) {
    return errorResponse(res, '无效的审批决定', 400);
  }

  const application = await approvalEngine.processApprovalDecision(id, req.user._id, decision, remark);

  if (decision === APPROVAL_DECISION.APPROVE && application.currentStatus === APPLICATION_STATUS.APPROVED) {
    try {
      await certificateService.generateCertificate(application._id, req.user._id);
    } catch (error) {
      console.error('生成证照失败:', error);
    }
  }

  successResponse(res, {
    application: {
      id: application._id,
      applicationNo: application.applicationNo,
      currentStatus: application.currentStatus,
      currentStep: application.currentStep
    }
  }, `审批${decision === 'approve' ? '通过' : decision === 'reject' ? '驳回' : '退回'}成功`);
});

exports.updateApplicationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, remark } = req.body;

  const application = await Application.findById(id);
  if (!application) {
    return errorResponse(res, '申请不存在', 404);
  }

  application.currentStatus = status;
  application.statusHistory.push({
    status,
    remark,
    operator: req.user._id
  });

  if ([APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.REJECTED, APPLICATION_STATUS.RETURNED, APPLICATION_STATUS.COMPLETED].includes(status)) {
    application.completedAt = new Date();
    if (application.submittedAt) {
      application.processingDays = diffDays(application.submittedAt, application.completedAt);
    }
  }

  await application.save();

  successResponse(res, application, '状态更新成功');
});

exports.checkFastTrackEligibility = asyncHandler(async (req, res) => {
  const { itemCode } = req.query;

  if (!itemCode) {
    return errorResponse(res, '请提供事项编码itemCode', 400);
  }

  const serviceItem = await ServiceItem.findOne({ itemCode, status: 'published' });
  if (!serviceItem) {
    return errorResponse(res, '事项不存在或未发布', 404);
  }

  const eligibility = await approvalEngine.checkFastTrackEligibility(req.user._id, serviceItem);

  successResponse(res, eligibility);
});

exports.verifyMaterial = asyncHandler(async (req, res) => {
  const { id, materialCode } = req.params;
  const { verified, note } = req.body;

  const application = await Application.findById(id);
  if (!application) {
    return errorResponse(res, '申请不存在', 404);
  }

  const material = application.submittedMaterials.find(m => m.materialCode === materialCode);
  if (!material) {
    return errorResponse(res, '材料不存在', 404);
  }

  material.verified = verified;
  material.verificationNote = note;

  if (!verified) {
    const Credit = require('../models/Credit');
    const credit = await Credit.findOne({ user: application.applicant });
    if (credit) {
      credit.fraudCount++;
      credit.records.push({
        type: 'material_fraud',
        description: `申请${application.applicationNo}材料造假：${material.materialName}`,
        application: application._id,
        scoreChange: -30,
        operator: req.user._id,
        evidence: note
      });
      credit.score = Math.max(0, credit.score - 30);
      await credit.save();
    }

    const User = require('../models/User');
    await User.findByIdAndUpdate(application.applicant, {
      approvalLevel: Math.min(5, (credit?.approvalLevel || 1) + 2),
      fastTrackEnabled: false
    });
  }

  await notificationService.createNotification(
    'material_verified',
    verified ? '材料核验通过' : '材料核验不通过',
    `您提交的材料【${material.materialName}】已核验，结果：${verified ? '通过' : '不通过' + (note ? '，原因：' + note : '')}`,
    {
      application: application._id,
      recipients: [{ user: application.applicant, userType: 'applicant' }]
    }
  );

  await application.save();

  successResponse(res, application, '材料核验完成');
});

exports.cancelApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const application = await Application.findById(id);
  if (!application) {
    return errorResponse(res, '申请不存在', 404);
  }

  if (application.applicant.toString() !== req.user._id.toString()) {
    return errorResponse(res, '无权撤销此申请', 403);
  }

  if ([APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.REJECTED, APPLICATION_STATUS.COMPLETED, APPLICATION_STATUS.REVOKED].includes(application.currentStatus)) {
    return errorResponse(res, '当前状态无法撤销申请', 400);
  }

  application.currentStatus = 'cancelled';
  application.statusHistory.push({
    status: 'cancelled',
    remark: '申请人撤销申请',
    operator: req.user._id
  });

  await application.save();

  successResponse(res, null, '申请已撤销');
});

exports.getApplicationTimeline = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const application = await Application.findById(id)
    .populate('statusHistory.operator', 'name')
    .populate('approvalAssignments.approver', 'name')
    .populate('parallelApprovals.departments.approver', 'name');

  if (!application) {
    return errorResponse(res, '申请不存在', 404);
  }

  const timeline = [];

  timeline.push({
    time: application.createdAt,
    type: 'created',
    title: '申请创建',
    description: '申请已创建'
  });

  if (application.submittedAt) {
    timeline.push({
      time: application.submittedAt,
      type: 'submitted',
      title: '申请提交',
      description: '申请已提交审批'
    });
  }

  application.approvalAssignments.forEach(assignment => {
    timeline.push({
      time: assignment.assignedAt,
      type: 'assigned',
      title: `步骤${assignment.stepOrder} - 审批分配`,
      description: `已分配给审批人处理`
    });

    if (assignment.remindedAt) {
      timeline.push({
        time: assignment.remindedAt,
        type: 'reminded',
        title: '审批催办',
        description: '审批即将超时，已发送催办通知'
      });
    }

    if (assignment.escalatedAt) {
      timeline.push({
        time: assignment.escalatedAt,
        type: 'escalated',
        title: '审批超时转交',
        description: '审批超时，已转交上级处理'
      });
    }

    if (assignment.decidedAt) {
      const decisionText = {
        approve: '通过',
        reject: '驳回',
        return: '退回',
        default_approve: '超时默认同意'
      };
      timeline.push({
        time: assignment.decidedAt,
        type: assignment.decision,
        title: `步骤${assignment.stepOrder} - 审批完成`,
        description: `审批结果：${decisionText[assignment.decision] || assignment.decision}${assignment.decisionRemark ? '，备注：' + assignment.decisionRemark : ''}`
      });
    }
  });

  application.parallelApprovals.forEach(pa => {
    timeline.push({
      time: pa.departments[0]?.assignedAt,
      type: 'parallel_start',
      title: `步骤${pa.stepOrder} - 并联审批启动`,
      description: '并联审批已启动，等待各部门反馈'
    });

    pa.departments.forEach(d => {
      if (d.decidedAt) {
        timeline.push({
          time: d.decidedAt,
          type: d.decision,
          title: '并联审批部门反馈',
          description: `部门反馈：${d.decision === 'approve' ? '同意' : d.decision === 'reject' ? '不同意' : '超时默认同意'}${d.opinion ? '，意见：' + d.opinion : ''}`
        });
      }
    });

    if (pa.mergedAt) {
      timeline.push({
        time: pa.mergedAt,
        type: 'parallel_merged',
        title: '并联审批合并',
        description: `并联审批完成，最终结果：${pa.finalDecision === 'approve' ? '通过' : '未通过'}`
      });
    }
  });

  if (application.certificate) {
    timeline.push({
      time: application.completedAt,
      type: 'certificate',
      title: '电子证照生成',
      description: '审批通过，电子证照已生成'
    });
  }

  application.statusHistory.forEach(sh => {
    const existingType = timeline.find(t => 
      t.type === sh.status && 
      Math.abs(new Date(t.time) - new Date(sh.timestamp)) < 1000
    );
    if (!existingType && sh.status !== 'submitted' && sh.status !== 'cancelled') {
      timeline.push({
        time: sh.timestamp,
        type: sh.status,
        title: `状态变更 - ${sh.status}`,
        description: sh.remark || ''
      });
    }
  });

  timeline.sort((a, b) => new Date(a.time) - new Date(b.time));

  successResponse(res, { timeline });
});
