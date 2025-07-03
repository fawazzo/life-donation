// hayat_bagisi_backend/src/middleware/authMiddleware.js
const { verifyToken } = require('../utils/authUtils');
const pool = require('../config/db');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expects 'Bearer TOKEN'

    if (token == null) {
        return res.status(401).json({ message: 'Authentication token required.' });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }

    // Attach user information from the token to the request object
    req.user = decoded; // { user_id, role, etc. }
    next(); // Proceed to the next middleware or route handler
};

// Middleware to check if the user has a specific role
const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied. Insufficient role permissions.' });
        }
        next();
    };
};

module.exports = {
    authenticateToken,
    authorizeRole
};