-- A date exception belongs to one recurring weekday rule. Prevent accidental
-- attachment of a Tuesday date to a Monday schedule, including direct writes.

begin;

create or replace function public.ticketing_validate_schedule_exception_weekday()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  schedule_weekday smallint;
begin
  select weekday
    into schedule_weekday
    from public.product_schedules
   where id = new.schedule_id;

  if schedule_weekday is null then
    raise exception 'Schedule does not exist' using errcode = '23503';
  end if;

  if extract(isodow from new.local_date)::smallint <> schedule_weekday then
    raise exception 'Exception date must match the weekday of its recurring schedule'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists product_schedule_exceptions_validate_weekday
  on public.product_schedule_exceptions;

create trigger product_schedule_exceptions_validate_weekday
before insert or update of schedule_id, local_date
on public.product_schedule_exceptions
for each row execute function public.ticketing_validate_schedule_exception_weekday();

commit;
