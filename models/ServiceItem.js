const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['required', 'optional'],
    default: 'required'
  },
  format: {
    type: String,
    enum: ['paper', 'electronic', 'both'],
    default: 'electronic'
  },
  description: String,
  templateUrl: String,
  isFastTrackExempt: {
    type: Boolean,
    default: false
  }
});

const approvalStepSchema = new mongoose.Schema({
  stepOrder: {
    type: Number,
    required: true
  },
  stepName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['single', 'parallel'],
    default: 'single'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  requiredApprovalLevel: {
    type: Number,
    default: 1
  },
  timeoutHours: {
    type: Number,
    default: 24
  },
  remindHours: {
    type: Number,
    default: 2
  },
  canApprove: {
    type: Boolean,
    default: true
  },
  canReject: {
    type: Boolean,
    default: true
  },
  canReturn: {
    type: Boolean,
    default: true
  },
  parallelDepartments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }],
  defaultApprovalOnTimeout: {
    type: Boolean,
    default: false
  }
});

const serviceItemSchema = new mongoose.Schema({
  itemCode: {
    type: String,
    required: true,
    unique: true
  },
  itemName: {
    type: String,
    required: true
  },
  itemType: {
    type: String,
    required: true,
    enum: ['administrative_license', 'public_service', 'other']
  },
  category: String,
  description: String,
  legalBasis: String,
  handlingTime: {
    type: Number,
    default: 5
  },
  processingLocation: String,
  materials: [materialSchema],
  approvalChain: [approvalStepSchema],
  supportsFastTrack: {
    type: Boolean,
    default: false
  },
  fastTrackTimeoutDays: {
    type: Number,
    default: 3
  },
  requiredCreditScore: {
    type: Number,
    default: 80
  },
  certificateTemplate: String,
  sharingPlatformCode: String,
  status: {
    type: String,
    enum: ['draft', 'published', 'disabled'],
    default: 'draft'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

serviceItemSchema.index({ itemCode: 1 }, { unique: true });

module.exports = mongoose.model('ServiceItem', serviceItemSchema);
