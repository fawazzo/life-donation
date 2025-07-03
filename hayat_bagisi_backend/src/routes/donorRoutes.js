// hayat_bagisi_backend/src/routes/donorRoutes.js
const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware'); // Assuming these exist
const {
    getDonorProfile,
    updateDonorProfile,
    searchDonors // <-- NEW: Import searchDonors
} = require('../controllers/donorController');

const router = express.Router();

// Get authenticated donor's profile
router.get('/profile', authenticateToken, authorizeRole(['donor']), getDonorProfile);

// Update authenticated donor's profile
router.put('/profile', authenticateToken, authorizeRole(['donor']), updateDonorProfile);

// NEW: Donor Search Route
// This route typically doesn't require authentication for public search.
// If you want to restrict it to authenticated users (e.g., hospitals, admins),
// uncomment the middleware below and adjust roles as needed.
router.get('/search', searchDonors);

// Example for restricted search (if needed):
// router.get('/search', authenticateToken, authorizeRole(['hospital', 'admin']), searchDonors);


module.exports = router;