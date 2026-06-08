const notificationService = require('../services/notificationService');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');

exports.getMyNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, unreadOnly, type } = req.query;

  const result = await notificationService.getNotifications(req.user._id, {
    page: parseInt(page),
    limit: parseInt(limit),
    unreadOnly: unreadOnly === 'true',
    type
  });

  successResponse(res, result);
});

exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user._id);
  
  successResponse(res, { count });
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await notificationService.markAsRead(id, req.user._id);
  
  if (!notification) {
    return errorResponse(res, '通知不存在', 404);
  }

  successResponse(res, null, '已标记为已读');
});

exports.markAllAsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllAsRead(req.user._id);
  
  successResponse(res, {
    modifiedCount: result.modifiedCount
  }, '已全部标记为已读');
});

exports.getNotificationById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const Notification = require('../models/Notification');
  const notification = await Notification.findById(id)
    .populate('application', 'applicationNo currentStatus')
    .populate('serviceItem', 'itemName')
    .populate('certificate', 'certificateNo');

  if (!notification) {
    return errorResponse(res, '通知不存在', 404);
  }

  const recipient = notification.recipients.find(
    r => r.user.toString() === req.user._id.toString()
  );

  if (!recipient && req.user.type !== 'admin') {
    return errorResponse(res, '无权查看此通知', 403);
  }

  if (!recipient.read) {
    await notificationService.markAsRead(id, req.user._id);
  }

  successResponse(res, { notification });
});

exports.deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const Notification = require('../models/Notification');
  const notification = await Notification.findById(id);

  if (!notification) {
    return errorResponse(res, '通知不存在', 404);
  }

  const recipientIndex = notification.recipients.findIndex(
    r => r.user.toString() === req.user._id.toString()
  );

  if (recipientIndex === -1 && req.user.type !== 'admin') {
    return errorResponse(res, '无权删除此通知', 403);
  }

  if (req.user.type === 'admin') {
    await Notification.findByIdAndDelete(id);
  } else {
    notification.recipients.splice(recipientIndex, 1);
    if (notification.recipients.length === 0) {
      await Notification.findByIdAndDelete(id);
    } else {
      await notification.save();
    }
  }

  successResponse(res, null, '通知已删除');
});

exports.sendNotification = asyncHandler(async (req, res) => {
  const { type, title, content, userIds, applicationId, serviceItemId, certificateId } = req.body;

  if (!title || !content || !userIds || userIds.length === 0) {
    return errorResponse(res, '请提供完整的通知信息', 400);
  }

  const recipients = userIds.map(userId => ({
    user: userId,
    userType: 'applicant'
  }));

  const notification = await notificationService.createNotification(type, title, content, {
    application: applicationId,
    serviceItem: serviceItemId,
    certificate: certificateId,
    recipients,
    createdBy: req.user._id
  });

  successResponse(res, { notification }, '通知发送成功', 201);
});

exports.pushToUser = asyncHandler(async (req, res) => {
  const { userId, event, data } = req.body;

  if (!userId || !event) {
    return errorResponse(res, '请提供用户ID和事件类型', 400);
  }

  const io = require('../server').io;
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
    successResponse(res, null, '推送已发送');
  } else {
    errorResponse(res, '推送服务未启动', 503);
  }
});

exports.getNotificationTypes = asyncHandler(async (req, res) => {
  const types = [
    { value: 'application_submitted', label: '申请提交' },
    { value: 'material_missing', label: '材料缺失' },
    { value: 'material_verified', label: '材料核验' },
    { value: 'approval_assigned', label: '审批分配' },
    { value: 'approval_reminder', label: '审批催办' },
    { value: 'approval_timeout', label: '审批超时' },
    { value: 'approval_approved', label: '审批通过' },
    { value: 'approval_rejected', label: '审批驳回' },
    { value: 'approval_returned', label: '审批退回' },
    { value: 'parallel_approval_start', label: '并联审批启动' },
    { value: 'parallel_approval_merged', label: '并联审批合并' },
    { value: 'certificate_generated', label: '证照生成' },
    { value: 'certificate_synced', label: '证照同步' },
    { value: 'fast_track_approved', label: '快速通道启用' },
    { value: 'fast_track_deadline', label: '快速通道到期提醒' },
    { value: 'fast_track_overdue', label: '快速通道逾期' },
    { value: 'application_revoked', label: '申请撤销' },
    { value: 'credit_updated', label: '信用更新' },
    { value: 'report_generated', label: '报表生成' }
  ];

  successResponse(res, { types });
});
