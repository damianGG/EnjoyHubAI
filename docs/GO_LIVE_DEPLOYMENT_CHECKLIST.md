# EnjoyHub — P3.5 checklista wdrożeniowa przed P4

Cel: przygotować środowisko produkcyjne tak, aby P4 był już wyłącznie kontrolowanym testem go-live, a nie szukaniem brakującej konfiguracji.

> Zasada bezpieczeństwa: dopóki sekcje 1–8 nie są zakończone, trzymaj w produkcji `TICKETING_CHECKOUT_ENABLED=false`, `TICKETING_PAYMENTS_ENABLED=false` i `STRIPE_CONNECT_ENABLED=false`.

## 0. Punkt wyjścia i możliwość rollbacku

- [ ] `master` ma zielony Quality gate i ostatni deployment produkcyjny ma status READY.
- [ ] Zanotuj SHA ostatniej znanej dobrej wersji produkcyjnej.
- [ ] Sprawdź w Vercelu możliwość natychmiastowego rollbacku do poprzedniego deploymentu.
- [ ] Przed zmianami produkcyjnymi zrób backup bazy / potwierdź aktualny backup w Supabase.
- [ ] Nie wykonuj przy okazji zmian schematu, UX ani refaktoru — wdrożenie ma być osobną operacją.

## 1. Domena i adres aplikacji

Docelowy host używany w kodzie SEO i workerze e-mail: `https://www.enjoyhub.app`.

### Vercel

- [ ] `www.enjoyhub.app` jest przypięte do projektu produkcyjnego.
- [ ] SSL jest aktywny.
- [ ] `https://www.enjoyhub.app` otwiera aktualny deployment `master`.
- [ ] Przekierowanie z domeny bez `www` prowadzi do jednego wybranego canonical hosta.
- [ ] Ustaw w Production:
  - [ ] `NEXT_PUBLIC_SITE_URL=https://www.enjoyhub.app`
  - [ ] `EMAIL_SITE_URL=https://www.enjoyhub.app`

### Supabase Auth

W Dashboard → Authentication → URL Configuration:

- [ ] Site URL = `https://www.enjoyhub.app`.
- [ ] Redirect URLs zawierają co najmniej:
  - [ ] `https://www.enjoyhub.app/**`
  - [ ] właściwy preview wildcard Vercela, jeśli preview ma obsługiwać auth.
- [ ] Test: logowanie/rejestracja/reset hasła nie wracają na localhost ani techniczny adres `*.vercel.app`.

## 2. Dane prawne i kontaktowe marketplace

Kod operatora korzysta z danych Codeli sp. z o.o. w `lib/legal/marketplace.ts`.

- [ ] Potwierdź aktualność:
  - [ ] nazwy prawnej,
  - [ ] adresu,
  - [ ] NIP,
  - [ ] KRS,
  - [ ] REGON.
- [ ] Ustaw w Vercel Production:
  - [ ] `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL=<monitorowany e-mail>`
  - [ ] `NEXT_PUBLIC_LEGAL_CONTACT_PHONE=<realny numer telefonu>`
- [ ] Sprawdź dane na:
  - [ ] `/regulamin`
  - [ ] `/privacy`
  - [ ] `/zasady-anulowania`
  - [ ] checkout / podsumowanie zamówienia.
- [ ] Potwierdź, że te dane pojawiają się poprawnie w snapshotach transakcji i wiadomościach e-mail.

## 3. Supabase — środowisko produkcyjne

### Klucze Vercela

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — tylko server-side, nigdy `NEXT_PUBLIC_*`.

### Baza i migracje

- [ ] Wszystkie migracje z `supabase/migrations` zastosowane na właściwym projekcie produkcyjnym.
- [ ] Tabele i RPC ticketingu istnieją.
- [ ] Migracje rozliczeń Stripe Connect istnieją.
- [ ] Migracje refundów istnieją.
- [ ] Migracje outbox/e-mail istnieją.
- [ ] RLS pozostaje aktywne zgodnie z obecnym modelem dostępu.
- [ ] Nie ma ręcznych grantów „na szybko”, które obchodzą model bezpieczeństwa.

### Sekrety ticketingu

Ustaw w Vercel Production:

- [ ] `TICKETING_FINGERPRINT_SECRET` — losowy sekret minimum 32 znaki.
- [ ] `CRON_SECRET` — osobny losowy sekret.

### Health check

- [ ] Otwórz `https://www.enjoyhub.app/api/health`.
- [ ] Oczekiwane: HTTP 200.
- [ ] Oczekiwane JSON: `ok: true`, `checks.app: true`, `checks.database: true`.
- [ ] Zanotowany release odpowiada wdrożonemu commitowi.

