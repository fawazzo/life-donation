// src/pages/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import ProfileCard from '../components/ProfileCard'; // Ensure this component exists in src/components

function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // This effect ensures we only try to fetch data once authentication status is known.
    if (!authLoading) {
      if (!user) {
        // If user is null (not authenticated), redirect to login page.
        navigate('/login');
      } else {
        // If user is authenticated, fetch their specific profile data.
        fetchProfileData();
      }
    }
  }, [user, authLoading, navigate]); // Dependencies: re-run if user changes, auth loading status changes, or navigate function changes

  const fetchProfileData = async () => {
    setLoadingProfile(true); // Indicate that profile data is loading
    setError(''); // Clear any previous errors

    try {
      let endpoint = '';
      // Determine the correct API endpoint based on the user's role
      if (user.role === 'donor') {
        endpoint = '/donors/profile';
      } else if (user.role === 'hospital_admin') {
        endpoint = '/hospitals/profile';
      } else {
        // Handle unexpected roles (should be caught by PrivateRoute, but good fallback)
        setError('Unknown user role. Please contact support.');
        setLoadingProfile(false);
        return;
      }

      const response = await api.get(endpoint); // Make the API call to fetch profile
      setProfileData(response.data); // Store the fetched data in state
    } catch (err) {
      console.error('Failed to fetch profile data:', err);
      // Set a user-friendly error message
      setError(err.response?.data?.message || 'Failed to load profile data. Please try again.');
      // If the error is due to an invalid/expired token, log the user out and redirect
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout(); // Clear local storage and user state
        navigate('/login'); // Redirect to login
      }
    } finally {
      setLoadingProfile(false); // Loading is complete
    }
  };

  const handleLogout = () => {
    logout(); // Call the logout function from AuthContext
    navigate('/login'); // Redirect to login page after logging out
  };

  // --- Conditional Rendering for Loading and Error States ---
  if (authLoading || loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-xl text-gray-700">Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <p className="text-xl text-red-600 mb-4">Error: {error}</p>
        <button
          onClick={handleLogout}
          className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition duration-300"
        >
          Logout
        </button>
      </div>
    );
  }

  // This should theoretically not be reached if the `if (!user)` check above works,
  // but acts as a final safeguard.
  if (!user || !profileData) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
              <p className="text-xl text-red-600 mb-4">User data not available. Please login.</p>
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-300"
              >
                Login
              </button>
          </div>
      );
  }

  // --- Main Profile Content ---
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-lg">
        {/* Header with Profile Title and Logout Button */}
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h1 className="text-3xl font-bold text-gray-800">Your Profile ({user.role === 'donor' ? 'Donor' : 'Hospital Admin'})</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition duration-300"
          >
            Logout
          </button>
        </div>

        {/* Display profile data using ProfileCard component */}
        {profileData && <ProfileCard data={profileData} role={user.role} />}

        {/* Conditional links based on user role */}
        {user.role === 'hospital_admin' && (
          <div className="mt-8 text-center">
            <p className="text-lg text-gray-700 mb-4">Manage your hospital's blood needs and appointments:</p>
            <button
              onClick={() => navigate('/hospital/dashboard')}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-300"
            >
              Go to Hospital Dashboard
            </button>
          </div>
        )}

        {user.role === 'donor' && (
          <div className="mt-8 text-center">
            <p className="text-lg text-gray-700 mb-4">Explore current blood needs or manage your contributions:</p>
            <div className="space-x-4 flex flex-wrap justify-center gap-y-4"> {/* Added flex-wrap for responsiveness */}
                <button
                onClick={() => navigate('/blood-needs')}
                className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition duration-300"
                >
                View Active Blood Needs
                </button>
                <button
                onClick={() => navigate('/my-appointments')} // Link to Donor's Appointments
                className="px-6 py-3 border border-red-600 text-red-600 font-semibold rounded-lg shadow-md hover:bg-red-100 transition duration-300"
                >
                My Appointments
                </button>
                 <button
                onClick={() => navigate('/my-donations')} // Link to Donor's Donation History
                className="px-6 py-3 border border-red-600 text-red-600 font-semibold rounded-lg shadow-md hover:bg-red-100 transition duration-300"
                >
                My Donations History
                </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default ProfilePage;