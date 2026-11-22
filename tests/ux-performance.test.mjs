// Non-régression du lot « UX, performance, SEO, fonctionnel » (audit du
// 22/11/2026) : SEO-01, UX-01 à 03, FN-03, FN-06, PERF-01/02, DB-01.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { cheminProtege, cheminVitrine, CHEMINS_VITRINE, CHEMINS_VITRINE_EXACTS, destinationApresConnexion } from '../src/lib/roles.ts'
import { dateDuJourBenin } from '../src/lib/format.ts'

const racine = new URL('../', import.meta.url)
const lire = (chemin) => readFile(new URL(chemin, racine), 'utf8')
const nombreDeH1 = (source) => (source.match(/<h1[\s>]/g) ?? []).length

test('SEO-01 : www redirigé en 308 vers l’apex, même en maintenance', async () => {
  const config = await lire('next.config.ts')
  assert.match(config, /has: \[\{ type: 'host' as const, value: 'www\.sikaloc\.com' \}\]/)
  assert.match(config, /destination: 'https:\/\/sikaloc\.com\/:chemin\*'/)
  assert.match(config, /if \(maintenanceActive\) return \[versApex\]/)
})

test('SEO-01 / UX-01 : un seul h1 sur l’inscription et la connexion', async () => {
  const inscription = await lire('src/components/auth/experience-inscription.tsx')
  const connexion = await lire('src/app/connexion/page.tsx')
  assert.equal(nombreDeH1(inscription), 1)
  assert.equal(nombreDeH1(connexion), 1)
  assert.match(connexion, /<h1 id="connexion-form-title">/)
  assert.match(connexion, /className="connexion-editorial-title" aria-hidden="true"/)
  assert.doesNotMatch(connexion, /connexion-mobile-context/)
  assert.match(inscription, /className="signup-editorial-title" aria-hidden="true"/)
})

test('UX-02 : l’animation ne modifie plus le contenu des pages avant hydratation', async () => {
  const mouvement = await lire('src/components/ui/mouvement-pages.tsx')
  assert.doesNotMatch(mouvement, /setAttribute\('data-sikaloc-motion-heading'|ATTR_TITRE|classList\.add/)
  assert.match(mouvement, /racine\.setAttribute\(ATTR_PRET, 'true'\)/)
  assert.match(await lire('src/app/globals.css'), /html\[data-sikaloc-page-entered='true'\] main h1/)
})

test('UX-03 : écran de chargement après connexion et explication Find', async () => {
  assert.match(await lire('src/app/entrer/loading.tsx'), /role="status"[\s\S]*Ouverture de votre espace/)
  assert.equal(destinationApresConnexion({ estBailleur: false, estLocataire: false, estCandidat: true }), '/entrer?espace=find-archive')
  assert.match(await lire('src/app/entrer/page.tsx'), /Sikaloc Find a fermé le 9 novembre 2026/)
})

test('FN-03 : la date du jour suit l’heure du Bénin (UTC+1)', () => {
  assert.equal(dateDuJourBenin(new Date('2026-11-22T23:30:00Z')), '2026-11-23')
  assert.equal(dateDuJourBenin(new Date('2026-11-22T22:59:00Z')), '2026-11-22')
  assert.equal(dateDuJourBenin(new Date('2026-12-31T23:10:00Z')), '2027-01-01')
})

test('FN-03 / FN-06 / DB-01 : migrations attendues', async () => {
  const quota = await lire('supabase/migrations/20261122181000_quota_heure_benin.sql')
  assert.match(quota, /now\(\) at time zone 'Africa\/Porto-Novo'\)::date/)
  assert.doesNotMatch(quota, /time zone 'UTC'/)
  const brouillon = await lire('supabase/migrations/20261122180000_reutiliser_brouillon_paiement.sql')
  assert.ok(brouillon.indexOf("p.statut = 'Brouillon'::public.statut_paiement") < brouillon.indexOf('insert into public.paiements'))
  assert.match(brouillon, /for update;/)
  assert.match(brouillon, /grant execute on function public\.creer_paiement_brouillon[\s\S]*to authenticated/)
  const index = await lire('supabase/migrations/20261122182000_indexer_cles_etrangeres.sql')
  assert.equal((index.match(/create index if not exists/g) ?? []).length, 8)
  assert.match(await lire('src/lib/plan.ts'), /date_fin_abonnement >= dateDuJourBenin\(\)/)
})

test('PERF-01 : les pages vitrine ne lisent jamais la session, et le proxy les sert sans Auth', async () => {
  const pages = {
    '/': 'src/app/page.tsx',
    '/blog': 'src/app/blog/page.tsx',
    '/blog/x': 'src/app/blog/[slug]/page.tsx',
    '/questions': 'src/app/questions/page.tsx',
    '/legal/mentions': 'src/app/legal/mentions/page.tsx',
    '/legal/conditions': 'src/app/legal/conditions/page.tsx',
    '/legal/confidentialite': 'src/app/legal/confidentialite/page.tsx',
    '/guide/confirmer': 'src/app/guide/confirmer/page.tsx',
  }
  for (const [chemin, fichier] of Object.entries(pages)) {
    assert.ok(cheminVitrine(chemin), chemin)
    assert.doesNotMatch(await lire(fichier), /creerClientServeur|cookies\(\)|getUser|bailleurCourant|rolesDuCompte/, fichier)
  }
  assert.doesNotMatch(await lire('src/app/guide/layout.tsx'), /creerClientServeur|cookies\(\)|getUser/)
  // Jamais un espace protégé, ni l'administration des questions ou /pro.
  for (const chemin of [...CHEMINS_VITRINE_EXACTS, ...CHEMINS_VITRINE]) assert.equal(cheminProtege(chemin), false, chemin)
  for (const chemin of ['/questions/gestion', '/pro', '/pro/tableau-de-bord', '/me', '/entrer', '/connexion', '/inscription']) {
    assert.equal(cheminVitrine(chemin), false, chemin)
  }
  const proxy = await lire('src/proxy.ts')
  assert.ok(proxy.indexOf('cheminVitrine(chemin)') < proxy.indexOf('createServerClient<Database>('))
  assert.match(proxy, /request\.method === 'GET' \|\| request\.method === 'HEAD'\) && cheminVitrine\(chemin\)/)
})

test('PERF-02 : images prioritaires en preload (Next 16), plus de priority déprécié', async () => {
  for (const fichier of ['src/app/page.tsx', 'src/app/pro/page.tsx', 'src/app/connexion/page.tsx', 'src/components/auth/experience-inscription.tsx', 'src/app/me/rejoindre/page.tsx']) {
    const source = await lire(fichier)
    assert.match(source, /^\s*preload\s*$/m, fichier)
    assert.doesNotMatch(source, /^\s*priority\s*$/m, fichier)
  }
})