## 4. Vercel Cron Jobs

`vercel.json` definiuje:

- [ ] `/api/cron/ticketing-cleanup` — codziennie 03:00 UTC.
- [ ] `/api/cron/settlement-release` — codziennie 04:00 UTC.
- [ ] `/api/cron/review-invitations` — codziennie 08:00 UTC.
- [ ] `/api/cron/demand-notifications` — codziennie 07:15 UTC.

Dla każdego joba:

- [ ] istnieje w Vercelu po deploymentcie;
- [ ] endpoint odrzuca wywołanie bez prawidłowego Bearer tokena;
- [ ] wywołanie przez Vercel Cron kończy się 2xx;
- [ ] brak błędów w runtime logs / Sentry po wykonaniu.

## 5. E-mail: Resend + Supabase Auth

### Resend

- [ ] Domena wysyłkowa `enjoyhub.app` zweryfikowana.
- [ ] SPF poprawny.
- [ ] DKIM poprawny.
- [ ] DMARC ustawiony.
- [ ] Ustaw w Vercel Production:
  - [ ] `RESEND_API_KEY`
  - [ ] `EMAIL_FROM=EnjoyHub <hello@enjoyhub.app>` lub inny zweryfikowany adres;
  - [ ] `EMAIL_REPLY_TO=<monitorowana skrzynka>` — jeśli odpowiedzi mają być odbierane;
  - [ ] `EMAIL_SITE_URL=https://www.enjoyhub.app`.
- [ ] Test e-maila transakcyjnego nie trafia do spamu u co najmniej Gmail i Outlook.

### Supabase Auth / SMTP

- [ ] Supabase Auth wysyła przez właściwy SMTP/Resend.
- [ ] Skopiuj aktualne szablony z repo:
  - [ ] `supabase/templates/confirmation.html`
  - [ ] `supabase/templates/recovery.html`
- [ ] Temat potwierdzenia: `Potwierdź konto w EnjoyHub`.
- [ ] Temat resetu: `Ustaw nowe hasło w EnjoyHub`.
- [ ] Test rejestracji e-mail.
- [ ] Test ponownego wysłania potwierdzenia.
- [ ] Test resetu hasła.
- [ ] Linki prowadzą do `www.enjoyhub.app`.

### Durable outbox

- [ ] W Supabase Vault istnieje aktualny `email_outbox_worker_token`.
- [ ] Supabase Cron wywołuje co minutę:
  `POST https://www.enjoyhub.app/api/email/outbox/process`.
- [ ] Test: wpis `pending` przechodzi do `sent`.
- [ ] Test błędu: nieudana próba pozostaje w retry i nie ginie.
- [ ] `/admin/email` pokazuje historię wysyłek i błędy.

## 6. Cloudinary i zdjęcia

Jeśli produkcja korzysta z uploadów Cloudinary:

- [ ] `CLOUDINARY_CLOUD_NAME`
- [ ] `CLOUDINARY_API_KEY`
- [ ] `CLOUDINARY_API_SECRET`
- [ ] Test uploadu zdjęcia atrakcji.
- [ ] Test zdjęcia kategorii.
- [ ] Test usunięcia/zmiany zdjęcia.
- [ ] Obrazy publiczne otwierają się bez autoryzacji.

## 7. Monitoring

### Sentry

- [ ] `SENTRY_DSN`
- [ ] `NEXT_PUBLIC_SENTRY_DSN`
- [ ] `SENTRY_ORG`
- [ ] `SENTRY_PROJECT`
- [ ] `SENTRY_AUTH_TOKEN` — server/build only.
- [ ] `SENTRY_ENVIRONMENT=production`
- [ ] `NEXT_PUBLIC_SENTRY_ENVIRONMENT=production`
- [ ] Wygeneruj kontrolowany błąd testowy i potwierdź event w Sentry.
- [ ] Sprawdź, że e-mail/IP użytkownika nie są wysyłane jako PII.

## 8. Stripe — najpierw tryb testowy / Preview

### Zwykły Stripe Checkout

Na Preview:

- [ ] `STRIPE_SECRET_KEY=sk_test_...`
- [ ] skonfiguruj endpoint webhook:
  `/api/webhooks/stripe`
- [ ] zapisz signing secret jako `STRIPE_WEBHOOK_SECRET`.

Webhook musi dostarczać zdarzenia obsługiwane przez kod:

