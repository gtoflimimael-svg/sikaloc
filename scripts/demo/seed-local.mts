// Seed idempotent des seules fixtures locales Sikaloc Demo.
// Les paiements et leurs PDF passent par les RPC métier et le template PDF officiel.
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { chmod, lstat, readFile, rename, writeFile } from 'node:fs/promises'

import { Font, renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import { createElement } from 'react'

import { DocumentQuittance, type DonneesQuittance } from '../../src/lib/pdf/document-quittance'
import { enregistrerPolicesPdf } from '../../src/lib/pdf/polices'
import type { TypePaiement } from '../../src/lib/types/database'

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLE_ANONYME = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const CLE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const FICHIER_PRIVE = process.env.SIKALOC_DEMO_CREDENTIALS_FILE
const FICHIER_ACCES = process.env.SIKALOC_DEMO_ACCESS_FILE
const PROJECT_ID_ATTENDU = process.env.SIKALOC_DEMO_EXPECTED_PROJECT_ID
const MODE = process.env.SIKALOC_DEMO_MODE ?? 'initial'
const NETTOYAGE_TRANSACTIONNEL_CONFIRME = process.env.SIKALOC_DEMO_REBUILD_CLEANUP === '1'
const MARQUEUR_DEMO = 'sikaloc-demo-v1'
const DOMAINE_EMAIL = 'sikaloc-demo.test'
const TELEPHONE_FICTIF = '+2290000000000'
const MAINTENANT = new Date()
const ISO_AUJOURDHUI = MAINTENANT.toISOString().slice(0, 10)

type RoleDemo = 'bailleur' | 'locataire'
type DefinitionCompte = {
  cle: 'pro' | 'me'
  email: string
  nom: string
  role: RoleDemo
  nbLogements?: string
}
type CompteDemo = DefinitionCompte & { id: string; motDePasse: string }
type CoffrePrive = {
  otpSecret: string
  comptes?: Record<string, { id: string; email: string; nom: string; motDePasse: string }>
}
type ObjetJson = Record<string, unknown>

function objetJson(valeur: unknown): ObjetJson | null {
  return valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur)
    ? valeur as ObjetJson
    : null
}

function texteRequis(objet: ObjetJson, cle: string, contexte: string): string {
  const valeur = objet[cle]
  if (typeof valeur !== 'string' || !valeur.trim()) {
    refuser(`champ ${contexte}.${cle} absent de l’instantané documentaire`)
  }
  return valeur
}

function typePaiementValide(valeur: unknown): valeur is TypePaiement {
  return valeur === 'Loyer' || valeur === 'Charges' || valeur === 'Dépôt de garantie'
}

const DEFINITIONS: DefinitionCompte[] = [
  { cle: 'pro', email: `bailleur@${DOMAINE_EMAIL}`, nom: 'Aïcha Kora', role: 'bailleur', nbLogements: '1' },
  { cle: 'me', email: `locataire@${DOMAINE_EMAIL}`, nom: 'Mila Adjovi', role: 'locataire' },
]

const IDS = {
  logementLoue: uuidStable('logement-loue'),
  locataire: uuidStable('locataire-principal'),
  bail: uuidStable('bail-principal'),
}


function refuser(message: string): never {
  throw new Error(message)
}

