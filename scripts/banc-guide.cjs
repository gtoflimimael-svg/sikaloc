/**
 * Parcours d'inscription au guide, de bout en bout.
 *
 *   supabase start · env pointant sur la pile locale · npm run build && npm run start
 *   npm run banc:guide
 *
 * Rejoue ce que fait un visiteur : il saisit son adresse, reçoit une demande de
 * confirmation, clique, reçoit le guide, puis se désinscrit. Chaque étape est
 * vérifiée dans la base ET dans le journal local des envois, pas seulement à
 * l'écran.
 *
 * Le point qui compte le plus : tant que la confirmation n'est pas cliquée,
 * AUCUN guide ne doit partir. C'est ce qui distingue une inscription d'un envoi
 * non sollicité, et c'est le premier test de ce banc.
 */
const { chromium } = require('playwright-core')

const BASE = process.env.BASE_GUIDE || 'http://localhost:3000'
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const JOURNAL = process.env.GUIDE_EMAILS_JOURNAL

if (!/127\.0\.0\.1|localhost/.test(SUPABASE || '')) {
  console.error(`Refus : ${SUPABASE} n'est pas une pile locale.`)
  process.exit(1)
}

const ADRESSE = `banc-guide-${Date.now()}@exemple.test`

const entetes = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` }

/** Lit la ligne d'inscription telle qu'elle est en base. */
async function ligne() {
  const r = await fetch(
    `${SUPABASE}/rest/v1/inscriptions_guide?email=eq.${encodeURIComponent(ADRESSE)}&select=*`,
    { headers: entetes },
  )
  const lignes = await r.json()
  return Array.isArray(lignes) ? lignes[0] : undefined
}

/**
 * Messages destinés à cette adresse, lus dans le journal local.
 *
 * Le serveur écrit ce fichier au lieu d'appeler Resend : aucun message réel ne
 * part vers une adresse fictive pendant les essais.
 */
function messages() {
  if (!JOURNAL) return null
  const fs = require('fs')
  if (!fs.existsSync(JOURNAL)) return []
  return fs
    .readFileSync(JOURNAL, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((m) => m.destinataire === ADRESSE)
}

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}

;(async () => {
  const navigateur = await chromium.launch({
    executablePath:
      require('os').homedir() + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  })
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } })

  console.log(`Parcours d'inscription au guide — ${ADRESSE}\n`)

  // ── 1. Saisie de l'adresse ───────────────────────────────────────────────
  await page.goto(`${BASE}/?e=${Date.now()}#guide`, { waitUntil: 'networkidle' })
  await page.locator('#guide-email').fill(ADRESSE)
  await page.locator('form:has(#guide-email) button[type="submit"]').click()
  await page.waitForSelector('text=/Vérifiez votre boîte mail/', { timeout: 20000 })
  noter('La saisie rend un accusé de réception neutre', true)

  const apresSaisie = await ligne()
  noter(
    'Une ligne est créée, en attente de confirmation',
    apresSaisie?.statut === 'en_attente',
    apresSaisie ? `statut ${apresSaisie.statut}` : 'aucune ligne',
  )

  const boite = messages()
  if (boite === null) {
    noter('Journal des envois disponible', false, 'GUIDE_EMAILS_JOURNAL non défini')
  } else {
    noter('Un seul message est parti', boite.length === 1, `${boite.length} message(s)`)
    const sujet = boite[0]?.sujet ?? ''
    noter(
      'Ce message demande une confirmation, il ne contient PAS le guide',
      /[Cc]onfirmez/.test(sujet) && !/guide —/i.test(sujet),
      sujet.slice(0, 54),
    )
    noter(
      'Aucune pièce jointe avant confirmation',
      (boite[0]?.piecesJointes ?? 0) === 0,
      `${boite[0]?.piecesJointes ?? 0} pièce(s)`,
    )
  }

  // ── 2. Anti-abus ─────────────────────────────────────────────────────────
  await page.goto(`${BASE}/?e=${Date.now()}#guide`, { waitUntil: 'networkidle' })
  await page.locator('#guide-email').fill(ADRESSE)
  await page.locator('form:has(#guide-email) button[type="submit"]').click()
  await page.waitForSelector('text=/Vérifiez votre boîte mail/', { timeout: 20000 })

  const apresRepetition = messages()
  noter(
    'Une seconde demande immédiate ne renvoie pas de message',
    apresRepetition === null || apresRepetition.length === 1,
    `${apresRepetition?.length ?? '?'} message(s) au total`,
  )

  // ── 3. Confirmation ──────────────────────────────────────────────────────
  const avantConfirmation = await ligne()
  await page.goto(`${BASE}/guide/confirmer?jeton=${avantConfirmation.jeton}`, {
    waitUntil: 'networkidle',
  })
  noter(
    'La page de confirmation annonce l’envoi',
    await page.locator('text=/le guide est parti/i').isVisible().catch(() => false),
  )

  const apresConfirmation = await ligne()
  noter(
    'La ligne passe à « confirmé », avec sa date',
    apresConfirmation?.statut === 'confirme' && Boolean(apresConfirmation?.confirme_le),
    `statut ${apresConfirmation?.statut}`,
  )

  const avecGuide = messages()
  if (avecGuide) {
    const dernier = avecGuide[avecGuide.length - 1]
    noter('Un second message est parti', avecGuide.length === 2, `${avecGuide.length} message(s)`)
    noter(
      'Il porte le guide en pièce jointe',
      (dernier?.piecesJointes ?? 0) === 1 && Boolean(dernier?.desinscription),
      `${dernier?.piecesJointes ?? 0} pièce(s), lien de désinscription ${dernier?.desinscription ? 'présent' : 'ABSENT'}`,
    )
  }

  // ── 4. Lien périmé ───────────────────────────────────────────────────────
  await page.goto(`${BASE}/guide/confirmer?jeton=jeton-qui-nexiste-pas-du-tout`, {
    waitUntil: 'networkidle',
  })
  noter(
    'Un jeton inconnu est refusé sans rien envoyer',
    await page.locator('text=/n’est plus valable/').isVisible().catch(() => false),
  )

  // ── 5. Désinscription ────────────────────────────────────────────────────
  await page.goto(`${BASE}/guide/desinscription?jeton=${apresConfirmation.jeton}`, {
    waitUntil: 'networkidle',
  })
  noter(
    'La désinscription est immédiate, sans seconde confirmation',
    await page.locator('text=/vous êtes désinscrit/').isVisible().catch(() => false),
  )

  const apresRetrait = await ligne()
  noter(
    'La ligne est conservée, marquée « désinscrit »',
    apresRetrait?.statut === 'desinscrit' && Boolean(apresRetrait?.desinscrit_le),
    `statut ${apresRetrait?.statut}`,
  )

  // ── 6. Pas de réinscription accidentelle ─────────────────────────────────
  await page.goto(`${BASE}/?e=${Date.now()}#guide`, { waitUntil: 'networkidle' })
  await page.locator('#guide-email').fill(ADRESSE)
  await page.locator('form:has(#guide-email) button[type="submit"]').click()
  await page.waitForSelector('text=/Vérifiez votre boîte mail/', { timeout: 20000 })

  const apresTentative = await ligne()
  noter(
    'Une adresse désinscrite ne se réinscrit pas toute seule',
    apresTentative?.statut === 'desinscrit',
    `statut ${apresTentative?.statut}`,
  )

  // ── 7. La table reste fermée au public ───────────────────────────────────
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const publique = await fetch(`${SUPABASE}/rest/v1/inscriptions_guide?select=email`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  })
  const corps = await publique.json().catch(() => null)
  noter(
    'La liste d’adresses est inaccessible avec la clé publique',
    !Array.isArray(corps) || corps.length === 0,
    `HTTP ${publique.status}`,
  )

  const echecs = etapes.filter((e) => !e).length
  console.log(
    echecs === 0
      ? `\n✓ ${etapes.length} étapes du parcours.`
      : `\n✗ ${echecs} étape(s) en échec sur ${etapes.length}.`,
  )

  await navigateur.close()
  process.exit(echecs === 0 ? 0 : 1)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
