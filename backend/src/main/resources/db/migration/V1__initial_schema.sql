-- =============================================================================
-- StayNest Database Schema (PostgreSQL)
-- Complete DDL for India-focused PG and Hostel Discovery & Management Platform
-- =============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. USERS & IDENTITY
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'ROLE_CUSTOMER',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    phone_otp VARCHAR(10),
    password_reset_token VARCHAR(255),
    password_reset_expiry TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- -----------------------------------------------------------------------------
-- 2. OWNER PROFILES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS owner_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(150),
    pan_number VARCHAR(20),
    gst_number VARCHAR(30),
    verification_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    verification_notes TEXT,
    payout_upi VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_ifsc VARCHAR(20),
    emergency_phone VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_owner_profiles_user ON owner_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_owner_profiles_status ON owner_profiles(verification_status);

-- -----------------------------------------------------------------------------
-- 3. CITIES & LOCALITIES (LOCATION)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    state VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS localities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    pincode VARCHAR(10),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_localities_city ON localities(city_id);

-- -----------------------------------------------------------------------------
-- 4. AMENITIES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    icon VARCHAR(50)
);

-- -----------------------------------------------------------------------------
-- 5. PROPERTIES (PG / HOSTEL LISTINGS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    property_type VARCHAR(30) NOT NULL DEFAULT 'PG',
    gender_policy VARCHAR(30) NOT NULL DEFAULT 'CO_ED',
    description VARCHAR(2000),
    city_id UUID NOT NULL REFERENCES cities(id),
    locality_id UUID REFERENCES localities(id),
    address_line VARCHAR(255),
    pincode VARCHAR(10),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    approval_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    rejection_reason TEXT,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    starting_price_paise BIGINT NOT NULL DEFAULT 0,
    notice_period_days INT NOT NULL DEFAULT 30,
    deposit_months INT NOT NULL DEFAULT 1,
    food_included BOOLEAN NOT NULL DEFAULT FALSE,
    pay_at_property_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    rules VARCHAR(2000),
    cancellation_policy VARCHAR(2000),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city_id);
CREATE INDEX IF NOT EXISTS idx_properties_locality ON properties(locality_id);
CREATE INDEX IF NOT EXISTS idx_properties_published ON properties(published, approval_status);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(starting_price_paise);

-- Property Amenities join table
CREATE TABLE IF NOT EXISTS property_amenities (
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    amenity_code VARCHAR(50) NOT NULL,
    PRIMARY KEY (property_id, amenity_code)
);

-- Property Photos
CREATE TABLE IF NOT EXISTS property_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    photo_url VARCHAR(500) NOT NULL,
    caption VARCHAR(255),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_property_photos_property ON property_photos(property_id);

-- -----------------------------------------------------------------------------
-- 6. ROOMS & BEDS (INVENTORY)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    sharing_type VARCHAR(30) NOT NULL DEFAULT 'DOUBLE',
    capacity INT NOT NULL DEFAULT 2,
    floor_number INT DEFAULT 1,
    rent_monthly_paise BIGINT NOT NULL DEFAULT 0,
    deposit_paise BIGINT DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rooms_property ON rooms(property_id);

CREATE TABLE IF NOT EXISTS beds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    bed_label VARCHAR(50) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_beds_room ON beds(room_id);
CREATE INDEX IF NOT EXISTS idx_beds_property ON beds(property_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status, active);

-- -----------------------------------------------------------------------------
-- 7. TEMPORARY HOLDS & BOOKINGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_holds_bed ON inventory_holds(bed_id, expires_at);

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_code VARCHAR(30) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_PAYMENT',
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    payment_choice VARCHAR(30) NOT NULL DEFAULT 'ONLINE',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    subtotal_paise BIGINT NOT NULL DEFAULT 0,
    deposit_paise BIGINT DEFAULT 0,
    fees_paise BIGINT DEFAULT 0,
    total_paise BIGINT NOT NULL DEFAULT 0,
    amount_due_paise BIGINT NOT NULL DEFAULT 0,
    cancellation_policy_snapshot VARCHAR(1000),
    idempotency_key VARCHAR(100) UNIQUE,
    checked_in_at TIMESTAMPTZ,
    checked_out_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_bed ON bookings(bed_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(bed_id, check_in, check_out);

-- -----------------------------------------------------------------------------
-- 8. PAYMENTS & REFUNDS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    method VARCHAR(30) NOT NULL DEFAULT 'ONLINE',
    provider VARCHAR(50) NOT NULL DEFAULT 'RAZORPAY',
    provider_order_id VARCHAR(100),
    provider_payment_id VARCHAR(100),
    provider_signature VARCHAR(255),
    amount_paise BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    idempotency_key VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_order ON payments(provider_order_id);

CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    amount_paise BIGINT NOT NULL DEFAULT 0,
    reason TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    provider_refund_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 9. TENANTS & STAYS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    emergency_contact VARCHAR(100),
    id_proof_type VARCHAR(50),
    id_proof_number VARCHAR(50),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_id);

CREATE TABLE IF NOT EXISTS tenant_stays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
    check_in DATE NOT NULL,
    check_out DATE,
    monthly_rent_paise BIGINT NOT NULL DEFAULT 0,
    security_deposit_paise BIGINT DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stays_tenant ON tenant_stays(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stays_property ON tenant_stays(property_id);

-- -----------------------------------------------------------------------------
-- 10. RENT INVOICES & COLLECTIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rent_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    billing_month VARCHAR(10) NOT NULL,
    rent_amount_paise BIGINT NOT NULL DEFAULT 0,
    utility_amount_paise BIGINT DEFAULT 0,
    other_charges_paise BIGINT DEFAULT 0,
    total_amount_paise BIGINT NOT NULL DEFAULT 0,
    paid_amount_paise BIGINT NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DUE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_property_month ON rent_invoices(property_id, billing_month);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON rent_invoices(tenant_id);

CREATE TABLE IF NOT EXISTS rent_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES rent_invoices(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    amount_paid_paise BIGINT NOT NULL DEFAULT 0,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'UPI',
    reference_number VARCHAR(100),
    notes TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rent_payments_invoice ON rent_payments(invoice_id);

-- -----------------------------------------------------------------------------
-- 11. INCOME & EXPENSES (ACCOUNTING)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS income_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    amount_paise BIGINT NOT NULL DEFAULT 0,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_income_owner_date ON income_records(owner_id, transaction_date);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    amount_paise BIGINT NOT NULL DEFAULT 0,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    attachment_key VARCHAR(255),
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_owner_date ON expenses(owner_id, transaction_date);

-- -----------------------------------------------------------------------------
-- 12. SUBSCRIPTIONS (SAAS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    price_monthly_paise BIGINT NOT NULL DEFAULT 0,
    max_properties INT NOT NULL DEFAULT 1,
    max_rooms INT NOT NULL DEFAULT 10,
    max_staff_seats INT NOT NULL DEFAULT 1,
    reports_access BOOLEAN NOT NULL DEFAULT TRUE,
    export_access BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS owner_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL,
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_owner_subs_owner ON owner_subscriptions(owner_id);

-- -----------------------------------------------------------------------------
-- 13. AUDIT LOGS & REVIEWS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    details VARCHAR(2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment VARCHAR(2000),
    published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reviews_property ON reviews(property_id);
