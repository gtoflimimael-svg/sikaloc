# Sikaloc — MVP

> Anciennement « Sika ». Le produit, le domaine (`sikaloc.com`) et
> l'expéditeur des emails portent désormais ce nom.

SaaS de gestion locative pour bailleurs individuels au Bénin.

> **Promesse produit** : générer et envoyer une quittance PDF conforme en moins
> de 3 clics, plus vite qu'avec Excel ou le papier.

Construit à partir de `Fichiers de référence/Sika_MVP_Specification_Finale.md`
(fonctionnel) et `Fichiers de référence/DESIGN-Sika.md` (système de design).

---

## État actuel

L'application **tourne** sur le projet Supabase dédié `SIka`
(`pzrixjydnclwvjwqfbal`, eu-central-1 / Francfort). Les 8 migrations, les RLS,
les vues, les buckets, pg_cron et le jeu de démonstration y sont appliqués ;
`.env.local` est renseigné, FedaPay (sandbox) et Resend compris.

```bash
npm run dev        # http://localhost:3000
```

Connexion : **demo@sikaloc.com** / **demo1234**

Pour repartir d'une base locale plutôt qu'hébergée, suivre « Démarrage » ci-dessous.

---

## Démarrage

### 1. Installer les dépendances

```bash
npm install
```

### 2. Lancer la base de données

Deux options. **A** ne demande aucun compte et fait tourner tout Supabase en
local ; **B** utilise un projet hébergé.

#### Option A — Supabase local (recommandé pour développer)

Requiert Docker **accessible sans sudo** :

```bash
# une seule fois, puis se déconnecter/reconnecter de la session
sudo usermod -aG docker $USER

npx supabase start      # démarre Postgres, Auth, Storage, Studio
```

La commande affiche `API URL`, `anon key` et `service_role key` — à recopier
dans `.env.local`. Les migrations et le jeu de démonstration sont appliqués
automatiquement.

#### Option B — Supabase Cloud

1. Créer un projet sur [supabase.com](https://supabase.com) (région Europe /
   Francfort, comme prévu au §9.1 de la spécification).
2. Récupérer l'URL et les clés dans *Project Settings → API*.
3. Pousser le schéma :

```bash
npx supabase link --project-ref <ref-du-projet>
npx supabase db push
```

### 3. Configurer l'environnement

```bash
cp .env.example .env.local
```

Puis renseigner au minimum :

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de l'API Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique, utilisée par le navigateur |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur — génération des quittances, webhook de paiement, comptage des tentatives de connexion. **Jamais exposée au client.** |

`FEDAPAY_*` et `RESEND_API_KEY` sont optionnelles : sans elles, l'application
fonctionne, seules la souscription au plan Standard et les rappels du cycle de
grâce sont indisponibles. `CRON_SECRET` est en revanche nécessaire dès que les
tâches planifiées tournent — sans lui, les routes `/api/cron/*` refusent toute
requête.

### 4. Démarrer

```bash
npm run dev     # http://localhost:3000
```

Compte de démonstration (créé par `supabase/seed.sql`, développement local
uniquement) : **demo@sikaloc.com** / **demo1234**. Il contient trois baux couvrant
les trois cas que le tableau de bord doit savoir montrer — un loyer soldé, un
versement partiel, et deux mois de retard.

---

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run verifier:quittance` | Vérifie les montants en toutes lettres et produit `apercu-quittance.pdf` / `apercu-recu.pdf` — **sans base de données** |
| `npm run verifier:parcours` | Parcours bailleur de bout en bout dans un vrai navigateur : connexion → tableau de bord → impayés → saisie → confirmation → quittance → PDF. Nécessite `npm run dev` en parallèle. |
| `npm run db:reset` | Réapplique migrations + seed |

Le déploiement en production est décrit dans **[docs/deploiement.md](docs/deploiement.md)** :
variables Vercel, DNS Spaceship, redirections Supabase, webhook FedaPay.

`verifier:parcours` réutilise un Chromium déjà installé sur la machine (cache
Playwright ou Chrome système) ; en désigner un autre avec `SIKA_CHROMIUM`.
Passer un dossier en argument pour y écrire les captures :
`npm run verifier:parcours -- /tmp/captures`.

---

## Structure

```
src/
  app/
    page.tsx                  Landing (valeur, étapes, tarifs, FAQ)
    connexion|inscription|…   Écrans d'authentification
    legal/                    Confidentialité, conditions d'utilisation
    app/
      layout.tsx              Garde d'authentification
      onboarding/             Assistant 3 étapes, plein écran
      (shell)/                Application : barre latérale + contenu
        page.tsx              Tableau de bord (4 métriques, impayés, derniers paiements)
        impayes/              Retards + relance WhatsApp
        paiements/            Saisie → confirmation → quittance ; historique
        baux/ locataires/ logements/    CRUD
        quittances/[id]/      Aperçu, téléchargement, envoi au locataire
        parametres/           Profil, signature, préférences, parrainage, abonnement
    api/
      quittances/[id]/pdf     Téléchargement (fichier du coffre)
      abonnement/fedapay      Webhook de paiement FedaPay
      cron/cycle-grace        Fait progresser les comptes en impayé
      cron/notifications      Vide la file d'emails via Resend
      cron/purge              Purge J+90 et efface les fichiers
  lib/
    actions/                  Server Actions (toutes les écritures)
    pdf/                      Template de quittance (@react-pdf/renderer)
    quittance.ts              Rendu, dépôt, empreinte, URL signée
    montant-en-lettres.ts     Mention légale « montant en lettres »
    acces.ts                  Droits dérivés du cycle de grâce
    fedapay.ts                Paiement Mobile Money
    emails.ts                 Gabarits et envoi Resend
    validation.ts             Schémas Zod
  proxy.ts                    Rafraîchissement de session + garde de routes
