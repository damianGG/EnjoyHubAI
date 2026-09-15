# Test Users Setup

## ⚠️ Important Note

**Make sure you're using the latest version of this script!** If you copied this file earlier, please re-download it from the repository to ensure you have the correct UUID format.

The correct UUID for the regular user is: `b1eecd99-9d1c-4ef9-ac7e-7cc0ce491b22`

If you see an error like `invalid input syntax for type uuid: "b1ffcd99-9d1c-5fg9..."`, you have an old version of the file.

## Test Users Credentials

The script `17-create-test-users.sql` creates two test users with the following credentials:

### Host User
- **Email:** `host@host.com`
- **Password:** `Haslohost123`
- **Type:** Host (can create and manage properties)
- **Status:** Verified

### Regular User
- **Email:** `user@user.com`
- **Password:** `Haslouser123`
- **Type:** Regular user (guest)
- **Status:** Verified

## How to Use

### Method 1: Via Supabase Dashboard (Recommended)

1. Log in to your Supabase project dashboard
2. Go to the **SQL Editor**
3. Copy the contents of `scripts/17-create-test-users.sql`
4. Paste into the SQL editor
5. Click **Run** to execute the script

### Method 2: Via Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase db execute --file scripts/17-create-test-users.sql
```

### Method 3: Via psql (if you have direct database access)

```bash
psql -h your-supabase-host -U postgres -d postgres -f scripts/17-create-test-users.sql
```

## Logging In

After running the script, you can log in to the application using either set of credentials:

1. Go to your application's login page
2. Enter one of the email addresses above
3. Enter the corresponding password
4. Click login

## Security Notes

⚠️ **Important:** These are test users for **development and testing purposes only**. 

- **DO NOT** use these credentials in production
- **DO NOT** commit these credentials to public repositories (they're only acceptable in test scripts)
- Change or remove these test users before deploying to production
- Use strong, unique passwords for production user accounts

## Troubleshooting

### Users not appearing after running the script

1. Check if the `auth.users` table exists and has the correct permissions
2. Verify that the trigger `on_auth_user_created` exists and is active
3. Check the Supabase logs for any errors during execution

### Cannot log in with the credentials

1. Verify the users were created by running:
   ```sql
   SELECT id, email, is_host FROM public.users WHERE email IN ('host@host.com', 'user@user.com');
   ```
2. Check if email confirmation is required in your Supabase Auth settings
3. Ensure password requirements match (minimum length, special characters, etc.)

### Password hash not working

The script uses the PostgreSQL `crypt()` function with bcrypt ('bf' algorithm). Ensure:
- The `pgcrypto` extension is enabled in your Supabase database
- You're using a compatible version of PostgreSQL

To enable pgcrypto if needed:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Removing Test Users

To remove the test users when no longer needed:

```sql
-- Delete from auth.users (this will cascade to public.users if foreign key is set)
DELETE FROM auth.users WHERE email IN ('host@host.com', 'user@user.com');

-- If needed, delete from public.users explicitly
DELETE FROM public.users WHERE email IN ('host@host.com', 'user@user.com');
```
