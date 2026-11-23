# Sikaloc — MVP

> Anciennement « Sika ». Le produit, le domaine (`sikaloc.com`) et
> l'expéditeur des emails portent désormais ce nom.

SaaS de gestion locative pour bailleurs individuels au Bénin.

> **Promesse produit** : générer et envoyer une quittance PDF conforme en moins
> de 3 clics, plus vite qu'avec Excel ou le papier.

Construit à partir de `Fichiers de référence/Sika_MVP_Specification_Finale.md`
(fonctionnel) et `Fichiers de référence/DESIGN-Sika.md` (système de design).

Deux espaces : **Pro** (`/pro/*`, le bailleur) et **Me** (`/me/*`, le
locataire invité par son bailleur). Le module Find (annonces et candidatures)
a été retiré du code actif le 9 novembre 2026 ; ses données restent en base.

> **État du projet** (environnements, migrations, réserves ouvertes) :
> [`ETAT-SIKALOC.md`](ETAT-SIKALOC.md), source unique mise à jour à chaque
> fusion. Recette page par page : [`MATRICE-PAGES.md`](MATRICE-PAGES.md).

---

## Développement local

`npm run dev` démarre la pile Supabase locale isolée de Sikaloc et l'application
sur `http://localhost:3000`. Cette commande n'utilise pas les identifiants de
`.env.local` et ne peut donc pas viser un projet hébergé par inadvertance.
Les données de cette pile sont conservées entre les démarrages.

---

## Démarrage

### 1. Installer les dépendances

```bash
npm install
```

### 2. Démarrer l'application

Requiert Docker accessible sans `sudo`. La commande démarre et vérifie la pile
locale dédiée, applique uniquement les migrations locales manquantes, puis
lance Next.js. Ne recopiez pas de clés de Production dans `.env.local` pour
démarrer le développement.

```bash
npm run dev     # http://localhost:3000
```

Pour les environnements hébergés, utiliser le projet Sikaloc-Test et son
déploiement dédié; ne connectez pas le serveur de développement local à
Production.

---

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Pile Supabase locale isolée + serveur de développement |
| `npm run build` | Build de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Tous les tests unitaires et statiques (`tests/*.test.mjs`) — ce que lance la CI |
| `npm run test:e2e` | Parcours de bout en bout sur une pile Supabase jetable et un FedaPay simulé (voir ci-dessous) |
| `npm run verifier:migrations` | Contrôle des migrations : noms, ordre, et empreinte des migrations déjà livrées |
| `npm run verrouiller:migrations` | À lancer **après** l'application des migrations en production : met à jour `supabase/migrations.lock.json` |
| `npm run verifier:quittance` | Vérifie les montants en toutes lettres et produit `apercu-quittance.pdf` / `apercu-recu.pdf` — **sans base de données** |
| `npm run verifier:parcours` | Parcours bailleur dans un vrai navigateur. Nécessite `npm run dev` en parallèle. |
| `npm run db:reset` | Réapplique migrations + seed sur la pile locale |

Le déploiement en production est décrit dans **[docs/deploiement.md](docs/deploiement.md)** :
variables Vercel, DNS Spaceship, redirections Supabase, webhook FedaPay, Sentry.
Le cycle d'une livraison et la CI sont décrits dans
**[docs/developpement-et-livraison.md](docs/developpement-et-livraison.md)**.

### Tests de bout en bout

```bash
node scripts/e2e/pile.mjs demarrer /tmp/pile-e2e
npm run test:e2e -- --workdir /tmp/pile-e2e
node scripts/e2e/pile.mjs arreter /tmp/pile-e2e
```

La pile E2E est un projet Supabase distinct (`sikaloc-e2e`, ports 553xx), sans
envoi d'email ni seed, détruite à l'arrêt. Le lanceur neutralise toutes les
variables de `.env.example` — `.env.local` peut contenir de vraies clés — et
pointe FedaPay vers un faux service local. Les données de test refusent toute
cible qui n'est pas une pile locale jetable (jamais la démo ni un projet
hébergé).

`verifier:parcours` réutilise un Chromium déjà installé sur la machine (cache
Playwright ou Chrome système) ; en désigner un autre avec `SIKA_CHROMIUM`.
Passer un dossier en argument pour y écrire les captures :
`npm run verifier:parcours -- /tmp/captures`.

