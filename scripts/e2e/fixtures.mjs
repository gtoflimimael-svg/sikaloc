// Données fictives des tests de bout en bout (QA-01).
//
// Cible EXCLUSIVE : une pile Supabase locale jetable (CI, ou pile E2E
// temporaire sur ce poste). Refus si l'URL n'est pas locale ou si la clé de
// service n'est pas celle émise par la CLI Supabase locale. Jamais la démo
// (ses comptes et données sont préservés), jamais un projet hébergé.
//
// Crée deux bailleurs (A, Gratuit, sans signature ; B, propriétaire d'un bail
// distinct) et un locataire rattaché au bail de A par la vraie RPC
// `accepter_invitation`. Écrit les identifiants dans le fichier donné.
import { createHmac, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

const [fichierSortie] = process.argv.slice(2)
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLE_ANONYME = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const CLE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET_OTP = process.env.OTP_SECRET

function refuser(message) {
  console.error(`Fixtures E2E : ${message}`)
  process.exit(2)
}

function verifierCible() {
  if (!fichierSortie || !URL_SUPABASE || !CLE_ANONYME || !CLE_SERVICE || !SECRET_OTP) {
    refuser('variables manquantes (URL, clés, OTP_SECRET, fichier de sortie)')
  }
  if (process.env.SIKALOC_E2E !== '1') refuser('intention E2E absente (SIKALOC_E2E=1)')
  const url = new URL(URL_SUPABASE)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.port === '54821') {
    refuser('cible refusée : seule une pile Supabase locale jetable est admise (jamais la démo 54821)')
  }
  let charge = {}
  try {
    charge = JSON.parse(Buffer.from(CLE_SERVICE.split('.')[1], 'base64url').toString('utf8'))
  } catch {
    refuser('clé de service illisible')
  }
  if (charge.iss !== 'supabase-demo' || charge.ref || charge.role !== 'service_role') {
    refuser('la clé de service n’est pas celle d’une pile Supabase locale')
  }
}

verifierCible()

const admin = createClient(URL_SUPABASE, CLE_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
const suffixe = randomBytes(4).toString('hex')
const motDePasse = () => `E2e-${randomBytes(12).toString('base64url')}!9`
const TELEPHONE = '+2290100000000'

function verifier(erreur, contexte) {
  if (erreur) refuser(`${contexte} : ${erreur.code ?? erreur.message ?? 'erreur'}`)
}

async function compte(cle, role, nom) {
  const email = `e2e-${cle}-${suffixe}@sikaloc-e2e.test`
  const mdp = motDePasse()
  const { data, error } = await admin.auth.admin.createUser({
    email, password: mdp, email_confirm: true,
    app_metadata: { sikaloc_e2e: true },
    user_metadata: { role, nom, telephone: TELEPHONE, ...(role === 'bailleur' ? { nb_logements: '1' } : {}) },
  })
  verifier(error, `création du compte ${cle}`)
  return { cle, id: data.user.id, email, motDePasse: mdp, nom }
}

function moisDecale(decalage) {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + decalage, 1)).toISOString().slice(0, 10)
}

async function dossierBailleur(bailleur, locataireNom, locataireEmail) {
  const { error: e1 } = await admin.from('bailleurs')
    .update({ nb_logements_declare: '1', onboarding_termine: true }).eq('id', bailleur.id)
  verifier(e1, `profil ${bailleur.cle}`)
  const { data: logement, error: e2 } = await admin.from('logements').insert({
    bailleur_id: bailleur.id, adresse: `Adresse E2E ${bailleur.cle}`, type: 'Appartement', ville: 'Cotonou', pays: 'Bénin',
  }).select('id').single()
  verifier(e2, `logement ${bailleur.cle}`)
  const { data: locataire, error: e3 } = await admin.from('locataires').insert({
    bailleur_id: bailleur.id, nom: locataireNom, telephone: TELEPHONE, email: locataireEmail,
    consentement_donnees: true, date_consentement: new Date().toISOString().slice(0, 10),
  }).select('id').single()
  verifier(e3, `locataire ${bailleur.cle}`)
  const { data: bail, error: e4 } = await admin.from('baux').insert({
    bailleur_id: bailleur.id, logement_id: logement.id, locataire_id: locataire.id,
    loyer_mensuel: 100000, date_debut: moisDecale(-2), jour_echeance: 5, tolerance_jours: 5, statut: 'Actif',
  }).select('id').single()
  verifier(e4, `bail ${bailleur.cle}`)
  return { logementId: logement.id, locataireId: locataire.id, bailId: bail.id }
}

async function rattacherLocataire(bailleur, dossier, me) {
  const jeton = randomBytes(32).toString('base64url')
  const empreinte = createHmac('sha256', SECRET_OTP).update(jeton).digest('hex')
  const { error } = await admin.from('invitations_locataire').insert({
    locataire_id: dossier.locataireId, bailleur_id: bailleur.id, email: me.email, empreinte,
    expire_le: new Date(Date.now() + 7 * 86400_000).toISOString(), cree_par: bailleur.id,
  })
  verifier(error, 'invitation')
  const session = createClient(URL_SUPABASE, CLE_ANONYME, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: e1 } = await session.auth.signInWithPassword({ email: me.email, password: me.motDePasse })
  verifier(e1, 'connexion du locataire')
  const { data, error: e2 } = await session.rpc('accepter_invitation', { p_empreinte: empreinte })
  verifier(e2, 'acceptation de l’invitation')
  const resultat = Array.isArray(data) ? data[0] : data
  if (resultat?.motif !== 'ok') refuser(`invitation non acceptée (${resultat?.motif ?? 'réponse inattendue'})`)
}

// Essais de connexion des exécutions précédentes (même pile, même IP) : sans
// cette purge, la limite de 30 échecs par IP (SEC-03) bloquerait les relances.
const { error: erreurPurge } = await admin.from('tentatives_connexion').delete().like('email', '%@sikaloc-e2e.test')
verifier(erreurPurge, 'purge des essais de connexion E2E')

const proA = await compte('pro-a', 'bailleur', 'Bailleur E2E A')
const proB = await compte('pro-b', 'bailleur', 'Bailleur E2E B')
const me = await compte('me', 'locataire', 'Locataire E2E')
const dossierA = await dossierBailleur(proA, me.nom, me.email)
const dossierB = await dossierBailleur(proB, 'Locataire de B', `autre-${suffixe}@sikaloc-e2e.test`)
await rattacherLocataire(proA, dossierA, me)

writeFileSync(fichierSortie, `${JSON.stringify({ proA, proB, me, dossierA, dossierB }, null, 2)}\n`, { mode: 0o600 })
console.log(`Fixtures E2E prêtes (suffixe ${suffixe}) : 3 comptes fictifs, 2 bailleurs, 1 locataire rattaché.`)
