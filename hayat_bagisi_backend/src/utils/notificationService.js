// hayat_bagisi_backend/src/utils/notificationService.js
const pool = require('../config/db');
// You'll need to install and configure these:
// For Email: npm install nodemailer nodemailer-sendgrid-transport (or other provider)
// For SMS: npm install twilio (or other provider like MessageBird, Nexmo)

// --- Email Configuration (Example with Nodemailer and SendGrid) ---
// npm install nodemailer @sendgrid/mail
// You'd need a SendGrid API Key in your .env
// SENDGRID_API_KEY=YOUR_SENDGRID_API_KEY

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmailNotification = async (toEmail, subject, textContent, htmlContent) => {
    const msg = {
        to: toEmail,
        from: process.env.EMAIL_FROM || 'no-reply@hayatbagisi.com', // Your verified sender email
        subject: subject,
        text: textContent,
        html: htmlContent,
    };
    try {
        await sgMail.send(msg);
        console.log(`Email sent to ${toEmail}`);
        return { success: true };
    } catch (error) {
        console.error(`Error sending email to ${toEmail}:`, error.response ? error.response.body : error);
        return { success: false, error: error.message };
    }
};

// --- SMS Configuration (Example with Twilio) ---
// npm install twilio
// You'd need Twilio credentials in your .env
// TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID
// TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN
// TWILIO_PHONE_NUMBER=YOUR_TWILIO_PHONE_NUMBER

const twilio = require('twilio');
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sendSmsNotification = async (toPhoneNumber, message) => {
    try {
        if (!toPhoneNumber || toPhoneNumber.length < 10) { // Basic validation
             throw new Error('Invalid phone number for SMS.');
        }
        const messageResponse = await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: toPhoneNumber,
        });
        console.log(`SMS sent to ${toPhoneNumber}. SID: ${messageResponse.sid}`);
        return { success: true, sid: messageResponse.sid };
    } catch (error) {
        console.error(`Error sending SMS to ${toPhoneNumber}:`, error.message);
        return { success: false, error: error.message };
    }
};

// Main function to find donors and send notifications
const sendBloodNeedNotifications = async (needId, bloodType, hospitalLocation, urgencyLevel) => {
    console.log(`[Notification Service] Processing need ${needId} for ${bloodType} (${urgencyLevel})`);

    // Define search radius based on urgency
    let maxDistanceKm;
    if (urgencyLevel === 'critical') {
        maxDistanceKm = 50; // 50 km for critical needs
    } else if (urgencyLevel === 'urgent') {
        maxDistanceKm = 100; // 100 km for urgent needs
    } else {
        return; // No notifications for 'normal' urgency
    }

    try {
        // Find suitable donors within the specified distance for the blood type
        // This query also excludes donors who are not available for alerts
        // and those who have donated recently (last_donation_date logic - you might need more complex rules here)
        const donorsResult = await pool.query(
            `SELECT
                d.donor_id,
                u.email,
                d.phone_number,
                d.full_name,
                d.preferred_contact_method,
                ST_Distance(d.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
            FROM donors d
            JOIN users u ON d.donor_id = u.user_id
            WHERE d.blood_type = $3
              AND d.is_available_for_alerts = TRUE
              AND (d.last_donation_date IS NULL OR d.last_donation_date < (CURRENT_DATE - INTERVAL '56 days')) -- Example: Can donate every 56 days
              AND ST_DWithin(d.location, ST_SetSRID(ST_MakePoint($1, $2), 4326), $4 * 1000) -- Distance in meters
            ORDER BY distance_meters ASC`,
            [hospitalLocation.longitude, hospitalLocation.latitude, bloodType, maxDistanceKm]
        );

        const relevantDonors = donorsResult.rows;
        console.log(`Found ${relevantDonors.length} relevant donors for need ${needId}`);

        // Get blood need details
        const needDetailsResult = await pool.query(`
            SELECT bn.blood_type, bn.units_needed, bn.urgency_level, h.name as hospital_name
            FROM blood_needs bn
            JOIN hospitals h ON bn.hospital_id = h.hospital_id
            WHERE bn.need_id = $1`, [needId]);
        const need = needDetailsResult.rows[0];

        if (!need) {
            console.error(`Blood need with ID ${needId} not found for notification.`);
            return;
        }

        const notificationPromises = relevantDonors.map(async (donor) => {
            const subject = `Urgent Blood Donation Needed: ${need.blood_type} at ${need.hospital_name}`;
            const message = `Hayat Bağışı: Urgent need for ${need.blood_type} blood at ${need.hospital_name}. ${need.units_needed} units required. Please consider donating. Your nearest hospital is ${Math.round(donor.distance_meters / 1000)} km away.`;
            const htmlMessage = `<p>Dear ${donor.full_name},</p>
                                 <p>There is an <strong>urgent need</strong> for <strong>${need.blood_type}</strong> blood at <strong>${need.hospital_name}</strong>.</p>
                                 <p><strong>${need.units_needed} units</strong> are required. Your nearest hospital is approximately ${Math.round(donor.distance_meters / 1000)} km away.</p>
                                 <p>Please consider visiting the hospital or booking an appointment through the Hayat Bağışı platform.</p>
                                 <p>Thank you for being a hero!</p>`;

            let notificationResult;
            if (donor.preferred_contact_method === 'sms' && donor.phone_number) {
                notificationResult = await sendSmsNotification(donor.phone_number, message);
            } else if (donor.email) { // Default to email if no preferred method or SMS fails/no number
                notificationResult = await sendEmailNotification(donor.email, subject, message, htmlMessage);
            } else {
                console.warn(`Donor ${donor.donor_id} has no valid contact method for notification.`);
                return; // Skip this donor
            }

            // Record notification in the database
            const status = notificationResult.success ? 'sent' : 'failed';
            await pool.query(
                `INSERT INTO notifications (donor_id, need_id, type, message, status)
                 VALUES ($1, $2, $3, $4, $5)`,
                [donor.donor_id, needId, donor.preferred_contact_method, message, status]
            );
        });

        await Promise.allSettled(notificationPromises); // Wait for all notifications to attempt sending
        console.log(`Finished processing notifications for need ${needId}`);

    } catch (error) {
        console.error('Error in sendBloodNeedNotifications:', error.stack);
    }
};

module.exports = {
    sendBloodNeedNotifications
};