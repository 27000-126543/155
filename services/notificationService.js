const Notification = require('../models/Notification');
const { NOTIFICATION_TYPE } = require('../utils/constants');

class NotificationService {
  constructor() {
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  async createNotification(type, title, content, options = {}) {
    try {
      const { application, serviceItem, certificate, recipients, data, createdBy } = options;

      const notification = new Notification({
        type,
        title,
        content,
        application,
        serviceItem,
        certificate,
        recipients: recipients.map(r => ({
          user: r.user,
          userType: r.userType,
          read: false,
          pushSent: false,
          smsSent: false,
          emailSent: false
        })),
        data,
        createdBy
      });

      await notification.save();

      this.pushToRecipients(notification);

      return notification;
    } catch (error) {
      console.error('创建通知失败:', error);
      throw error;
    }
  }

  pushToRecipients(notification) {
    if (!this.io) return;

    try {
      notification.recipients.forEach(recipient => {
        const room = `user_${recipient.user}`;
        this.io.to(room).emit('notification', {
          id: notification._id,
          type: notification.type,
          title: notification.title,
          content: notification.content,
          application: notification.application,
          createdAt: notification.createdAt,
          data: notification.data
        });
      });

      notification.pushStatus = 'sent';
      notification.recipients.forEach(r => {
        r.pushSent = true;
      });
      notification.save();
    } catch (error) {
      console.error('推送通知失败:', error);
      notification.pushStatus = 'failed';
      notification.save();
    }
  }

  async notifyApplicationSubmitted(application, applicant, serviceItem) {
    const title = '申请已提交';
    const content = `您的申请【${serviceItem.itemName}】已成功提交，申请编号：${application.applicationNo}`;
    
    const recipients = [
      { user: applicant._id, userType: 'applicant' }
    ];

    return this.createNotification(
      NOTIFICATION_TYPE.APPLICATION_SUBMITTED,
      title,
      content,
      {
        application: application._id,
        serviceItem: serviceItem._id,
        recipients,
        data: { applicationNo: application.applicationNo }
      }
    );
  }

  async notifyMaterialMissing(application, applicant, missingMaterials) {
    const title = '材料缺失，请补充';
    const materialNames = missingMaterials.map(m => m.materialName).join('、');
    const content = `您的申请缺失以下材料：${materialNames}，请及时补充。`;
    
    const recipients = [
      { user: applicant._id, userType: 'applicant' }
    ];

    return this.createNotification(
      NOTIFICATION_TYPE.MATERIAL_MISSING,
      title,
      content,
      {
        application: application._id,
        recipients,
        data: { missingMaterials }
      }
    );
  }

  async notifyApprovalAssigned(application, approver, stepName) {
    const title = '新的审批待处理';
    const content = `您有新的审批待处理：${stepName}，申请编号：${application.applicationNo}`;
    
    const recipients = [
      { user: approver._id, userType: 'approver' }
    ];

    return this.createNotification(
      NOTIFICATION_TYPE.APPROVAL_ASSIGNED,
      title,
      content,
      {
        application: application._id,
        recipients,
        data: { stepName, applicationNo: application.applicationNo }
      }
    );
  }

  async notifyApprovalReminder(application, approver, stepName, remainingHours) {
    const title = '审批即将超时提醒';
    const content = `您的审批【${stepName}】即将在${remainingHours}小时后超时，请尽快处理。申请编号：${application.applicationNo}`;
    
    const recipients = [
      { user: approver._id, userType: 'approver' }
    ];

    return this.createNotification(
      NOTIFICATION_TYPE.APPROVAL_REMINDER,
      title,
      content,
      {
        application: application._id,
        recipients,
        data: { stepName, remainingHours }
      }
    );
  }

  async notifyApprovalTimeout(application, approver, supervisor, stepName) {
    const title = '审批已超时';
    const content = `审批【${stepName}】已超时，已自动转交上级处理。申请编号：${application.applicationNo}`;
    
    const recipients = [
      { user: approver._id, userType: 'approver' },
      { user: supervisor._id, userType: 'approver' }
    ];

    return this.createNotification(
      NOTIFICATION_TYPE.APPROVAL_TIMEOUT,
      title,
      content,
      {
        application: application._id,
        recipients,
        data: { stepName }
      }
    );
  }

  async notifyApprovalDecision(application, applicant, decision, remark, approver) {
    const type = decision === 'approve' 
      ? NOTIFICATION_TYPE.APPROVAL_APPROVED 
      : decision === 'reject'
        ? NOTIFICATION_TYPE.APPROVAL_REJECTED
        : NOTIFICATION_TYPE.APPROVAL_RETURNED;
    
    const statusText = decision === 'approve' ? '通过' : decision === 'reject' ? '驳回' : '退回';
    const title = `审批已${statusText}`;
    const content = `您的申请已被${statusText}。${remark ? '备注：' + remark : ''}`;
    
    const recipients = [
      { user: applicant._id, userType: 'applicant' }
    ];

    return this.createNotification(type, title, content, {
      application: application._id,
      recipients,
      data: { decision, remark, approver: approver.name }
    });
  }

  async notifyParallelApprovalStart(application, departments) {
    const title = '并联审批已启动';
    const content = `申请【${application.applicationNo}】已进入并联审批阶段，请相关部门及时处理。`;
    
    const recipients = departments.map(d => ({
      user: d.approver,
      userType: 'approver'
    }));

    return this.createNotification(
      NOTIFICATION_TYPE.PARALLEL_APPROVAL_START,
      title,
      content,
      {
        application: application._id,
        recipients
      }
    );
  }

  async notifyParallelApprovalMerged(application, applicant, finalDecision) {
    const title = '并联审批已完成';
    const result = finalDecision === 'approve' ? '通过' : '未通过';
    const content = `您的申请并联审批已完成，结果：${result}。`;
    
    const recipients = [
      { user: applicant._id, userType: 'applicant' }
    ];

    return this.createNotification(
      NOTIFICATION_TYPE.PARALLEL_APPROVAL_MERGED,
      title,
      content,
      {
        application: application._id,
        recipients,
        data: { finalDecision }
      }
    );
  }

  async notifyCertificateGenerated(application, certificate, applicant) {
    const title = '电子证照已生成';
    const content = `您的申请已通过，电子证照【${certificate.certificateNo}】已生成，请查收。`;
    
    const recipients = [
      { user: applicant._id, userType: 'applicant' }
    ];

    return this.createNotification(
      NOTIFICATION_TYPE.CERTIFICATE_GENERATED,
      title,
      content,
      {
        application: application._id,
        certificate: certificate._id,
        recipients,
        data: { certificateNo: certificate.certificateNo }
      }
    );
  }

  async notifyFastTrackApproved(application, applicant, deadline) {
    const title = '快速通道已启用';
    const content = `您的信用良好，已启用快速通道。请在${deadline.toLocaleDateString()}前补交剩余材料。`;
    
    const recipients = [
      { user: applicant._id, userType: 'applicant' }
    ];

    return this.createNotification(
      NOTIFICATION_TYPE.FAST_TRACK_APPROVED,
      title,
      content,
      {
        application: application._id,
        recipients,
        data: { deadline }
      }
    );
  }

  async notifyFastTrackDeadline(application, applicant, remainingDays) {
    const title = '快速通道材料补交提醒';
    const content = `您的快速通道申请还有${remainingDays}天到期，请及时补交剩余材料，逾期将撤销审批。`;
    
    const recipients = [
      { user: applicant._id, userType: 'applicant' }
    ];

    return this.createNotification(
      NOTIFICATION_TYPE.FAST_TRACK_DEADLINE,
      title,
      content,
      {
        application: application._id,
        recipients,
        data: { remainingDays }
      }
    );
  }

  async notifyFastTrackOverdue(application, applicant) {
    const title = '快速通道材料补交已逾期';
    const content = `您的快速通道申请材料补交已逾期，审批已被撤销。`;
    
    const recipients = [
      { user: applicant._id, userType: 'applicant' }
    ];

    return this.createNotification(
      NOTIFICATION_TYPE.FAST_TRACK_OVERDUE,
      title,
      content,
      {
        application: application._id,
        recipients
      }
    );
  }

  async notifyApplicationRevoked(application, applicant, reason) {
    const title = '审批已被撤销';
    const content = `您的申请已被撤销。原因：${reason}`;
    
    const recipients = [
      { user: applicant._id, userType: 'applicant' }
    ];

    return this.createNotification(
      NOTIFICATION_TYPE.APPLICATION_REVOKED,
      title,
      content,
      {
        application: application._id,
        recipients,
        data: { reason }
      }
    );
  }

  async notifyReportGenerated(report, recipients) {
    const title = '效能报表已生成';
    const content = `月度效能报表【${report.reportNo}】已生成，请查看。`;
    
    const recipientList = recipients.map(userId => ({
      user: userId,
      userType: 'supervisor'
    }));

    return this.createNotification(
      NOTIFICATION_TYPE.REPORT_GENERATED,
      title,
      content,
      {
        recipients: recipientList,
        data: { reportNo: report.reportNo }
      }
    );
  }

  async getNotifications(userId, options = {}) {
    const { page = 1, limit = 10, unreadOnly = false, type } = options;
    
    const query = { 'recipients.user': userId };
    if (unreadOnly) {
      query['recipients.read'] = false;
    }
    if (type) {
      query.type = type;
    }

    const skip = (page - 1) * limit;
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('application', 'applicationNo currentStatus')
      .populate('serviceItem', 'itemName')
      .lean();

    const total = await Notification.countDocuments(query);

    return {
      notifications: notifications.map(n => ({
        ...n,
        isRead: n.recipients.find(r => r.user.toString() === userId.toString())?.read || false
      })),
      pagination: {
        currentPage: page,
        perPage: limit,
        totalPages: Math.ceil(total / limit),
        total
      }
    };
  }

  async markAsRead(notificationId, userId) {
    return await Notification.findOneAndUpdate(
      { _id: notificationId, 'recipients.user': userId },
      { $set: { 'recipients.$.read': true, 'recipients.$.readAt': new Date() } },
      { new: true }
    );
  }

  async markAllAsRead(userId) {
    return await Notification.updateMany(
      { 'recipients.user': userId, 'recipients.read': false },
      { $set: { 'recipients.$[elem].read': true, 'recipients.$[elem].readAt': new Date() } },
      { arrayFilters: [{ 'elem.user': userId, 'elem.read': false }] }
    );
  }

  async getUnreadCount(userId) {
    const result = await Notification.aggregate([
      { $match: { 'recipients.user': userId } },
      { $unwind: '$recipients' },
      { $match: { 'recipients.user': userId, 'recipients.read': false } },
      { $count: 'count' }
    ]);

    return result.length > 0 ? result[0].count : 0;
  }
}

module.exports = new NotificationService();
