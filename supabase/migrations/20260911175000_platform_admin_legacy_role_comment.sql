comment on column public.users.role is
  'LEGACY profile role metadata. Do not use for platform administration or organizer authorization. Platform administration is derived from platform_staff; organizer access is derived from organization_memberships.';

comment on column public.users.is_host is
  'DEPRECATED. Organizer access is derived from organization_memberships; platform administration is derived from platform_staff.';