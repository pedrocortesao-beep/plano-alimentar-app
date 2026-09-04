-- Fase 8 do ActiveLife: registo do que foi realmente comido, por dia
-- SQL Editor do Supabase → cola isto → Run.

create table public.consumption_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null default current_date,
  meal_id uuid references public.meals(id) on delete set null, -- null = extra (não faz parte do plano)
  label text not null,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.consumption_log enable row level security;

create policy "consumption_log: gerir o próprio, tutelados, ou admin" on public.consumption_log
  for all
  using ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id))
  with check ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id));

create index if not exists consumption_log_user_date_idx on public.consumption_log (user_id, log_date);
