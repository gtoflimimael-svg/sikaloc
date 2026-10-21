# Dossier de livraison Sikaloc — préparation locale uniquement

## Référence de ce dossier

- Dépôt : `gtoflimimael-svg/sikaloc`.
- Branche locale : `codex/consolidation-livraison-3`.
- Commit de départ : `76037c70626c078f34d661d00df047dc321d417c`.
- Aucun push, PR, merge ou déploiement n'est inclus ni autorisé par ce document.
- La maintenance de production doit rester active ; aucun état distant n'a été changé ni interrogé pendant cette intervention.

## Sources visuelles et assets

- Références consultées : `DESIGN-sikaloc.md`, `PAGES-sikaloc (1).md`, `PHASE-3-EXECUTION-sikaloc.md` dans Téléchargements. Les copies ne sont pas intégrées au dépôt.
- Logo : utiliser les SVG officiels existants sous `public/marque/`. Le ZIP du kit officiel n'est pas présent dans le worktree.
- Illustrations éditoriales : `public/illustrations/home-01.webp` à `home-04.webp`, plus `home-01-mobile.webp`. Ce sont des scènes de marque stylisées, jamais des annonces ou des captures de logiciel.
- Inter est la famille locale d'interface connue du projet ; Manrope n'est pas disponible localement selon le dossier antérieur. Ne pas télécharger de police ou changer la licence sans revue distincte.
- Les captures `public/demo/` héritées ne doivent pas être présentées comme captures actuelles sans vérification et anonymisation.

## Dépendances et exécution

- Next.js `16.4.2`, React `19.2.8`, Node attendu `22.x` selon `package.json`; versions à confirmer dans la future CI.
- Gestionnaire : npm, verrouillé par `package-lock.json`.
- Variables nécessaires : consulter `.env.example` et le code des routes. Les valeurs ne figurent pas ici ; garder URL/clefs Supabase Test et Production séparées, et les secrets `SUPABASE_SERVICE_ROLE_KEY`, FedaPay, Resend et Cron côté serveur seulement.
- Les environnements Preview ne doivent pas être reliés à Supabase Production ni aux fournisseurs réels. Cette isolation n'est pas démontrée dans ce lot.
- Les paramètres de maintenance doivent rester conformes à `src/lib/maintenance-policy.mjs` et aux règles de déploiement existantes. La réouverture volontaire doit être opérée séparément et explicitement ; ce dossier ne la déclenche pas.

Le bandeau commun des formulaires a été épuré (retrait de son libellé et pictogramme génériques), sans toucher aux actions serveur, validations ou valeurs saisies. Ce changement local n'a pas été vérifié par build ou dans un navigateur.

## Dépendances base et services

- Le dossier précédent recense 57 migrations. Les migrations financières à revue prioritaire incluent `20261020174549_corriger_solde_recu_historique.sql` et `20261020185126_fiabiliser_loyers_echeances.sql` ; aucune migration n'est exécutée dans cette intervention.
- Les RPC, RLS, rôles et privilèges doivent être comparés au commit exact avant toute mise en production. Installation neuve, mise à niveau et compatibilité ancien code/nouveau schéma restent à prouver sur un clone isolé.
- FedaPay/webhooks, Resend, canaux SMS/WhatsApp, Cron/purge et Storage sont des dépendances opérationnelles. Aucun fournisseur ni Cron n'a été appelé.

## Points sensibles / conditions d'arrêt

Avant d'envisager une publication : sauvegarde PostgreSQL et Storage complète, chiffrée et restaurée avec succès dans un environnement distinct ; migrations exécutées dans l'ordre sur clone ; sessions Auth synthétiques et RLS réelles ; parcours de documents et flux financiers ; protection Preview ; CI GitHub et protections `main` ; surveillance et reprise des webhooks/Cron. Les détails et statuts sont dans `REGISTRE-RESERVES.md` et `PLAN-MISE-EN-PRODUCTION.md`.

Ne pas déployer le code avec les migrations restrictives dans un ordre supposé atomique : l'ancien code effectue des écritures directes tandis que le nouveau dépend de RPC. Le propriétaire et les responsables DB doivent valider une séquence additive puis code compatible puis révocations, ainsi qu'un correctif en avant. Garder la maintenance active tant que chaque condition de sortie n'est pas explicitement satisfaite.

## État de cette livraison locale

Le commit de cette branche et les fichiers modifiés sont à relever dans le rapport final et l'historique Git. Tests, build et recette sont suspendus à la demande de l'utilisateur ; aucun résultat antérieur ne valide le présent delta. Les statuts individuels des 56 routes sont décrits dans `ETAT-FINAL-SIKALOC.md`.
