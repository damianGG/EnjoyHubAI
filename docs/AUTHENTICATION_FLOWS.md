# Authentication Flows Diagram

## Overview of Authentication Methods

```
┌─────────────────────────────────────────────────────────────────┐
│                    EnjoyHub Authentication                       │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐│
│  │   Email/    │  │   Google    │  │  Facebook/  │  │  Phone  ││
│  │  Password   │  │    OAuth    │  │  Instagram  │  │   SMS   ││
│  │ (Existing)  │  │ (Existing)  │  │    (NEW)    │  │  (NEW)  ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 1. Facebook/Instagram OAuth Flow

```
┌──────────────┐
│    User      │
│  clicks      │
│ "Facebook"   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  signInWithFacebook()                    │
│  lib/actions.ts                          │
│  ┌────────────────────────────────────┐  │
│  │ supabase.auth.signInWithOAuth({    │  │
│  │   provider: 'facebook',            │  │
│  │   redirectTo: '/auth/callback'     │  │
│  │ })                                 │  │
│  └────────────────────────────────────┘  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Facebook Authorization Page             │
│  (User logs in with Facebook/Instagram)  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  /auth/callback                          │
│  (Supabase handles token exchange)       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  User Authenticated                      │
│  - Session created                       │
│  - User profile synced to users table    │
│  - Redirected to home page               │
└──────────────────────────────────────────┘
```

## 2. Phone Authentication (SMS OTP) Flow

```
┌──────────────┐
│    User      │
│  clicks      │
│"Login SMS"   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Step 1: Phone Number Entry              │
│  /auth/phone-login                       │
│  components/phone-login-form.tsx         │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ Enter: +48 123 456 789             │ │
│  │ [Send SMS Code] button             │ │
│  └────────────────────────────────────┘ │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  sendPhoneOTP(formData)                  │
│  lib/actions.ts                          │
│  ┌────────────────────────────────────┐  │
│  │ supabase.auth.signInWithOtp({      │  │
│  │   phone: phoneStr                  │  │
│  │ })                                 │  │
│  └────────────────────────────────────┘  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  SMS Provider (Twilio/SMSApi.pl)         │
│  Sends 6-digit OTP code to phone         │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Step 2: OTP Verification                │
│  components/phone-login-form.tsx         │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ Enter OTP: [1][2][3][4][5][6]     │ │
│  │ [Verify and Login] button          │ │
│  └────────────────────────────────────┘ │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  verifyPhoneOTP(formData)                │
│  lib/actions.ts                          │
│  ┌────────────────────────────────────┐  │
│  │ supabase.auth.verifyOtp({          │  │
│  │   phone: phoneStr,                 │  │
│  │   token: otpCode,                  │  │
│  │   type: 'sms'                      │  │
│  │ })                                 │  │
│  └────────────────────────────────────┘  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  User Authenticated                      │
│  - Session created                       │
│  - Phone number saved to users table     │
│  - Redirected to home page               │
└──────────────────────────────────────────┘
```

## 3. Component Integration

```
┌─────────────────────────────────────────────────────────┐
│                    App Pages                            │
│                                                          │
│  /auth/login          /auth/sign-up    /auth/phone-login│
│       │                     │                  │         │
│       └─────────┬───────────┘                  │         │
│                 ▼                               ▼         │
│         ┌───────────────┐            ┌─────────────────┐ │
│         │  LoginForm    │            │ PhoneLoginForm  │ │
│         │  (modified)   │            │    (NEW)        │ │
│         │               │            │                 │ │
│         │  - Google     │            │  - Phone input  │ │
│         │  - Facebook ★ │            │  - OTP input ★  │ │
│         │  - Email/Pass │            │  - Verify ★     │ │
│         │  - "SMS" link★│            │                 │ │
│         └───────────────┘            └─────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    AuthSheet                            │
│              (Modal Authentication)                      │
│                                                          │
│  Modes:                                                  │
│  ├─ login (Email/Password + OAuth + SMS link)           │
│  ├─ signup (Email/Password + OAuth)                     │
│  ├─ forgot-password (Password reset)                    │
│  └─ phone (Phone OTP) ★ NEW                             │
└─────────────────────────────────────────────────────────┘
```

## 4. SMS Provider Architecture

```
┌────────────────────────────────────────────────────────┐
│            Supabase Phone Auth                         │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│          Supported SMS Providers                       │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Twilio    │  │ MessageBird  │  │   Vonage     │  │
│  │ (Recommended)│  │              │  │              │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │     Custom Provider (for SMSApi.pl)              │  │
│  │                                                   │  │
│  │  Supabase Edge Function                          │  │
│  │  ├─ Receives OTP request from Supabase           │  │
│  │  ├─ Calls SMSApi.pl API                          │  │
│  │  └─ Returns success/failure                      │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

## 5. User Data Flow

```
┌──────────────────────────────────────────────────────┐
│              Authentication Success                   │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│  Supabase Auth Creates User                            │
│  ├─ User ID (UUID)                                     │
│  ├─ Email (from provider or generated for phone)       │
│  ├─ Phone (if phone auth)                              │
│  └─ Provider metadata                                  │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│  Profile Sync to users Table                           │
│  (lib/actions.ts - upsert operation)                   │
│                                                         │
│  users table:                                           │
│  ├─ id (matches auth.users.id)                         │
│  ├─ email                                               │
│  ├─ phone                                               │
│  ├─ full_name                                           │
│  ├─ avatar_url (from OAuth provider)                   │
│  ├─ is_host                                             │
│  └─ is_verified                                         │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│  Session Created & User Redirected                     │
│  └─ Redirect to home page or dashboard                 │
└────────────────────────────────────────────────────────┘
```

## Legend

- ★ = New feature added in this implementation
- (Existing) = Already implemented before
- (NEW) = Newly implemented
- (modified) = Updated existing component

## Configuration Files

```
.env.example
├─ NEXT_PUBLIC_SUPABASE_URL
├─ NEXT_PUBLIC_SUPABASE_ANON_KEY
└─ NEXT_PUBLIC_ENABLE_PHONE_AUTH=true

Supabase Dashboard Configuration:
├─ Authentication → Providers
│  ├─ Google (already configured)
│  ├─ Facebook ★ (needs configuration)
│  └─ Phone ★ (needs SMS provider setup)
│     ├─ Twilio (recommended)
│     ├─ MessageBird
│     ├─ Vonage
│     └─ Custom (for SMSApi.pl via Edge Functions)
```

---

**Note:** Items marked with ★ are newly implemented in this PR.
