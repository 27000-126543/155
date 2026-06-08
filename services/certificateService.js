const Certificate = require('../models/Certificate');
const Application = require('../models/Application');
const User = require('../models/User');
const axios = require('axios');
const { generateCertificateNo, generateVerificationCode } = require('../utils/helpers');
const notificationService = require('./notificationService');

class CertificateService {
  async generateCertificate(applicationId, approverId) {
    const application = await Application.findById(applicationId)
      .populate('serviceItem')
      .populate('applicant');

    if (!application) {
      throw new Error('申请不存在');
    }

    if (application.certificate) {
      throw new Error('该申请已生成电子证照');
    }

    const serviceItem = application.serviceItem;
    const applicant = application.applicant;

    const certificateNo = generateCertificateNo();
    const verificationCode = generateVerificationCode();

    const content = this.buildCertificateContent(application, serviceItem, applicant);

    const validFrom = new Date();
    const validTo = this.calculateValidTo(serviceItem, validFrom);

    const certificate = new Certificate({
      certificateNo,
      certificateType: serviceItem.itemType,
      certificateName: serviceItem.itemName,
      application: application._id,
      serviceItem: serviceItem._id,
      holder: applicant._id,
      holderInfo: {
        name: applicant.name,
        idCard: applicant.idCard,
        enterpriseName: applicant.enterpriseInfo?.name,
        creditCode: applicant.enterpriseInfo?.creditCode
      },
      content,
      validFrom,
      validTo,
      status: 'active',
      sealInfo: {
        sealName: `${serviceItem.itemName}专用章`,
        sealTime: new Date(),
        sealOperator: approverId,
        sealSignature: this.generateSealSignature(certificateNo, verificationCode),
        sealCertificate: `SEAL-${certificateNo}`
      },
      verificationCode,
      generatedBy: approverId,
      generatedAt: new Date(),
      fileUrl: `/certificates/${certificateNo}.pdf`,
      qrCode: this.generateQRCodeData(certificateNo, verificationCode)
    });

    await certificate.save();

    application.certificate = certificate._id;
    application.currentStatus = 'completed';
    application.statusHistory.push({
      status: 'completed',
      remark: '电子证照已生成',
      operator: approverId
    });
    await application.save();

    await notificationService.notifyCertificateGenerated(application, certificate, applicant);

    setImmediate(() => this.syncToSharingPlatform(certificate._id));

    return certificate;
  }

  buildCertificateContent(application, serviceItem, applicant) {
    return {
      itemCode: serviceItem.itemCode,
      itemName: serviceItem.itemName,
      applicationNo: application.applicationNo,
      applicantInfo: {
        name: applicant.name,
        idCard: applicant.idCard,
        phone: applicant.phone,
        enterpriseName: applicant.enterpriseInfo?.name,
        creditCode: applicant.enterpriseInfo?.creditCode,
        legalPerson: applicant.enterpriseInfo?.legalPerson
      },
      approvalInfo: {
        approvedAt: application.completedAt,
        processingDays: application.processingDays,
        approvalChain: application.approvalAssignments.map(a => ({
          stepOrder: a.stepOrder,
          decision: a.decision,
          remark: a.decisionRemark,
          decidedAt: a.decidedAt
        }))
      },
      materials: application.submittedMaterials.map(m => ({
        code: m.materialCode,
        name: m.materialName,
        fileName: m.fileName
      })),
      remarks: serviceItem.description
    };
  }

  calculateValidTo(serviceItem, validFrom) {
    const defaultValidYears = 5;
    const validTo = new Date(validFrom);
    validTo.setFullYear(validTo.getFullYear() + defaultValidYears);
    return validTo;
  }

