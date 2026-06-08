const Application = require('../models/Application');
const ServiceItem = require('../models/ServiceItem');
const Department = require('../models/Department');
const User = require('../models/User');
const Credit = require('../models/Credit');
const { v4: uuidv4 } = require('uuid');
const notificationService = require('./notificationService');
const { addHours, addDays, diffHours, diffDays } = require('../utils/helpers');
const { APPLICATION_STATUS, APPROVAL_DECISION, TIMEOUT_CONFIG, SCORE_CHANGE, CREDIT_RECORD_TYPE } = require('../utils/constants');

class ApprovalEngine {
  async validateMaterials(serviceItem, submittedMaterials, useFastTrack = false) {
    const requiredMaterials = serviceItem.materials.filter(m => {
      if (m.type !== 'required') return false;
      if (useFastTrack && m.isFastTrackExempt) return false;
      return true;
    });

    const submittedCodes = submittedMaterials.map(m => m.materialCode);
    const missing = requiredMaterials.filter(m => !submittedCodes.includes(m.code));

    return {
      isComplete: missing.length === 0,
      missingMaterials: missing.map(m => ({
        materialCode: m.code,
        materialName: m.name,
        reason: '未提交',
        isPostSubmission: useFastTrack
      }))
    };
  }

  async assignApprover(departmentId, requiredLevel = 1) {
    const department = await Department.findById(departmentId)
      .populate('approvers', '_id name approvalLevel status');

    if (!department || !department.approvers || department.approvers.length === 0) {
      throw new Error('该部门没有可用的审批人员');
    }

    const availableApprovers = department.approvers.filter(
      a => a.status === 'active' && a.approvalLevel >= requiredLevel
    );

    if (availableApprovers.length === 0) {
      throw new Error(`该部门没有符合审批等级${requiredLevel}的审批人员`);
    }

    const randomIndex = Math.floor(Math.random() * availableApprovers.length);
    return availableApprovers[randomIndex];
  }

  async getSupervisor(departmentId) {
    const department = await Department.findById(departmentId)
      .populate('parentDepartment');

    if (!department || !department.parentDepartment) {
      return null;
    }

    const parentDept = await Department.findById(department.parentDepartment._id)
      .populate('approvers', '_id name approvalLevel status');

    if (!parentDept || !parentDept.approvers || parentDept.approvers.length === 0) {
      return null;
    }

    const supervisors = parentDept.approvers.filter(a => a.status === 'active');
    return supervisors[Math.floor(Math.random() * supervisors.length)];
  }

  async startApprovalProcess(application, serviceItem) {
    if (!serviceItem.approvalChain || serviceItem.approvalChain.length === 0) {
      throw new Error('该事项未配置审批流程');
    }

    const firstStep = serviceItem.approvalChain.sort((a, b) => a.stepOrder - b.stepOrder)[0];
    
    if (firstStep.type === 'single') {
      await this.startSingleApproval(application, firstStep);
    } else if (firstStep.type === 'parallel') {
      await this.startParallelApproval(application, firstStep);
    }

    application.currentStep = 1;
    application.currentStatus = firstStep.type === 'single' 
      ? APPLICATION_STATUS.PENDING_APPROVAL 
      : APPLICATION_STATUS.PARALLEL_APPROVAL;
    
    application.statusHistory.push({
      status: application.currentStatus,
      remark: '审批流程已启动',
      operator: application.applicant
    });

    await application.save();
    return application;
  }

  async startSingleApproval(application, step) {
    const approver = await this.assignApprover(step.department, step.requiredApprovalLevel);
    const now = new Date();
    const deadline = addHours(now, step.timeoutHours);

    const assignment = {
      stepOrder: step.stepOrder,
      department: step.department,
      approver: approver._id,
      assignedAt: now,
      deadline: deadline,
      status: 'pending',
      isParallel: false
    };

    application.approvalAssignments.push(assignment);

    await notificationService.notifyApprovalAssigned(application, approver, step.stepName);
  }

