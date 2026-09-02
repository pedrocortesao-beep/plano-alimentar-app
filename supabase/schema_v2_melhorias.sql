-- Melhorias: cadeado no plano, lembrete de água, sugestões
-- Como usar: SQL Editor do Supabase → cola isto → Run.
-- (Só isto — não precisas de repetir o schema.sql original.)

-- Cadeado do plano (protege contra edições acidentais)
alter table public.plans add column if not exists locked boolean not null default false;

-- Definições do lembrete de beber água
create table public.water_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  amount_ml int not null default 250,
  frequency_minutes int not null default 90,
  enabled boolean not null default false
);

alter table public.water_settings enable row level security;

create policy "water_settings: gerir o próprio" on public.water_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Sugestões de melhorias
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "feedback: inserir a própria" on public.feedback
  for insert with check (auth.uid() = user_id);
create policy "feedback: ver as próprias" on public.feedback
  for select using (auth.uid() = user_id);
