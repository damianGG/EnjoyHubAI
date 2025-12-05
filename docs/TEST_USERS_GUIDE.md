# Test Users Guide

## Overview

For testing and development purposes, we provide a SQL script that creates two predefined users in the database. This allows developers and testers to quickly set up test accounts without going through the signup process.

## Test User Credentials

### 1. Host User (Property Owner)
- **Email:** `host@host.com`
- **Password:** `Haslohost123`
- **User Type:** Host
- **Permissions:** Can create and manage properties, attractions, and offers
- **Status:** Email verified

### 2. Regular User (Guest)
- **Email:** `user@user.com`
- **Password:** `Haslouser123`
- **User Type:** Regular User/Guest
- **Permissions:** Can browse, book, and review properties
- **Status:** Email verified

## Installation

### Prerequisites
- Access to Supabase project dashboard or CLI
- Database with `auth.users` and `public.users` tables properly configured
- `pgcrypto` extension enabled (for password hashing)

### Method 1: Supabase Dashboard (Recommended)

1. Open your Supabase project at [app.supabase.com](https://app.supabase.com)
2. Navigate to **SQL Editor** in the left sidebar
3. Create a new query
4. Copy the entire contents of `/scripts/17-create-test-users.sql`
5. Paste into the SQL editor
6. Click **RUN** button
7. Verify the output shows both users were created

### Method 2: Supabase CLI

```bash
# Navigate to project root
cd /path/to/EnjoyHubAI

# Run the SQL script
supabase db execute --file scripts/17-create-test-users.sql

# Verify users were created
supabase db query "SELECT id, email, is_host FROM public.users WHERE email IN ('host@host.com', 'user@user.com');"
```

### Method 3: Direct PostgreSQL Connection

If you have direct database access:

```bash
psql -h your-db-host -U postgres -d postgres -f scripts/17-create-test-users.sql
```

## Usage

### Logging In

1. Navigate to your application's login page (typically `/login` or `/auth/login`)
2. Enter the email address for the user you want to test with
3. Enter the corresponding password
4. Submit the login form

**Example for host user:**
```
Email: host@host.com
Password: Haslohost123
```

**Example for regular user:**
```
Email: user@user.com
Password: Haslouser123
```

### Testing Different User Flows

#### As a Host User (`host@host.com`)
- Create new properties
- Edit existing properties
- Manage bookings for your properties
- View booking statistics
- Upload property images
- Set pricing and availability

#### As a Regular User (`user@user.com`)
- Browse available properties
- Search and filter properties
- View property details
- Make bookings
- Leave reviews
- Manage favorites
- View booking history

## Technical Details

### Password Hashing

Passwords are hashed using bcrypt algorithm via PostgreSQL's `pgcrypto` extension:

```sql
encrypted_password = crypt('Haslohost123', gen_salt('bf'))
```

This matches Supabase's authentication system which uses bcrypt for password storage.

### User IDs

The script uses fixed UUIDs for consistency across environments:

- Host user: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`
- Regular user: `b1ffcd99-9d1c-5fg9-cc7e-7cc0ce491b22`

### Database Tables

The script inserts into two tables:

1. **`auth.users`** - Supabase authentication table
   - Contains authentication credentials
   - Managed by Supabase Auth service
   - Password is stored encrypted

2. **`public.users`** - Application user profile table
   - Contains user profile information
   - Used by application logic
   - Synced via database trigger

### Automatic Synchronization

A database trigger (`on_auth_user_created`) automatically creates entries in `public.users` when users are inserted into `auth.users`. However, the script also manually inserts into `public.users` to ensure consistency.

## Verification

After running the script, verify the users were created:

```sql
-- Check public.users table
SELECT id, email, full_name, is_host, is_verified, created_at
FROM public.users
WHERE email IN ('host@host.com', 'user@user.com')
ORDER BY email;

-- Check auth.users table (if you have access)
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email IN ('host@host.com', 'user@user.com')
ORDER BY email;
```

Expected output should show both users with:
- ✅ Valid UUIDs
- ✅ Correct email addresses
- ✅ Email confirmed timestamps
- ✅ Proper is_host values (true for host, false for user)

## Troubleshooting

### Issue: "relation 'auth.users' does not exist"

**Cause:** You don't have access to the auth schema, or Supabase Auth is not properly set up.

**Solution:** 
- Ensure you're connected to the correct Supabase database
- Run the script through Supabase Dashboard SQL Editor which has proper permissions
- Verify Supabase Auth is enabled in your project settings

### Issue: "duplicate key value violates unique constraint"

**Cause:** Users with these emails or IDs already exist.

**Solution:**
```sql
-- Delete existing test users first
DELETE FROM auth.users WHERE email IN ('host@host.com', 'user@user.com');
DELETE FROM public.users WHERE email IN ('host@host.com', 'user@user.com');

-- Then run the creation script again
```

### Issue: Cannot log in with the credentials

**Possible causes:**
1. Email confirmation required - Check Supabase Auth settings → disable email confirmation for development
2. Password requirements not met - The passwords meet common requirements (8+ chars, uppercase, lowercase, numbers)
3. Users not properly created - Verify using the SQL queries above

**Solutions:**
```sql
-- Update email confirmation status if needed
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email IN ('host@host.com', 'user@user.com');
```

### Issue: "function gen_salt does not exist"

**Cause:** The pgcrypto extension is not enabled.

**Solution:**
```sql
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Security Considerations

⚠️ **IMPORTANT SECURITY NOTES:**

1. **Development Only**: These test users are for development and testing environments ONLY
2. **Never in Production**: DO NOT use these credentials in production environments
3. **Remove Before Deployment**: Delete or disable these accounts before deploying to production
4. **Public Credentials**: These credentials are documented and should be considered public knowledge
5. **Change Passwords**: If you accidentally deploy with these users, change their passwords immediately

### Removing Test Users

To remove test users from your database:

```sql
-- Remove from auth.users (will cascade to public.users if FK is set)
DELETE FROM auth.users 
WHERE email IN ('host@host.com', 'user@user.com');

-- Explicitly remove from public.users if needed
DELETE FROM public.users 
WHERE email IN ('host@host.com', 'user@user.com');

-- Verify removal
SELECT COUNT(*) as remaining_test_users 
FROM public.users 
WHERE email IN ('host@host.com', 'user@user.com');
-- Should return 0
```

### Production Checklist

Before deploying to production:

- [ ] Remove or disable test user accounts
- [ ] Verify no test credentials exist in the production database
- [ ] Ensure email confirmation is enabled
- [ ] Review user registration and authentication flows
- [ ] Set up proper password policies
- [ ] Configure rate limiting on authentication endpoints
- [ ] Enable multi-factor authentication (if applicable)

## Related Documentation

- [Supabase Authentication Documentation](https://supabase.com/docs/guides/auth)
- [Database Setup Guide](./SETUP_GUIDE.md)
- [Development Guide](../README.md)

## Support

If you encounter issues not covered in this guide:

1. Check the Supabase dashboard logs for error messages
2. Review the database schema in `/scripts/01-create-tables.sql`
3. Verify the user sync trigger in `/scripts/02-fix-user-sync.sql`
4. Open an issue in the project repository with:
   - Error messages
   - Steps to reproduce
   - Your environment details (local/staging/development)
