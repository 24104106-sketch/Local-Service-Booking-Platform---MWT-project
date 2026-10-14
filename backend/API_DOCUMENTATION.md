# FixIt Local - REST API Documentation

FixIt Local is a full-stack on-demand home services platform built with **Node.js, Express, MySQL (Sequelize ORM), Socket.IO**, and **React**.

## Base URL
- Local: `http://localhost:5000/api`

---

## Authentication & Headers
Protected endpoints require an `Authorization` header containing a JSON Web Token (JWT):
```http
Authorization: Bearer <jwt_token>
```

### Standard Response Format
All API responses follow a consistent JSON envelope:

#### Success Response
```json
{
  "success": true,
  "message": "Operation description",
  "data": { ... }
}
```

#### Error Response
```json
{
  "success": false,
  "message": "Reason for error",
  "errors": [ ... ]
}
```

---

## 1. Authentication Routes (`/api/auth`)

### `POST /api/auth/register`
Register a new customer or provider account.
- **Access**: Public
- **Body**:
  ```json
  {
    "name": "Ananya Rao",
    "email": "ananya@fixit.local",
    "password": "Password@123",
    "role": "customer", // "customer" | "provider"
    "phone": "9876543210",
    "address": "T. Nagar, Chennai",
    "city": "Chennai",
    "businessName": "Kumar Cooling Co.", // optional for provider
    "category": "AC Repair"              // optional for provider
  }
  ```
- **Response**: `201 Created` with `{ user, token }`

### `POST /api/auth/login`
Authenticate with email and password.
- **Access**: Public
- **Body**:
  ```json
  {
    "email": "ananya@fixit.local",
    "password": "Password@123"
  }
  ```
- **Response**: `200 OK` with `{ user, token }`

### `GET /api/auth/me`
Retrieve the currently authenticated user's profile.
- **Access**: Private (Any authenticated role)

### `PUT /api/auth/profile`
Update user profile fields (name, phone, address, city, avatar).
- **Access**: Private

---

## 2. Services Routes (`/api/services`)

### `GET /api/services`
Get all active services with optional filtering and search.
- **Access**: Public
- **Query Params**:
  - `category`: Filter by category (e.g. `AC Repair`, `Plumbing`, `Cleaning`)
  - `search`: Keyword search in title, description, and tags
  - `minPrice`, `maxPrice`: Price range filters
  - `sort`: `price_asc` | `price_desc` | `rating`

### `GET /api/services/categories`
Get list of distinct service categories and their item counts.
- **Access**: Public

### `GET /api/services/:id`
Get single service details by ID.
- **Access**: Public

### `POST /api/services`
Create a new service.
- **Access**: Admin only

### `PUT /api/services/:id`
Update an existing service.
- **Access**: Admin only

### `DELETE /api/services/:id`
Delete a service.
- **Access**: Admin only

---

## 3. Provider Routes (`/api/providers`)

### `GET /api/providers`
List verified and approved service providers.
- **Access**: Public
- **Query Params**: `category`, `availableOnly`, `search`

### `GET /api/providers/:id`
Get provider profile and reviews.
- **Access**: Public

### `GET /api/providers/profile/me`
Get current provider's profile.
- **Access**: Provider only

### `PUT /api/providers/profile/me`
Update provider business details, rates, bio, and availability.
- **Access**: Provider only

### `POST /api/providers/location`
Live GPS beacon update from provider app.
- **Access**: Provider only
- **Body**: `{ "lat": 13.0827, "lng": 80.2707, "bookingId": "..." }`
- **Socket Event Broadcast**: Emits `provider_location_update` to `booking:<bookingId>`

### `GET /api/providers/dashboard/stats`
Provider dashboard metrics (total bookings, active bookings, total earnings).
- **Access**: Provider only

---

## 4. Booking Routes (`/api/bookings`)

### `POST /api/bookings`
Place a new service booking.
- **Access**: Customer
- **Body**:
  ```json
  {
    "serviceId": "66d...",
    "providerId": "66d...", // optional (auto-assigned if omitted)
    "date": "2026-09-10",
    "time": "10:00 AM",
    "address": {
      "street": "Flat 4B, Shanthi Apts, T. Nagar",
      "city": "Chennai",
      "pincode": "600017",
      "lat": 13.0418,
      "lng": 80.2341
    },
    "paymentMethod": "cash", // "cash" | "card" | "wallet" | "upi"
    "customerNotes": "Please inspect cooling coil."
  }
  ```

### `GET /api/bookings`
Get bookings for authenticated user (role-aware: customer views theirs, provider views assigned, admin views all).
- **Access**: Private

### `GET /api/bookings/:id`
Get booking details and timeline.
- **Access**: Private (Customer, Provider, or Admin)

