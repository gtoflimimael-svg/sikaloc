/**
 * Banc des numéros de téléphone.
 *
 *     npm run banc:telephone
 *
 * Aucune base de données n'est nécessaire : tout ce qui est vérifié ici est
 * pur. Le déclencheur SQL, lui, a été exercé directement en base — voir le
 * journal de la migration 20260912000600.
 *
 * ─── Ce que ce banc surveille ───────────────────────────────────────────────
 *
 * Trois promesses, faciles à casser sans s'en apercevoir :
 *
 *   1. Ce qui est stocké ne contient jamais d'espace de présentation.
 *   2. Dix chiffres sont exigés à la saisie, et huit sont refusés — pas
 *      « réparés » en silence, ce qui reviendrait à choisir le numéro à la
 *      place de celui qui le tape.
 *   3. Le zéro de tête n'est jamais perdu. C'est le bug qui a cassé les liens
 *      WhatsApp : « 0190459821 » devenait « 229190459821 », un numéro qui
 *      n'existe pas, et le lien ne menait nulle part.
 */

import {
  chiffresNationaux,
  chiffresSaisis,
  formaterTelephone,
  normaliserTelephone,
  validerTelephone,
  type MotifTelephone,
} from '../src/lib/telephone'
import { schemaInscription, schemaLocataire, schemaProfil } from '../src/lib/validation'
import { normaliserNumero } from '../src/lib/whatsapp'

const CANONIQUE = '+2290190459821'
const AFFICHE = '+229 01 90 45 98 21'

let echecs = 0
let total = 0

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

// ═══ 1. Normalisation — toutes les formes mènent à la même ═══════════════════
//
// Ce sont les formes réellement rencontrées : saisie propre, copier-coller
// depuis un carnet d'adresses, export d'un autre outil, et l'indicatif collé
// deux fois — ce qui arrive quand on colle un numéro complet dans un champ qui
// en affiche déjà un.
titre('1. Normalisation — la même sortie quelle que soit l’entrée')

for (const entree of [
  '0190459821',
  '01 90 45 98 21',
  '01-90-45-98-21',
  '+2290190459821',
  '+229 01 90 45 98 21',
  '00229 01 90 45 98 21',
  '229 0190459821',
  '+229+2290190459821',
  '  +229 01 90 45 98 21  ',
  '(+229) 01.90.45.98.21',
]) {
  verifier(`normaliser « ${entree} »`, normaliserTelephone(entree), CANONIQUE)
}

// Le zéro de tête, précisément. L'implémentation précédente le retirait.
verifier('le zéro de tête survit', normaliserTelephone('0190459821')?.slice(4, 6), '01')

// ═══ 2. Ce qui ne doit pas être accepté ══════════════════════════════════════
titre('2. Refus — rien n’est inventé pour boucher un trou')

for (const entree of ['019045982', '01904598210', 'abcdefghij', '01 90 45 98 2X', '', '   ']) {
  verifier(`normaliser « ${entree} »`, normaliserTelephone(entree), null)
}

// ═══ 3. Validation de saisie — dix chiffres, pas huit ════════════════════════
//
// Le cœur de la décision. Huit chiffres était la forme d'avant la réforme
// béninoise de 2024 ; l'accepter à la saisie voudrait dire préfixer « 01 » à la
// place de l'utilisateur. Cette conversion a sa place dans la reprise de
// données existantes — jamais sur une frappe.
titre('3. Validation de saisie — dix chiffres exigés')

const casSaisie: Array<[string, boolean, MotifTelephone | undefined]> = [
  [CANONIQUE, true, undefined],
  ['0190459821', true, undefined],
  [AFFICHE, true, undefined],
  ['90459821', false, 'trop_court'], // ← ancien format : refusé, pas converti
  ['019045982', false, 'trop_court'],
  ['01904598210', false, 'trop_long'],
  ['01 90 45 98 2A', false, 'invalide'],
  ['', false, 'vide'],
]

for (const [entree, valide, motif] of casSaisie) {
  const verdict = validerTelephone(entree, { obligatoire: true })
  verifier(`saisie « ${entree} » → ${valide ? 'acceptée' : motif}`, [verdict.valide, verdict.motif], [
    valide,
    motif,
  ])
}

