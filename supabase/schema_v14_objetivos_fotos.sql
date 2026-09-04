-- Fase 6 do ActiveLife: objetivos, IMC (calculado, sem tabela nova) e fotos
-- SQL Editor do Supabase → cola isto → Run.

-- 1) Objetivos (peso-alvo e/ou meta de calorias diárias)
create table public.goals (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  target_weight_kg numeric,
  target_kcal numeric,
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "goals: gerir os próprios, tutelados, ou admin" on public.goals
  for all
  using ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id))
  with check ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id));

-- 2) Fotografias das opções de refeição
alter table public.options add column if not exists photo_url text;

insert into storage.buckets (id, name, public)
values ('option-photos', 'option-photos', true)
on conflict (id) do nothing;

drop policy if exists "option-photos: leitura pública" on storage.objects;
create policy "option-photos: leitura pública" on storage.objects
  for select using (bucket_id = 'option-photos');

drop policy if exists "option-photos: upload autenticado" on storage.objects;
create policy "option-photos: upload autenticado" on storage.objects
  for insert with check (bucket_id = 'option-photos' and auth.role() = 'authenticated');

drop policy if exists "option-photos: apagar autenticado" on storage.objects;
create policy "option-photos: apagar autenticado" on storage.objects
  for delete using (bucket_id = 'option-photos' and auth.role() = 'authenticated');
