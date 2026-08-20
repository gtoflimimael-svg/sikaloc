-- =============================================================================
-- Sikaloc — Sécurité : verrouiller le format de `signature_chemin`
--
-- Constat : `bailleurs.signature_chemin` et `locataires.signature_chemin`
-- n'étaient soumis à aucune contrainte de format. Or les RLS sur ces deux
-- tables (migration 20260817000300) n'autorisent l'écriture QUE de la ligne
-- dont on est propriétaire — elles ne disent rien sur la *valeur* écrite dans
-- la colonne elle-même.
--
-- Conséquence exploitable : un bailleur authentifié pouvait, par un appel
-- direct à l'API Supabase (hors de nos Server Actions, donc hors de la
-- validation applicative), poser sur SA PROPRE ligne un `signature_chemin`
-- pointant vers le fichier d'un AUTRE bailleur — par exemple
-- « <id-de-quelquun-d-autre>/signature.png ». `chargerSignature()`
-- (`src/lib/quittance.ts`) lit ce chemin avec le client *admin*, qui
-- contourne délibérément les policies Storage (c'est son rôle légitime pour
-- générer des documents) : la valeur de la colonne devenait donc le seul
-- rempart, et il était absent. Le résultat aurait été la fuite de l'image de
-- signature — donc potentiellement de l'identité manuscrite — d'un bailleur
-- vers les quittances d'un autre.
--
-- Le correctif reproduit, au niveau de la colonne, exactement la même règle
-- que la policy Storage applique déjà sur le chemin physique du fichier
-- (`(storage.foldername(name))[1] = auth.uid()::text`) : la valeur ne peut
-- désigner qu'un fichier dont le premier segment est l'identifiant du
-- bailleur propriétaire de la ligne, et dont la forme correspond exactement
-- à ce que nos Server Actions écrivent.
-- =============================================================================

-- Précaution : purger toute valeur qui ne respecterait déjà pas la règle,
-- avant de la rendre obligatoire — la contrainte échouerait sinon sur une
-- ligne existante non conforme.
update public.bailleurs
   set signature_chemin = null
 where signature_chemin is not null
   and signature_chemin !~ ('^' || id::text || '/signature\.(png|jpe?g|webp)$');

update public.locataires
   set signature_chemin = null
 where signature_chemin is not null
   and signature_chemin !~ (
     '^' || bailleur_id::text || '/locataires/' || id::text || '\.(png|jpe?g|webp)$'
   );

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bailleurs_signature_chemin_scope'
  ) then
    alter table public.bailleurs
      add constraint bailleurs_signature_chemin_scope
      check (
        signature_chemin is null
        or signature_chemin ~ ('^' || id::text || '/signature\.(png|jpe?g|webp)$')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'locataires_signature_chemin_scope'
  ) then
    alter table public.locataires
      add constraint locataires_signature_chemin_scope
      check (
        signature_chemin is null
        or signature_chemin ~ (
          '^' || bailleur_id::text || '/locataires/' || id::text || '\.(png|jpe?g|webp)$'
        )
      );
  end if;
end
$$;

comment on constraint bailleurs_signature_chemin_scope on public.bailleurs is
  'Le chemin ne peut désigner que le fichier de signature de CE bailleur — empêche de faire lire par le générateur PDF (client admin, hors RLS Storage) le fichier d''un autre bailleur.';
comment on constraint locataires_signature_chemin_scope on public.locataires is
  'Le chemin ne peut désigner que le fichier de signature de CE locataire, sous le dossier de SON bailleur — même raison que la contrainte homologue sur bailleurs.';
