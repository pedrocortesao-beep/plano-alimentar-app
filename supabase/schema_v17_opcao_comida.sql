-- Fase 8b do ActiveLife: guardar qual opção foi marcada como comida
-- SQL Editor do Supabase → cola isto → Run.

alter table public.consumption_log add column if not exists option_id uuid references public.options(id) on delete set null;
