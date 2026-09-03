-- Fase 3c do ActiveLife: contribuir alimentos + "Fruta" genérica
-- SQL Editor do Supabase → cola isto → Run.

-- Qualquer pessoa autenticada pode ACRESCENTAR alimentos novos à base
-- partilhada; só o admin continua a poder editar/apagar os existentes.
drop policy if exists "foods: só admin gere" on public.foods;

drop policy if exists "foods: só admin edita" on public.foods;
create policy "foods: só admin edita" on public.foods
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "foods: só admin apaga" on public.foods;
create policy "foods: só admin apaga" on public.foods
  for delete using (public.is_admin());

drop policy if exists "foods: qualquer autenticado pode contribuir" on public.foods;
create policy "foods: qualquer autenticado pode contribuir" on public.foods
  for insert with check (auth.role() = 'authenticated');

-- "Fruta" genérica: média aproximada de banana/maçã/pera/laranja, para quando
-- não se quer especificar qual (peso médio de uma peça ≈ 150 g).
insert into public.foods (name, aliases, kcal, protein, carbs, fat, grams_per_unit)
select 'Fruta', '{peça de fruta,fruta variada,fruta da época}', 55, 0.6, 14, 0.2, 150
where not exists (select 1 from public.foods where lower(name) = 'fruta');
