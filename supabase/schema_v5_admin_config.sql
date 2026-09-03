-- Fase 2b do ActiveLife: configurações de administração
-- SQL Editor do Supabase → cola isto → Run.

create table if not exists public.app_settings (
  id boolean primary key default true,
  menu_order text[] not null default '{gerir,partilhar,agua,sugestoes,dados,modulos,tutores}',
  menu_visibility jsonb not null default '{
    "gerir": ["user","tutor"],
    "partilhar": ["user","tutor"],
    "agua": ["user","tutor"],
    "sugestoes": ["user","tutor"],
    "dados": ["user","tutor"],
    "modulos": ["user","tutor"],
    "tutores": ["user","tutor"]
  }'::jsonb,
  changelog_limit int not null default 5,
  check (id)
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings: qualquer autenticado pode ver" on public.app_settings;
create policy "app_settings: qualquer autenticado pode ver" on public.app_settings
  for select using (auth.role() = 'authenticated');

drop policy if exists "app_settings: só admin edita" on public.app_settings;
create policy "app_settings: só admin edita" on public.app_settings
  for update using (public.is_admin()) with check (public.is_admin());
