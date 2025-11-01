-- Helper script to set up a super admin user for testing
-- This script should be run after a user has registered

-- Set an existing user as super admin by email
-- Replace 'admin@example.com' with the actual email

-- Update the user's role
UPDATE users 
SET role = 'super_admin' 
WHERE email = 'admin@example.com';

-- Verify the update
SELECT id, email, role, full_name, is_host
FROM users
WHERE email = 'admin@example.com';

-- Alternative: Set super admin by user ID
-- UPDATE users 
-- SET role = 'super_admin' 
-- WHERE id = 'your-user-id-here';

-- To set multiple super admins:
-- UPDATE users 
-- SET role = 'super_admin' 
-- WHERE email IN ('admin1@example.com', 'admin2@example.com');

-- To list all super admins:
-- SELECT id, email, full_name, created_at
-- FROM users
-- WHERE role = 'super_admin';

-- To remove super admin privileges:
-- UPDATE users 
-- SET role = 'host'  -- or 'user'
-- WHERE email = 'admin@example.com';
