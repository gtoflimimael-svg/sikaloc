# Banc SQL jetable — procédure de reprise, non exécutée dans ce lot

Ce banc **ne doit jamais** viser Production (`pzrixjydnclwvjwqfbal`) ni Sikaloc-Test (`epjpcmvdvshxfsydltgf`), qui contient déjà des données. Il exige une nouvelle pile locale Supabase avec toutes les migrations du dépôt, distincte de tout autre projet. L'outil `scripts/run-isolated-sql-test.mjs` refuse les hôtes distants, tout port autre que 54322, tout autre nom de base, l'absence d'intention explicite, l'absence du marqueur jetable en base et un historique dont les versions ne correspondent pas exactement aux fichiers du dépôt. Cette comparaison ne vérifie pas le contenu des migrations déjà appliquées. Il ne lance aucun reset.

## Mise en place, seulement lorsque le moteur de conteneurs est légitimement accessible

1. Sur un poste/runner autorisé, créer un répertoire temporaire **nouveau** et y copier `supabase/config.toml` ainsi que toutes les migrations sans modifier l'original. Le projet local doit avoir un `project_id` unique et des ports non utilisés. Réviser les migrations de planification Cron : neutraliser uniquement leurs appels `cron.schedule` dans cette copie pour que rien ne s'exécute automatiquement. Ne pas lier ce répertoire à un projet hébergé.
2. Démarrer la pile avec la CLI locale après avoir vérifié `supabase start --help`, sans accès aux services de production. Confirmer que son URL PostgreSQL est exactement `127.0.0.1:54322/postgres`, que `supabase migration list --local` affiche toutes les versions du dépôt, et qu'Auth/Storage/Mailpit sont locaux. Si le port 54322 appartient déjà à une autre pile, arrêter : ne pas se connecter à celle-ci.
3. Après vérification manuelle de l'identité locale, créer dans **cette pile seulement** le marqueur suivant avec un UUID aléatoire nouveau :

   ```sql
   create schema sikaloc_test_guard;
   create table sikaloc_test_guard.instance (
     id uuid primary key,
     disposable boolean not null check (disposable is true)
   );
   insert into sikaloc_test_guard.instance(id, disposable)
   values ('<UUID-LOCAL-UNIQUE>', true);
   ```

4. Dans le terminal local sécurisé, définir `SIKALOC_INTEGRATION_TARGET=ephemeral-local`, `SIKALOC_INTEGRATION_INSTANCE_ID=<UUID-LOCAL-UNIQUE>` et `SIKALOC_INTEGRATION_DATABASE_URL` avec la connexion locale. Ne jamais placer le mot de passe dans une commande visible, un commit ou une conversation ; utiliser un mécanisme local de saisie/secret. Exécuter `node scripts/run-isolated-sql-test.mjs` depuis ce worktree. Le test de reçu historique utilise des fixtures `example.invalid` et annule ses écritures dans le bloc SQL ; il n'appelle aucun fournisseur.
5. Ajouter ensuite les scénarios réels Auth/RLS/Storage/finances dans la pile jetable, avec des comptes uniques et sans transport sortant. Comparer les résultats à `MATRICE-TESTS-CRITIQUES.md`. Détruire uniquement la pile créée pour cette campagne après conservation des preuves non sensibles ; ne jamais utiliser `db reset` sur une base distante ou préexistante.

La présence d'un marqueur ne prouve pas à elle seule que l'instance est jetable : l'étape 2 et la vérification humaine de la pile restent obligatoires. Le lanceur est une défense supplémentaire, pas une autorisation de migration.
