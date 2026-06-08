const APPLICATION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  MATERIAL_MISSING: 'material_missing',
  PENDING_APPROVAL: 'pending_approval',
  PARALLEL_APPROVAL: 'parallel_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  RETURNED: 'returned',
  TIMEOUT_ESCALATED: 'timeout_escalated',
  REVOKED: 'revoked',
  COMPLETED: 'completed'
};

const APPROVAL_DECISION = {
  APPROVE: 'approve',
  REJECT: 'reject',
  RETURN: 'return',
  DEFAULT_APPROVE: 'default_approve'
};

const NOTIFICATION_TYPE = {
  APPLICATION_SUBMITTED: 'application_submitted',
  MATERIAL_MISSING: 'material_missing',
  MATERIAL_VERIFIED: 'material_verified',
  APPROVAL_ASSIGNED: 'approval_assigned',
  APPROVAL_REMINDER: 'approval_reminder',
  APPROVAL_TIMEOUT: 'approval_timeout',
  APPROVAL_APPROVED: 'approval_approved',
  APPROVAL_REJECTED: 'approval_rejected',
  APPROVAL_RETURNED: 'approval_returned',
  PARALLEL_APPROVAL_START: 'parallel_approval_start',
  PARALLEL_APPROVAL_MERGED: 'parallel_approval_merged',
  CERTIFICATE_GENERATED: 'certificate_generated',
  CERTIFICATE_SYNCED: 'certificate_synced',
  FAST_TRACK_APPROVED: 'fast_track_approved',
  FAST_TRACK_DEADLINE: 'fast_track_deadline',
  FAST_TRACK_OVERDUE: 'fast_track_overdue',
  APPLICATION_REVOKED: 'application_revoked',
  CREDIT_UPDATED: 'credit_updated',
  REPORT_GENERATED: 'report_generated'
};

const USER_TYPE = {
  PERSONAL: 'personal',
  ENTERPRISE: 'enterprise',
  APPROVER: 'approver',
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor'
};

const CREDIT_LEVEL = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  NORMAL: 'normal',
  POOR: 'poor',
  BAD: 'bad'
};

const CREDIT_RECORD_TYPE = {
  TIMEOUT_APPLICATION: 'timeout_application',
  MATERIAL_FRAUD: 'material_fraud',
  LATE_MATERIAL_SUBMISSION: 'late_material_submission',
  GOOD_BEHAVIOR: 'good_behavior',
  APPROVED_ON_TIME: 'approved_on_time',
  VOLUNTARY_CORRECTION: 'voluntary_correction'
};

const ITEM_TYPE = {
  ADMINISTRATIVE_LICENSE: 'administrative_license',
  PUBLIC_SERVICE: 'public_service',
  OTHER: 'other'
};

const REPORT_TYPE = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
  CUSTOM: 'custom'
};

const TIMEOUT_CONFIG = {
  REMIND_HOURS: 2,
  ESCALATE_HOURS: 24,
  PARALLEL_DEFAULT_HOURS: 24,
  FAST_TRACK_DAYS: 3
};

const SCORE_CHANGE = {
  TIMEOUT: -5,
  FRAUD: -30,
  LATE_SUBMISSION: -10,
  GOOD_BEHAVIOR: 5,
  ON_TIME_APPROVAL: 2,
  VOLUNTARY_CORRECTION: 3
};

module.exports = {
  APPLICATION_STATUS,
  APPROVAL_DECISION,
  NOTIFICATION_TYPE,
  USER_TYPE,
  CREDIT_LEVEL,
  CREDIT_RECORD_TYPE,
  ITEM_TYPE,
  REPORT_TYPE,
  TIMEOUT_CONFIG,
  SCORE_CHANGE
};
