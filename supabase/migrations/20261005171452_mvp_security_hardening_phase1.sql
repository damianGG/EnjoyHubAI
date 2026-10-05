-- EnjoyHub MVP security hardening, phase 1.
-- Remove legacy/dev tables from the client-facing Data API.
revoke all privileges on table
  public.dev_users,
  public.dev_categories,
  public.dev_properties,
  public.dev_bookings,
  public.dev_reviews,
  public.dev_favorites
from public, anon, authenticated;

-- Platform admin RPCs are for signed-in platform staff only.
-- Keep the explicit authenticated/service_role grants and remove
-- inherited/public anonymous execution.
revoke execute on function public.platform_admin_assign_member(uuid,text,public.ticketing_member_role) from public, anon;
revoke execute on function public.platform_admin_audit_content_change() from public, anon;
revoke execute on function public.platform_admin_clear_support_context() from public, anon;
revoke execute on function public.platform_admin_create_attraction_draft(uuid,text,text) from public, anon;
revoke execute on function public.platform_admin_create_organization(text,text) from public, anon;
revoke execute on function public.platform_admin_create_venue(uuid,text,text,text,text) from public, anon;
revoke execute on function public.platform_admin_get_organization(uuid) from public, anon;
revoke execute on function public.platform_admin_list_audit(uuid,integer) from public, anon;
revoke execute on function public.platform_admin_list_organizations(text,integer) from public, anon;
revoke execute on function public.platform_admin_list_staff() from public, anon;
revoke execute on function public.platform_admin_list_users(text,integer) from public, anon;
revoke execute on function public.platform_admin_set_support_context(uuid) from public, anon;
revoke execute on function public.platform_admin_update_organization(
  uuid,text,public.ticketing_organization_status,public.organizer_verification_status,boolean
) from public, anon;
revoke execute on function public.platform_admin_upsert_staff(text,public.platform_staff_role,boolean) from public, anon;
