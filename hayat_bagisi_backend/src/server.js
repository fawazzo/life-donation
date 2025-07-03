// hayat_bagisi_backend/server.js
require('dotenv').config(); // Load environment variables first

const app = require('./src/app'); // Import the Express app from src/app.js
const pool = require('./src/config/db'); // Import the DB pool

const PORT = process.env.PORT || 5000;

// Test Database Connection
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    console.log('Connected to PostgreSQL database!');
    release(); // Release the client back to the pool
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});