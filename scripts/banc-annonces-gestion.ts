/**
 * Banc de la gestion des annonces — Sikaloc_Find, S4.
 *
 *   supabase start · environnement pointant sur la pile LOCALE
 *   npm run banc:annonces-gestion
 *
 * ─── Ce qu'il surveille ─────────────────────────────────────────────────────
 *
 * Les fonctions qu'appellent les Server Actions de l'espace Pro
 * (`lib/annonces/gestion.ts`), avec la SESSION de vrais bailleurs :
 *
 *   1. un bailleur n'atteint jamais l'annonce d'un autre ;
 *   2. un logement n'a qu'une annonce vivante, même sous créations simultanées ;
 *   3. publier, suspendre, reprendre, clôturer suivent les règles de S1, et la
 *      vitrine de S2 suit sans délai ;
 *   4. chaque refus devient une phrase — jamais un SQLSTATE, un nom de
 *      contrainte ou un texte PostgreSQL.
 *
 * Le parcours dans le navigateur (page → action → pipeline photo) est vérifié
 * par `banc:annonces-pro`.
 */
import { createRequire } from 'node:module'
import Module from 'node:module'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import sharp from 'sharp'

import type { Database } from '../src/lib/types/database'

// `server-only` : même hook que banc-modeles-email.ts, même chargement différé.
const CHEMIN_VIDE = require.resolve('server-only').replace(/index\.js$/, 'empty.js')
const resoudre = (Module as unknown as { _resolveFilename: (...a: unknown[]) => string })
  ._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  this: unknown,
  demande: unknown,
  ...reste: unknown[]
) {
  if (demande === 'server-only') return CHEMIN_VIDE
  return resoudre.call(this, demande, ...reste)
}

const { exigerPileLocale } = createRequire(import.meta.url)('./garde-locale.cjs')

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

exigerPileLocale('Ce banc')

type Client = SupabaseClient<Database>
const admin: Client = createClient<Database>(SUPABASE, SERVICE, { auth: { persistSession: false } })
const visiteur: Client = createClient<Database>(SUPABASE, ANON, { auth: { persistSession: false } })
const MDP = 'Jonquille7Mn!'

const etapes: boolean[] = []
const noter = (nom: string, ok: boolean, detail?: string) => {
  etapes.push(ok)
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? ' — ' + detail : ''}`)
}
const titre = (t: string) => console.log(`\n${t}`)
const jour = (decalage = 0) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + decalage)
  return d.toISOString().slice(0, 10)
}

/** Chaque message rendu au bailleur est gardé, puis inspecté en fin de banc. */
const messages: string[] = []
const refuse = (nom: string, r: { ok: boolean; message?: string }, attendu: string) => {
  if (!r.ok && r.message) messages.push(r.message)
  noter(nom, !r.ok && r.message === attendu, r.ok ? 'ACCEPTÉ à tort' : r.message)
}

const comptes: string[] = []

async function creerBailleur(cle: string) {
  const email = `banc-gestion-${cle}-${Date.now()}@exemple.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: MDP,
    email_confirm: true,
    user_metadata: { nom: `Banc Gestion ${cle}`, telephone: '+2290190000012' },
  })
  if (error || !data.user) throw new Error(`${cle} : ${error?.message}`)
  comptes.push(data.user.id)
  const db = createClient<Database>(SUPABASE, ANON, { auth: { persistSession: false } })
  const { error: e } = await db.auth.signInWithPassword({ email, password: MDP })
  if (e) throw new Error(`${cle} : ${e.message}`)
  return { id: data.user.id, db }
}

async function logement(b: { id: string; db: Client }) {
  const { data, error } = await b.db
    .from('logements')
    .insert({ bailleur_id: b.id, adresse: 'Lot 9, Quartier Agla', type: 'Maison', ville: 'Cotonou' })
    .select()
    .single()
  if (error || !data) throw new Error(`logement : ${error?.message}`)
  return data
}

async function locataire(b: { id: string; db: Client }) {
  const { data, error } = await b.db
    .from('locataires')
    .insert({
      bailleur_id: b.id,
      nom: 'Locataire Banc',
      telephone: '+2290197000001',
      consentement_donnees: true,
      date_consentement: jour(),
    })
    .select()
    .single()
  if (error || !data) throw new Error(`locataire : ${error?.message}`)
  return data
}

