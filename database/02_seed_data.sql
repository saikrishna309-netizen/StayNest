-- =============================================================================
-- StayNest Initial Seed Data (PostgreSQL)
-- Execute this script in DBeaver after running 01_create_schema.sql
-- =============================================================================

-- 1. Cities in India
INSERT INTO cities (id, name, state, active) VALUES
('6b31843d-a7cc-46ad-8ad0-8b4b2cfc8c04', 'Bengaluru', 'Karnataka', TRUE),
('50a4cbb1-b71c-4b03-b5d7-cee3cef45240', 'Hyderabad', 'Telangana', TRUE),
('a5a5684c-8506-4d40-9396-7db9f63bc45b', 'Pune', 'Maharashtra', TRUE),
('6c79fd1a-1eed-4ac7-9c50-b9c7ad498286', 'Chennai', 'Tamil Nadu', TRUE),
('c81f027e-f566-4115-9f91-f3054fbf6c81', 'Delhi NCR', 'Delhi', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 2. Localities for Bengaluru
INSERT INTO localities (id, city_id, name, pincode, active) VALUES
('b1111111-1111-1111-1111-111111111111', '6b31843d-a7cc-46ad-8ad0-8b4b2cfc8c04', 'Koramangala', '560034', TRUE),
('b2222222-2222-2222-2222-222222222222', '6b31843d-a7cc-46ad-8ad0-8b4b2cfc8c04', 'HSR Layout', '560102', TRUE),
('b3333333-3333-3333-3333-333333333333', '6b31843d-a7cc-46ad-8ad0-8b4b2cfc8c04', 'Indiranagar', '560038', TRUE),
('b4444444-4444-4444-4444-444444444444', '6b31843d-a7cc-46ad-8ad0-8b4b2cfc8c04', 'Whitefield', '560066', TRUE),
('b5555555-5555-5555-5555-555555555555', '6b31843d-a7cc-46ad-8ad0-8b4b2cfc8c04', 'Electronic City', '560100', TRUE)
ON CONFLICT DO NOTHING;

-- 3. Standard Amenities
INSERT INTO amenities (code, name, category, icon) VALUES
('WIFI', 'High-speed Wi-Fi', 'Connectivity', 'wifi'),
('AC', 'Air Conditioning', 'Comfort', 'wind'),
('FOOD', '3 Times Daily Meals (North/South)', 'Dining', 'utensils'),
('WASHING_MACHINE', 'Automatic Washing Machine', 'Laundry', 'tshirt'),
('POWER_BACKUP', '24/7 Power Backup', 'Utility', 'bolt'),
('HOUSEKEEPING', 'Daily Room Housekeeping', 'Service', 'broom'),
('CCTV', 'CCTV & Biometric Access', 'Security', 'shield-alt'),
('RO_WATER', 'Purified RO Drinking Water', 'Utility', 'tint')
ON CONFLICT (code) DO NOTHING;

-- 4. Subscription Tiers (Prices in Paise: ₹999 = 99900 paise)
INSERT INTO subscription_plans (id, plan_code, name, price_monthly_paise, max_properties, max_rooms, max_staff_seats, reports_access, export_access, active) VALUES
('d1111111-1111-1111-1111-111111111111', 'STARTER', 'Starter PG Plan', 99900, 1, 10, 1, TRUE, FALSE, TRUE),
('d2222222-2222-2222-2222-222222222222', 'GROWTH', 'Growth Multi-Property Plan', 249900, 5, 50, 3, TRUE, FALSE, TRUE),
('d3333333-3333-3333-3333-333333333333', 'BUSINESS', 'Business Enterprise Plan', 499900, 20, 250, 10, TRUE, TRUE, TRUE)
ON CONFLICT (plan_code) DO NOTHING;

-- 5. Default Administrator (Password: Admin@123456 -> BCrypt encrypted)
INSERT INTO users (id, full_name, email, phone, password_hash, role, status, email_verified, phone_verified) VALUES
('a0000000-0000-0000-0000-000000000001', 'StayNest Administrator', 'admin@staynest.in', '9999900000', '$2a$10$wN1G159K3qA55uY4aQ8tFOPzRk3bA18N9eD50aK1F7nB56bVd1q.K', 'ROLE_ADMIN', 'ACTIVE', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- 6. Demo Owner (Password: Owner@123456)
INSERT INTO users (id, full_name, email, phone, password_hash, role, status, email_verified, phone_verified) VALUES
('d4890645-eccf-4b4f-9a38-be68f5ec3a28', 'Ramesh Kumar', 'owner@staynest.in', '9888811111', '$2a$10$wN1G159K3qA55uY4aQ8tFOPzRk3bA18N9eD50aK1F7nB56bVd1q.K', 'ROLE_OWNER', 'ACTIVE', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO owner_profiles (id, user_id, business_name, pan_number, verification_status, payout_upi) VALUES
('e1111111-1111-1111-1111-111111111111', 'd4890645-eccf-4b4f-9a38-be68f5ec3a28', 'Kumar Luxury Living', 'ABCDE1234F', 'VERIFIED', 'ramesh@okhdfcbank')
ON CONFLICT (user_id) DO NOTHING;

-- 7. Demo PG Listing
INSERT INTO properties (
    id, owner_id, name, property_type, gender_policy, description,
    city_id, locality_id, address_line, pincode, latitude, longitude,
    approval_status, published, starting_price_paise, notice_period_days,
    deposit_months, food_included, pay_at_property_allowed, rules, cancellation_policy, published_at
) VALUES (
    'f1111111-1111-1111-1111-111111111111',
    'd4890645-eccf-4b4f-9a38-be68f5ec3a28',
    'StayNest Serene Living PG',
    'PG',
    'CO_ED',
    'Premium co-living PG with high-speed internet, chef-prepared meals, daily housekeeping and 24x7 security in HSR Layout Sector 2.',
    '6b31843d-a7cc-46ad-8ad0-8b4b2cfc8c04',
    'b2222222-2222-2222-2222-222222222222',
    '#42, 14th Main, Sector 2, HSR Layout',
    '560102',
    12.9121,
    77.6446,
    'APPROVED',
    TRUE,
    850000,
    30,
    1,
    TRUE,
    TRUE,
    'Quiet hours after 10:30 PM. Smoking not permitted inside rooms.',
    'Free cancellation up to 7 days before check-in. 50% refund thereafter.',
    CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- Amenities for PG
INSERT INTO property_amenities (property_id, amenity_code) VALUES
('f1111111-1111-1111-1111-111111111111', 'WIFI'),
('f1111111-1111-1111-1111-111111111111', 'AC'),
('f1111111-1111-1111-1111-111111111111', 'FOOD'),
('f1111111-1111-1111-1111-111111111111', 'WASHING_MACHINE'),
('f1111111-1111-1111-1111-111111111111', 'POWER_BACKUP'),
('f1111111-1111-1111-1111-111111111111', 'HOUSEKEEPING'),
('f1111111-1111-1111-1111-111111111111', 'CCTV'),
('f1111111-1111-1111-1111-111111111111', 'RO_WATER')
ON CONFLICT DO NOTHING;

-- Rooms and Beds
INSERT INTO rooms (id, property_id, room_number, sharing_type, capacity, floor_number, rent_monthly_paise, deposit_paise, status) VALUES
('a1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', '101', 'DOUBLE', 2, 1, 950000, 950000, 'AVAILABLE'),
('a2222222-2222-2222-2222-222222222222', 'f1111111-1111-1111-1111-111111111111', '102', 'SINGLE', 1, 1, 1600000, 1600000, 'AVAILABLE')
ON CONFLICT DO NOTHING;

INSERT INTO beds (id, room_id, property_id, bed_label, active, status) VALUES
('b0000001-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'Bed A', TRUE, 'AVAILABLE'),
('b0000002-0000-0000-0000-000000000002', 'a1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'Bed B', TRUE, 'AVAILABLE'),
('b0000003-0000-0000-0000-000000000003', 'a2222222-2222-2222-2222-222222222222', 'f1111111-1111-1111-1111-111111111111', 'Bed 1', TRUE, 'AVAILABLE')
ON CONFLICT DO NOTHING;

-- 8. Demo Customer (Password: Customer@123456)
INSERT INTO users (id, full_name, email, phone, password_hash, role, status, email_verified, phone_verified) VALUES
('c0000000-0000-0000-0000-000000000001', 'Priya Sharma', 'customer@staynest.in', '9777722222', '$2a$10$wN1G159K3qA55uY4aQ8tFOPzRk3bA18N9eD50aK1F7nB56bVd1q.K', 'ROLE_CUSTOMER', 'ACTIVE', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;
