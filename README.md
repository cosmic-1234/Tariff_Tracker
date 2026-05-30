# 🚀 Tariff Tracker - MERN Stack

A modern, highly structured MERN stack boilerplate configured with a custom Node.js Express backend and a responsive, high-performance Vite + React frontend.

---

## 📂 Project Structure

```
tariff_tracker/
├── package.json         # Root orchestrator package.json
├── .gitignore           # Global gitignore file
├── README.md            # You are here!
├── backend/             # Express API Server
│   ├── package.json     # Backend configuration
│   ├── server.js        # Server entry point
│   ├── .env             # Environment configuration file
│   ├── config/          # Configurations (Database connection, etc.)
│   ├── controllers/     # Controller layer (Business logic)
│   ├── models/          # Mongoose models (Schema definition)
│   ├── routes/          # Express Routers (API Endpoints)
│   └── middleware/      # Express Middlewares (Auth, Error handling)
└── frontend/            # Vite + React Client
    ├── package.json     # Frontend configuration
    ├── vite.config.js   # Vite build settings
    ├── index.html       # Client entry HTML
    └── src/             # Frontend application source
        ├── assets/      # Static media/images
        ├── components/  # Reusable UI components
        └── App.jsx      # Main Application component
```

---

## 🛠️ Prerequisites

Make sure you have the following installed on your machine:
* [Node.js](https://nodejs.org/) (v16+ recommended)
* [MongoDB](https://www.mongodb.com/) (Local server or MongoDB Atlas URI)

---

## ⚡ Quick Start

### 1. Installation
Install all dependencies for the root orchestrator, backend server, and frontend client in a single command from the project root directory:

```bash
npm run install-all
```

### 2. Configuration
Configure the environment variables by checking the `.env` template in the `backend/` directory:
```bash
# Create local .env in backend/
PORT=5000
MONGO_URI=mongodb://localhost:27017/tariff_tracker
```

### 3. Run Development Servers
Launch both the backend and frontend development servers concurrently with a single command from the root directory:

```bash
npm run dev
```

* **Express API Server** starts on: [http://localhost:5000](http://localhost:5000)
* **Vite React Client** starts on: [http://localhost:5173](http://localhost:5173)

---

## 🧱 Architecture Overview

### Backend Architecture
* **Controller-Route-Model Pattern**: Business logic is separated from routes and schemas to maintain a highly testable and clean codebase.
* **Database Connection**: Robust Mongoose database connection in `backend/config/db.js` with auto-reconnection and detailed error handling.
* **Global Error Middleware**: Centralized error middleware ensures all api exceptions are returned in a uniform JSON format.

### Frontend Architecture
* **Vite**: Powered by Vite for lightning-fast Hot Module Replacement (HMR) and optimized builds.
* **Responsive Styling**: Pure, premium-crafted modern styling showcasing smooth gradients, sleek card components, and subtle interactive animations.
