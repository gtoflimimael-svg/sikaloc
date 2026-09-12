/**
 * Banc de la vérification du compte — email + téléphone par code.
 *
 *     npm run banc:verification              (règles pures uniquement)
 *     OTP_SECRET=… npm run banc:verification (règles + OTP réel en base)
 *
 * ─── Deux moitiés ───────────────────────────────────────────────────────────
 *
 * La première n'a besoin de rien : elle exerce la règle métier, le masquage et
 * la progression. La seconde crée un vrai compte et exerce le service OTP
 * contre une vraie base — génération, expiration, tentatives, limite de débit,
 * usage unique, séparation des contextes.
 *
 * ─── Le garde-fou ───────────────────────────────────────────────────────────
 *
 * La seconde moitié écrit en base. Elle refuse donc de tourner ailleurs qu'en
 * local, parce que `.env.local` de ce projet pointe sur la PRODUCTION : un banc
 * qui crée des comptes de test chez de vrais bailleurs serait un incident, pas
 * un test.
 */

import { createHmac } from 'node:crypto'
import Module from 'node:module'

// `server-only` lève à l'import hors du rendu serveur Next. `otp.ts` le porte
// à juste titre — il manipule la clé de service et le secret des empreintes —
// mais un script en ligne de commande est un contexte serveur légitime. Même
// contournement que `scripts/verifier-schema.ts`, et pour la même raison.
//
// Résolu AVANT d'installer le hook : le calculer à l'intérieur ferait rentrer
// `require.resolve` dans le hook qu'il est en train de définir.
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

import { normaliserTelephone } from '../src/lib/telephone'
import {
  comptePleinementVerifie,
  etapeCourante,
  etapesRestantes,
  DEMANDES_MAXIMALES_PAR_HEURE,
  LONGUEUR_CODE,
  TENTATIVES_MAXIMALES,
  masquerEmail,
  masquerTelephone,
} from '../src/lib/verification/regles'

let echecs = 0
let total = 0
let ignores = 0

function verifier(intitule: string, obtenu: unknown, attendu: unknown) {
  total += 1
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu)
  if (!ok) echecs += 1
  const rendu = (v: unknown) => (typeof v === 'string' ? `« ${v} »` : JSON.stringify(v))
  console.log(
    `  ${ok ? '✓' : '✗'} ${intitule}` +
      (ok ? ` → ${rendu(obtenu)}` : `\n      attendu ${rendu(attendu)}, obtenu ${rendu(obtenu)}`),
  )
}

function titre(t: string) {
  console.log(`\n${t}`)
}

// ═══ 1. La règle métier ══════════════════════════════════════════════════════
//
// Les quatre combinaisons du cahier des charges, dans l'ordre où il les donne.
titre('1. Un compte n’est vérifié que si les DEUX coordonnées le sont')

const COMBINAISONS: Array<[boolean, boolean, boolean]> = [
  // email, téléphone, pleinement vérifié
  [false, false, false],
  [true, false, false], // ← email seul : non
  [false, true, false], // ← téléphone seul : non
  [true, true, true],
]

for (const [emailVerifie, telephoneVerifie, attendu] of COMBINAISONS) {
  verifier(
    `email=${emailVerifie}, téléphone=${telephoneVerifie}`,
    comptePleinementVerifie({ emailVerifie, telephoneVerifie }),
    attendu,
  )
}

// La règle ne doit pas se laisser attendrir par une valeur approchante : un
// `undefined` ou une chaîne non vide venue d'une requête forgée ne vaut pas
// `true`.
verifier(
  'une valeur qui n’est pas exactement true ne passe pas',
  comptePleinementVerifie({
    emailVerifie: 'oui' as unknown as boolean,
    telephoneVerifie: true,
  }),
  false,
)

// ═══ 2. L'ordre du parcours ══════════════════════════════════════════════════
titre('2. Le parcours — email d’abord, téléphone ensuite')

verifier('rien de fait', etapeCourante({ emailVerifie: false, telephoneVerifie: false }), 'email')
verifier(
  'email fait',
  etapeCourante({ emailVerifie: true, telephoneVerifie: false }),
  'telephone',
)
verifier('tout fait', etapeCourante({ emailVerifie: true, telephoneVerifie: true }), null)

// Cas des comptes existants : email déjà confirmé, téléphone jamais vérifié.
// Ils doivent reprendre à l'étape téléphone, sans refaire l'email.
verifier(
  'compte existant : il ne reste que le téléphone',
  etapeCourante({ emailVerifie: true, telephoneVerifie: false }),
  'telephone',
)
verifier(
  'et une seule étape restante',
  etapesRestantes({ emailVerifie: true, telephoneVerifie: false }),
  1,
)
verifier('deux si rien n’est fait', etapesRestantes({ emailVerifie: false, telephoneVerifie: false }), 2)
verifier('zéro à la fin', etapesRestantes({ emailVerifie: true, telephoneVerifie: true }), 0)

