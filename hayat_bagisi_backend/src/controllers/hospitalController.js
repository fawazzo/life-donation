// hayat_bagisi_backend/src/controllers/hospitalController.js
const pool = require('../config/db');
const { sendBloodNeedNotifications } = require('../utils/notificationService');

// --- Helper Function: Update Hospital Inventory From Donation (Defined ONCE at the top) ---
// This function is designed to be called by other controllers (like donationController)
// It operates within a client transaction that the calling function has initiated.
const updateHospitalInventoryFromDonation = async (client, hospitalId, bloodType, unitsChange) => {
    try {
        // Find existing inventory record or create if not exists
        let inventoryRecord = await client.query(
            `SELECT units_in_stock FROM hospital_inventories WHERE hospital_id = $1 AND blood_type = $2 FOR UPDATE`, // Locks the row
            [hospitalId, bloodType]
        );

        let newUnitsInStock;
        if (inventoryRecord.rows.length > 0) {
            const currentStock = inventoryRecord.rows[0].units_in_stock;
            newUnitsInStock = currentStock + unitsChange;

            if (newUnitsInStock < 0) {
                throw new Error('Cannot deduct more units than available in stock.');
            }

            await client.query(
                `UPDATE hospital_inventories
                 SET units_in_stock = $1, last_updated_at = CURRENT_TIMESTAMP
                 WHERE hospital_id = $2 AND blood_type = $3`,
                [newUnitsInStock, hospitalId, bloodType]
            );
        } else {
            // Create new record if blood type not in inventory and adding units
            if (unitsChange < 0) {
                throw new Error('Cannot deduct units from a non-existent inventory type.');
            }
            newUnitsInStock = unitsChange;
            await client.query(
                `INSERT INTO hospital_inventories (hospital_id, blood_type, units_in_stock)
                 VALUES ($1, $2, $3)`,
                [hospitalId, bloodType, newUnitsInStock]
            );
        }
        console.log(`[Inventory Update] Hospital ${hospitalId}, Blood Type ${bloodType} updated to ${newUnitsInStock} units.`);
        return newUnitsInStock; // Return the new stock level
    } catch (error) {
        console.error('Error updating hospital inventory within transaction:', error.stack);
        throw error; // Re-throw to propagate error and trigger rollback
    }
};


// --- Blood Need Management ---

