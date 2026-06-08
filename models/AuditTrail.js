const mongoose = require('mongoose');

const auditTrailSchema = new mongoose.Schema({
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  applicationNo: {
    type: String,
    required: true
  },
  serviceItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceItem'
  },
  itemCode: String,
  itemName: String,
  operationType: {
    type: String,
    enum: [
      'transfer',
      'timeout_escalate',
      'parallel_default_approve',
      'revoke',
      'approve',
      'reject',
      'return',
      'remind',
      'create',
      'submit',
      'cancel'
    ],
    required: true
  },
  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  operatorName: String,
  operatorType: {
    type: String,
    enum: ['user', 'system']
  },
  beforeStatus: String,
  afterStatus: String,
  beforeApprover: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  beforeApproverName: String,
  afterApprover: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  afterApproverName: String,
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  departmentName: String,
  stepOrder: Number,
  stepName: String,
  remark: String,
  detail: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

auditTrailSchema.index({ application: 1, timestamp: -1 });
auditTrailSchema.index({ applicationNo: 1, timestamp: -1 });
auditTrailSchema.index({ itemCode: 1, timestamp: -1 });
auditTrailSchema.index({ operationType: 1, timestamp: -1 });
auditTrailSchema.index({ operator: 1, timestamp: -1 });
auditTrailSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditTrail', auditTrailSchema);