  async startParallelApproval(application, step) {
    const groupId = uuidv4();
    const now = new Date();
    const allDepartments = [step.department, ...(step.parallelDepartments || [])];
    
    const parallelGroup = {
      groupId,
      stepOrder: step.stepOrder,
      departments: []
    };

    const notificationRecipients = [];

    for (const deptId of allDepartments) {
      const approver = await this.assignApprover(deptId, step.requiredApprovalLevel);
      const deadline = addHours(now, step.timeoutHours);

      const deptApproval = {
        department: deptId,
        approver: approver._id,
        assignedAt: now,
        deadline: deadline,
        status: 'pending'
      };

      parallelGroup.departments.push(deptApproval);

      application.approvalAssignments.push({
        stepOrder: step.stepOrder,
        department: deptId,
        approver: approver._id,
        assignedAt: now,
        deadline: deadline,
        status: 'pending',
        isParallel: true,
        parallelGroupId: groupId
      });

      notificationRecipients.push({ approver: approver._id });
    }

    application.parallelApprovals.push(parallelGroup);

    await notificationService.notifyParallelApprovalStart(application, notificationRecipients);
  }

  async processApprovalDecision(applicationId, approverId, decision, remark = '') {
    const application = await Application.findById(applicationId)
      .populate('serviceItem')
      .populate('applicant');

    if (!application) {
      throw new Error('申请不存在');
    }

    if (application.currentStatus === APPLICATION_STATUS.PARALLEL_APPROVAL) {
      return await this.processParallelDecision(application, approverId, decision, remark);
    } else {
      return await this.processSingleDecision(application, approverId, decision, remark);
    }
  }

  async processSingleDecision(application, approverId, decision, remark) {
    const serviceItem = application.serviceItem;
    const currentStep = serviceItem.approvalChain.find(s => s.stepOrder === application.currentStep);
    
    if (!currentStep) {
      throw new Error('当前审批步骤不存在');
    }

    const assignment = application.approvalAssignments.find(
      a => a.stepOrder === application.currentStep && 
           a.status !== 'completed' &&
           !a.isParallel
    );

    if (!assignment || assignment.approver.toString() !== approverId.toString()) {
      throw new Error('您没有权限处理此审批');
    }

    const now = new Date();
    const isTimeout = now > assignment.deadline;

    assignment.decision = decision;
    assignment.decisionRemark = remark;
    assignment.decidedAt = now;
    assignment.status = 'completed';

    if (isTimeout) {
      application.hasTimeout = true;
      application.timeoutCount++;
    }

    const approver = await User.findById(approverId);
    await notificationService.notifyApprovalDecision(
      application, application.applicant, decision, remark, approver
    );

    if (decision === APPROVAL_DECISION.REJECT || decision === APPROVAL_DECISION.RETURN) {
      application.currentStatus = decision === APPROVAL_DECISION.REJECT 
        ? APPLICATION_STATUS.REJECTED 
        : APPLICATION_STATUS.RETURNED;
      
      application.statusHistory.push({
        status: application.currentStatus,
        remark,
        operator: approverId
      });

      application.processingDays = diffDays(application.submittedAt, now);
      application.isTimelyCompleted = !isTimeout;
      application.completedAt = now;

      await this.updateCreditAfterDecision(application, decision, isTimeout);

      await application.save();
      return application;
    }

    if (decision === APPROVAL_DECISION.APPROVE) {
      const nextStep = serviceItem.approvalChain.find(s => s.stepOrder === application.currentStep + 1);

      if (nextStep) {
        application.currentStep++;
        
        if (nextStep.type === 'single') {
          await this.startSingleApproval(application, nextStep);
          application.currentStatus = APPLICATION_STATUS.PENDING_APPROVAL;
        } else {
          await this.startParallelApproval(application, nextStep);
          application.currentStatus = APPLICATION_STATUS.PARALLEL_APPROVAL;
        }

        application.statusHistory.push({
          status: application.currentStatus,
          remark: '进入下一审批环节',
          operator: approverId
        });
      } else {
        application.currentStatus = APPLICATION_STATUS.APPROVED;
        application.statusHistory.push({
          status: APPLICATION_STATUS.APPROVED,
          remark: '所有审批环节已通过',
          operator: approverId
        });

        application.processingDays = diffDays(application.submittedAt, now);
        application.isTimelyCompleted = !isTimeout;
        application.completedAt = now;

        await this.updateCreditAfterDecision(application, decision, isTimeout);
      }

      await application.save();
      return application;
    }
  }

