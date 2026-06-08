const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { protect, authorize, isApprover } = require('../middleware/auth');

router.use(protect);

router.get('/my', applicationController.getMyApplications);
router.get('/fast-track/eligibility', applicationController.checkFastTrackEligibility);
router.get('/approver/pending', isApprover, applicationController.getMyPendingApprovals);
router.get('/:id', applicationController.getApplicationById);
router.get('/:id/timeline', applicationController.getApplicationTimeline);

router.post('/', applicationController.createApplication);
router.post('/fast-track', applicationController.submitWithFastTrack);
router.put('/:id/supplement', applicationController.supplementMaterials);
router.put('/:id/cancel', applicationController.cancelApplication);
router.put('/:id/approve', isApprover, applicationController.processApproval);
router.put('/:id/verify-material', authorize('admin', 'approver'), applicationController.verifyMaterial);

router.use(authorize('admin', 'supervisor'));

router.get('/', applicationController.getApplications);
router.put('/:id/status', applicationController.updateApplicationStatus);

module.exports = router;
