// hayat_bagisi_backend/server.js
require('dotenv').config(); // Load environment variables first

// Import the main Express app instance where all routes are defined
const app = require('./src/app');
// Import the centralized database connection pool
const pool = require('./src/config/db');

const PORT = process.env.PORT || 5000;

// Test Database Connection
// This ensures your database connection is verified when the server starts
pool.connect((err, client, release) => {
    if (err) {
        // If there's an error connecting to the DB, log it and possibly exit or gracefully handle
        return console.error('Error acquiring client for DB connection test:', err.stack);
    }
    console.log('Connected to PostgreSQL database!');
    release(); // Release the client back to the pool immediately after testing
});

// Start the server
// The `app` imported from './src/app' contains all your middleware and defined routes.
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});