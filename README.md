# FixIt Local — Full-Stack Local Service Booking Platform

FixIt Local is a complete full-stack web application designed for on-demand local home service discovery, booking, live GPS tracking, in-app messaging, and multilingual AI assistance.

Built with **React 18 + Vite** on the frontend and **Node.js + Express + MySQL (Sequelize ORM) + Socket.IO** on the backend.

---

## 🚀 Key Features

- 👤 **Role-Based Access Control (RBAC)**:
  - **Customer**: Browse services, filter by category/price, book services, track provider live on map with GPS, in-app chat, demo wallet, and multi-lingual chatbot.
  - **Service Provider**: Manage service catalog, toggle availability, receive service requests, update booking status lifecycle, and broadcast live GPS location.
  - **Admin**: Platform KPIs, provider verification & approval workflow, manage user accounts (suspend/activate), service catalog control, and resolve customer complaints.
- 📍 **Live Provider Location Tracking**:
  - Interactive Leaflet map with real-time GPS beacon updates streamed over **Socket.IO** (with REST polling fallback).
  - Accurate status timeline: *Confirmed → Provider Assigned → On The Way → Arrived → In Progress → Completed*.
- 🤖 **FixIt Assistant AI Chatbot**:
  - User-isolated conversation history in MySQL.
  - Natural-language intent and service category detection (e.g., *"AC cooling illa"* → AC Repair recommendation).
  - Trilingual support (**English, Tamil, Tanglish**) with audio voice speech synthesis.
- 💳 **Digital Wallet & Transactions**:
  - Top-up balance via simulated UPI/Card.
  - Instant cashless checkout for bookings with automated ledger receipts.
- 🛡️ **Student-Friendly Clean Architecture**:
  - Structured MVC pattern: `models`, `controllers`, `routes`, `middleware`, `config`.
  - Relational MySQL database powered by Sequelize ORM.
  - Easy to explain in college project viva and technical interviews.

---

## 📁 Full-Stack Project Structure

```
fixit_local/
├── backend/                        # Node.js & Express REST API
│   ├── config/
│   │   └── database.js             # Sequelize MySQL connection manager
│   ├── models/                     # Sequelize Relational Models
│   │   ├── index.js                # Model associations & exports
│   │   ├── User.js                 # Authentication & profile
│   │   ├── ProviderProfile.js      # Business info, GPS coordinates, rating
│   │   ├── Service.js              # Master service catalog
│   │   ├── ProviderService.js      # Provider offering join table
│   │   ├── Booking.js              # Lifecycle states, address, location
│   │   ├── Review.js               # Ratings & customer feedback
│   │   ├── Notification.js         # User alerts
│   │   ├── ChatConversation.js     # Chat threads
│   │   ├── ChatMessage.js          # Direct messages
│   │   ├── ChatbotHistory.js       # AI Assistant conversation history
│   │   ├── Complaint.js            # Help tickets & dispute resolution
│   │   ├── Wallet.js               # Customer & provider wallet
│   │   ├── WalletTransaction.js    # Wallet credit/debit audit log
│   │   └── PasswordResetToken.js   # Secure hashed password reset tokens
│   ├── controllers/                # Business logic handlers
│   ├── routes/                     # Express REST endpoints
│   ├── middleware/                 # JWT requireAuth, requireRole, errorHandler
│   ├── seed/
│   │   └── seed.js                 # MySQL clean development database seeder
│   ├── server.js                   # Express + MySQL + Socket.IO server entry point
│   ├── package.json
│   ├── .env.example
│   └── .env                        # Environment variables (DB_HOST, DB_NAME, JWT_SECRET)
│
├── src/                            # React 18 Frontend
│   ├── api/
│   │   ├── apiClient.js            # Centralized fetch client with JWT injection
│   │   ├── socketClient.js         # Socket.IO client for live tracking & chat
│   │   └── mockApi.js              # Fallback mock data provider
│   ├── components/                 # Reusable UI components (Navbar, Layout, TrackingMap, etc.)
│   ├── context/                    # React Contexts (User, Booking, Chat, Theme, etc.)
│   ├── hooks/                      # Custom React hooks (useAuth, useBookings, etc.)
│   └── pages/                      # Role-segregated pages (Customer, Provider, Admin)
│
├── API_DOCUMENTATION.md            # Comprehensive REST API specifications
└── README.md
```

