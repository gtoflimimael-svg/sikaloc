#!/usr/bin/env node
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SI_TEST_REF = 'epjpcmvdvshxfsydltgf'
export const SI_TEST_URL = `https://${SI_TEST_REF}.supabase.co`

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fichiersEnvNext = [
  '.env.development.local',
  '.env.local',
  '.env.development',
  '.env',
]

const variablesControlees = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'APP_NAME',
  'FEDAPAY_PUBLIC_KEY',
  'FEDAPAY_SECRET_KEY',
  'FEDAPAY_ENV',
  'FEDAPAY_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'EMAIL_FROM_NAME',
  'CRON_SECRET',
  'EMAIL_EXPLOITATION',
  'SIKALOC_QUESTIONS_ADMIN_IDS',
  'SIKALOC_QUESTIONS_NOTIFICATIONS_ACTIVE',
  'VERIFICATION_GOOGLE',
  'VERIFICATION_BING',
  'NEXT_PUBLIC_EMAIL_OTP_LENGTH',
  'OTP_SECRET',
  'SMS_FOURNISSEUR',
  'SMS_IDENTIFIANT',
  'SMS_JETON',
  'SMS_EXPEDITEUR',
  'WHATSAPP_ID_TELEPHONE',
  'WHATSAPP_JETON',
  'NEXT_PUBLIC_WHATSAPP_SUPPORT',
  'OTP_CANAL_DEV',
  'SIKALOC_MAINTENANCE_MODE',
  'GUIDE_EMAILS_JOURNAL',
  'SIKALOC_DEMO_LOCAL',
  'SIKALOC_DEMO_EXPECTED_PROJECT_ID',
])

const integrationsSensibles =
  /(SUPABASE|DATABASE|POSTGRES|PGHOST|FEDAPAY|RESEND|SMTP|EMAIL|MAIL|SMS|WHATSAPP|OTP|CRON|SECRET|TOKEN|PASSWORD|PRIVATE|SENTRY|STRIPE|PAYMENT|SENDGRID|TWILIO|AWS_)/i

export function extraireNomsVariables(contenu) {
  return [...contenu.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)]
    .map((correspondance) => correspondance[1])
}

export function collecterNomsEnvNext(repertoire = racine) {
  const noms = new Set()

  for (const fichier of fichiersEnvNext) {
    try {
      for (const nom of extraireNomsVariables(
        readFileSync(path.join(repertoire, fichier), 'utf8'),
      )) {
        noms.add(nom)
      }
    } catch (cause) {
      if (cause?.code !== 'ENOENT') throw cause
    }
  }

  return [...noms].sort()
}

