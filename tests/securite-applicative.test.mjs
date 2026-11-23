// Non-régression du lot « sécurité applicative » (audit du 22/11/2026) :
// SEC-02 CSP à nonce, SEC-03 limitation des connexions, SEC-04 compteur OTP,
// SEC-05 dépendances, SEC-06 messages d'erreur, SEC-07 droits résiduels.
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

import { genererNonce, politiqueCsp } from '../src/lib/csp.ts'
import { estMessageMetier, messageErreurUtilisateur } from '../src/lib/erreurs-utilisateur.ts'

const racine = new URL('../', import.meta.url)
const lire = (chemin) => readFile(new URL(chemin, racine), 'utf8')

test('SEC-02 : les scripts exigent le nonce, sans unsafe-inline ni unsafe-eval en production', () => {
  const nonce = genererNonce()
  const csp = politiqueCsp({ nonce, chemin: '/', developpement: false, urlSupabase: 'https://ref.supabase.co' })
  const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'))
  assert.equal(scriptSrc, `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`)
  assert.doesNotMatch(scriptSrc, /unsafe-inline|unsafe-eval/)
  assert.match(csp, /frame-ancestors 'none'/)
  assert.match(csp, /object-src 'none'/)
  assert.match(csp, /connect-src 'self' https:\/\/ref\.supabase\.co wss:\/\/ref\.supabase\.co/)
  assert.match(politiqueCsp({ nonce, chemin: '/', developpement: true }), /'unsafe-eval'/)
  assert.match(politiqueCsp({ nonce, chemin: '/exemple-quittance', developpement: false }), /frame-ancestors 'self'/)
})

test('SEC-02 : un nonce neuf et imprévisible par requête', () => {
  const nonces = new Set(Array.from({ length: 200 }, () => genererNonce()))
  assert.equal(nonces.size, 200)
  for (const n of nonces) assert.match(n, /^[A-Za-z0-9+/]{22}==$/)
})

test('SEC-02 : le proxy pose la CSP sur la requête et la réponse ; la config ne la double plus', async () => {
  const proxy = await lire('src/proxy.ts')
  const config = await lire('next.config.ts')
  const layout = await lire('src/app/layout.tsx')
  assert.match(proxy, /enTetes\.set\('Content-Security-Policy', csp\)/)
  assert.match(proxy, /enTetes\.set\(EN_TETE_NONCE, nonce\)/)
  assert.match(proxy, /return avecCsp\(reponse\)/)
  assert.doesNotMatch(proxy, /NextResponse\.next\(\{ request \}\)/)
  assert.doesNotMatch(config, /key: 'Content-Security-Policy'|script-src/)
  assert.match(layout, /<script nonce=\{nonce\} dangerouslySetInnerHTML=\{\{ __html: SCRIPT_ANTI_FLASH \}\} \/>/)
})