// La tolérance existe toujours, mais il faut la demander explicitement : c'est
// la relecture de données anciennes, pas la saisie.
titre('4. Relecture de données anciennes — la tolérance est explicite')

verifier(
  'huit chiffres tolérés sur demande',
  validerTelephone('90459821', { obligatoire: true, tolererAncien: true }).canonique,
  CANONIQUE,
)
verifier(
  'et refusés par défaut',
  validerTelephone('90459821', { obligatoire: true }).valide,
  false,
)
verifier(
  'un numéro absent passe quand il est facultatif',
  validerTelephone('', {}).valide,
  true,
)

// ═══ 5. Affichage ════════════════════════════════════════════════════════════
titre('5. Affichage — les espaces vivent ici, pas en base')

verifier('forme canonique', formaterTelephone(CANONIQUE), AFFICHE)
verifier('forme nationale', formaterTelephone('0190459821'), AFFICHE)
verifier('déjà formaté', formaterTelephone(AFFICHE), AFFICHE)
verifier('aucun espace dans la forme stockée', /\s/.test(CANONIQUE), false)

// Tolérant en cours de frappe : c'est ce qui permet au champ de s'en servir à
// chaque touche sans attendre que le numéro soit complet.
verifier('frappe : rien', formaterTelephone(''), '+229')
verifier('frappe : « 01 »', formaterTelephone('01'), '+229 01')
verifier('frappe : « 0190 »', formaterTelephone('0190'), '+229 01 90')
verifier('frappe : « 019045 »', formaterTelephone('019045'), '+229 01 90 45')

// ═══ 6. Le champ de saisie ═══════════════════════════════════════════════════
//
// `chiffresSaisis` est ce que `ChampTelephone` manipule à chaque touche. Il
// absorbe tout — indicatif collé, séparateurs, indicatif en double — et borne
// à dix, ce qui rend la onzième frappe sans effet plutôt que de laisser
// grandir un numéro invalide.
titre('6. Le champ — ce que la frappe produit')

verifier('coller la forme canonique', chiffresSaisis(CANONIQUE), '0190459821')
verifier('coller la forme affichée', chiffresSaisis(AFFICHE), '0190459821')
verifier('coller un indicatif dupliqué', chiffresSaisis('+229+2290190459821'), '0190459821')
verifier('onzième chiffre ignoré', chiffresSaisis('01904598219'), '0190459821')
verifier('retour arrière au milieu', chiffresSaisis('01 90 45 98 2'), '019045982')
verifier('lettres retirées de la présentation', chiffresSaisis('01a90b45c98d21'), '0190459821')
verifier('champ vidé', chiffresSaisis(''), '')

// ═══ 6bis. Réouverture d'un formulaire ═══════════════════════════════════════
//
// `ChampTelephone` compose `normaliserTelephone` puis `chiffresSaisis` pour
// décider des chiffres affichés à l'ouverture. Un numéro d'avant 2024 doit
// s'ouvrir sur sa forme actuelle, sinon le bailleur trouve huit chiffres dans
// un champ qui en exige dix — et son enregistrement est refusé sur un
// formulaire qu'il n'a pas modifié.
titre('6bis. Réouverture d’un formulaire — jamais huit chiffres à l’écran')

const chiffresDepart = (valeur: string) =>
  chiffresSaisis(normaliserTelephone(valeur) ?? valeur)

verifier('numéro canonique', chiffresDepart(CANONIQUE), '0190459821')
verifier('numéro d’avant 2024', chiffresDepart('+22990459821'), '0190459821')
verifier('numéro sans indicatif', chiffresDepart('0190459821'), '0190459821')
verifier('numéro avec espaces', chiffresDepart(AFFICHE), '0190459821')
verifier('sentinelle « Non renseigné »', chiffresDepart('Non renseigné'), '')

// ═══ 7. Validation serveur ═══════════════════════════════════════════════════
//
// C'est la seule qui compte. Une requête forgée qui contournerait le
// formulaire — un POST direct sur l'action serveur — passe par là.
titre('7. Serveur — une requête forgée ne passe pas')

