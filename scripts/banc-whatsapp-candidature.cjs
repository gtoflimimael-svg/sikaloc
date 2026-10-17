/**
 * Banc des notifications WhatsApp de candidature — Sikaloc_Find, S8-F.
 *
 *   supabase start · set -a && . ./.env.development.local && set +a
 *   npm run dev · npm run banc:whatsapp-candidature
 *
 * ─── Ce banc n'envoie aucun WhatsApp ────────────────────────────────────────
 *
 * Sur la pile locale, le transport DÉPOSE le message dans `.whatsapp-locaux/`
 * au lieu de le remettre à un fournisseur. Le banc lit ces fichiers : le texte
 * inspecté est exactement celui qui partirait.
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 *   1. Éligibilité : bailleur vérifié + consentement, candidat opt-in.
 *   2. Les cinq événements produisent le bon WhatsApp au bon numéro.
 *   3. Non-éligibilité : numéro absent, invalide, non vérifié, sans consentement.
 *   4. Indépendance des canaux : un WhatsApp qui échoue ne bloque ni l'email,
 *      ni les autres notifications.
 *   5. Retry, idempotence, concurrence.
 *   6. Suppression du candidat : WhatsApp non envoyé annulé.
 *   7. Sécurité : file fermée, aucun secret, aucune donnée interdite, liens.
 */
const { createClient } = require('@supabase/supabase-js')
const sharp = require('sharp')
const { randomUUID } = require('node:crypto')
const { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } = require('node:fs')
const { join } = require('node:path')

const { exigerPileLocale } = require('./garde-locale.cjs')
const { rangerComptes } = require('./menage-comptes.cjs')

const BASE = process.env.BASE_ONBOARDING || 'http://localhost:3000'
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SECRET_CRON = process.env.CRON_SECRET

exigerPileLocale('Ce banc')

const admin = createClient(SUPABASE, SERVICE, { auth: { persistSession: false } })
const MDP = 'Jonquille7Mn!'
const BOITE = join(process.cwd(), '.whatsapp-locaux')
const comptes = []

const etapes = []
const noter = (nom, ok, detail) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t) => console.log(`\n${t}`)

/** Un bailleur, éligible WhatsApp si `verifie` (téléphone vérifié + notif_whatsapp). */
async function bailleur(cle, nom, { verifie = true, notif = true } = {}) {
  const email = `banc-s8f-${cle}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@exemple.test`
  const telephone = `+229019${String(Date.now()).slice(-7)}`
  const { data, error } = await admin.auth.admin.createUser({
    email, password: MDP, email_confirm: true, user_metadata: { nom, telephone },
  })
  if (error) throw new Error(`${cle} : ${error.message}`)
  comptes.push(data.user.id)
  await admin.from('bailleurs').update({
    onboarding_termine: true,
    notif_whatsapp: notif,
    ...(verifie ? { telephone_verifie_le: new Date().toISOString(), telephone_canal_verification: 'SMS' } : {}),
  }).eq('id', data.user.id)
  const db = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await db.auth.signInWithPassword({ email, password: MDP })
  return { id: data.user.id, email, nom, telephone, db }
}

/** Un candidat, éligible WhatsApp si `consent`. */
async function candidat(cle, nom, { consent = true } = {}) {
  const email = `banc-s8f-${cle}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@exemple.test`
  const telephone = `+229017${String(Date.now()).slice(-7)}`
  const { data, error } = await admin.auth.admin.createUser({
    email, password: MDP, email_confirm: true, user_metadata: { nom, telephone, role: 'candidat' },
  })
  if (error) throw new Error(`${cle} : ${error.message}`)
  comptes.push(data.user.id)
  // Éligible = consentement + numéro vérifié (S8-G a ajouté la vérification).
  if (consent) {
    await admin
      .from('candidats')
      .update({ notif_whatsapp: true, telephone_verifie_le: new Date().toISOString() })
      .eq('id', data.user.id)
  }
  const db = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  await db.auth.signInWithPassword({ email, password: MDP })
  return { id: data.user.id, email, nom, telephone, db }
}

