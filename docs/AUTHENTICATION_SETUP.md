# Konfiguracja Uwierzytelniania

Ten dokument opisuje jak skonfigurować różne metody uwierzytelniania w aplikacji EnjoyHub.

## Dostępne metody uwierzytelniania

1. **Email i hasło** - Podstawowa metoda uwierzytelniania
2. **Google OAuth** - Logowanie przez konto Google
3. **Facebook OAuth** - Logowanie przez konto Facebook/Instagram
4. **Telefon (SMS)** - Logowanie przez numer telefonu z kodem SMS

## Konfiguracja Facebook OAuth

### Krok 1: Utwórz aplikację Facebook

1. Przejdź do [Facebook Developers](https://developers.facebook.com/)
2. Utwórz nową aplikację lub wybierz istniejącą
3. W panelu aplikacji przejdź do **Settings > Basic**
4. Skopiuj **App ID** i **App Secret**

### Krok 2: Skonfiguruj Supabase

1. Przejdź do Dashboard Supabase
2. Wybierz swój projekt
3. Przejdź do **Authentication > Providers**
4. Włącz **Facebook**
5. Wprowadź **Facebook Client ID** (App ID) i **Facebook Client Secret** (App Secret)
6. Skopiuj **Callback URL** z Supabase
7. Dodaj Callback URL w aplikacji Facebook:
   - W panelu Facebook Developers przejdź do **Facebook Login > Settings**
   - Dodaj Callback URL do **Valid OAuth Redirect URIs**

### Krok 3: Konfiguracja Instagram

Instagram Login wykorzystuje Facebook Login API. Po skonfigurowaniu Facebook OAuth, użytkownicy mogą logować się również przez Instagram (jeśli ich konta są połączone).

## Konfiguracja Google OAuth

### Krok 1: Utwórz projekt Google Cloud

1. Przejdź do [Google Cloud Console](https://console.cloud.google.com/)
2. Utwórz nowy projekt lub wybierz istniejący
3. Przejdź do **APIs & Services > Credentials**
4. Utwórz **OAuth 2.0 Client ID**
5. Wybierz **Web application**
6. Dodaj autoryzowane adresy przekierowań

### Krok 2: Skonfiguruj Supabase

1. W Dashboard Supabase przejdź do **Authentication > Providers**
2. Włącz **Google**
3. Wprowadź **Google Client ID** i **Google Client Secret**

## Konfiguracja uwierzytelniania przez telefon (SMS)

Supabase obsługuje uwierzytelnianie przez telefon za pomocą różnych dostawców SMS.

### Obsługiwani dostawcy SMS

- **Twilio** (zalecany)
- **MessageBird**
- **Textlocal**
- **Vonage**
- **Custom Provider** (możliwość integracji z SMSApi.pl)

### Konfiguracja z Twilio (zalecana)

1. Załóż konto na [Twilio](https://www.twilio.com/)
2. Pobierz **Account SID** i **Auth Token**
3. Kup numer telefonu Twilio lub skonfiguruj Messaging Service
4. W Dashboard Supabase:
   - Przejdź do **Authentication > Providers**
   - Włącz **Phone**
   - Wybierz **Twilio** jako dostawcę
   - Wprowadź dane uwierzytelniające Twilio

### Integracja z SMSApi.pl (Custom Provider)

Aby zintegrować SMSApi.pl z Supabase, możesz użyć Edge Functions do tworzenia niestandardowego dostawcy:

1. Utwórz Supabase Edge Function
2. Skonfiguruj webhook do obsługi wysyłania SMS przez SMSApi.pl
3. Użyj API SMSApi.pl do wysyłania kodów weryfikacyjnych

Przykładowa konfiguracja:

```typescript
// supabase/functions/send-sms/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { phone, otp } = await req.json()
  
  // Integracja z SMSApi.pl
  const response = await fetch('https://api.smsapi.pl/sms.do', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SMSAPI_TOKEN')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: phone,
      message: `Twój kod weryfikacyjny: ${otp}`,
      from: 'EnjoyHub',
    }),
  })
  
  return new Response(JSON.stringify({ success: true }))
})
```

### Konfiguracja zmiennych środowiskowych

Zaktualizuj plik `.env.local`:

```env
# Dla Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Lub dla SMSApi.pl
SMSAPI_TOKEN=your_smsapi_token
```

## Testowanie uwierzytelniania

### Test lokalny

1. Uruchom aplikację: `npm run dev`
2. Przejdź do strony logowania
3. Wypróbuj każdą metodę uwierzytelniania:
   - Email/hasło
   - Google
   - Facebook
   - Telefon (SMS)

### Uwagi dotyczące testowania telefonu

- W trybie deweloperskim Supabase może nie wysyłać SMS-ów
- Użyj numerów testowych skonfigurowanych w Dashboard Supabase
- Sprawdź logi w Supabase Dashboard > Logs

## Rozwiązywanie problemów

### Facebook OAuth nie działa

- Sprawdź czy aplikacja Facebook jest w trybie "Live" (nie "Development")
- Upewnij się, że Callback URL jest poprawnie skonfigurowany
- Sprawdź czy domena aplikacji jest autoryzowana w ustawieniach Facebook

### SMS nie są wysyłane

- Sprawdź saldo w koncie dostawcy SMS (Twilio, SMSApi.pl)
- Upewnij się, że numer telefonu jest w prawidłowym formacie międzynarodowym (+48...)
- Sprawdź logi w Dashboard Supabase
- Dla SMSApi.pl: sprawdź czy Edge Function jest poprawnie wdrożona

### Google OAuth - błąd przekierowania

- Sprawdź czy Authorized redirect URIs w Google Cloud zawiera prawidłowy URL
- Upewnij się, że używasz tego samego protokołu (http/https)

## Bezpieczeństwo

1. **Nigdy nie commituj** kluczy API do repozytorium
2. Używaj zmiennych środowiskowych dla wszystkich tajnych danych
3. W produkcji włącz HTTPS
4. Regularnie aktualizuj klucze API
5. Monitoruj logi uwierzytelniania w Supabase

## Dokumentacja zewnętrzna

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Facebook Login](https://developers.facebook.com/docs/facebook-login)
- [Google OAuth](https://developers.google.com/identity/protocols/oauth2)
- [SMSApi.pl API](https://www.smsapi.pl/dokumentacja)
- [Twilio SMS](https://www.twilio.com/docs/sms)
