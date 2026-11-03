# Préflight de recette Sikaloc-Test

Le préflight est consultatif et ne démarre pas l'application :

```sh
npm run verifier:sikaloc-test
```

Le serveur connecté ne doit être lancé qu'après validation du préflight, avec Node.js 22 et des clés dédiées au projet `epjpcmvdvshxfsydltgf` :

```sh
npm run dev:sikaloc-test
```

Le lanceur lit `~/.config/sikaloc-test/app.env` et, s'il existe, `~/.config/sikaloc-test/admin.env`. Les deux fichiers doivent être ordinaires, appartenir à l'utilisateur courant, être en mode `0600` au plus, et leur dossier direct en mode `0700` au plus; `.config` doit également rester privé. Les liens symboliques, variables inconnues, doublons et valeurs contradictoires sont refusés. Les fichiers ne sont jamais chargés comme des scripts shell et leurs valeurs ne sont pas affichées.

Noms acceptés pour les informations API actuellement utilisées : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Le lanceur les associe aux variables internes réservées à Test, vérifie que l'URL cible exactement `epjpcmvdvshxfsydltgf`, puis transmet la clé publishable sous le nom client attendu par l'application. Une ancienne clé publique `NEXT_PUBLIC_SUPABASE_ANON_KEY` reste acceptée. Une clé `sb_publishable_…` est opaque : sans connexion réseau, le préflight vérifie son format, mais ne peut pas prouver qu'elle appartient à la référence Test indiquée.

Dans le fichier privé `admin.env`, la clé serveur peut être nommée `SIKALOC_TEST_SERVICE_ROLE_KEY` (compatibilité avec le nom historique) ou `SIKALOC_TEST_SUPABASE_SECRET_KEY`. Les deux formats de valeur sont acceptés : l'ancien JWT `service_role`, dont le projet et le rôle sont vérifiés localement, et la nouvelle clé `sb_secret_…`, opaque hors ligne. `npm run verifier:connexion-sikaloc-test` effectue des requêtes `GET /rest/v1/` vers l'URL fixe de Test avec la clé serveur et la clé publique, sans lire de table ni écrire de donnée; il n'affiche pas les réponses. Ce contrôle réseau ne remplace pas les preuves de sauvegarde ni le test des emails Auth. Le nom générique `SUPABASE_SERVICE_ROLE_KEY` est refusé dans les fichiers privés.

Le secret reste exclusivement serveur : il n'est jamais affecté à une variable `NEXT_PUBLIC_*`. Le client Admin adapte les requêtes `sb_secret_…` pour les envoyer dans `apikey` uniquement; les Bearer d'une session utilisateur et l'ancien JWT `service_role` restent inchangés. Les secrets FedaPay éventuels doivent être les trois valeurs dédiées `SIKALOC_TEST_FEDAPAY_PUBLIC_KEY`, `SIKALOC_TEST_FEDAPAY_SECRET_KEY` et `SIKALOC_TEST_FEDAPAY_WEBHOOK_SECRET`, avec une clé sandbox.

Le fichier API seul ne permet pas de démarrer la recette : la clé serveur Test et le manifeste de sauvegardes/restaurations vérifiées restent obligatoires. Le préflight est local et consultatif; il ne contacte aucune base. La vérification `verifier:connexion-sikaloc-test` est un contrôle de connectivité distinct et ne lève aucune condition de lancement.

Le lanceur exige `SIKALOC_TEST_BACKUP_MANIFEST`, chemin absolu vers un manifeste JSON situé hors du dépôt. Les anciens indicateurs `*_VERIFIED=1` ne sont pas acceptés comme preuves.

## Format des preuves

Le manifeste doit déclarer `format: "sikaloc-test-evidence/v1"`, la référence exacte du projet et une date de création récente. Il référence des fichiers privés par chemin et empreinte SHA-256 :

