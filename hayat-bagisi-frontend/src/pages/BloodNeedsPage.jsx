// src/pages/BloodNeedsPage.jsx
import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function BloodNeedsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bloodNeeds, setBloodNeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(''); // For success messages

  const [filters, setFilters] = useState({
    bloodType: '',
    maxDistanceKm: '100'
  });

  // State for the appointment booking modal
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedNeed, setSelectedNeed] = useState(null);
  const [appointmentDateTime, setAppointmentDateTime] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState(''); // Added notes field
  const [bookingError, setBookingError] = useState(''); // Error for the modal


  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];


  useEffect(() => {
    if (!authLoading && user) {
      fetchBloodNeeds();
    } else if (!authLoading && !user) {
      setError('Please log in to view blood needs.');
      setLoading(false);
    }
  }, [user, authLoading, filters]);

  const fetchBloodNeeds = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      // Apply filters only if they have a value
      if (filters.bloodType) params.append('bloodType', filters.bloodType);
      // Only append maxDistanceKm if user is a donor and it's a positive number
      if (user.role === 'donor' && filters.maxDistanceKm && parseFloat(filters.maxDistanceKm) > 0) {
          params.append('maxDistanceKm', filters.maxDistanceKm);
      }

      // --- CRUCIAL FIX 1: Remove the extra '/api' prefix ---
      // It should be `/blood-needs` because api.js already prepends /api
      const response = await api.get(`/blood-needs?${params.toString()}`);

      setBloodNeeds(response.data);
    } catch (err) {
      console.error('Failed to fetch blood needs:', err);
      setError(err.response?.data?.message || 'Failed to load blood needs.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  // --- Appointment Booking Logic ---
  const openBookingModal = (need) => {
    setSelectedNeed(need);
    setBookingError(''); // Clear previous booking errors
    // Set default appointment time to next hour, for convenience
    const now = new Date();
    now.setMinutes(now.getMinutes() + 60 - (now.getMinutes() % 60)); // Round to next hour
    now.setSeconds(0); // Clear seconds
    now.setMilliseconds(0); // Clear milliseconds
    setAppointmentDateTime(now.toISOString().slice(0, 16)); // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    setAppointmentNotes(''); // Reset notes
    setShowBookingModal(true);
  };

  const closeBookingModal = () => {
    setShowBookingModal(false);
    setSelectedNeed(null);
    setAppointmentDateTime('');
    setAppointmentNotes('');
    setBookingError('');
    // Do NOT clear general message here, it's for global success after booking.
    // message is cleared by fetchBloodNeeds() on refetch.
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setBookingError('');
    setMessage('');

    if (!appointmentDateTime) {
      setBookingError('Appointment date and time are required.');
      return;
    }
    if (new Date(appointmentDateTime) < new Date()) {
      setBookingError('Appointment date/time cannot be in the past.');
      return;
    }
    if (!selectedNeed) {
      setBookingError('No blood need selected for booking.');
      return;
    }

    try {
      const payload = {
        hospital_id: selectedNeed.hospital_id,
        appointment_date_time: new Date(appointmentDateTime).toISOString(), // Send as ISO string
        blood_need_id: selectedNeed.need_id,
        notes: appointmentNotes // Include notes
      };
      // --- CRUCIAL FIX 2: Remove the extra '/api' prefix ---
      // It should be `/donations/book` because api.js already prepends /api
      await api.post('/donations/book', payload);
      
      setMessage('Appointment booked successfully!');
      closeBookingModal(); // Close modal on success
      fetchBloodNeeds(); // Refresh needs list after booking
      // Optionally, navigate to a "My Appointments" page if you build one
      // navigate('/my-appointments');
    } catch (err) {
      console.error('Failed to book appointment:', err);
      setBookingError(err.response?.data?.message || 'Failed to book appointment. Please try again.');
    }
  };

  // Helper function to check blood type match
  const doesBloodTypeMatch = (needBloodType) => {
    if (!user || user.role !== 'donor' || !user.blood_type) {
      return false; // Not a donor, or donor blood type not loaded
    }

    const donorBloodType = user.blood_type;

    // Strict match: donor's blood type must be exactly what is needed.
    // Implement more complex compatibility logic if desired (e.g., O- universal donor)
    // For now, strict match as per your request.
    return donorBloodType === needBloodType;
  };


  if (authLoading) return <div className="text-center py-10">Loading user data...</div>;
  if (!user) return <div className="text-center py-10 text-blue-600">Please log in to view blood needs.</div>;
  // `error` can be general or modal-specific, only show general error if modal is not open
  if (error && !showBookingModal) return <div className="text-center py-10 text-red-600">Error: {error}</div>;


  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Active Blood Needs</h1>

      {message && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{message}</div>}
      {bookingError && showBookingModal && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{bookingError}</div>}


      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label htmlFor="bloodType" className="block text-sm font-medium text-gray-700">Filter by Blood Type</label>
          <select name="bloodType" id="bloodType" value={filters.bloodType} onChange={handleFilterChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
            <option value="">All</option>
            {bloodTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        {user.role === 'donor' && (
          <div>
            <label htmlFor="maxDistanceKm" className="block text-sm font-medium text-gray-700">Max Distance (km)</label>
            <input type="number" name="maxDistanceKm" id="maxDistanceKm" value={filters.maxDistanceKm} onChange={handleFilterChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" min="0" max="500" />
            <p className="text-xs text-gray-500 mt-1">Enter 0 for no distance filter.</p>
          </div>
        )}
        <div className="md:col-span-1">
          <button onClick={fetchBloodNeeds} className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700">
            Apply Filters
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">Loading blood needs...</div>
      ) : bloodNeeds.length === 0 ? (
        <p className="text-gray-600">No active blood needs found matching your criteria.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bloodNeeds.map((need) => {
            const isDonor = user.role === 'donor';
            const matchesBloodType = isDonor ? doesBloodTypeMatch(need.blood_type) : false; // Check match only if donor

            return (
              <div key={need.need_id} className="bg-white p-6 rounded-lg shadow-md border-t-4 border-red-500">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{need.blood_type} Blood Needed</h3>
                <p className="text-gray-700 mb-1">Hospital: {need.hospital_name}</p>
                <p className="text-gray-700 mb-1">Address: {need.hospital_address}</p>
                <p className="text-gray-700 mb-1">Units: {need.units_needed - need.fulfilled_units} / {need.units_needed} Remaining</p>
                <p className={`text-sm font-medium ${
                  need.urgency_level === 'critical' ? 'text-red-600' :
                  need.urgency_level === 'urgent' ? 'text-yellow-600' :
                  'text-gray-600'
                } mb-2`}>Urgency: {need.urgency_level.toUpperCase()}</p>
                {need.details && <p className="text-sm text-gray-500 mb-2">Details: {need.details}</p>}
                <p className="text-xs text-gray-500">Posted: {new Date(need.posted_at).toLocaleString()}</p>
                {need.expires_at && <p className="text-xs text-gray-500">Expires: {new Date(need.expires_at).toLocaleString()}</p>}
                {isDonor && need.distance_meters !== null && (
                    <p className="text-sm font-semibold text-blue-700 mt-2">
                        Distance: {Math.round(need.distance_meters / 1000)} km
                    </p>
                )}

                {isDonor ? ( // Conditional rendering for donors
                  matchesBloodType ? (
                    <button
                      onClick={() => openBookingModal(need)}
                      className="mt-4 w-full bg-red-500 text-white py-2 rounded-md hover:bg-red-600 transition duration-300"
                    >
                      Book Appointment
                    </button>
                  ) : (
                    <p className="mt-4 w-full text-center text-sm font-medium text-red-500">
                      (Your blood type ({user.blood_type}) does not match this need)
                    </p>
                  )
                ) : ( // For non-donors (e.g., hospital admins or unauthenticated)
                  <p className="mt-4 w-full text-center text-sm text-gray-500">
                    Login as a donor to book an appointment.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Appointment Booking Modal */}
      {showBookingModal && selectedNeed && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Book Appointment for {selectedNeed.blood_type}</h2>
            <p className="mb-4">At: {selectedNeed.hospital_name} ({selectedNeed.hospital_address})</p>
            {bookingError && <p className="text-red-500 text-sm mb-4">{bookingError}</p>}
            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div>
                <label htmlFor="appointmentDateTime" className="block text-sm font-medium text-gray-700 mb-1">
                  Select Date and Time
                </label>
                <input
                  type="datetime-local"
                  id="appointmentDateTime"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                  value={appointmentDateTime}
                  onChange={(e) => setAppointmentDateTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="appointmentNotes" className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
                <textarea
                  id="appointmentNotes"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                  value={appointmentNotes}
                  onChange={(e) => setAppointmentNotes(e.target.value)}
                  rows="3"
                ></textarea>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeBookingModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BloodNeedsPage;