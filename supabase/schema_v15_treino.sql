-- Fase 7 do ActiveLife: módulo Plano de Treino
-- SQL Editor do Supabase → cola isto → Run.

create table public.training_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  day_of_week int, -- 0=Domingo ... 6=Sábado, null = sem dia fixo
  position int not null default 0,
  observations text not null default ''
);

alter table public.training_days enable row level security;

create policy "training_days: gerir os próprios, tutelados, ou admin" on public.training_days
  for all
  using ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id))
  with check ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id));

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.training_days(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  sets int,
  reps text,
  weight_kg numeric,
  rest_seconds int,
  notes text default '',
  position int not null default 0
);

alter table public.exercises enable row level security;

create policy "exercises: gerir os próprios, tutelados, ou admin" on public.exercises
  for all
  using ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id))
  with check ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id));
