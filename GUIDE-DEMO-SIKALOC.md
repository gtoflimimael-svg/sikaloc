# Guide de démonstration du véritable Sikaloc

## État actuel

La route simulée `/demo` a été retirée. La démonstration cible les vraies routes, l’authentification Supabase et les vraies tables de Sikaloc.

**La base de démonstration n’a pas encore été créée ni peuplée.** Aucun service Supabase distant dédié n’existe dans les projets visibles ; `Sikaloc-Test` contient des données à préserver et n’est pas utilisé. Le démarrage Supabase local est actuellement bloqué par un refus d’accès au socket Docker. Les comptes ci-dessous seront créés après autorisation de Docker et exécution de la préparation locale.

## Démarrer l’instance isolée

Depuis un terminal ouvert dans `MVP Sika` :

```bash
npm run demo:setup
npm run demo:dev
```

`demo:setup` crée un projet Supabase local dédié sous `~/.local/share/sikaloc-demo-local`, avec un identifiant aléatoire, des ports réservés et une configuration dont l’émetteur JWT est propre à cette démo. Il applique les migrations du dépôt puis prépare les fixtures. Au tout premier lancement uniquement, il initialise la base neuve de ce projet local précis ; les lancements suivants n’appliquent que les migrations en attente et ne réinitialisent pas la base.

`demo:dev` lance le vrai site à `http://localhost:3000`, en surchargeant les variables dans le processus uniquement. Il ne modifie pas `.env.local`. Le bandeau vert indique que les pages utilisent des données de démonstration. Le mode maintenance local est désactivé uniquement pour ce processus de développement ; aucune configuration de production n’est modifiée.

Les commandes n’emploient ni `supabase link`, ni `--linked`, ni URL distante. Les emails transactionnels de l’application sont déposés dans `.emails-locaux/`; les emails de confirmation Auth arrivent dans l’interface locale Mailpit (`http://127.0.0.1:54824`). Les clés FedaPay, Resend et SMS sont neutralisées dans le processus de démonstration. Aucun paiement, email ou SMS réel ne doit partir.

Autres commandes :

```bash
npm run demo:status   # statut local, sans afficher les clés
npm run demo:seed     # installe les fixtures une seule fois, si elles ne le sont pas déjà
npm run demo:stop     # arrête uniquement cette pile et conserve ses volumes
```

Le seed est volontairement non réinitialisant : `demo:setup` le lance lors de la première préparation. Une fois les fixtures marquées comme installées, `demo:seed` refuse de rejouer le jeu initial afin de préserver les changements effectués dans les vraies pages Sikaloc. Aucun mécanisme de remise à zéro des données n’est fourni.

Ne lancez pas `npm run db:reset` pour la démo : cette commande vise la configuration Supabase habituelle du dépôt, pas l’instance privée préparée ici.

### Si Docker refuse l’accès

Démarrez Docker Desktop/le moteur local et faites autoriser l’accès au socket Docker au compte utilisateur local par l’administrateur de la machine. N’utilisez pas `chmod 666 /var/run/docker.sock`, ne lancez pas une base distante en remplacement et ne basculez pas vers `Sikaloc-Test`.

## Connexion Sikaloc Pro

Après réussite de `demo:setup`, ouvrez le fichier privé indiqué par le terminal :

```text
~/.local/share/sikaloc-demo-local/secrets.json
```

Il contient les mots de passe aléatoires de démonstration. Le fichier est créé avec des droits privés (`0600`), reste hors du dépôt et ne doit pas être envoyé ou collé dans un message. Il contient aussi le secret local requis pour les invitations. Aucun mot de passe n’est imprimé dans le terminal.

Comptes Pro créés par la préparation :

| Profil | Email | Parcours |
|---|---|---|
| Petit portefeuille | `pro.petit@sikaloc-demo.test` | `/pro/tableau-de-bord`, deux logements |
| Bailleur principal | `pro.actif@sikaloc-demo.test` | Tableau de bord, cinq logements, locataires, baux, paiements |
| Portefeuille étendu | `pro.gestion@sikaloc-demo.test` | Tableau de bord et cinq logements |

Connectez-vous par la page normale `/connexion`. Les comptes sont créés dans Auth local et déjà confirmés par le serveur local ; les profils métiers sont créés par les déclencheurs existants.

## Parcours locataire Me par invitation réelle

Les fiches locataires sont créées dans les tables réelles avec des adresses `@sikaloc-demo.test`, mais aucun compte Me n’est pré-rattaché. Le lien compte–bail est une action sensible : il doit passer par l’invitation du bailleur et la RPC d’acceptation existante, pas par un rattachement injecté dans le seed.

