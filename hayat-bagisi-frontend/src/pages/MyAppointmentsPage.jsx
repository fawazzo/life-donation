// src/pages/MyAppointmentsPage.jsx
import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

function MyAppointmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!authLoading && user && user.role === 'donor') {
      fetchAppointments();
    } else if (!authLoading && user && user.role !== 'donor') {
        setError('Access Denied. Only donors can view this page.');
        setLoading(false);
    } else if (!authLoading && !user) {
      setError('Please log in as a donor to view your appointments.');
      setLoading(false);
    }
  }, [user, authLoading]);

  const fetchAppointments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/appointments/my-appointments');
      setAppointments(response.data);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
      setError(err.response?.data?.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }
    setError('');
    setMessage('');
    try {
      await api.put(`/appointments/${appointmentId}/status`, { status: 'cancelled' });
      setMessage('Appointment cancelled successfully.');
      fetchAppointments(); // Refresh list
    } catch (err) {
      console.error('Failed to cancel appointment:', err);
      setError(err.response?.data?.message || 'Failed to cancel appointment.');
    }
  };


  if (authLoading || loading) return <div className="text-center py-10">Loading appointments...</div>;
  if (error) return <div className="text-center py-10 text-red-600">Error: {error}</div>;
  if (!user || user.role !== 'donor') return <div className="text-center py-10 text-blue-600">Access Denied.</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">My Appointments</h1>

      {message && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{message}</div>}
      
      {appointments.length === 0 ? (
        <p className="text-gray-600">You have no upcoming or past appointments.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hospital</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">For Blood Need</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {appointments.map((appt) => (
                <tr key={appt.appointment_id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{appt.hospital_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(appt.appointment_date_time).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {appt.needed_blood_type ? `${appt.needed_blood_type} (${appt.needed_urgency_level})` : 'General Donation'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      appt.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                      appt.status === 'completed' ? 'bg-green-100 text-green-800' :
                      appt.status === 'cancelled' || appt.status === 'no_show' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {appt.status === 'scheduled' && (
                      <button
                        onClick={() => handleCancelAppointment(appt.appointment_id)}
                        className="text-red-600 hover:text-red-900 ml-4"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MyAppointmentsPage;