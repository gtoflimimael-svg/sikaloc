# Sikaloc — état du projet

> **Source d'état unique.** Ce fichier remplace les rapports d'octobre 2026,
> archivés dans [`docs/archives/2026-10/`](docs/archives/2026-10/README.md).
> Il est mis à jour à chaque fusion dans `main` et à chaque opération sur un
> environnement hébergé. `tests/documentation.test.mjs` vérifie que les
> chiffres ci-dessous correspondent au dépôt.

**Date de l'état : 22 novembre 2026.**

## 1. Environnements

| Environnement | État | Vérifié |
|---|---|---|
| Production (`sikaloc.com`) | Code de `main` (`cd737a3`) ; **61 migrations** appliquées | Liste des migrations lue en lecture seule le 22/11/2026. Déploiement Vercel servi non vérifié (accès Vercel non fourni). |
| Sikaloc-Test (hébergé) | **En pause** | Réactivation prévue après la clôture des lots (décision du 22/11/2026). |
| Pile locale de démonstration | Port 54821, 68 migrations | Recette locale des parcours connectés, 22/11/2026. |
| CI GitHub (`Quality gates`) | Postgres jetable et pile E2E jetable, à chaque PR | Voir §3. |

## 2. Migrations

- **Dépôt : 68 migrations**, dont **61 livrées en production** et verrouillées
  par empreinte SHA-256 dans `supabase/migrations.lock.json`.
- `npm run verifier:migrations` échoue si une migration livrée est modifiée ou
  supprimée, ou si une nouvelle migration est antidatée.
- **7 migrations à livrer**, dans cet ordre :

| Migration | Lot | Objet |
|---|---|---|
| `20261122140000_apercu_echeance_paiement.sql` | 1 | Aperçu fidèle de l'échéance avant émission (FN-05) |
| `20261122150000_limiter_tentatives_connexion.sql` | 2 | Limitation des connexions par email, IP et couple (SEC-03) |
| `20261122160000_retirer_droits_residuels.sql` | 2 | Retrait des droits TRIGGER, REFERENCES, TRUNCATE, MAINTAIN (SEC-07) |
| `20261122170000_colonnes_schema.sql` | 3 | Contrôle de schéma nocturne sans faux positif |
| `20261122180000_reutiliser_brouillon_paiement.sql` | 4 | Reprise du brouillon de paiement existant (FN-06) |
| `20261122181000_quota_heure_benin.sql` | 4 | Quotas calculés à l'heure du Bénin (FN-03) |
| `20261122182000_indexer_cles_etrangeres.sql` | 4 | Index des clés étrangères (DB-01) |

Après l'application en production : `npm run verrouiller:migrations`, puis
mettre à jour ce tableau.

## 3. Lots de mise à niveau (audit du 22/11/2026, note initiale 66/100)

| Lot | Branche / PR | Constats traités | CI |
|---|---|---|---|
| 1. Parcours quittance | `fix/parcours-quittance` — #9 | FN-04, FN-05 | validate ✓ |
| 2. Sécurité applicative | `fix/securite-applicative` — #10 | SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07 | validate ✓ |
| 3. Fiabilité | `fix/fiabilite` — #11 | OPS-01 (code), OPS-03, OPS-06, OPS-07 | validate ✓, base-reelle ✓ |
| 4. UX, SEO, performance | `fix/ux-performance` — #12 | UX-01, UX-02, UX-03, SEO-01, PERF-01, FN-03, FN-06, DB-01 | validate ✓ |
| 5. Tests de bout en bout | `fix/tests-e2e` — #13, cumulatif (lots 1 à 4) | QA-01, FN-01 (simulé) | validate ✓, base-reelle ✓, bout-en-bout ✓ |
| 6. Documentation | `fix/documentation` — #14, cumulatif (lots 1 à 5) | ARCH-02 | voir la PR |

Aucune de ces PR n'est fusionnée ; rien n'est déployé.

## 4. Ce qui est vérifié

