# Sikaloc — priorité 1, sécurité et intégration

Date : 21 octobre 2026. Branche locale `codex/securite-integration-1`, créée depuis `ef35bd35b49b890b706c8a7f577c2d0aa5e02412`. Verdict : **BLOQUÉ / NON VALIDÉ** pour le fonctionnement réel. Aucun projet distant n'a été modifié ou utilisé pour les tests.

## Environnement et cible

- Git initial propre hors lien local `node_modules` non suivi. L'historique contient les commits des lots 0/1/2A puis refontes publiques, Find/Me, Pro et lot 5. `DESIGN-sikaloc.md` et `PAGES-sikaloc.md` ne sont pas présents dans ce dépôt ; les quatre rapports du lot 5, les 57 migrations, tests et `supabase/config.toml` sont présents.
- Clients disponibles : `psql` 18.6 ; CLI Supabase locale 2.114.0 via les dépendances, avec télémétrie désactivée. Seuls les binaires **clients** PostgreSQL sont installés : aucun `postgres`, `initdb` ni `pg_ctl`. Docker est présent mais son socket répond `permission denied`. Le groupe courant n'accorde pas d'accès Docker. La CLI 2.114.0 ne propose pas le mode natif expérimental ; le registre npm a répondu `EAI_AGAIN`. Aucun privilège ni permission système n'a été changé.
- La [documentation Supabase sur le développement local](https://supabase.com/docs/guides/local-development) indique qu'une pile complète via `supabase start` nécessite un runtime compatible Docker ; des versions récentes présentent un mode natif expérimental, absent de la CLI installée. La [documentation RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) confirme que `security_invoker` permet à une vue d'appliquer les droits des tables sous-jacentes, mais seule une exécution avec les rôles du projet peut vérifier ici son effet réel.
- Aucune configuration locale du nouveau worktree ne pointe vers une base distante. Aucune variable Supabase/Database ciblant une base de test n'a été chargée. Sikaloc-Test n'a pas été considéré jetable. Production et Sikaloc-Test n'ont reçu aucune requête ni mutation pendant cette campagne.

## Travail réalisé

- Nouveau lanceur `scripts/run-isolated-sql-test.mjs` : refuse tout hôte distant, le port 5432, tout nom de base autre que `postgres`, toute absence d'intention `ephemeral-local`, l'absence d'un UUID de pile marqué jetable dans la base et un historique différent des 57 migrations. Il ne lit pas `DATABASE_URL` de l'application et ne passe pas le mot de passe en argument de processus. Sans configuration, il a refusé de s'exécuter avec code 2 avant connexion.
- Le scénario `tests/receipt-historique-asof.integration.sql` exige désormais lui aussi le marqueur jetable avant toute fixture. Il est transactionnel et annule les fixtures ; il **n'a pas été exécuté** dans ce lot.
- `tests/isolation-guard.test.mjs` vérifie localement les refus des URLs Production/Test, des ports ou noms de base différents et de l'intention manquante. Procédure de reprise reproductible dans `tests/integration/README.md`.
- Inspection ciblée des deux migrations financières prioritaires : `20261020174549` reconstitue un reçu ancien à la date d'émission ; `20261020185126` ajoute `baux_loyers`, utilise le tarif applicable et recrée `v_echeances` avec `security_invoker = true`. La migration conserve explicitement l'incertitude historique et n'affecte pas automatiquement un trop-perçu au mois suivant. Il s'agit d'une **lecture du SQL**, pas d'une preuve d'exécution.

## Résultats par type

| Famille | Statut | Preuve et limite |
|---|---|---|
| Contrôle de cible locale | PASS local | Tests unitaires et refus du lanceur sans intention ; aucun réseau |
| 57 migrations | BLOQUÉ | 57 noms/versions ordonnés structurellement ; zéro SQL exécuté |
| Installation neuve / upgrade depuis 53 | BLOQUÉ | Pas de pile jetable ni de clone restauré |
| RLS, GRANT, vues, sessions A/B et locataires | BLOQUÉ | Aucune session Auth réelle créée dans ce lot |
| Paiements, soldes, snapshots, PDF, Storage | BLOQUÉ | Pas de base Auth/Storage locale |
| FedaPay, abonnement, parrainage, webhook | BLOQUÉ | Aucun bac fournisseur ni base jetable ; aucun appel réel |
| Find, Me et invitations | BLOQUÉ | Aucun compte fictif ni application connectée à une pile isolée |
| Export concurrent | NON EXÉCUTÉ | Nécessite des écritures parallèles sur fixtures jetables |
| Maintenance | PASS local | Contrat automatisé et quatre GET sur serveur local : HTTP 503, no-store, Retry-After 3600, noindex ; Production non interrogée |

Les scénarios et résultats attendus sont détaillés dans `MATRICE-TESTS-CRITIQUES.md`. Aucun résultat statique n'est présenté comme un PASS SQL/RLS. Aucune nouvelle vulnérabilité d'exécution n'a pu être confirmée ou infirmée ; il n'y a donc aucune migration corrective nouvelle. Les risques précédents de droits historiques de production et de compatibilité applicative restent ouverts.

## Contrôles techniques

`npm run typecheck`, `npm run lint`, `npm run verifier:migrations`, les scripts de tests maintenance/sécurité/verification/OTP/loyers/Pro/Lot2B/routes/retour-abonnement et `npm run test:isolation-guard` : **PASS locaux**. Le contrôle des migrations annonce explicitement qu'il n'exécute aucun SQL. `next build --webpack` : **PASS**, compilation en 21,2 s, avec les avertissements `face-api` préexistants ; URL Supabase factice locale et maintenance active pendant le build. `git diff --check` et état Git vérifiés avant commit.

Le serveur local de build a répondu **503** pour `/`, `/connexion`, `/pro/tableau-de-bord` et `/api/export`, avec `Cache-Control: no-store`, `Retry-After: 3600` et `X-Robots-Tag: noindex`. Il a été arrêté après ces requêtes GET. Ce contrôle ne porte pas sur le domaine de production ni sur les routes techniques exemptées.

## Passation au prompt 2/3

La recette visuelle ne dispose d'aucun jeu de données authentifié validé par cette campagne. Ne pas utiliser Sikaloc-Test comme pile jetable. Le chemin le plus court est un poste/runner doté d'un moteur de conteneurs autorisé, ou une CLI native récente officiellement disponible, puis une pile Supabase **nouvelle** avec les 57 migrations et un marqueur jetable confirmé. Exécuter ensuite les scénarios SQL, RLS et Auth de la matrice avec comptes fictifs, avant de classer des pages ou parcours comme validés. La maintenance doit rester active par défaut ; toute désactivation doit être limitée au processus local de recette.
