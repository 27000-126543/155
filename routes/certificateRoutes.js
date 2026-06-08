const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/my', certificateController.getMyCertificates);
router.get('/:id', certificateController.getCertificateById);
router.get('/:id/download', certificateController.downloadCertificate);
router.get('/verify/:certificateNo', certificateController.verifyCertificate);
router.post('/verify', certificateController.verifyCertificateByCode);

router.use(authorize('admin'));

router.post('/', certificateController.generateCertificate);
router.get('/', certificateController.getAllCertificates);
router.put('/:id/revoke', certificateController.revokeCertificate);
router.post('/:id/retry-sync', certificateController.retrySync);
router.get('/sync/status', certificateController.getSyncStatus);
router.get('/sync/pending', certificateController.getPendingSyncList);
router.get('/sync/retry-dashboard', certificateController.getSyncRetryDashboard);

module.exports = router;
