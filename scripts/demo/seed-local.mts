// .mts garde ce seed en ESM afin que tsx accepte ses imports et son await.
import { createHash, randomBytes } from 'node:crypto'
import { chmod, lstat, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

import {
  CANDIDATS_DEMO,
  creerDonneesDemo,
  LOCATAIRES_DEMO,
  PROFILS_DEMO,
} from '../../src/lib/demo/donnees'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const FICHIER_PRIVE = process.env.SIKALOC_DEMO_CREDENTIALS_FILE
const ORIGINE_LOCALE = 'sikaloc-demo-v1'
const EMAIL_DOMAIN = 'sikaloc-demo.test'
const TELEPHONE_FICTIF = 'DEMO0000'
const ALPHABET_MOT_DE_PASSE = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
const COULEURS = [
  ['#B8F36D', '#17311C', '#EAF1E7'],
  ['#F2D58B', '#294536', '#F4EEE1'],
  ['#D7E6CC', '#254833', '#E7B980'],
  ['#B9D5C4', '#1E3C31', '#F2D79C'],
  ['#DCCBA6', '#263E32', '#B8F36D'],
]

function refuser(message: string): never {
  throw new Error(message)
}

function analyserJeton(jeton: string) {
  try {
    return JSON.parse(Buffer.from(jeton.split('.')[1], 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function verifierCibleLocale() {
  if (!URL || !CLE_SERVICE || !FICHIER_PRIVE) {
    refuser('configuration locale absente; relancez uniquement via npm run demo:setup ou demo:dev')
  }

  let destination: URL
  try {
    destination = new globalThis.URL(URL)
  } catch {
    refuser('adresse Supabase locale invalide')
  }
  if (
    !['localhost', '127.0.0.1', '::1'].includes(destination.hostname) ||
    destination.port !== '54821'
  ) {
    refuser('le seed refuse toute cible autre que le port Supabase local réservé à la démo')
  }

  const claims = analyserJeton(CLE_SERVICE)
  if (
    !claims || claims.iss !== 'supabase-demo' || claims.ref ||
    claims.role !== 'service_role'
  ) {
    refuser('la clé ne porte pas la signature locale attendue; aucune écriture effectuée')
  }
}

verifierCibleLocale()

const supabase = createClient(URL!, CLE_SERVICE!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const jeu = creerDonneesDemo()
const profilsPro = PROFILS_DEMO.filter((profil) => profil.role === 'pro')
const candidats = CANDIDATS_DEMO

type Compte = { id: string; email: string; motDePasse: string; nom: string; role: 'bailleur' | 'candidat' }
type CoffrePrive = { otpSecret: string; comptes?: Record<string, Omit<Compte, 'role'>> }

const definitionsComptes: Array<{
  cle: string
  email: string
  nom: string
  role: 'bailleur' | 'candidat'
  logements?: number
}> = [
  { cle: 'pro-petit', email: `pro.petit@${EMAIL_DOMAIN}`, nom: profilsPro[0].nom, role: 'bailleur', logements: 2 },
  { cle: 'pro-actif', email: `pro.actif@${EMAIL_DOMAIN}`, nom: profilsPro[1].nom, role: 'bailleur', logements: 5 },
  { cle: 'pro-gestion', email: `pro.gestion@${EMAIL_DOMAIN}`, nom: profilsPro[2].nom, role: 'bailleur', logements: 5 },
  { cle: 'find-amina', email: `candidate.amina@${EMAIL_DOMAIN}`, nom: candidats[0].nom, role: 'candidat' },
  { cle: 'find-koffi', email: `candidate.koffi@${EMAIL_DOMAIN}`, nom: candidats[1].nom, role: 'candidat' },
]

function uuidStable(cle: string): string {
  const octets = createHash('sha256').update(`${ORIGINE_LOCALE}:${cle}`).digest().subarray(0, 16)
  octets[6] = (octets[6] & 0x0f) | 0x40
  octets[8] = (octets[8] & 0x3f) | 0x80
  const hex = octets.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function nouveauMotDePasse(): string {
  const octets = randomBytes(30)
  return Array.from(octets, (octet) => ALPHABET_MOT_DE_PASSE[octet % ALPHABET_MOT_DE_PASSE.length])
    .slice(0, 24)
    .join('')
}

async function ecrireCoffre(coffre: CoffrePrive) {
  const temporaire = `${FICHIER_PRIVE}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  await writeFile(temporaire, `${JSON.stringify(coffre, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  await chmod(temporaire, 0o600)
  await rename(temporaire, FICHIER_PRIVE!)
  await chmod(FICHIER_PRIVE!, 0o600)
}

let coffre: CoffrePrive
try {
  const info = await lstat(FICHIER_PRIVE!)
  if (info.isSymbolicLink() || !info.isFile()) {
    refuser('le coffre privé n’est pas un fichier local normal; aucun secret n’a été lu')
  }
  await chmod(FICHIER_PRIVE!, 0o600)
  coffre = JSON.parse(await readFile(FICHIER_PRIVE!, 'utf8')) as CoffrePrive
} catch {
  refuser('le coffre privé local est illisible; aucun mot de passe ne sera affiché dans le terminal')
}
coffre.comptes ??= {}

async function tousLesUtilisateurs() {
  const utilisateurs = [] as Array<{ id: string; email?: string; app_metadata?: Record<string, unknown> }>
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) refuser('lecture des comptes Auth locaux impossible')
    utilisateurs.push(...data.users)
    if (data.users.length < 1000) return utilisateurs
  }
}

const cacheUtilisateurs = await tousLesUtilisateurs()
const comptes = new Map<string, Compte>()

async function obtenirOuCreerCompte(definition: (typeof definitionsComptes)[number]): Promise<Compte> {
  const existant = cacheUtilisateurs.find((utilisateur) => utilisateur.email?.toLowerCase() === definition.email)
  const sauvegarde = coffre.comptes?.[definition.cle]
  let utilisateurId: string
  let motDePasse = sauvegarde?.motDePasse

  if (existant) {
    if (existant.app_metadata?.sikaloc_demo !== ORIGINE_LOCALE) {
      refuser(`un compte local non identifié comme démonstration utilise ${definition.email}; il est préservé`)
    }
    utilisateurId = existant.id
    if (!motDePasse || sauvegarde?.id !== utilisateurId) {
      motDePasse = nouveauMotDePasse()
      const { error } = await supabase.auth.admin.updateUserById(utilisateurId, { password: motDePasse })
      if (error) refuser('renouvellement du mot de passe local impossible')
    }
  } else {
    motDePasse = nouveauMotDePasse()
    const { data, error } = await supabase.auth.admin.createUser({
      email: definition.email,
      password: motDePasse,
      email_confirm: true,
      app_metadata: { sikaloc_demo: ORIGINE_LOCALE },
      user_metadata: {
        role: definition.role,
        nom: definition.nom,
        telephone: TELEPHONE_FICTIF,
        ...(definition.logements ? { nb_logements: String(definition.logements) } : {}),
      },
    })
    if (error || !data.user) refuser('création d’un compte de démonstration dans Auth local impossible')
    utilisateurId = data.user.id
    cacheUtilisateurs.push(data.user)
  }

  const compte: Compte = {
    id: utilisateurId,
    email: definition.email,
    motDePasse: motDePasse!,
    nom: definition.nom,
    role: definition.role,
  }
  coffre.comptes![definition.cle] = {
    id: compte.id,
    email: compte.email,
    motDePasse: compte.motDePasse,
    nom: compte.nom,
  }
  await ecrireCoffre(coffre)

  const profilTable = definition.role === 'bailleur' ? 'bailleurs' : 'candidats'
  const { data: profil, error: erreurProfil } = await supabase
    .from(profilTable)
    .select('id')
    .eq('id', utilisateurId)
    .maybeSingle()
  if (erreurProfil || !profil) {
    refuser(`le déclencheur Auth n’a pas créé le profil métier attendu (${definition.role})`)
  }

  return compte
}

for (const definition of definitionsComptes) {
  comptes.set(definition.cle, await obtenirOuCreerCompte(definition))
}

const comptesPro = new Map(profilsPro.map((profil) => [
  profil.id,
  comptes.get(profil.id)!,
]))

for (const profil of profilsPro) {
  const compte = comptesPro.get(profil.id)!
  const nombreLogements = jeu.logements.filter((logement) => logement.proprietaireId === profil.id).length
  const { error } = await supabase.from('bailleurs').update({
    nb_logements_declare: nombreLogements,
    onboarding_termine: true,
  }).eq('id', compte.id)
  if (error) refuser('mise en place du profil bailleur local impossible')
}

const logementsParCle = new Map(jeu.logements.map((logement) => [logement.id, uuidStable(`logement/${logement.id}`)]))
const profilsLocataires = new Map(LOCATAIRES_DEMO.map((locataire) => [locataire.id, locataire]))
const locatairesParRelation = new Map<string, string>()
const lignesLocataires: Array<Record<string, unknown>> = []

for (const bail of jeu.baux) {
  const cleRelation = `${bail.proprietaireId}/${bail.locataireId}`
  if (locatairesParRelation.has(cleRelation)) continue
  const locataire = profilsLocataires.get(bail.locataireId)
  if (!locataire) refuser('un bail de démonstration référence un locataire absent')
  const email = `${locataire.id.replace('loc-', 'me.')}@${EMAIL_DOMAIN}`
  const id = uuidStable(`locataire/${cleRelation}`)
  locatairesParRelation.set(cleRelation, id)
  lignesLocataires.push({
    id,
    bailleur_id: comptesPro.get(bail.proprietaireId)!.id,
    nom: locataire.nom,
    telephone: TELEPHONE_FICTIF,
    email,
    consentement_donnees: true,
    date_consentement: '2026-10-01',
  })
}

async function insererLignesAbsentes(table: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return
  const ids = rows.map((row) => String(row.id))
  const { data: existantes, error: erreurLecture } = await supabase
    .from(table)
    .select('id')
    .in('id', ids)
  if (erreurLecture) refuser(`lecture préalable des lignes locales de ${table} impossible`)
  const dejaPresent = new Set((existantes ?? []).map((row: { id: string }) => row.id))
  const absentes = rows.filter((row) => !dejaPresent.has(String(row.id)))
  if (absentes.length === 0) return
  const { error } = await supabase.from(table).insert(absentes)
  if (error) refuser(`insertion des nouvelles fixtures locales dans ${table} refusée par le schéma`)
}

await insererLignesAbsentes('logements', jeu.logements.map((logement) => ({
  id: logementsParCle.get(logement.id),
  bailleur_id: comptesPro.get(logement.proprietaireId)!.id,
  adresse: `Adresse fictive — ${logement.quartier}, ${logement.ville}`,
  type: logement.type === 'Chambre' ? 'Autre' : logement.type,
  ville: logement.ville,
  pays: 'Bénin',
})))

await insererLignesAbsentes('locataires', lignesLocataires)

const bauxParCle = new Map(jeu.baux.map((bail) => [bail.id, uuidStable(`bail/${bail.id}`)]))
await insererLignesAbsentes('baux', jeu.baux.map((bail) => ({
  id: bauxParCle.get(bail.id),
  bailleur_id: comptesPro.get(bail.proprietaireId)!.id,
  logement_id: logementsParCle.get(bail.logementId),
  locataire_id: locatairesParRelation.get(`${bail.proprietaireId}/${bail.locataireId}`),
  loyer_mensuel: bail.loyer,
  date_debut: bail.debut,
  date_fin: bail.fin ?? null,
  jour_echeance: 5,
  tolerance_jours: 5,
  depot_garantie: bail.loyer,
  statut: bail.statut === 'actif' ? 'Actif' : 'Résilié',
})))

const periodesParCle = new Map(jeu.periodes.map((periode) => [periode.id, periode]))
const joursDansMois = (dateIso: string) => {
  const [annee, mois] = dateIso.split('-').map(Number)
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate()
}

const lignesPaiements = jeu.paiements.map((paiement) => {
  const periode = periodesParCle.get(paiement.periodeId)
  if (!periode) refuser('un versement de démonstration référence une période absente')
  const mois = periode.echeance.slice(0, 7)
  const dateFin = `${mois}-${String(joursDansMois(periode.echeance)).padStart(2, '0')}`
  const bail = jeu.baux.find((item) => item.id === periode.bailId)
  if (!bail) refuser('une période de démonstration référence un bail absent')

  return {
    id: uuidStable(`paiement/${paiement.id}`),
    bailleur_id: comptesPro.get(bail.proprietaireId)!.id,
    bail_id: bauxParCle.get(bail.id),
    date_paiement: paiement.date,
    montant: paiement.montant,
    periode_debut: `${mois}-01`,
    periode_fin: dateFin,
    mode_paiement: paiement.moyen.startsWith('Virement') ? 'Virement bancaire' : 'Espèces',
    type_paiement: 'Loyer',
    est_partiel: periode.statut === 'partiel',
    statut: 'Validé',
    valide_le: `${paiement.date}T12:00:00.000Z`,
  }
})
await insererLignesAbsentes('paiements', lignesPaiements)

function echapperXml(texte: string) {
  return texte.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function svgIllustration(logement: (typeof jeu.logements)[number], index: number) {
  const [accent, encre, fond] = COULEURS[index % COULEURS.length]
  const quartier = echapperXml(`${logement.quartier} · ${logement.ville}`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
    <rect width="1200" height="900" fill="${fond}"/>
    <circle cx="920" cy="170" r="105" fill="${accent}" opacity=".78"/>
    <path d="M0 685 Q270 620 505 690 T1200 655 V900 H0Z" fill="${encre}" opacity=".10"/>
    <path d="M160 640 160 400 400 270 640 400 640 640Z" fill="#fffdf6" stroke="${encre}" stroke-width="8" stroke-linejoin="round"/>
    <path d="M115 405 400 235 685 405" fill="${accent}" stroke="${encre}" stroke-width="12" stroke-linejoin="round"/>
    <rect x="215" y="445" width="105" height="120" rx="12" fill="${accent}"/>
    <rect x="475" y="445" width="105" height="120" rx="12" fill="${accent}"/>
    <rect x="355" y="475" width="95" height="165" rx="10" fill="${encre}"/>
    <path d="M700 650h320" stroke="${encre}" stroke-width="14" stroke-linecap="round" opacity=".55"/>
    <path d="M750 610c35-90 85-90 120 0m30 0c35-120 90-120 125 0" fill="none" stroke="${encre}" stroke-width="10" stroke-linecap="round" opacity=".55"/>
    <rect x="60" y="742" width="1080" height="104" rx="22" fill="#ffffff" opacity=".92"/>
    <text x="100" y="790" fill="${encre}" font-family="Arial,sans-serif" font-size="27" font-weight="700">${quartier}</text>
    <text x="100" y="824" fill="${encre}" font-family="Arial,sans-serif" font-size="17" letter-spacing="2">ILLUSTRATION · DÉMO LOCALE · BIEN FICTIF</text>
  </svg>`
}

const annoncesParLogement = new Map<string, string>()
let imagesAnnonce = 0
const logementsPublies = jeu.logements.filter((logement) => logement.statut === 'disponible' && logement.publie)

for (const [index, logement] of logementsPublies.entries()) {
  const idAnnonce = uuidStable(`annonce/${logement.id}`)
  const idPhoto = uuidStable(`photo/${logement.id}`)
  const proprietaireId = comptesPro.get(logement.proprietaireId)!.id
  const description = `DÉMONSTRATION LOCALE — annonce et logement fictifs; illustration non photographique, aucune offre réelle. ${logement.description}`
  const annonce = {
    id: idAnnonce,
    bailleur_id: proprietaireId,
    logement_id: logementsParCle.get(logement.id),
    type: logement.type === 'Chambre' ? 'Autre' : logement.type,
    ville: logement.ville,
    quartier: logement.quartier,
    chambres: logement.chambres,
    surface_m2: logement.surface,
    loyer: logement.loyer,
    charges: null,
    depot_garantie: null,
    avance_mois: null,
    equipements: logement.equipements,
    description,
    disponible_le: null,
  }
  await insererLignesAbsentes('annonces', [annonce])

  const chemin = `${proprietaireId}/${idAnnonce}/${idPhoto}.jpg`
  const jpeg = await sharp(Buffer.from(svgIllustration(logement, index)))
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer()
  const { error: erreurUpload } = await supabase.storage.from('annonces').upload(chemin, jpeg, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (erreurUpload) refuser('dépôt d’une illustration dans le stockage local impossible')

  await insererLignesAbsentes('annonce_photos', [{
    id: idPhoto,
    annonce_id: idAnnonce,
    bailleur_id: proprietaireId,
    chemin,
    position: 0,
    largeur: 1200,
    hauteur: 900,
    type_mime: 'image/jpeg',
    poids: jpeg.length,
  }])

  const { data: etatAnnonce, error: erreurEtat } = await supabase
    .from('annonces')
    .select('statut')
    .eq('id', idAnnonce)
    .single()
  if (erreurEtat) refuser('lecture de l’état d’une annonce locale impossible')

  if (etatAnnonce.statut === 'brouillon') {
    const { error } = await supabase.from('annonces').update({ statut: 'publiee' }).eq('id', idAnnonce)
    if (error) refuser('publication locale refusée; vérifier la cohérence annonce/logement/photo')
    annoncesParLogement.set(logement.id, idAnnonce)
  } else if (etatAnnonce.statut === 'publiee') {
    annoncesParLogement.set(logement.id, idAnnonce)
  }
  imagesAnnonce += 1
}

const statutsCandidature: Record<string, string> = {
  nouvelle: 'envoyee',
  a_etudier: 'en_etude',
  acceptee: 'acceptee',
  refusee: 'refusee',
}

const candidatures = jeu.candidatures.flatMap((candidature) => {
  const annonceId = annoncesParLogement.get(candidature.logementId)
  const candidat = comptes.get(candidature.candidatId)
  if (!annonceId || !candidat) return []
  const statut = statutsCandidature[candidature.statut]
  const repondue = statut === 'acceptee' || statut === 'refusee'
  return [{
    id: uuidStable(`candidature/${candidature.id}`),
    candidat_id: candidat.id,
    annonce_id: annonceId,
    statut,
    message: `DÉMONSTRATION — ${candidature.message}`,
    repondue_le: repondue ? `${candidature.date}T12:00:00.000Z` : null,
    created_at: `${candidature.date}T10:00:00.000Z`,
  }]
})
await insererLignesAbsentes('candidatures', candidatures)

console.log(
  `Jeu local prêt : ${profilsPro.length} bailleurs, ${lignesLocataires.length} fiches locataires, ` +
  `${jeu.logements.length} logements, ${jeu.baux.length} baux, ${jeu.periodes.length} périodes, ` +
  `${lignesPaiements.length} versements, ${imagesAnnonce} illustrations d’annonces, ${candidatures.length} candidatures.`,
)
console.log(`Comptes Auth bailleurs/candidats : ${definitionsComptes.length}. Accès privés : ${FICHIER_PRIVE}`)
console.log('Les locataires ne sont pas liés directement : leurs comptes Me se créent via les invitations réelles de Sikaloc.')
console.log('Aucun PDF de quittance ou de reçu n’est fabriqué; ils se génèrent depuis les parcours Pro réels.')
