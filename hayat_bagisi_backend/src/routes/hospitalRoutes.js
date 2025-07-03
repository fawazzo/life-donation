// hayat_bagisi_backend/src/routes/hospitalRoutes.js
const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');
const {
    createBloodNeed,
    getHospitalBloodNeeds,
    updateBloodNeed,
    deleteBloodNeed,
    getHospitalProfile,
    updateHospitalProfile,
    getHospitalInventory,      // NEW
    updateHospitalInventory    // NEW
} = require('../controllers/hospitalController');

const router = express.Router();

// Hospital Profile Management
router.get('/profile', authenticateToken, authorizeRole(['hospital_admin']), getHospitalProfile);
router.put('/profile', authenticateToken, authorizeRole(['hospital_admin']), updateHospitalProfile);

// Blood Needs Management by Hospital Admin
router.post('/needs', authenticateToken, authorizeRole(['hospital_admin']), createBloodNeed);
router.get('/needs', authenticateToken, authorizeRole(['hospital_admin']), getHospitalBloodNeeds);
router.put('/needs/:needId', authenticateToken, authorizeRole(['hospital_admin']), updateBloodNeed);
router.delete('/needs/:needId', authenticateToken, authorizeRole(['hospital_admin']), deleteBloodNeed);

// NEW: Hospital Inventory Management
router.get('/inventory', authenticateToken, authorizeRole(['hospital_admin']), getHospitalInventory);
router.post('/inventory/update', authenticateToken, authorizeRole(['hospital_admin']), updateHospitalInventory); // Using POST for update to send units_change in body

module.exports = router;