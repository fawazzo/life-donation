// hayat_bagisi_backend/src/config/db.js
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    // Optional: Add a connection timeout
    connectionTimeoutMillis: 5000, // 5 seconds
});

module.exports = pool;