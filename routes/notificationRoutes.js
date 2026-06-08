const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', notificationController.getMyNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.get('/types', notificationController.getNotificationTypes);
router.get('/:id', notificationController.getNotificationById);
router.put('/:id/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);

router.use(authorize('admin'));

router.post('/', notificationController.sendNotification);
router.post('/push', notificationController.pushToUser);

module.exports = router;