- [ ] `checkout.session.completed`
- [ ] `checkout.session.async_payment_succeeded`
- [ ] `checkout.session.expired`
- [ ] `checkout.session.async_payment_failed`
- [ ] `refund.created`
- [ ] `refund.updated`
- [ ] `refund.failed`

### Kolejność flag na Preview

1. [ ] Wszystkie sekrety ustawione.
2. [ ] `TICKETING_CHECKOUT_ENABLED=true`.
3. [ ] Sprawdź utworzenie blokady miejsc bez realnej płatności.
4. [ ] `TICKETING_PAYMENTS_ENABLED=true`.
5. [ ] Wykonaj testową płatność Stripe.
6. [ ] Potwierdź wydanie biletów.
7. [ ] Potwierdź e-mail z biletami.
8. [ ] Wyślij ponownie ten sam webhook / sprawdź idempotencję.
9. [ ] Sprawdź wygaśnięcie nieopłaconego checkoutu i powrót miejsc.
10. [ ] Sprawdź nieudaną płatność.
11. [ ] Sprawdź refund.

Nie przechodź do produkcyjnych kluczy, dopóki cały ten blok nie jest zielony.

## 9. Stripe Connect — organizatorzy i wypłaty

### Konto platformy

- [ ] Produkcyjne konto Stripe platformy jest w pełni aktywowane.
- [ ] Dane firmy/platformy są zweryfikowane.
- [ ] Connect jest aktywny dla właściwego modelu kont.

### Webhook Connect

Endpoint:

`/api/webhooks/stripe/connect`

Ustaw:

- [ ] `STRIPE_CONNECT_WEBHOOK_SECRET`

Zdarzenia obsługiwane przez kod:

- [ ] `account.updated`
- [ ] `payout.created`
- [ ] `payout.updated`
- [ ] `payout.paid`
- [ ] `payout.failed`
- [ ] `payout.canceled`

### Pierwszy organizator

- [ ] Utwórz testową/realną organizację.
- [ ] Przejdź onboarding/KYC Stripe Connect.
- [ ] `account.updated` synchronizuje gotowość konta w EnjoyHub.
- [ ] Panel `/host/rozliczenia` pokazuje prawidłowy status.
- [ ] Organizator ma ustawione dane prawne wymagane przed sprzedażą.

### Flaga Connect

- [ ] Dopiero po powyższych testach ustaw `STRIPE_CONNECT_ENABLED=true`.
- [ ] Pozostaw `STRIPE_CONNECT_MAX_HOLD_DAYS=85`, chyba że świadomie zmieniasz politykę.

## 10. Production Stripe — przygotowanie przed przełączeniem

Ustaw wszystkie produkcyjne wartości, ale flagi sprzedaży nadal pozostaw wyłączone.

- [ ] `STRIPE_SECRET_KEY=sk_live_...`
- [ ] produkcyjny `STRIPE_WEBHOOK_SECRET`
- [ ] produkcyjny `STRIPE_CONNECT_WEBHOOK_SECRET`
- [ ] produkcyjny Connect aktywny i zweryfikowany.
- [ ] Endpointy webhook wskazują dokładnie `https://www.enjoyhub.app/...`.
- [ ] Webhook dashboard Stripe nie pokazuje serii 4xx/5xx.
- [ ] Test sygnatur webhooków przechodzi.

## 11. Przygotowanie pierwszej prawdziwej oferty

W EnjoyHub:

- [ ] istnieje realna organizacja;
- [ ] organizacja przeszła weryfikację danych;
- [ ] istnieje realna atrakcja;
- [ ] atrakcja jest opublikowana;
- [ ] obiekt/venue jest połączony z publiczną atrakcją;
- [ ] istnieje produkt/oferta;
- [ ] istnieją typy biletów;
- [ ] ceny są prawidłowe;
- [ ] pojemność jest prawidłowa;
- [ ] dostępność i wyjątki są prawidłowe;
- [ ] zasady anulowania są wybrane;
- [ ] klient widzi sprzedawcę i operatora marketplace przed płatnością.

## 12. Kontrolowane włączenie produkcji

Wykonuj dokładnie w tej kolejności:

1. [ ] Zrób ostatni backup / potwierdź backup Supabase.
2. [ ] Potwierdź `/api/health = 200`.
3. [ ] Potwierdź e-mail i webhooki.
4. [ ] Potwierdź gotowość pierwszego konta Connect.
5. [ ] Ustaw `TICKETING_CHECKOUT_ENABLED=true`.
6. [ ] Sprawdź, czy sesje/rezerwacje pojawiają się prawidłowo.
7. [ ] Ustaw `TICKETING_PAYMENTS_ENABLED=true`.
8. [ ] Ustaw `STRIPE_CONNECT_ENABLED=true`.
9. [ ] Wykonaj P4 — pierwszy kontrolowany zakup za małą realną kwotę.

