# DBeaver Local Database & Environment Setup Guide

This guide walks you step-by-step through setting up your local PostgreSQL database using **DBeaver**, running the schema scripts to create all tables, seeding initial data, and switching between **dev** and **prod** environments.

---

## 1. Local Database Credentials (TODO Configuration)

Your development connection settings in [`backend/src/main/resources/application-dev.yml`](file:///Users/vn5b52i/Projects/StayNest/backend/src/main/resources/application-dev.yml):

| Property | Default Value | Description |
| :--- | :--- | :--- |
| **Host** | `localhost` | Local machine |
| **Port** | `5432` | Standard PostgreSQL port |
| **Database** | `staynest` | Target database name |
| **Username** | `postgres` | **TODO**: Replace with your local PG user |
| **Password** | `postgres` | **TODO**: Replace with your local PG password |

---

## 2. Step-by-Step DBeaver Setup

### Step 2.1: Open DBeaver and Connect to PostgreSQL
1. Launch **DBeaver**.
2. Click the **New Database Connection** plug icon in the top-left (or go to `Database` -> `New Database Connection`).
3. Select **PostgreSQL** and click **Next**.
4. In the **Connection Settings** window:
   - **Host**: `localhost`
   - **Port**: `5432`
   - **Database**: `postgres` (initial administrative database)
   - **Authentication**: `Database Native`
   - **Username**: `postgres` (or your local superuser)
   - **Password**: Your local PostgreSQL password
5. Click **Test Connection ...** to confirm connectivity. (If prompted to download drivers, click **Download**).
6. Click **Finish**.

### Step 2.2: Create the `staynest` Database
1. In the **Database Navigator** pane on the left, expand your PostgreSQL connection.
2. Right-click on **Databases** -> select **Create New Database**.
3. Set **Database Name**: `staynest` (or `staynest_dev`).
4. Click **OK**.
5. Disconnect and edit connection to set **Database**: `staynest` (or right-click `staynest` -> **Set active**).

### Step 2.3: Execute the Schema Script to Create All Tables
1. Open the SQL Editor in DBeaver:
   - Press `Ctrl + ]` (or `Cmd + ]` on Mac), or right-click the `staynest` database -> **SQL Editor** -> **Open SQL console**.
2. Open the file [`database/01_create_schema.sql`](file:///Users/vn5b52i/Projects/StayNest/database/01_create_schema.sql) (or copy-paste its entire contents into the editor).
3. Click the **Execute SQL Script** button (or press `Alt + X` / `Option + X`).
4. In the Database Navigator on the left, expand `staynest` -> `Schemas` -> `public` -> `Tables`.
5. You will see all 24 created tables:
   - `users`, `owner_profiles`
   - `cities`, `localities`, `amenities`
   - `properties`, `property_amenities`, `property_photos`, `reviews`
   - `rooms`, `beds`, `inventory_holds`
   - `bookings`, `payments`, `refunds`
   - `tenants`, `tenant_stays`
   - `rent_invoices`, `rent_payments`
   - `income_records`, `expenses`
   - `subscription_plans`, `owner_subscriptions`, `audit_logs`

### Step 2.4: Seed Initial Demo Data
1. In DBeaver, open another SQL editor tab.
2. Open and paste the contents of [`database/02_seed_data.sql`](file:///Users/vn5b52i/Projects/StayNest/database/02_seed_data.sql).
3. Execute the script (`Alt + X` / `Option + X`).
4. This seeds:
   - Cities (`Bengaluru`, `Hyderabad`, `Pune`, `Chennai`, `Delhi NCR`)
   - Bengaluru Localities (`Koramangala`, `HSR Layout`, etc.)
   - Standard PG Amenities (`WIFI`, `AC`, `FOOD`, etc.)
   - Subscription Tiers (`STARTER`, `GROWTH`, `BUSINESS`)
   - Platform Admin: `admin@staynest.in` / `Admin@123456`
   - PG Owner: `owner@staynest.in` / `Owner@123456`
   - PG Listing: `StayNest Serene Living PG` with rooms and beds
   - Customer: `customer@staynest.in` / `Customer@123456`

---

## 3. Local Testing Database Options

You have two options for testing:

### Option A: Local In-Memory Database (No PostgreSQL required)
For fast unit tests and smoke testing without running PostgreSQL:
```bash
# Run with the in-memory test profile
mvn spring-boot:run -Dspring-boot.run.profiles=test
# or
java -Dspring.profiles.active=test -jar target/staynest-backend-0.0.1-SNAPSHOT.jar
```
This runs an in-memory database with PostgreSQL compatibility mode, auto-creates tables, runs tests, and discards state on shutdown.

### Option B: Local PostgreSQL Database (Using DBeaver)
Run against your live local PostgreSQL instance configured in DBeaver:
```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev
# or
java -Dspring.profiles.active=dev -jar target/staynest-backend-0.0.1-SNAPSHOT.jar
```

---

## 4. Two Different Environments (Dev vs Prod)

We configured separate Spring Boot profiles:

### 1. Development (`dev`) — [`application-dev.yml`](file:///Users/vn5b52i/Projects/StayNest/backend/src/main/resources/application-dev.yml)
- **Database**: Local PostgreSQL (`localhost:5432/staynest`)
- **DDL Mode**: `hibernate.ddl-auto: update` (automatically synchronizes schema changes)
- **SQL Logging**: `show-sql: true` with formatted queries and parameter binding logs
- **CORS**: Allows `http://localhost:3000` and `http://localhost:3001`
- **JWT**: Pre-configured development secret key

**How to run Dev:**
```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

### 2. Production (`prod`) — [`application-prod.yml`](file:///Users/vn5b52i/Projects/StayNest/backend/src/main/resources/application-prod.yml)
- **Database**: Strictly driven by environment variables (`${DB_URL}`, `${DB_USERNAME}`, `${DB_PASSWORD}`)
- **DDL Mode**: `hibernate.ddl-auto: validate` (prevents any accidental table alteration in production)
- **Connection Pool**: Optimized HikariCP pool (`maximum-pool-size: 20`, `minimum-idle: 5`)
- **Security**: Stack traces disabled in error responses (`include-stacktrace: never`)
- **JWT**: Requires secure `JWT_SECRET` environment variable
- **CORS**: Restricted to production domains (`https://staynest.in`)

**How to run Prod:**
```bash
export DB_URL="jdbc:postgresql://your-prod-host:5432/staynest_prod"
export DB_USERNAME="staynest_prod_user"
export DB_PASSWORD="YourStrongSecurePassword123!"
export JWT_SECRET="YourVeryLongAndSecureSecretKeyMustBeAtLeast256BitsLongForProdHS512"
export ALLOWED_ORIGINS="https://staynest.in,https://www.staynest.in"

cd backend
java -Dspring.profiles.active=prod -jar target/staynest-backend-0.0.1-SNAPSHOT.jar
```

