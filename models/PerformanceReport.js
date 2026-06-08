const mongoose = require('mongoose');

const departmentStatsSchema = new mongoose.Schema({
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  departmentCode: String,
  departmentName: String,
  totalApplications: {
    type: Number,
    default: 0
  },
  completedApplications: {
    type: Number,
    default: 0
  },
  timelyCompleted: {
    type: Number,
    default: 0
  },
  timelyCompletionRate: {
    type: Number,
    default: 0
  },
  timeoutApplications: {
    type: Number,
    default: 0
  },
  timeoutRate: {
    type: Number,
    default: 0
  },
  returnedApplications: {
    type: Number,
    default: 0
  },
  returnRate: {
    type: Number,
    default: 0
  },
  rejectedApplications: {
    type: Number,
    default: 0
  },
  averageProcessingDays: {
    type: Number,
    default: 0
  },
  maxProcessingDays: {
    type: Number,
    default: 0
  },
  minProcessingDays: {
    type: Number,
    default: 0
  },
  totalProcessingDays: {
    type: Number,
    default: 0
  },
  itemTypeStats: [{
    itemType: String,
    itemTypeName: String,
    total: Number,
    completed: Number,
    timelyCompleted: Number,
    timelyCompletionRate: Number,
    timeout: Number,
    timeoutRate: Number,
    returned: Number,
    returnRate: Number,
    averageProcessingDays: Number
  }]
});

const itemStatsSchema = new mongoose.Schema({
  serviceItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceItem'
  },
  itemCode: String,
  itemName: String,
  totalApplications: {
    type: Number,
    default: 0
  },
  completedApplications: {
    type: Number,
    default: 0
  },
  timelyCompleted: {
    type: Number,
    default: 0
  },
  timelyCompletionRate: {
    type: Number,
    default: 0
  },
  timeoutApplications: {
    type: Number,
    default: 0
  },
  timeoutRate: {
    type: Number,
    default: 0
  },
  returnedApplications: {
    type: Number,
    default: 0
  },
  returnRate: {
    type: Number,
    default: 0
  },
  averageProcessingDays: {
    type: Number,
    default: 0
  }
});

const reportSchema = new mongoose.Schema({
  reportNo: {
    type: String,
    required: true,
    unique: true
  },
  reportType: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly', 'custom'],
    default: 'monthly'
  },
  period: {
    year: {
      type: Number,
      required: true
    },
    month: Number,
    quarter: Number,
    startDate: Date,
    endDate: Date
  },
  overallStats: {
    totalApplications: {
      type: Number,
      default: 0
    },
    completedApplications: {
      type: Number,
      default: 0
    },
    pendingApplications: {
      type: Number,
      default: 0
    },
    timelyCompleted: {
      type: Number,
      default: 0
    },
    timelyCompletionRate: {
      type: Number,
      default: 0
    },
    timeoutApplications: {
      type: Number,
      default: 0
    },
    timeoutRate: {
      type: Number,
      default: 0
    },
    returnedApplications: {
      type: Number,
      default: 0
    },
    returnRate: {
      type: Number,
      default: 0
    },
    rejectedApplications: {
      type: Number,
      default: 0
    },
    averageProcessingDays: {
      type: Number,
      default: 0
    },
    fastTrackApplications: {
      type: Number,
      default: 0
    },
    parallelApprovalApplications: {
      type: Number,
      default: 0
    },
    certificatesGenerated: {
      type: Number,
      default: 0
    }
  },
  departmentStats: [departmentStatsSchema],
  itemStats: [itemStatsSchema],
  topItems: [{
    itemCode: String,
    itemName: String,
    count: Number
  }],
  slowestDepartments: [{
    department: String,
    averageDays: Number
  }],
  timeoutRankings: [{
    department: String,
    timeoutCount: Number,
    timeoutRate: Number
  }],
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  exportedFiles: [{
    format: String,
    url: String,
    exportedAt: Date
  }],
  status: {
    type: String,
    enum: ['generating', 'completed', 'failed'],
    default: 'generating'
  }
});

reportSchema.index({ reportNo: 1 }, { unique: true });
reportSchema.index({ 'period.year': 1, 'period.month': 1, reportType: 1 });
reportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PerformanceReport', reportSchema);
