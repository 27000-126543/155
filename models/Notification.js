const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['application_submitted', 'material_missing', 'material_verified',
           'approval_assigned', 'approval_reminder', 'approval_timeout',
           'approval_approved', 'approval_rejected', 'approval_returned',
           'approval_transferred',
           'parallel_approval_start', 'parallel_approval_merged',
           'certificate_generated', 'certificate_synced',
           'fast_track_approved', 'fast_track_deadline', 'fast_track_overdue',
           'application_revoked', 'credit_updated', 'report_generated'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application'
  },
  serviceItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceItem'
  },
  certificate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Certificate'
  },
  recipients: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userType: {
      type: String,
      enum: ['applicant', 'approver', 'supervisor', 'admin'],
      required: true
    },
    read: {
      type: Boolean,
      default: false
    },
    readAt: Date,
    pushSent: {
      type: Boolean,
      default: false
    },
    pushError: String,
    smsSent: {
      type: Boolean,
      default: false
    },
    smsError: String,
    emailSent: {
      type: Boolean,
      default: false
    },
    emailError: String
  }],
  pushStatus: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'partial'],
    default: 'pending'
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

notificationSchema.index({ 'recipients.user': 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ application: 1, createdAt: -1 });
notificationSchema.index({ pushStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