## 13. P4 — obowiązkowy real-money smoke test

Nie zapraszaj jeszcze szerokiego ruchu. Jeden kontrolowany zakup od początku do końca.

### Klient

- [ ] otwiera realną atrakcję;
- [ ] wybiera termin;
- [ ] liczba miejsc jest poprawna;
- [ ] przechodzi checkout;
- [ ] widzi sprzedawcę, operatora i zasady anulowania;
- [ ] akceptuje wymagane zgody;
- [ ] płaci małą realną kwotę;
- [ ] wraca na poprawny ekran;
- [ ] zamówienie ma status paid/confirmed;
- [ ] bilety są wydane;
- [ ] QR działa;
- [ ] e-mail potwierdzający dochodzi.

### Organizator

- [ ] widzi zamówienie;
- [ ] widzi klienta/liczbę biletów zgodnie z uprawnieniami;
- [ ] skaner odczytuje bilet;
- [ ] ponowny skan nie zużywa biletu drugi raz;
- [ ] sprzedaż widoczna jest w panelu;
- [ ] settlement został zapisany.

### Rozliczenie

- [ ] warunki wypłaty zostały spełnione;
- [ ] payout został utworzony;
- [ ] webhook Connect aktualizuje status;
- [ ] organizator otrzymuje środki zgodnie z modelem rozliczeń.

### Refund

- [ ] wykonaj kontrolowany refund;
- [ ] Stripe wysyła event refundu;
- [ ] EnjoyHub aktualizuje status;
- [ ] klient nie ma niespójnego statusu biletu/zamówienia;
- [ ] panel organizatora pokazuje poprawny stan.

## 14. Demand loop

- [ ] Utwórz zapotrzebowanie klienta na konkretną datę/liczbę osób.
- [ ] Dodaj wystarczającą realną dostępność.
- [ ] Cron demand-notifications wykrywa dopasowanie.
- [ ] Klient dostaje dokładnie jedno powiadomienie.
- [ ] Klient kupuje używając tego samego e-maila.
- [ ] Demand zmienia się na `converted`.
- [ ] Nie wraca ponownie do kolejki niezaspokojonego popytu.

## 15. Kryterium GO / NO-GO

### GO

Możemy otworzyć sprzedaż szerzej dopiero gdy:

- [ ] health check jest zielony;
- [ ] rejestracja/logowanie/reset działają;
- [ ] e-maile transakcyjne działają;
- [ ] webhook Stripe działa i jest idempotentny;
- [ ] Connect działa;
- [ ] pierwszy real-money E2E przeszedł;
- [ ] payout przeszedł;
- [ ] refund przeszedł;
- [ ] nie ma nowych błędów P0/P1 w Sentry;
- [ ] nie ma krytycznych 4xx/5xx webhooków.

### NO-GO / natychmiastowe wyłączenie sprzedaży

Jeżeli pojawi się problem z płatnością, fulfillmentem, inventory albo webhookiem:

1. [ ] ustaw `TICKETING_PAYMENTS_ENABLED=false`;
2. [ ] jeżeli trzeba, ustaw też `TICKETING_CHECKOUT_ENABLED=false`;
3. [ ] przy problemie z rozliczeniami ustaw `STRIPE_CONNECT_ENABLED=false`;
4. [ ] nie usuwaj ręcznie zamówień ani eventów Stripe;
5. [ ] zabezpiecz logi/Sentry/ID eventu i diagnozuj na istniejących danych;
6. [ ] rollback aplikacji tylko jeśli problem pochodzi z release'u, a nie z konfiguracji.

## 16. Co można zrobić już teraz, zanim włączymy LIVE

Te punkty nie uruchamiają płatności:

- [ ] domena + DNS + SSL;
- [ ] `NEXT_PUBLIC_SITE_URL`;
- [ ] Supabase Site URL / Redirect URLs;
- [ ] dane prawne i kontaktowe;
- [ ] Resend + SPF/DKIM/DMARC;
- [ ] Supabase SMTP + szablony Auth;
- [ ] Cloudinary;
- [ ] Sentry;
- [ ] wszystkie migracje;
- [ ] sekrety ticketingu;
- [ ] health check;
- [ ] crony;
- [ ] testy Stripe na Preview;
- [ ] Connect w trybie testowym;
- [ ] przygotowanie pierwszej realnej atrakcji i organizatora.

Dopiero później: produkcyjne klucze Stripe + przełączenie flag + P4.