---

## Structure

```
src/
  app/
    page.tsx                  Accueil public (valeur, étapes, tarifs, FAQ)
    pro/page.tsx              Présentation de l'offre Pro
    connexion|inscription|…   Écrans d'authentification ; entrer/ aiguille par rôle
    legal/ blog/ guide/ questions/   Pages publiques
    pro/
      onboarding/             Assistant de démarrage, plein écran
      (shell)/                Espace bailleur : barre latérale + contenu
        tableau-de-bord/      Métriques, impayés, derniers paiements
        impayes/              Retards + relance WhatsApp
        paiements/            Saisie → confirmation (→ signature) → quittance
        baux/ locataires/ logements/    Gestion du parc
        quittances/[id]/      Aperçu, téléchargement, envoi au locataire
        parametres/           Profil, signature, préférences, parrainage, abonnement, données
    me/                       Espace locataire : bail, loyers, paiements, préférences, invitation
    api/
      quittances/[id]/pdf     Téléchargement (fichier du coffre)
      abonnement/fedapay      Webhook de paiement FedaPay
      export/                 Export des données du bailleur
      cron/cycle-grace|notifications|purge|schema   Tâches planifiées (vercel.json)
  lib/
    actions/                  Server Actions (toutes les écritures)
    pdf/                      Template de quittance (@react-pdf/renderer)
    quittance.ts              Rendu, dépôt, empreinte, URL signée
    csp.ts                    Politique CSP à nonce, posée par le proxy
    rate-limit.ts             Limitation des connexions (fonctions SQL)
    journal.ts, cron-suivi.ts Journal des échecs et suivi Sentry des crons
    fedapay.ts, reglement-abonnement.ts   Paiement Mobile Money
    emails.ts                 Gabarits et envoi Resend
    validation.ts             Schémas Zod
  instrumentation*.ts, sentry.*.config.ts   Sentry, inerte sans DSN
  proxy.ts                    Session, garde de routes, CSP, maintenance
supabase/migrations/          Schéma, RLS, vues métier, storage
supabase/migrations.lock.json Empreintes des migrations livrées en production
tests/                        Tests unitaires (*.test.mjs), SQL (*.integration.sql), E2E (e2e/)
scripts/e2e/                  Pile jetable, données fictives, faux FedaPay, lanceur
```

---

## Décisions techniques

**Authentification.** La spécification demande bcrypt + JWT en cookie httpOnly
(§6.1.1, §9.2). C'est exactement ce que fournit Supabase Auth via
`@supabase/ssr` ; le hash reste dans `auth.users` et n'est pas dupliqué dans une
table applicative exposée au Data API. L'access token expire en 1 h avec
rotation silencieuse du refresh token, plutôt qu'un JWT de 7 jours qui serait
irrévocable pendant toute sa durée de vie.

**Isolation des données.** RLS sur toutes les tables, chaque policy combinant
`TO authenticated` et un prédicat de propriété — `TO authenticated` seul
autoriserait n'importe quel compte à lire n'importe quelle ligne. Les vues
portent `security_invoker = true`, sans quoi elles court-circuiteraient les
policies. Les fonctions `SECURITY DEFINER` vivent dans le schéma `prive`, non
exposé : dans `public`, Postgres les rendrait appelables par `anon`.

**Détection des impayés.** Implémentée en SQL (`v_impayes`), une ligne par
couple (bail, mois). L'algorithme du §6.1.8 n'évalue que le mois courant ; il est
étendu à tous les mois écoulés depuis le début du bail, car l'écran demande un
tri « par ancienneté ». La comparaison porte sur la *somme* des versements de la
période : deux acomptes qui totalisent le loyer soldent le mois.

**Fenêtre de correction.** Les 5 minutes du §6.1.7 sont appliquées par un
trigger (`proteger_paiement_fige`), pas seulement par l'interface — aucun chemin
d'écriture ne peut les contourner. C'est ce qui rend opposable une quittance déjà
transmise au locataire.

