const mongoose = require('mongoose');

const submittedMaterialSchema = new mongoose.Schema({
  materialCode: {
    type: String,
    required: true
  },
  materialName: String,
  fileUrl: String,
  fileName: String,
  fileSize: Number,
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  verified: {
    type: Boolean,
    default: false
  },
  verificationNote: String,
  isPostSubmission: {
    type: Boolean,
    default: false
  }
});

const applicationSchema = new mongoose.Schema({
  applicationNo: {
    type: String,
    required: true,
    unique: true
  },
  serviceItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceItem',
    required: true
  },
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  applicantType: {
    type: String,
    enum: ['personal', 'enterprise'],
    required: true
  },
  applicantInfo: {
    name: String,
    idCard: String,
    phone: String,
    enterpriseName: String,
    creditCode: String,
    legalPerson: String
  },
  submittedMaterials: [submittedMaterialSchema],
  missingMaterials: [{
    materialCode: String,
    materialName: String,
    reason: String,
    isPostSubmission: Boolean
  }],
  useFastTrack: {
    type: Boolean,
    default: false
  },
  fastTrackApproved: {
    type: Boolean,
    default: false
  },
  fastTrackDeadline: Date,
  fastTrackSupplementDeadline: Date,
  fastTrackMaterialsSubmitted: {
    type: Boolean,
    default: false
  },
  fastTrackRevoked: {
    type: Boolean,
    default: false
  },
  fastTrackRevokeReason: String,
  currentStep: {
    type: Number,
    default: 0
  },
  currentStatus: {
    type: String,
    enum: ['draft', 'submitted', 'material_missing', 'pending_approval', 'parallel_approval',
           'approved', 'rejected', 'returned', 'timeout_escalated', 'revoked', 'completed'],
    default: 'draft'
  },
  statusHistory: [{
    status: String,
    remark: String,
    operator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  approvalAssignments: [{
    stepOrder: Number,
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    },
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: Date,
    deadline: Date,
    status: {
      type: String,
      enum: ['pending', 'reminded', 'timeout', 'completed', 'escalated'],
      default: 'pending'
    },
    remindedAt: Date,
    escalatedAt: Date,
    escalatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    transferredFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    transferredTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    transferredAt: Date,
    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    transferRemark: String,
    decision: {
      type: String,
      enum: ['approve', 'reject', 'return', 'default_approve']
    },
    decisionRemark: String,
    decidedAt: Date,
    isParallel: Boolean,
    parallelGroupId: String
  }],
  parallelApprovals: [{
    groupId: String,
    stepOrder: Number,
    departments: [{
      department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
      },
      approver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      assignedAt: Date,
      deadline: Date,
      status: {
        type: String,
        enum: ['pending', 'completed', 'timeout_default'],
        default: 'pending'
      },
      transferredFrom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      transferredTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      transferredAt: Date,
      transferredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      transferRemark: String,
      decision: {
        type: String,
        enum: ['approve', 'reject', 'default_approve']
      },
      opinion: String,
      decidedAt: Date
    }],
    mergedOpinion: String,
    mergedAt: Date,
    finalDecision: {
      type: String,
      enum: ['approve', 'reject']
    }
  }],
  certificate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Certificate'
  },
  processingDays: {
    type: Number,
    default: 0
  },
  isTimelyCompleted: {
    type: Boolean,
    default: true
  },
  hasTimeout: {
    type: Boolean,
    default: false
  },
  timeoutCount: {
    type: Number,
    default: 0
  },
  submittedAt: Date,
  completedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

applicationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

applicationSchema.index({ applicationNo: 1 }, { unique: true });
applicationSchema.index({ applicant: 1, createdAt: -1 });
applicationSchema.index({ currentStatus: 1, createdAt: -1 });
applicationSchema.index({ serviceItem: 1, createdAt: -1 });

module.exports = mongoose.model('Application', applicationSchema);
