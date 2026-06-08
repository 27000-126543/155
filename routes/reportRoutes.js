const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin', 'supervisor'));

router.get('/quick-stats', reportController.getQuickStats);
router.get('/realtime', reportController.getRealTimeStats);
router.get('/trend', reportController.getPerformanceTrend);
router.get('/ranking', reportController.getApprovalRanking);
router.get('/top-departments', reportController.getTopDepartments);
router.get('/bottom-departments', reportController.getBottomDepartments);
router.get('/department', reportController.getDepartmentPerformance);
router.get('/item-type', reportController.getItemTypePerformance);

router.post('/monthly', reportController.generateMonthlyReport);
router.post('/custom', reportController.generateReportByPeriod);

router.get('/', reportController.getReports);
router.get('/:id', reportController.getReportById);
router.get('/:id/export', reportController.exportReportToExcel);
router.get('/export/by-period', reportController.exportReportByPeriodToExcel);
router.delete('/:id', reportController.deleteReport);

module.exports = router;
