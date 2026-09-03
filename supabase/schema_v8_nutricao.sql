-- Fase 3 do ActiveLife: valores nutricionais por ingrediente
-- SQL Editor do Supabase → cola isto → Run.

alter table public.ingredients add column if not exists kcal_per_100 numeric;
alter table public.ingredients add column if not exists protein_per_100 numeric;
alter table public.ingredients add column if not exists carbs_per_100 numeric;
alter table public.ingredients add column if not exists fat_per_100 numeric;
alter table public.ingredients add column if not exists grams_per_unit numeric;
