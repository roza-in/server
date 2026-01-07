# ROZX Healthcare Platform - Backend API

A comprehensive healthcare appointment booking and consultation management system built with Node.js, Express, TypeScript, and Supabase.

## 🚀 Features

- **Authentication**: OTP-based phone authentication with JWT tokens
- **User Roles**: Patient, Doctor, Hospital Admin, Super Admin
- **Hospital Management**: Hospital profiles, verification, doctor management
- **Doctor Management**: Doctor profiles, specializations, availability
- **Appointment Booking**: Pre-booked and walk-in appointments
- **Schedule Management**: Flexible doctor schedules with overrides
- **Video Consultations**: Agora-powered video consultations
- **Payments**: Razorpay integration with automatic fee calculation
- **Notifications**: Multi-channel notifications (SMS, WhatsApp, Email, Push)
- **Real-time Updates**: WebSocket support for live queue updates

## 📁 Project Structure

```
src/
├── common/           # Shared utilities (errors, logger, response, validators)
├── config/           # Configuration (env, database, JWT, constants)
├── database/         # Database schema and migrations
├── health/           # Health check endpoints
├── middlewares/      # Express middlewares (auth, error, rate-limit)
├── modules/          # Feature modules
│   ├── appointments/ # Appointment booking & management
│   ├── auth/         # Authentication & OTP
│   ├── consultations/# Video consultations & prescriptions
│   ├── doctors/      # Doctor profiles & availability
│   ├── hospitals/    # Hospital management
│   ├── notifications/# Multi-channel notifications
│   ├── payments/     # Payment processing
│   └── schedules/    # Doctor schedules
├── routes/           # API route definitions
└── types/            # TypeScript type definitions
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 5
- **Language**: TypeScript 5.9
- **Database**: PostgreSQL (Supabase)
- **Validation**: Zod 4
- **Auth**: JWT (jsonwebtoken)
- **Payments**: Razorpay
- **Video**: Agora SDK

## 📋 Prerequisites

- Node.js 20 or higher
- npm or yarn
- Supabase account
- PostgreSQL database

## 🚀 Getting Started

### 1. Clone and Install

```bash
cd server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `JWT_SECRET`: Secret key for JWT (min 32 characters)

### 3. Setup Database

Run the SQL schema in your Supabase SQL editor:

```bash
# Copy contents of src/database/schema.sql to Supabase SQL editor
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start at `http://localhost:3000`

### 5. Build for Production

```bash
npm run build
npm start
```

## 📡 API Endpoints

### Health Check
- `GET /health` - Health check
- `GET /health/ready` - Readiness check
- `GET /health/live` - Liveness check

### Authentication
- `POST /api/v1/auth/send-otp` - Send OTP
- `POST /api/v1/auth/verify-otp` - Verify OTP
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - Logout

### Hospitals
- `GET /api/v1/hospitals` - List hospitals
- `GET /api/v1/hospitals/:id` - Get hospital
- `PUT /api/v1/hospitals/:id` - Update hospital

### Doctors
- `GET /api/v1/doctors` - List doctors
- `GET /api/v1/doctors/:id` - Get doctor
- `GET /api/v1/doctors/:id/availability` - Get availability

### Appointments
- `POST /api/v1/appointments` - Book appointment
- `GET /api/v1/appointments` - List appointments
- `GET /api/v1/appointments/:id` - Get appointment
- `PATCH /api/v1/appointments/:id/status` - Update status
- `POST /api/v1/appointments/:id/cancel` - Cancel appointment

### Payments
- `POST /api/v1/payments/order` - Create payment order
- `POST /api/v1/payments/verify` - Verify payment
- `GET /api/v1/payments/:id` - Get payment details

## 🔐 Authentication

The API uses JWT tokens for authentication:

1. Send OTP to phone number
2. Verify OTP to receive access & refresh tokens
3. Include access token in Authorization header: `Bearer <token>`
4. Refresh token when expired

## 💳 Payment Flow

1. Book appointment (status: pending_payment)
2. Create Razorpay order
3. Complete payment on client
4. Verify payment signature
5. Appointment confirmed

## 📝 License

Proprietary - ROZX Healthcare Platform

## 🤝 Support

For support, contact the development team.
