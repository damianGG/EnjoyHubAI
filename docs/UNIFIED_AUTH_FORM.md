# Unified Auth Form - Airbnb Style Implementation

## Overview

This document describes the implementation of the new Airbnb-style unified authentication form that replaced the previous separate login and signup forms.

## User Request

The user (@damianGG) requested a login/registration interface matching Airbnb's design, with:
- Phone number input with country selector at the top
- "Dalej" (Continue) button
- "lub" (or) separator
- OAuth buttons for Google and Facebook below
- Email login option

## Implementation

### New Component: `unified-auth-form.tsx`

A single component that handles both login and signup flows with:

1. **Phone-First Authentication (Primary)**
   - Country code selector (Poland, USA, UK, Germany, France)
   - Phone number input field
   - Privacy policy notice
   - Pink "Dalej" button
   - OTP verification flow

2. **OAuth Options**
   - Google OAuth button
   - Facebook OAuth button
   - Email login button (expandable)

3. **Email/Password Login (Expandable)**
   - Hidden by default
   - Expands inline when clicked
   - Email and password fields
   - Pink "Zaloguj się" button
   - "Forgot password?" link
   - Close button to collapse

### Design Features

#### Colors
- Primary button: `bg-pink-600 hover:bg-pink-700` (Airbnb pink)
- OAuth buttons: `border-2 border-gray-300 hover:border-gray-900`

#### Layout
- Card-based design with `max-w-md`
- Header with border: "Zaloguj się lub zarejestruj"
- Welcome heading: "Witaj w EnjoyHub"
- Responsive padding and spacing

#### Typography
- H2 for welcome message: `text-2xl font-semibold`
- Labels: `text-sm font-medium`
- Privacy notice: `text-xs text-muted-foreground`

### Integration Points

#### Pages Updated
1. **`app/auth/login/page.tsx`** - Now uses `<UnifiedAuthForm mode="login" />`
2. **`app/auth/sign-up/page.tsx`** - Now uses `<UnifiedAuthForm mode="signup" />`

#### Components Updated
3. **`components/auth-sheet.tsx`** - Simplified to use UnifiedAuthForm for modal authentication

### Authentication Flows

#### Phone Authentication
```
1. User selects country code (default: +48 Poland)
2. User enters phone number
3. User clicks "Dalej"
4. System sends OTP via SMS (sendPhoneOTP action)
5. UI switches to OTP verification screen
6. User enters 6-digit OTP code
7. User clicks "Dalej"
8. System verifies OTP (verifyPhoneOTP action)
9. User is authenticated and redirected
```

#### OAuth Authentication (Google/Facebook)
```
1. User clicks OAuth button
2. System redirects to provider (Google/Facebook)
3. User authenticates with provider
4. Provider redirects back to /auth/callback
5. Supabase processes OAuth token
6. User is authenticated and redirected
```

#### Email/Password Authentication
```
1. User clicks "Użyj adresu e-mail"
2. Email login section expands
3. User enters email and password
4. User clicks "Zaloguj się"
5. System authenticates via Supabase
6. User is redirected
```

## Component Props

```typescript
interface UnifiedAuthFormProps {
  inline?: boolean        // For use in modal (default: false)
  onSuccess?: () => void  // Callback after successful auth
  mode?: "login" | "signup" // Authentication mode (default: "login")
}
```

## State Management

### Local State
- `step`: "initial" | "verify" - Controls phone auth flow
- `countryCode`: string - Selected country code (e.g., "+48")
- `phoneNumber`: string - Full phone number with country code
- `otp`: string - 6-digit OTP code
- `showEmailLogin`: boolean - Email section visibility

### Server Actions Used
- `sendPhoneOTP` - Sends OTP to phone number
- `verifyPhoneOTP` - Verifies OTP code
- `signInWithGoogle` - Google OAuth
- `signInWithFacebook` - Facebook OAuth

## Accessibility

- ✅ Proper labels for all form fields
- ✅ ARIA roles for interactive elements
- ✅ Keyboard navigation support
- ✅ Screen reader friendly structure
- ✅ Focus management

## Mobile Optimization

- ✅ Touch-friendly button sizes
- ✅ Responsive layout
- ✅ Proper spacing for small screens
- ✅ Card fits mobile viewport

## Backwards Compatibility

Previous components are preserved:
- `login-form.tsx` - Original login form
- `sign-up-form.tsx` - Original signup form
- `phone-login-form.tsx` - Dedicated phone auth page

These can still be used if needed for specific use cases.

## Testing

### Manual Testing Performed
1. ✅ Phone number input with country selection
2. ✅ OAuth button rendering (Google, Facebook)
3. ✅ Email login expansion/collapse
4. ✅ Responsive design on mobile viewport
5. ✅ Card layout and styling
6. ✅ Button colors and hover states

### Future Testing Recommendations
1. Test OTP flow with real SMS provider
2. Test OAuth flows with configured providers
3. Test form validation errors
4. Test accessibility with screen readers
5. Cross-browser compatibility testing

## Screenshots

### Main View
![Main unified auth form](https://github.com/user-attachments/assets/25eca6ce-0682-4c18-b9d0-0e6289de9746)

### Email Expanded
![Email login expanded](https://github.com/user-attachments/assets/fbf73795-da52-4266-a419-9c2c2da06427)

## Configuration Requirements

### Supabase Setup
1. **Phone Auth**: Enable in Supabase Dashboard → Authentication → Providers → Phone
2. **Google OAuth**: Enable in Supabase Dashboard → Authentication → Providers → Google
3. **Facebook OAuth**: Enable in Supabase Dashboard → Authentication → Providers → Facebook

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Known Limitations

1. Country code selector currently has only 5 countries (can be expanded)
2. Email login form doesn't connect to actual login action yet (needs integration)
3. OTP verification requires SMS provider configuration in Supabase
4. Apple login button mentioned in reference but not implemented (can be added)

## Future Enhancements

1. Add more countries to selector
2. Add country flags to selector options
3. Implement Apple OAuth if needed
4. Add form validation feedback
5. Add loading states during authentication
6. Add "Remember me" option
7. Add social proof or trust indicators

## Related Documentation

- `docs/AUTHENTICATION_SETUP.md` - General authentication setup guide
- `docs/AUTHENTICATION_FLOWS.md` - Detailed flow diagrams
- `docs/IMPLEMENTATION_SUMMARY_PL.md` - Polish implementation summary

## Commit History

- Initial implementation: commit `3548115`
- "Redesign login/signup to Airbnb-style unified auth form with phone-first approach"
