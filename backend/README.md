# FixIt Local — Real Backend (Node.js, Express, Prisma, PostgreSQL & Socket.IO)

This is the production-ready backend for **FixIt Local** — a three-role local service booking platform (Customer, Service Provider, Admin).

---

## 🚀 Tech Stack

- **Runtime:** Node.js (ES Modules)
- **Web Framework:** Express 4
- **Database & ORM:** PostgreSQL 16 with Prisma ORM
- **Local Dev / Zero-Docker Fallback:** SQLite with Prisma ORM
- **Authentication:** JWT (Access Token 15m + Refresh Token 7d), bcrypt for password hashing
- **Input Validation:** Zod schemas
- **Real-Time:** Socket.IO (Live Provider Tracking & Customer ↔ Provider Chat)
- **File Uploads:** Multer with local disk storage abstraction (`IStorageService`)
- **Testing:** Vitest + Supertest (100% passing tests)

---

## 📁 Directory Structure

```
backend/
├── docker-compose.yml           # PostgreSQL 16 + pgAdmin 4 containers
├── .env.example                 # Example environment variables
├── .env                         # Active configuration
├── package.json
├── prisma/
│   ├── schema.prisma            # Production PostgreSQL schema
│   ├── schema.sqlite.prisma     # Zero-dependency local SQLite schema
│   └── seed.js                  # Complete database seed script
└── src/
    ├── app.js                   # Express application setup
    ├── server.js                # HTTP + Socket.IO server entry point
    ├── config/
    │   ├── db.js                # Prisma client singleton
    │   └── env.js               # Environment loader & validator
    ├── controllers/
    │   ├── adminController.js
    │   ├── authController.js
    │   ├── bookingController.js
    │   ├── categoryController.js
    │   ├── complaintController.js
    │   ├── messageController.js
    │   ├── notificationController.js
    │   ├── providerController.js
    │   ├── reviewController.js
    │   ├── serviceController.js
    │   └── walletController.js
    ├── middlewares/
    │   ├── auth.js              # JWT verification + suspended user check
    │   ├── errorHandler.js      # Centralized error handler
    │   ├── rateLimiter.js       # IP rate limiting
    │   ├── roleCheck.js         # Role-based access control
    │   └── validate.js          # Zod schema validation
    ├── routes/                  # Express route routers
    ├── services/
    │   ├── bookingStateMachine.js # Strict booking lifecycle state machine
    │   ├── logService.js        # Audit logging service
    │   └── storageService.js    # Local disk file storage service
    ├── sockets/
    │   └── socketHandler.js     # Socket.IO chat & live GPS tracking
    └── tests/
        └── api.test.js          # Vitest test suite (22 tests)
```

---

## ⚡ Quick Start

### Option A: Local Zero-Docker Dev (SQLite)

No Docker or PostgreSQL install required!

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Push SQLite database schema and seed:**
   ```bash
   # Windows PowerShell:
   $env:DATABASE_URL="file:./dev.db"; npx prisma db push --schema=prisma/schema.sqlite.prisma
   $env:DATABASE_URL="file:./dev.db"; node prisma/seed.js

   # Linux / macOS:
   DATABASE_URL="file:./dev.db" npx prisma db push --schema=prisma/schema.sqlite.prisma
   DATABASE_URL="file:./dev.db" node prisma/seed.js
   ```

3. **Start backend server:**
   ```bash
   # Windows PowerShell:
   $env:DATABASE_URL="file:./dev.db"; npm run dev

   # Linux / macOS:
   DATABASE_URL="file:./dev.db" npm run dev
   ```

Backend server runs at `http://localhost:5000`.

---

### Option B: Docker Compose (PostgreSQL 16 + pgAdmin)

1. **Start Docker containers:**
   ```bash
   docker-compose up -d
   ```
   - PostgreSQL runs on `localhost:5432`
   - pgAdmin 4 runs on `http://localhost:5050` (Login: `admin@fixit.com` / `admin123`)

2. **Run migrations and seed:**
   ```bash
   npm run prisma:generate
   npm run prisma:push
   npm run prisma:seed
   ```

3. **Start backend server:**
   ```bash
   npm run dev
   ```

---

## 👥 Seeded Demo Accounts

All demo accounts use password: `password123`

| Role | Name | Email | Password |
|---|---|---|---|
| **Customer** | Ananya Rao | `customer@fixit.com` | `password123` |
| **Provider** | Kumar Cooling Co. | `provider@fixit.com` | `password123` |
| **Admin** | Admin User | `admin@fixit.com` | `password123` |
| **Provider** | SparkleHome | `sparklehome@fixit.com` | `password123` |
| **Provider** | QuickFix Plumbers | `quickfix@fixit.com` | `password123` |
| **Provider** | PowerLine Services | `powerline@fixit.com` | `password123` |
| **Provider** | SafeHome Pest Care | `safehome@fixit.com` | `password123` |
| **Provider** | WoodCraft Experts | `woodcraft@fixit.com` | `password123` |

---

## 🧪 Running Tests

Run the Vitest test suite:

```bash
# Windows PowerShell:
$env:DATABASE_URL="file:./dev.db"; npx vitest run

# Linux / macOS:
DATABASE_URL="file:./dev.db" npx vitest run
```

