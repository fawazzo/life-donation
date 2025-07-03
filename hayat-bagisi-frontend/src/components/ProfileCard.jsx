// src/components/ProfileCard.jsx
import React from 'react';

function ProfileCard({ data, role }) {
  if (!data) return <p className="text-center text-gray-500">No profile data to display.</p>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-2xl font-semibold text-gray-700 mb-4">Personal Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-800">
        <p><strong>Email:</strong> {data.email}</p>
        <p><strong>Account Created:</strong> {new Date(data.created_at).toLocaleDateString()}</p>
        {data.last_login_at && <p><strong>Last Login:</strong> {new Date(data.last_login_at).toLocaleString()}</p>}
        <p><strong>Account Status:</strong> {data.is_active ? 'Active' : 'Inactive'}</p>

        {role === 'donor' && (
          <>
            <p><strong>Full Name:</strong> {data.full_name}</p>
            <p><strong>Blood Type:</strong> <span className="font-bold text-red-600">{data.blood_type}</span></p>
            {data.phone_number && <p><strong>Phone:</strong> {data.phone_number}</p>}
            <p><strong>Location:</strong> Lat: {data.latitude}, Lon: {data.longitude}</p>
            {data.last_donation_date && <p><strong>Last Donation:</strong> {new Date(data.last_donation_date).toLocaleDateString()}</p>}
            <p><strong>Alerts Enabled:</strong> {data.is_available_for_alerts ? 'Yes' : 'No'}</p>
            <p><strong>Preferred Contact:</strong> {data.preferred_contact_method}</p>
          </>
        )}

        {role === 'hospital_admin' && (
          <>
            <p><strong>Hospital Name:</strong> {data.name}</p>
            <p><strong>Address:</strong> {data.address}</p>
            <p><strong>Location:</strong> Lat: {data.latitude}, Lon: {data.longitude}</p>
            <p><strong>Phone Number:</strong> {data.phone_number}</p>
            {data.contact_person && <p><strong>Contact Person:</strong> {data.contact_person}</p>}
            {data.contact_email && <p><strong>Contact Email:</strong> {data.contact_email}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export default ProfileCard;