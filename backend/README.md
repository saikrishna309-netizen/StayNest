# StayNest Backend - Spring Boot REST APIs

Complete Java Spring Boot 3.3.x backend implementation for StayNest based on the Technical Blueprint.

---

## Database Configuration (TODOs)

The database credentials in [application.yml](file:///Users/vn5b52i/Projects/StayNest/backend/src/main/resources/application.yml) are marked with `TODO`:

```yaml
spring:
  datasource:
    # =========================================================================
    # TODO: CONFIGURE YOUR POSTGRESQL DATABASE CREDENTIALS HERE
    # You can set these via environment variables or replace the defaults below.
    # =========================================================================
    url: ${DB_URL:jdbc:postgresql://localhost:5432/staynest} # TODO: Database connection URL
    username: ${DB_USERNAME:postgres}                        # TODO: Database username
    password: ${DB_PASSWORD:postgres}                        # TODO: Database password
    driver-class-name: org.postgresql.Driver
```

You can supply your production credentials via environment variables:
```bash
export DB_URL="jdbc:postgresql://<HOST>:<PORT>/staynest"
export DB_USERNAME="<YOUR_DB_USER>"
export DB_PASSWORD="<YOUR_DB_PASSWORD>"
```
Or run with in-memory H2 profile for zero-config testing:
```bash
mvn spring-boot:run -Dspring-boot.run.profiles=h2
```

---

## Implemented API Modules & Endpoints

### 1. Authentication & Users (`/api/v1/auth`, `/api/v1/users`)
- `POST /api/v1/auth/register` - Create customer or owner account
- `POST /api/v1/auth/login` - Authenticate user & get JWT tokens
- `POST /api/v1/auth/logout` - Revoke session
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/verify-email` - Verify email token
- `POST /api/v1/auth/verify-phone` - Verify phone OTP
- `POST /api/v1/auth/forgot-password` - Start password recovery
- `POST /api/v1/auth/reset-password` - Complete password reset
- `GET /api/v1/users/me` - Read current profile
- `PATCH /api/v1/users/me` - Update profile fields

### 2. Property Discovery (`/api/v1`)
- `GET /api/v1/cities` - List supported cities
- `GET /api/v1/localities?cityId=...` - List localities for a city
- `GET /api/v1/properties` - Search and filter published listings
- `GET /api/v1/properties/{propertyId}` - Detailed property view
- `GET /api/v1/properties/{propertyId}/availability` - Bed availability for stay dates
- `GET /api/v1/properties/{propertyId}/reviews` - Verified stay reviews

### 3. Owner Property & Inventory (`/api/v1/owner`)
- `POST /api/v1/owner/properties` - Create draft property
- `GET /api/v1/owner/properties` - List owner's properties
- `GET /api/v1/owner/properties/{id}` - Read own property
- `PATCH /api/v1/owner/properties/{id}` - Update property
- `POST /api/v1/owner/properties/{id}/submit` - Submit for admin review
- `POST /api/v1/owner/properties/{id}/photos` - Add photo metadata
- `POST /api/v1/owner/properties/{id}/rooms` - Create room
- `PATCH /api/v1/owner/rooms/{roomId}` - Update room
- `POST /api/v1/owner/rooms/{roomId}/beds` - Add bed inventory
- `PATCH /api/v1/owner/beds/{bedId}` - Update bed status
- `PUT /api/v1/owner/properties/{id}/rates` - Configure rates
- `PUT /api/v1/owner/properties/{id}/availability` - Set availability status

### 4. Bookings (`/api/v1/bookings`)
- `POST /api/v1/bookings/holds` - 15-minute temporary bed hold
- `POST /api/v1/bookings` - Create booking (supports `Idempotency-Key`)
- `GET /api/v1/bookings/{id}` - Read booking
- `GET /api/v1/customer/bookings` - List customer's bookings
- `GET /api/v1/owner/bookings` - List bookings for owner's properties
- `POST /api/v1/bookings/{id}/cancel` - Cancel booking per policy
- `POST /api/v1/owner/bookings/{id}/check-in` - Record check-in
- `POST /api/v1/owner/bookings/{id}/check-out` - Record check-out

### 5. Payments & Refunds (`/api/v1/payments`)
- `POST /api/v1/payments/orders` - Create gateway order for booking
- `GET /api/v1/payments/{id}` - Get payment status
- `POST /api/v1/payments/webhooks/{provider}` - Webhook ingestion & reconciliation
- `POST /api/v1/payments/{id}/refunds` - Initiate refund
- `GET /api/v1/owner/payments` - Owner payment collection history

### 6. Tenants & Accounting (`/api/v1/owner`)
- `POST /api/v1/owner/tenants` - Create tenant profile
- `GET /api/v1/owner/tenants` - Search & list tenants
- `GET /api/v1/owner/tenants/{id}` - Read tenant
- `PATCH /api/v1/owner/tenants/{id}` - Update tenant
- `POST /api/v1/owner/tenants/{id}/stays` - Record tenant stay
- `POST /api/v1/owner/rent-invoices` - Create monthly rent invoice
- `GET /api/v1/owner/rent-invoices` - List invoices and due status
- `POST /api/v1/owner/rent-invoices/{id}/payments` - Record cash/UPI rent collection
- `POST /api/v1/owner/income` - Record other income (food, laundry)
- `GET /api/v1/owner/income` - List income
- `POST /api/v1/owner/expenses` - Record property expense
- `GET /api/v1/owner/expenses` - List expenses
- `GET /api/v1/owner/reports/monthly` - Monthly financial summary (billed vs collected, surplus)
- `GET /api/v1/owner/reports/occupancy` - Real-time occupancy metrics
- `GET /api/v1/owner/reports/export?format=csv` - CSV financial report download

### 7. SaaS Subscriptions & Admin Oversight (`/api/v1`)
- `GET /api/v1/subscription-plans` - List subscription plans (Starter, Growth, Business)
- `POST /api/v1/owner/subscriptions` - Activate/change owner subscription
- `GET /api/v1/owner/subscription` - View active owner subscription
- `POST /api/v1/subscriptions/webhooks/{provider}` - Ingest subscription webhooks
- `GET /api/v1/admin/properties/pending` - Pending listings for approval
- `POST /api/v1/admin/properties/{id}/approve` - Approve & publish listing
- `POST /api/v1/admin/properties/{id}/reject` - Reject listing with reason
- `GET /api/v1/admin/users` - User directory
- `GET /api/v1/admin/subscriptions` - Platform subscriptions overview
- `GET /api/v1/admin/audit-logs` - Platform audit logs

---

## Interactive Swagger Documentation
Access the OpenAPI UI when running locally:
- **Swagger UI**: [http://localhost:8080/swagger-ui/index.html](http://localhost:8080/swagger-ui/index.html)
- **OpenAPI JSON**: [http://localhost:8080/api-docs](http://localhost:8080/api-docs)
- **Actuator Health**: [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health)

