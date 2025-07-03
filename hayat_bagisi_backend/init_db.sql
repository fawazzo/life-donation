-- Disable notices for dropping non-existent objects
SET client_min_messages TO WARNING;

-- Drop tables in reverse order of dependency to avoid foreign key conflicts
DROP TABLE IF EXISTS user_badges CASCADE;
DROP TABLE IF EXISTS badges CASCADE;
DROP TABLE IF EXISTS educational_resources CASCADE;
DROP TABLE IF EXISTS donations CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS blood_needs CASCADE;
DROP TABLE IF EXISTS hospital_inventories CASCADE; -- NEW: Added to drop order
DROP TABLE IF EXISTS hospitals CASCADE;
DROP TABLE IF EXISTS donors CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Re-enable notices
SET client_min_messages TO NOTICE;

-- Enable PostGIS extension (only needs to be done once per database)
-- This allows for geographic data types and functions
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. users Table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('donor', 'hospital_admin', 'super_admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Index for quick email lookup (for login)
CREATE INDEX idx_users_email ON users (email);

-- 2. donors Table
CREATE TABLE donors (
    donor_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    blood_type VARCHAR(10) NOT NULL CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    phone_number VARCHAR(20) UNIQUE,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    last_donation_date DATE,
    is_available_for_alerts BOOLEAN DEFAULT TRUE,
    preferred_contact_method VARCHAR(50) DEFAULT 'email' CHECK (preferred_contact_method IN ('email', 'sms'))
);

-- GiST index for efficient spatial queries on donor locations (PostGIS)
CREATE INDEX idx_donors_location ON donors USING GIST (location);
CREATE INDEX idx_donors_blood_type ON donors (blood_type);
CREATE INDEX idx_donors_phone_number ON donors (phone_number);

-- 3. hospitals Table
CREATE TABLE hospitals (
    hospital_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    contact_person VARCHAR(255),
    contact_email VARCHAR(255)
);

-- GiST index for efficient spatial queries on hospital locations (PostGIS)
CREATE INDEX idx_hospitals_location ON hospitals USING GIST (location);
CREATE INDEX idx_hospitals_name ON hospitals (name);

-- 3a. hospital_inventories Table (NEW TABLE)
CREATE TABLE hospital_inventories (
    inventory_id SERIAL PRIMARY KEY,
    hospital_id INTEGER NOT NULL REFERENCES hospitals(hospital_id) ON DELETE CASCADE,
    blood_type VARCHAR(10) NOT NULL CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    units_in_stock INTEGER NOT NULL DEFAULT 0 CHECK (units_in_stock >= 0),
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (hospital_id, blood_type) -- Ensures only one entry per blood type per hospital
);

-- Indexes for efficient lookup of hospital inventories
CREATE INDEX idx_hospital_inventories_hospital_id ON hospital_inventories (hospital_id);
CREATE INDEX idx_hospital_inventories_blood_type ON hospital_inventories (blood_type);


-- 4. blood_needs Table
CREATE TABLE blood_needs (
    need_id SERIAL PRIMARY KEY,
    hospital_id INTEGER NOT NULL REFERENCES hospitals(hospital_id) ON DELETE CASCADE,
    blood_type VARCHAR(10) NOT NULL CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    units_needed INTEGER NOT NULL CHECK (units_needed > 0),
    urgency_level VARCHAR(50) NOT NULL CHECK (urgency_level IN ('critical', 'urgent', 'normal')),
    details TEXT,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_fulfilled BOOLEAN DEFAULT FALSE,
    fulfilled_units INTEGER DEFAULT 0 CHECK (fulfilled_units >= 0),
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient lookup of blood needs
CREATE INDEX idx_blood_needs_hospital_id ON blood_needs (hospital_id);
CREATE INDEX idx_blood_needs_blood_type ON blood_needs (blood_type);
CREATE INDEX idx_blood_needs_is_fulfilled ON blood_needs (is_fulfilled);
CREATE INDEX idx_blood_needs_urgency_level ON blood_needs (urgency_level);

-- 5. notifications Table
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    donor_id INTEGER NOT NULL REFERENCES donors(donor_id) ON DELETE CASCADE,
    need_id INTEGER REFERENCES blood_needs(need_id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'sms')),
    message TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'failed', 'delivered', 'read', 'clicked'))
);

CREATE INDEX idx_notifications_donor_id ON notifications (donor_id);
CREATE INDEX idx_notifications_sent_at ON notifications (sent_at);
CREATE INDEX idx_notifications_type ON notifications (type);

-- 6. appointments Table
CREATE TABLE appointments (
    appointment_id SERIAL PRIMARY KEY,
    donor_id INTEGER NOT NULL REFERENCES donors(donor_id) ON DELETE CASCADE,
    hospital_id INTEGER NOT NULL REFERENCES hospitals(hospital_id) ON DELETE CASCADE,
    blood_need_id INTEGER REFERENCES blood_needs(need_id) ON DELETE SET NULL,
    appointment_date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_appointments_donor_id ON appointments (donor_id);
CREATE INDEX idx_appointments_hospital_id ON appointments (hospital_id);
CREATE INDEX idx_appointments_date_time ON appointments (appointment_date_time);
CREATE INDEX idx_appointments_status ON appointments (status);

-- 7. donations Table
CREATE TABLE donations (
    donation_id SERIAL PRIMARY KEY,
    donor_id INTEGER NOT NULL REFERENCES donors(donor_id) ON DELETE CASCADE,
    hospital_id INTEGER NOT NULL REFERENCES hospitals(hospital_id) ON DELETE CASCADE,
    blood_need_id INTEGER REFERENCES blood_needs(need_id) ON DELETE SET NULL,
    appointment_id INTEGER UNIQUE REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    donation_date DATE NOT NULL,
    blood_type_donated VARCHAR(10) NOT NULL CHECK (blood_type_donated IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    units_donated INTEGER NOT NULL CHECK (units_donated > 0),
    status VARCHAR(50) NOT NULL CHECK (status IN ('successful', 'deferred', 'failed')),
    deferral_reason TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_donations_donor_id ON donations (donor_id);
CREATE INDEX idx_donations_hospital_id ON donations (hospital_id);
CREATE INDEX idx_donations_donation_date ON donations (donation_date);
CREATE INDEX idx_donations_status ON donations (status);

-- 8. badges Table (Gamification)
CREATE TABLE badges (
    badge_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    image_url VARCHAR(255),
    criteria TEXT
);

-- 9. user_badges Table (Gamification)
CREATE TABLE user_badges (
    user_badge_id SERIAL PRIMARY KEY,
    donor_id INTEGER NOT NULL REFERENCES donors(donor_id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES badges(badge_id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (donor_id, badge_id)
);

CREATE INDEX idx_user_badges_donor_id ON user_badges (donor_id);
CREATE INDEX idx_user_badges_badge_id ON user_badges (badge_id);

-- 10. educational_resources Table (Content Management)
CREATE TABLE educational_resources (
    resource_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100),
    published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_educational_resources_category ON educational_resources (category);
CREATE INDEX idx_educational_resources_published ON educational_resources (is_published);