const INSCRIPTION_VALIDE = {
  nom: 'Moussa Adjovi',
  email: 'moussa.adjovi@exemple.bj',
  motDePasse: 'Jonquille7Mn!',
}

function inscriptionAvec(tel: string) {
  return schemaInscription.safeParse({ ...INSCRIPTION_VALIDE, telephone: tel })
}

verifier(
  'inscription : le numéro ressort canonique',
  inscriptionAvec(AFFICHE).data?.telephone,
  CANONIQUE,
)
verifier('inscription : huit chiffres refusés', inscriptionAvec('90459821').success, false)
verifier('inscription : onze chiffres refusés', inscriptionAvec('01904598210').success, false)
verifier('inscription : lettres refusées', inscriptionAvec('téléphone!!').success, false)
verifier('inscription : champ vide refusé', inscriptionAvec('').success, false)

const LOCATAIRE_VALIDE = { nom: 'Awa Kponou', consentement: 'true' }
verifier(
  'locataire : le numéro ressort canonique',
  schemaLocataire.safeParse({ ...LOCATAIRE_VALIDE, telephone: '01 90 45 98 21' }).data?.telephone,
  CANONIQUE,
)
verifier(
  'locataire : huit chiffres refusés',
  schemaLocataire.safeParse({ ...LOCATAIRE_VALIDE, telephone: '90459821' }).success,
  false,
)
verifier(
  'profil : le numéro ressort canonique',
  schemaProfil.safeParse({ nom: 'Moussa Adjovi', telephone: '00229 01 90 45 98 21' }).data
    ?.telephone,
  CANONIQUE,
)

// Le message d'erreur doit nommer la règle, pas décrire un échec de regex.
const refus = schemaInscription.safeParse({ ...INSCRIPTION_VALIDE, telephone: '019045982' })
const messageTelephone = refus.error?.issues.find((i) => i.path[0] === 'telephone')?.message
verifier(
  'le message dit combien de chiffres on attend',
  messageTelephone?.includes('10 chiffres'),
  true,
)

// ═══ 8. Les consommateurs du numéro ══════════════════════════════════════════
titre('8. WhatsApp et FedaPay — les deux sorties du numéro')

// `wa.me` n'accepte ni « + », ni espace. Et surtout : le zéro de tête fait
// partie du numéro depuis 2024, le retirer casse le lien.
verifier('wa.me depuis la forme canonique', normaliserNumero(CANONIQUE), '2290190459821')
verifier('wa.me depuis la forme affichée', normaliserNumero(AFFICHE), '2290190459821')
verifier('wa.me depuis la forme nationale', normaliserNumero('0190459821'), '2290190459821')
verifier('wa.me : un ancien numéro reste joignable', normaliserNumero('90459821'), '2290190459821')
verifier('wa.me : aucun caractère de présentation', /[^0-9]/.test(normaliserNumero(CANONIQUE)), false)

// FedaPay reçoit les chiffres nationaux et le pays séparément : c'est
// exactement ce que rend `chiffresNationaux`, dont `numeroLocal` dépend.
verifier('guichet FedaPay : chiffres nationaux', chiffresNationaux(CANONIQUE), '0190459821')
verifier('guichet FedaPay : dix chiffres', chiffresNationaux(CANONIQUE)?.length, 10)

// ═══ 9. Idempotence ══════════════════════════════════════════════════════════
//
// Un numéro relu, réenregistré, réaffiché ne doit pas dériver. C'est ce qui
// autorise le déclencheur SQL à réécrire chaque écriture sans crainte.
titre('9. Idempotence — repasser par la chaîne ne change rien')

for (const entree of ['0190459821', AFFICHE, '+229+2290190459821', '90459821']) {
  const une = normaliserTelephone(entree)
  const deux = normaliserTelephone(une ?? '')
  const trois = normaliserTelephone(formaterTelephone(une ?? ''))
  verifier(`« ${entree} » stable`, [deux, trois], [une, une])
}

// ═══ Verdict ═════════════════════════════════════════════════════════════════
console.log(
  echecs === 0
    ? `\n✓ ${total} vérifications, aucun écart.\n`
    : `\n✗ ${echecs} écart(s) sur ${total}.\n`,
)
process.exit(echecs === 0 ? 0 : 1)