| Preuve | Portée | Où |
|---|---|---|
| `npm test` | Tests unitaires et statiques, dont gardes de sécurité, CSP, limitation, verrou des migrations | CI `validate`, chaque PR |
| Scénarios SQL sur Postgres jetable | 68 migrations appliquées sur base vierge ; isolation entre bailleurs (RLS) ; reçu historique | CI `base-reelle` (`tests/*.integration.sql`) |
| 9 parcours de bout en bout | Accès anonyme refusé, CSP à nonce, 13 pages Pro, isolation, premier paiement avec signature puis quittance, brouillon repris, locataire, blocage après 5 échecs, abonnement FedaPay simulé | CI `bout-en-bout` (`tests/e2e/parcours.e2e.mjs`) |
| Tests de mutation | Le test SQL échoue si la RLS est retirée ; le parcours E2E échoue si FN-04 est réintroduit | Exécutés localement le 22/11/2026 |
| Recette locale | Parcours connectés Pro et Me, ordinateur et mobile, pile de démonstration | 22/11/2026 ; détail par page dans [`MATRICE-PAGES.md`](MATRICE-PAGES.md) |
| Dépendances | `npm audit --omit=dev` : 0 vulnérabilité en production | 22/11/2026 (des avis subsistent dans les outils de développement) |

## 5. Réserves ouvertes

### Avant mise en production

| Réf. | Réserve | Responsable | Action |
|---|---|---|---|
| OPS-02 | Restauration de production jamais démontrée | Équipe + Claude | Sauvegarde chiffrée, puis restauration sur Sikaloc-Test |
| OPS-04 | Sikaloc-Test en pause | Propriétaire du compte Supabase | Réactiver après la clôture des lots |
| — | Recette hébergée | Claude | Appliquer les 7 migrations sur Sikaloc-Test, rejouer les parcours |
| SEC-01 | Mots de passe compromis acceptés | Propriétaire du compte Supabase | Activer la protection contre les mots de passe compromis (Dashboard Supabase → Authentication, réglages des mots de passe) |
| LEG-01 | Mentions légales absentes (`/legal/mentions` répond 404 tant que l'éditeur n'est pas renseigné) | Éditeur du site | Fournir raison sociale, adresse, directeur de publication ; `src/lib/mentions-legales.ts` |
| OPS-01 | Supervision : code prêt, inerte sans DSN | Propriétaire du compte Sentry | Créer le projet et fournir `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` |
| FN-01 | FedaPay validé contre un service simulé seulement | Propriétaire du compte FedaPay | Clés sandbox réelles pour un essai hébergé, sans paiement réel |
| — | Déploiement servi inconnu | Propriétaire du compte Vercel | Donner l'accès au projet Vercel |

### Différables

| Réf. | Réserve | Décision attendue |
|---|---|---|
| SEC-09 | Données Find conservées sans usage actif ; index et politiques Find en double | Conserver, anonymiser ou supprimer (décision reportée) |
| PERF-01, PERF-02 | Gain mesurable seulement sur un déploiement représentatif | Mesurer après déploiement |
| ARCH-01 | `src/app/globals.css` monolithique (4 617 lignes) | Découpage par espace, dans un lot distinct |
| OPS-05 | Copies et worktrees obsolètes sur le poste | Nettoyage manuel |
| — | Sauvegardes chiffrées hors du poste | Choisir un stockage |
| — | Transaction FedaPay inconnue : réponse 503, FedaPay réessaie | Comportement prudent conservé ; aucun crédit sans transaction vérifiée |
| — | Validation juridique formelle de la quittance (avis d'un professionnel béninois) | Avant les pilotes |

## 6. Séquence de livraison prévue

1. Clôture des lots locaux (lots 1 à 6).
2. Réactivation de Sikaloc-Test ; application des 7 migrations ; recette
   hébergée ; essai de restauration (OPS-02).
3. Sauvegarde de production, puis application des migrations en production,
   avec confirmation explicite.
4. Fusion des PR (déploiement), mesure des performances,
   `npm run verrouiller:migrations`.
5. Mise à jour de ce fichier et nouvel audit.
