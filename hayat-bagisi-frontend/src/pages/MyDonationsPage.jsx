// src/pages/MyDonationsPage.jsx
import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

function MyDonationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && user && user.role === 'donor') {
      fetchDonations();
    } else if (!authLoading && user && user.role !== 'donor') {
        setError('Access Denied. Only donors can view this page.');
        setLoading(false);
    } else if (!authLoading && !user) {
      setError('Please log in as a donor to view your donations.');
      setLoading(false);
    }
  }, [user, authLoading]);

  const fetchDonations = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/donations/my-donations');
      setDonations(response.data);
    } catch (err) {
      console.error('Failed to fetch donations:', err);
      setError(err.response?.data?.message || 'Failed to load donations.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) return <div className="text-center py-10">Loading donations...</div>;
  if (error) return <div className="text-center py-10 text-red-600">Error: {error}</div>;
  if (!user || user.role !== 'donor') return <div className="text-center py-10 text-blue-600">Access Denied.</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">My Donation History</h1>

      {donations.length === 0 ? (
        <p className="text-gray-600">You have no recorded donations yet. Be a hero!</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hospital</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type Donated</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Units</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason (if failed)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {donations.map((donation) => (
                <tr key={donation.donation_id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{new Date(donation.donation_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{donation.hospital_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{donation.blood_type_donated}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{donation.units_donated}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      donation.status === 'successful' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {donation.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{donation.deferral_reason || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MyDonationsPage;