  async processParallelDecision(application, approverId, decision, remark) {
    const serviceItem = application.serviceItem;
    const parallelGroup = application.parallelApprovals.find(
      pg => pg.departments.some(d => d.approver.toString() === approverId.toString() && d.status === 'pending')
    );

    if (!parallelGroup) {
      throw new Error('您没有待处理的并联审批');
    }

    const departmentApproval = parallelGroup.departments.find(
      d => d.approver.toString() === approverId.toString() && d.status === 'pending'
    );

    if (!departmentApproval) {
      throw new Error('您已处理此审批');
    }

    const now = new Date();
    const isTimeout = now > departmentApproval.deadline;

    departmentApproval.decision = decision;
    departmentApproval.opinion = remark;
    departmentApproval.decidedAt = now;
    departmentApproval.status = 'completed';

    const assignment = application.approvalAssignments.find(
      a => a.parallelGroupId === parallelGroup.groupId && 
           a.approver.toString() === approverId.toString()
    );

    if (assignment) {
      assignment.decision = decision;
      assignment.decisionRemark = remark;
      assignment.decidedAt = now;
      assignment.status = 'completed';
    }

    if (isTimeout) {
      application.hasTimeout = true;
      application.timeoutCount++;
    }

    const allCompleted = parallelGroup.departments.every(d => d.status === 'completed');

    if (allCompleted) {
      return await this.mergeParallelApproval(application, parallelGroup, isTimeout, approverId);
    }

    await application.save();
    return application;
  }

  async mergeParallelApproval(application, parallelGroup, isTimeout, operatorId) {
    const hasRejection = parallelGroup.departments.some(d => d.decision === APPROVAL_DECISION.REJECT);
    
    const opinions = parallelGroup.departments.map(d => ({
      department: d.department,
      decision: d.decision,
      opinion: d.opinion
    }));

    parallelGroup.mergedOpinion = JSON.stringify(opinions);
    parallelGroup.mergedAt = new Date();
    parallelGroup.finalDecision = hasRejection ? APPROVAL_DECISION.REJECT : APPROVAL_DECISION.APPROVE;

    const approver = await User.findById(operatorId);
    await notificationService.notifyParallelApprovalMerged(
      application, application.applicant, parallelGroup.finalDecision
    );

    if (hasRejection) {
      application.currentStatus = APPLICATION_STATUS.REJECTED;
      application.statusHistory.push({
        status: APPLICATION_STATUS.REJECTED,
        remark: '并联审批未通过',
        operator: operatorId
      });

      application.processingDays = diffDays(application.submittedAt, new Date());
      application.isTimelyCompleted = !isTimeout;
      application.completedAt = new Date();

      await this.updateCreditAfterDecision(application, APPROVAL_DECISION.REJECT, isTimeout);
    } else {
      const serviceItem = application.serviceItem;
      const nextStep = serviceItem.approvalChain.find(s => s.stepOrder === application.currentStep + 1);

      if (nextStep) {
        application.currentStep++;
        
        if (nextStep.type === 'single') {
          await this.startSingleApproval(application, nextStep);
          application.currentStatus = APPLICATION_STATUS.PENDING_APPROVAL;
        } else {
          await this.startParallelApproval(application, nextStep);
          application.currentStatus = APPLICATION_STATUS.PARALLEL_APPROVAL;
        }

        application.statusHistory.push({
          status: application.currentStatus,
          remark: '并联审批通过，进入下一环节',
          operator: operatorId
        });
      } else {
        application.currentStatus = APPLICATION_STATUS.APPROVED;
        application.statusHistory.push({
          status: APPLICATION_STATUS.APPROVED,
          remark: '所有审批环节已通过',
          operator: operatorId
        });

        application.processingDays = diffDays(application.submittedAt, new Date());
        application.isTimelyCompleted = !isTimeout;
        application.completedAt = new Date();

        await this.updateCreditAfterDecision(application, APPROVAL_DECISION.APPROVE, isTimeout);
      }
    }

    await application.save();
    return application;
  }

  async checkAndProcessTimeouts() {
    const now = new Date();
    
    const pendingApplications = await Application.find({
      currentStatus: { $in: [APPLICATION_STATUS.PENDING_APPROVAL, APPLICATION_STATUS.PARALLEL_APPROVAL] }
    }).populate('serviceItem applicant');

    for (const application of pendingApplications) {
      await this.processApplicationTimeouts(application, now);
    }
  }

  async processApplicationTimeouts(application, now) {
    const serviceItem = application.serviceItem;
    const currentStep = serviceItem.approvalChain.find(s => s.stepOrder === application.currentStep);
    
    if (!currentStep) return;

    if (application.currentStatus === APPLICATION_STATUS.PENDING_APPROVAL) {
      await this.processSingleTimeout(application, currentStep, now);
    } else if (application.currentStatus === APPLICATION_STATUS.PARALLEL_APPROVAL) {
      await this.processParallelTimeout(application, currentStep, now);
    }
  }

