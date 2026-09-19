-- Organizer Operating System P0: automatic booking reminders.
-- Uses the existing durable email_outbox and its Resend worker.

begin;

create or replace function public.ticketing_enqueue_booking_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued_count integer := 0;
  inserted_count integer := 0;
begin
  -- "24h" reminder: queue once when a confirmed booking enters the 2-24h window.
  with candidates as (
    select distinct on (o.id)
      o.id as order_id,
      o.order_number,
      o.customer_name,
      o.customer_email,
      oi.session_id,
      oi.product_name,
      s.starts_at,
      v.name as venue_name,
      v.city as venue_city,
      v.timezone
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.sessions s on s.id = oi.session_id
    join public.venues v on v.id = o.venue_id
    where o.status = 'confirmed'
      and o.customer_email is not null
      and btrim(o.customer_email) <> ''
      and s.starts_at > clock_timestamp() + interval '2 hours'
      and s.starts_at <= clock_timestamp() + interval '24 hours'
    order by o.id, oi.created_at
  ), inserted as (
    insert into public.email_outbox (
      email_type,
      to_addresses,
      subject,
      html_body,
      text_body,
      tags,
      source_type,
      source_id,
      metadata,
      dedupe_key,
      next_attempt_at
    )
    select
      'booking_reminder_24h',
      array[c.customer_email],
      left('Przypomnienie o rezerwacji – ' || c.product_name, 998),
      format(
        '<p>Cześć %s,</p><p>przypominamy o rezerwacji <strong>%s</strong>.</p><p><strong>%s</strong><br>%s%s</p><p>Numer rezerwacji: #%s</p>',
        replace(replace(replace(c.customer_name,'&','&amp;'),'<','&lt;'),'>','&gt;'),
        replace(replace(replace(c.product_name,'&','&amp;'),'<','&lt;'),'>','&gt;'),
        to_char(c.starts_at at time zone c.timezone, 'DD.MM.YYYY HH24:MI'),
        replace(replace(replace(c.venue_name,'&','&amp;'),'<','&lt;'),'>','&gt;'),
        case when c.venue_city is null then '' else ' · ' || replace(replace(replace(c.venue_city,'&','&amp;'),'<','&lt;'),'>','&gt;') end,
        c.order_number
      ),
      format(
        'Cześć %s, przypominamy o rezerwacji %s. Termin: %s. Miejsce: %s%s. Numer rezerwacji: #%s.',
        c.customer_name,
        c.product_name,
        to_char(c.starts_at at time zone c.timezone, 'DD.MM.YYYY HH24:MI'),
        c.venue_name,
        case when c.venue_city is null then '' else ' · ' || c.venue_city end,
        c.order_number
      ),
      '[]'::jsonb,
      'booking_reminder',
      c.order_id::text,
      jsonb_build_object(
        'order_id', c.order_id,
        'session_id', c.session_id,
        'reminder', '24h'
      ),
      'booking-reminder:' || c.order_id::text || ':' || c.session_id::text || ':24h',
      clock_timestamp()
    from candidates c
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*)::integer into inserted_count from inserted;

  queued_count := queued_count + inserted_count;

  -- "2h" reminder: queue once close to the visit. The 15-minute lower bound
  -- avoids sending a reminder when the guest is already effectively arriving.
  with candidates as (
    select distinct on (o.id)
      o.id as order_id,
      o.order_number,
      o.customer_name,
      o.customer_email,
      oi.session_id,
      oi.product_name,
      s.starts_at,
      v.name as venue_name,
      v.city as venue_city,
      v.timezone
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.sessions s on s.id = oi.session_id
    join public.venues v on v.id = o.venue_id
    where o.status = 'confirmed'
      and o.customer_email is not null
      and btrim(o.customer_email) <> ''
      and s.starts_at > clock_timestamp() + interval '15 minutes'
      and s.starts_at <= clock_timestamp() + interval '2 hours'
    order by o.id, oi.created_at
  ), inserted as (
    insert into public.email_outbox (
      email_type,
      to_addresses,
      subject,
      html_body,
      text_body,
      tags,
      source_type,
      source_id,
      metadata,
      dedupe_key,
      next_attempt_at
    )
    select
      'booking_reminder_2h',
      array[c.customer_email],
      left('Już niedługo: ' || c.product_name, 998),
      format(
        '<p>Cześć %s,</p><p>Twoja rezerwacja <strong>%s</strong> zaczyna się już niedługo.</p><p><strong>%s</strong><br>%s%s</p><p>Numer rezerwacji: #%s</p>',
        replace(replace(replace(c.customer_name,'&','&amp;'),'<','&lt;'),'>','&gt;'),
        replace(replace(replace(c.product_name,'&','&amp;'),'<','&lt;'),'>','&gt;'),
        to_char(c.starts_at at time zone c.timezone, 'DD.MM.YYYY HH24:MI'),
        replace(replace(replace(c.venue_name,'&','&amp;'),'<','&lt;'),'>','&gt;'),
        case when c.venue_city is null then '' else ' · ' || replace(replace(replace(c.venue_city,'&','&amp;'),'<','&lt;'),'>','&gt;') end,
        c.order_number
      ),
      format(
        'Cześć %s, Twoja rezerwacja %s zaczyna się już niedługo. Termin: %s. Miejsce: %s%s. Numer rezerwacji: #%s.',
        c.customer_name,
        c.product_name,
        to_char(c.starts_at at time zone c.timezone, 'DD.MM.YYYY HH24:MI'),
        c.venue_name,
        case when c.venue_city is null then '' else ' · ' || c.venue_city end,
        c.order_number
      ),
      '[]'::jsonb,
      'booking_reminder',
      c.order_id::text,
      jsonb_build_object(
        'order_id', c.order_id,
        'session_id', c.session_id,
        'reminder', '2h'
      ),
      'booking-reminder:' || c.order_id::text || ':' || c.session_id::text || ':2h',
      clock_timestamp()
    from candidates c
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*)::integer into inserted_count from inserted;

  queued_count := queued_count + inserted_count;
  return queued_count;
end;
$$;

revoke all on function public.ticketing_enqueue_booking_reminders()
from public, anon, authenticated;
grant execute on function public.ticketing_enqueue_booking_reminders()
to service_role;

select cron.schedule(
  'booking-reminders-v1',
  '*/10 * * * *',
  $cron$select public.ticketing_enqueue_booking_reminders();$cron$
);

commit;