**Génération des documents.** Numérotation séquentielle par bailleur et par
année, au format `AAAA-NNNN` (v2.1 §2.3). L'objection habituelle — une séquence
se corrompt à la première écriture concurrente — ne tient que si le compteur est
tenu par l'application : ici, le trigger `attribuer_numero_document` fait un
`insert … on conflict do update … returning` sur la table des compteurs, où
Postgres pose un verrou de ligne. L'attribution est donc atomique, et
l'application n'a aucun moyen de forcer un numéro.

Même logique pour l'horodatage : `date_generation` porte `default now()`, la
date vient de l'horloge de la base et jamais du poste du bailleur.

Chaque PDF déposé est haché en SHA-256 et son empreinte enregistrée. Le
téléchargement sert le fichier du coffre — pas une régénération — pour que le
document remis corresponde exactement à l'empreinte opposable.

Le PDF est rendu avec Helvetica plutôt qu'avec la police de l'interface (Outfit) : charger une police distante à
chaque rendu ajouterait un aller-retour réseau au milieu d'une fonction
serverless.

**Paiement de l'abonnement (FedaPay).** Deux contrôles indépendants sur la
notification : la signature `X-FEDAPAY-SIGNATURE`, obligatoire (sans
`FEDAPAY_WEBHOOK_SECRET`, le webhook répond 503 et ne crédite rien), puis — et
c'est le rempart réel — un appel à `GET /transactions/{id}` avec notre clé
secrète. Le corps d'une requête entrante reste une donnée reçue de
l'extérieur ; le crédit d'un abonnement ne doit jamais dépendre de ce qu'elle
affirme. L'environnement est déduit du préfixe de la clé : une clé
`sk_sandbox_…` ne peut pas frapper l'API de production.

**Sécurité web.** Le proxy pose une CSP à nonce par requête
(`src/lib/csp.ts`, `'strict-dynamic'`) : aucun script en ligne sans nonce n'est
exécuté. Les connexions sont limitées en SQL (`reserver_tentative_connexion`,
verrou consultatif) : 5 échecs par couple email + IP, 20 par email, 30 par IP,
sur 15 minutes. Les messages d'erreur renvoyés à l'utilisateur passent par
`messageErreurUtilisateur` : jamais de message interne.

**Supervision.** Sentry (`@sentry/nextjs`) capte les erreurs serveur et
navigateur et suit les crons, sans données personnelles, sans replay ni traces ;
emails, téléphones et paramètres d'URL sont masqués. Sans DSN, rien n'est
envoyé. Les échecs métier (paiement, quittance, notification) sont journalisés
par `journaliserEchec`.

**Migrations.** Une migration livrée en production n'est jamais modifiée :
`supabase/migrations.lock.json` en garde l'empreinte et
`npm run verifier:migrations` échoue en cas d'écart. Toute correction passe par
une nouvelle migration. La CI applique toutes les migrations sur un Postgres
vierge et y rejoue les scénarios `tests/*.integration.sql`.

**Onboarding.** Les trois entités (locataire, logement, bail) sont créées par une
seule fonction SQL transactionnelle : trois `INSERT` séparés laisseraient un
locataire orphelin si le dernier échouait.

---

## Cycle de grâce (impayé d'abonnement)

| Palier | Statut | Ce que le bailleur peut faire |
|---|---|---|
| J+0 | `grace` | Tout — c'est un avertissement, pas une sanction |
| J+3 | `lecture_seule` | Consulter et télécharger ; plus d'écriture |
| J+30 | `suspendu` | Export uniquement |
| J+90 | `supprime` | Locataires anonymisés, fichiers effacés |

Les transitions sont calculées en SQL par `prive.appliquer_cycle_grace()`,
planifiée par pg_cron à 03:00 UTC. La fonction est idempotente : elle n'agit que
lorsqu'un palier est franchi, et peut tourner plusieurs fois par jour sans
produire de doublon.

Trois choix méritent d'être explicités :

**`grace` n'enlève rien.** Couper l'accès dès le premier échec de prélèvement
pénaliserait un bailleur dont le solde Mobile Money était simplement insuffisant
ce jour-là. Les trois jours de battement sont le sens même du dispositif.

