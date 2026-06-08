const cron = require('node-cron');
const approvalEngine = require('./approvalEngine');
const performanceService = require('./performanceService');
const certificateService = require('./certificateService');
const notificationService = require('./notificationService');
const Application = require('../models/Application');
const Credit = require('../models/Credit');
const User = require('../models/User');
const { APPLICATION_STATUS, CREDIT_RECORD_TYPE, SCORE_CHANGE } = require('../utils/constants');

class SchedulerService {
  constructor() {
    this.jobs = {};
    this.isRunning = false;
  }

  init(io) {
    if (this.isRunning) return;
    
    this.io = io;
    this.isRunning = true;
    
    this.scheduleTimeoutCheck();
    this.scheduleMonthlyReport();
    this.scheduleFastTrackCheck();
    this.scheduleCertificateSync();
    this.scheduleCreditRestrictionCheck();
    
    console.log('定时任务服务已启动');
  }

  scheduleTimeoutCheck() {
    const job = cron.schedule('*/30 * * * *', async () => {
      console.log('开始执行超时检查任务...');
      try {
        const result = await approvalEngine.checkAndProcessTimeouts();
        console.log(`超时检查完成：催办${result.reminded}个，转交${result.transferred}个，默认通过${result.defaultApproved}个`);
      } catch (error) {
        console.error('超时检查任务失败:', error);
      }
    });
    
    this.jobs.timeoutCheck = job;
    console.log('超时检查任务已调度（每30分钟）');
  }

  scheduleMonthlyReport() {
    const job = cron.schedule('0 2 1 * *', async () => {
      console.log('开始生成月度效能报表...');
      try {
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const report = await performanceService.generateMonthlyReport(
          lastMonth.getFullYear(),
          lastMonth.getMonth() + 1
        );
        
        await notificationService.createNotification(
          'report_generated',
          '月度效能报表已生成',
          `${lastMonth.getFullYear()}年${lastMonth.getMonth() + 1}月度效能报表已生成，请查阅。`,
          {
            report: report._id,
            recipients: await this.getAdminAndSupervisorRecipients()
          }
        );
        
        console.log(`月度报表生成完成: ${report._id}`);
      } catch (error) {
        console.error('月度报表生成失败:', error);
      }
    });
    
    this.jobs.monthlyReport = job;
    console.log('月度报表任务已调度（每月1日2:00）');
  }

  scheduleFastTrackCheck() {
    const job = cron.schedule('0 1 * * *', async () => {
      console.log('开始检查快速通道材料补交...');
      try {
        const result = await this.checkFastTrackSubmissions();
        console.log(`快速通道检查完成：提醒${result.reminded}个，撤销${result.revoked}个`);
      } catch (error) {
        console.error('快速通道检查失败:', error);
      }
    });
    
    this.jobs.fastTrackCheck = job;
    console.log('快速通道检查任务已调度（每天1:00）');
  }

  scheduleCertificateSync() {
    const job = cron.schedule('0 3 * * *', async () => {
      console.log('开始重试证照同步...');
      try {
        const result = await certificateService.retryFailedSyncs();
        console.log(`证照同步重试完成：成功${result.success}个，失败${result.failed}个`);
      } catch (error) {
        console.error('证照同步重试失败:', error);
      }
    });
    
    this.jobs.certificateSync = job;
    console.log('证照同步任务已调度（每天3:00）');
  }

  scheduleCreditRestrictionCheck() {
    const job = cron.schedule('0 0 * * *', async () => {
      console.log('开始检查过期信用限制...');
      try {
        const now = new Date();
        const expiredRestrictions = await Credit.find({
          fastTrackRestricted: true,
          restrictionUntil: { $lt: now }
        });

        for (const credit of expiredRestrictions) {
          credit.fastTrackRestricted = false;
          credit.restrictionReason = null;
          credit.restrictionUntil = null;
          await credit.save();

          await User.findByIdAndUpdate(credit.user, {
            fastTrackEnabled: true
          });

          await notificationService.createNotification(
            'credit_updated',
            '快速通道限制已自动解除',
            '您的快速通道限制已到期，现已自动解除。',
            {
              user: credit.user,
              recipients: [{ user: credit.user, userType: 'applicant' }]
            }
          );
        }

        console.log(`信用限制检查完成：解除${expiredRestrictions.length}个`);
      } catch (error) {
        console.error('信用限制检查失败:', error);
      }
    });
    
    this.jobs.creditRestrictionCheck = job;
    console.log('信用限制检查任务已调度（每天0:00）');
  }

