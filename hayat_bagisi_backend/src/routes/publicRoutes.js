// hayat_bagisi_backend/src/routes/publicRoutes.js
const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware'); // Needs authentication
const { getActiveBloodNeeds, getBloodNeedById } = require('../controllers/publicController');

const router = express.Router();

// Get all active blood needs (accessible to any authenticated user)
router.get('/blood-needs', authenticateToken, getActiveBloodNeeds);

// Get a specific blood need by ID (accessible to any authenticated user)
router.get('/blood-needs/:needId', authenticateToken, getBloodNeedById);


module.exports = router;