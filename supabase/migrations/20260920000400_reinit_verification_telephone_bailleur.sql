-- ═══════════════════════════════════════════════════════════════════════════
-- Sikaloc — S8-G.1 : le changement de numéro bailleur efface sa vérification
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── La dette relevée en S8-G ──────────────────────────────────────────────
--
-- Le candidat (S8-G) perd sa vérification dès qu'il change de numéro, imposé
-- par un déclencheur. Le bailleur, lui, ne l'avait pas : `parametres.ts` écrit
-- `bailleurs.telephone` sans toucher à `telephone_verifie_le`. Un bailleur
-- pouvait donc changer de numéro en gardant un « vérifié » qui ne valait plus
-- rien — un document de loyer serait parti chez un inconnu, ce que la
-- vérification existe précisément pour empêcher.
--
-- ─── Le correctif, à l'identique du candidat ───────────────────────────────
--
-- Un déclencheur BEFORE UPDATE OF telephone, garanti par la base, pas par
-- l'application : une requête directe qui changerait le numéro sans passer par
-- le formulaire tombe sur la même règle.
--
-- ─── Une différence avec le candidat : le canal ────────────────────────────
--
-- Le bailleur porte `telephone_canal_verification`, lié à `telephone_verifie_le`
-- par la contrainte `bailleurs_canal_verification_valide` (les deux nuls, ou les
-- deux renseignés). Réinitialiser la date sans le canal violerait cette
-- contrainte. Le déclencheur remet donc les DEUX à NULL.
--
-- ─── Ce qu'il ne réinitialise pas ──────────────────────────────────────────
--
-- Le déclencheur de canonisation (`canoniser_telephone`) s'exécute avant celui-
-- ci (ordre alphabétique, 'c' < 'r') : `new.telephone` est déjà canonique quand
-- on le compare. Réécrire le MÊME numéro dans une autre graphie ne le change
-- donc pas, et n'efface pas la vérification. Modifier le nom ou l'adresse non
-- plus : le déclencheur ne s'arme que sur une écriture de `telephone`.
--
-- ─── Ce que cette migration ne touche pas ──────────────────────────────────
--
-- Ni le service OTP (`otp.ts`), ni le transport (aucun fournisseur), ni le
-- candidat, ni la logique de vérification. Un seul déclencheur, une seule
-- table.

create or replace function prive.reinitialiser_verification_bailleur()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.telephone is distinct from old.telephone then
    new.telephone_verifie_le := null;
    -- Le canal DOIT suivre : la contrainte de cohérence lie les deux colonnes.
    new.telephone_canal_verification := null;
  end if;
  return new;
end;
$$;

create trigger reinitialiser_verification_bailleur
  before update of telephone on public.bailleurs
  for each row
  execute function prive.reinitialiser_verification_bailleur();

-- ─── Fermer l'écriture directe de l'état de vérification ───────────────────
--
-- L'audit S8-G.1 a mis au jour un trou pré-existant, des deux côtés :
-- `authenticated` avait le droit d'écrire les colonnes de VÉRIFICATION. Un
-- bailleur — ou un candidat — pouvait donc se marquer « vérifié » d'une simple
-- requête, sans code. Le commentaire de `verifierCodeTelephoneAction` affirmait
-- pourtant l'inverse ; l'intention était juste, l'enforcement manquait.
--
-- On révoque ce droit. Seul le service (client admin, après un OTP validé)
-- écrit désormais la vérification. Les flux légitimes ne sont pas touchés :
--
--   · la vérification bailleur/candidat passe déjà par `creerClientAdmin`
--     (service_role), au-dessus de ces droits ;
--   · la mise à jour de profil écrit `nom`, `telephone`, `adresse`,
--     `notif_whatsapp` — jamais ces colonnes — dont les droits restent ;
--   · le déclencheur de réinitialisation ci-dessus met la vérification à NULL
--     par son PROPRE fait : le privilège de colonne se vérifie sur le SET de la
--     requête, pas sur ce qu'un trigger BEFORE modifie. Changer de numéro
--     efface donc toujours la vérification, même sans droit d'écriture dessus.

-- Le droit était accordé au niveau TABLE : révoquer au niveau colonne n'aurait
-- rien fait (la table couvre toutes ses colonnes). On révoque donc le droit
-- table, puis on le rend colonne par colonne — toutes SAUF la vérification.
-- Une colonne future ne sera pas écrivable par un client tant qu'un grant
-- explicite ne l'ajoute pas : le défaut sûr.

revoke update on public.bailleurs from authenticated;
grant update (
  adresse, avatar, avatar_temporaire_depuis, code_parrainage, created_at,
  date_echec_paiement, date_fin_abonnement, dernier_rappel_envoye, email, id,
  nb_logements_declare, nom, notif_email, notif_whatsapp, onboarding_termine,
  parrain_id, photo_chemin, plan, signature_chemin, statut_abonnement,
  telephone, tutoriel_vu_le, visite_quittee_le
) on public.bailleurs to authenticated;

revoke update on public.candidats from authenticated;
grant update (
  created_at, id, mis_a_jour_le, nom, notif_whatsapp, telephone
) on public.candidats to authenticated;