All 22 unit, integration, and security tests run against the SQLite database and verify:
- Health check
- Booking state machine transition rules
- Self-registration security (blocks admin privilege escalation)
- Zod schema input validation
- Public services & providers listings
- Complete booking lifecycle (Pending → Confirmed → On The Way → Arrived → Service Started → Completed)
- Wallet balance dynamic derivation
- Reviews & complaints creation
- Admin platform statistics

---

## 📡 REST API Reference

### Auth
- `POST /api/auth/register` — Public registration (`customer` or `provider`). Admin self-registration is strictly rejected.
- `POST /api/auth/login` — Returns `{ token, refreshToken, user }`. Blocks suspended users.
- `POST /api/auth/refresh` — Generates a new access token using refresh token.
- `GET /api/auth/me` — Returns current logged-in user profile.
- `PATCH /api/auth/profile` — Updates current user profile and optional password.

### Services
- `GET /api/services` — List services (supports `?category`, `?search`, `?provider`).
- `GET /api/services/:id` — Single service details with provider info.
- `POST /api/services` — Create service (Provider / Admin only).
- `PATCH /api/services/:id` — Update service.
- `DELETE /api/services/:id` — Delete service.

### Providers
- `GET /api/providers` — List verified active providers with GPS coordinates.
- `GET /api/providers/:identifier` — Get provider by ID or URL-encoded name.
- `GET /api/providers/:identifier/services` — Get all services offered by provider.
- `GET /api/providers/stats` — Active services, today's bookings, completed jobs, monthly earnings.
- `GET /api/providers/availability` — Provider weekly working hour slots.

### Bookings & State Machine
- `GET /api/bookings` — Filtered automatically by user role (Customer sees own, Provider sees jobs, Admin sees all).
- `GET /api/bookings/:id` — Full booking details.
- `POST /api/bookings` — Creates booking in `Pending` status and notifies provider.
- `PATCH /api/bookings/:id/cancel` — Cancels booking (Customer or Provider).
- `PATCH /api/bookings/:id/accept` — Provider accepts (`Pending` → `Confirmed`).
- `PATCH /api/bookings/:id/reject` — Provider rejects (`Pending` → `Rejected`).
- `PATCH /api/bookings/:id/start-travel` — Provider starts travel (`Confirmed` → `On The Way`).
- `PATCH /api/bookings/:id/arrived` — Provider reaches address (`On The Way` → `Arrived`).
- `PATCH /api/bookings/:id/start-service` — Provider begins work (`Arrived` → `Service Started`).
- `PATCH /api/bookings/:id/complete` — Provider completes job (`Service Started` → `Completed`), marks payment `Paid`, and credits provider wallet.
- `PATCH /api/bookings/:id/reschedule` — Updates booking date/time.

### Reviews & Complaints
- `GET /api/reviews` — Lists reviews.
- `POST /api/reviews` — Customer posts review for completed service; updates provider average rating.
- `GET /api/complaints` — Lists user or platform complaints.
- `POST /api/complaints` — Customer raises complaint against provider/booking.
- `PATCH /api/complaints/:id/status` — Admin updates complaint resolution.

### Wallet
- `GET /api/wallet` — Calculates derived balance from transaction history (`credits` - `debits`).
- `POST /api/wallet/topup` — Credits wallet via UPI, card, etc.

### Categories & Admin
- `GET /api/categories` — Categories with live service counts.
- `POST /api/categories` — Create category (Admin only).
- `GET /api/admin/stats` — Platform stats (`totalUsers`, `activeProviders`, `totalBookings`, `revenue`).
- `GET /api/admin/users` — List platform users.
- `PATCH /api/admin/users/:id/status` — Suspend or activate user account.
- `GET /api/admin/provider-applications` — New provider applications.
- `PATCH /api/admin/provider-applications/:id` — Approve/Reject application.
- `GET /api/admin/logs` — System audit logs.

### File Uploads
- `POST /api/upload` — Multipart form-data file upload (Images / documents). Saved to disk and returns static URL.

---

## 🔌 Socket.IO Real-Time Events

Connect client to `http://localhost:5000`:

```javascript
import { io } from "socket.io-client";
const socket = io("http://localhost:5000");
```

### Live Provider GPS Tracking:
```javascript
// Customer joins tracking room for booking
socket.emit("join_tracking", bookingId);

// Provider broadcasts live coordinates
socket.emit("update_location", {
  bookingId: "BK1043",
  lat: 13.0827,
  lng: 80.2707,
  heading: 45,
  speed: 25
});

// Customer receives real-time position updates
socket.on("location_update", (data) => {
  console.log("Provider position:", data.lat, data.lng);
});
```

### In-App Customer ↔ Provider Chat:
```javascript
// Join booking conversation room
socket.emit("join_chat", bookingId);

// Send message
socket.emit("send_message", {
  bookingId: "BK1043",
  senderName: "Ananya Rao",
  senderRole: "customer",
  text: "Hello! Are you on the way?"
});

// Receive message
socket.on("new_message", (message) => {
  console.log("New message:", message.text);
});
```

---

## 🔗 Connecting Frontend to Backend

In the React frontend, set the following in your `.env` (or toggle):

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_USE_REAL_API=true
```

`src/api/realApi.js` seamlessly maps all mockApi function calls to real HTTP requests against the Express server!
