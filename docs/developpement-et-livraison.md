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

La workflow Quality gates exécute, dans cet ordre : contrôle structurel des noms
de migrations, tests du garde de maintenance, TypeScript, ESLint et build. Les
variables CI de Supabase sont des placeholders pointant vers localhost ; aucun
secret Supabase, fournisseur de paiement, email, WhatsApp ou Cron n'est fourni.
Le contrôle des migrations vérifie seulement les noms, l'unicité des versions et
les fichiers non vides : il ne parse pas le SQL et ne contacte aucune base.

Les scripts `banc:*`, `verifier:schema` et `verifier:parcours` ne font pas partie
de la CI par défaut : certains peuvent écrire dans la base configurée. Ne les
exécuter qu'après validation indépendante de l'URL et de la référence du projet
Supabase-Test, avec des fixtures jetables et les sessions/RLS réellement testées.
La CI n'annonce donc pas la validation des paiements, quittances ou purges.

## Cycle d'une livraison

1. Partir du dernier `main`; garder chaque lot petit, autonome et réversible.
2. Exécuter les contrôles automatiques et relire le diff du lot.
3. Tester les flux concernés sur Supabase-Test seulement, après confirmation de
   la référence, des buckets et des identifiants utilisés.
4. Vérifier l'aperçu sans secret de production et maintenir le garde actif.
5. Demander une revue avant fusion. Après fusion, vérifier le déploiement et les
   journaux. Ne pas appliquer de migration destructive sans plan de retour.
6. En cas d'échec, revenir au déploiement précédent; si la maintenance doit
   rester active, promouvoir uniquement le commit de maintenance vérifié.

La branche `main` doit exiger une revue et les contrôles Quality gates avant
fusion. Cette exigence dépend des règles GitHub du dépôt et n'est pas créée par
ce fichier workflow.