function uuidStable(cle: string): string {
  const octets = createHash('sha256').update(`${MARQUEUR_DEMO}:minimal-v2:${cle}`).digest().subarray(0, 16)
  octets[6] = (octets[6] & 0x0f) | 0x40
  octets[8] = (octets[8] & 0x3f) | 0x80
  const hex = octets.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function decoderJeton(jeton: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(jeton.split('.')[1], 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function verifierInstanceDemo(): void {
  if (
    !URL_SUPABASE || !CLE_ANONYME || !CLE_SERVICE || !FICHIER_PRIVE || !FICHIER_ACCES ||
    !PROJECT_ID_ATTENDU || process.env.SIKALOC_DEMO_LOCAL !== '1' ||
    MODE !== 'initial' && MODE !== 'rebuild' ||
    (MODE === 'rebuild') !== NETTOYAGE_TRANSACTIONNEL_CONFIRME
  ) {
    refuser('configuration locale incomplète; utilisez exclusivement npm run demo:setup, demo:seed ou demo:rebuild')
  }

  let destination: URL
  try {
    destination = new URL(URL_SUPABASE)
  } catch {
    refuser('adresse Supabase locale invalide')
  }
  if (
    !['localhost', '127.0.0.1', '::1'].includes(destination.hostname) ||
    destination.port !== '54821' || !/^sikaloc-demo-[a-f0-9]{12}$/.test(PROJECT_ID_ATTENDU)
  ) {
    refuser('la cible ne correspond pas à l’instance Supabase Demo locale réservée')
  }

  const claims = decoderJeton(CLE_SERVICE)
  if (
    !claims || claims.iss !== 'supabase-demo' || claims.ref || claims.role !== 'service_role'
  ) {
    refuser('l’émetteur de la clé n’identifie pas Supabase Demo local; aucune écriture n’a été effectuée')
  }
}

verifierInstanceDemo()
// En ESM, tsx peut charger le template .tsx via un registre CJS distinct.
// Enregistrer ici aussi garantit que le renderer exécutant le seed dispose
// bien de Manrope et Inter, sans dépendre d'un alias de module implicite.
enregistrerPolicesPdf(Font)

const admin = createClient(URL_SUPABASE!, CLE_SERVICE!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function creerClientAuthentifie() {
  return createClient(URL_SUPABASE!, CLE_ANONYME!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function nomErreur(erreur: { code?: string; message?: string } | null | undefined): string {
  if (!erreur) return ''
  const code = erreur.code ? ` (${erreur.code})` : ''
  const message = (erreur.message ?? '').replace(/\b[0-9a-f-]{36}\b/gi, '[identifiant]').slice(0, 240)
  return `${code}${message ? ` ${message}` : ''}`
}

function assurerSansErreur(erreur: { code?: string; message?: string } | null, contexte: string): void {
  if (erreur) refuser(`${contexte}${nomErreur(erreur)}`)
}

function nouveauMotDePasse(): string {
  return randomBytes(30).toString('base64url').slice(0, 32)
}

async function ecrirePrive(chemin: string, contenu: string): Promise<void> {
  const temporaire = `${chemin}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  await writeFile(temporaire, contenu, { mode: 0o600, flag: 'wx' })
  await chmod(temporaire, 0o600)
  await rename(temporaire, chemin)
  await chmod(chemin, 0o600)
}

async function lireCoffre(): Promise<CoffrePrive> {
  let info
  try {
    info = await lstat(FICHIER_PRIVE!)
  } catch {
    refuser('coffre local des accès absent; aucune donnée Auth ne sera créée')
  }
  if (info!.isSymbolicLink() || !info!.isFile()) {
    refuser('le coffre local n’est pas un fichier privé ordinaire')
  }
  await chmod(FICHIER_PRIVE!, 0o600)
  let coffre: CoffrePrive
  try {
    coffre = JSON.parse(await readFile(FICHIER_PRIVE!, 'utf8')) as CoffrePrive
  } catch {
    refuser('lecture du coffre privé impossible')
  }
  if (typeof coffre!.otpSecret !== 'string' || coffre!.otpSecret.length < 32) {
    refuser('le secret local des invitations est absent ou trop court')
  }
  coffre!.comptes ??= {}
  return coffre!
}

async function tousLesUtilisateurs() {
  const resultats = [] as Array<{
    id: string
    email?: string
    app_metadata?: Record<string, unknown>
  }>
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) refuser('lecture de la liste Auth de l’instance Demo impossible')
    resultats.push(...data.users)
    if (data.users.length < 1000) return resultats
  }
}

async function preparerCoherenceAuth(coffre: CoffrePrive): Promise<Map<'pro' | 'me', CompteDemo>> {
  const utilisateurs = await tousLesUtilisateurs()
  const emailsAttendus = new Set(DEFINITIONS.map(({ email }) => email))
  const comptesInattendus = utilisateurs.filter((utilisateur) =>
    utilisateur.app_metadata?.sikaloc_demo !== MARQUEUR_DEMO ||
    !utilisateur.email?.toLowerCase().endsWith(`@${DOMAINE_EMAIL}`) ||
    !emailsAttendus.has(utilisateur.email.toLowerCase()),
  )
  if (comptesInattendus.length > 0) {
    refuser('des comptes fictifs anciens ou non reconnus sont présents; utilisez npm run demo:rebuild pour les retirer avec confirmation')
  }

  const resultats = new Map<'pro' | 'me', CompteDemo>()
  for (const definition of DEFINITIONS) {
    const existant = utilisateurs.find((utilisateur) => utilisateur.email?.toLowerCase() === definition.email)
    const sauvegarde = coffre.comptes?.[definition.cle]
    let id = existant?.id
    let motDePasse = sauvegarde && sauvegarde.id === id ? sauvegarde.motDePasse : undefined
    const metadonnees = {
      role: definition.role,
      nom: definition.nom,
      telephone: TELEPHONE_FICTIF,
      ...(definition.nbLogements ? { nb_logements: definition.nbLogements } : {}),
    }

    if (existant) {
      if (existant.app_metadata?.sikaloc_demo !== MARQUEUR_DEMO) {
        refuser(`un compte non démonstratif possède l’adresse prévue pour ${definition.cle}; il est préservé`)
      }
      if (!motDePasse) motDePasse = nouveauMotDePasse()
      const { error } = await admin.auth.admin.updateUserById(existant.id, {
        password: motDePasse,
        email_confirm: true,
        app_metadata: { ...existant.app_metadata, sikaloc_demo: MARQUEUR_DEMO },
        user_metadata: metadonnees,
      })
      assurerSansErreur(error, `mise à jour du compte Auth local ${definition.cle} impossible`)
    } else {
      motDePasse = nouveauMotDePasse()
      const { data, error } = await admin.auth.admin.createUser({
        email: definition.email,
        password: motDePasse,
        email_confirm: true,
        app_metadata: { sikaloc_demo: MARQUEUR_DEMO },
        user_metadata: metadonnees,
      })
      assurerSansErreur(error, `création du compte Auth local ${definition.cle} impossible`)
      if (!data.user) refuser(`Auth n’a pas retourné le compte ${definition.cle}`)
      id = data.user.id
    }

    if (!id || !motDePasse) refuser(`identité Auth locale ${definition.cle} incomplète`)
    const compte: CompteDemo = { ...definition, id, motDePasse }
    resultats.set(definition.cle, compte)
    coffre.comptes![definition.cle] = {
      id,
      email: definition.email,
      nom: definition.nom,
      motDePasse,
    }
    await ecrirePrive(FICHIER_PRIVE!, `${JSON.stringify(coffre, null, 2)}\n`)
  }

  const { data: profilPro, error: erreurPro } = await admin.from('bailleurs').select('id').eq('id', resultats.get('pro')!.id).maybeSingle()
  assurerSansErreur(erreurPro, 'lecture du profil bailleur local impossible')
  if (!profilPro) refuser('le déclencheur Auth n’a pas créé le profil Pro attendu')

  const { data: profilMeBailleur, error: erreurMe } = await admin.from('bailleurs').select('id').eq('id', resultats.get('me')!.id).maybeSingle()
  assurerSansErreur(erreurMe, 'vérification du rôle Me local impossible')
  if (profilMeBailleur) refuser('le compte Me possède un profil bailleur inattendu')

  return resultats
}

async function insererSiAbsente(table: string, ligne: Record<string, unknown>, bailleurId: string) {
  const { data: existante, error: erreurLecture } = await admin
    .from(table)
    .select('id,bailleur_id')
    .eq('id', String(ligne.id))
    .maybeSingle()
  assurerSansErreur(erreurLecture, `lecture de ${table} impossible`)
  if (existante) {
    if (existante.bailleur_id !== bailleurId) refuser(`l’identifiant de fixture ${table} est déjà rattaché hors du compte Demo`)
    return
  }
  const { error } = await admin.from(table).insert(ligne)
  assurerSansErreur(error, `création de la fixture ${table} impossible`)
}

function moisDecale(decalage: number): string {
  const date = new Date(Date.UTC(MAINTENANT.getUTCFullYear(), MAINTENANT.getUTCMonth() + decalage, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function dernierJourDuMois(mois: string): number {
  const [annee, numeroMois] = mois.split('-').map(Number)
  return new Date(Date.UTC(annee, numeroMois, 0)).getUTCDate()
}

function dateFinStandardDemo(): string {
  const date = new Date(MAINTENANT)
  date.setUTCFullYear(date.getUTCFullYear() + 1)
  return date.toISOString().slice(0, 10)
}

function dateAvant(mois: string): string {
  const date = new Date(`${mois}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString()
}

async function creerSession(compte: CompteDemo) {
  const client = creerClientAuthentifie()
  const { error } = await client.auth.signInWithPassword({ email: compte.email, password: compte.motDePasse })
  assurerSansErreur(error, `connexion interne au parcours authentifié ${compte.cle} impossible`)
  return client
}

async function creerDossierMetier(comptes: Map<'pro' | 'me', CompteDemo>) {
  const pro = comptes.get('pro')!
  const me = comptes.get('me')!

  const { error: erreurProfil } = await admin.from('bailleurs').update({
    // Offre Standard réservée à cette base locale de démonstration, sans paiement.
    plan: 'Standard',
    date_fin_abonnement: dateFinStandardDemo(),
    nb_logements_declare: '1',
    onboarding_termine: true,
  }).eq('id', pro.id)
  assurerSansErreur(erreurProfil, 'préparation du profil Pro local impossible')

  await insererSiAbsente('logements', {
    id: IDS.logementLoue,
    bailleur_id: pro.id,
    adresse: 'Adresse fictive — voie des Flamboyants, Agla',
    type: 'Appartement',
    ville: 'Cotonou',
    pays: 'Bénin',
  }, pro.id)

  await insererSiAbsente('locataires', {
    id: IDS.locataire,
    bailleur_id: pro.id,
    nom: me.nom,
    telephone: TELEPHONE_FICTIF,
    email: me.email,
    consentement_donnees: true,
    date_consentement: ISO_AUJOURDHUI,
  }, pro.id)

  const debutBail = moisDecale(-2)
  await insererSiAbsente('baux', {
    id: IDS.bail,
    bailleur_id: pro.id,
    logement_id: IDS.logementLoue,
    locataire_id: IDS.locataire,
    loyer_mensuel: 120000,
    date_debut: debutBail,
    date_fin: null,
    jour_echeance: 5,
    tolerance_jours: 5,
    depot_garantie: 120000,
    statut: 'Actif',
    created_at: dateAvant(debutBail),
  }, pro.id)

  await accepterInvitationDemo(pro.id, IDS.locataire, me)
  await preparerPaiementsEtDocuments(pro, IDS.bail)
  return { debutBail }
}

async function accepterInvitationDemo(bailleurId: string, locataireId: string, compteMe: CompteDemo) {
  const { data: fiche, error: erreurFiche } = await admin
    .from('locataires')
    .select('compte_id,email')
    .eq('id', locataireId)
    .single()
  assurerSansErreur(erreurFiche, 'lecture de la fiche Me locale impossible')
  if (fiche.compte_id === compteMe.id) return
  if (fiche.compte_id) refuser('la fiche locataire est déjà liée à un autre compte; aucun rattachement ne sera remplacé')
  if (fiche.email?.toLowerCase() !== compteMe.email.toLowerCase()) {
    refuser('l’adresse du compte Me ne correspond pas au destinataire de la fiche locataire')
  }

  const secret = (await lireCoffre()).otpSecret
  const jeton = randomBytes(32).toString('base64url')
  const empreinte = createHmac('sha256', secret).update(jeton).digest('hex')
  const idInvitation = uuidStable('invitation-me')
  const invitation = {
    id: idInvitation,
    locataire_id: locataireId,
    bailleur_id: bailleurId,
    email: compteMe.email,
    empreinte,
    expire_le: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    cree_par: bailleurId,
  }
  const { error: erreurInvitation } = await admin.from('invitations_locataire').upsert(invitation, { onConflict: 'id' })
  assurerSansErreur(erreurInvitation, 'création de l’invitation synthétique locale impossible')

  // L'attachement est effectué par la même RPC authentifiée que le parcours de production.
  const sessionMe = await creerSession(compteMe)
  const { data, error } = await sessionMe.rpc('accepter_invitation', { p_empreinte: empreinte })
  assurerSansErreur(error, 'acceptation de l’invitation Me par le parcours Sikaloc impossible')
  const resultat = Array.isArray(data) ? data[0] : data
  if (resultat?.motif !== 'ok' || resultat.locataire_id !== locataireId || resultat.bailleur_id !== bailleurId) {
    refuser(`l’invitation Me n’a pas été acceptée par la RPC réelle (${resultat?.motif ?? 'réponse inattendue'})`)
  }
  await sessionMe.auth.signOut()
}

async function paiementExistant(bailId: string, periodeDebut: string, montantAttendu: number, dateAttendue: string) {
  const { data, error } = await admin.from('paiements')
    .select('id,bailleur_id,bail_id,date_paiement,montant,periode_debut,mode_paiement,type_paiement,statut')
    .eq('bail_id', bailId)
    .eq('periode_debut', periodeDebut)
    .eq('type_paiement', 'Loyer')
  assurerSansErreur(error, 'lecture du suivi financier local impossible')
  const lignes = data ?? []
  if (lignes.length > 1) refuser(`plusieurs paiements existent déjà pour la période ${periodeDebut}; aucune duplication n’a été créée`)
  if (lignes.length === 0) return null
  const paiement = lignes[0]
  if (
    Number(paiement.montant) !== montantAttendu || paiement.date_paiement !== dateAttendue ||
    paiement.mode_paiement !== 'Virement bancaire' || paiement.bailleur_id !== (await bailleurDuBail(bailId))
  ) {
    refuser(`un paiement de la période ${periodeDebut} ne correspond pas à la fixture attendue; il est préservé`)
  }
  return paiement as { id: string; statut: string }
}

async function bailleurDuBail(bailId: string): Promise<string> {
  const { data, error } = await admin.from('baux').select('bailleur_id').eq('id', bailId).single()
  assurerSansErreur(error, 'lecture du propriétaire du bail local impossible')
  return data.bailleur_id
}

async function preparerPaiementsEtDocuments(pro: CompteDemo, bailId: string): Promise<void> {
  const sessionPro = await creerSession(pro)
  const moisPrecedent2 = moisDecale(-2)
  const moisPrecedent1 = moisDecale(-1)
  const moisCourant = moisDecale(0)
  const jourCourant = Math.max(1, Math.min(31, MAINTENANT.getUTCDate()))
  const datePartielle = `${moisCourant.slice(0, 7)}-${String(Math.min(jourCourant, dernierJourDuMois(moisCourant))).padStart(2, '0')}`
  const definitions = [
    { periode: moisPrecedent2, date: `${moisPrecedent2.slice(0, 7)}-05`, montant: 120000 },
    { periode: moisPrecedent1, date: `${moisPrecedent1.slice(0, 7)}-05`, montant: 120000 },
    { periode: moisCourant, date: datePartielle, montant: 60000 },
  ]

  for (const definition of definitions) {
    let paiement = await paiementExistant(bailId, definition.periode, definition.montant, definition.date)
    if (!paiement) {
      const { data: paiementId, error } = await sessionPro.rpc('creer_paiement_brouillon', {
        p_bail_id: bailId,
        p_date_paiement: definition.date,
        p_montant: definition.montant,
        p_periode_debut: definition.periode,
        p_mode_paiement: 'Virement bancaire',
        p_type_paiement: 'Loyer',
      })
      assurerSansErreur(error, `création du brouillon de paiement (${definition.periode}) via le parcours réel impossible`)
      if (typeof paiementId !== 'string') refuser(`la RPC n’a pas retourné le paiement ${definition.periode}`)
      paiement = { id: paiementId, statut: 'Brouillon' }
    }

    const { data: documentExistant, error: erreurDocument } = await admin.from('quittances')
      .select('id,pdf_chemin,hash_sha256')
      .eq('paiement_id', paiement.id)
      .maybeSingle()
    assurerSansErreur(erreurDocument, 'lecture du document financier local impossible')
    if (paiement.statut === 'Validé' && documentExistant?.pdf_chemin && documentExistant.hash_sha256) continue

    await genererDocumentPaiement(pro.id, paiement.id, paiement.statut === 'Brouillon')
  }
  await sessionPro.auth.signOut()
}

async function genererDocumentPaiement(acteur: string, paiementId: string, valider: boolean): Promise<void> {
  const { data, error } = await admin.rpc('preparer_emission_quittance', {
    p_acteur: acteur,
    p_paiement: paiementId,
    p_valider: valider,
  })
  assurerSansErreur(error, 'préparation du document par la RPC métier Sikaloc impossible')
  const emission = objetJson(data)
  if (!emission) refuser('la RPC de préparation documentaire n’a retourné aucun instantané')
  if (emission.deja_publiee === true) return
  if (emission.en_cours) refuser('une émission PDF locale est encore en cours; attendez quelques minutes puis relancez demo:seed')
  const jeton = typeof emission.jeton === 'string' ? emission.jeton : null
  const contexte = objetJson(emission.contexte)
  const quittance = objetJson(emission.quittance)
  if (!jeton || !contexte || !quittance) refuser('réponse de génération documentaire incomplète')

  const paiement = objetJson(contexte.paiement)
  const bailleur = objetJson(contexte.bailleur)
  const locataire = objetJson(contexte.locataire)
  const logement = objetJson(contexte.logement)
  const bail = objetJson(contexte.bail)
  const finances = objetJson(contexte.finances)
  if (!paiement || !bailleur || !locataire || !logement || !bail || !finances) {
    refuser('instantané financier incomplet; aucun document n’a été publié')
  }
  const typePaiement = finances.type_paiement
  if (!typePaiementValide(typePaiement)) refuser('type de paiement absent de l’instantané documentaire')
  const datePaiement = texteRequis(finances, 'date_paiement', 'finances')
  const periodeDebut = texteRequis(finances, 'periode_debut', 'finances')
  const periodeFin = texteRequis(finances, 'periode_fin', 'finances')
  const numeroDocument = texteRequis(quittance, 'numero_document', 'quittance')

  const donnees: DonneesQuittance = {
    // L'apparence est le vrai template. Le libellé EXEMPLE rend explicites les données synthétiques.
    modeDocument: 'exemple',
    numeroDocument,
    type: quittance.type === 'Reçu' ? 'Reçu' : 'Quittance',
    dateGeneration: typeof quittance.date_generation === 'string'
      ? quittance.date_generation
      : new Date().toISOString(),
    pays: String(logement.pays ?? 'Bénin'),
    bailleurNom: String(bailleur.nom),
    bailleurTelephone: String(bailleur.telephone ?? ''),
    bailleurAdresse: bailleur.adresse ? String(bailleur.adresse) : null,
    locataireNom: String(locataire.nom),
    locataireTelephone: String(locataire.telephone ?? ''),
    logementAdresse: String(logement.adresse),
    logementVille: String(logement.ville),
    logementPays: String(logement.pays ?? 'Bénin'),
    logementType: String(logement.type),
    loyerMensuel: Number(finances.loyer_mensuel ?? bail.loyer_mensuel),
    montantExigible: typeof finances.montant_exigible === 'number'
      ? Number(finances.montant_exigible)
      : null,
    montantCumule: Number(finances.cumul_loyer),
    montantExcedentaire: Number(finances.trop_percu ?? 0),
    periodeDebut,
    periodeFin,
    montant: Number(finances.montant),
    datePaiement,
    modePaiement: String(finances.mode_paiement),
    typePaiement,
    estPartiel: typeof finances.est_partiel === 'boolean' ? finances.est_partiel : null,
    signatureDataUri: null,
    signatureLocataireDataUri: null,
    signatureBailleurEtat: 'non-apposee',
    signatureLocataireEtat: 'non-apposee',
  }
  const element = createElement(DocumentQuittance, donnees) as Parameters<typeof renderToBuffer>[0]
  const pdf = Buffer.from(await renderToBuffer(element))
  const hash = createHash('sha256').update(pdf).digest('hex')
  const cheminPdf = `${acteur}/${numeroDocument}-${jeton}.pdf`
  const { error: erreurDepot } = await admin.storage.from('quittances').upload(cheminPdf, pdf, {
    contentType: 'application/pdf',
    upsert: false,
  })
  assurerSansErreur(erreurDepot, 'archivage du PDF généré par le template officiel impossible')

  const { error: erreurPublication } = await admin.rpc('publier_emission_quittance', {
    p_acteur: acteur,
    p_paiement: paiementId,
    p_jeton: emission.jeton,
    p_hash: hash,
    p_snapshot: null,
    p_hash_signature: null,
  })
  assurerSansErreur(erreurPublication, 'publication du PDF par la transaction documentaire Sikaloc impossible')
}

async function verifierVolumes(comptes: Map<'pro' | 'me', CompteDemo>): Promise<void> {
  const utilisateurs = await tousLesUtilisateurs()
  if (utilisateurs.length !== 2 || utilisateurs.some((u) => u.app_metadata?.sikaloc_demo !== MARQUEUR_DEMO)) {
    refuser(`le nombre final de comptes Auth n’est pas exactement deux (${utilisateurs.length})`)
  }
  const pro = comptes.get('pro')!
  const me = comptes.get('me')!
  const demandes: Array<[string, string, string]> = [
    ['logements', 'bailleur_id', pro.id],
    ['locataires', 'bailleur_id', pro.id],
    ['baux', 'bailleur_id', pro.id],
    ['paiements', 'bailleur_id', pro.id],
    ['quittances', 'bailleur_id', pro.id],
  ]
  const volumes: Record<string, number> = {}
  for (const [table, colonne, compteId] of demandes) {
    const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true }).eq(colonne, compteId)
    assurerSansErreur(error, `vérification du volume final ${table} impossible`)
    volumes[table] = count ?? 0
  }
  if (
    volumes.logements !== 1 || volumes.locataires !== 1 || volumes.baux !== 1 ||
    volumes.paiements !== 3 || volumes.quittances !== 3
  ) {
    refuser(`les volumes du jeu Demo diffèrent de la configuration attendue (${JSON.stringify(volumes)})`)
  }
  const { data: lien, error } = await admin.from('locataires').select('compte_id').eq('id', IDS.locataire).single()
  assurerSansErreur(error, 'vérification du rattachement Me impossible')
  if (lien.compte_id !== me.id) refuser('le compte Me n’est pas lié par l’invitation au bail de démonstration')
  const { data: profilMeBailleur, error: erreurProfils } = await admin.from('bailleurs').select('id').eq('id', me.id).maybeSingle()
  assurerSansErreur(erreurProfils, 'vérification du rôle Me impossible')
  if (profilMeBailleur) refuser('le compte Me possède un profil bailleur inattendu')
}

function construireFicheAcces(comptes: Map<'pro' | 'me', CompteDemo>): string {
  const pro = comptes.get('pro')!
  const me = comptes.get('me')!
  return `# Accès privés — Sikaloc Demo locale\n\n` +
    `Instance isolée : Supabase local sur 127.0.0.1:54821. Données entièrement fictives.\n` +
    `Ne pas partager ce fichier : il contient des mots de passe.\n\n` +
    `## Pro — bailleur\n- Nom : ${pro.nom}\n- Email : ${pro.email}\n- Mot de passe : ${pro.motDePasse}\n- Connexion : http://localhost:3000/connexion\n- À montrer : tableau de bord, logement loué, bail, paiements et documents.\n` +
    `- Plan : Standard actif uniquement dans cette base Demo locale, sans paiement ni effet sur les autres environnements.\n\n` +
    `## Me — locataire invité\n- Nom : ${me.nom}\n- Email : ${me.email}\n- Mot de passe : ${me.motDePasse}\n- Connexion : http://localhost:3000/connexion\n- Relation : bail actif de démonstration à Cotonou, rattaché par la RPC d’acceptation d’invitation.\n\n` +
    `Téléphone des profils : valeur fictive non joignable. Les emails/SMS, paiements réels et notifications externes sont désactivés.\n`
}

async function main(): Promise<void> {
  const coffre = await lireCoffre()
  if (MODE === 'rebuild') {
    const comptesRestants = await tousLesUtilisateurs()
    if (comptesRestants.length !== 0) {
      refuser('la transaction de nettoyage Demo doit se terminer avant le peuplement; aucun compte Auth ne sera supprimé par le seed')
    }
    coffre.comptes = {}
    await ecrirePrive(FICHIER_PRIVE!, `${JSON.stringify(coffre, null, 2)}\n`)
  }
  const comptes = await preparerCoherenceAuth(coffre)
  const { debutBail } = await creerDossierMetier(comptes)
  await verifierVolumes(comptes)

  await ecrirePrive(FICHIER_PRIVE!, `${JSON.stringify(coffre, null, 2)}\n`)
  await ecrirePrive(FICHIER_ACCES!, construireFicheAcces(comptes))
  console.log('Jeu Sikaloc Demo prêt : 2 comptes Auth (Pro et Me).')
  console.log('Pro : 1 logement loué, 1 locataire, 1 bail actif, 3 paiements et 3 PDF générés par le parcours documentaire réel.')
  console.log('Plan Standard actif uniquement dans cette base Demo locale, sans paiement ni effet sur les autres environnements.')
  console.log(`Me : compte lié au bail par l’invitation et la RPC accepter_invitation; bail depuis ${debutBail}.`)
  console.log(`Identifiants privés : ${FICHIER_ACCES}; coffre local : ${FICHIER_PRIVE}. Aucun mot de passe n’est affiché.`)
}

main().catch((cause) => {
  const message = cause instanceof Error ? cause.message : 'opération de démonstration interrompue'
  console.error(`Seed local Sikaloc Demo : ${message}`)
  process.exitCode = 1
})
