// hayat_bagisi_backend/src/controllers/publicController.js
const pool = require('../config/db');

// Get all active blood needs (optionally filtered by blood type, sorted by proximity)
const getActiveBloodNeeds = async (req, res) => {
    const { bloodType, maxDistanceKm } = req.query; // Filters
    const user = req.user; // Authenticated user info (donor_id, role, etc.)

    try {
        let query = `
            SELECT
                bn.*,
                h.name AS hospital_name,
                h.address AS hospital_address,
                ST_X(h.location::geometry) AS hospital_longitude,
                ST_Y(h.location::geometry) AS hospital_latitude,
                ST_Distance(d.location, h.location) AS distance_meters
            FROM blood_needs bn
            JOIN hospitals h ON bn.hospital_id = h.hospital_id
            LEFT JOIN donors d ON d.donor_id = $1 -- Join donor to calculate distance
            WHERE bn.is_fulfilled = FALSE
              AND (bn.expires_at IS NULL OR bn.expires_at > NOW())
        `;
        const queryParams = [user.user_id]; // First param is always donor_id for distance calculation
        let paramIndex = 2;

        if (bloodType) {
            query += ` AND bn.blood_type = $${paramIndex++}`;
            queryParams.push(bloodType);
        }

        // Add proximity filter only if maxDistanceKm is provided and user is a donor
        if (user.role === 'donor' && maxDistanceKm) {
            query += `
                AND ST_DWithin(d.location, h.location, $${paramIndex++} * 1000) -- distance in meters
            `;
            queryParams.push(parseFloat(maxDistanceKm));
        }

        // Order by urgency and then by distance for donors, or just urgency/posted_at for others
        if (user.role === 'donor') {
             query += ` ORDER BY
                CASE bn.urgency_level
                    WHEN 'critical' THEN 1
                    WHEN 'urgent' THEN 2
                    WHEN 'normal' THEN 3
                    ELSE 4
                END,
                ST_Distance(d.location, h.location) ASC, -- Sort by distance for donors
                bn.posted_at DESC;
            `;
        } else {
             query += ` ORDER BY
                CASE bn.urgency_level
                    WHEN 'critical' THEN 1
                    WHEN 'urgent' THEN 2
                    WHEN 'normal' THEN 3
                    ELSE 4
                END,
                bn.posted_at DESC;
            `;
        }


        const result = await pool.query(query, queryParams);
        res.status(200).json(result.rows);

    } catch (error) {
        console.error('Error fetching blood needs:', error.stack);
        res.status(500).json({ message: 'Server error fetching blood needs.', error: error.message });
    }
};

// Get a single blood need by ID
const getBloodNeedById = async (req, res) => {
    const { needId } = req.params;
    const user = req.user; // Authenticated user for potential distance calculation

    try {
        let query = `
            SELECT
                bn.*,
                h.name AS hospital_name,
                h.address AS hospital_address,
                ST_X(h.location::geometry) AS hospital_longitude,
                ST_Y(h.location::geometry) AS hospital_latitude
        `;
        const queryParams = [needId];

        if (user && user.role === 'donor') {
            // Include distance if the user is a donor
            query += `, ST_Distance(d.location, h.location) AS distance_meters
                        FROM blood_needs bn
                        JOIN hospitals h ON bn.hospital_id = h.hospital_id
                        LEFT JOIN donors d ON d.donor_id = $2 -- Join donor to calculate distance
                        WHERE bn.need_id = $1`;
            queryParams.push(user.user_id);
        } else {
             query += `
                        FROM blood_needs bn
                        JOIN hospitals h ON bn.hospital_id = h.hospital_id
                        WHERE bn.need_id = $1`;
        }


        const result = await pool.query(query, queryParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Blood need not found.' });
        }

        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error('Error fetching blood need by ID:', error.stack);
        res.status(500).json({ message: 'Server error fetching blood need.', error: error.message });
    }
};


module.exports = {
    getActiveBloodNeeds,
    getBloodNeedById
};