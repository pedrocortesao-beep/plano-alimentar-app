-- Fase 2 do ActiveLife: administradores e tutores
-- SQL Editor do Supabase → cola isto → Run.

-- 1) Papel da conta (admin ou utilizador normal)
alter table public.profiles add column if not exists role text not null default 'user' check (role in ('admin', 'user'));
alter table public.profiles add column if not exists email text;

-- Guarda também o email no perfil, para os administradores identificarem contas
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Impede que alguém (que não seja admin) se autopromova ou promova outros a admin
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_role_escalation();

-- 2) Funções auxiliares (security definer para evitar recursão nas políticas)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_accepted_tutor_of(target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.tutor_relationships
    where tutor_id = auth.uid() and user_id = target_user_id and status = 'accepted'
  );
$$;

-- 3) Relações tutor/utilizador
create table if not exists public.tutor_relationships (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  requested_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (tutor_id <> user_id),
  unique (tutor_id, user_id)
);

alter table public.tutor_relationships enable row level security;

drop policy if exists "tutor_relationships: ver as próprias" on public.tutor_relationships;
create policy "tutor_relationships: ver as próprias" on public.tutor_relationships
  for select using (auth.uid() = tutor_id or auth.uid() = user_id or public.is_admin());
drop policy if exists "tutor_relationships: atualizar as próprias" on public.tutor_relationships;
create policy "tutor_relationships: atualizar as próprias" on public.tutor_relationships
  for update using (auth.uid() = tutor_id or auth.uid() = user_id or public.is_admin());
drop policy if exists "tutor_relationships: remover as próprias" on public.tutor_relationships;
create policy "tutor_relationships: remover as próprias" on public.tutor_relationships
  for delete using (auth.uid() = tutor_id or auth.uid() = user_id or public.is_admin());

-- Convites e respostas passam por funções (para poder procurar o email de forma segura)
create or replace function public.invite_relationship(target_email text, invite_as_tutor boolean)
returns public.tutor_relationships
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  result_row public.tutor_relationships;
begin
  select id into target_id from auth.users where email = target_email limit 1;
  if target_id is null then
    raise exception 'Não existe nenhuma conta com esse email.';
  end if;
  if target_id = auth.uid() then
    raise exception 'Não podes convidar-te a ti próprio.';
  end if;

  if invite_as_tutor then
    insert into public.tutor_relationships (tutor_id, user_id, status, requested_by)
    values (target_id, auth.uid(), 'pending', auth.uid())
    on conflict (tutor_id, user_id) do update
      set status = 'pending', requested_by = auth.uid(), responded_at = null
    returning * into result_row;
  else
    insert into public.tutor_relationships (tutor_id, user_id, status, requested_by)
    values (auth.uid(), target_id, 'pending', auth.uid())
    on conflict (tutor_id, user_id) do update
      set status = 'pending', requested_by = auth.uid(), responded_at = null
    returning * into result_row;
  end if;

  return result_row;
end;
$$;

grant execute on function public.invite_relationship(text, boolean) to authenticated;

create or replace function public.respond_relationship(relationship_id uuid, new_status text)
returns public.tutor_relationships
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.tutor_relationships;
begin
  select * into result_row from public.tutor_relationships where id = relationship_id;
  if result_row is null then raise exception 'Relação não encontrada.'; end if;
  if auth.uid() not in (result_row.tutor_id, result_row.user_id) then raise exception 'Sem permissão.'; end if;
  if new_status not in ('accepted', 'declined') then raise exception 'Estado inválido.'; end if;

  update public.tutor_relationships
    set status = new_status, responded_at = now()
    where id = relationship_id
    returning * into result_row;

  return result_row;
end;
$$;

grant execute on function public.respond_relationship(uuid, text) to authenticated;

-- 4) Alargar o acesso: admins veem tudo, tutores aceites veem/gerem os seus utilizadores
drop policy if exists "profiles: ver o próprio" on public.profiles;
drop policy if exists "profiles: ver o próprio, tutelados, ou admin" on public.profiles;
create policy "profiles: ver o próprio, tutelados, ou admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin() or public.is_accepted_tutor_of(id));

drop policy if exists "profiles: editar o próprio" on public.profiles;
drop policy if exists "profiles: editar o próprio, tutelados, ou admin" on public.profiles;
create policy "profiles: editar o próprio, tutelados, ou admin" on public.profiles
  for update using (auth.uid() = id or public.is_admin() or public.is_accepted_tutor_of(id));

drop policy if exists "plans: gerir o próprio" on public.plans;
drop policy if exists "plans: gerir o próprio, tutelados, ou admin" on public.plans;
create policy "plans: gerir o próprio, tutelados, ou admin" on public.plans
  for all
  using (auth.uid() = user_id or public.is_admin() or public.is_accepted_tutor_of(user_id))
  with check (auth.uid() = user_id or public.is_admin() or public.is_accepted_tutor_of(user_id));

drop policy if exists "meals: gerir as próprias" on public.meals;
drop policy if exists "meals: gerir as próprias, tuteladas, ou admin" on public.meals;
create policy "meals: gerir as próprias, tuteladas, ou admin" on public.meals
  for all
  using (auth.uid() = user_id or public.is_admin() or public.is_accepted_tutor_of(user_id))
  with check (auth.uid() = user_id or public.is_admin() or public.is_accepted_tutor_of(user_id));

drop policy if exists "options: gerir as próprias" on public.options;
drop policy if exists "options: gerir as próprias, tuteladas, ou admin" on public.options;
create policy "options: gerir as próprias, tuteladas, ou admin" on public.options
  for all
  using (auth.uid() = user_id or public.is_admin() or public.is_accepted_tutor_of(user_id))
  with check (auth.uid() = user_id or public.is_admin() or public.is_accepted_tutor_of(user_id));

drop policy if exists "ingredients: gerir os próprios" on public.ingredients;
drop policy if exists "ingredients: gerir os próprios, tutelados, ou admin" on public.ingredients;
create policy "ingredients: gerir os próprios, tutelados, ou admin" on public.ingredients
  for all
  using (auth.uid() = user_id or public.is_admin() or public.is_accepted_tutor_of(user_id))
  with check (auth.uid() = user_id or public.is_admin() or public.is_accepted_tutor_of(user_id));

-- 5) Torna-te administrador (substitui pelo teu user_id — vê-lo em Authentication → Users)
-- update public.profiles set role = 'admin' where id = 'COLA-AQUI-O-TEU-USER-ID';
