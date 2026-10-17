/**
 * Banc du parcours candidat — Sikaloc_Find, S8-B.
 *
 *   supabase start · npm run build · npm run start (ou npm run dev)
 *   npm run banc:candidat
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 *   1. La porte : la fiche publique propose de candidater, et rien d'autre —
 *      ni téléphone, ni email, ni WhatsApp.
 *   2. Le visiteur : il crée son compte depuis l'annonce, et revient à
 *      l'annonce, pas sur un catalogue où il devrait la retrouver.
 *   3. Le compte existant : `suite=` ramène au même endroit.
 *   4. Les comptes voisins : un bailleur, un locataire, un candidat — chacun
 *      va où il doit, et `/me` ne casse pour personne.
 *   5. L'étanchéité : A ne voit pas la candidature de B, et le bailleur ne
 *      reçoit ni téléphone ni email.
 *   6. Les états de l'annonce : brouillon, suspendue, clôturée — même 404 que
 *      la fiche, et un envoi refusé si l'annonce change entre-temps.
 *   7. La concurrence : la base tranche, pas l'écran.
 *
 * Ce banc ne crée AUCUNE donnée hors de la pile locale : il refuse de
 * démarrer autrement.
 */
const { createClient } = require('@supabase/supabase-js')
const { chromium } = require('playwright-core')
const sharp = require('sharp')
const { randomUUID } = require('node:crypto')

const BASE = process.env.BASE_ONBOARDING || 'http://localhost:3000'
const { exigerPileLocale } = require('./garde-locale.cjs')
const { rangerComptes } = require('./menage-comptes.cjs')

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

exigerPileLocale('Ce banc')

const admin = createClient(SUPABASE, SERVICE, { auth: { persistSession: false } })
const MDP = 'Jonquille7Mn!'
const ADRESSE = 'Lot 12, derrière le marché Dantokpa'

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t) => console.log(`\n${t}`)
const comptes = []

/** Un compte déjà confirmé, du rôle voulu. */
async function compte(cle, nom, role) {
  const email = `banc-s8b-${cle}-${Date.now()}@exemple.test`
  const telephone = `+22901${String(Date.now()).slice(-8)}`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: MDP,
    email_confirm: true,
    user_metadata: { nom, telephone, ...(role ? { role } : {}) },
  })
  if (error) throw new Error(`${cle} : ${error.message}`)
  comptes.push(data.user.id)
  const db = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await db.auth.signInWithPassword({ email, password: MDP })
  return { id: data.user.id, email, nom, telephone, db }
}

const image = () =>
  sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#5d7f4e' } })
    .jpeg({ quality: 80 })
    .toBuffer()

async function annonce(b, statut) {
  const { data: logement } = await admin
    .from('logements')
    .insert({ bailleur_id: b.id, adresse: ADRESSE, type: 'Appartement', ville: 'Cotonou' })
    .select('id')
    .single()
  const { data: a, error } = await admin
    .from('annonces')
    .insert({
      bailleur_id: b.id,
      logement_id: logement.id,
      type: 'Appartement',
      ville: 'Cotonou',
      quartier: 'Fidjrossè',
      chambres: 2,
      loyer: 120000,
      description: 'Deux chambres salon, cour clôturée, eau courante.',
    })
    .select('id, reference')
    .single()
  if (error) throw new Error(`annonce : ${error.message}`)

  const chemin = `${b.id}/${a.id}/${randomUUID()}.jpg`
  const fichier = await image()
  await admin.storage.from('annonces').upload(chemin, fichier, { contentType: 'image/jpeg' })
  await admin.from('annonce_photos').insert({
    annonce_id: a.id,
    bailleur_id: b.id,
    chemin,
    position: 0,
    largeur: 1600,
    hauteur: 1200,
    type_mime: 'image/jpeg',
    poids: fichier.length,
  })

  if (statut !== 'brouillon') await admin.from('annonces').update({ statut: 'publiee' }).eq('id', a.id)
  if (statut === 'suspendue') await admin.from('annonces').update({ statut: 'suspendue' }).eq('id', a.id)
  if (statut === 'cloturee') {
    await admin.from('annonces').update({ statut: 'cloturee', motif_cloture: 'retiree' }).eq('id', a.id)
  }
  return a
}