function lireClaimsJwt(cle) {
  const segments = cle.split('.')
  if (segments.length !== 3) return null

  try {
    return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function verifierCleJwt(cle, roleAttendu, nomVariable) {
  const claims = lireClaimsJwt(cle)
  if (!claims || claims.ref !== SI_TEST_REF || claims.role !== roleAttendu) {
    throw new Error(
      `${nomVariable} doit être une clé JWT du projet Sikaloc-Test avec le rôle ${roleAttendu}. Aucune clé n’a été affichée.`,
    )
  }
}

function verifierUrlTest(urlBrute) {
  let url
  try {
    url = new URL(urlBrute)
  } catch {
    throw new Error('SIKALOC_TEST_SUPABASE_URL est absente ou invalide.')
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== `${SI_TEST_REF}.supabase.co` ||
    url.port !== '' ||
    (url.pathname !== '' && url.pathname !== '/') ||
    url.search !== '' ||
    url.hash !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new Error(
      `Refus de lancer la recette : l’URL doit cibler exclusivement ${SI_TEST_REF}.`,
    )
  }

  return SI_TEST_URL
}

export function construireEnvironnementRecette(source = process.env, nomsEnvCharges = []) {
  const inconnues = nomsEnvCharges.filter((nom) => !variablesControlees.has(nom))
  if (inconnues.length) {
    throw new Error(
      `Variables des fichiers .env à examiner avant lancement : ${inconnues.join(', ')}.`,
    )
  }

  const prerequisNonConfirmes = [
    'SIKALOC_TEST_DB_BACKUP_VERIFIED',
    'SIKALOC_TEST_STORAGE_BACKUP_VERIFIED',
    'SIKALOC_TEST_AUTH_EMAILS_CONTROLLED',
  ].filter((nom) => source[nom] !== '1')
  if (prerequisNonConfirmes.length) {
    throw new Error(
      `Recette bloquée : vérifier puis confirmer ces prérequis (valeur 1) : ${prerequisNonConfirmes.join(', ')}. ` +
      'La sauvegarde PostgreSQL doit être restaurable et Storage sauvegardé séparément ; les emails Auth doivent être contrôlés.',
    )
  }

  const url = verifierUrlTest(source.SIKALOC_TEST_SUPABASE_URL ?? '')
  const clePublique = source.SIKALOC_TEST_SUPABASE_ANON_KEY?.trim() ?? ''
  const cleService = source.SIKALOC_TEST_SERVICE_ROLE_KEY?.trim() ?? ''

  if (!clePublique) {
    throw new Error('SIKALOC_TEST_SUPABASE_ANON_KEY est requise.')
  }
  if (!cleService) {
    throw new Error('SIKALOC_TEST_SERVICE_ROLE_KEY est requise pour les routes serveur.')
  }

  if (clePublique.split('.').length === 3) {
    verifierCleJwt(clePublique, 'anon', 'SIKALOC_TEST_SUPABASE_ANON_KEY')
  } else if (!clePublique.startsWith('sb_publishable_')) {
    throw new Error('La clé publique Test doit être une clé anon JWT ou sb_publishable_.')
  }
  verifierCleJwt(cleService, 'service_role', 'SIKALOC_TEST_SERVICE_ROLE_KEY')

  const secretFedapay = source.SIKALOC_TEST_FEDAPAY_SECRET_KEY?.trim() ?? ''
  const cleFedapayPublique = source.SIKALOC_TEST_FEDAPAY_PUBLIC_KEY?.trim() ?? ''
  const secretWebhookFedapay = source.SIKALOC_TEST_FEDAPAY_WEBHOOK_SECRET?.trim() ?? ''
  const fedapayPartiel = Boolean(secretFedapay || cleFedapayPublique || secretWebhookFedapay)

  if (fedapayPartiel && !(secretFedapay && cleFedapayPublique && secretWebhookFedapay)) {
    throw new Error(
      'Pour activer FedaPay, les trois identifiants Test (public, secret et webhook) sont requis.',
    )
  }
  if (secretFedapay && !secretFedapay.startsWith('sk_sandbox')) {
    throw new Error('FedaPay est refusé : seule une clé sk_sandbox est autorisée.')
  }

  const environnement = { ...source }
  for (const nom of new Set([...Object.keys(environnement), ...nomsEnvCharges])) {
    if (integrationsSensibles.test(nom) || nom.startsWith('SIKALOC_TEST_')) {
      environnement[nom] = ''
    }
  }

  Object.assign(environnement, {
    NODE_ENV: 'development',
    NEXT_TELEMETRY_DISABLED: '1',
    PORT: '3000',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: clePublique,
    SUPABASE_SERVICE_ROLE_KEY: cleService,
    APP_NAME: 'Sikaloc | recette Test',
    SIKALOC_MAINTENANCE_MODE: 'off',
    SIKALOC_DEMO_LOCAL: '',
    SIKALOC_DEMO_EXPECTED_PROJECT_ID: '',
    OTP_SECRET: source.SIKALOC_TEST_OTP_SECRET || randomBytes(32).toString('base64url'),
    CRON_SECRET: source.SIKALOC_TEST_CRON_SECRET || randomBytes(32).toString('base64url'),
    NEXT_PUBLIC_EMAIL_OTP_LENGTH: '6',
    OTP_CANAL_DEV: '0',
    FEDAPAY_ENV: 'sandbox',
    FEDAPAY_PUBLIC_KEY: cleFedapayPublique,
    FEDAPAY_SECRET_KEY: secretFedapay,
    FEDAPAY_WEBHOOK_SECRET: secretWebhookFedapay,
    RESEND_API_KEY: '',
    EMAIL_FROM: '',
    EMAIL_FROM_NAME: 'Sikaloc | recette Test',
    EMAIL_EXPLOITATION: '',
    SIKALOC_QUESTIONS_ADMIN_IDS: '',
    SIKALOC_QUESTIONS_NOTIFICATIONS_ACTIVE: '',
    SMS_FOURNISSEUR: '',
    SMS_IDENTIFIANT: '',
    SMS_JETON: '',
    SMS_EXPEDITEUR: '',
    WHATSAPP_ID_TELEPHONE: '',
    WHATSAPP_JETON: '',
    NEXT_PUBLIC_WHATSAPP_SUPPORT: '',
    VERIFICATION_GOOGLE: '',
    VERIFICATION_BING: '',
    GUIDE_EMAILS_JOURNAL: '',
  })

  for (const nom of ['SIKALOC_TEST_SUPABASE_URL', 'SIKALOC_TEST_SUPABASE_ANON_KEY',
    'SIKALOC_TEST_SERVICE_ROLE_KEY', 'SIKALOC_TEST_OTP_SECRET', 'SIKALOC_TEST_CRON_SECRET',
    'SIKALOC_TEST_FEDAPAY_PUBLIC_KEY', 'SIKALOC_TEST_FEDAPAY_SECRET_KEY',
    'SIKALOC_TEST_FEDAPAY_WEBHOOK_SECRET']) {
    delete environnement[nom]
  }

  return environnement
}

export function lancerRecette(source = process.env, repertoire = racine) {
  const environnement = construireEnvironnementRecette(
    source,
    collecterNomsEnvNext(repertoire),
  )

  if (Number(process.versions.node.split('.')[0]) !== 22) {
    throw new Error('La recette Sikaloc-Test exige Node.js 22.x, conformément au projet.')
  }

  const binaireNext = path.join(repertoire, 'node_modules', 'next', 'dist', 'bin', 'next')
  const serveur = spawn(
    process.execPath,
    [binaireNext, 'dev', '--hostname', '127.0.0.1', '--port', '3000'],
    { cwd: repertoire, env: environnement, stdio: 'inherit' },
  )

  console.info(
    `Recette isolée Sikaloc-Test (${SI_TEST_REF}) sur http://localhost:3000. ` +
    `Emails, SMS et WhatsApp sont désactivés ; FedaPay sandbox ${environnement.FEDAPAY_SECRET_KEY ? 'configuré' : 'désactivé'}.`,
  )

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => serveur.kill(signal))
  }
  serveur.on('error', (cause) => {
    console.error(`Impossible de démarrer Next.js (${cause.code ?? 'erreur'}).`)
    process.exitCode = 1
  })
  serveur.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0)
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    lancerRecette()
  } catch (cause) {
    console.error(`Recette Sikaloc-Test arrêtée sans démarrer l’application : ${cause.message}`)
    process.exitCode = 1
  }
}
