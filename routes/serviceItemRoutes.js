const express = require('express');
const router = express.Router();
const serviceItemController = require('../controllers/serviceItemController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', serviceItemController.getServiceItems);
router.get('/published', serviceItemController.getPublishedItems);
router.get('/:id', serviceItemController.getServiceItemById);
router.get('/code/:itemCode', serviceItemController.getServiceItemByCode);

router.use(authorize('admin'));

router.post('/', serviceItemController.createServiceItem);
router.put('/:id', serviceItemController.updateServiceItem);
router.delete('/:id', serviceItemController.deleteServiceItem);
router.post('/:id/publish', serviceItemController.publishServiceItem);
router.post('/:id/unpublish', serviceItemController.unpublishServiceItem);

router.post('/:id/materials', serviceItemController.addMaterial);
router.put('/:id/materials/:materialId', serviceItemController.updateMaterial);
router.delete('/:id/materials/:materialId', serviceItemController.deleteMaterial);

router.post('/:id/steps', serviceItemController.addApprovalStep);
router.put('/:id/steps/:stepOrder', serviceItemController.updateApprovalStep);
router.delete('/:id/steps/:stepOrder', serviceItemController.deleteApprovalStep);

module.exports = router;
