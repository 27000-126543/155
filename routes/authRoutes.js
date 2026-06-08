const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, authorize, rateLimiter } = require('../middleware/auth');

router.post('/register', rateLimiter, authController.register);
router.post('/login', rateLimiter, authController.login);
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.getMe);
router.put('/update-password', protect, authController.updatePassword);
router.put('/update-profile', protect, authController.updateProfile);

router.get('/users', protect, authorize('admin'), authController.getUsers);
router.get('/users/:id', protect, authorize('admin'), authController.getUserById);
router.put('/users/:id', protect, authorize('admin'), authController.updateUser);
router.delete('/users/:id', protect, authorize('admin'), authController.deleteUser);
router.post('/users/:id/reset-password', protect, authorize('admin'), authController.resetPassword);

module.exports = router;