  async checkFastTrackSubmissions() {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const reminded = [];
    const revoked = [];

    const fastTrackApplications = await Application.find({
      fastTrackApproved: true,
      fastTrackSupplementDeadline: { $exists: true },
      currentStatus: { $in: [APPLICATION_STATUS.IN_PROGRESS, APPLICATION_STATUS.APPROVED] },
      allMaterialsSubmitted: false
    }).populate('applicant', 'name phone');

    for (const application of fastTrackApplications) {
      const deadline = application.fastTrackSupplementDeadline;
      
      if (deadline <= now) {
        application.currentStatus = APPLICATION_STATUS.REVOKED;
        application.fastTrackRevoked = true;
        application.fastTrackRevokeReason = '快速通道材料补交逾期';
        application.statusHistory.push({
          status: APPLICATION_STATUS.REVOKED,
          timestamp: now,
          remark: '快速通道材料补交逾期，审批自动撤销',
          operator: null
        });
        await application.save();

        const credit = await Credit.findOne({ user: application.applicant._id });
        if (credit) {
          credit.records.push({
            type: CREDIT_RECORD_TYPE.LATE_MATERIAL_SUBMISSION,
            description: '快速通道材料补交逾期，审批被撤销',
            application: application._id,
            scoreChange: SCORE_CHANGE.LATE_MATERIAL_SUBMISSION
          });
          credit.score = Math.max(0, credit.score + SCORE_CHANGE.LATE_MATERIAL_SUBMISSION);
          credit.lateSubmissionCount++;
          await credit.save();
        }

        await notificationService.createNotification(
          'fast_track_overdue',
          '快速通道审批已撤销',
          `您的申请【${application.applicationNo}】因材料补交逾期，已被自动撤销。`,
          {
            application: application._id,
            recipients: [{ user: application.applicant._id, userType: 'applicant' }]
          }
        );

        revoked.push(application._id);
      }
      else if (deadline <= threeDaysLater && deadline > now) {
        const alreadyReminded = application.notifications?.some(
          n => n.type === 'fast_track_deadline' && new Date(n.createdAt) > sevenDaysAgo
        );

        if (!alreadyReminded) {
          await notificationService.createNotification(
            'fast_track_deadline',
            '快速通道材料补交提醒',
            `您的申请【${application.applicationNo}】快速通道材料补交截止日期为${deadline.toLocaleDateString()}，请尽快补交材料，逾期将自动撤销审批。`,
            {
              application: application._id,
              recipients: [{ user: application.applicant._id, userType: 'applicant' }]
            }
          );
          reminded.push(application._id);
        }
      }
    }

    return { reminded: reminded.length, revoked: revoked.length };
  }

  async getAdminAndSupervisorRecipients() {
    const users = await User.find({
      type: { $in: ['admin', 'supervisor'] }
    }, '_id type');
    
    return users.map(user => ({
      user: user._id,
      userType: user.type
    }));
  }

  async runTaskManually(taskName) {
    const taskMap = {
      timeoutCheck: async () => {
        const result = await approvalEngine.checkAndProcessTimeouts();
        return {
          task: 'timeoutCheck',
          name: '超时检查',
          result: {
            reminded: result.reminded,
            transferred: result.transferred,
            defaultApproved: result.defaultApproved
          },
          message: `超时检查完成：催办${result.reminded}个，转交${result.transferred}个，默认通过${result.defaultApproved}个`
        };
      },
      fastTrackCheck: async () => {
        const result = await this.checkFastTrackSubmissions();
        return {
          task: 'fastTrackCheck',
          name: '快速通道检查',
          result: {
            reminded: result.reminded,
            revoked: result.revoked
          },
          message: `快速通道检查完成：提醒${result.reminded}个，撤销${result.revoked}个`
        };
      },
      monthlyReport: async () => {
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const result = await performanceService.generateMonthlyReport(
          lastMonth.getFullYear(),
          lastMonth.getMonth() + 1
        );
        return {
          task: 'monthlyReport',
          name: '月度报表生成',
          result: {
            reportId: result._id,
            reportNo: result.reportNo,
            period: `${result.period.year}年${result.period.month}月`
          },
          message: `月度报表生成完成：${result.reportNo}`
        };
      },
      certificateSync: async () => {
        const result = await certificateService.retryFailedSyncs();
        return {
          task: 'certificateSync',
          name: '证照同步重试',
          result: {
            total: result.total,
            success: result.success,
            failed: result.failed
          },
          message: `证照同步重试完成：成功${result.success}个，失败${result.failed}个`
        };
      },
      creditRestrictionCheck: async () => {
        const now = new Date();
        const expiredRestrictions = await Credit.find({
          fastTrackRestricted: true,
          restrictionUntil: { $lt: now }
        });

        const results = [];
        for (const credit of expiredRestrictions) {
          credit.fastTrackRestricted = false;
          credit.restrictionReason = null;
          credit.restrictionUntil = null;
          await credit.save();

          await User.findByIdAndUpdate(credit.user, {
            fastTrackEnabled: true
          });

          results.push({
            userId: credit.user,
            message: '快速通道限制已自动解除'
          });
        }

        return {
          task: 'creditRestrictionCheck',
          name: '信用限制检查',
          result: {
            processed: results.length,
            results
          },
          message: `已自动解除${results.length}个过期限制`
        };
      }
    };

    if (taskMap[taskName]) {
      console.log(`手动执行任务: ${taskName}`);
      try {
        const result = await taskMap[taskName]();
        return {
          success: true,
          ...result
        };
      } catch (error) {
        console.error(`任务执行失败 ${taskName}:`, error);
        return {
          success: false,
          task: taskName,
          error: error.message,
          message: `任务执行失败: ${error.message}`
        };
      }
    }

    return {
      success: false,
      task: taskName,
      message: `任务 ${taskName} 不存在`,
      availableTasks: Object.keys(taskMap)
    };
  }

  stopAll() {
    Object.values(this.jobs).forEach(job => job.stop());
    this.isRunning = false;
    console.log('所有定时任务已停止');
  }

  getTaskStatus() {
    return {
      isRunning: this.isRunning,
      tasks: Object.keys(this.jobs).map(name => ({
        name,
        scheduled: this.jobs[name] !== null
      }))
    };
  }
}

module.exports = new SchedulerService();
