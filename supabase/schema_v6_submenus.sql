-- Fase 2c do ActiveLife: submenus no menu ⋮
-- SQL Editor do Supabase → cola isto → Run.

alter table public.app_settings add column if not exists menu_structure jsonb;

update public.app_settings
set menu_structure = '[
  {"type":"item","key":"gerir"},
  {"type":"item","key":"partilhar"},
  {"type":"item","key":"agua"},
  {"type":"item","key":"sugestoes"},
  {"type":"item","key":"dados"},
  {"type":"item","key":"modulos"},
  {"type":"item","key":"tutores"}
]'::jsonb
where menu_structure is null;