  generateSealSignature(certificateNo, verificationCode) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(`${certificateNo}-${verificationCode}-${Date.now()}`);
    return hash.digest('hex');
  }

  generateQRCodeData(certificateNo, verificationCode) {
    return JSON.stringify({
      certificateNo,
      verificationCode,
      verifyUrl: `/api/certificates/verify/${certificateNo}`
    });
  }

  async syncToSharingPlatform(certificateId) {
    try {
      const certificate = await Certificate.findById(certificateId)
        .populate('holder', 'name idCard')
        .populate('serviceItem', 'itemCode itemName sharingPlatformCode');

      if (!certificate) {
        throw new Error('证照不存在');
      }

      const syncData = {
        certificateNo: certificate.certificateNo,
        certificateType: certificate.certificateType,
        certificateName: certificate.certificateName,
        sharingPlatformCode: certificate.serviceItem?.sharingPlatformCode,
        holder: {
          name: certificate.holderInfo.name,
          idCard: certificate.holderInfo.idCard,
          creditCode: certificate.holderInfo.creditCode
        },
        validFrom: certificate.validFrom,
        validTo: certificate.validTo,
        status: certificate.status,
        verificationCode: certificate.verificationCode,
        content: certificate.content,
        sealInfo: {
          sealName: certificate.sealInfo.sealName,
          sealTime: certificate.sealInfo.sealTime,
          sealSignature: certificate.sealInfo.sealSignature
        },
        generatedAt: certificate.generatedAt
      };

      const response = await axios.post(
        `${process.env.SHARE_PLATFORM_URL}/certificates`,
        syncData,
        { timeout: 10000 }
      );

      if (response.data.success) {
        certificate.sharingPlatformSync.synced = true;
        certificate.sharingPlatformSync.syncedAt = new Date();
        certificate.sharingPlatformSync.syncError = null;
      } else {
        throw new Error(response.data.message || '同步失败');
      }
    } catch (error) {
      console.error('同步证照到共享平台失败:', error.message);
      
      const certificate = await Certificate.findById(certificateId);
      if (certificate) {
        certificate.sharingPlatformSync.synced = false;
        certificate.sharingPlatformSync.syncError = error.message;
        certificate.sharingPlatformSync.syncRetries = (certificate.sharingPlatformSync.syncRetries || 0) + 1;

        if (certificate.sharingPlatformSync.syncRetries < 3) {
          setTimeout(() => {
            this.syncToSharingPlatform(certificateId);
          }, 5000 * certificate.sharingPlatformSync.syncRetries);
        }

        await certificate.save();
      }
    }
  }

  async verifyCertificate(certificateNo, verificationCode) {
    const certificate = await Certificate.findOne({ 
      certificateNo,
      verificationCode
    }).populate('holder', 'name').populate('serviceItem', 'itemName');

    if (!certificate) {
      return {
        valid: false,
        message: '证照不存在或验证码错误'
      };
    }

    if (certificate.status !== 'active') {
      return {
        valid: false,
        message: `证照状态：${certificate.status}`,
        certificate
      };
    }

    const now = new Date();
    if (certificate.validTo && now > certificate.validTo) {
      return {
        valid: false,
        message: '证照已过期',
        certificate
      };
    }

    return {
      valid: true,
      message: '证照有效',
      certificate: {
        certificateNo: certificate.certificateNo,
        certificateName: certificate.certificateName,
        holderName: certificate.holderInfo.name,
        validFrom: certificate.validFrom,
        validTo: certificate.validTo,
        status: certificate.status,
        generatedAt: certificate.generatedAt
      }
    };
  }

  async getCertificateById(id, userId, userType) {
    const certificate = await Certificate.findById(id)
      .populate('holder', 'name phone')
      .populate('serviceItem', 'itemName itemCode')
      .populate('application', 'applicationNo');

    if (!certificate) {
      throw new Error('证照不存在');
    }

    if (userType === 'admin' || userType === 'supervisor') {
      return certificate;
    }

    if (certificate.holder._id.toString() !== userId.toString()) {
      throw new Error('无权查看此证照');
    }

    return certificate;
  }

  async getMyCertificates(userId, options = {}) {
    const { page = 1, limit = 10, status } = options;
    const query = { holder: userId };
    
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const certificates = await Certificate.find(query)
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('serviceItem', 'itemName itemCode')
      .populate('application', 'applicationNo');

    const total = await Certificate.countDocuments(query);

    return {
      certificates,
      pagination: {
        currentPage: page,
        perPage: limit,
        totalPages: Math.ceil(total / limit),
        total
      }
    };
  }

  async revokeCertificate(certificateId, reason, operatorId) {
    const certificate = await Certificate.findById(certificateId);
    if (!certificate) {
      throw new Error('证照不存在');
    }

    if (certificate.status === 'revoked') {
      throw new Error('证照已被撤销');
    }

    certificate.status = 'revoked';
    certificate.revokedAt = new Date();
    certificate.revokedReason = reason;
    certificate.revokedBy = operatorId;

    await certificate.save();

    const application = await Application.findById(certificate.application);
    if (application) {
      application.statusHistory.push({
        status: 'revoked',
        remark: `证照已撤销：${reason}`,
        operator: operatorId
      });
      await application.save();
    }

    return certificate;
  }

  async retrySync(certificateId) {
    const certificate = await Certificate.findById(certificateId);
    if (!certificate) {
      throw new Error('证照不存在');
    }

    if (certificate.sharingPlatformSync.synced) {
      throw new Error('证照已同步');
    }

    certificate.sharingPlatformSync.syncRetries = 0;
    await certificate.save();

    await this.syncToSharingPlatform(certificateId);

    return certificate;
  }

  async retryFailedSyncs() {
    const failedCerts = await Certificate.find({
      'sharingPlatformSync.synced': false,
      'sharingPlatformSync.syncRetries': { $lt: 5 }
    });

    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (const cert of failedCerts) {
      try {
        await this.syncToSharingPlatform(cert._id);
        successCount++;
        results.push({
          certificateNo: cert.certificateNo,
          status: 'success'
        });
      } catch (error) {
        failCount++;
        results.push({
          certificateNo: cert.certificateNo,
          status: 'failed',
          error: error.message
        });
      }
    }

    return {
      total: failedCerts.length,
      success: successCount,
      failed: failCount,
      results
    };
  }

  async getAllCertificates(options = {}) {
    const { page = 1, limit = 10, status, holderId, itemType, startDate, endDate } = options;
    const query = {};

    if (status) query.status = status;
    if (holderId) query.holder = holderId;
    if (itemType) query.certificateType = itemType;
    if (startDate || endDate) {
      query.generatedAt = {};
      if (startDate) query.generatedAt.$gte = new Date(startDate);
      if (endDate) query.generatedAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const certificates = await Certificate.find(query)
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('holder', 'name')
      .populate('serviceItem', 'itemName itemCode')
      .populate('application', 'applicationNo');

    const total = await Certificate.countDocuments(query);

    return {
      certificates,
      pagination: {
        currentPage: page,
        perPage: limit,
        totalPages: Math.ceil(total / limit),
        total
      }
    };
  }
}

module.exports = new CertificateService();