  async processSingleTimeout(application, step, now) {
    const assignment = application.approvalAssignments.find(
      a => a.stepOrder === application.currentStep && 
           a.status === 'pending' &&
           !a.isParallel
    );

    if (!assignment) return;

    const hoursSinceAssignment = diffHours(now, assignment.assignedAt);
    const hoursRemaining = step.timeoutHours - hoursSinceAssignment;

    if (assignment.status === 'pending' && hoursSinceAssignment >= step.remindHours && !assignment.remindedAt) {
      assignment.status = 'reminded';
      assignment.remindedAt = now;

      const approver = await User.findById(assignment.approver);
      await notificationService.notifyApprovalReminder(
        application, approver, step.stepName, Math.ceil(hoursRemaining)
      );

      await application.save();
    }

    if (hoursSinceAssignment >= step.timeoutHours) {
      assignment.status = 'timeout';
      
      application.hasTimeout = true;
      application.timeoutCount++;

      const supervisor = await this.getSupervisor(step.department);
      if (supervisor) {
        assignment.escalatedAt = now;
        assignment.escalatedTo = supervisor._id;
        assignment.status = 'escalated';

        application.currentStatus = APPLICATION_STATUS.TIMEOUT_ESCALATED;
        application.statusHistory.push({
          status: APPLICATION_STATUS.TIMEOUT_ESCALATED,
          remark: `审批超时${step.timeoutHours}小时，已转交上级处理`,
          operator: null
        });

        const approver = await User.findById(assignment.approver);
        await notificationService.notifyApprovalTimeout(
          application, approver, supervisor, step.stepName
        );

        assignment.approver = supervisor._id;
        assignment.assignedAt = now;
        assignment.deadline = addHours(now, step.timeoutHours);
        assignment.status = 'pending';
      }

      await application.save();
    }
  }

  async processParallelTimeout(application, step, now) {
    const parallelGroup = application.parallelApprovals.find(
      pg => pg.stepOrder === application.currentStep
    );

    if (!parallelGroup) return;

    let allHandled = true;

    for (const deptApproval of parallelGroup.departments) {
      if (deptApproval.status !== 'pending') continue;

      const hoursSinceAssignment = diffHours(now, deptApproval.assignedAt);

      if (hoursSinceAssignment >= step.timeoutHours) {
        if (step.defaultApprovalOnTimeout) {
          deptApproval.status = 'timeout_default';
          deptApproval.decision = APPROVAL_DECISION.DEFAULT_APPROVE;
          deptApproval.opinion = '超时未反馈，默认同意';
          deptApproval.decidedAt = now;

          const assignment = application.approvalAssignments.find(
            a => a.parallelGroupId === parallelGroup.groupId &&
                 a.department.toString() === deptApproval.department.toString()
          );

          if (assignment) {
            assignment.status = 'completed';
            assignment.decision = APPROVAL_DECISION.DEFAULT_APPROVE;
            assignment.decidedAt = now;
          }

          application.hasTimeout = true;
          application.timeoutCount++;
        } else {
          allHandled = false;
        }
      } else {
        allHandled = false;
      }
    }

    const allCompleted = parallelGroup.departments.every(d => d.status !== 'pending');
    if (allCompleted) {
      await this.mergeParallelApproval(application, parallelGroup, true, null);
    }

    await application.save();
  }

  async updateCreditAfterDecision(application, decision, isTimeout) {
    const applicantId = application.applicant._id || application.applicant;
    
    let credit = await Credit.findOne({ user: applicantId });
    if (!credit) {
      credit = new Credit({ user: applicantId });
    }

    if (isTimeout) {
      credit.timeoutCount++;
      credit.records.push({
        type: CREDIT_RECORD_TYPE.TIMEOUT_APPLICATION,
        description: `申请${application.applicationNo}审批超时`,
        application: application._id,
        scoreChange: SCORE_CHANGE.TIMEOUT
      });
      credit.score = Math.max(0, credit.score + SCORE_CHANGE.TIMEOUT);
    } else if (decision === APPROVAL_DECISION.APPROVE) {
      credit.records.push({
        type: CREDIT_RECORD_TYPE.APPROVED_ON_TIME,
        description: `申请${application.applicationNo}按时办结`,
        application: application._id,
        scoreChange: SCORE_CHANGE.ON_TIME_APPROVAL
      });
      credit.score = Math.min(100, credit.score + SCORE_CHANGE.ON_TIME_APPROVAL);
    }

    await credit.save();
  }