// Create a new blood need
const createBloodNeed = async (req, res) => {
    const hospitalId = req.user.user_id;
    const { blood_type, units_needed, urgency_level, details, expires_at } = req.body;

    if (!blood_type || !units_needed || !urgency_level) {
        return res.status(400).json({ message: 'Blood type, units needed, and urgency level are required.' });
    }
    if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(blood_type)) {
        return res.status(400).json({ message: 'Invalid blood type.' });
    }
    if (units_needed <= 0) {
        return res.status(400).json({ message: 'Units needed must be a positive number.' });
    }
    if (!['critical', 'urgent', 'normal'].includes(urgency_level)) {
        return res.status(400).json({ message: 'Invalid urgency level.' });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(
                `INSERT INTO blood_needs (hospital_id, blood_type, units_needed, urgency_level, details, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [hospitalId, blood_type, units_needed, urgency_level, details, expires_at]
            );

            const newNeed = result.rows[0];

            const hospitalResult = await client.query('SELECT ST_X(location::geometry) AS longitude, ST_Y(location::geometry) AS latitude FROM hospitals WHERE hospital_id = $1', [hospitalId]);
            const hospitalLocation = hospitalResult.rows[0];

            if (newNeed.urgency_level === 'critical' || newNeed.urgency_level === 'urgent') {
                sendBloodNeedNotifications(newNeed.need_id, newNeed.blood_type, hospitalLocation, newNeed.urgency_level)
                    .catch(err => console.error("Error triggering notifications asynchronously:", err));
            }

            await client.query('COMMIT');
            res.status(201).json({ message: 'Blood need posted successfully.', need: newNeed });

        } catch (transactionError) {
            await client.query('ROLLBACK');
            console.error('Error in createBloodNeed transaction:', transactionError.stack);
            res.status(500).json({ message: 'Server error posting blood need during transaction.', error: transactionError.message });
        } finally {
                client.release();
        }

    } catch (error) {
        console.error('Error connecting to DB for createBloodNeed:', error.stack);
        res.status(500).json({ message: 'Server error posting blood need.', error: error.message });
    }
};

// Get all blood needs posted by the authenticated hospital
const getHospitalBloodNeeds = async (req, res) => {
    const hospitalId = req.user.user_id;

    try {
        const result = await pool.query(
            `SELECT * FROM blood_needs
             WHERE hospital_id = $1
             ORDER BY posted_at DESC`,
            [hospitalId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching hospital blood needs:', error.stack);
        res.status(500).json({ message: 'Server error fetching hospital blood needs.', error: error.message });
    }
};

// Update a specific blood need (e.g., fulfill units, change status)
const updateBloodNeed = async (req, res) => {
    const hospitalId = req.user.user_id;
    const { needId } = req.params;
    const { units_needed, urgency_level, details, expires_at, is_fulfilled, fulfilled_units } = req.body;

    try {
        const existingNeed = await pool.query('SELECT hospital_id FROM blood_needs WHERE need_id = $1', [needId]);
        if (existingNeed.rows.length === 0 || existingNeed.rows[0].hospital_id !== hospitalId) {
            return res.status(404).json({ message: 'Blood need not found or you do not have permission to update it.' });
        }

        const updateFields = [];
        const queryParams = [needId];
        let paramIndex = 2;

        if (units_needed !== undefined) { updateFields.push(`units_needed = $${paramIndex++}`); queryParams.push(units_needed); }
        if (urgency_level !== undefined) { updateFields.push(`urgency_level = $${paramIndex++}`); queryParams.push(urgency_level); }
        if (details !== undefined) { updateFields.push(`details = $${paramIndex++}`); queryParams.push(details); }
        if (expires_at !== undefined) { updateFields.push(`expires_at = $${paramIndex++}`); queryParams.push(expires_at); }
        if (is_fulfilled !== undefined) { updateFields.push(`is_fulfilled = $${paramIndex++}`); queryParams.push(is_fulfilled); }
        if (fulfilled_units !== undefined) { updateFields.push(`fulfilled_units = $${paramIndex++}`); queryParams.push(fulfilled_units); }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'No fields provided for update.' });
        }

        updateFields.push(`last_updated_at = CURRENT_TIMESTAMP`);

        const query = `UPDATE blood_needs SET ${updateFields.join(', ')} WHERE need_id = $1 RETURNING *`;
        const result = await pool.query(query, queryParams);

        res.status(200).json({ message: 'Blood need updated successfully.', need: result.rows[0] });

    } catch (error) {
        console.error('Error updating blood need:', error.stack);
        res.status(500).json({ message: 'Server error updating blood need.', error: error.message });
    }
};

// Delete a blood need
const deleteBloodNeed = async (req, res) => {
    const hospitalId = req.user.user_id;
    const { needId } = req.params;

    try {
        const existingNeed = await pool.query('SELECT hospital_id FROM blood_needs WHERE need_id = $1', [needId]);
        if (existingNeed.rows.length === 0 || existingNeed.rows[0].hospital_id !== hospitalId) {
            return res.status(404).json({ message: 'Blood need not found or you do not have permission to delete it.' });
        }

        await pool.query('DELETE FROM blood_needs WHERE need_id = $1', [needId]);
        res.status(200).json({ message: 'Blood need deleted successfully.' });
    } catch (error) {
        console.error('Error deleting blood need:', error.stack);
        res.status(500).json({ message: 'Server error deleting blood need.', error: error.message });
    }
};

// --- Hospital Profile Management ---
const getHospitalProfile = async (req, res) => {
    const hospitalId = req.user.user_id;
    const userRole = req.user.role;

    if (userRole !== 'hospital_admin') {
        return res.status(403).json({ message: 'Access denied. Only hospital admins can view their profile.' });
    }

    try {
        const result = await pool.query(
            `SELECT
                u.email,
                u.created_at,
                u.last_login_at,
                u.is_active,
                h.name,
                h.address,
                ST_X(h.location::geometry) AS longitude,
                ST_Y(h.location::geometry) AS latitude,
                h.phone_number,
                h.contact_person,
                h.contact_email
             FROM users u
             JOIN hospitals h ON u.user_id = h.hospital_id
             WHERE u.user_id = $1`,
            [hospitalId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Hospital profile not found.' });
        }

        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error('Error fetching hospital profile:', error.stack);
        res.status(500).json({ message: 'Server error fetching hospital profile.' });
    }
};

const updateHospitalProfile = async (req, res) => {
    const hospitalId = req.user.user_id;
    const userRole = req.user.role;

    if (userRole !== 'hospital_admin') {
        return res.status(403).json({ message: 'Access denied. Only hospital admins can update their profile.' });
    }

    const { name, address, latitude, longitude, phone_number, contact_person, contact_email } = req.body;

    try {
        const updateFields = [];
        const queryParams = [hospitalId];
        let paramIndex = 2;

        if (name !== undefined) { updateFields.push(`name = $${paramIndex++}`); queryParams.push(name); }
        if (address !== undefined) { updateFields.push(`address = $${paramIndex++}`); queryParams.push(address); }
        if (latitude !== undefined && longitude !== undefined) {
            updateFields.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex++}, $${paramIndex++}), 4326)`);
            queryParams.push(longitude, latitude);
        }
        if (phone_number !== undefined) { updateFields.push(`phone_number = $${paramIndex++}`); queryParams.push(phone_number); }
        if (contact_person !== undefined) { updateFields.push(`contact_person = $${paramIndex++}`); queryParams.push(contact_person); }
        if (contact_email !== undefined) { updateFields.push(`contact_email = $${paramIndex++}`); queryParams.push(contact_email); }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'No fields provided for update.' });
        }

        const query = `UPDATE hospitals SET ${updateFields.join(', ')} WHERE hospital_id = $1 RETURNING *`;
        const result = await pool.query(query, queryParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Hospital not found or no changes made.' });
        }

        res.status(200).json({ message: 'Hospital profile updated successfully.', hospital: result.rows[0] });

    } catch (error) {
        console.error('Error updating hospital profile:', error.stack);
        res.status(500).json({ message: 'Server error updating hospital profile.' });
    }
};