// ═══ 3. Ce qui s'affiche ne divulgue pas ═════════════════════════════════════
titre('3. Masquage — assez pour se reconnaître, pas assez pour être lu')

verifier('email', masquerEmail('moussa.adjovi@exemple.bj'), 'mo***@exemple.bj')
verifier('email court', masquerEmail('a@b.bj'), 'a***@b.bj')
verifier('email sans arobase', masquerEmail('nimportequoi'), '***')
verifier('téléphone', masquerTelephone('+2290190459821'), '+229 01 ** ** 21')
verifier('téléphone national', masquerTelephone('0190459821'), '+229 01 ** ** 21')
verifier('téléphone incomplet', masquerTelephone('0190'), '+229 ** ** ** ** **')

// Le masque ne doit jamais laisser passer les chiffres du milieu.
const masque = masquerTelephone(normaliserTelephone('0190459821') ?? '')
verifier('les chiffres du milieu sont absents', masque.includes('45'), false)
verifier('et ceux du début restent', masque.includes('01'), true)

// ═══ 4. L'OTP en base ════════════════════════════════════════════════════════

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const LOCAL = /127\.0\.0\.1|localhost/.test(SUPABASE)
const SECRET = process.env.OTP_SECRET ?? ''

// `await` au premier niveau n'est pas disponible ici (tsx transpile vers CJS) :
// la suite vit donc dans une fonction appelée immédiatement.
void (async () => {
  if (!LOCAL || SECRET.length < 32) {
    titre('4. Service OTP — IGNORÉ')
    console.log(
      !LOCAL
        ? `  ⊘ ${SUPABASE || '(aucune URL)'} n’est pas une pile locale.\n` +
            '    Ce banc écrit en base : il refuse de toucher à la production.\n' +
            '    Lancez « npm run db:start », pointez l’environnement en local, puis relancez.'
        : '  ⊘ OTP_SECRET absente ou plus courte que 32 caractères.\n' +
            '    Générez-en une : node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    )
    ignores += 1
  } else {
    await bancOtp()
  }

  verdict()
})()

async function bancOtp() {
  // Importés ici seulement : ces modules portent `server-only` et lisent
  // l'environnement au chargement.
  const { createClient } = await import('@supabase/supabase-js')
  const { preparerCodeTelephone, verifierCodeTelephone, annulerCodeCourant } =
    await import('../src/lib/verification/otp')

  const admin = createClient(SUPABASE, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const empreinte = (code: string) =>
    createHmac('sha256', SECRET).update(code).digest('hex')

  /** Un bailleur neuf, par la voie normale : inscription puis déclencheur. */
  async function creerBailleur(suffixe: string) {
    const { data } = await admin.auth.admin.createUser({
      email: `banc-verif-${suffixe}-${Date.now()}@exemple.test`,
      password: 'Jonquille7Mn!',
      email_confirm: true,
      user_metadata: { nom: 'Awa Kponou', telephone: '+2290190459821' },
    })
    return data.user!.id
  }

  const TELEPHONE = '+2290190459821'

  // ── 4.1 Un compte neuf n'est vérifié sur rien ──────────────────────────
  titre('4. Service OTP — inscription')

  const neuf = await creerBailleur('neuf')
  const { data: profil } = await admin
    .from('bailleurs')
    .select('telephone, telephone_verifie_le, telephone_canal_verification')
    .eq('id', neuf)
    .single()

  verifier('le téléphone d’un compte neuf n’est pas vérifié', profil!.telephone_verifie_le, null)
  verifier('aucun canal enregistré', profil!.telephone_canal_verification, null)
  verifier('le numéro est canonique', profil!.telephone, TELEPHONE)

  // ── 4.2 Le code n'est jamais en clair en base ──────────────────────────
  titre('4.2 Le code n’est pas stocké')

  const demande = await preparerCodeTelephone(neuf, TELEPHONE, 'SMS', null)
  verifier('un code est produit', demande.ok, true)
  verifier('à six chiffres', demande.code?.length, LONGUEUR_CODE)
  verifier('uniquement des chiffres', /^\d+$/.test(demande.code ?? ''), true)

  const { data: ligne } = await admin
    .from('codes_verification')
    .select('*')
    .eq('bailleur_id', neuf)
    .order('cree_le', { ascending: false })
    .limit(1)
    .single()

  verifier('la base ne contient pas le code', ligne!.empreinte === demande.code, false)
  verifier('mais bien son empreinte', ligne!.empreinte, empreinte(demande.code!))
  verifier('64 caractères hexadécimaux', /^[0-9a-f]{64}$/.test(ligne!.empreinte), true)
  verifier('le contexte est celui du téléphone', ligne!.type, 'PHONE_VERIFICATION')
  verifier('le canal est tracé', ligne!.canal, 'SMS')
  verifier('aucune tentative encore', ligne!.tentatives, 0)
  verifier('pas encore consommé', ligne!.utilise_le, null)

  // ── 4.3 Un mauvais code ne vérifie rien ────────────────────────────────
  titre('4.3 Code incorrect')

  const faux = demande.code === '000000' ? '111111' : '000000'
  const refus = await verifierCodeTelephone(neuf, TELEPHONE, faux)
  verifier('refusé', refus.ok, false)
  verifier('motif', refus.motif, 'code_incorrect')
  verifier('essais restants décomptés', refus.essaisRestants, TENTATIVES_MAXIMALES - 1)

  const { data: apresFaux } = await admin
    .from('bailleurs')
    .select('telephone_verifie_le')
    .eq('id', neuf)
    .single()
  verifier('le téléphone reste non vérifié', apresFaux!.telephone_verifie_le, null)

  // ── 4.4 Le bon code vérifie, une fois ──────────────────────────────────
  titre('4.4 Code correct, et usage unique')

  const bon = await verifierCodeTelephone(neuf, TELEPHONE, demande.code!)
  verifier('accepté', bon.ok, true)
  verifier('le canal est rendu', bon.canal, 'SMS')

  const rejoue = await verifierCodeTelephone(neuf, TELEPHONE, demande.code!)
  verifier('le même code ne resert pas', rejoue.ok, false)
  verifier('motif', rejoue.motif, 'code_absent')

  // ── 4.5 Tentatives épuisées ────────────────────────────────────────────
  titre('4.5 Tentatives — la limite est tenue par le serveur')

  const cobaye = await creerBailleur('tentatives')
  // La limite de débit interdirait un second code dans la minute : on l'insère
  // donc directement, comme le ferait `preparerCodeTelephone`.
  const codeConnu = '424242'
  await admin.from('codes_verification').insert({
    bailleur_id: cobaye,
    type: 'PHONE_VERIFICATION',
    canal: 'SMS',
    destination: TELEPHONE,
    empreinte: empreinte(codeConnu),
    expire_le: new Date(Date.now() + 600_000).toISOString(),
  })

  for (let essai = 1; essai <= TENTATIVES_MAXIMALES; essai += 1) {
    const v = await verifierCodeTelephone(cobaye, TELEPHONE, '999999')
    const dernier = essai === TENTATIVES_MAXIMALES
    verifier(
      `essai ${essai}/${TENTATIVES_MAXIMALES} refusé`,
      v.motif,
      dernier ? 'tentatives_epuisees' : 'code_incorrect',
    )
  }

  // Et maintenant, le BON code ne passe plus : le code est brûlé.
  const apresLimite = await verifierCodeTelephone(cobaye, TELEPHONE, codeConnu)
  verifier('le bon code ne passe plus après la limite', apresLimite.ok, false)
  verifier('motif', apresLimite.motif, 'tentatives_epuisees')

  // ── 4.6 Expiration ────────────────────────────────────────────────────
  titre('4.6 Expiration')

  const expire = await creerBailleur('expire')
  await admin.from('codes_verification').insert({
    bailleur_id: expire,
    type: 'PHONE_VERIFICATION',
    canal: 'WHATSAPP',
    destination: TELEPHONE,
    empreinte: empreinte('313131'),
    expire_le: new Date(Date.now() - 1000).toISOString(),
  })

  const perime = await verifierCodeTelephone(expire, TELEPHONE, '313131')
  verifier('un code expiré est refusé', perime.ok, false)
  verifier('motif', perime.motif, 'code_expire')

  // ── 4.7 Un renvoi invalide le précédent ───────────────────────────────
  titre('4.7 Renvoi — l’ancien code meurt')

  const renvoi = await creerBailleur('renvoi')
  const premier = await preparerCodeTelephone(renvoi, TELEPHONE, 'SMS', null)
  verifier('premier code produit', premier.ok, true)

  // Le délai de renvoi est réel : on vieillit la ligne plutôt que d'attendre
  // une minute dans un test.
  await admin
    .from('codes_verification')
    .update({ cree_le: new Date(Date.now() - 120_000).toISOString() })
    .eq('bailleur_id', renvoi)

  const second = await preparerCodeTelephone(renvoi, TELEPHONE, 'SMS', null)
  verifier('second code produit', second.ok, true)
  verifier('les deux codes diffèrent', premier.code !== second.code, true)

  const ancien = await verifierCodeTelephone(renvoi, TELEPHONE, premier.code!)
  verifier('l’ancien code ne vaut plus rien', ancien.ok, false)

  const nouveau = await verifierCodeTelephone(renvoi, TELEPHONE, second.code!)
  verifier('le nouveau fonctionne', nouveau.ok, true)

  // ── 4.8 Délai de renvoi ───────────────────────────────────────────────
  titre('4.8 Délai entre deux demandes')

  const debit = await creerBailleur('debit')
  await preparerCodeTelephone(debit, TELEPHONE, 'SMS', null)
  const tropTot = await preparerCodeTelephone(debit, TELEPHONE, 'SMS', null)
  verifier('une demande immédiate est refusée', tropTot.ok, false)
  verifier('motif', tropTot.motif, 'renvoi_trop_tot')
  verifier('et le temps à attendre est donné', (tropTot.attendreSecondes ?? 0) > 0, true)

  // ── 4.9 Limite horaire ────────────────────────────────────────────────
  titre('4.9 Limite de débit — cinq codes par heure')

  const abus = await creerBailleur('abus')
  for (let i = 0; i < DEMANDES_MAXIMALES_PAR_HEURE; i += 1) {
    await preparerCodeTelephone(abus, TELEPHONE, 'SMS', null)
    // Vieillir juste assez pour franchir le délai de renvoi, sans sortir de
    // la fenêtre d'une heure.
    await admin
      .from('codes_verification')
      .update({ cree_le: new Date(Date.now() - (i + 1) * 120_000).toISOString() })
      .eq('bailleur_id', abus)
      .is('invalide_le', null)
      .is('utilise_le', null)
  }

  const sixieme = await preparerCodeTelephone(abus, TELEPHONE, 'SMS', null)
  verifier(
    `la ${DEMANDES_MAXIMALES_PAR_HEURE + 1}e demande de l’heure est refusée`,
    sixieme.motif,
    'trop_de_demandes',
  )

  // ── 4.10 Les deux contextes ne se mélangent pas ───────────────────────
  titre('4.10 Un code email ne peut pas valider un téléphone')

  const cloison = await creerBailleur('cloison')
  const codeEmail = '505050'
  await admin.from('codes_verification').insert({
    bailleur_id: cloison,
    type: 'EMAIL_VERIFICATION', // ← contexte email
    canal: 'EMAIL',
    destination: 'quelquun@exemple.test',
    empreinte: empreinte(codeEmail),
    expire_le: new Date(Date.now() + 600_000).toISOString(),
  })

  const traverse = await verifierCodeTelephone(cloison, TELEPHONE, codeEmail)
  verifier('le code email est invisible côté téléphone', traverse.ok, false)
  verifier('motif', traverse.motif, 'code_absent')

  const { data: intact } = await admin
    .from('codes_verification')
    .select('utilise_le, tentatives')
    .eq('bailleur_id', cloison)
    .single()
  verifier('et il n’a même pas été touché', [intact!.utilise_le, intact!.tentatives], [null, 0])

  // ── 4.11 Un code demandé pour un autre numéro ─────────────────────────
  titre('4.11 Changement de numéro entre la demande et la saisie')

  const change = await creerBailleur('change')
  const pourAncien = await preparerCodeTelephone(change, TELEPHONE, 'SMS', null)
  const autre = await verifierCodeTelephone(change, '+2290196554433', pourAncien.code!)
  verifier('le code ne vaut pas pour un autre numéro', autre.ok, false)
  verifier('motif', autre.motif, 'code_absent')

  // ── 4.12 Annulation ───────────────────────────────────────────────────
  titre('4.12 Annulation quand l’envoi échoue')

  const annule = await creerBailleur('annule')
  const aAnnuler = await preparerCodeTelephone(annule, TELEPHONE, 'WHATSAPP', null)
  await annulerCodeCourant(annule)
  const apresAnnulation = await verifierCodeTelephone(annule, TELEPHONE, aAnnuler.code!)
  verifier('un code annulé ne vaut rien', apresAnnulation.ok, false)
  verifier('motif', apresAnnulation.motif, 'code_absent')

  // ── Ménage ────────────────────────────────────────────────────────────
  for (const id of [neuf, cobaye, expire, renvoi, debit, abus, cloison, change, annule]) {
    await admin.auth.admin.deleteUser(id)
  }
  console.log('\n  (comptes de test supprimés)')
}

function verdict() {
  console.log(
    echecs === 0
      ? `\n✓ ${total} vérifications, aucun écart.${ignores ? ` ${ignores} section(s) ignorée(s).` : ''}\n`
      : `\n✗ ${echecs} écart(s) sur ${total}.\n`,
  )
  process.exit(echecs === 0 ? 0 : 1)
}
