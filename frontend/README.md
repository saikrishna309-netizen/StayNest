# StayNest Frontend Web Application

This is the responsive web frontend for the **StayNest PG Discovery & Management Platform** as described in the technical blueprint.

## Architecture & Integration

- **Shared Database & Central Backend:**
  The frontend connects directly to the Spring Boot REST API (`http://localhost:8080/api/v1`), which queries the same PostgreSQL database (`staynest`).
- **Real-Time Synchronisation:**
  Any property, room, or bed created by an owner (such as *Venkateswra Gents PG*) immediately reflects on the public discovery portal.
- **Zero-Build Live Serving:**
  The frontend is directly embedded into Spring Boot (`src/main/resources/static/index.html`) so you can access it immediately at:
  👉 **`http://localhost:8080/`**

## Features Implemented

1. **Public PG Discovery:**
   - City and locality dynamic search filters (Bengaluru, Hyderabad, Pune, Delhi NCR, etc.).
   - Gender policy filters (`Gents / Boys Only`, `Ladies / Girls Only`, `Co-Ed`).
   - PG cards with photos, starting rents, locality, amenities, and verified badges.
2. **Floor-by-Floor Inventory Explorer (5-Floor View):**
   - Click "View Rooms & Beds" on any PG to see all 5 floors.
   - Shows 2-share (₹8,000/mo), 3-share (₹7,000/mo), and 4-share (₹6,500/mo) rooms with bed badges.
   - Real-time "Hold Bed" button with 15-minute reservation timer.
3. **Owner Portal (PMS):**
   - Real-time occupancy KPI cards (Total Beds, Available Beds, Occupancy Rate).
   - Property inventory list.
   - One-click CSV financial report export.
4. **Admin Moderation:**
   - Review pending listings queue.
   - One-click "Approve & Publish" button.
5. **Role-Based Authentication:**
   - Pre-filled demo buttons for Customer, Owner, and Admin.
   - Registration with role selection (`ROLE_CUSTOMER` or `ROLE_OWNER`).

