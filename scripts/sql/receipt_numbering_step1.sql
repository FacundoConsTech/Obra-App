begin;

create table if not exists public.receipt_number_counters (
  year integer primary key,
  last_value integer not null check (last_value >= 0 and last_value <= 9999),
  updated_at timestamptz not null default now()
);

with parsed as (
  select
    (m[1])::integer as year,
    (m[2])::integer as suffix
  from public.payment_receipts pr
  cross join lateral regexp_matches(pr.number, '^REC-(\d{4})-(\d+)$') as m
)
insert into public.receipt_number_counters (year, last_value, updated_at)
select
  year,
  max(suffix) as last_value,
  now() as updated_at
from parsed
group by year
on conflict (year) do update
set
  last_value = greatest(public.receipt_number_counters.last_value, excluded.last_value),
  updated_at = now();

create or replace function public.next_receipt_number(p_issue_date date default current_date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from coalesce(p_issue_date, current_date))::integer;
  v_next integer;
begin
  insert into public.receipt_number_counters (year, last_value, updated_at)
  values (v_year, 1, now())
  on conflict (year) do update
  set
    last_value = public.receipt_number_counters.last_value + 1,
    updated_at = now()
  returning last_value into v_next;

  if v_next > 9999 then
    raise exception 'No hay más números de comprobante disponibles para %', v_year
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
    new.number := public.next_receipt_number(new.issue_date);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_payment_receipt_number on public.payment_receipts;

create trigger trg_assign_payment_receipt_number
before insert on public.payment_receipts
for each row
execute function public.assign_payment_receipt_number();

alter table public.receipt_number_counters enable row level security;

commit;