create or replace function public.platform_supply_resolve_enrichment_suggestion(
  p_suggestion_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.platform_staff_role := public.platform_current_staff_role();
  suggestion public.supply_enrichment_suggestions%rowtype;
  lead_row public.supply_leads%rowtype;
  v_definition_id uuid;
  v_source_url text;
  scalar_value jsonb;
  value_text text;
  provider_value text;
  rating_value numeric;
  review_count_value integer;
begin
  if actor_id is null or actor_role not in ('platform_superadmin','platform_support','platform_content') then
    raise exception 'Supply access required' using errcode = '42501';
  end if;

  if p_decision not in ('accepted','rejected') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;

  select * into suggestion
  from public.supply_enrichment_suggestions enrichment_suggestion
  where enrichment_suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception 'Suggestion not found' using errcode = 'P0002';
  end if;

  if suggestion.status <> 'pending' then
    raise exception 'Suggestion already reviewed' using errcode = 'P0001';
  end if;

  select * into lead_row
  from public.supply_leads lead
  where lead.id = suggestion.lead_id
  for update;

  v_source_url := nullif(suggestion.source_urls->>0, '');
  value_text := suggestion.proposed_value->>'value';

  if p_decision = 'accepted' then
    if suggestion.target_type = 'lead_field' then
      if suggestion.target_key = 'website_url' then
        update public.supply_leads lead set website_url = value_text where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'booking_url' then
        update public.supply_leads lead set booking_url = value_text where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'phone' then
        update public.supply_leads lead set phone = value_text where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'email' then
        update public.supply_leads lead set email = value_text where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'address_line_1' then
        update public.supply_leads lead set address_line_1 = value_text where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'city' then
        update public.supply_leads lead set city = value_text where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'region' then
        update public.supply_leads lead set region = value_text where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'postal_code' then
        update public.supply_leads lead set postal_code = value_text where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'country_code' then
        update public.supply_leads lead set country_code = upper(value_text) where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'short_description' then
        update public.supply_leads lead set short_description = value_text where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'public_description' then
        update public.supply_leads lead set public_description = value_text where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'booking_method'
        and value_text in ('unknown','none','phone','whatsapp','messenger','form','email','own_booking') then
        update public.supply_leads lead set booking_method = value_text where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'price_from'
        and suggestion.proposed_value->>'numericValue' is not null then
        update public.supply_leads lead set price_from = (suggestion.proposed_value->>'numericValue')::numeric where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'has_paid_offer'
        and suggestion.proposed_value->>'booleanValue' is not null then
        update public.supply_leads lead set has_paid_offer = (suggestion.proposed_value->>'booleanValue')::boolean where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'requires_schedule'
        and suggestion.proposed_value->>'booleanValue' is not null then
        update public.supply_leads lead set requires_schedule = (suggestion.proposed_value->>'booleanValue')::boolean where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'group_offer'
        and suggestion.proposed_value->>'booleanValue' is not null then
        update public.supply_leads lead set group_offer = (suggestion.proposed_value->>'booleanValue')::boolean where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'indoor'
        and suggestion.proposed_value->>'booleanValue' is not null then
        update public.supply_leads lead set indoor = (suggestion.proposed_value->>'booleanValue')::boolean where lead.id = suggestion.lead_id;
      elsif suggestion.target_key = 'year_round'
        and suggestion.proposed_value->>'booleanValue' is not null then
        update public.supply_leads lead set year_round = (suggestion.proposed_value->>'booleanValue')::boolean where lead.id = suggestion.lead_id;
      else
        raise exception 'Unsupported or invalid lead field suggestion: %', suggestion.target_key using errcode = '22023';
      end if;

      update public.supply_leads lead
      set field_verification = jsonb_set(
            coalesce(lead.field_verification, '{}'::jsonb),
            array[suggestion.target_key],
            jsonb_build_object(
              'status', 'verified',
              'source', 'ai',
              'confidence', suggestion.confidence,
              'sourceUrl', v_source_url,
              'verifiedAt', now()
            ),
            true
          ),
          updated_by = actor_id,
          updated_at = now()
      where lead.id = suggestion.lead_id;

    elsif suggestion.target_type = 'attribute' then
      if lead_row.category_id is null and lead_row.subcategory_id is null then
        raise exception 'Assign a category before accepting new AI attributes' using errcode = 'P0001';
      end if;

      select definition.id into v_definition_id
      from public.supply_attribute_definitions definition
      where definition.active = true
        and definition.key = suggestion.target_key
        and (
          (lead_row.subcategory_id is not null and definition.subcategory_id = lead_row.subcategory_id)
          or (
            definition.subcategory_id is null
            and lead_row.category_id is not null
            and definition.category_id = lead_row.category_id
          )
        )
      order by case when definition.subcategory_id is not null then 0 else 1 end
      limit 1;

      if v_definition_id is null then
        insert into public.supply_attribute_definitions (
          category_id, subcategory_id, key, label, value_type, ai_prompt, created_by
        ) values (
          lead_row.category_id,
          lead_row.subcategory_id,
          suggestion.target_key,
          coalesce(nullif(suggestion.proposed_value->>'label', ''), initcap(replace(suggestion.target_key, '_', ' '))),
          case
            when suggestion.proposed_value->>'valueType' in ('text','number','boolean','select','textarea')
              then suggestion.proposed_value->>'valueType'
            else 'text'
          end,
          'Pole zaproponowane przez enrichment AI i zaakceptowane przez administratora.',
          actor_id
        )
        returning id into v_definition_id;
      end if;

      scalar_value := case
        when suggestion.proposed_value->>'valueType' = 'number'
          and suggestion.proposed_value->>'numericValue' is not null
          then to_jsonb((suggestion.proposed_value->>'numericValue')::numeric)
        when suggestion.proposed_value->>'valueType' = 'boolean'
          and suggestion.proposed_value->>'booleanValue' is not null
          then to_jsonb((suggestion.proposed_value->>'booleanValue')::boolean)
        else to_jsonb(coalesce(value_text, ''))
      end;

      insert into public.supply_attribute_values (
        lead_id, definition_id, value, verification_status, source_type, source_url, confidence, observed_at, updated_by
      ) values (
        suggestion.lead_id, v_definition_id, scalar_value, 'verified', 'ai', v_source_url,
        suggestion.confidence, now(), actor_id
      )
      on conflict (lead_id, definition_id) do update
      set value = excluded.value,
          verification_status = 'verified',
          source_type = 'ai',
          source_url = excluded.source_url,
          confidence = excluded.confidence,
          observed_at = now(),
          updated_by = actor_id,
          updated_at = now();

    elsif suggestion.target_type = 'external_signal' then
      provider_value := lower(coalesce(nullif(suggestion.proposed_value->>'provider', ''), suggestion.target_key));
      rating_value := nullif(suggestion.proposed_value->>'rating', '')::numeric;
      review_count_value := nullif(suggestion.proposed_value->>'reviewCount', '')::integer;

      if provider_value is null or (rating_value is null and review_count_value is null) then
        raise exception 'External rating suggestion is incomplete' using errcode = '22023';
      end if;

      insert into public.supply_external_signals (
        lead_id, provider, signal_type, rating, review_count, source_url, confidence, raw_metadata, observed_at
      ) values (
        suggestion.lead_id, provider_value, 'aggregate_rating', rating_value, review_count_value,
        v_source_url, suggestion.confidence,
        jsonb_build_object('sourceTitle', suggestion.proposed_value->>'sourceTitle'), now()
      )
      on conflict (lead_id, provider, signal_type) do update
      set rating = excluded.rating,
          review_count = excluded.review_count,
          source_url = excluded.source_url,
          confidence = excluded.confidence,
          raw_metadata = excluded.raw_metadata,
          observed_at = now(),
          updated_at = now();
    end if;

    update public.supply_enrichment_suggestions enrichment_suggestion
    set status = 'rejected', reviewed_by = actor_id, reviewed_at = now()
    where enrichment_suggestion.lead_id = suggestion.lead_id
      and enrichment_suggestion.id <> suggestion.id
      and enrichment_suggestion.status = 'pending'
      and enrichment_suggestion.target_type = suggestion.target_type
      and enrichment_suggestion.target_key = suggestion.target_key;
  end if;

  update public.supply_enrichment_suggestions enrichment_suggestion
  set status = p_decision, reviewed_by = actor_id, reviewed_at = now()
  where enrichment_suggestion.id = p_suggestion_id;

  insert into public.platform_admin_audit_log (
    actor_user_id, actor_role, action, entity_type, entity_id, after_data
  ) values (
    actor_id, actor_role,
    case when p_decision = 'accepted' then 'supply.enrichment.accepted' else 'supply.enrichment.rejected' end,
    'supply_enrichment_suggestion', p_suggestion_id,
    jsonb_build_object('leadId', suggestion.lead_id, 'targetType', suggestion.target_type, 'targetKey', suggestion.target_key)
  );
end;
$$;

revoke all on function public.platform_supply_resolve_enrichment_suggestion(uuid,text) from public, anon;
grant execute on function public.platform_supply_resolve_enrichment_suggestion(uuid,text) to authenticated;
