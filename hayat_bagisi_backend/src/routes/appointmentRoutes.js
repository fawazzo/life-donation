// hayat_bagisi_backend/src/routes/appointmentRoutes.js
const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/authMiddleware');
const {
    createAppointment,
    getDonorAppointments,
    getHospitalAppointments,
    updateAppointmentStatus,
    deleteAppointment
} = require('../controllers/appointmentController');

const router = express.Router();

// Publicly accessible for booking (requires donor token)
router.post('/', authenticateToken, authorizeRole(['donor']), createAppointment); // Create an appointment

// Donor-specific routes
router.get('/my-appointments', authenticateToken, authorizeRole(['donor']), getDonorAppointments);

// Hospital-specific routes
router.get('/hospital-appointments', authenticateToken, authorizeRole(['hospital_admin']), getHospitalAppointments);

// Update/Delete an appointment (by donor or hospital admin depending on permission)
router.put('/:appointmentId/status', authenticateToken, authorizeRole(['donor', 'hospital_admin']), updateAppointmentStatus);
router.delete('/:appointmentId', authenticateToken, authorizeRole(['donor', 'hospital_admin', 'super_admin']), deleteAppointment);


module.exports = router;