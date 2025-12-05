-- Create test users for development and testing
-- This script creates two users in the auth.users table with specific credentials
-- The trigger will automatically create corresponding entries in the public.users table

-- User 1: Host user
-- Email: host@host.com
-- Password: Haslohost123
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'authenticated',
  'authenticated',
  'host@host.com',
  crypt('Haslohost123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Host User"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- User 2: Regular user
-- Email: user@user.com
-- Password: Haslouser123
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'b1ffcd99-9d1c-5fg9-cc7e-7cc0ce491b22',
  'authenticated',
  'authenticated',
  'user@user.com',
  crypt('Haslouser123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Regular User"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Manually insert into public.users table (in case the trigger doesn't fire)
-- This ensures the users exist in the public schema for the application to use
INSERT INTO public.users (id, email, full_name, is_host, is_verified, created_at) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'host@host.com', 'Host User', true, true, NOW()),
  ('b1ffcd99-9d1c-5fg9-cc7e-7cc0ce491b22', 'user@user.com', 'Regular User', false, true, NOW())
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  is_host = EXCLUDED.is_host,
  is_verified = EXCLUDED.is_verified;

-- Verify the users were created
SELECT id, email, full_name, is_host, is_verified, created_at
FROM public.users
WHERE email IN ('host@host.com', 'user@user.com')
ORDER BY email;
