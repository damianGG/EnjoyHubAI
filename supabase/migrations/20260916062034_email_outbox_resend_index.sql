create index if not exists email_outbox_resend_of_idx
  on public.email_outbox(resend_of_id)
  where resend_of_id is not null;
