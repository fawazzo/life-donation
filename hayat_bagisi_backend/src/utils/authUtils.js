// hayat_bagisi_backend/src/utils/authUtils.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret'; // Ensure this matches .env

// Hash a password
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10); // Generate a salt
    return bcrypt.hash(password, salt); // Hash the password with the salt
};

// Compare a password with a hashed password
const comparePassword = async (password, hashedPassword) => {
    return bcrypt.compare(password, hashedPassword);
};

// Generate a JWT token
const generateToken = (payload) => {
    // Payload should contain non-sensitive user info (e.g., user_id, role)
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
};

// Verify a JWT token
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null; // Token is invalid or expired
    }
};

module.exports = {
    hashPassword,
    comparePassword,
    generateToken,
    verifyToken
};