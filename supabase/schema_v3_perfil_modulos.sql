-- Fase 1 do ActiveLife: dados pessoais e seleção de módulos
-- SQL Editor do Supabase → cola isto → Run.

alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists sex text;
alter table public.profiles add column if not exists modules text[] not null default '{plano_alimentar}';
