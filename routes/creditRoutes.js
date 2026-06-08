const express = require('express');
const router = express.Router();
const creditController = require('../controllers/creditController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/me', creditController.getMyCredit);
router.get('/me/records', creditController.getMyCreditRecords);

router.use(authorize('admin'));

router.get('/', creditController.getAllCredits);
router.get('/statistics', creditController.getCreditStatistics);
router.get('/:userId', creditController.getCreditByUserId);
router.post('/record', creditController.addCreditRecord);
router.put('/adjust', creditController.adjustCreditScore);
router.post('/restrict', creditController.restrictFastTrack);
router.post('/unrestrict', creditController.unrestrictFastTrack);
router.post('/check-expired', creditController.checkExpiredRestrictions);

module.exports = router;