1. Connectez-vous au compte `pro.actif`.
2. Ouvrez `/pro/locataires`, sélectionnez une fiche liée à ce bailleur (par exemple Ada Sossou) et lancez l’invitation depuis le parcours proposé.
3. L’invitation est déposée localement, sans envoi externe, dans `.emails-locaux/`. Ouvrez le dernier fichier JSON correspondant et utilisez son lien `localhost` uniquement dans le navigateur local.
4. Créez le compte avec l’adresse `@sikaloc-demo.test` affichée sur la fiche. Le code de confirmation Auth se consulte dans Mailpit local. Une confirmation renvoyée par le parcours de Sikaloc est également déposée dans `.emails-locaux/`.
5. Après vérification, l’invitation est acceptée par le mécanisme Sikaloc et le locataire accède à `/me`, `/me/bail`, `/me/loyers` et `/me/paiements`.

Pour un même profil fictif présent auprès de deux bailleurs, la seconde invitation se traite en étant connecté au compte Me déjà créé. Elle ne crée pas un second compte.

## Catalogue Sikaloc Find

Le seed prépare 12 logements, 9 baux, 45 périodes et 45 versements historiques. Les périodes couvrent les périodes renseignées par la fixture ; trois sont sans versement et deux restent partielles. Les dates des baux ont été alignées sur ces périodes pour ne pas inventer d’arriérés antérieurs.

Cinq logements sont disponibles dans la fixture et peuvent donc avoir une annonce active. Le schéma permet une annonce vivante par logement : il ne serait pas cohérent d’afficher 15 annonces actives pour ces 12 biens, dont plusieurs portent un bail actif. Les annonces ne sont publiées qu’après dépôt d’une image dans le bucket privé réel `annonces`.

Pour éviter de présenter une illustration comme une photographie d’un logement réel, les images du seed sont des illustrations originales générées localement, portant la mention **« ILLUSTRATION · DÉMO LOCALE · BIEN FICTIF »**. La description de chaque annonce précise aussi qu’il ne s’agit pas d’une offre réelle. Les annonces ne sont présentes que dans la base locale dédiée ; elles ne sont ni publiques sur Internet ni sur Production.

Ouvrez `/find`, appliquez les filtres, consultez une fiche puis utilisez le parcours réel de candidature. Deux comptes candidats Auth locaux et dix candidatures synthétiques avec statuts cohérents sont préparés lorsque les annonces correspondantes restent publiées. Une candidature acceptée ne crée pas automatiquement de bail.

## Documents

Le seed ne crée pas de quittances ou reçus factices. Les versements sont de vraies lignes locales synthétiques, mais les PDF doivent être émis par le parcours de génération existant dans Pro. Après connexion, ouvrez un paiement réglé et utilisez l’action réelle de confirmation/émission lorsqu’elle est proposée. Les paiements partiels restent des reçus selon les règles du produit ; aucun document n’est généré pour les périodes impayées.

## Volumes et limites du jeu de données

- 3 comptes bailleurs Auth et leurs profils Pro.
- 7 personnes locataires, matérialisées par les fiches nécessaires aux relations avec les bailleurs (une personne peut avoir une relation chez plusieurs bailleurs).
- 2 comptes candidats Auth.
- 12 logements et 9 baux (actifs et terminés).
- 45 périodes et 45 versements, dont des paiements partiels et des impayés.
- Jusqu’à 5 annonces Find publiées, selon la cohérence du bail et de l’illustration.
- Jusqu’à 10 candidatures synthétiques, sous la contrainte d’unicité candidat/annonce.
- Aucun PDF fictif préfabriqué ; les vrais documents sont à générer depuis l’application.

Les téléphones sont des valeurs non joignables de démonstration. Les noms, adresses, montants et statuts sont synthétiques. Le bandeau est visible sur toutes les pages uniquement dans le processus local démarré par `demo:dev`.

## Sécurité, persistance et état de validation

- `/demo` n’est plus l’interface de démonstration et ne contourne plus le proxy/authentification.
- Le setup refuse les clés qui ne sont pas un JWT `service_role` local `supabase-demo`, sans référence de projet, et l’URL du port local réservé.
- Les identifiants restent dans le dossier privé utilisateur ; `.env.local` n’est ni lu par le script de seed ni modifié par lui.
- Aucun reset ou peuplement de `SIka`, de `Sikaloc-Test` ou d’une autre base distante n’est prévu.
- Les entrées de seed utilisent les vrais déclencheurs, contraintes et relations. Le script et les migrations n’ont pas été exécutés, car Docker n’est pas accessible dans l’environnement Codex. Le nombre de lignes indiqué est le contenu préparé, pas une création déjà réalisée.
- Aucun test automatisé, build, push GitHub ou déploiement n’a été exécuté.