supabase/migrations/          Schéma, RLS, vues métier, storage
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

Le PDF est rendu avec Helvetica plutôt qu'Inter : charger une police distante à
chaque rendu ajouterait un aller-retour réseau au milieu d'une fonction
serverless.

**Paiement de l'abonnement (FedaPay).** Deux contrôles indépendants sur la
notification : la signature `X-FEDAPAY-SIGNATURE` si le secret est configuré,
puis — et c'est le rempart réel — un appel à `GET /transactions/{id}` avec notre
clé secrète. Le corps d'une requête entrante reste une donnée reçue de
l'extérieur ; le crédit d'un abonnement ne doit jamais dépendre de ce qu'elle
affirme. L'environnement est déduit du préfixe de la clé : une clé
`sk_sandbox_…` ne peut pas frapper l'API de production.

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

Conforme à la spécification :

- [x] Authentification (inscription, connexion, réinitialisation, limitation à 5 tentatives / 15 min)
- [x] Onboarding guidé en 3 étapes
- [x] Tableau de bord — 4 métriques temps réel, impayés, derniers paiements
- [x] CRUD logements, locataires, baux (un seul bail actif par logement)
- [x] Enregistrement d'un paiement : saisie → récapitulatif → validation → document
- [x] Fenêtre de correction de 5 minutes, puis paiement figé
- [x] Détection automatique des impayés avec tolérance paramétrable
- [x] Quittance / Reçu PDF conforme Bénin, signature incrustée, montant en lettres
- [x] Stockage privé + lien de téléchargement signé 30 jours
- [x] Relance et envoi WhatsApp par liens `wa.me` (envoi manuel, aucune API)
- [x] Plans Gratuit / Standard et leurs limites
- [x] Parrainage (code, lien, récompense d'un mois de part et d'autre)
- [x] Paramètres : profil, signature, préférences, parrainage, facturation
- [x] Politique de confidentialité et conditions d'utilisation
- [x] RLS stricte sur toutes les tables

### Vérifié sur la base réelle

- Connexion, tableau de bord, impayés, saisie, confirmation, émission du
  document et téléchargement du PDF — parcours complet (`verifier:parcours`)
- Quittance conforme émise, numérotée, horodatée, signature du bailleur
  incrustée
- Coffre étanche : accès direct au PDF refusé (HTTP 400), lien signé 30 jours
  opérationnel
- **Isolation entre bailleurs** : un second compte créé pour l'occasion ne
  voyait aucun locataire, logement, bail, paiement, quittance ni impayé de
  l'autre bailleur ; l'écriture à son nom était rejetée par la RLS, la
  réaffectation de son profil sans effet, et son PDF inaccessible
- Détection des impayés, y compris le cas partiel (70 000 payés sur 120 000 →
  solde de 50 000 correctement isolé)
- Conversion des montants en toutes lettres : 31 cas, dont les pièges d'accord

### Emails

Le domaine **`sikaloc.com`** est vérifié chez Resend (SPF + DKIM), expéditeur
`no-reply@sikaloc.com`. La limitation de l'expéditeur de test est levée : un
rappel de cycle de grâce a été envoyé vers une adresse tierce et confirmé
`delivered`.

### Corrections v2.1 (validation juridique)

- [x] Mention fiscale nuancée — art. 423 du CGI, LF 2025 : le droit de timbre
      n'est évoqué que comme *susceptible* de s'appliquer, aux espèces au-delà
      de 100 000 FCFA, et explicitement écarté pour Mobile Money et virement.
      Un encart contextuel n'apparaît que lorsque le cas se présente réellement,
      avec le montant indicatif.
- [x] Reçu de paiement partiel — titre dédié et ligne « Solde restant dû pour
      la période »
- [x] Numérotation `AAAA-NNNN` séquentielle par bailleur, atomique
- [x] Horodatage serveur et empreinte SHA-256 du fichier déposé
- [x] Cycle de grâce automatisé (pg_cron + file d'emails Resend)
- [x] Contrôles d'accès `lecture_seule` / `suspendu`
- [x] Paiement Mobile Money via FedaPay (sandbox vérifié)

### Restant avant les pilotes

- [ ] **Validation juridique formelle.** Le modèle intègre les corrections
      issues d'une analyse assistée par IA ; cela ne remplace pas l'avis d'un
      notaire ou d'un avocat béninois (v2.1 §6).
- [ ] **Secret du webhook FedaPay** (`FEDAPAY_WEBHOOK_SECRET`) pour activer la
      vérification de signature, et passage en clés `live` le moment venu.
- [ ] **Planification des routes cron** (`/api/cron/notifications` et
      `/api/cron/purge`) une fois l'application déployée — via Vercel Cron ou
      un ordonnanceur externe.
- [ ] Instrumentation des KPIs du §12 (activation, TTFV, rétention D30).
