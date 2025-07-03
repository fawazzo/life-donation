// hayat_bagisi_backend/src/app.js
const express = require('express');
const cors = require('cors');

// --- Import your routes here ---
const authRoutes = require('./routes/authRoutes');
const donorRoutes = require('./routes/donorRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const publicRoutes = require('./routes/publicRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const donationRoutes = require('./routes/donationRoutes');
// --- End Route Imports ---

const app = express();

// --- Middleware ---
app.use(cors()); // Enable CORS for all origins (for development)
app.use(express.json()); // Parse JSON request bodies
// --- End Middleware ---

// Basic Root Route (often used for health checks or basic API info)
app.get('/', (req, res) => {
    res.send('Hayat Bağışı Backend API is running!');
});

// --- API Routes ---
// Mount your imported routes here
app.use('/api/auth', authRoutes);
app.use('/api/donors', donorRoutes); // All donor-specific routes will be prefixed with /api/donors
app.use('/api/hospitals', hospitalRoutes);
app.use('/api', publicRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/donations', donationRoutes);

// --- End API Routes ---

// --- Error Handling Middleware ---
// This should be the LAST middleware in your chain.
// It catches any errors thrown by previous middleware or route handlers.
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the stack trace for debugging
    res.status(500).json({ message: 'Something broke on the server!', error: err.message }); // Send a generic error response
});
// --- End Error Handling Middleware ---

module.exports = app;