- `postgres.archive` et `postgres.restoreReport` ; l'archive doit être une enveloppe OpenPGP ASCII-armor (`encryption: "openpgp-armored"`) et le rapport doit attester sa restauration isolée et le contrôle des schémas, tables, contraintes, fonctions, triggers, RLS, volumes agrégés et comptes/identités Auth.
- `storage.archive`, `storage.inventory` et `storage.restoreReport` ; l'archive doit également être OpenPGP ASCII-armor. L'inventaire décrit chaque objet par bucket, clé, taille et empreinte. Le rapport doit confirmer la restauration isolée et la vérification de toutes les empreintes.
- `authEmail.report` ; il doit attester que la confirmation email reste obligatoire, que SMTP et les redirections sont vérifiés et qu'un test a abouti vers une boîte contrôlée, sans contacter les utilisateurs préexistants.

Les JSON référencés doivent contenir la version de format correspondante (`sikaloc-test-postgres-restore/v1`, `sikaloc-test-storage-inventory/v1`, `sikaloc-test-storage-restore/v1`, `sikaloc-test-auth-email/v1`), `projectRef`, le statut `passed` et les empreintes liées aux archives. Les chemins sont résolus par rapport au manifeste lorsqu'ils ne sont pas absolus. Les fichiers et leur dossier immédiat doivent être privés (permissions `0600` et `0700` sous Unix), non vides, non symboliques et hors du dépôt.

Le vérificateur contrôle l'existence, les permissions, l'en-tête OpenPGP, la structure déclarée et les empreintes réelles des artefacts. Le rapport de restauration doit confirmer qu'ils ont été déchiffrés et restaurés avec succès. Il ne fabrique pas une sauvegarde et ne peut pas authentifier à lui seul l'auteur des rapports : ceux-ci doivent provenir des contrôles et restaurations réellement exécutés.

## Limites opérationnelles connues

La sauvegarde PostgreSQL du plan Free n'est pas fournie quotidiennement par Supabase. Le dump de la CLI Supabase exclut les schémas gérés `auth` et `storage`; il ne suffit donc pas, seul, à prouver une restauration complète des comptes et objets. Les preuves pour la base, Auth et Storage doivent être établies séparément avec un accès officiel adapté. Aucun manifeste ou artefact de sauvegarde n'est créé par ce dépôt.

Le préflight peut être exécuté même lorsque les sauvegardes manquent : il indique les blocages sans démarrer Next.js ni appeler de service distant.

## Scénarios à exécuter après déblocage

Préparer des identités neuves, toutes contrôlées et réservées à Sikaloc-Test : bailleur A, bailleur B, locataire A, locataire B, candidat Find et visiteur anonyme. Ne pas réutiliser les neuf comptes préexistants pour prouver l'isolation.

| Parcours | Contrôles minimaux |
|---|---|
| Auth | Inscription Pro, confirmation dans une boîte contrôlée, profil, connexion, actualisation, renouvellement, déconnexion/reconnexion, identifiants invalides et profil manquant. |
| Pro | Logement, locataire, invitation, bail, tarif/échéances, paiement partiel puis complet, reçu/quittance, annulation/correction autorisée, impayé et quota. |
| Me | Invitation acceptée, bail et documents propres au locataire A/B; tenter les URL et identifiants croisés et confirmer le refus. |
| Find | Catalogue public anonyme, recherche, fiche publiée, refus des brouillons, candidature authentifiée et suivi privé. |
| RLS/Storage | Pour anonyme, Pro A/B et Me A/B, vérifier SELECT/INSERT/UPDATE/DELETE, RPC, reçus, signatures et objets Storage avec les sessions réelles, jamais avec `service_role` comme preuve RLS. |
| Intégrations | FedaPay sandbox seulement; emails de test contrôlés; PDF vérifiés sur les montants/dates et droits; Cron limité aux fixtures et tâches sans envoi ni suppression réelle. |

Avant toute mutation, noter les agrégats préexistants; après recette, identifier uniquement les ressources créées par cette campagne. Les neuf comptes et leurs relations préexistantes sont hors périmètre de nettoyage.
