# Déploiement de Sikaloc en production

---

## 1. Variables d'environnement Vercel

> **Correction par rapport au brief initial.** Les variables demandées
> commençaient par `VITE_` — c'est la convention de Vite. Sikaloc est une
> application **Next.js** : le préfixe qui expose une variable au navigateur est
> `NEXT_PUBLIC_`. Des variables `VITE_*` ne seraient jamais lues et l'application
> planterait au premier appel à Supabase.

À définir dans *Project Settings → Environment Variables*, pour les
environnements **Production**, **Preview** et **Development**.

> **Les clés FedaPay diffèrent selon l'environnement.** Seule la Production
> porte les clés `live`. Preview et Development restent en `sandbox` : sans
> cela, une branche de test ou un `npm run dev` débiterait de vrais comptes
> Mobile Money.

| Variable | Valeur | Exposée au navigateur |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pzrixjydnclwvjwqfbal.supabase.co` | oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé `anon` du projet | oui |
| `NEXT_PUBLIC_SITE_URL` | `https://sikaloc.com` | oui |
| `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` | **non — jamais** |
| `FEDAPAY_PUBLIC_KEY` | `pk_live_…` en Production, `pk_sandbox_…` ailleurs | non |
| `FEDAPAY_SECRET_KEY` | `sk_live_…` en Production, `sk_sandbox_…` ailleurs | non |
| `FEDAPAY_ENV` | `live` en Production, `sandbox` ailleurs | non |
| `FEDAPAY_WEBHOOK_SECRET` | secret du webhook FedaPay | non |
| `RESEND_API_KEY` | `re_…` | non |
| `EMAIL_FROM` | `no-reply@sikaloc.com` | non |
| `EMAIL_FROM_NAME` | `Sikaloc` | non |
| `APP_NAME` | `Sikaloc` | non |
| `CRON_SECRET` | chaîne aléatoire (voir ci-dessous) | non |

Les valeurs réelles sont dans `.env.local`. Trois d'entre elles manquaient au
brief et sont pourtant nécessaires :

- **`NEXT_PUBLIC_SITE_URL`** — sans elle, les liens des emails et l'URL de
  retour après paiement pointeraient sur `localhost`.
- **`CRON_SECRET`** — les routes `/api/cron/*` refusent toute requête sans
  elle. Mieux vaut une tâche qui ne tourne pas qu'un endpoint de purge ouvert.
  La générer avec :
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```
- **`FEDAPAY_WEBHOOK_SECRET`** — active la vérification de signature des
  notifications de paiement.

---

## 2. Domaine `sikaloc.com`

### 2.1 Côté Vercel

*Project → Settings → Domains → Add* : ajouter `sikaloc.com`. Ajouter aussi
`www.sikaloc.com` et le faire rediriger vers l'apex.

### 2.2 Côté Spaceship (DNS)

Le domaine est **déjà déclaré** dans le projet Vercel (`sikaloc.com` et
`www.sikaloc.com`). Il ne manque que l'enregistrement DNS, à créer dans
*Advanced DNS* chez Spaceship :

| Type | Hôte | Valeur | TTL |
|---|---|---|---|
| `A` | `@` | `76.76.21.21` | Automatique |
| `CNAME` | `www` | `cname.vercel-dns.com` | Automatique |

Valeur confirmée par Vercel le 18 août 2026 (`vercel domains inspect`).

> ### Ne PAS changer les serveurs de noms
>
> Vercel propose une seconde méthode : basculer les nameservers du domaine vers
> `ns1.vercel-dns.com` / `ns2.vercel-dns.com`. **Ne la suivez pas.**
>
> Vos enregistrements SPF et DKIM de Resend vivent chez Spaceship. Déplacer les
> nameservers vers Vercel les rendrait invisibles du jour au lendemain :
> `sikaloc.com` ne serait plus authentifié, et tous les emails de Sikaloc
> partiraient en spam — ou seraient rejetés.
>
> L'enregistrement `A` ci-dessus atteint le même résultat sans toucher au reste
> de la zone.

**Ne pas toucher non plus** aux enregistrements `TXT` et `MX` existants : ce
sont ceux de Resend. Seul l'ajout du `A` et du `CNAME` est nécessaire.

La propagation prend de quelques minutes à quelques heures. Vercel émet ensuite
le certificat TLS automatiquement et vous notifie par email.

Vérifier l'avancement :

```bash
npx vercel domains inspect sikaloc.com --scope lansa
dig +short sikaloc.com          # doit renvoyer 76.76.21.21
```

---

## 3. Tâches planifiées

`vercel.json` déclare trois tâches, **volontairement décalées** :

```json
{ "path": "/api/cron/cycle-grace",   "schedule": "0 2 * * *"  }
{ "path": "/api/cron/notifications", "schedule": "15 2 * * *" }
{ "path": "/api/cron/purge",         "schedule": "30 2 * * *" }
```

Le brief proposait de tout lancer à `00:00`. L'ordre compte : le cycle de grâce
**dépose** les rappels dans la file, les notifications les **expédient**. Lancés
en même temps, les emails du jour partiraient avec 24 heures de retard. Le quart
d'heure d'écart laisse au premier le temps de finir.

02:00 UTC correspond à 03:00 à Cotonou — hors des heures d'usage.

**Redondance avec pg_cron.** La base exécute déjà `appliquer_cycle_grace` à
03:00 UTC et la purge à 04:00. Les deux mécanismes cohabitent sans risque : les
fonctions n'agissent que lorsqu'un palier est franchi. Si l'un tombe, l'autre
prend le relais. Pour n'en garder qu'un :

```sql
select cron.unschedule('sika-cycle-grace');
select cron.unschedule('sika-purge-j90');
```

> **Plan Vercel Hobby** : une seule tâche par jour, déclenchée à l'heure près
> seulement. Avec trois tâches, il faut le plan **Pro**. À défaut, conserver
> pg_cron pour le cycle et la purge, et ne planifier que `/api/cron/notifications`
> sur Vercel.

---

## 4. Redirections Supabase Auth

*Dashboard → Authentication → URL Configuration* :

- **Site URL** : `https://sikaloc.com`
- **Redirect URLs** : ajouter
  - `https://sikaloc.com/auth/callback`
  - `https://sikaloc.com/auth/callback?next=/reinitialiser-mot-de-passe`
  - `http://localhost:3000/**` (à conserver pour le développement)