  async checkFastTrackEligibility(userId, serviceItem) {
    if (!serviceItem.supportsFastTrack) {
      return { eligible: false, reason: '该事项不支持快速通道' };
    }

    const credit = await Credit.findOne({ user: userId });
    if (!credit) {
      return { eligible: false, reason: '信用记录不存在' };
    }

    if (credit.fastTrackRestricted) {
      return { eligible: false, reason: credit.restrictionReason || '快速通道已被限制' };
    }

    if (credit.score < serviceItem.requiredCreditScore) {
      return { 
        eligible: false, 
        reason: `信用分不足，需要${serviceItem.requiredCreditScore}分，当前${credit.score}分` 
      };
    }

    return { 
      eligible: true, 
      creditScore: credit.score,
      deadline: addDays(new Date(), serviceItem.fastTrackTimeoutDays || 3)
    };
  }

  async enableFastTrack(application, deadline) {
    application.useFastTrack = true;
    application.fastTrackDeadline = deadline;
    application.fastTrackMaterialsSubmitted = false;

    const applicant = await User.findById(application.applicant);
    await notificationService.notifyFastTrackApproved(application, applicant, deadline);

    await application.save();
    return application;
  }

  async submitPostMaterials(applicationId, materials) {
    const application = await Application.findById(applicationId);
    if (!application) {
      throw new Error('申请不存在');
    }

    if (!application.useFastTrack) {
      throw new Error('该申请未使用快速通道');
    }

    const serviceItem = await ServiceItem.findById(application.serviceItem);
    const validation = await this.validateMaterials(serviceItem, [
      ...application.submittedMaterials,
      ...materials
    ], false);

    for (const material of materials) {
      application.submittedMaterials.push({
        ...material,
        isPostSubmission: true,
        uploadedAt: new Date()
      });
    }

    application.missingMaterials = application.missingMaterials.filter(
      mm => !materials.some(m => m.materialCode === mm.materialCode)
    );

    if (application.missingMaterials.length === 0) {
      application.fastTrackMaterialsSubmitted = true;
    }

    const isLate = new Date() > application.fastTrackDeadline;
    if (isLate) {
      const credit = await Credit.findOne({ user: application.applicant });
      if (credit) {
        credit.lateSubmissionCount++;
        credit.records.push({
          type: CREDIT_RECORD_TYPE.LATE_MATERIAL_SUBMISSION,
          description: `申请${application.applicationNo}快速通道材料补交逾期`,
          application: application._id,
          scoreChange: SCORE_CHANGE.LATE_SUBMISSION
        });
        credit.score = Math.max(0, credit.score + SCORE_CHANGE.LATE_SUBMISSION);
        await credit.save();
      }
    }

    await application.save();
    return application;
  }

  async checkFastTrackOverdue() {
    const now = new Date();
    const overdueApps = await Application.find({
      useFastTrack: true,
      fastTrackMaterialsSubmitted: false,
      fastTrackDeadline: { $lt: now },
      currentStatus: { $nin: [APPLICATION_STATUS.REVOKED, APPLICATION_STATUS.COMPLETED] }
    }).populate('applicant');

    for (const application of overdueApps) {
      await this.revokeFastTrackApplication(application);
    }
  }

  async revokeFastTrackApplication(application) {
    application.currentStatus = APPLICATION_STATUS.REVOKED;
    application.statusHistory.push({
      status: APPLICATION_STATUS.REVOKED,
      remark: '快速通道材料补交逾期，审批已撤销',
      operator: null
    });

    const applicant = await User.findById(application.applicant);
    await notificationService.notifyFastTrackOverdue(application, applicant);
    await notificationService.notifyApplicationRevoked(
      application, applicant, '快速通道材料补交逾期'
    );

    await application.save();

    const credit = await Credit.findOne({ user: application.applicant });
    if (credit) {
      credit.lateSubmissionCount++;
      credit.records.push({
        type: CREDIT_RECORD_TYPE.LATE_MATERIAL_SUBMISSION,
        description: `申请${application.applicationNo}快速通道材料补交逾期导致撤销`,
        application: application._id,
        scoreChange: SCORE_CHANGE.LATE_SUBMISSION * 2
      });
      credit.score = Math.max(0, credit.score + SCORE_CHANGE.LATE_SUBMISSION * 2);
      await credit.save();
    }

    return application;
  }
}

module.exports = new ApprovalEngine();
