-- Correção: o SQL Editor do Supabase corre sem sessão de utilizador
-- (auth.uid() fica nulo), por isso o gatilho anterior bloqueava mesmo as
-- alterações feitas por ti diretamente ali. Agora só bloqueia quando é
-- mesmo um utilizador autenticado (não-admin) a tentar mudar o papel.

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

-- Agora torna-te administrador (substitui pelo teu user_id):
-- update public.profiles set role = 'admin' where id = 'COLA-AQUI-O-TEU-USER-ID';