---

## 🛠️ Prerequisites

- **Node.js**: v18+ or v20+ (tested on Node v22)
- **MongoDB**: Local MongoDB instance (`mongodb://localhost:27017/fixit_local`) OR MongoDB Atlas Cloud URI

---

## ⚙️ Backend Setup & Configuration

### 1. Install Backend Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `backend/.env` and paste your MongoDB connection string:
```env
PORT=5000
NODE_ENV=development

# Paste your MongoDB Atlas URI or Local MongoDB URI below:
MONGODB_URI=mongodb://localhost:27017/fixit_local

JWT_SECRET=your_secure_random_jwt_secret_key_min_32_chars
CLIENT_URL=http://localhost:5173
```

> **Note:** If `MONGODB_URI` is left unconfigured, the backend will safely start and inform you in the terminal without crashing.

### 3. Seed the Database (Optional but Recommended)
Populate your database with sample accounts, services, bookings, and providers:
```bash
npm run seed
```

### 4. Start the Backend Server
```bash
# Development mode with auto-restart
npm run dev

# Or standard production mode
npm start
```
The REST API and Socket.IO server will run on `http://localhost:5000`.
Check health at: `http://localhost:5000/api/health`.

---

## 💻 Frontend Setup & Launch

Open a second terminal in the project root:

```bash
# Install frontend dependencies
npm install

# Start the Vite development server
npm run dev
```

Visit the printed URL: `http://localhost:5173`.

---

## 🔑 Demo Login Credentials

All seed accounts share the default password: **`Password@123`**

| Role | Email | Name / Business |
|---|---|---|
| **Admin** | `admin@fixit.local` | Admin User |
| **Customer** | `ananya@fixit.local` | Ananya Rao |
| **Customer** | `kavitha@fixit.local` | Kavitha S |
| **Provider (AC)** | `cooling@fixit.local` | Kumar Cooling Co. (Rajesh Kumar) |
| **Provider (Electrical)** | `sparks@fixit.local` | City Spark Electricals (Karthik S) |
| **Provider (Plumbing)** | `plumbpro@fixit.local` | AquaFlow Plumbing (Senthil M) |
| **Provider (Cleaning)** | `cleanmaster@fixit.local` | CleanNest Home Services (Priya R) |

---

## 🧪 Testing & Verification

Run the automated Vitest test suite:
```bash
npm test
```
All 17 test suites (75 tests) verify component rendering, booking flows, tracking UI, and authorization guards.

Build the frontend bundle for production:
```bash
npm run build
```

---

## 🎓 Viva / Project Review Quick Reference

1. **Why Express.js & Mongoose?**
   Express provides a minimalist web framework for building REST APIs with middleware pipelines. Mongoose offers schema validation, type safety, relationship population (`.populate()`), and query building on top of MongoDB.
2. **How does Authentication work?**
   User passwords are encrypted with `bcryptjs` (salt rounds: 10) before saving in MongoDB. When logging in, the server issues a signed JSON Web Token (JWT) with the user ID and role. The frontend passes this token in the `Authorization: Bearer <token>` header for protected endpoints.
3. **How does Real-Time Tracking work?**
   When a provider dispatches, their GPS coordinates are sent via `POST /api/providers/location` and broadcast to room `booking:<bookingId>` using **Socket.IO**. The customer frontend listens on this room to smoothly animate the provider marker towards the destination coordinates.
4. **How does FixIt Assistant detect services?**
   The backend assistant engine scans queries for keywords and Tamil/Tanglish phrases to map them to categories (AC Repair, Plumbing, Electrical, Cleaning) and returns structured recommendations and tracking shortcuts.