/** Le texte lu à l'écran, espaces normalisés. */
const lu = async (page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()

/**
 * Attend qu'une phrase apparaisse, et dit si elle est venue.
 *
 * Attendre un SÉLECTEUR ne prouverait rien : `role="alert"` porte aussi les
 * erreurs de champ, et un `waitForSelector` se satisfaisait de l'erreur
 * précédente, encore à l'écran — trois vérifications passaient ainsi sans rien
 * vérifier.
 */
async function attendreTexte(page, phrase, ms = 20000) {
  try {
    await page.waitForFunction((p) => document.body.innerText.includes(p), phrase, { timeout: ms })
    return true
  } catch {
    return false
  }
}

;(async () => {
  console.log('\nSikaloc_Find — le parcours candidat (S8-B)\n')

  const bailleur = await compte('bailleur', 'Rachelle Dossou')
  const publiee = await annonce(bailleur, 'publiee')
  const seconde = await annonce(bailleur, 'publiee')
  const brouillon = await annonce(bailleur, 'brouillon')
  const suspendue = await annonce(bailleur, 'suspendue')
  const cloturee = await annonce(bailleur, 'cloturee')

  const navigateur = await chromium.launch({
    executablePath: require('os').homedir() + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  })
  /** Un navigateur neuf : aucun cookie hérité d'un autre acteur. */
  const onglet = async () => {
    const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 900 } })
    return contexte.newPage()
  }

  // ═══ 1. La porte ═════════════════════════════════════════════════════════
  titre('1. Depuis la fiche publique')

  const fiche = await onglet()
  await fiche.goto(`${BASE}/find/${publiee.reference}`, { waitUntil: 'networkidle' })
  const texteFiche = await lu(fiche)
  noter('Un bouton « Candidater »', texteFiche.includes('Candidater'))
  noter(
    'Il mène au parcours de cette annonce',
    (await fiche.locator(`a[href="/find/${publiee.reference}/candidater"]`).count()) === 1,
  )
  // Le pied de page porte l'adresse de Sikaloc : la question est celle du
  // BAILLEUR, et elle se juge donc sur le corps de la page.
  const corpsFiche = /<main[\s\S]*?<\/main>/.exec(await fiche.content())?.[0] ?? ''
  noter(
    'Aucun contact direct du bailleur : ni téléphone, ni email, ni WhatsApp',
    Boolean(corpsFiche) && !/wa\.me|tel:|mailto:/.test(corpsFiche),
  )
  noter(
    '…ni le téléphone du bailleur sous une autre forme',
    !corpsFiche.includes(bailleur.telephone) &&
      !corpsFiche.includes(bailleur.telephone.replace('+229', '')) &&
      !corpsFiche.includes(bailleur.email),
  )
  noter(
    'La fiche annonce ce que le bailleur verra',
    texteFiche.includes('Ni votre téléphone, ni votre email'),
  )

  await fiche.click(`a[href="/find/${publiee.reference}/candidater"]`)
  await fiche.waitForURL(`**/find/${publiee.reference}/candidater`)
  const texteVisiteur = await lu(fiche)
  noter('Un visiteur voit la création de compte', texteVisiteur.includes('Créez votre compte'))
  noter('…et un lien vers la connexion', texteVisiteur.includes('Se connecter'))
  noter(
    '…qui garde l’annonce dans `suite`',
    (await fiche
      .locator(`a[href*="/connexion?suite="][href*="${publiee.reference}"]`)
      .count()) === 1,
  )
  const serviePourCandidater = await (await fetch(`${BASE}/find/${publiee.reference}/candidater`)).text()
  noter(
    'La page de candidature n’est pas indexable',
    /<meta name="robots" content="noindex/.test(serviePourCandidater),
  )

  for (const [nom, reference] of [
    ['brouillon', brouillon.reference],
    ['suspendue', suspendue.reference],
    ['clôturée', cloturee.reference],
    ['inconnue', 'zzzzzzzzzz'],
    ['mal formée', 'ILLISIBLE!!'],
  ]) {
    const r = await fetch(`${BASE}/find/${reference}/candidater`, { redirect: 'manual' })
    noter(`Candidater à une annonce ${nom} : 404`, r.status === 404, String(r.status))
  }

  // ═══ 2. L'inscription depuis l'annonce ═════════════════════════════════
  titre('2. Le formulaire d’inscription')

  /*
   * Ce banc n'envoie AUCUN email.
   *
   * La pile locale partage le `config.toml` du projet, qui branche GoTrue sur
   * le SMTP de Resend : ici, `signUp` échoue à l'envoi de la confirmation, et
   * un banc qui « réparerait » cela enverrait de vrais messages depuis une
   * machine de développement. On exerce donc ce qui relève du code — la
   * validation, le déclencheur, le retour à l'annonce — et on constate que
   * l'échec d'envoi, lui, reste lisible et muet sur la technique.
   */

  await fiche.fill('input[name="nom"]', 'Sylvain Aïvodji')
  await fiche.fill('input[name="email"]', `banc-s8b-refus-${Date.now()}@exemple.test`)
  await fiche.fill('#telephone', '12')
  await fiche.fill('input[name="motDePasse"]', MDP)
  await fiche.click('button[type="submit"]')
  const refuse = await attendreTexte(fiche, 'Un numéro béninois compte 10 chiffres après l’indicatif.')
  noter('Un numéro invalide est refusé au champ', refuse)
  noter('…sans quitter l’annonce', fiche.url().includes(publiee.reference))

  // React remet le formulaire à zéro dès que l'action revient : ce qui a été
  // tapé doit survivre au refus, sinon tout est à retaper.
  noter('Le nom saisi survit au refus', (await fiche.inputValue('input[name="nom"]')) === 'Sylvain Aïvodji')
  noter('…et l’adresse aussi', (await fiche.inputValue('input[name="email"]')).startsWith('banc-s8b-refus-'))

  await fiche.fill('#telephone', '0197000123')
  await fiche.click('button[type="submit"]')
  const echec = await attendreTexte(fiche, 'La création du compte a échoué')
  const texteEchec = await lu(fiche)
  noter('Un envoi d’email impossible se dit en français', echec, texteEchec.slice(-90))
  noter(
    '…sans un mot de technique',
    !/500|SMTP|Resend|GoTrue|Error sending|SQLSTATE/.test(texteEchec),
  )

  // Le déclencheur, lui, s'exerce sans passer par l'email.
  const A = await compte('candidat-a', 'Sylvain Aïvodji', 'candidat')
  const { data: profilA } = await admin
    .from('candidats')
    .select('nom, telephone')
    .eq('id', A.id)
    .maybeSingle()
  noter('`role: candidat` fabrique un profil candidat', Boolean(profilA), profilA?.nom)
  noter('…avec le nom du compte', profilA?.nom === 'Sylvain Aïvodji')
  noter('…et son téléphone', profilA?.telephone === A.telephone, profilA?.telephone)

  const { count: bailleursA } = await admin
    .from('bailleurs')
    .select('id', { count: 'exact', head: true })
    .eq('id', A.id)
  noter('Aucun profil bailleur n’est fabriqué au passage', bailleursA === 0)

  const { data: rolesA } = await A.db.rpc('mes_roles')
  noter(
    'Il se sait candidat, et rien d’autre',
    rolesA[0].est_candidat === true && rolesA[0].est_bailleur === false && rolesA[0].est_locataire === false,
  )

  // ═══ 3. Le retour depuis la vérification ═════════════════════════════════
  titre('3. Revenir de sa boîte mail')

  const candidatA = await onglet()
  await candidatA.goto(
    `${BASE}/connexion?suite=${encodeURIComponent(`/find/${publiee.reference}/candidater`)}`,
    { waitUntil: 'networkidle' },
  )
  await candidatA.fill('input[name="email"]', A.email)
  await candidatA.fill('input[name="motDePasse"]', MDP)
  await candidatA.click('button[type="submit"]')
  await candidatA.waitForURL(`**/find/${publiee.reference}/candidater`)
  noter('`suite=` ramène à l’annonce visée', candidatA.url().includes(publiee.reference))

  // Le témoin est ce que l'inscription aurait posé : on le pose, et on regarde
  // où la page de vérification propose d'aller.
  await candidatA.context().addCookies([
    {
      name: 'sikaloc_candidature',
      value: publiee.reference,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await candidatA.goto(`${BASE}/verification`, { waitUntil: 'networkidle' })
  const texteVerif = await lu(candidatA)
  noter('La vérification propose de reprendre la candidature', texteVerif.includes('Reprendre ma candidature'))
  noter(
    '…vers CETTE annonce',
    (await candidatA.locator(`a[href="/find/${publiee.reference}/candidater"]`).count()) === 1,
  )

  await candidatA.context().clearCookies({ name: 'sikaloc_candidature' })
  await candidatA.goto(`${BASE}/verification`, { waitUntil: 'networkidle' })
  const texteVerifSansTemoin = await lu(candidatA)
  noter('Sans témoin, la destination ordinaire revient', texteVerifSansTemoin.includes('Accéder à Sikaloc'))

  // ═══ 3 bis. Candidater ═══════════════════════════════════════════════════
  titre('3 bis. Envoyer sa candidature')

  await candidatA.goto(`${BASE}/find/${publiee.reference}/candidater`, { waitUntil: 'networkidle' })
  const texteFormulaire = await lu(candidatA)
  noter('Le profil déjà rempli n’est pas redemandé', !texteFormulaire.includes('Complétez votre profil'))
  noter('Il écrit son message', texteFormulaire.includes('Votre candidature'))
  noter('…prévenu d’une seule candidature par annonce', texteFormulaire.includes('une seule fois par annonce'))

  await candidatA.fill('textarea[name="message"]', 'Bonjour, je souhaite visiter cette semaine.')
  await candidatA.click('button[type="submit"]')
  await candidatA.waitForURL('**/candidater?envoyee=1')
  const texteEnvoyee = await lu(candidatA)
  noter('La candidature est confirmée', texteEnvoyee.includes('Votre candidature est envoyée'))
  noter('…avec son statut', texteEnvoyee.includes('Envoyée'))
  noter('…sans promesse de réponse', texteEnvoyee.includes('ne garantit pas de réponse'))

  // Sans `?envoyee=1` : ce que voit quelqu'un qui revient plus tard.
  await candidatA.goto(`${BASE}/find/${publiee.reference}/candidater`, { waitUntil: 'networkidle' })
  const texteRetour = await lu(candidatA)
  noter('En revenant, pas de second formulaire', !texteRetour.includes('Envoyer ma candidature'))
  noter('…mais l’état de la candidature', texteRetour.includes('Vous avez déjà candidaté'))

  const { data: cotéBase } = await admin
    .from('candidatures')
    .select('id, statut, message, candidat_id')
    .eq('annonce_id', publiee.id)
  noter('Une candidature, une seule, en base', cotéBase.length === 1)
  noter('…au nom du compte connecté', cotéBase[0]?.candidat_id === A.id)
  noter('…au statut « envoyee »', cotéBase[0]?.statut === 'envoyee')

  // ═══ 4. Ses candidatures ═════════════════════════════════════════════════
  titre('4. /me pour un candidat')

  await candidatA.goto(`${BASE}/me/candidatures`, { waitUntil: 'networkidle' })
  const texteMes = await lu(candidatA)
  noter('Il retrouve sa candidature', texteMes.includes(`Réf. ${publiee.reference}`))
  noter('…et peut corriger son profil', texteMes.includes('Mon profil'))
  noter('…sans onglets de locataire', !/Mes loyers|Mon bail|Quittances/.test(texteMes))

  await candidatA.goto(`${BASE}/me`, { waitUntil: 'networkidle' })
  await candidatA.waitForURL('**/me/candidatures')
  noter('`/me` sans bail mais candidat mène aux candidatures', candidatA.url().endsWith('/me/candidatures'))

  await candidatA.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await candidatA.waitForURL('**/me/candidatures')
  noter('Déjà connecté, la connexion ne le laisse pas sur la page de choix', candidatA.url().endsWith('/me/candidatures'))

  await candidatA.goto(`${BASE}/pro/tableau-de-bord`, { waitUntil: 'networkidle' })
  noter('L’espace du bailleur lui reste fermé', !candidatA.url().includes('/pro/tableau-de-bord'), candidatA.url())

  // ═══ 5. Un autre candidat ════════════════════════════════════════════════
  titre('5. Candidat A contre candidat B')

  const B = await compte('candidat-b', 'Firmine Gbaguidi', 'candidat')
  const envoiB = await B.db.rpc('soumettre_candidature', {
    p_reference: publiee.reference,
    p_message: 'Message de B.',
  })
  noter('B candidate à son tour', envoiB.data?.[0]?.motif === 'ok', envoiB.error?.code ?? envoiB.data?.[0]?.motif)

  const { data: listeA } = await A.db.rpc('mes_candidatures')
  noter('A ne voit que la sienne', listeA.length === 1, `${listeA.length}`)
  noter('…et rien du message de B', !JSON.stringify(listeA).includes('Message de B'))

  const { data: listeB } = await B.db.rpc('mes_candidatures')
  noter('B ne voit que la sienne', listeB.length === 1, `${listeB.length}`)

  const { data: pourLeBailleur } = await bailleur.db.rpc('candidatures_de_mes_annonces', {
    p_reference: publiee.reference,
  })
  noter('Le bailleur voit les deux', pourLeBailleur?.length === 2, `${pourLeBailleur?.length}`)
  const brut = JSON.stringify(pourLeBailleur)
  noter('…sans aucun téléphone', !brut.includes('+229') && !/telephone/.test(brut))
  noter('…sans aucun email', !brut.includes('@exemple.test') && !/email/.test(brut))
  noter('…sans identifiant de compte', !brut.includes(A.id) && !brut.includes(B.id))

  // ═══ 6. L’annonce change d’état ══════════════════════════════════════════
  titre('6. Entre l’affichage et le clic')

  const candidatB = await onglet()
  await candidatB.goto(`${BASE}/connexion?suite=${encodeURIComponent(`/find/${seconde.reference}/candidater`)}`, {
    waitUntil: 'networkidle',
  })
  await candidatB.fill('input[name="email"]', B.email)
  await candidatB.fill('input[name="motDePasse"]', MDP)
  await candidatB.click('button[type="submit"]')
  await candidatB.waitForURL(`**/find/${seconde.reference}/candidater`)

  // L'annonce est suspendue pendant qu'il écrit.
  await admin.from('annonces').update({ statut: 'suspendue' }).eq('id', seconde.id)
  await candidatB.fill('textarea[name="message"]', 'Bonjour, est-elle toujours libre ?')
  await candidatB.click('button[type="submit"]')
  const refuseSuspendue = await attendreTexte(candidatB, 'Cette annonce n’est plus disponible.')
  const texteRefus = await lu(candidatB)
  noter('Une annonce suspendue entre-temps refuse l’envoi', refuseSuspendue, texteRefus.slice(-90))
  noter(
    '…sans effacer le message déjà écrit',
    (await candidatB.inputValue('textarea[name="message"]')) === 'Bonjour, est-elle toujours libre ?',
  )
  noter(
    '…sans révéler le moindre détail technique',
    !/23505|23503|42501|candidatures|annonce_id|SQLSTATE/.test(texteRefus),
  )
  const { count: surSeconde } = await admin
    .from('candidatures')
    .select('id', { count: 'exact', head: true })
    .eq('annonce_id', seconde.id)
  noter('…et rien n’est enregistré', surSeconde === 0)

  // ═══ 7. Les locataires n’ont rien perdu ══════════════════════════════════
  titre('7. Le locataire, inchangé')

  const locataire = await compte('locataire', 'Parfait Zinsou', 'locataire')
  const { data: ligneLoc } = await admin
    .from('locataires')
    .insert({
      bailleur_id: bailleur.id,
      nom: 'Parfait Zinsou',
      telephone: '+2290196554477',
      consentement_donnees: true,
      date_consentement: new Date().toISOString().slice(0, 10),
      compte_id: locataire.id,
      compte_lie_le: new Date().toISOString(),
    })
    .select('id')
    .single()
  noter('Un locataire rattaché existe', Boolean(ligneLoc?.id))

  const pageLoc = await onglet()
  await pageLoc.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await pageLoc.fill('input[name="email"]', locataire.email)
  await pageLoc.fill('input[name="motDePasse"]', MDP)
  await pageLoc.click('button[type="submit"]')
  await pageLoc.waitForURL('**/me/**', { timeout: 15000 }).catch(() => {})
  noter(
    'Un locataire sans bail voit toujours l’explication de l’invitation',
    pageLoc.url().includes('/me/rejoindre'),
    pageLoc.url(),
  )
  noter('…et surtout pas les candidatures', !pageLoc.url().includes('/me/candidatures'))

  const { data: rolesLoc } = await locataire.db.rpc('mes_roles')
  noter('Il est locataire, pas candidat', rolesLoc[0].est_locataire === true && rolesLoc[0].est_candidat === false)

  const pagePro = await onglet()
  await pagePro.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await pagePro.fill('input[name="email"]', bailleur.email)
  await pagePro.fill('input[name="motDePasse"]', MDP)
  await pagePro.click('button[type="submit"]')
  await pagePro.waitForURL('**/pro/**', { timeout: 15000 }).catch(() => {})
  noter('Un bailleur va toujours à son tableau de bord', pagePro.url().includes('/pro/tableau-de-bord'), pagePro.url())

  // ═══ 8. Le visiteur anonyme ══════════════════════════════════════════════
  titre('8. Sans compte, rien')

  const anonyme = await onglet()
  await anonyme.goto(`${BASE}/me/candidatures`, { waitUntil: 'networkidle' })
  noter('`/me/candidatures` réclame une session', anonyme.url().includes('/connexion'), anonyme.url())
  noter('…en gardant la destination', anonyme.url().includes('suite='))

  const visiteurDb = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  const { data: rienDuTout, error: erreurAnon } = await visiteurDb.rpc('mes_candidatures')
  noter('`mes_candidatures` ne rend rien à un anonyme', erreurAnon !== null || (rienDuTout ?? []).length === 0)
  const { data: lignesBrutes } = await visiteurDb.from('candidatures').select('id')
  noter('La table reste fermée', (lignesBrutes ?? []).length === 0)
  const { data: candidatsBruts } = await visiteurDb.from('candidats').select('id')
  noter('Les profils candidats aussi', (candidatsBruts ?? []).length === 0)

  const catalogue = await onglet()
  await catalogue.goto(`${BASE}/find`, { waitUntil: 'networkidle' })
  const texteCatalogue = await lu(catalogue)
  noter('Le catalogue public ne parle de personne', !texteCatalogue.includes('Sylvain') && !texteCatalogue.includes('Firmine'))

  await navigateur.close()

  // ─── Ménage ──────────────────────────────────────────────────────────────
  for (const id of comptes) {
    const { data: dossiers } = await admin.storage.from('annonces').list(id, { limit: 100 })
    for (const dossier of dossiers ?? []) {
      const { data: f } = await admin.storage.from('annonces').list(`${id}/${dossier.name}`)
      if (f?.length) {
        await admin.storage.from('annonces').remove(f.map((x) => `${id}/${dossier.name}/${x.name}`))
      }
    }
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) console.log(`  (ménage) compte ${id} non supprimé : ${error.message}`)
  }

  const reussies = etapes.filter(Boolean).length
  console.log(`\n${reussies}/${etapes.length} vérifications passent\n`)
  process.exit(reussies === etapes.length ? 0 : 1)
})().catch(async (e) => {
  console.error(e)
  // Ménage garanti : même quand le corps lève, les comptes créés partent,
  // pour qu'un banc interrompu ne laisse pas de fausse régression derrière lui.
  await rangerComptes(admin, comptes)
  process.exit(1)
})
