// src/pages/HomePage.jsx
import React from 'react';

function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-red-50 to-pink-50">
      <h1 className="text-5xl font-extrabold text-red-700 mb-6">Welcome to Hayat Bağışı</h1>
      <p className="text-xl text-gray-700 mb-8 text-center max-w-2xl">
        Your bridge to saving lives. Find urgent blood needs, manage your donations, and become a hero.
      </p>
      <div className="space-x-4">
        <a href="/login" className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition duration-300">
          Login
        </a>
        <a href="/register" className="px-6 py-3 border border-red-600 text-red-600 font-semibold rounded-lg shadow-md hover:bg-red-100 transition duration-300">
          Register
        </a>
      </div>
    </div>
  );
}

export default HomePage;