Sans cela, les liens de confirmation d'inscription et de réinitialisation de
mot de passe seraient rejetés.

---

## 5. Webhook FedaPay

*Console FedaPay → Workbench → Webhooks* :

- **URL** : `https://sikaloc.com/api/abonnement/fedapay`
- Récupérer le secret (« Click to reveal ») et le placer dans
  `FEDAPAY_WEBHOOK_SECRET` sur Vercel.

Le crédit d'abonnement ne dépend pas de cette signature : la transaction est
systématiquement revérifiée auprès de l'API FedaPay avec la clé secrète. La
signature est une protection supplémentaire, pas l'unique rempart.

---

## 6. Déployer

### Sans dépôt Git

```bash
npm i -g vercel
vercel login
vercel link          # créer le projet
vercel --prod        # déployer
```

### Avec un dépôt Git

```bash
git init && git add -A
git commit -m "Sikaloc — MVP"
git remote add origin <url-du-depot>
git push -u origin main
```

Puis *vercel.com/new* → importer le dépôt. Les déploiements suivants se font à
chaque `git push`.

Vérifier avant tout que `.env.local` est bien ignoré :

```bash
git check-ignore .env.local   # doit afficher .env.local
```

---

## 7. Vérifications après mise en ligne

```bash
# 1. L'application répond
curl -I https://sikaloc.com

# 2. Les routes cron sont protégées (doit renvoyer 401)
curl -s -o /dev/null -w "%{http_code}\n" https://sikaloc.com/api/cron/purge

# 3. Elles fonctionnent avec le secret
curl -X POST https://sikaloc.com/api/cron/cycle-grace \
  -H "Authorization: Bearer $CRON_SECRET"
```

Puis, dans l'application : créer un compte de test, aller au bout de
l'onboarding, enregistrer un paiement et vérifier que la quittance se génère et
se télécharge.

---

## 8. FedaPay en production — état

Bascule effectuée le 18 août 2026.

| Élément | État |
|---|---|
| `FEDAPAY_SECRET_KEY` / `FEDAPAY_PUBLIC_KEY` (Production) | clés `live`, vérifiées contre `api.fedapay.com` |
| `FEDAPAY_ENV` (Production) | `live` |
| Preview / Development | inchangés, `sandbox` |
| Webhook live | `id 8090`, `https://sikaloc.com/api/abonnement/fedapay`, SSL vérifié |
| `FEDAPAY_WEBHOOK_SECRET` | en place (Production), signature vérifiée de bout en bout |
| DNS `sikaloc.com` | résolu vers `76.76.21.21`, TLS émis |
| Réconciliation au retour du guichet | en place (voir plus bas) |

### Le préfixe de la clé fait foi

Le code déduit l'environnement du préfixe : une clé `sk_sandbox_…` ne peut pas
frapper l'API de production, même si `FEDAPAY_ENV` indique `live`.

**La réciproque n'est pas vraie.** `FEDAPAY_ENV=sandbox` force le mode sandbox
*même avec une clé `sk_live_…`* (`src/lib/fedapay.ts`, ligne 35). Une bascule
qui oublierait `FEDAPAY_ENV` laisserait donc les paiements en sandbox, sans
erreur visible : les clés live sont refusées par l'API sandbox (401) et le
guichet afficherait « paiement indisponible ». C'est bruyant, donc sûr — mais
il faut savoir où regarder.

### `disable_on_error`

FedaPay crée ses webhooks avec `disable_on_error: true` : une seule réponse en
erreur désactive définitivement la notification, et plus aucun abonnement n'est
crédité — silencieusement. Le réglage est à `false` sur le webhook 8090.

