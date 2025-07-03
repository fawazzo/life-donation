// src/pages/RegisterPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('donor'); // Default role
  
  // Donor specific states
  const [fullName, setFullName] = useState('');
  const [bloodType, setBloodType] = useState('O+'); // Default blood type for donor
  const [donorPhoneNumber, setDonorPhoneNumber] = useState(''); // Renamed to clarify for donor

  // Hospital specific states
  const [hospitalName, setHospitalName] = useState('');
  const [address, setAddress] = useState('');
  const [hospitalPhoneNumber, setHospitalPhoneNumber] = useState(''); // Correct state for hospital phone number

  // Shared states for location (can be used by both donor and hospital)
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    let userData = { email, password, role };

    if (role === 'donor') {
      userData = {
        ...userData,
        fullName,
        bloodType,
        phoneNumber: donorPhoneNumber,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      };
      if (!fullName || !bloodType || !latitude || !longitude) {
          setError("Please fill all required donor fields.");
          return;
      }
    } else if (role === 'hospital_admin') {
      userData = {
        ...userData,
        hospitalName,
        address,
        phoneNumber: hospitalPhoneNumber, // <--- THIS IS THE CRUCIAL FIX: ADDING hospitalPhoneNumber TO THE PAYLOAD
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      };
      if (!hospitalName || !address || !hospitalPhoneNumber || !latitude || !longitude) {
          setError("Please fill all required hospital fields.");
          return;
      }
    }

    try {
      const response = await api.post('/auth/register', userData);
      console.log('Registration successful:', response.data);
      alert('Registration successful! Please log in.');
      navigate('/login');
    } catch (err) {
      console.error('Registration failed:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-10">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-2xl">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Register for Hayat Bağışı</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-500 text-center text-sm">{error}</p>}
          
          {/* Common Fields */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" id="email" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <input type="password" id="password" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <input type="password" id="confirmPassword" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
          </div>
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">I am a:</label>
            <select id="role" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="donor">Donor</option>
              <option value="hospital_admin">Hospital/Blood Bank Admin</option>
            </select>
          </div>

          {/* Donor Specific Fields */}
          {role === 'donor' && (
            <>
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">Full Name</label>
                <input type="text" id="fullName" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" value={fullName} onChange={(e) => setFullName(e.target.value)} required={role === 'donor'} />
              </div>
              <div>
                <label htmlFor="bloodType" className="block text-sm font-medium text-gray-700">Blood Type</label>
                <select id="bloodType" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" value={bloodType} onChange={(e) => setBloodType(e.target.value)} required={role === 'donor'}>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div>
                <label htmlFor="donorPhoneNumber" className="block text-sm font-medium text-gray-700">Phone Number (Optional)</label>
                <input type="tel" id="donorPhoneNumber" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" value={donorPhoneNumber} onChange={(e) => setDonorPhoneNumber(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="latitude" className="block text-sm font-medium text-gray-700">Latitude</label>
                  <input type="number" step="any" id="latitude" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" value={latitude} onChange={(e) => setLatitude(e.target.value)} required={role === 'donor'} />
                </div>
                <div>
                  <label htmlFor="longitude" className="block text-sm font-medium text-gray-700">Longitude</label>
                  <input type="number" step="any" id="longitude" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" value={longitude} onChange={(e) => setLongitude(e.target.value)} required={role === 'donor'} />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                (For latitude/longitude, you can temporarily use a map tool like Google Maps to get coordinates for testing, e.g., 34.0522, -118.2437 for Los Angeles)
              </p>
            </>
          )}

          {/* Hospital Specific Fields */}
          {role === 'hospital_admin' && (
            <>
              <div>
                <label htmlFor="hospitalName" className="block text-sm font-medium text-gray-700">Hospital/Blood Bank Name</label>
                <input type="text" id="hospitalName" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} required={role === 'hospital_admin'} />
              </div>
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">Address</label>
                <input type="text" id="address" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" value={address} onChange={(e) => setAddress(e.target.value)} required={role === 'hospital_admin'} />
              </div>
              <div>
                <label htmlFor="hospitalPhoneNumber" className="block text-sm font-medium text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  id="hospitalPhoneNumber"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={hospitalPhoneNumber}
                  onChange={(e) => setHospitalPhoneNumber(e.target.value)}
                  required={role === 'hospital_admin'}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="hospitalLat" className="block text-sm font-medium text-gray-700">Latitude</label>
                  <input type="number" step="any" id="hospitalLat" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" value={latitude} onChange={(e) => setLatitude(e.target.value)} required={role === 'hospital_admin'} />
                </div>
                <div>
                  <label htmlFor="hospitalLon" className="block text-sm font-medium text-gray-700">Longitude</label>
                  <input type="number" step="any" id="hospitalLon" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" value={longitude} onChange={(e) => setLongitude(e.target.value)} required={role === 'hospital_admin'} />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Register
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account? <Link to="/login" className="font-medium text-red-600 hover:text-red-500">Login here</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;