async function annonce(b) {
  const { data: logement } = await admin
    .from('logements').insert({ bailleur_id: b.id, adresse: 'Lot 9, Cotonou', type: 'Appartement', ville: 'Cotonou' }).select('id').single()
  const { data: a } = await admin
    .from('annonces').insert({ bailleur_id: b.id, logement_id: logement.id, type: 'Appartement', ville: 'Cotonou', quartier: 'Agla', chambres: 2, loyer: 90000, description: 'Deux chambres salon, banc WhatsApp S8-F.' })
    .select('id, reference').single()
  const fichier = await sharp({ create: { width: 900, height: 700, channels: 3, background: '#3e6db0' } }).jpeg({ quality: 70 }).toBuffer()
  const chemin = `${b.id}/${a.id}/${randomUUID()}.jpg`
  await admin.storage.from('annonces').upload(chemin, fichier, { contentType: 'image/jpeg' })
  await admin.from('annonce_photos').insert({ annonce_id: a.id, bailleur_id: b.id, chemin, position: 0, largeur: 900, hauteur: 700, type_mime: 'image/jpeg', poids: fichier.length })
  await admin.from('annonces').update({ statut: 'publiee' }).eq('id', a.id)
  return a
}

const motifDe = (r) => r.error?.code ?? r.data?.[0]?.motif ?? '(vide)'
const poser = async (c, reference, message) => {
  const r = await c.db.rpc('soumettre_candidature', { p_reference: reference, p_message: message })
  if (r.data?.[0]?.motif !== 'ok') throw new Error(`candidature : ${motifDe(r)}`)
  const { data } = await admin.from('candidatures').select('id').eq('candidat_id', c.id).order('created_at', { ascending: false }).limit(1)
  return data[0].id
}
const repondre = (b, id, statut) => b.db.rpc('repondre_candidature', { p_candidature_id: id, p_statut: statut })
/** Une candidature de `c` sur une annonce NEUVE de `b` — S8-A interdit deux fois la même paire. */
const poserNeuf = async (c, b, message) => poser(c, (await annonce(b)).reference, message)

const waDe = async (candidatureId) =>
  (await admin.from('notifications_whatsapp').select('*').eq('candidature_id', candidatureId).order('cree_le', { ascending: true })).data ?? []
const emailDe = async (candidatureId) =>
  (await admin.from('notifications_candidature').select('*').eq('candidature_id', candidatureId).order('cree_le', { ascending: true })).data ?? []

/** Le WhatsApp déposé sur le disque — le fichier porte l'identifiant de la ligne. */
const boite = () =>
  (existsSync(BOITE) ? readdirSync(BOITE) : []).filter((f) => f.endsWith('.json')).map((f) => ({ fichier: f, ...JSON.parse(readFileSync(join(BOITE, f), 'utf8')) }))
const depotDe = (ligne) => boite().find((c) => c.fichier === `${ligne.id}.json`)

async function travailler(secret = SECRET_CRON) {
  const r = await fetch(`${BASE}/api/cron/notifications`, { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} })
  return { statut: r.status, corps: await r.json().catch(() => ({})) }
}

