const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  parentDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  level: {
    type: Number,
    default: 1
  },
  description: String,
  contact: {
    phone: String,
    address: String
  },
  approvers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Department', departmentSchema);