**Les emails passent par une file.** Postgres ne peut pas appeler Resend, et
surtout : faire dépendre l'intégrité des statuts de la disponibilité d'un
service tiers serait fragile. La base décide et dépose dans
`emails_a_envoyer` ; `/api/cron/notifications` notifie, avec reprise sur échec
(3 tentatives) et clé d'idempotence.

**La purge est en deux temps.** Supabase interdit la suppression directe dans
`storage.objects`. La fonction SQL anonymise, détache les documents et relève
les chemins ; `/api/cron/purge` efface les fichiers via l'API Storage. Les baux
et paiements sont **conservés** : ce sont des pièces comptables. Seules les
données personnelles disparaissent.

Le refus d'écriture est appliqué par `bailleurAvecEcriture()`, appelée en tête
de chaque Server Action de création. Masquer un bouton n'empêche personne de
rejouer une requête.

Les deux routes `/api/cron/*` exigent `CRON_SECRET` (`Authorization: Bearer` ou
`x-cron-secret`). Sans ce secret configuré, elles refusent tout : mieux vaut une
tâche qui ne tourne pas qu'un endpoint de purge ouvert.

---

## Pièges à connaître

**1. `max-w-xl` et consorts sont interdits.** Les tokens d'espacement de Sikaloc
(`--spacing-xl`…) partagent leurs suffixes avec l'échelle de largeurs de
Tailwind, et l'espacement l'emporte : `max-w-xl` vaut **24 px**, pas 36 rem — un
paragraphe s'y réduit à un mot par ligne. Redéclarer `--container-xl` ne corrige
rien. Écrire `max-w-[36rem]`.

**2. Pas d'espace fine insécable (U+202F) dans les montants.** Elle est absente
de l'encodage WinAnsi des polices standard du PDF et s'afficherait comme un
glyphe parasite au milieu de chaque montant. `formaterFCFA` utilise U+00A0.

**3. Une insertion manuelle dans `auth.users` doit initialiser les colonnes de
jetons à `''`.** GoTrue les lit dans des `string` Go non-nullables : laissées à
`NULL`, la connexion échoue avec un `500 Database error querying schema` qui
n'indique pas la cause. Concerne `confirmation_token`, `recovery_token`,
`email_change`, `email_change_token_new`, `email_change_token_current`,
`phone_change`, `phone_change_token`, `reauthentication_token`. Le seed les
renseigne déjà.

**4. `render` sur un `<Text>` de `@react-pdf/renderer` fait disparaître le bloc
entier**, même accompagné de `fixed`. Le pied de page de la quittance est donc
statique. À reconsidérer si une pagination devient nécessaire.

---

## État de livraison

L'état courant — environnements, migrations à livrer, preuves et réserves
ouvertes — est tenu dans **[`ETAT-SIKALOC.md`](ETAT-SIKALOC.md)**, et non ici,
pour qu'il n'existe qu'une seule version datée. Les rapports d'octobre 2026
sont archivés dans [`docs/archives/2026-10/`](docs/archives/2026-10/README.md).

Fonctionnalités livrées :

- [x] Authentification (inscription, connexion, réinitialisation, limitation des tentatives)
- [x] Onboarding guidé
- [x] Tableau de bord — métriques, impayés, derniers paiements
- [x] Gestion des logements, locataires, baux (un seul bail actif par logement)
- [x] Enregistrement d'un paiement : saisie → récapitulatif → signature si absente → document
- [x] Fenêtre de correction de 5 minutes, puis paiement figé
- [x] Détection automatique des impayés avec tolérance paramétrable
- [x] Quittance / Reçu PDF, signature incrustée, montant en lettres, numérotation `AAAA-NNNN`, empreinte SHA-256
- [x] Stockage privé + lien de téléchargement signé
- [x] Espace locataire Me (bail, loyers, paiements, quittances) sur invitation
- [x] Relance et envoi WhatsApp par liens `wa.me` (envoi manuel, aucune API)
- [x] Plans Gratuit / Standard, abonnement Mobile Money FedaPay, cycle de grâce
- [x] Parrainage, paramètres, export des données
- [x] RLS stricte sur toutes les tables

Emails : le domaine `sikaloc.com` est vérifié chez Resend (SPF + DKIM),
expéditeur `no-reply@sikaloc.com`.