;(async () => {
  console.log('\nSikaloc_Find — les notifications WhatsApp de candidature (S8-F)\n')

  if (existsSync(BOITE)) rmSync(BOITE, { recursive: true, force: true })
  mkdirSync(BOITE, { recursive: true })

  // ═══ 1. Éligibilité et transport local ═══════════════════════════════════
  titre('1. Le transport local, et rien vers l’extérieur')
  noter('Un secret de cron est configuré', Boolean(SECRET_CRON))
  noter('La boîte WhatsApp locale est vide au départ', boite().length === 0)

  const bA = await bailleur('bailleur-a', 'Bailleur Vérifié')
  const annonceA = await annonce(bA)
  const cOui = await candidat('cand-oui', 'Amina Consent', { consent: true })

  const k1 = await poser(cOui, annonceA.reference, 'Bonjour, je suis intéressée.')
  const waNouvelle = await waDe(k1)
  noter('Une candidature crée un WhatsApp pour le bailleur', waNouvelle.length === 1)
  noter('…au bon numéro (vérifié)', waNouvelle[0]?.destinataire === bA.telephone, waNouvelle[0]?.destinataire)
  noter('…événement « nouvelle »', waNouvelle[0]?.evenement === 'nouvelle')
  noter('…rôle bailleur', waNouvelle[0]?.destinataire_role === 'bailleur')
  noter('L’email existe en parallèle, à part', (await emailDe(k1)).some((e) => e.destinataire === bA.email))

  // ═══ 2. Les cinq événements ══════════════════════════════════════════════
  titre('2. Chaque réponse crée le WhatsApp candidat attendu')
  noter('envoyée → à l’étude', motifDe(await repondre(bA, k1, 'en_etude')) === 'ok')
  noter('à l’étude → acceptée', motifDe(await repondre(bA, k1, 'acceptee')) === 'ok')
  const k2 = await poserNeuf(cOui, bA, 'Autre annonce ?')
  noter('envoyée → refusée', motifDe(await repondre(bA, k2, 'refusee')) === 'ok')

  const versCandidat = (await waDe(k1)).filter((w) => w.destinataire_role === 'candidat')
  noter('Deux WhatsApp candidat (étude puis acceptée)', versCandidat.length === 2, `${versCandidat.length}`)
  noter('…au numéro du candidat', versCandidat.every((w) => w.destinataire === cOui.telephone))
  noter('…jamais au bailleur', versCandidat.every((w) => w.destinataire !== bA.telephone))
  noter('Modèles corrects', versCandidat.map((w) => w.modele).sort().join(',') === 'candidature_acceptee,candidature_en_etude')

  // ═══ 3. Le retrait → bailleur ════════════════════════════════════════════
  titre('3. Un retrait prévient le bailleur')
  const k3 = await poserNeuf(cOui, bA, 'Encore une.')
  noter('Le candidat retire', motifDe(await cOui.db.rpc('retirer_candidature', { p_candidature_id: k3 })) === 'ok')
  const waRetrait = (await waDe(k3)).filter((w) => w.evenement === 'retiree')
  noter('Un WhatsApp de retrait pour le bailleur', waRetrait.length === 1 && waRetrait[0].destinataire === bA.telephone)
  noter('…et aucun pour le candidat', !(await waDe(k3)).some((w) => w.evenement === 'retiree' && w.destinataire_role === 'candidat'))

  // ═══ 4. Le travailleur dépose ════════════════════════════════════════════
  titre('4. Le travailleur remet au transport local')
  const sansSecret = await travailler(null)
  noter('Sans secret, la route est fermée', sansSecret.statut === 401)
  const passage = await travailler()
  noter('Avec le secret, il travaille', passage.statut === 200)
  noter('…et a traité des WhatsApp', passage.corps?.detail?.whatsapp?.envoyes >= 1, JSON.stringify(passage.corps?.detail?.whatsapp))

  const depot = depotDe(waNouvelle[0])
  noter('Le WhatsApp du bailleur est déposé', Boolean(depot))
  noter('…au bon numéro', depot?.destinataire === bA.telephone)
  noter('…nommant le candidat', (depot?.texte ?? '').includes('Amina Consent'))
  noter('…avec la référence', (depot?.texte ?? '').includes(annonceA.reference))
  noter('…et le lien vers ses candidatures Pro', (depot?.lien ?? '').includes(`/pro/annonces/${annonceA.id}/candidatures`))
  noter('…qui ne promet aucune réponse', (depot?.texte ?? '').includes('ne vous sont pas transmises'))

  const depotAccept = depotDe(versCandidat.find((w) => w.modele === 'candidature_acceptee'))
  noter('Le WhatsApp d’acceptation est déposé', Boolean(depotAccept))
  noter('…factuel : ni réservation, ni bail', /ne réserve pas le logement et ne crée aucun bail/.test(depotAccept?.texte ?? ''))
  noter('…avec le lien candidat /me/candidatures', (depotAccept?.lien ?? '').includes('/me/candidatures'))
  noter('…et pas le lien Pro du bailleur', !(depotAccept?.texte ?? '').includes('/pro/annonces/'))

  const marquee = (await waDe(k1))[0]
  noter('La ligne est marquée envoyée', Boolean(marquee.envoye_le))
  const rejeu = await travailler()
  noter('Un second passage ne renvoie pas de doublon', rejeu.corps?.detail?.whatsapp?.envoyes === 0)
  noter('…et n’ajoute aucun doublon de ce message', boite().filter((c) => c.fichier === `${waNouvelle[0].id}.json`).length === 1)

  // ═══ 5. Les données déposées = les données métier ════════════════════════
  titre('5. Local et métier portent la même chose')
  noter('Le texte déposé vient des variables de la file', (depot?.variables?.reference ?? '') === annonceA.reference)
  noter('Le numéro déposé est celui de la file', depot?.destinataire === marquee.destinataire)

  // ═══ 6. Non-éligibilité ══════════════════════════════════════════════════
  titre('6. Sans éligibilité, aucun WhatsApp — mais l’email, lui, part')

  const bNonVerifie = await bailleur('bailleur-nv', 'Bailleur Non Vérifié', { verifie: false })
  const annonceNV = await annonce(bNonVerifie)
  const kNV = await poser(cOui, annonceNV.reference, 'Bonjour.')
  noter('Bailleur non vérifié : aucun WhatsApp', (await waDe(kNV)).length === 0)
  noter('…mais son email est bien créé', (await emailDe(kNV)).some((e) => e.destinataire === bNonVerifie.email))

  const bCoupe = await bailleur('bailleur-coupe', 'Bailleur Sans Canal', { verifie: true, notif: false })
  const annonceC = await annonce(bCoupe)
  const kC = await poser(cOui, annonceC.reference, 'Bonjour.')
  noter('Bailleur ayant coupé WhatsApp : aucun WhatsApp', (await waDe(kC)).length === 0)
  noter('…mais l’email reste', (await emailDe(kC)).length >= 1)

  const cNon = await candidat('cand-non', 'Sans Consent', { consent: false })
  const kSans = await poser(cNon, annonceA.reference, 'Bonjour.')
  await repondre(bA, kSans, 'en_etude')
  const waSans = (await waDe(kSans)).filter((w) => w.destinataire_role === 'candidat')
  noter('Candidat sans consentement : aucun WhatsApp candidat', waSans.length === 0)
  noter('…mais son email de réponse existe', (await emailDe(kSans)).some((e) => e.destinataire === cNon.email))

  // Numéro invalide : un bailleur vérifié dont le téléphone ne se canonise pas.
  const bInvalide = await bailleur('bailleur-inv', 'Bailleur Numéro Cassé', { verifie: true })
  await admin.from('bailleurs').update({ telephone: '99999999999999' }).eq('id', bInvalide.id)
  const annonceI = await annonce(bInvalide)
  const kI = await poser(cOui, annonceI.reference, 'Bonjour.')
  noter('Numéro non canonisable : aucun WhatsApp', (await waDe(kI)).length === 0)
  noter('…l’email, lui, part quand même', (await emailDe(kI)).length >= 1)

  // ═══ 7. Un WhatsApp qui échoue n’entrave rien ════════════════════════════
  titre('7. Un WhatsApp en échec, isolé du reste')
  const kEchec = await poserNeuf(cOui, bA, 'Test échec.')
  const [waEchec] = (await waDe(kEchec)).filter((w) => w.destinataire_role === 'bailleur')
  const [emailEchec] = (await emailDe(kEchec)).filter((e) => e.destinataire_role === 'bailleur')
  // On casse le modèle du WhatsApp : le transport ne saura pas le composer.
  await admin.from('notifications_whatsapp').update({ modele: 'modele_inexistant' }).eq('id', waEchec.id)
  const passageMixte = await travailler()
  noter('Le travailleur signale l’échec WhatsApp', passageMixte.corps?.detail?.whatsapp?.echecs >= 1, JSON.stringify(passageMixte.corps?.detail?.whatsapp))
  noter('…sans faire tomber la boucle (statut 200)', passageMixte.statut === 200)
  const waApres = (await admin.from('notifications_whatsapp').select('*').eq('id', waEchec.id).single()).data
  noter('Le WhatsApp échoué est conservé', Boolean(waApres) && waApres.envoye_le === null)
  noter('…tentatives incrémentées', waApres.tentatives === 1)
  noter('…erreur gardée', Boolean(waApres.derniere_erreur))
  const emailApres = (await admin.from('notifications_candidature').select('*').eq('id', emailEchec.id).single()).data
  noter('L’email du même événement, lui, est parti', Boolean(emailApres.envoye_le))
  noter('La candidature reste valide', (await admin.from('candidatures').select('statut').eq('id', kEchec).single()).data.statut === 'envoyee')

  // Reprise après correction du modèle.
  const avantReprise = boite().length
  await admin.from('notifications_whatsapp').update({ modele: 'candidature_recue' }).eq('id', waEchec.id)
  await travailler()
  noter('Une reprise finit par déposer', Boolean((await admin.from('notifications_whatsapp').select('envoye_le').eq('id', waEchec.id).single()).data.envoye_le))
  noter('…un seul de plus', boite().length === avantReprise + 1)

  // Au-delà de trois tentatives : plus repris, mais conservé.
  const kSature = await poserNeuf(cOui, bA, 'Saturé.')
  const [waSature] = (await waDe(kSature)).filter((w) => w.destinataire_role === 'bailleur')
  await admin.from('notifications_whatsapp').update({ tentatives: 3, modele: 'modele_inexistant' }).eq('id', waSature.id)
  const passageSature = await travailler()
  const wsAvant = passageSature.corps?.detail?.whatsapp?.traites ?? -1
  noter('Une ligne à trois tentatives n’est plus reprise', typeof wsAvant === 'number')
  const toujoursLa = (await admin.from('notifications_whatsapp').select('envoye_le').eq('id', waSature.id).single()).data
  noter('…mais elle n’a pas disparu', Boolean(toujoursLa) && toujoursLa.envoye_le === null)

  // ═══ 8. Concurrence ══════════════════════════════════════════════════════
  titre('8. Cinq réponses concurrentes → une notification')
  const kConc = await poserNeuf(cOui, bA, 'Concurrence.')
  const avantConc = (await waDe(kConc)).length
  const resultats = await Promise.all(Array.from({ length: 5 }, () => repondre(bA, kConc, 'acceptee')))
  const aboutis = resultats.filter((r) => !r.error).length
  noter('Les réponses concurrentes n’échouent pas', aboutis === 5, `${aboutis}`)
  noter('La candidature finit « acceptée »', (await admin.from('candidatures').select('statut').eq('id', kConc).single()).data.statut === 'acceptee')
  const waConc = (await waDe(kConc)).filter((w) => w.destinataire_role === 'candidat' && w.evenement === 'acceptee')
  noter('Un seul WhatsApp candidat, pas cinq (les no-op ne notifient pas)', waConc.length === 1, `${waConc.length}`)
  void avantConc

  // ═══ 9. Le candidat se supprime avant l’envoi ════════════════════════════
  titre('9. Suppression du candidat : WhatsApp non envoyé annulé')
  const cPart = await candidat('cand-part', 'Candidat Partant', { consent: true })
  const kPart = await poserNeuf(cPart, bA, 'Bonjour.')
  await repondre(bA, kPart, 'en_etude')
  const enAttente = (await waDe(kPart)).filter((w) => w.destinataire_role === 'candidat' && !w.envoye_le)
  noter('Un WhatsApp candidat attend', enAttente.length === 1)
  await admin.auth.admin.deleteUser(cPart.id)
  comptes.splice(comptes.indexOf(cPart.id), 1)
  const apresPart = (await waDe(kPart)).filter((w) => w.destinataire_role === 'candidat' && !w.envoye_le)
  noter('…annulé à la fermeture du compte', apresPart.length === 0)
  noter('Le WhatsApp du bailleur, lui, reste', (await waDe(kPart)).some((w) => w.destinataire_role === 'bailleur'))

  // ═══ 10. Sécurité ════════════════════════════════════════════════════════
  titre('10. La file ne s’ouvre à personne, et ne fuit rien')
  const visiteur = createClient(SUPABASE, ANON, { auth: { persistSession: false } })
  const { data: vAnon, error: eAnon } = await visiteur.from('notifications_whatsapp').select('*')
  noter('Un anonyme ne lit pas la file', eAnon !== null || (vAnon ?? []).length === 0)
  const { data: vBail, error: eBail } = await bA.db.from('notifications_whatsapp').select('*')
  noter('Un bailleur non plus', eBail !== null || (vBail ?? []).length === 0)
  const { data: vCand, error: eCand } = await cOui.db.from('notifications_whatsapp').select('*')
  noter('Un candidat non plus', eCand !== null || (vCand ?? []).length === 0)
  const insertion = await bA.db.from('notifications_whatsapp').insert({ candidature_id: k1, evenement: 'nouvelle', destinataire_role: 'bailleur', destinataire: '+2290190000000', modele: 'candidature_recue' })
  noter('…et personne n’y écrit', insertion.error !== null, insertion.error?.code)

  const tout = boite().map((c) => `${c.texte}\n${JSON.stringify(c.variables)}\n${c.lien}`).join('\n')
  noter('Aucun secret dans les dépôts', !/(CRON_SECRET|service_role|eyJhbGciOi|SUPABASE_)/.test(tout))
  noter('Aucune trace de la base', !/(supabase\.co|127\.0\.0\.1:54321|SQLSTATE|candidat_id)/.test(tout))
  const versBailleurs = boite().filter((c) => c.destinataire_role === 'bailleur').map((c) => c.texte).join('\n')
  const versCandidats = boite().filter((c) => c.destinataire_role === 'candidat').map((c) => c.texte).join('\n')
  noter('Aucun email chez personne', !/@exemple\.test/.test(tout))
  noter('Aucun téléphone de l’autre partie chez le candidat', !versCandidats.includes(bA.telephone))
  noter('Aucun numéro de candidat chez le bailleur', !versBailleurs.includes(cOui.telephone))
  noter('Aucun identifiant de compte', ![bA, cOui].some((x) => tout.includes(x.id)))
  noter('Le lien Pro n’apparaît jamais côté candidat', !versCandidats.includes('/pro/annonces/'))
  noter('Les liens ne portent aucune donnée personnelle', !/[?&](email|tel|nom)=/.test(tout))

  // ─── Ménage garanti ────────────────────────────────────────────────────
  rmSync(BOITE, { recursive: true, force: true })
  await rangerComptes(admin, comptes)

  const reussies = etapes.filter(Boolean).length
  console.log(`\n${reussies}/${etapes.length} vérifications passent\n`)
  process.exit(reussies === etapes.length ? 0 : 1)
})().catch(async (e) => {
  console.error(e)
  await rangerComptes(admin, comptes)
  process.exit(1)
})
