const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', departmentController.getDepartments);
router.get('/:id', departmentController.getDepartmentById);
router.get('/:id/tree', departmentController.getDepartmentTree);

router.use(authorize('admin'));

router.post('/', departmentController.createDepartment);
router.put('/:id', departmentController.updateDepartment);
router.delete('/:id', departmentController.deleteDepartment);

router.post('/:id/approvers', departmentController.addApprover);
router.delete('/:id/approvers/:approverId', departmentController.removeApprover);
router.put('/:id/approvers/:approverId', departmentController.updateApproverRole);

module.exports = router;
