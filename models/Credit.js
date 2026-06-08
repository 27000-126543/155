const mongoose = require('mongoose');

const creditRecordSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['timeout_application', 'material_fraud', 'late_material_submission',
           'good_behavior', 'approved_on_time', 'voluntary_correction'],
    required: true
  },
  description: String,
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application'
  },
  scoreChange: {
    type: Number,
    required: true
  },
  recordedAt: {
    type: Date,
    default: Date.now
  },
  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  evidence: String
});

const creditSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  score: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  level: {
    type: String,
    enum: ['excellent', 'good', 'normal', 'poor', 'bad'],
    default: 'good'
  },
  records: [creditRecordSchema],
  timeoutCount: {
    type: Number,
    default: 0
  },
  fraudCount: {
    type: Number,
    default: 0
  },
  lateSubmissionCount: {
    type: Number,
    default: 0
  },
  approvalLevel: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  fastTrackRestricted: {
    type: Boolean,
    default: false
  },
  restrictionReason: String,
  restrictionUntil: Date,
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

creditSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  
  if (this.score >= 90) this.level = 'excellent';
  else if (this.score >= 80) this.level = 'good';
  else if (this.score >= 60) this.level = 'normal';
  else if (this.score >= 40) this.level = 'poor';
  else this.level = 'bad';
  
  if (this.fraudCount > 0 || this.timeoutCount >= 3) {
    this.approvalLevel = Math.min(5, Math.max(1, this.fraudCount * 2 + Math.floor(this.timeoutCount / 3)));
    this.fastTrackRestricted = true;
    this.restrictionReason = this.fraudCount > 0 ? '存在材料造假记录' : '频繁超时记录';
  }
  
  next();
});

creditSchema.index({ user: 1 }, { unique: true });
creditSchema.index({ score: -1 });
creditSchema.index({ level: 1 });

module.exports = mongoose.model('Credit', creditSchema);