test('SEC-03 : l’essai est réservé sous verrou avant Auth, avec trois limites', async () => {
  const auth = await lire('src/lib/actions/auth.ts')
  const parametres = await lire('src/lib/actions/parametres.ts')
  const migration = await lire('supabase/migrations/20261122150000_limiter_tentatives_connexion.sql')
  assert.ok(auth.indexOf('reserverTentative(email') < auth.indexOf('signInWithPassword('))
  assert.ok(parametres.indexOf('reserverTentative(bailleur.email') < parametres.indexOf('signInWithPassword('))
  assert.doesNotMatch(auth + parametres, /verifierBlocage|enregistrerTentative/)
  assert.match(migration, /pg_advisory_xact_lock\(pg_catalog\.hashtext\('connexion:email:'/)
  assert.match(migration, /having count\(\*\) >= 5/)
  assert.match(migration, /having count\(\*\) >= 20/)
  assert.match(migration, /having count\(\*\) >= 30/)
  assert.match(migration, /revoke all on function public\.reserver_tentative_connexion\(text, text\) from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.reserver_tentative_connexion\(text, text\) to service_role/)
})

test('SEC-04 : un essai OTP est décompté atomiquement avant toute comparaison', async () => {
  const otp = await lire('src/lib/verification/otp.ts')
  const reservation = otp.indexOf(".eq('tentatives', courant.tentatives)")
  assert.ok(reservation > 0)
  assert.ok(reservation < otp.indexOf('timingSafeEqual(attendu, fourni)'))
  assert.match(otp, /if \(erreurEssai \|\| !essaiReserve\)/)
})

test('SEC-05 : versions corrigées de next et zod', async () => {
  const paquet = JSON.parse(await lire('package.json'))
  const [, mineurNext, patchNext] = paquet.dependencies.next.split('.').map(Number)
  assert.ok(mineurNext > 4 || (mineurNext === 4 && patchNext >= 6), paquet.dependencies.next)
  const [majeurZod, mineurZod, patchZod] = paquet.dependencies.zod.split('.').map(Number)
  assert.ok(majeurZod > 4 || mineurZod > 6 || (mineurZod === 6 && patchZod >= 6), paquet.dependencies.zod)
})

test('SEC-06 : seuls les messages métier français passent tels quels', () => {
  assert.ok(estMessageMetier('Bail introuvable ou non autorisé.'))
  assert.ok(estMessageMetier('Ce paiement est figé : la fenêtre de correction de 5 minutes est écoulée.'))
  for (const technique of [
    'duplicate key value violates unique constraint "baux_un_seul_actif_par_logement"',
    'new row violates row-level security policy for table "paiements"',
    'permission denied for table baux',
    'SIGNATURE_QUITTANCE_REQUISE',
    'column "montant_exigible" does not exist',
    'Failed to fetch',
    '',
    null,
  ]) assert.equal(estMessageMetier(technique), false, String(technique))

  const original = console.error
  console.error = () => {}
  try {
    const doublon = messageErreurUtilisateur(
      { code: '23505', message: 'duplicate key value violates unique constraint "logements_pkey"' },
      'Enregistrement impossible', 'test',
    )
    assert.equal(doublon, 'Enregistrement impossible : cet élément existe déjà.')
    assert.equal(
      messageErreurUtilisateur({ code: 'same_password', message: 'New password should be different' }, 'Changement impossible', 'test'),
      'Le nouveau mot de passe doit être différent de l’actuel.',
    )
    const inconnu = messageErreurUtilisateur({ code: 'XX000', message: 'internal: relation "prive.x"' }, 'Suppression impossible', 'test')
    assert.doesNotMatch(inconnu, /relation|prive/)
    assert.match(inconnu, /^Suppression impossible\. Réessayez/)
  } finally {
    console.error = original
  }
})

test('SEC-06 : aucune action ne renvoie un message technique brut', async () => {
  const dossier = new URL('src/lib/actions/', racine)
  for (const fichier of await readdir(dossier)) {
    const source = await readFile(new URL(fichier, dossier), 'utf8')
    assert.doesNotMatch(source, /`[^`]*\$\{\w+\.message\}[^`]*`/, fichier)
    assert.doesNotMatch(source, /erreur: \w+\.message\.replace/, fichier)
  }
  const abonnement = await lire('src/lib/actions/abonnement.ts')
  assert.doesNotMatch(abonnement, /erreur: resultat\.message/)
})

test('SEC-07 : droits résiduels retirés et droits par défaut fermés', async () => {
  const migration = await lire('supabase/migrations/20261122160000_retirer_droits_residuels.sql')
  assert.match(migration, /revoke references, trigger, truncate, maintain\s+on all tables in schema public from anon, authenticated/)
  for (const objet of ['tables', 'sequences']) {
    assert.match(migration, new RegExp(`alter default privileges for role postgres in schema public\\s+revoke all on ${objet} from anon, authenticated`))
  }
  assert.match(migration, /revoke all on functions from public, anon, authenticated/)
})
