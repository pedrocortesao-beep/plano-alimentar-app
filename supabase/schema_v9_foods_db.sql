-- Fase 3b do ActiveLife: base de dados de alimentos (gerida pelo admin)
-- SQL Editor do Supabase → cola isto → Run.

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aliases text[] not null default '{}',
  kcal numeric not null,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  grams_per_unit numeric,
  created_at timestamptz not null default now()
);

alter table public.foods enable row level security;

drop policy if exists "foods: qualquer autenticado pode ver" on public.foods;
create policy "foods: qualquer autenticado pode ver" on public.foods
  for select using (auth.role() = 'authenticated');

drop policy if exists "foods: só admin gere" on public.foods;
create policy "foods: só admin gere" on public.foods
  for all using (public.is_admin()) with check (public.is_admin());

-- Semente inicial (os mesmos ~38 alimentos que já tínhamos embutidos no código)
insert into public.foods (name, aliases, kcal, protein, carbs, fat, grams_per_unit) values
('Aveia', '{flocos de aveia}', 379, 13.5, 62, 7, null),
('Leite', '{leite meio gordo}', 46, 3.4, 4.8, 1.6, null),
('Leite magro', '{leite desnatado}', 35, 3.4, 5, 0.1, null),
('Banana', '{}', 89, 1.1, 23, 0.3, 120),
('Maçã', '{maca}', 52, 0.3, 14, 0.2, 150),
('Laranja', '{}', 47, 0.9, 12, 0.1, 130),
('Pera', '{}', 57, 0.4, 15, 0.1, 150),
('Ovo', '{ovos}', 155, 13, 1.1, 11, 55),
('Pão', '{pao}', 265, 9, 49, 3.2, 50),
('Pão integral', '{pao integral}', 247, 13, 41, 3.4, 50),
('Iogurte', '{iogurte natural}', 61, 3.5, 4.7, 3.3, 125),
('Iogurte grego', '{}', 97, 9, 4, 5, 125),
('Cereais', '{cereais de pequeno-almoço}', 378, 7, 84, 1, null),
('Frutos secos', '{mistura de frutos secos,oleaginosas}', 607, 15, 20, 54, null),
('Amêndoas', '{amendoas}', 579, 21, 22, 50, null),
('Nozes', '{}', 654, 15, 14, 65, null),
('Frango', '{peito de frango}', 165, 31, 0, 3.6, null),
('Carne de vaca', '{vaca,novilho}', 217, 26, 0, 12, null),
('Peixe branco', '{pescada,faneca}', 82, 18, 0, 1, null),
('Salmão', '{salmao}', 208, 20, 0, 13, null),
('Atum', '{atum em lata}', 116, 26, 0, 1, null),
('Arroz', '{arroz branco}', 130, 2.7, 28, 0.3, null),
('Arroz integral', '{}', 123, 2.6, 26, 1, null),
('Massa', '{esparguete,macarrão}', 131, 5, 25, 1.1, null),
('Batata', '{}', 77, 2, 17, 0.1, null),
('Batata-doce', '{batata doce}', 86, 1.6, 20, 0.1, null),
('Legumes', '{legumes variados,salteado de legumes}', 35, 2, 6, 0.3, null),
('Brócolos', '{brocolos}', 34, 2.8, 7, 0.4, null),
('Cenoura', '{}', 41, 0.9, 10, 0.2, null),
('Tomate', '{}', 18, 0.9, 3.9, 0.2, null),
('Alface', '{}', 15, 1.4, 2.9, 0.2, null),
('Feijão', '{feijao,feijão cozido}', 127, 8.7, 23, 0.5, null),
('Grão-de-bico', '{grao,grão}', 164, 9, 27, 2.6, null),
('Queijo', '{}', 350, 25, 1.3, 27, null),
('Queijo fresco', '{}', 98, 11, 3.4, 4.3, null),
('Azeite', '{}', 884, 0, 0, 100, null),
('Manteiga', '{}', 717, 0.9, 0.1, 81, null),
('Mel', '{}', 304, 0.3, 82, 0, null),
('Açúcar', '{acucar}', 387, 0, 100, 0, null)
on conflict do nothing;
