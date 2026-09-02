-- Plano Alimentar — esquema da base de dados para o Supabase
-- Como usar: Supabase → o teu projeto → SQL Editor → cola este ficheiro todo → Run.

-- 1) Perfis (nome de cada utilizador, ligado à conta de autenticação)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: ver o próprio" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: editar o próprio" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles: criar o próprio" on public.profiles
  for insert with check (auth.uid() = id);

-- Cria automaticamente uma linha em "profiles" sempre que alguém se regista
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2) Planos (um por utilizador, para já)
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  observations text not null default '',
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

create policy "plans: gerir o próprio" on public.plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Refeições
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  meal_time text,           -- formato "HH:MM", opcional
  position int not null default 0,
  observations text not null default '',
  selected_option_id uuid   -- FK adicionada depois de "options" existir
);

alter table public.meals enable row level security;

create policy "meals: gerir as próprias" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) Opções de refeição
create table public.options (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  observations text not null default ''
);

alter table public.options enable row level security;

create policy "options: gerir as próprias" on public.options
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.meals
  add constraint meals_selected_option_fkey
  foreign key (selected_option_id) references public.options(id) on delete set null;

-- 5) Ingredientes
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default '',
  qty text default '',
  unit text default 'g',
  notes text default ''
);

alter table public.ingredients enable row level security;

create policy "ingredients: gerir os próprios" on public.ingredients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6) Lembrete para beber água (definições por utilizador)
create table public.water_reminder_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  interval_minutes int not null default 120,
  start_time text not null default '08:00',  -- formato "HH:MM"
  end_time text not null default '22:00',    -- formato "HH:MM"
  timezone text not null default 'Europe/Lisbon',
  last_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.water_reminder_settings enable row level security;

create policy "water_reminder_settings: gerir o próprio" on public.water_reminder_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 7) Subscrições de notificações push (uma por dispositivo/navegador)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: gerir as próprias" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
