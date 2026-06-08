const certificateService = require('../services/certificateService');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');

exports.generateCertificate = asyncHandler(async (req, res) => {
  const { applicationId } = req.body;

  const certificate = await certificateService.generateCertificate(applicationId, req.user._id);

  successResponse(res, {
    certificate: {
      id: certificate._id,
      certificateNo: certificate.certificateNo,
      certificateName: certificate.certificateName,
      holderName: certificate.holderInfo.name,
      validFrom: certificate.validFrom,
      validTo: certificate.validTo,
      status: certificate.status,
      fileUrl: certificate.fileUrl,
      verificationCode: certificate.verificationCode
    }
  }, '电子证照生成成功', 201);
});

exports.getMyCertificates = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const result = await certificateService.getMyCertificates(req.user._id, {
    page: parseInt(page),
    limit: parseInt(limit),
    status
  });

  successResponse(res, result);
});

exports.getAllCertificates = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, holderId, itemType, startDate, endDate } = req.query;

  const result = await certificateService.getAllCertificates({
    page: parseInt(page),
    limit: parseInt(limit),
    status,
    holderId,
    itemType,
    startDate,
    endDate
  });

  successResponse(res, result);
});

exports.getCertificateById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const certificate = await certificateService.getCertificateById(
    id, 
    req.user._id, 
    req.user.type
  );

  successResponse(res, { certificate });
});

exports.verifyCertificate = asyncHandler(async (req, res) => {
  const { certificateNo } = req.params;
  const { verificationCode } = req.query;

  if (!verificationCode) {
    return errorResponse(res, '请提供验证码', 400);
  }

  const result = await certificateService.verifyCertificate(certificateNo, verificationCode);

  successResponse(res, result);
});

exports.verifyCertificateByCode = asyncHandler(async (req, res) => {
  const { certificateNo, verificationCode } = req.body;

  const result = await certificateService.verifyCertificate(certificateNo, verificationCode);

  successResponse(res, result);
});

exports.revokeCertificate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return errorResponse(res, '请提供撤销原因', 400);
  }

  const certificate = await certificateService.revokeCertificate(id, reason, req.user._id);

  successResponse(res, {
    certificate: {
      id: certificate._id,
      certificateNo: certificate.certificateNo,
      status: certificate.status,
      revokedAt: certificate.revokedAt,
      revokedReason: certificate.revokedReason
    }
  }, '证照已撤销');
});

exports.retrySync = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const certificate = await certificateService.retrySync(id);

  successResponse(res, {
    certificate: {
      id: certificate._id,
      certificateNo: certificate.certificateNo,
      sharingPlatformSync: certificate.sharingPlatformSync
    }
  }, '同步重试已启动');
});

exports.downloadCertificate = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const certificate = await certificateService.getCertificateById(
    id,
    req.user._id,
    req.user.type
  );

  if (!certificate.fileUrl) {
    return errorResponse(res, '证照文件不存在', 404);
  }

  const fs = require('fs');
  const path = require('path');
  
  const filePath = path.join(__dirname, '..', certificate.fileUrl);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, `${certificate.certificateNo}.pdf`);
  } else {
    const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
    
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const font = await pdfDoc.embedFont(StandardFonts.Helper);
    
    page.drawText(`电子证照`, {
      x: 50, y: 750, size: 24, font, color: rgb(0, 0, 0)
    });
    
    page.drawText(`证照编号: ${certificate.certificateNo}`, {
      x: 50, y: 700, size: 14, font
    });
    page.drawText(`证照名称: ${certificate.certificateName}`, {
      x: 50, y: 670, size: 14, font
    });
    page.drawText(`持证人: ${certificate.holderInfo.name}`, {
      x: 50, y: 640, size: 14, font
    });
    page.drawText(`身份证号: ${certificate.holderInfo.idCard}`, {
      x: 50, y: 610, size: 14, font
    });
    page.drawText(`有效期自: ${new Date(certificate.validFrom).toLocaleDateString()}`, {
      x: 50, y: 580, size: 14, font
    });
    page.drawText(`有效期至: ${new Date(certificate.validTo).toLocaleDateString()}`, {
      x: 50, y: 550, size: 14, font
    });
    page.drawText(`验证码: ${certificate.verificationCode}`, {
      x: 50, y: 520, size: 14, font
    });
    
    page.drawText(`发证机关印章`, {
      x: 400, y: 200, size: 16, font, color: rgb(0.8, 0, 0)
    });
    page.drawText(`${certificate.sealInfo.sealName}`, {
      x: 380, y: 170, size: 12, font
    });
    page.drawText(`${new Date(certificate.sealInfo.sealTime).toLocaleDateString()}`, {
      x: 380, y: 150, size: 12, font
    });

    const pdfBytes = await pdfDoc.save();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${certificate.certificateNo}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  }
});

exports.getSyncStatus = asyncHandler(async (req, res) => {
  const Certificate = require('../models/Certificate');
  
  const total = await Certificate.countDocuments();
  const synced = await Certificate.countDocuments({ 'sharingPlatformSync.synced': true });
  const failed = await Certificate.countDocuments({ 
    'sharingPlatformSync.synced': false,
    'sharingPlatformSync.syncRetries': { $gte: 3 }
  });
  const pending = total - synced - failed;

  successResponse(res, {
    total,
    synced,
    failed,
    pending,
    syncRate: total > 0 ? Math.round((synced / total) * 10000) / 100 : 0
  });
});

exports.getPendingSyncList = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const Certificate = require('../models/Certificate');
  const certificates = await Certificate.find({
    'sharingPlatformSync.synced': false
  })
    .sort({ generatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('holder', 'name')
    .populate('serviceItem', 'itemName');

  const total = await Certificate.countDocuments({
    'sharingPlatformSync.synced': false
  });

  successResponse(res, {
    certificates,
    pagination: {
      currentPage: parseInt(page),
      perPage: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      total
    }
  });
});
