// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import useAuth
import api from '../api/api'; // While we're moving login logic to context, api might still be useful for other things here, but for login it's now wrapped.

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth(); // <--- Get the login function from AuthContext

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    try {
      // Use the login function from AuthContext
      const loginSuccessful = await login(email, password); // AuthContext's login handles API call, localStorage, and setUser

      if (loginSuccessful) {
        console.log('Login successful via AuthContext!');
        navigate('/profile'); // Redirect to profile after successful login handled by context
      } else {
        // This 'else' block might not be strictly necessary if login() throws on failure,
        // but it's good for clarity if login() returns a boolean or specific status.
        setError('Login failed: Invalid credentials or account issues.');
      }

    } catch (err) {
      // Catch errors thrown by the login function in AuthContext
      console.error('Login failed in component:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Login failed. Please check your credentials or account status.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Login to Hayat Bağışı</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-500 text-center text-sm">{error}</p>}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              id="email"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              id="password"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Login
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account? <Link to="/register" className="font-medium text-red-600 hover:text-red-500">Register here</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;