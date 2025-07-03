// hayat_bagisi_backend/src/controllers/donorController.js
const pool = require('../config/db'); // Assumed to be your database connection pool

// Get donor profile
const getDonorProfile = async (req, res) => {
    // req.user is set by authenticateToken middleware
    const donorId = req.user.user_id;
    const userRole = req.user.role;

    if (userRole !== 'donor') {
        return res.status(403).json({ message: 'Access denied. Only donors can view their profile.' });
    }

    try {
        const result = await pool.query(
            `SELECT
                u.email,
                u.created_at,
                u.last_login_at,
                u.is_active,
                d.full_name,
                d.blood_type,
                d.phone_number,
                ST_X(d.location::geometry) AS longitude,
                ST_Y(d.location::geometry) AS latitude,
                d.last_donation_date,
                d.is_available_for_alerts,
                d.preferred_contact_method
             FROM users u
             JOIN donors d ON u.user_id = d.donor_id
             WHERE u.user_id = $1`,
            [donorId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Donor profile not found.' });
        }

        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error('Error fetching donor profile:', error.stack);
        res.status(500).json({ message: 'Server error fetching donor profile.' });
    }
};

// Update donor profile
const updateDonorProfile = async (req, res) => {
    const donorId = req.user.user_id; // From authenticated token
    const userRole = req.user.role;

    if (userRole !== 'donor') {
        return res.status(403).json({ message: 'Access denied. Only donors can update their profile.' });
    }

    const { full_name, blood_type, phone_number, latitude, longitude, is_available_for_alerts, preferred_contact_method } = req.body;

    try {
        const updateFields = [];
        const queryParams = [donorId];
        let paramIndex = 2; // Start from $2 as $1 is donorId

        if (full_name !== undefined) { updateFields.push(`full_name = $${paramIndex++}`); queryParams.push(full_name); }
        if (blood_type !== undefined) { updateFields.push(`blood_type = $${paramIndex++}`); queryParams.push(blood_type); }
        if (phone_number !== undefined) { updateFields.push(`phone_number = $${paramIndex++}`); queryParams.push(phone_number); }
        if (latitude !== undefined && longitude !== undefined) {
            updateFields.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex++}, $${paramIndex++}), 4326)`);
            queryParams.push(longitude, latitude); // ST_MakePoint is (longitude, latitude)
        }
        if (is_available_for_alerts !== undefined) { updateFields.push(`is_available_for_alerts = $${paramIndex++}`); queryParams.push(is_available_for_alerts); }
        if (preferred_contact_method !== undefined) { updateFields.push(`preferred_contact_method = $${paramIndex++}`); queryParams.push(preferred_contact_method); }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'No fields provided for update.' });
        }

        const query = `UPDATE donors SET ${updateFields.join(', ')} WHERE donor_id = $1 RETURNING *`;
        const result = await pool.query(query, queryParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Donor not found or no changes made.' });
        }

        res.status(200).json({ message: 'Donor profile updated successfully.', donor: result.rows[0] });

    } catch (error) {
        console.error('Error updating donor profile:', error.stack);
        res.status(500).json({ message: 'Server error updating donor profile.' });
    }
};

// NEW: Search Donors
const searchDonors = async (req, res) => {
    // You can add more search parameters like bloodType, location, etc.
    const { q, bloodType, location, availability } = req.query; // 'q' for general query, others for specific filters

    // At least one search parameter should be present
    if (!q && !bloodType && !location && !availability) {
        return res.status(400).json({ message: 'At least one search parameter (q, bloodType, location, or availability) is required.' });
    }

    try {
        let queryText = `
            SELECT
                u.user_id,
                u.email,
                d.full_name,
                d.blood_type,
                d.phone_number,
                ST_X(d.location::geometry) AS longitude,
                ST_Y(d.location::geometry) AS latitude,
                d.last_donation_date,
                d.is_available_for_alerts
            FROM users u
            JOIN donors d ON u.user_id = d.donor_id
            WHERE u.is_active = TRUE -- Only search for active users
        `;
        const queryParams = [];
        let paramIndex = 1;

        if (q) {
            // Search by full name (case-insensitive)
            queryText += ` AND LOWER(d.full_name) LIKE $${paramIndex++}`;
            queryParams.push(`%${q.toLowerCase()}%`);
        }
        if (bloodType) {
            queryText += ` AND d.blood_type = $${paramIndex++}`;
            queryParams.push(bloodType);
        }
        if (location) {
            // NOTE: For 'location', you'd typically have a specific column (e.g., 'city', 'address_part')
            // or perform spatial queries using ST_Distance on your 'location' (Point) column.
            // This example is a placeholder. Adapt based on your actual 'donors' table schema.
            // Example if you have a 'city' column:
            // queryText += ` AND LOWER(d.city) LIKE $${paramIndex++}`;
            // queryParams.push(`%${location.toLowerCase()}%`);
            // If you intend to search by proximity, it would be a more complex spatial query.
        }
        if (availability !== undefined) {
             queryText += ` AND d.is_available_for_alerts = $${paramIndex++}`;
             // Convert string 'true'/'false' from query to boolean for the database
             queryParams.push(availability === 'true');
        }

        // Add ORDER BY or LIMIT if needed for performance or specific ordering
        queryText += ` ORDER BY d.full_name ASC`;


        const result = await pool.query(queryText, queryParams);

        // It's common to return an empty array for a search if no results are found,
        // rather than a 404, which typically means the endpoint itself wasn't found.
        res.status(200).json(result.rows);

    } catch (error) {
        console.error('Error searching donors:', error.stack);
        res.status(500).json({ message: 'Server error during donor search.' });
    }
};

module.exports = {
    getDonorProfile,
    updateDonorProfile,
    searchDonors // <-- Export the new function
};