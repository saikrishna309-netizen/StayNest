# StayNest Partner - Mobile-First PG Discovery & Management App

A modern, production-grade **React + Vite + TypeScript + Tailwind CSS** Progressive Web App (PWA) built specifically for PG & Hostel Owners and Tenants across India.

---

## 🏗️ Architecture & Folder Structure

```text
frontend/
├── public/
│   └── manifest.json          # PWA Mobile App Manifest (Install on Android/iOS)
├── src/
│   ├── api/                   # Modular API clients communicating with Spring Boot REST endpoints
│   │   ├── client.ts          # Base fetch client with auto Bearer JWT injection
│   │   ├── auth.api.ts        # /api/v1/auth (Login, Register, Refresh)
│   │   ├── property.api.ts    # /api/v1/properties & /api/v1/owner/properties
│   │   ├── tenant.api.ts      # /api/v1/owner/tenants & /stays (Onboarding, Bed allocation)
│   │   └── finance.api.ts     # /api/v1/owner/rent-invoices, payments, & expenses
│   │
│   ├── context/               # Global Application State
│   │   ├── AuthContext.tsx    # JWT token persistence, user profile, role-based gates
│   │   └── ToastContext.tsx   # Floating notification banners
│   │
│   ├── components/            # Reusable UI Components
│   │   ├── layout/
│   │   │   ├── Navbar.tsx           # Desktop top bar with brand & user avatar
│   │   │   └── MobileBottomNav.tsx  # Smartphone bottom navigation for on-the-go PG Owners
│   │   └── modals/
│   │       ├── AuthModal.tsx            # Login & Register with 1-click Quick Demo Sign In
│   │       ├── OnboardTenantModal.tsx   # Cascade: Property -> Room -> Available Bed -> Dates -> Rent/Deposit
│   │       ├── AssignBedModal.tsx       # 1-click bed allocation dialog for existing tenants
│   │       └── PropertyDetailModal.tsx  # 5-Floor room explorer & 15-minute bed hold locks
│   │
│   ├── pages/                 # Role-based Screens
│   │   ├── public/ExplorePage.tsx       # Real-time multi-param PG discovery
│   │   ├── owner/OwnerDashboard.tsx     # Mobile-first PMS (Overview, Inventory, Stays, Bills, Expenses)
│   │   └── tenant/TenantDashboard.tsx   # Guest bookings & active stay verification
│   │
│   ├── types/index.ts         # TypeScript models mapped directly to Spring Boot backend DTOs
│   ├── App.tsx                # Main view router & modal coordinator
│   ├── main.tsx               # Application bootstrap
│   └── index.css              # Tailwind directives & typography
│
├── package.json               # Dependencies (React 18, Vite 5, Tailwind 3)
├── tsconfig.json              # Strict TypeScript configuration
├── vite.config.ts             # Vite bundler configuration & /api proxy to port 8080
└── tailwind.config.js         # Indigo & Emerald theme palette
```

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js 18+ and npm installed

### Quick Start
```bash
cd frontend
npm install
npm run dev
```

The application will start on **`http://localhost:3000`** and proxy API requests automatically to the Spring Boot backend on **`http://localhost:8080`**.

---

## 📱 Mobile App (PWA) Features for PG Owners
- **Install on Phone**: Open in Safari or Chrome on mobile, tap "Add to Home Screen" to install as a standalone native app.
- **Onboard in 30 Seconds**: Take Aadhaar details and immediately allocate an available bed from the room dropdown.
- **Offline Rent Collection**: Mark rent bills as PAID with Cash or UPI with 1 tap.
- **Daily Expense Logging**: Record grocery, milk, electricity, and maintenance costs instantly.

---

## ☁️ Deploying to Production (Vercel / Netlify / Cloudflare)
1. Push this folder to a GitHub repository.
2. Import the project into [Vercel](https://vercel.com) or [Netlify](https://netlify.com).
3. Set environment variable:
   ```text
   VITE_API_URL=https://your-backend-api.com/api/v1
   ```
4. Build Command: `npm run build` | Output Directory: `dist`.