const lire = async (id: string) =>
  (await admin.from('annonces').select('*').eq('id', id).maybeSingle()).data

const visible = async (reference: string) =>
  ((await visiteur.rpc('annonce_publiee', { p_reference: reference })).data ?? []).length === 1

;(async () => {
  const gestion = await import('../src/lib/annonces/gestion')
  const { MESSAGES_ANNONCE: M, cleErreurAnnonce } = await import('../src/lib/annonces/erreurs')
  const { deposerPhotoAnnonce, retirerPhotoAnnonce } = await import('../src/lib/annonces/depot-photos')
  const { schemaAnnonce } = await import('../src/lib/validation')

  console.log('\nSikaloc_Find — gestion des annonces dans Sikaloc_Pro (S4)\n')

  const A = await creerBailleur('a')
  const B = await creerBailleur('b')
  const ctxA = { db: A.db, stockage: admin.storage }
  const photo = new Blob([
    new Uint8Array(
      await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#6a8f4e' } })
        .jpeg()
        .toBuffer(),
    ),
  ])

  const complet = {
    ville: 'Cotonou',
    quartier: 'Agla',
    chambres: 3,
    surfaceM2: 90,
    loyer: 150000,
    charges: 0,
    depotGarantie: 300000,
    avanceMois: 3,
    equipements: ['eau_courante', 'electricite', 'parking'] as const,
    description: 'Maison trois chambres salon, cour clôturée, quartier calme.',
    disponibleLe: undefined,
  }
  const champs = { ...complet, equipements: [...complet.equipements] }

  // ═══ 1. Validation du formulaire ═════════════════════════════════════════
  titre('1. Validation serveur du formulaire')

  const valide = schemaAnnonce.safeParse({
    ville: 'Cotonou',
    quartier: '  ',
    chambres: '2',
    loyer: '85000',
    charges: '',
    equipements: ['eau_courante'],
    description: '',
    disponibleLe: '',
  })
  noter(
    'Un brouillon incomplet passe ; les champs vides deviennent « non renseignés »',
    valide.success && valide.data.quartier === undefined && valide.data.charges === undefined && valide.data.loyer === 85000,
  )
  for (const [cas, donnees] of [
    ['Loyer décimal', { ville: 'Cotonou', loyer: '85000.5' }],
    ['Loyer non numérique', { ville: 'Cotonou', loyer: 'beaucoup' }],
    ['Loyer nul', { ville: 'Cotonou', loyer: '0' }],
    ['Chambres au-delà de 20', { ville: 'Cotonou', chambres: '21' }],
    ['Avance au-delà de 24 mois', { ville: 'Cotonou', avanceMois: '25' }],
    ['Équipement inconnu', { ville: 'Cotonou', equipements: ['piscine'] }],
    ['Description trop courte', { ville: 'Cotonou', description: 'Joli.' }],
    ['Date mal formée', { ville: 'Cotonou', disponibleLe: '12/10/2026' }],
    ['Ville absente', { ville: '' }],
  ] as const) {
    noter(`${cas} : refusé`, !schemaAnnonce.safeParse(donnees).success)
  }

  // ═══ 2. Création ═════════════════════════════════════════════════════════
  titre('2. Création d’un brouillon')

  const lA = await logement(A)
  const lB = await logement(B)

  const cree = await gestion.creerBrouillon(A.db, lA.id)
  const brouillon = cree.ok ? await lire(cree.id) : null
  noter(
    'Brouillon créé, au nom de la session, type et ville recopiés du logement',
    cree.ok && !cree.existante && brouillon?.statut === 'brouillon' && brouillon.bailleur_id === A.id &&
      brouillon.type === 'Maison' && brouillon.ville === 'Cotonou',
  )
  const encore = await gestion.creerBrouillon(A.db, lA.id)
  noter('Même logement : l’annonce existante est rendue, pas une seconde', encore.ok && encore.existante && cree.ok && encore.id === cree.id)
  refuse('Logement de B : introuvable', await gestion.creerBrouillon(A.db, lB.id), M.logement_introuvable)
  refuse('Identifiant qui n’en est pas un', await gestion.creerBrouillon(A.db, 'x; drop table'), M.logement_introuvable)
  refuse('Sans session', await gestion.creerBrouillon(visiteur, lA.id), M.non_autorise)

  const lConc = await logement(A)
  const simultanees = await Promise.all(Array.from({ length: 6 }, () => gestion.creerBrouillon(A.db, lConc.id)))
  const ids = new Set(simultanees.map((r) => (r.ok ? r.id : 'refus')))
  const { data: vivantesConc } = await admin.from('annonces').select('id').eq('logement_id', lConc.id)
  noter(
    'Six créations simultanées : une seule annonce, la même pour toutes',
    simultanees.every((r) => r.ok) && ids.size === 1 && vivantesConc?.length === 1,
    `${vivantesConc?.length} ligne(s)`,
  )

  // ═══ 3. Propriété ════════════════════════════════════════════════════════
  titre('3. Un bailleur n’atteint pas l’annonce d’un autre')

  const creeB = await gestion.creerBrouillon(B.db, lB.id)
  if (!creeB.ok) throw new Error('brouillon B')
  await gestion.modifierAnnonce(B.db, creeB.id, champs)
  const photoB = await deposerPhotoAnnonce({ db: B.db, stockage: admin.storage }, creeB.id, photo)

  const { data: vuesParA } = await A.db.from('annonces').select('id').eq('bailleur_id', B.id)
  noter('A ne voit pas les annonces de B', (vuesParA ?? []).length === 0)
  refuse('A ne modifie pas l’annonce de B', await gestion.modifierAnnonce(A.db, creeB.id, { ...champs, loyer: 1 }), M.introuvable)
  refuse('A ne publie pas l’annonce de B', await gestion.changerStatut(A.db, creeB.id, 'publier'), M.introuvable)
  refuse('A ne clôture pas l’annonce de B', await gestion.cloturerAnnonce(A.db, creeB.id, 'retiree'), M.introuvable)
  refuse(
    'A ne supprime pas le brouillon de B',
    await gestion.supprimerBrouillon(ctxA, creeB.id),
    M.introuvable,
  )
  const retraitParA = photoB.ok ? await retirerPhotoAnnonce(ctxA, photoB.photo.id) : { ok: true }
  noter('A ne retire pas une photo de B', !retraitParA.ok)
  const intacte = await lire(creeB.id)
  noter('L’annonce de B est intacte', intacte?.statut === 'brouillon' && intacte.loyer === 150000)

  // ═══ 4. Publication ══════════════════════════════════════════════════════
  titre('4. Publication')

  if (!cree.ok) throw new Error('brouillon A')
  const idA = cree.id
  refuse('Sans photo : refus', await gestion.changerStatut(A.db, idA, 'publier'), M.sans_photo)
  await deposerPhotoAnnonce(ctxA, idA, photo)
  refuse('Incomplète : refus', await gestion.changerStatut(A.db, idA, 'publier'), M.incomplete)

  const modif = await gestion.modifierAnnonce(A.db, idA, champs)
  const enregistree = await lire(idA)
  noter(
    'Les champs s’enregistrent, montants entiers',
    modif.ok && enregistree?.loyer === 150000 && enregistree.depot_garantie === 300000 &&
      Number.isInteger(enregistree.loyer) && enregistree.equipements.length === 3,
  )
  const publication = await gestion.changerStatut(A.db, idA, 'publier')
  const apres = await lire(idA)
  noter('Complète et avec photo : publiée', publication.ok && apres?.statut === 'publiee')
  noter('…visible par la vitrine publique (S2)', await visible(apres!.reference))
  refuse('Publier deux fois : refus', await gestion.changerStatut(A.db, idA, 'publier'), M.statut_change)

  refuse(
    'Publiée, quartier effacé : la base refuse',
    await gestion.modifierAnnonce(A.db, idA, { ...champs, quartier: undefined }),
    M.incomplete,
  )
  noter('…et l’annonce garde son quartier', (await lire(idA))?.quartier === 'Agla')

  const loc = await locataire(A)
  const lLoue = await logement(A)
  await A.db.from('baux').insert({
    bailleur_id: A.id,
    logement_id: lLoue.id,
    locataire_id: loc.id,
    loyer_mensuel: 90000,
    date_debut: jour(-90),
    jour_echeance: 5,
  })
  const loue = await gestion.creerBrouillon(A.db, lLoue.id)
  if (!loue.ok) throw new Error('brouillon loué')
  await gestion.modifierAnnonce(A.db, loue.id, champs)
  await deposerPhotoAnnonce(ctxA, loue.id, photo)
  refuse('Bail actif sans date de fin : refus', await gestion.changerStatut(A.db, loue.id, 'publier'), M.bail_actif)

  const lPreavis = await logement(A)
  const { data: bailPreavis } = await A.db
    .from('baux')
    .insert({
      bailleur_id: A.id,
      logement_id: lPreavis.id,
      locataire_id: loc.id,
      loyer_mensuel: 90000,
      date_debut: jour(-90),
      date_fin: jour(30),
      jour_echeance: 5,
    })
    .select()
    .single()
  const preavis = await gestion.creerBrouillon(A.db, lPreavis.id)
  if (!preavis.ok || !bailPreavis) throw new Error('préavis')
  await gestion.modifierAnnonce(A.db, preavis.id, { ...champs, disponibleLe: jour(10) })
  await deposerPhotoAnnonce(ctxA, preavis.id, photo)
  refuse(
    'Préavis : disponible avant la fin du bail — refus',
    await gestion.changerStatut(A.db, preavis.id, 'publier'),
    M.bail_actif,
  )
  await gestion.modifierAnnonce(A.db, preavis.id, { ...champs, disponibleLe: jour(31) })
  noter('Préavis : disponible après la fin du bail — publiée', (await gestion.changerStatut(A.db, preavis.id, 'publier')).ok)
  refuse(
    'Publiée : avancer la disponibilité avant la fin du bail est refusé',
    await gestion.modifierAnnonce(A.db, preavis.id, { ...champs, disponibleLe: jour(5) }),
    M.bail_actif,
  )

  // ═══ 5. Suspension et reprise ═════════════════════════════════════════════
  titre('5. Suspension et reprise')

  const refA = (await lire(idA))!.reference
  noter('Publiée → suspendue', (await gestion.changerStatut(A.db, idA, 'suspendre')).ok && (await lire(idA))?.statut === 'suspendue')
  noter('…invisible dans la vitrine', !(await visible(refA)))
  const cat = (await visiteur.rpc('annonces_publiees', { p_limite: 48 })).data ?? []
  noter('…absente du catalogue', !cat.some((l) => l.reference === refA))
  noter('…photos et référence conservées', (await lire(idA))?.reference === refA && ((await admin.from('annonce_photos').select('id').eq('annonce_id', idA)).data ?? []).length === 1)
  refuse('Suspendre deux fois : refus', await gestion.changerStatut(A.db, idA, 'suspendre'), M.statut_change)
  noter('Suspendue → publiée', (await gestion.changerStatut(A.db, idA, 'reprendre')).ok && (await visible(refA)))

  // Reprise devenue impossible : le bail en cours a été prolongé entre-temps.
  await gestion.changerStatut(A.db, preavis.id, 'suspendre')
  await A.db.from('baux').update({ date_fin: jour(90) }).eq('id', bailPreavis.id)
  refuse('Reprise quand le bail a été prolongé : refus', await gestion.changerStatut(A.db, preavis.id, 'reprendre'), M.bail_actif)
  noter('…l’annonce reste suspendue', (await lire(preavis.id))?.statut === 'suspendue')

  // ═══ 6. Clôture ══════════════════════════════════════════════════════════
  titre('6. Clôture')

  const lClot = await logement(A)
  const clot = await gestion.creerBrouillon(A.db, lClot.id)
  if (!clot.ok) throw new Error('clôture')
  refuse('Un brouillon ne se clôture pas', await gestion.cloturerAnnonce(A.db, clot.id, 'retiree'), M.brouillon_non_cloturable)
  await gestion.modifierAnnonce(A.db, clot.id, champs)
  await deposerPhotoAnnonce(ctxA, clot.id, photo)
  await gestion.changerStatut(A.db, clot.id, 'publier')
  const refClot = (await lire(clot.id))!.reference
  refuse(
    'Motif réservé à S9 (louée via Sikaloc) : refus',
    await gestion.cloturerAnnonce(A.db, clot.id, 'louee_sikaloc' as never),
    M.echec,
  )
  const cloture = await gestion.cloturerAnnonce(A.db, clot.id, 'louee_ailleurs')
  const apresClot = await lire(clot.id)
  noter('Publiée → clôturée, motif « louée »', cloture.ok && apresClot?.statut === 'cloturee' && apresClot.motif_cloture === 'louee_ailleurs')
  noter('…invisible dans la vitrine', !(await visible(refClot)))
  refuse('Clôturée : ne se modifie plus', await gestion.modifierAnnonce(A.db, clot.id, champs), M.cloturee)
  refuse('Clôturée : ne se republie pas', await gestion.changerStatut(A.db, clot.id, 'reprendre'), M.cloturee)
  const nouvelle = await gestion.creerBrouillon(A.db, lClot.id)
  noter('Le logement accueille une nouvelle annonce', nouvelle.ok && !nouvelle.existante && nouvelle.id !== clot.id)

  // Suspendue → clôturée, motif « retirée ».
  const retrait = await gestion.cloturerAnnonce(A.db, preavis.id, 'retiree')
  noter('Suspendue → clôturée, motif « retirée »', retrait.ok && (await lire(preavis.id))?.motif_cloture === 'retiree')

  // ═══ 7. Suppression d'un brouillon ═══════════════════════════════════════
  titre('7. Suppression d’un brouillon')

  const lSup = await logement(A)
  const sup = await gestion.creerBrouillon(A.db, lSup.id)
  if (!sup.ok) throw new Error('suppression')
  const photoSup = await deposerPhotoAnnonce(ctxA, sup.id, photo)
  const chemin = photoSup.ok ? photoSup.photo.chemin : ''
  const suppression = await gestion.supprimerBrouillon(ctxA, sup.id)
  const { data: fichiers } = await admin.storage.from('annonces').list(`${A.id}/${sup.id}`)
  noter('Brouillon supprimé', suppression.ok && (await lire(sup.id)) === null)
  noter('…ses photos aussi, lignes ET fichiers', (fichiers ?? []).length === 0 && chemin !== '')
  refuse('Une annonce publiée ne se supprime pas', await gestion.supprimerBrouillon(ctxA, idA), M.suppression_publiee)

  // ═══ 8. Clôture automatique ═════════════════════════════════════════════
  titre('8. Un bail qui devient actif clôture l’annonce')

  await A.db.from('baux').insert({
    bailleur_id: A.id,
    logement_id: lA.id,
    locataire_id: loc.id,
    loyer_mensuel: 150000,
    date_debut: jour(),
    jour_echeance: 5,
  })
  const auto = await lire(idA)
  noter('Annonce publiée → clôturée, motif « louée »', auto?.statut === 'cloturee' && auto.motif_cloture === 'louee_ailleurs')
  noter('…et retirée de la vitrine', !(await visible(refA)))

  // ═══ 9. Les messages ═════════════════════════════════════════════════════
  titre('9. Ce que lit le bailleur')

  noter(
    'Erreurs inconnues : un message générique, jamais le texte d’origine',
    cleErreurAnnonce({ code: 'XX000', message: 'relation "annonces" does not exist' }) === 'echec' &&
      cleErreurAnnonce(null) === 'echec',
  )
  const fuites = messages.filter((m) =>
    /violates|constraint|duplicate key|SQLSTATE|relation|\b\d{5}\b|annonces_|annonce_photos|null value|syntax/i.test(m),
  )
  noter(
    `${messages.length} refus rendus : aucun détail technique`,
    messages.length > 10 && fuites.length === 0,
    fuites.join(' | '),
  )

  // ─── Ménage ──────────────────────────────────────────────────────────────
  for (const id of comptes) {
    const { data: dossiers } = await admin.storage.from('annonces').list(id, { limit: 100 })
    for (const dossier of dossiers ?? []) {
      const { data: f } = await admin.storage.from('annonces').list(`${id}/${dossier.name}`)
      if (f?.length) await admin.storage.from('annonces').remove(f.map((x) => `${id}/${dossier.name}/${x.name}`))
    }
    await admin.from('baux').delete().eq('bailleur_id', id)
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) console.log(`  (ménage) compte ${id} non supprimé : ${error.message}`)
  }

  const reussies = etapes.filter(Boolean).length
  console.log(`\n${reussies}/${etapes.length} vérifications passent\n`)
  process.exit(reussies === etapes.length ? 0 : 1)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
