// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // `user` state will now hold the full profile data (e.g., donor's blood_type)
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch and set full user profile based on role
  // This helper is called by `login` and `useEffect`
  const fetchUserProfile = async (userId, role) => {
    try {
      let endpoint = '';
      if (role === 'donor') {
        endpoint = '/donors/profile';
      } else if (role === 'hospital_admin') {
        endpoint = '/hospitals/profile';
      } else {
        console.warn("Attempted to fetch profile for unknown role:", role);
        return null;
      }
      const response = await api.get(endpoint);
      // Return the fetched profile data, augmented with the role.
      // The backend profile endpoints already return user_id, email etc. joined.
      return { ...response.data, role: role };
    } catch (err) {
      console.error("Failed to fetch user profile:", err.response?.data || err.message);
      // If fetching profile fails (e.g., token expired while trying to get profile),
      // we'll let the main login/loadUser flow handle the logout.
      return null;
    }
  };

  useEffect(() => {
    const loadUser = async () => { // Make this an async function
      const storedToken = localStorage.getItem('token');
      const storedUserBase = localStorage.getItem('user'); // This might contain just user_id, email, role initially

      if (storedToken && storedUserBase) {
        try {
          const baseUserData = JSON.parse(storedUserBase);
          // Check if it's just the basic user data or already the full profile
          if (baseUserData && baseUserData.user_id && baseUserData.role) {
            // Attempt to fetch the full profile data using the base user info
            const fullProfile = await fetchUserProfile(baseUserData.user_id, baseUserData.role);
            if (fullProfile) {
              // Update localStorage and state with the full profile
              localStorage.setItem('user', JSON.stringify(fullProfile));
              setUser(fullProfile);
            } else {
              // If fetching full profile failed, it might indicate an invalid token
              // or a backend issue, so log out.
              logout();
            }
          } else {
             // If storedUserBase is malformed or missing critical properties, clear it.
            logout();
          }
        } catch (e) {
          console.error("Failed to parse user from localStorage or fetch profile:", e);
          logout(); // Clear token and user on any parsing/fetching error
        }
      }
      setLoading(false); // Set loading to false once the initial load attempt is complete
    };

    loadUser();
  }, []); // Empty dependency array means this runs once on component mount


  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user: baseUserData } = response.data; // `baseUserData` contains user_id, email, role

      localStorage.setItem('token', token);
      // Store basic user data immediately, then fetch full profile
      localStorage.setItem('user', JSON.stringify(baseUserData));

      const fullProfile = await fetchUserProfile(baseUserData.user_id, baseUserData.role);
      if (fullProfile) {
        localStorage.setItem('user', JSON.stringify(fullProfile)); // Update localStorage with full profile
        setUser(fullProfile); // Set state with full profile
        return true; // Indicate successful login and profile load
      } else {
        // If full profile fetch fails after successful login, it's an inconsistent state.
        // Log out the user and throw an error to indicate failure.
        logout();
        throw new Error('Failed to load user profile after successful login.');
      }
    } catch (error) {
      console.error("Login failed in AuthContext:", error.response?.data || error.message);
      // Ensure local storage is cleared on any login failure
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      throw error; // Re-throw to allow component to handle specific error messages
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    // No navigation here; components using useAuth can navigate after calling logout.
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};