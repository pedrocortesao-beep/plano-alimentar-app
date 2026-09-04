-- Fase 3d do ActiveLife: revisão — impede alimentos duplicados
-- SQL Editor do Supabase → cola isto → Run.

-- Remove duplicados que possam já existir (mantém o mais antigo de cada nome)
delete from public.foods a using public.foods b
where lower(a.name) = lower(b.name) and a.id > b.id;

-- A partir de agora, o nome (sem distinguir maiúsculas/minúsculas) tem de ser único
create unique index if not exists foods_name_unique_idx on public.foods (lower(name));
