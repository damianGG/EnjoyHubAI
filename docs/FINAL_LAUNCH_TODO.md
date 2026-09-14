# EnjoyHub — final launch TODO

This file tracks only go-live gates that must be completed before switching real marketplace traffic and payments fully on.

- [ ] Configure the real public EnjoyHub/Codeli contact details in Vercel production: `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL` and `NEXT_PUBLIC_LEGAL_CONTACT_PHONE`. Verify that the values are visible in `/regulamin`, checkout and booking confirmation e-mails before enabling live payments.
- [ ] Complete production Stripe Connect activation: production platform account, `STRIPE_CONNECT_ENABLED=true`, production Connect webhook secret, connected-account webhook and first organizer onboarding/KYC.
- [ ] Run one real-money end-to-end smoke test on production (small amount): customer checkout → paid order/tickets → marketplace settlement → service completion → organizer transfer/payout → refund/recovery path.
- [ ] Run one demand-loop smoke test: create a demand request for a specific date/group → publish enough real availability → receive one notification → complete a paid booking with the same e-mail → verify demand status becomes `converted` and is removed from unmet-demand prioritization.

Keep this checklist operational. Product features and longer-term backlog items belong elsewhere.