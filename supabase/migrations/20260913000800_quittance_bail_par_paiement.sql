-- ═══════════════════════════════════════════════════════════════════════════
-- La quittance désigne son bail par le paiement, et par rien d'autre
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Le fait dupliqué ──────────────────────────────────────────────────────
--
-- `quittances.bail_id` était écrit à l'insertion du document et plus jamais
-- ensuite : la branche de régénération de `genererEtStocker` ne met à jour que
-- `type`, `pdf_chemin` et `hash_sha256`.
--
-- Or `corrigerPaiement` permet au bailleur de déplacer un paiement d'un bail à
-- l'autre pendant les cinq minutes qui suivent la validation. Ce n'est pas un
-- usage détourné : c'est la raison d'être de cette fenêtre, et le formulaire
-- propose explicitement tous ses baux actifs, libellés « Locataire — adresse ».
--
-- Après une telle correction, la base portait deux réponses à une seule
-- question :
--
--     paiements.bail_id   = bail de Bob     (corrigé, et c'est Bob sur le PDF)
--     quittances.bail_id  = bail d'Alice    (figé à l'insertion, désormais faux)
--
-- Aucune clé étrangère composite, aucun `check`, aucun déclencheur ne les
-- tenait égaux — seul `quittances.paiement_id` est unique.
--
-- ─── Ce que la divergence produisait déjà ──────────────────────────────────
--
-- `ma_quittance()` avait été écrite pour joindre par le paiement : l'espace
-- locataire n'était pas exposé. La page du bailleur, elle, embarquait le bail
-- PAR CETTE COLONNE :
--
--     .select('*, paiement:paiements(*), bail:baux(…locataire:locataires(…))')
--
-- Elle affichait donc le locataire d'Alice à côté du PDF de Bob — et, plus
-- grave, construisait le lien « Envoyer au locataire sur WhatsApp » avec le
-- NUMÉRO d'Alice et l'URL signée du document de Bob. Un clic suffisait à
-- adresser à un locataire la quittance d'un autre : son nom, son loyer, sa
-- période, l'adresse de son logement.
--
-- ─── Pourquoi supprimer plutôt que réécrire ────────────────────────────────
--
-- Deux voies existaient : réécrire `bail_id` à chaque régénération et poser un
-- déclencheur qui garantisse l'égalité, ou retirer la colonne.
--
-- La seconde est retenue, parce qu'après correction de la page il ne reste
-- AUCUN lecteur de cette colonne — ni en SQL, ni dans l'application. Poser un
-- déclencheur revenait à monter une garde autour d'une donnée que plus personne
-- ne lit, tout en laissant intacte la possibilité même de la divergence. On ne
-- répare pas un fait dupliqué en le surveillant : on cesse de le dupliquer.
--
-- `paiements.bail_id` est la meilleure source, et de loin :
--   · `quittances.paiement_id` est unique et n'est jamais réécrit — le chemin
--     est donc sans ambiguïté ;
--   · c'est la valeur à partir de laquelle le PDF est rendu, donc la seule qui
--     s'accorde toujours avec le document réellement déposé ;
--   · `proteger_paiement_fige` interdit tout UPDATE passé cinq minutes : elle
--     est aussi immuable que l'était la colonne retirée, mais elle est vraie.
--
-- ─── Ce que la clé étrangère retirée ne protégeait pas ─────────────────────
--
-- `quittances.bail_id` portait `on delete restrict`, ce qui donne l'impression
-- de protéger les documents contre la suppression d'un bail. Elle n'y ajoutait
-- rien : `paiements.bail_id` porte le MÊME `on delete restrict`, et toute
-- quittance suppose un paiement (`paiement_id` est `not null`). Un bail portant
-- une quittance est donc déjà, et reste, indestructible.
--
-- L'index `quittances_bail_id_idx` ne servait aucune requête : rien ne filtrait
-- les quittances par bail.

-- ── Retirer ────────────────────────────────────────────────────────────────
drop index if exists public.quittances_bail_id_idx;

alter table public.quittances
  drop column if exists bail_id;

comment on column public.quittances.paiement_id is
  'Le paiement acquitté — et le seul chemin vers le bail, le locataire et le '
  'logement du document. Unique, jamais réécrit, et figé avec le paiement '
  'passé la fenêtre de correction de cinq minutes.';
