const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  name: {
    type: String,
    required: true
  },
  idCard: {
    type: String,
    unique: true,
    sparse: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String
  },
  type: {
    type: String,
    enum: ['personal', 'enterprise', 'approver', 'admin', 'supervisor'],
    required: true
  },
  enterpriseInfo: {
    name: String,
    creditCode: String,
    legalPerson: String
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  position: String,
  approvalLevel: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  fastTrackEnabled: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id, type: this.type }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

module.exports = mongoose.model('User', userSchema);
