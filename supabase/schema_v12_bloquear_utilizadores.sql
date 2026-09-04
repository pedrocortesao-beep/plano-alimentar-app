-- Fase 4 do ActiveLife: bloquear utilizadores
-- SQL Editor do Supabase → cola isto → Run.

alter table public.profiles add column if not exists blocked boolean not null default false;

create or replace function public.is_blocked(target_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select blocked from public.profiles where id = target_id), false);
$$;

-- Impede que uma conta bloqueada se desbloqueie a si própria (só admin pode)
create or replace function public.prevent_block_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.blocked is distinct from old.blocked and auth.uid() is not null and not public.is_admin() then
    new.blocked := old.blocked;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_block_escalation on public.profiles;
create trigger profiles_prevent_block_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_block_escalation();

-- Uma conta bloqueada deixa de conseguir ler/escrever o seu próprio plano
-- (admins e tutores continuam a poder aceder, para gerir a situação)
drop policy if exists "plans: gerir o próprio, tutelados, ou admin" on public.plans;
create policy "plans: gerir o próprio, tutelados, ou admin" on public.plans
  for all
  using ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id))
  with check ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id));

drop policy if exists "meals: gerir as próprias, tuteladas, ou admin" on public.meals;
create policy "meals: gerir as próprias, tuteladas, ou admin" on public.meals
  for all
  using ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id))
  with check ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id));

drop policy if exists "options: gerir as próprias, tuteladas, ou admin" on public.options;
create policy "options: gerir as próprias, tuteladas, ou admin" on public.options
  for all
  using ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id))
  with check ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id));

drop policy if exists "ingredients: gerir os próprios, tutelados, ou admin" on public.ingredients;
create policy "ingredients: gerir os próprios, tutelados, ou admin" on public.ingredients
  for all
  using ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id))
  with check ((auth.uid() = user_id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(user_id));

-- No perfil, uma conta bloqueada ainda consegue LER o próprio registo (para a
-- app poder mostrar a mensagem de bloqueio), mas não consegue editá-lo.
drop policy if exists "profiles: editar o próprio, tutelados, ou admin" on public.profiles;
create policy "profiles: editar o próprio, tutelados, ou admin" on public.profiles
  for update using ((auth.uid() = id and not public.is_blocked()) or public.is_admin() or public.is_accepted_tutor_of(id));
