-- Migration to update CHECK constraint for property_type values
-- Allows all valid property types: PG, HOSTEL, CO_LIVING, RENTAL_BUILDING

ALTER TABLE properties
DROP CONSTRAINT IF EXISTS "Properties_property_type_check";

ALTER TABLE properties
ADD CONSTRAINT "Properties_property_type_check"
CHECK (property_type IN ('PG', 'HOSTEL', 'CO_LIVING', 'RENTAL_BUILDING'));