// --- Hospital Inventory Management ---

// Get current inventory levels for the authenticated hospital
const getHospitalInventory = async (req, res) => {
    const hospitalId = req.user.user_id;

    try {
        const result = await pool.query(
            `SELECT inventory_id, blood_type, units_in_stock, last_updated_at
             FROM hospital_inventories
             WHERE hospital_id = $1
             ORDER BY blood_type`,
            [hospitalId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching hospital inventory:', error.stack);
        res.status(500).json({ message: 'Server error fetching hospital inventory.', error: error.message });
    }
};

// Update (add/subtract) units in stock for a specific blood type
const updateHospitalInventory = async (req, res) => {
    const hospitalId = req.user.user_id;
    const { blood_type, units_change } = req.body; // units_change can be positive (add) or negative (subtract)

    if (!blood_type || units_change === undefined) {
        return res.status(400).json({ message: 'Blood type and units change are required.' });
    }
    if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(blood_type)) {
        return res.status(400).json({ message: 'Invalid blood type.' });
    }
    if (typeof units_change !== 'number' || !Number.isInteger(units_change)) {
        return res.status(400).json({ message: 'Units change must be an integer.' });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // This now calls the internal helper function
            const newUnitsInStock = await updateHospitalInventoryFromDonation(client, hospitalId, blood_type, units_change);

            await client.query('COMMIT');
            res.status(200).json({ message: 'Inventory updated successfully.', blood_type, new_units_in_stock: newUnitsInStock });

        } catch (transactionError) {
            await client.query('ROLLBACK');
            console.error('Error updating hospital inventory in transaction:', transactionError.stack);
            res.status(500).json({ message: 'Server error updating inventory during transaction.', error: transactionError.message });
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error connecting to DB for inventory update:', error.stack);
        res.status(500).json({ message: 'Server error updating inventory.', error: error.message });
    }
};


module.exports = {
    createBloodNeed,
    getHospitalBloodNeeds,
    updateBloodNeed,
    deleteBloodNeed,
    getHospitalProfile,
    updateHospitalProfile,
    getHospitalInventory,
    updateHospitalInventory,
    updateHospitalInventoryFromDonation // Ensure it's exported
};