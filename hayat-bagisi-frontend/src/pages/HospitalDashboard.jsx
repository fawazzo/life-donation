// src/pages/HospitalDashboard.jsx
import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

function HospitalDashboard() {
  const { user } = useAuth();
  // State for Hospital Profile Data
  const [hospitalProfile, setHospitalProfile] = useState(null);

  // State for Blood Needs
  const [bloodNeeds, setBloodNeeds] = useState([]);
  const [newNeed, setNewNeed] = useState({
    blood_type: 'O+',
    units_needed: 1,
    urgency_level: 'normal',
    details: '',
    expires_at: ''
  });

  // State for Appointments
  const [appointments, setAppointments] = useState([]);
  
  // States for manual donation recording (within modal)
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showRecordDonationModal, setShowRecordDonationModal] = useState(false);
  const [donationRecord, setDonationRecord] = useState({
    status: 'successful',
    units_donated: 1, // Will be parseInt-ed on change
    deferral_reason: ''
  });
  const [donorSearchTerm, setDonorSearchTerm] = useState('');
  const [foundDonors, setFoundDonors] = useState([]);
  const [selectedDonor, setSelectedDonor] = useState(null);

  // State for Hospital Inventory
  const [hospitalInventory, setHospitalInventory] = useState([]);
  const [newInventoryUnits, setNewInventoryUnits] = useState(1); // For manual update input
  const [selectedInventoryBloodType, setSelectedInventoryBloodType] = useState('O+'); // For manual update blood type


  // General States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Initial Data Fetch on Component Mount/User Change
  useEffect(() => {
    if (user && user.role === 'hospital_admin') {
      fetchAllHospitalData();
    } else if (user) { // Authenticated but not hospital_admin
      setError('You are not authorized to view this page. Please log in as a Hospital Admin.');
      setLoading(false);
    } else { // Not authenticated
      setError('Please log in to view this page.');
      setLoading(false);
    }
  }, [user]);

  const fetchAllHospitalData = async () => {
    setLoading(true);
    setError('');
    try {
      const [
        profileResponse,
        needsResponse,
        appointmentsResponse,
        inventoryResponse
      ] = await Promise.all([
        api.get('/hospitals/profile'),
        api.get('/hospitals/needs'),
        api.get('/donations/hospital-appointments'),
        api.get('/hospitals/inventory')
      ]);
      setHospitalProfile(profileResponse.data);
      setBloodNeeds(needsResponse.data);
      setAppointments(appointmentsResponse.data);
      setHospitalInventory(inventoryResponse.data);
      setMessage('');
    } catch (err) {
      console.error('Failed to fetch hospital data:', err);
      setError(err.response?.data?.message || 'Failed to load hospital data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- Blood Needs Handlers ---
  const handleNewNeedChange = (e) => {
    setNewNeed({ ...newNeed, [e.target.name]: e.target.value });
  };

  const handlePostNeed = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const payload = {
        ...newNeed,
        units_needed: parseInt(newNeed.units_needed, 10),
        expires_at: newNeed.expires_at ? new Date(newNeed.expires_at).toISOString() : null
      };

      if (isNaN(payload.units_needed) || payload.units_needed <= 0) {
        setError('Units needed must be a positive whole number.');
        return;
      }

      await api.post('/hospitals/needs', payload);
      setMessage('Blood need posted successfully!');
      setNewNeed({ blood_type: 'O+', units_needed: 1, urgency_level: 'normal', details: '', expires_at: '' });
      fetchAllHospitalData();
    } catch (err) {
      console.error('Failed to post blood need:', err);
      setError(err.response?.data?.message || 'Failed to post blood need.');
    }
  };

  const handleDeleteNeed = async (needId) => {
    if (!window.confirm('Are you sure you want to delete this blood need?')) return;
    setError('');
    setMessage('');
    try {
      await api.delete(`/hospitals/needs/${needId}`);
      setMessage('Blood need deleted successfully!');
      fetchAllHospitalData();
    } catch (err) {
      console.error('Failed to delete blood need:', err);
      setError(err.response?.data?.message || 'Failed to delete blood need.');
    }
  };

  // --- Appointment Handlers ---
  const handleAppointmentStatusUpdate = async (appointmentId, newStatus) => {
    if (!window.confirm(`Are you sure you want to set this appointment status to '${newStatus.replace('_', ' ')}'?`)) return;
    setError('');
    setMessage('');
    try {
      await api.put(`/donations/${appointmentId}/status`, { status: newStatus });
      setMessage('Appointment status updated successfully.');
      fetchAllHospitalData();
    } catch (err) {
      console.error('Failed to update appointment status:', err);
      setError(err.response?.data?.message || 'Failed to update appointment status.');
    }
  };

  // --- Record Donation Handlers (Modal logic) ---
  const openRecordDonationModal = (appointment = null) => {
    setSelectedAppointment(appointment);
    setSelectedDonor(null);
    setDonationRecord({
      status: 'successful',
      units_donated: 1, // Initialize as 1 (integer)
      deferral_reason: ''
    });
    setDonorSearchTerm('');
    setFoundDonors([]);
    setShowRecordDonationModal(true);
    setError('');
    setMessage('');
  };

  const closeRecordDonationModal = () => {
    setShowRecordDonationModal(false);
    setSelectedAppointment(null);
    setSelectedDonor(null);
    setDonationRecord({ status: 'successful', units_donated: 1, deferral_reason: '' });
    setDonorSearchTerm('');
    setFoundDonors([]);
  };

  const handleDonationRecordChange = (e) => {
    const { name, value } = e.target;
    setDonationRecord(prev => ({
        ...prev,
        // *** CRUCIAL FIX: Parse as INTEGER for units_donated here ***
        [name]: name === 'units_donated' ? parseInt(value, 10) || 0 : value
    }));
  };

  const handleRecordDonationSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    let payload = {
      donation_date: new Date().toISOString().slice(0, 10),
      status: donationRecord.status,
      deferral_reason: donationRecord.deferral_reason,
      units_donated: donationRecord.units_donated, // This should already be an integer
    };

    if (selectedAppointment) {
      payload.donor_id = selectedAppointment.donor_id;
      payload.appointment_id = selectedAppointment.appointment_id;
      payload.blood_need_id = selectedAppointment.blood_need_id;
      payload.blood_type_donated = selectedAppointment.donor_blood_type;
    } else if (selectedDonor) {
        payload.donor_id = selectedDonor.user_id;
        payload.blood_type_donated = selectedDonor.blood_type;
    } else {
        setError("No donor or appointment selected to record donation.");
        return;
    }

    if (!payload.blood_type_donated || !payload.donor_id) {
        setError("Missing essential donor or blood type information. Please ensure a donor is selected.");
        return;
    }

    if (payload.status === 'successful') {
        if (isNaN(payload.units_donated) || payload.units_donated <= 0) {
            setError("Successful donation must have valid units donated (a positive number).");
            return;
        }
    } else {
        if (!payload.deferral_reason) {
            setError("Deferral reason is required for deferred/failed donations.");
            return;
        }
        payload.units_donated = 0;
    }

    try {
      await api.post('/donations/record', payload);
      setMessage('Donation recorded successfully!');
      closeRecordDonationModal();
      fetchAllHospitalData();
    } catch (err) {
      console.error('Failed to record donation API error:', err);
      if (err.response?.status === 409 && err.response.data?.errorCode === 'DUPLICATE_APPOINTMENT_DONATION') {
          setError(err.response.data?.message || 'A donation for this appointment has already been recorded.');
      } else {
          setError(err.response?.data?.message || 'Failed to record donation. Please try again.');
      }
    }
  };

  const handleDonorSearch = async (e) => {
    setDonorSearchTerm(e.target.value);
    const query = e.target.value.trim();
    if (query.length > 2) {
      try {
        const response = await api.get(`/donations/donors/search?q=${encodeURIComponent(query)}`);
        setFoundDonors(response.data);
      } catch (err) {
        console.error('Donor search failed:', err);
        setFoundDonors([]);
      }
    } else {
      setFoundDonors([]);
    }
  };

  // --- Inventory Management Handlers ---
  const handleInventoryChange = async (bloodType, changeAmount) => {
    setError('');
    setMessage('');
    // *** CRUCIAL FIX: Ensure changeAmount is parsed as INTEGER here ***
    const integerChangeAmount = parseInt(changeAmount, 10);
    if (isNaN(integerChangeAmount) || integerChangeAmount === 0) { // Changed to integerChangeAmount
      setError('Please enter a valid whole number of units to add or deduct.');
      return;
    }
    try {
      await api.post('/hospitals/inventory/update', { blood_type: bloodType, units_change: integerChangeAmount });
      setMessage(`Inventory for ${bloodType} updated successfully!`);
      fetchAllHospitalData();
      setNewInventoryUnits(1);
      setSelectedInventoryBloodType('O+');
    } catch (err) {
      console.error('Failed to update inventory:', err);
      setError(err.response?.data?.message || 'Failed to update inventory.');
    }
  };


  if (loading) return <div className="text-center py-10">Loading hospital dashboard...</div>;
  if (error && !showRecordDonationModal) return <div className="text-center py-10 text-red-600">Error: {error}</div>;
  if (!user || user.role !== 'hospital_admin') return <div className="text-center py-10 text-red-600">Access Denied.</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Hospital Admin Dashboard</h1>

      {message && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{message}</div>}
      {error && !showRecordDonationModal && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      {/* Hospital Profile Summary (NEW) */}
      {hospitalProfile && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Your Hospital Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-800">
                <p><strong>Name:</strong> {hospitalProfile.name}</p>
                <p><strong>Address:</strong> {hospitalProfile.address}</p>
                <p><strong>Phone:</strong> {hospitalProfile.phone_number}</p>
                {hospitalProfile.contact_person && <p><strong>Contact Person:</strong> {hospitalProfile.contact_person}</p>}
                {hospitalProfile.contact_email && <p><strong>Contact Email:</strong> {hospitalProfile.contact_email}</p>}
                <p><strong>Location:</strong> Lat: {hospitalProfile.latitude}, Lon: {hospitalProfile.longitude}</p>
            </div>
        </div>
      )}

      {/* Hospital Inventory Section */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Current Blood Inventory</h2>
        {hospitalInventory.length === 0 ? (
          <p className="text-gray-600 mb-4">No inventory records yet. Add units below.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
            {hospitalInventory.map(item => (
              <div key={item.blood_type} className="border border-gray-200 p-4 rounded-md shadow-sm flex flex-col justify-between items-center text-center">
                <span className="text-xl font-bold text-red-700 mb-2">{item.blood_type}</span>
                <span className="text-lg font-medium text-gray-900">{item.units_in_stock} units</span>
                <span className="text-xs text-gray-500 mt-1">Last updated: {new Date(item.last_updated_at).toLocaleString()}</span>
                <div className="flex space-x-2 mt-3">
                  <button
                    onClick={() => handleInventoryChange(item.blood_type, 1)}
                    className="p-2 rounded-full bg-green-100 text-green-700 hover:bg-green-200 text-sm font-bold w-10 h-10 flex items-center justify-center"
                    title="Add 1 unit"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => handleInventoryChange(item.blood_type, -1)}
                    className="p-2 rounded-full bg-red-100 text-red-700 hover:bg-red-200 text-sm font-bold w-10 h-10 flex items-center justify-center"
                    title="Deduct 1 unit"
                    disabled={item.units_in_stock <= 0}
                  >
                    -1
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Manual Add/Deduct for any blood type */}
        <div className="flex flex-col md:flex-row gap-4 items-center mt-4 p-4 border border-blue-200 rounded-md bg-blue-50">
            <div className="w-full md:w-1/3">
                <label htmlFor="inventoryBloodType" className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
                <select
                    id="inventoryBloodType"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                    onChange={(e) => setSelectedInventoryBloodType(e.target.value)}
                    value={selectedInventoryBloodType}
                >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </div>
            <div className="w-full md:w-1/3">
                <label htmlFor="inventoryUnitsChange" className="block text-sm font-medium text-gray-700 mb-1">Units to Add/Deduct</label>
                <input
                    type="number"
                    id="inventoryUnitsChange"
                    placeholder="e.g., 5, -2"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                    onChange={(e) => setNewInventoryUnits(parseInt(e.target.value, 10) || 0)} // *** CRUCIAL FIX: parseInt here ***
                    value={newInventoryUnits}
                />
            </div>
            <div className="w-full md:w-1/3 pt-6 md:pt-0">
                <button
                    onClick={() => handleInventoryChange(selectedInventoryBloodType, newInventoryUnits)}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
                >
                    Update Inventory
                </button>
            </div>
        </div>
      </div>

      {/* Post New Blood Need Form (No changes) */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Post New Blood Need</h2>
        <form onSubmit={handlePostNeed} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="blood_type_new_need" className="block text-sm font-medium text-gray-700">Blood Type</label>
            <select name="blood_type" id="blood_type_new_need" value={newNeed.blood_type} onChange={handleNewNeedChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="units_needed_new_need" className="block text-sm font-medium text-gray-700">Units Needed</label>
            <input type="number" name="units_needed" id="units_needed_new_need" value={newNeed.units_needed} onChange={handleNewNeedChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" min="1" required />
          </div>
          <div>
            <label htmlFor="urgency_level_new_need" className="block text-sm font-medium text-gray-700">Urgency Level</label>
            <select name="urgency_level" id="urgency_level_new_need" value={newNeed.urgency_level} onChange={handleNewNeedChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label htmlFor="expires_at_new_need" className="block text-sm font-medium text-gray-700">Expires At (Optional)</label>
            <input type="datetime-local" name="expires_at" id="expires_at_new_need" value={newNeed.expires_at} onChange={handleNewNeedChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="details_new_need" className="block text-sm font-medium text-gray-700">Details (Optional)</label>
            <textarea name="details" id="details_new_need" value={newNeed.details} onChange={handleNewNeedChange} rows="3" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"></textarea>
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
              Post Blood Need
            </button>
          </div>
        </form>
      </div>

      {/* Existing Blood Needs List (No changes) */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Your Posted Blood Needs</h2>
        {bloodNeeds.length === 0 ? (
          <p className="text-gray-600">No blood needs posted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Units</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Urgency</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posted At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fulfilled</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bloodNeeds.map((need) => (
                  <tr key={need.need_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{need.blood_type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{need.units_needed}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        need.urgency_level === 'critical' ? 'bg-red-100 text-red-800' :
                        need.urgency_level === 'urgent' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {need.urgency_level}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(need.posted_at).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{need.is_fulfilled ? 'Yes' : 'No'} ({need.fulfilled_units}/{need.units_needed})</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDeleteNeed(need.need_id)}
                        className="text-red-600 hover:text-red-900 ml-4"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hospital Appointments List (No changes to the list, only to modal calls) */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Upcoming & Past Appointments</h2>
        <p className="text-right mb-4">
          <button
            onClick={() => openRecordDonationModal(null)} // No appointment, for manual record
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Record Manual Donation
          </button>
        </p>
        {appointments.length === 0 ? (
          <p className="text-gray-600">No appointments for your hospital.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Donor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {appointments.map((appt) => (
                  <tr key={appt.appointment_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {appt.donor_name} ({appt.donor_blood_type})
                      <br/>
                      <span className="text-gray-500 text-xs">{appt.donor_phone_number} / {appt.donor_email}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {appt.needed_blood_type ? `${appt.needed_blood_type} (Need: ${appt.needed_urgency_level})` : 'General'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(appt.appointment_date_time).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        appt.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        appt.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {appt.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {appt.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => openRecordDonationModal(appt)} // Pass the appointment object
                            className="text-green-600 hover:text-green-900"
                          >
                            Record Donation
                          </button>
                          <button
                            onClick={() => handleAppointmentStatusUpdate(appt.appointment_id, 'no_show')}
                            className="text-yellow-600 hover:text-yellow-900 ml-4"
                          >
                            No Show
                          </button>
                          <button
                            onClick={() => handleAppointmentStatusUpdate(appt.appointment_id, 'cancelled')}
                            className="text-red-600 hover:text-red-900 ml-4"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Donation Modal (No changes, logic is self-contained) */}
      {showRecordDonationModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Record Donation</h2>
            {selectedAppointment ? (
              <p className="mb-4">For Appointment: <span className="font-semibold">{selectedAppointment.donor_name}</span> ({selectedAppointment.donor_blood_type}) at {new Date(selectedAppointment.appointment_date_time).toLocaleString()}</p>
            ) : (
                <>
                <p className="mb-2 text-gray-700">Manually record a donation. Search and select a donor:</p>
                <input
                    type="text"
                    placeholder="Search donor by name, email, or phone"
                    value={donorSearchTerm}
                    onChange={handleDonorSearch}
                    className="mb-2 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                {foundDonors.length > 0 && (
                    <ul className="mb-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md bg-white">
                        {foundDonors.map(donor => (
                            <li key={donor.user_id} // Use user_id as key for search results
                                className={`p-2 cursor-pointer hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 ease-in-out
                                            ${selectedDonor && selectedDonor.user_id === donor.user_id ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-900'}`}
                                onClick={() => {
                                    setSelectedDonor(donor);
                                    setDonationRecord(prev => ({
                                        ...prev,
                                        blood_type_donated: donor.blood_type
                                    }));
                                    setDonorSearchTerm(donor.full_name);
                                    setFoundDonors([]);
                                }}
                            >
                                <span className="font-medium">{donor.full_name}</span> ({donor.email || donor.phone_number || 'N/A'}) - Blood Type: {donor.blood_type}
                            </li>
                        ))}
                    </ul>
                )}
                {selectedDonor && (
                    <p className="mb-4 text-green-700 text-sm font-medium">Selected Donor: <span className="font-bold">{selectedDonor.full_name}</span> (Blood Type: {selectedDonor.blood_type})</p>
                )}
                {!selectedDonor && !selectedAppointment && (
                    <p className="text-orange-600 text-sm mb-4">Please search for a donor and click on their name in the list above to select them.</p>
                )}
                </>
            )}

            {error && showRecordDonationModal && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <form onSubmit={handleRecordDonationSubmit}>
              {(selectedAppointment || selectedDonor) ? (
                <>
                  <div className="mb-4">
                    <label htmlFor="donationStatus" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select name="status" id="donationStatus" value={donationRecord.status} onChange={handleDonationRecordChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                      <option value="successful">Successful</option>
                      <option value="deferred">Deferred</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                  {(donationRecord.status === 'successful') && (
                    <div className="mb-4">
                      <label htmlFor="units_donated" className="block text-sm font-medium text-gray-700 mb-1">Units Donated</label>
                      <input type="number" name="units_donated" id="units_donated" value={donationRecord.units_donated} onChange={handleDonationRecordChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" min="0" required={donationRecord.status === 'successful'} />
                    </div>
                  )}
                  {(donationRecord.status === 'deferred' || donationRecord.status === 'failed') && (
                    <div className="mb-4">
                      <label htmlFor="deferral_reason" className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                      <textarea name="deferral_reason" id="deferral_reason" value={donationRecord.deferral_reason} onChange={handleDonationRecordChange} rows="3" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required={donationRecord.status !== 'successful'}></textarea>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={closeRecordDonationModal}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Record
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-gray-600">
                    <p className="mb-2">Please select a donor from the search results above to proceed with recording a manual donation.</p>
                    <button
                      type="button"
                      onClick={closeRecordDonationModal}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Close
                    </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default HospitalDashboard;