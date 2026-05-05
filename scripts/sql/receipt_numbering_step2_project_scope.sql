begin;

create table if not exists public.receipt_number_counters_by_project (
  project_id text not null references public.projects(id) on update cascade on delete cascade,
  year integer not null,
  last_value integer not null check (last_value >= 0 and last_value <= 9999),
  updated_at timestamptz not null default now(),
  primary key (project_id, year)
);

with parsed as (
  select
    pr.project_id,
    (m[1])::integer as year,
    (m[2])::integer as suffix
  from public.payment_receipts pr
  cross join lateral regexp_matches(pr.number, '^REC-(\d{4})-(\d+)$') as m
  where pr.project_id is not null
)
insert into public.receipt_number_counters_by_project (project_id, year, last_value, updated_at)
select
  project_id,
  year,
  max(suffix) as last_value,
  now() as updated_at
from parsed
group by project_id, year
on conflict (project_id, year) do update
set
  last_value = greatest(
    public.receipt_number_counters_by_project.last_value,
    excluded.last_value
  ),
  updated_at = now();

create or replace function public.next_receipt_number(
  p_project_id text,
  p_issue_date date default current_date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from coalesce(p_issue_date, current_date))::integer;
  v_next integer;
begin
  if p_project_id is null or btrim(p_project_id) = '' then
    raise exception 'project_id is required for receipt numbering' using errcode = '23502';
  end if;

  insert into public.receipt_number_counters_by_project (
    project_id,
    year,
    last_value,
    updated_at
  )
  values (p_project_id, v_year, 1, now())
  on conflict (project_id, year) do update
  set
    last_value = public.receipt_number_counters_by_project.last_value + 1,
    updated_at = now()
  returning last_value into v_next;

  if v_next > 9999 then
    raise exception 'No hay más números de comprobante disponibles para el proyecto % en %', p_project_id, v_year
      using errcode = '22003';
  end if;

  return 'REC-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function public.assign_payment_receipt_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.number is null or btrim(new.number) = '' then
    new.number := public.next_receipt_number(new.project_id, new.issue_date);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_payment_receipt_number on public.payment_receipts;

create trigger trg_assign_payment_receipt_number
before insert on public.payment_receipts
for each row
execute function public.assign_payment_receipt_number();

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'uq_payment_receipts_number'
      and conrelid = 'public.payment_receipts'::regclass
  ) then
    alter table public.payment_receipts
      drop constraint uq_payment_receipts_number;
  end if;
end $$;

drop index if exists public.uq_payment_receipts_number;
drop index if exists public.idx_payment_receipts_number_unique;

create unique index if not exists uq_payment_receipts_project_number
  on public.payment_receipts(project_id, number)
  where project_id is not null;

create unique index if not exists uq_payment_receipts_number_without_project
  on public.payment_receipts(number)
  where project_id is null;

alter table public.receipt_number_counters_by_project enable row level security;

commit;