C'est cohérent avec la route : `/api/abonnement/fedapay` répond `503` quand la
vérification est momentanément impossible, précisément pour que FedaPay
réessaie. Avec `disable_on_error: true`, ce `503` aurait eu l'effet inverse.

> **L'API FedaPay répond `500` sur les écritures alors qu'elles aboutissent.**
> La création du webhook comme la modification de `disable_on_error` ont toutes
> deux renvoyé `500` avec la modification bien appliquée. Toujours relire
> l'état avec un `GET` plutôt que se fier au code de retour.

### Deux chemins de crédit, une seule règle

Le crédit d'abonnement dépendait du seul webhook : une notification perdue et le
bailleur payait sans être crédité, sans trace visible. Il existe désormais un
second chemin.

`src/lib/reglement-abonnement.ts` porte la règle, et deux appelants s'en
servent :

| Appelant | Quand |
|---|---|
| `/api/abonnement/fedapay` | notification de l'opérateur |
| `/app/parametres?retour=1` | le bailleur revient du guichet |

Aucun n'est fiable seul. Le webhook peut se perdre ; la réconciliation suppose
que le bailleur revienne sur l'application. Ensemble, ils couvrent l'essentiel.

Toute duplication de la règle est à proscrire : deux implémentations finiraient
par diverger, et c'est de l'argent réel.

### L'arbitrage se fait en base, pas dans le code

Le contrôle « déjà réglée ? » ne peut pas être une lecture suivie d'une
décision : le webhook et la réconciliation se déclenchent à quelques
millisecondes d'écart, liraient tous deux `EN_ATTENTE`, et offriraient chacun un
mois pour un seul paiement.

La condition est donc portée par l'instruction d'écriture :

```ts
.update({ statut: 'REGLEE', … })
.eq('id', ligne.id)
.neq('statut', 'REGLEE')   // ← l'arbitre
.select('id')
```

Une seule exécution reçoit une réponse non vide ; elle seule appelle
`crediterAbonnement`. Quand la ligne n'existe pas encore, c'est l'insertion qui
arbitre, sur la contrainte `unique` de `transaction_id`.

**Ne pas remplacer ce `neq` par un test en amont.** Il ressemble à une
redondance ; c'est la seule chose qui empêche le double crédit.

### Signature du webhook

La documentation FedaPay ne détaille pas l'algorithme : elle renvoie vers ses
bibliothèques. L'implémentation de `signatureWebhookValide` a donc été alignée
sur la source de `fedapay@1.2.5` (`src/Webhook.ts`, classe `WebhookSignature`),
seul document faisant foi :

| | |
|---|---|
| En-tête | `X-FEDAPAY-SIGNATURE` |
| Format | `t=<horodatage>,s=<signature>` |
| Signature | HMAC-SHA256 hexadécimal de `<horodatage>.<corps brut>` |
| Tolérance | 300 s |

Deux écarts ont été corrigés à cette occasion.

**Plusieurs `s=` peuvent cohabiter.** Le SDK collecte les signatures dans un
*tableau* : c'est ainsi qu'une rotation de secret se fait sans coupure, l'ancien
et le nouveau signant en parallèle. Un `Object.fromEntries` n'en retenait que la
dernière — la rotation aurait échoué une fois sur deux, au pire moment.

**Seul le passé est borné.** L'ancienne version rejetait aussi les horodatages
futurs (`Math.abs`). Un horodatage futur ne rejoue rien — la signature le
couvre — alors qu'une simple dérive d'horloge entre FedaPay et Vercel aurait
fait échouer *toutes* les notifications. Le SDK ne borne que le passé ; nous
aussi désormais.

### Tester le webhook sans dépenser un franc

FedaPay sait émettre un événement de test réellement signé :

```bash
curl -X POST -H "Authorization: Bearer $FEDAPAY_SECRET_KEY" \
  -H "Content-Type: application/json" -d '{"event":"transaction.approved"}' \
  https://api.fedapay.com/v1/webhooks/8090/send_event
```

Le paramètre est `event` — `name` est silencieusement ignoré et l'API répond
« L'évenement n'existe pas ».

La transaction du stub n'existe pas dans l'API, donc `verifierTransaction`
échoue et la route répond `503`. **C'est le résultat attendu, et c'est lui qui
prouve que la signature est acceptée** : une signature refusée donnerait `401`.
Les deux codes ne se confondent pas.

Relire ensuite les journaux :

```bash
npx vercel logs <déploiement> --scope lansa --json | grep abonnement/fedapay
```

Vérifié le 18 août 2026 : `503` sur l'événement de test et ses trois
réessais, `enabled: true` conservé — ce qui valide du même coup
`disable_on_error: false`, sans lequel le webhook serait mort à la première
tentative.

### La page de retour ne peut pas échouer

`reconcilierRetourGuichet` ne lève jamais : elle est appelée pendant le rendu
d'une page, et un abonnement non réconcilié vaut mieux qu'un écran d'erreur.
Chaque issue a son message — crédité, en attente, refusé, opérateur injoignable
— parce qu'un bailleur qui vient de payer sans savoir où en est son argent est
la pire situation de tout le parcours.
