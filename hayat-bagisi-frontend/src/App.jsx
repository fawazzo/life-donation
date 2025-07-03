// src/App.jsx (updated relevant parts)
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import HospitalDashboard from './pages/HospitalDashboard';
import BloodNeedsPage from './pages/BloodNeedsPage';
import MyAppointmentsPage from './pages/MyAppointmentsPage'; // NEW
import MyDonationsPage from './pages/MyDonationsPage';     // NEW
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected Routes (General) */}
      <Route element={<PrivateRoute allowedRoles={['donor', 'hospital_admin', 'super_admin']} />}>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/blood-needs" element={<BloodNeedsPage />} />
      </Route>

      {/* Donor Specific Protected Routes */}
      <Route element={<PrivateRoute allowedRoles={['donor']} />}>
        <Route path="/my-appointments" element={<MyAppointmentsPage />} /> {/* NEW */}
        <Route path="/my-donations" element={<MyDonationsPage />} />     {/* NEW */}
      </Route>

      {/* Hospital Admin Specific Protected Routes */}
      <Route element={<PrivateRoute allowedRoles={['hospital_admin']} />}>
        <Route path="/hospital/dashboard" element={<HospitalDashboard />} />
      </Route>

      {/* Catch-all for undefined routes */}
      <Route path="*" element={<h1 className="text-center py-10 text-4xl font-bold">404: Page Not Found</h1>} />
    </Routes>
  );
}

export default App;