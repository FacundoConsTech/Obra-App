alter table public.tasks
add column if not exists active boolean not null default true;

update public.tasks
set active = true
where active is null;
