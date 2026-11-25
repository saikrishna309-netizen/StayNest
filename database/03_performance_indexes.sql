-- StayNest Performance Indexes for Fast Login, Property Lookup, and Tenancy Queries
-- Safe to run multiple times (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties (owner_id);
CREATE INDEX IF NOT EXISTS idx_tenant_stays_property_status ON tenant_stays (property_id, status);
CREATE INDEX IF NOT EXISTS idx_rent_invoices_property_month ON rent_invoices (property_id, billing_month);
CREATE INDEX IF NOT EXISTS idx_expense_records_owner_date ON expense_records (owner_id, transaction_date);
