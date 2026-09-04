-- Fase 5 do ActiveLife: módulo de Métricas
-- SQL Editor do Supabase → cola isto → Run.

create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric,
  height_cm numeric,
  waist_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  chest_cm numeric,
  notes text default '',
  created_at timestamptz not null default now()
);

alter table public.metrics enable row level security;

create policy "metrics: gerir os próprios, tutelados, ou admin" on public.metrics
  for all
  using ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id))
  with check ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id));