### `PUT /api/bookings/:id/status`
Progress booking lifecycle.
- **Access**: Private
- **Body**:
  ```json
  {
    "status": "on_the_way", // confirmed | provider_assigned | on_the_way | arrived | in_progress | completed | cancelled
    "note": "Technician has dispatched"
  }
  ```

### `PUT /api/bookings/:id/reschedule`
Reschedule date/time.
- **Access**: Private
- **Body**: `{ "date": "2026-09-12", "time": "02:00 PM" }`

### `PUT /api/bookings/:id/cancel`
Cancel booking.
- **Access**: Private
- **Body**: `{ "reason": "No longer needed" }`

### `GET /api/bookings/:id/location`
Get live coordinates and tracking status for active booking.
- **Access**: Private

---

## 5. Chat Routes (`/api/chat`)

### `GET /api/chat/conversations`
Get all active conversations for the user.
- **Access**: Private

### `GET /api/chat/conversations/:id/messages`
Get message thread history by conversation or booking ID.
- **Access**: Private

### `POST /api/chat/messages`
Send a real-time chat message.
- **Access**: Private
- **Body**: `{ "bookingId": "...", "text": "I am waiting at the gate." }`

---

## 6. FixIt Assistant Chatbot Routes (`/api/chatbot`)

### `GET /api/chatbot/history`
Get user-isolated conversation history with FixIt Assistant.
- **Access**: Private

### `POST /api/chatbot/message`
Send message to FixIt Assistant. Supports **English, Tamil, and Tanglish**.
- **Access**: Private
- **Body**: `{ "message": "AC cooling illa enna panrathu?" }`
- **Response**: `{ "userMessage": { ... }, "assistantMessage": { ... } }`

### `DELETE /api/chatbot/history`
Clear conversation history.
- **Access**: Private

---

## 7. Wallet Routes (`/api/wallet`)

### `GET /api/wallet`
Get current balance and currency.
- **Access**: Private

### `GET /api/wallet/transactions`
Get wallet credit/debit transaction log.
- **Access**: Private

### `POST /api/wallet/topup`
Top-up wallet balance (demo payments).
- **Access**: Private
- **Body**: `{ "amount": 500, "paymentMethod": "UPI" }`

### `POST /api/wallet/pay`
Pay for a booking using wallet funds.
- **Access**: Private
- **Body**: `{ "amount": 599, "bookingId": "...", "bookingNumber": "FIX-1001" }`

---

## 8. Admin Routes (`/api/admin`)

### `GET /api/admin/metrics`
Dashboard KPI metrics (users, bookings, platform revenue, open complaints).
- **Access**: Admin only

### `GET /api/admin/users`
List users with role and status filters.
- **Access**: Admin only

### `PUT /api/admin/users/:id/status`
Suspend or activate a user account.
- **Access**: Admin only
- **Body**: `{ "status": "suspended" }` // "active" | "suspended"

### `GET /api/admin/providers/pending`
List provider applications awaiting verification.
- **Access**: Admin only

### `PUT /api/admin/providers/:id/verify`
Approve or reject a provider application.
- **Access**: Admin only
- **Body**: `{ "action": "approve" }` // "approve" | "reject"

---

## 9. Recently Accessed Routes (`/api/recently-accessed`)

### `GET /api/recently-accessed`
Retrieve recently viewed services and providers for the authenticated user, ordered latest first.
- **Access**: Private (Authenticated user)
- **Query Params**: `limit` (default: 10, max: 20)
- **Response**: `200 OK` with populated list of active services and approved providers.

### `POST /api/recently-accessed`
Record or update an access timestamp for a viewed service or provider. Automatically upserts and refreshes `accessed_at` timestamp instead of creating duplicate records.
- **Access**: Private (Authenticated user)
- **Body**:
  ```json
  {
    "itemType": "service", // "service" | "provider"
    "itemId": 1,
    "metadata": { "source": "search" } // optional
  }
  ```
- **Response**: `200 OK` or `201 Created`

### `DELETE /api/recently-accessed/:id`
Clear specific item or entire recently accessed history.
- **Access**: Private (Authenticated user)
- **Response**: `200 OK`

---

## Real-Time Events (Socket.IO)

Clients connect to `ws://localhost:5000` and emit/listen to:
- `join_user`: `socket.emit("join_user", userId)`
- `join_booking`: `socket.emit("join_booking", bookingId)`
- `leave_booking`: `socket.emit("leave_booking", bookingId)`
- `provider_location_update`: Real-time GPS beacon update
- `booking_status_update`: Live status lifecycle changes
- `new_booking_message`: Customer-provider chat messages
