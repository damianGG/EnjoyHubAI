# OAuth Setup Guide

This guide explains how to set up Facebook and Instagram OAuth authentication for the EnjoyHub application.

## Prerequisites

- A Supabase project (configured in your `.env` file)
- A Facebook Developer account
- Access to your Supabase Dashboard

## Facebook OAuth Setup

### 1. Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "My Apps" and then "Create App"
3. Choose "Consumer" as the app type
4. Fill in the app details:
   - App Name: EnjoyHub (or your preferred name)
   - App Contact Email: Your email address
5. Click "Create App"

### 2. Configure Facebook Login

1. In your Facebook App dashboard, find "Facebook Login" in the left sidebar
2. Click "Settings" under Facebook Login
3. Add the following to "Valid OAuth Redirect URIs":
   ```
   https://[YOUR-SUPABASE-PROJECT-REF].supabase.co/auth/v1/callback
   ```
   Replace `[YOUR-SUPABASE-PROJECT-REF]` with your actual Supabase project reference

4. Save changes

### 3. Get Your App Credentials

1. Go to Settings > Basic in your Facebook App
2. Copy the "App ID" and "App Secret"
3. You'll need these for Supabase configuration

### 4. Configure Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Navigate to Authentication > Providers
3. Find "Facebook" and enable it
4. Enter your Facebook App ID and App Secret
5. Save the configuration

## Instagram OAuth Setup

**Important:** Instagram login uses Facebook Login under the hood. You need to configure Facebook OAuth first (see above).

### 1. Enable Instagram Basic Display

1. In your Facebook App dashboard, add "Instagram Basic Display" product
2. Click "Create New App" when prompted
3. Enter required details

### 2. Configure Instagram Display

1. Go to Instagram Basic Display > Basic Display
2. Add the same OAuth Redirect URI as Facebook:
   ```
   https://[YOUR-SUPABASE-PROJECT-REF].supabase.co/auth/v1/callback
   ```

### 3. Note About Instagram OAuth

The Instagram OAuth implementation in this application uses Facebook's OAuth with the `instagram_basic` scope. This means:
- Users authenticate through Facebook
- The app requests access to their Instagram account
- Both Facebook and Instagram share the same OAuth credentials

## Environment Variables

Make sure your `.env` or `.env.local` file contains:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Site URL for OAuth redirects
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # For development
# NEXT_PUBLIC_SITE_URL=https://yourdomain.com  # For production
```

**Note:** Facebook App ID and Secret are configured in Supabase, not in your application's environment variables.

## Testing OAuth Integration

### Local Development Testing

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/auth/login` or `/auth/sign-up`

3. Click on "Kontynuuj z Facebook" or "Kontynuuj z Instagram"

4. You should be redirected to Facebook's OAuth page

5. After authentication, you'll be redirected back to your application

### Production Deployment

When deploying to production:

1. Update your Facebook App's Valid OAuth Redirect URIs to include your production URL
2. Update `NEXT_PUBLIC_SITE_URL` environment variable to your production domain
3. Ensure your Supabase project has the same OAuth providers configured

## Troubleshooting

### "Invalid OAuth Redirect URI" Error

- Verify that the redirect URI in Facebook App settings matches your Supabase callback URL exactly
- Make sure there are no trailing slashes or typos

### "App Not Set Up" Error

- Ensure Facebook Login product is added to your Facebook App
- Check that your App ID and Secret are correctly entered in Supabase

### Users Not Being Created in Database

- The `/auth/callback` route handles user creation automatically
- Check your Supabase logs for any errors during the callback process
- Verify that your `users` table schema matches the expected structure

### Instagram Login Not Working

- Remember that Instagram OAuth uses Facebook credentials
- Make sure the Facebook OAuth is working first
- Verify that Instagram Basic Display is properly configured in your Facebook App

## Security Notes

- Never commit your Facebook App Secret to version control
- Always use HTTPS in production for OAuth redirects
- Regularly review and rotate your OAuth credentials
- Keep your Supabase anon key secure (it's safe to expose in client-side code, but protect your service role key)

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
- [Instagram Basic Display API](https://developers.facebook.com/docs/instagram-basic-display-api)
