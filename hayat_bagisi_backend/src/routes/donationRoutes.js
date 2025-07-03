// hayat_bagisi_backend/src/routes/donationRoutes.js
const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');
const {
    recordDonation,
    getDonorDonations,
    getHospitalDonations,
    getHospitalAppointments,
    updateAppointmentStatus,
    searchDonorsForHospital,
    bookAppointment, // NEW
    getDonorAppointments // NEW
} = require('../controllers/donationController');

const router = express.Router();

// Donations
router.post('/record', authenticateToken, authorizeRole(['hospital_admin']), recordDonation);
router.get('/my-donations', authenticateToken, authorizeRole(['donor']), getDonorDonations);
router.get('/hospital-donations', authenticateToken, authorizeRole(['hospital_admin']), getHospitalDonations);

// Appointments
router.post('/book', authenticateToken, authorizeRole(['donor']), bookAppointment); // NEW
router.get('/my-appointments', authenticateToken, authorizeRole(['donor']), getDonorAppointments); // NEW
router.get('/hospital-appointments', authenticateToken, authorizeRole(['hospital_admin']), getHospitalAppointments);
router.put('/:appointmentId/status', authenticateToken, updateAppointmentStatus);

// Donor Search (for Hospital Admins to record manual donations)
router.get('/donors/search', authenticateToken, authorizeRole(['hospital_admin']), searchDonorsForHospital);


module.exports = router;