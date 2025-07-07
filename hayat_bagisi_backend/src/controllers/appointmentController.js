// hayat_bagisi_backend/src/controllers/appointmentController.js
const pool = require('../config/db');

// Create a new appointment (by donor)
const createAppointment = async (req, res) => {
    const donorId = req.user.user_id; // From authenticated donor token
    const { hospital_id, appointment_date_time, blood_need_id } = req.body;

    // Input validation
    if (!hospital_id || !appointment_date_time) {
        return res.status(400).json({ message: 'Hospital ID and appointment date/time are required.' });
    }
    const appointmentDateTime = new Date(appointment_date_time);
    if (isNaN(appointmentDateTime) || appointmentDateTime < new Date()) {
        return res.status(400).json({ message: 'Invalid or past appointment date/time.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO appointments (donor_id, hospital_id, appointment_date_time, blood_need_id, status)
             VALUES ($1, $2, $3, $4, 'scheduled') RETURNING *`,
            [donorId, hospital_id, appointmentDateTime, blood_need_id || null] // blood_need_id can be null
        );
        res.status(201).json({ message: 'Appointment booked successfully.', appointment: result.rows[0] });
    } catch (error) {
        console.error('Error booking appointment:', error.stack);
        // Check for specific unique constraint errors if you add them (e.g., donor can't book same slot twice)
        res.status(500).json({ message: 'Server error booking appointment.', error: error.message });
    }
};

// Get all appointments for the authenticated donor
const getDonorAppointments = async (req, res) => {
    const donorId = req.user.user_id;

    try {
        const result = await pool.query(
            `SELECT
                a.*,
                h.name AS hospital_name,
                h.address AS hospital_address,
                bn.blood_type AS needed_blood_type,
                bn.urgency_level AS needed_urgency_level
            FROM appointments a
            JOIN hospitals h ON a.hospital_id = h.hospital_id
            LEFT JOIN blood_needs bn ON a.blood_need_id = bn.need_id
            WHERE a.donor_id = $1
            ORDER BY a.appointment_date_time DESC`,
            [donorId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching donor appointments:', error.stack);
        res.status(500).json({ message: 'Server error fetching donor appointments.', error: error.message });
    }
};

// Get all appointments for the authenticated hospital (admin view)
const getHospitalAppointments = async (req, res) => {
    const hospitalId = req.user.user_id;

    try {
        const result = await pool.query(
            `SELECT
                a.*,
                d.full_name AS donor_name,
                d.blood_type AS donor_blood_type,
                d.phone_number AS donor_phone_number,
                u.email AS donor_email,
                bn.blood_type AS needed_blood_type,
                bn.urgency_level AS needed_urgency_level
            FROM appointments a
            JOIN donors d ON a.donor_id = d.donor_id
            JOIN users u ON d.donor_id = u.user_id
            LEFT JOIN blood_needs bn ON a.blood_need_id = bn.need_id
            WHERE a.hospital_id = $1
            ORDER BY a.appointment_date_time DESC`,
            [hospitalId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching hospital appointments:', error.stack);
        res.status(500).json({ message: 'Server error fetching hospital appointments.', error: error.message });
    }
};

// Update appointment status (e.g., cancel by donor, complete/no-show by hospital)
const updateAppointmentStatus = async (req, res) => {
    const { appointmentId } = req.params;
    const { status } = req.body;
    const userId = req.user.user_id;
    const userRole = req.user.role;

    if (!status || !['scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid appointment status.' });
    }

    let client; // Declare client outside the try block
    try {
        client = await pool.connect(); // Acquire client here
        await client.query('BEGIN');

        // Find the appointment and check permissions
        const appointmentResult = await client.query(
            `SELECT donor_id, hospital_id FROM appointments WHERE appointment_id = $1 FOR UPDATE`, // Add FOR UPDATE to prevent race conditions
            [appointmentId]
        );
        const appointment = appointmentResult.rows[0];

        if (!appointment) {
            await client.query('ROLLBACK'); // Rollback if not found
            return res.status(404).json({ message: 'Appointment not found.' });
        }

        // Authorization: Only donor can update their own non-completed/non-cancelled appt
        // Only hospital admin can update appointments for their hospital
        if (userRole === 'donor' && appointment.donor_id !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Unauthorized to update this appointment.' });
        }
        if (userRole === 'hospital_admin' && appointment.hospital_id !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Unauthorized to update this appointment.' });
        }

        // Additional logic: Donors can only cancel/reschedule. Hospitals can mark complete/no_show/cancel.
        if (userRole === 'donor' && !['cancelled', 'rescheduled'].includes(status)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Donors can only cancel or reschedule appointments.' });
        }
        if (userRole === 'hospital_admin' && !['completed', 'no_show', 'cancelled'].includes(status)) {
             await client.query('ROLLBACK');
             return res.status(403).json({ message: 'Hospital admins can only mark appointments as completed, no-show, or cancelled.' });
        }


        const result = await pool.query(
            `UPDATE appointments SET status = $1, last_updated_at = CURRENT_TIMESTAMP
             WHERE appointment_id = $2 RETURNING *`,
            [status, appointmentId]
        );
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'Appointment status updated successfully.', appointment: result.rows[0] });

    } catch (error) {
        if (client) { // Only rollback if client was successfully acquired
            await client.query('ROLLBACK');
        }
        console.error('Error updating appointment status:', error.stack);
        res.status(500).json({ message: 'Server error updating appointment status.', error: error.message });
    } finally {
        if (client) { // Always release the client
            client.release();
        }
    }
};

// Delete an appointment (e.g., by super_admin or perhaps if unconfirmed)
const deleteAppointment = async (req, res) => {
    const { appointmentId } = req.params;
    const userId = req.user.user_id;
    const userRole = req.user.role;

    let client; // Declare client outside the try block
    try {
        client = await pool.connect(); // Acquire client here
        await client.query('BEGIN'); // Start transaction

        // Find the appointment and check permissions
        const appointmentResult = await client.query(
            `SELECT donor_id, hospital_id FROM appointments WHERE appointment_id = $1 FOR UPDATE`,
            [appointmentId]
        );
        const appointment = appointmentResult.rows[0];

        if (!appointment) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Appointment not found.' });
        }

        // Authorization: Only the donor who booked, the hospital, or a super_admin can delete
        if (userRole === 'super_admin' || appointment.donor_id === userId || appointment.hospital_id === userId) {
            await client.query('DELETE FROM appointments WHERE appointment_id = $1', [appointmentId]);
            await client.query('COMMIT'); // Commit if successful
            res.status(200).json({ message: 'Appointment deleted successfully.' });
        } else {
            await client.query('ROLLBACK'); // Rollback if unauthorized
            return res.status(403).json({ message: 'Unauthorized to delete this appointment.' });
        }
    } catch (error) {
        if (client) { // Only rollback if client was successfully acquired
            await client.query('ROLLBACK');
        }
        console.error('Error deleting appointment:', error.stack);
        res.status(500).json({ message: 'Server error deleting appointment.', error: error.message });
    } finally {
        if (client) { // Always release the client
            client.release();
        }
    }
};


module.exports = {
    createAppointment,
    getDonorAppointments,
    getHospitalAppointments,
    updateAppointmentStatus,
    deleteAppointment
};