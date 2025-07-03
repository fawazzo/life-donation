// hayat_bagisi_backend/src/controllers/authController.js
const pool = require('../config/db');
const { hashPassword, comparePassword, generateToken } = require('../utils/authUtils');

// User Registration (Signup)
const register = async (req, res) => {
    // Ensure phoneNumber is destructured from req.body, as frontend sends it
    const { email, password, role, fullName, bloodType, phoneNumber, latitude, longitude, hospitalName, address } = req.body;

    // Basic input validation
    if (!email || !password || !role) {
        return res.status(400).json({ message: 'Email, password, and role are required.' });
    }
    if (!['donor', 'hospital_admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified.' });
    }

    try {
        // 1. Check if user already exists
        const userExists = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(409).json({ message: 'User with this email already exists.' });
        }

        // 2. Hash password
        const hashedPassword = await hashPassword(password);

        // 3. Start a transaction for atomicity
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Insert into users table
            const userResult = await client.query(
                'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING user_id',
                [email, hashedPassword, role]
            );
            const userId = userResult.rows[0].user_id;

            // Insert into specific role table
            if (role === 'donor') {
                if (!fullName || !bloodType || !latitude || !longitude) {
                    throw new Error('Full name, blood type, latitude, and longitude are required for donor registration.');
                }
                // For donors, `phoneNumber` is optional in DB, so it's handled by `phoneNumber` variable (which might be null)
                await client.query(
                    'INSERT INTO donors (donor_id, full_name, blood_type, phone_number, location) VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326))',
                    [userId, fullName, bloodType, phoneNumber, longitude, latitude] // `phoneNumber` passed here
                );
            } else if (role === 'hospital_admin') {
                // *** CRUCIAL FIX HERE: ADD `phoneNumber` to validation and INSERT query ***
                if (!hospitalName || !address || !phoneNumber || !latitude || !longitude) { // <--- ADDED phoneNumber TO VALIDATION
                    throw new Error('Hospital name, address, phone number, latitude, and longitude are required for hospital registration.');
                }
                await client.query(
                    'INSERT INTO hospitals (hospital_id, name, address, phone_number, location) VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326))', // <--- ADDED phone_number COLUMN
                    [userId, hospitalName, address, phoneNumber, longitude, latitude] // <--- ADDED phoneNumber VALUE
                );
            }

            await client.query('COMMIT');
            res.status(201).json({ message: 'Registration successful!', user_id: userId, role });

        } catch (error) {
            await client.query('ROLLBACK'); // Rollback transaction on error
            console.error('Registration failed during transaction:', error.message);
            // Ensure this error message is clear for the frontend
            res.status(500).json({ message: `Registration failed: ${error.message}` });
        } finally {
            client.release(); // Release client back to pool
        }

    } catch (error) {
        console.error('Error during registration:', error.stack);
        res.status(500).json({ message: 'Server error during registration.' });
    }
};

// User Login
const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        // 1. Find user by email
        const userResult = await pool.query('SELECT user_id, password_hash, role, is_active FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        if (!user.is_active) {
            return res.status(403).json({ message: 'Your account is inactive. Please contact support.' });
        }

        // 2. Compare password
        const isMatch = await comparePassword(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // 3. Generate JWT token
        const token = generateToken({ user_id: user.user_id, role: user.role });

        // Update last_login_at
        await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1', [user.user_id]);

        res.status(200).json({
            message: 'Login successful!',
            token,
            user: {
                user_id: user.user_id,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Error during login:', error.stack);
        res.status(500).json({ message: 'Server error during login.' });
    }
};


module.exports = {
    register,
    login
};