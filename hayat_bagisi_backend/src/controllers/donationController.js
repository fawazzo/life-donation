// hayat_bagisi_backend/src/controllers/donationController.js
const pool = require('../config/db');
const { updateHospitalInventoryFromDonation } = require('./hospitalController'); // Import the helper

// Record a new donation (typically by hospital admin)
const recordDonation = async (req, res) => {
    const hospitalId = req.user.user_id; // Hospital admin making the record
    const {
        donor_id,
        appointment_id,
        donation_date,
        blood_type_donated,
        units_donated,
        status,
        deferral_reason,
        blood_need_id
    } = req.body;

    // Input validation (refined for clarity and robustness)
    if (!donor_id || !donation_date || !blood_type_donated || !status) {
        return res.status(400).json({ message: 'Donor ID, donation date, blood type, and status are required.' });
    }
    if (!['successful', 'deferred', 'failed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid donation status.' });
    }
    if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(blood_type_donated)) {
        return res.status(400).json({ message: 'Invalid blood type donated.' });
    }

    // CRUCIAL FIX: Ensure parsedUnitsDonated is an INTEGER
    const parsedUnitsDonated = status === 'successful' ? parseInt(units_donated, 10) : 0;
    if (status === 'successful' && (isNaN(parsedUnitsDonated) || parsedUnitsDonated <= 0)) {
        return res.status(400).json({ message: 'Units donated must be a positive whole number for a successful donation.' });
    }
    if (status !== 'successful' && !deferral_reason) {
        return res.status(400).json({ message: 'Deferral reason is required for deferred/failed donations.' });
    }

    // Ensure integer IDs are actually integers, use null for optional ones
    const parsedDonorId = parseInt(donor_id, 10);
    const parsedAppointmentId = appointment_id ? parseInt(appointment_id, 10) : null;
    const parsedBloodNeedId = blood_need_id ? parseInt(blood_need_id, 10) : null;


    let client; // Declare client outside try block
    try {
        client = await pool.connect(); // Acquire client here
        await client.query('BEGIN');

        // Check for duplicate donation for this appointment (if applicable)
        if (parsedAppointmentId) {
            const existingDonationResult = await client.query(
                `SELECT donation_id FROM donations WHERE appointment_id = $1`,
                [parsedAppointmentId]
            );
            if (existingDonationResult.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    message: `A donation for appointment ID ${parsedAppointmentId} has already been recorded.`,
                    errorCode: 'DUPLICATE_APPOINTMENT_DONATION'
                });
            }
        }

        const result = await client.query(
            `INSERT INTO donations (donor_id, hospital_id, appointment_id, donation_date, blood_type_donated, units_donated, status, deferral_reason, blood_need_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                parsedDonorId,
                hospitalId,
                parsedAppointmentId,
                donation_date,
                blood_type_donated,
                parsedUnitsDonated,
                status,
                deferral_reason || null,
                parsedBloodNeedId
            ]
        );
        const newDonation = result.rows[0];

        // If donation is successful, update donor's last_donation_date AND hospital inventory
        if (newDonation.status === 'successful') {
            await client.query(
                `UPDATE donors SET last_donation_date = $1 WHERE donor_id = $2`,
                [newDonation.donation_date, newDonation.donor_id]
            );

            // Update hospital inventory using the helper function
            await updateHospitalInventoryFromDonation(client, hospitalId, newDonation.blood_type_donated, newDonation.units_donated);

            // If donation fulfills a specific blood_need, update its fulfilled_units
            if (newDonation.blood_need_id) {
                await client.query(
                    `UPDATE blood_needs
                     SET fulfilled_units = fulfilled_units + $1,
                         is_fulfilled = CASE WHEN (fulfilled_units + $1) >= units_needed THEN TRUE ELSE FALSE END,
                         last_updated_at = CURRENT_TIMESTAMP
                     WHERE need_id = $2`,
                    [newDonation.units_donated, newDonation.blood_need_id]
                );
            }
        }

        // Update appointment status if this donation is linked to one
        // Mark as 'completed' whether successful or not, as the appointment has been processed.
        if (parsedAppointmentId) {
            await client.query(
                `UPDATE appointments SET status = 'completed', last_updated_at = CURRENT_TIMESTAMP
                 WHERE appointment_id = $1 AND donor_id = $2 AND hospital_id = $3 AND status = 'scheduled'`,
                [parsedAppointmentId, parsedDonorId, hospitalId]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Donation recorded successfully.', donation: newDonation });

    } catch (error) {
        if (client) { // Only rollback if client was successfully acquired
            await client.query('ROLLBACK');
        }
        console.error('Error recording donation:', error.stack);
        if (error.message.includes('A donation for appointment')) { // Check for custom message
            return res.status(409).json({ message: error.message, errorCode: 'DUPLICATE_APPOINTMENT_DONATION' });
        }
        res.status(500).json({ message: 'Server error recording donation.', error: error.message });
    } finally {
        if (client) { // Always release the client
            client.release();
        }
    }
};

// Get all donations for the authenticated donor
const getDonorDonations = async (req, res) => {
    const donorId = req.user.user_id;

    try {
        const result = await pool.query(
            `SELECT
                d.*,
                h.name AS hospital_name,
                h.address AS hospital_address,
                bn.blood_type AS needed_blood_type,
                bn.urgency_level AS needed_urgency_level
            FROM donations d
            JOIN hospitals h ON d.hospital_id = h.hospital_id
            LEFT JOIN blood_needs bn ON d.blood_need_id = bn.need_id
            WHERE d.donor_id = $1
            ORDER BY d.donation_date DESC`,
            [donorId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching donor donations:', error.stack);
        res.status(500).json({ message: 'Server error fetching donor donations.', error: error.message });
    }
};

// Get all donations recorded by the authenticated hospital
const getHospitalDonations = async (req, res) => {
    const hospitalId = req.user.user_id;

    try {
        const result = await pool.query(
            `SELECT
                d.*,
                dnr.full_name AS donor_name,
                dnr.blood_type AS donor_blood_type,
                dnr.phone_number AS donor_phone_number,
                u.email AS donor_email,
                bn.blood_type AS needed_blood_type,
                bn.urgency_level AS needed_urgency_level
            FROM donations d
            JOIN donors dnr ON d.donor_id = dnr.donor_id
            JOIN users u ON dnr.donor_id = u.user_id
            LEFT JOIN blood_needs bn ON d.blood_need_id = bn.need_id
            WHERE d.hospital_id = $1
            ORDER BY d.donation_date DESC`,
            [hospitalId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching hospital donations:', error.stack);
        res.status(500).json({ message: 'Server error fetching hospital donations.', error: error.message });
    }
};

// Get appointments for a specific hospital (used by HospitalDashboard)
const getHospitalAppointments = async (req, res) => {
    const hospitalId = req.user.user_id;

    try {
        const result = await pool.query(
            `SELECT
                a.*,
                d.full_name AS donor_name,
                d.blood_type AS donor_blood_type,
                u.email AS donor_email,
                d.phone_number AS donor_phone_number,
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

// Update appointment status
const updateAppointmentStatus = async (req, res) => {
    const { appointmentId } = req.params;
    const { status } = req.body;
    const userId = req.user.user_id;
    const userRole = req.user.role; // Add userRole here as it's used in auth

    if (!status || !['scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }

    let client; // Declare client outside the try block
    try {
        client = await pool.connect(); // Acquire client here
        await client.query('BEGIN');

        const appointmentResult = await client.query(
            `SELECT a.hospital_id, a.donor_id, a.status FROM appointments a WHERE appointment_id = $1 FOR UPDATE`,
            [appointmentId]
        );

        if (appointmentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Appointment not found.' });
        }

        const appointment = appointmentResult.rows[0];

        // Authorization logic
        // Hospital admin needs to own the hospital
        if (userRole === 'hospital_admin' && appointment.hospital_id !== userId) {
             await client.query('ROLLBACK');
             return res.status(403).json({ message: 'You are not authorized to manage this appointment.' });
        }
        // Donor needs to own the appointment AND can only cancel/reschedule
        if (userRole === 'donor' && appointment.donor_id !== userId) {
             await client.query('ROLLBACK');
             return res.status(403).json({ message: 'You are not authorized to manage this appointment.' });
        }
        if (userRole === 'donor' && (status === 'completed' || status === 'no_show')) {
             await client.query('ROLLBACK');
             return res.status(403).json({ message: 'Donors cannot set this status.' });
        }

        const result = await client.query(
            `UPDATE appointments SET status = $1, last_updated_at = CURRENT_TIMESTAMP WHERE appointment_id = $2 RETURNING *`,
            [status, appointmentId]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: 'Appointment status updated successfully.', appointment: result.rows[0] });

    } catch (error) { // This now catches both pool.connect() and query errors
        if (client) { // Only attempt rollback if a client connection was successfully obtained
            await client.query('ROLLBACK');
        }
        console.error('Error updating appointment status:', error.stack);
        res.status(500).json({ message: 'Server error updating appointment status.', error: error.message });
    } finally {
        if (client) { // Only release if client was assigned
            client.release();
        }
    }
};


// Endpoint for hospital admin to search for donors (by email, name, phone)
const searchDonorsForHospital = async (req, res) => {
    const { q } = req.query;
    // No need for hospitalId in query, as it's a general donor search for any hospital admin
    // if (!req.user || req.user.role !== 'hospital_admin') { // This check is handled by middleware
    //     return res.status(403).json({ message: 'Access denied.' });
    // }

    if (!q || q.trim().length < 2) {
        return res.status(400).json({ message: 'Search query must be at least 2 characters.' });
    }

    const searchQuery = `%${q.trim().toLowerCase()}%`;

    try {
        const result = await pool.query(
            `SELECT
                u.user_id,
                u.email,
                d.full_name,
                d.blood_type,
                d.phone_number
             FROM users u
             JOIN donors d ON u.user_id = d.donor_id
             WHERE u.role = 'donor' AND (
                LOWER(u.email) LIKE $1 OR
                LOWER(d.full_name) LIKE $1 OR
                LOWER(d.phone_number) LIKE $1
             )
             LIMIT 10`,
            [searchQuery]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error searching donors:', error.stack);
        res.status(500).json({ message: 'Server error searching donors.', error: error.message });
    }
};


// For Donor to book an appointment
const bookAppointment = async (req, res) => {
    const donorId = req.user.user_id; // Donor making the appointment
    const { hospital_id, appointment_date_time, blood_need_id, notes } = req.body;

    if (!hospital_id || !appointment_date_time) {
        return res.status(400).json({ message: 'Hospital ID and appointment date/time are required.' });
    }
    // Basic date validation
    if (new Date(appointment_date_time) < new Date()) {
        return res.status(400).json({ message: 'Appointment date/time cannot be in the past.' });
    }

    // Ensure IDs are parsed as integers, notes can be null
    const parsedHospitalId = parseInt(hospital_id, 10);
    const parsedBloodNeedId = blood_need_id ? parseInt(blood_need_id, 10) : null;
    const appointmentNotes = notes || null; // Use null if notes are empty

    try {
        // --- CRUCIAL FIX: ADD 'status' COLUMN AND VALUE TO INSERT ---
        const result = await pool.query(
            `INSERT INTO appointments (donor_id, hospital_id, appointment_date_time, blood_need_id, notes, status)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                donorId,
                parsedHospitalId,
                appointment_date_time,
                parsedBloodNeedId,
                appointmentNotes,
                'scheduled' // <--- DEFAULT STATUS FOR NEW APPOINTMENT IS 'scheduled'
            ]
        );
        res.status(201).json({ message: 'Appointment booked successfully.', appointment: result.rows[0] });
    } catch (error) {
        console.error('Error booking appointment:', error.stack);
        // Check for specific unique constraint errors if you add them (e.g., donor can't book same slot twice)
        res.status(500).json({ message: 'Server error booking appointment.', error: error.message });
    }
};

// Get appointments for the authenticated donor
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


module.exports = {
    recordDonation,
    getDonorDonations,
    getHospitalDonations,
    getHospitalAppointments,
    updateAppointmentStatus,
    searchDonorsForHospital,
    bookAppointment,
    getDonorAppointments
};