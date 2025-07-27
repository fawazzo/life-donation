# Hayat Bağışı - Blood Donation Platform

![alt text](https://via.placeholder.com/150x150?text=Hayat+Bağışı+Logo)

**Hayat Bağışı** (meaning "Gift of Life" in Turkish) is a comprehensive web application designed to connect blood donors with hospitals and blood banks in need. It streamlines the process of blood donation, allowing donors to find urgent blood needs nearby, book appointments, and track their donation history. Hospitals can manage their inventory, post blood needs, and record donations efficiently.

## Table of Contents

- [Features](#features)
  - [For Donors](#for-donors)
  - [For Hospitals/Blood Banks](#for-hospitalsblood-banks)
- [Technologies Used](#technologies-used)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Database Setup (PostgreSQL)](#2-database-setup-postgresql)
  - [3. Backend Setup](#3-backend-setup)
  - [4. Frontend Setup](#4-frontend-setup)
  - [5. Running the Application](#5-running-the-application)
- [API Endpoints](#api-endpoints)
- [User Roles](#user-roles)
- [Folder Structure](#folder-structure)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Features

### For Donors

- **User Registration & Authentication**: Secure donor account creation and login.
- **Profile Management**: View and update personal details (full name, blood type, contact, location, availability for alerts).
- **Active Blood Needs**: Discover current blood needs posted by hospitals, filtered by blood type and proximity.
- **Appointment Booking**: Easily book appointments with hospitals for specific blood needs or general donations.
- **Appointment History**: View a list of past and upcoming appointments, with the option to cancel scheduled ones.
- **Donation History**: Keep track of all recorded blood donations.

### For Hospitals/Blood Banks

- **Admin Registration & Authentication**: Secure hospital administrator account creation and login.
- **Hospital Profile Management**: View and update hospital details.
- **Blood Needs Management**:
  - Post new blood needs.
  - View and manage all posted needs.
  - Automated donor notifications (SMS/Email).
- **Inventory Management**:
  - View blood stock levels.
  - Manually update stock.
- **Appointment Management**:
  - View all appointments.
  - Update appointment statuses.
- **Donation Recording**:
  - Link donations to appointments or record manually.

## Technologies Used

### Backend

- Node.js
- Express.js
- PostgreSQL + PostGIS
- node-postgres (pg)
- bcryptjs
- jsonwebtoken (JWT)
- dotenv, cors
- @sendgrid/mail
- twilio

### Frontend

- React
- Vite
- react-router-dom
- Axios
- React Context API
- Tailwind CSS

## Getting Started

### Prerequisites

- Node.js
- npm or Yarn
- PostgreSQL
- PostGIS

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd hayat-bagisi-platform
```

### 2. Database Setup (PostgreSQL)

Create a database and enable PostGIS. Then create tables using provided schema.

### 3. Backend Setup

```bash
cd hayat_bagisi_backend
npm install
```

Create `.env` file:

```env
DB_USER=...
DB_HOST=...
DB_NAME=...
DB_PASSWORD=...
DB_PORT=5432
JWT_SECRET=...
SENDGRID_API_KEY=...
EMAIL_FROM=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
```

Run backend:

```bash
npm run dev
```

### 4. Frontend Setup

```bash
cd ../hayat_bagisi_frontend
npm install
npm run dev
```

### 5. Running the Application

- Backend: http://localhost:5000
- Frontend: http://localhost:5173

## API Endpoints

- Auth: `/api/auth/register`, `/api/auth/login`
- Donors: `/api/donors/...`
- Hospitals: `/api/hospitals/...`
- Appointments: `/api/appointments/...`
- Donations: `/api/donations/...`
- Public Needs: `/api/blood-needs/...`

## User Roles

- **donor**: Regular user
- **hospital_admin**: Hospital manager
- **super_admin**: (optional) Global admin

## Folder Structure

```text
hayat-bagisi-platform/
├── hayat_bagisi_backend/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       └── utils/
├── hayat_bagisi_frontend/
│   └── src/
│       ├── api/
│       ├── assets/
│       ├── components/
│       ├── context/
│       ├── pages/
│       ├── App.jsx
│       ├── index.css
│       └── main.jsx
├── .gitignore
└── README.md
```

## Contributing

1. Fork the repo.
2. Create a branch.
3. Commit and push changes.
4. Open a PR.

## License

MIT License

## Contact

fawaz.kourdoughli@gmail.com
https://www.linkedin.com/in/fawaz-kourdoughli
