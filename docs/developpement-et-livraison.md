# Base de développement et livraisons Sikaloc

## Base de référence

Le lot 0 part du commit de `main` qui contient la maintenance globale. Chaque
lot fonctionnel commence dans une branche dédiée créée depuis le dernier `main`.
La branche historique de rénovation et ses changements non validés sont une
source à examiner, pas une base à fusionner : aucune fusion globale ni copie en
bloc. Pour récupérer un élément utile, isoler son intention, vérifier qu'il
n'existe pas déjà sur `main`, puis le réintroduire et le tester dans un lot
distinct.

## Contrôles automatiques sans production

La workflow Quality gates (`.github/workflows/quality.yml`) exécute trois jobs
à chaque PR et à chaque push sur `main`. Aucun secret de production, de
paiement, d'email ou de Cron n'y est fourni.

| Job | Contenu |
|---|---|
| `validate` | `verifier:migrations` (noms, ordre, empreintes des migrations livrées), `npm test`, TypeScript, ESLint, build |
| `base-reelle` | Postgres Supabase jetable ; application de **toutes** les migrations sur base vierge ; scénarios `tests/*.integration.sql` (isolation entre bailleurs, reçu historique) |
| `bout-en-bout` | Pile Supabase jetable (`sikaloc-e2e`) ; build de production ; parcours `tests/e2e/*.e2e.mjs` dans Chrome, FedaPay simulé ; pile détruite dans tous les cas |

Les scripts `banc:*`, `verifier:schema` et `verifier:parcours` ne font pas partie
de la CI : certains peuvent écrire dans la base configurée. Ne les exécuter
qu'après validation indépendante de l'URL et de la référence du projet
Sikaloc-Test, avec des fixtures jetables. La CI valide le code sur des piles
jetables ; elle ne remplace ni la recette sur Sikaloc-Test ni un essai réel
avec le fournisseur de paiement.

## Cycle d'une livraison

1. Partir du dernier `main`; garder chaque lot petit, autonome et réversible.
2. Exécuter les contrôles automatiques et relire le diff du lot.
3. Tester les flux concernés sur Sikaloc-Test seulement, après confirmation de
   la référence, des buckets et des identifiants utilisés.
4. Vérifier l'aperçu sans secret de production et maintenir le garde actif.
5. Demander une revue avant fusion. Appliquer les nouvelles migrations **avant**
   la fusion (voir `docs/deploiement.md`, §6), puis vérifier le déploiement, les
   journaux et Sentry. Ne pas appliquer de migration destructive sans plan de
   retour.
6. Après livraison : `npm run verrouiller:migrations` et mise à jour de
   `ETAT-SIKALOC.md`, source d'état unique.
7. En cas d'échec, revenir au déploiement précédent; si la maintenance doit
   rester active, promouvoir uniquement le commit de maintenance vérifié.

La branche `main` doit exiger une revue et les contrôles Quality gates avant
fusion. Cette exigence dépend des règles GitHub du dépôt et n'est pas créée par
ce fichier workflow.
