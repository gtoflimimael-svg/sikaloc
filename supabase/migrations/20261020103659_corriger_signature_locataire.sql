-- Corrige l'échappement du point dans le chemin de signature d'un locataire.
-- Le contrôle applicatif précédent contenait deux antislashs : avec
-- standard_conforming_strings=on, il rejetait les chemins normaux « .png ».
--
-- NOT VALID est intentionnel : la contrainte s'applique à toute nouvelle
-- écriture sans lire ni réécrire les valeurs préexistantes. Une validation
-- exhaustive des anciennes références Storage est hors de ce lot.
alter table public.locataires
  drop constraint if exists locataires_signature_chemin_scope;

alter table public.locataires
  add constraint locataires_signature_chemin_scope
  check (
    signature_chemin is null
    or signature_chemin ~ (
      '^' || bailleur_id::text || '/locataires/' || id::text || '[.](png|jpe?g|webp)$'
    )
  ) not valid;

create or replace function public.definir_signature_locataire(
  p_locataire_id uuid,
  p_chemin text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acteur uuid := auth.uid();
begin
  if v_acteur is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.bailleurs b
    where b.id = v_acteur
      and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
  ) then
    raise exception 'Écriture non autorisée.' using errcode = '42501';
  end if;

  if p_chemin is not null and p_chemin !~ (
    '^' || v_acteur::text || '/locataires/' || p_locataire_id::text || '[.](png|jpe?g|webp)$'
  ) then
    raise exception 'Chemin de signature invalide.' using errcode = '23514';
  end if;

  update public.locataires
     set signature_chemin = p_chemin
   where id = p_locataire_id
     and bailleur_id = v_acteur;

  if not found then
    raise exception 'Locataire introuvable ou non autorisé.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.definir_signature_locataire(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.definir_signature_locataire(uuid,text)
  to authenticated;
