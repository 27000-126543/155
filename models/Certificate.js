const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  certificateNo: {
    type: String,
    required: true,
    unique: true
  },
  certificateType: {
    type: String,
    required: true
  },
  certificateName: String,
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  serviceItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceItem'
  },
  holder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  holderInfo: {
    name: String,
    idCard: String,
    enterpriseName: String,
    creditCode: String
  },
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  validFrom: {
    type: Date,
    required: true
  },
  validTo: Date,
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked', 'suspended'],
    default: 'active'
  },
  sealInfo: {
    sealName: String,
    sealTime: Date,
    sealOperator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sealSignature: String,
    sealCertificate: String
  },
  fileUrl: String,
  qrCode: String,
  sharingPlatformSync: {
    synced: {
      type: Boolean,
      default: false
    },
    syncedAt: Date,
    syncError: String,
    syncRetries: {
      type: Number,
      default: 0
    },
    lastSyncAttempt: Date
  },
  verificationCode: String,
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  revokedAt: Date,
  revokedReason: String,
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

certificateSchema.index({ certificateNo: 1 }, { unique: true });
certificateSchema.index({ holder: 1, status: 1 });
certificateSchema.index({ application: 1 }, { unique: true });
certificateSchema.index({ 'sharingPlatformSync.synced': 1 });

module.exports = mongoose.model('Certificate', certificateSchema);
