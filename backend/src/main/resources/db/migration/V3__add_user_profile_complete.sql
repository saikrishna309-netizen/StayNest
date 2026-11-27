-- Add is_profile_complete flag to users table so onboarding routing persists across logout/login
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_profile_complete BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET is_profile_complete = TRUE
WHERE full_name IS NOT NULL
  AND TRIM(full_name) <> ''
  AND full_name <> 'PG Owner'
  AND email NOT LIKE 'owner\_%';
