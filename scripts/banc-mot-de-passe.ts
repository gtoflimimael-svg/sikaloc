/**
 * Banc de la robustesse des mots de passe.
 *
 * Il exerce la **validation serveur** — celle qui fait autorité — et non la
 * jauge : la jauge appelle la même fonction, mais elle tourne sur la machine de
 * l'utilisateur et ne protège rien.
 *
 * Aucune base de données n'est nécessaire.
 *
 *     npm run banc:mot-de-passe
 *
 * Les cas marqués « régression » sont ceux que l'implémentation précédente
 * traitait à l'envers, mesurés le 12/09/2026 : ils sont ici pour qu'un futur
 * retour aux règles de composition se voie immédiatement.
 */

import { LONGUEUR_MINIMALE, SCORE_MINIMAL } from '../src/lib/mot-de-passe'
import { evaluerMotDePasse } from '../src/lib/mot-de-passe-evaluation'
import { schemaChangementMotDePasse, schemaInscription } from '../src/lib/validation'

const IDENTITE = {
  nom: 'Moussa Adjovi',
  email: 'moussa.adjovi@exemple.bj',
  telephone: '97000000',
}

interface Cas {
  mdp: string
  /** Ce que le serveur doit faire. */
  accepte: boolean
  note: string
}

const CAS: Cas[] = [
  // ── Doivent être refusés ────────────────────────────────────────────────
  { mdp: '123456', accepte: false, note: 'le plus courant du monde' },
  { mdp: 'abcdef', accepte: false, note: 'suite alphabétique' },
  { mdp: 'azerty123', accepte: false, note: 'trajet de clavier azerty' },
  { mdp: 'Password1!', accepte: false, note: 'mot de passe fuité + décoration' },
  { mdp: 'Motdepass1E', accepte: false, note: 'variation triviale d’un mot fuité' },
  { mdp: 'Aaaaaaa1A', accepte: false, note: 'répétition — régression : était « Correct »' },
  { mdp: 'Trottoir9', accepte: false, note: 'mot du dictionnaire — régression : était « Correct »' },
  { mdp: 'Benin20266', accepte: false, note: 'ville + année — régression : était « Correct »' },
  { mdp: 'Sikaloc2026!', accepte: false, note: 'nom du service + année' },
  { mdp: 'MoussaAdjovi1!', accepte: false, note: 'nom du bailleur — contexte' },
  { mdp: 'moussa.adjovi@exemple.bj', accepte: false, note: 'son propre email — contexte' },
  { mdp: '97000000Aa!', accepte: false, note: 'son propre téléphone — contexte' },
  { mdp: 'court1A', accepte: false, note: `moins de ${LONGUEUR_MINIMALE} caractères` },
  { mdp: 'x'.repeat(73), accepte: false, note: 'au-delà de la limite bcrypt' },

  // ── Doivent être acceptés ───────────────────────────────────────────────
  { mdp: 'Jonquille7Mn!', accepte: true, note: 'raisonnable' },
  { mdp: 'Zk9$mPq2wRt7', accepte: true, note: 'aléatoire, 12 caractères' },
  {
    mdp: 'correct cheval batterie agrafe',
    accepte: true,
    note: 'phrase de passe — régression : était refusée',
  },
  { mdp: 'Ab1!xyzwqr', accepte: true, note: 'correct' },
  { mdp: 'Moussa$K9pLvQ2wXz', accepte: true, note: 'prénom noyé : ne doit PAS pénaliser' },
  { mdp: 'brouette-lampadaire-38', accepte: true, note: 'mots sans rapport, sans majuscule' },
]

let echecs = 0

function noter(reussi: boolean, ligne: string) {
  if (!reussi) echecs += 1
  console.log(`${reussi ? '  ok  ' : ' ÉCHEC'} ${ligne}`)
}

console.log(`\nSeuil serveur : score zxcvbn >= ${SCORE_MINIMAL}, longueur >= ${LONGUEUR_MINIMALE}\n`)
console.log('─── 1. Mesure et verdict ───────────────────────────────────────────────────')

for (const cas of CAS) {
  const force = evaluerMotDePasse(cas.mdp, [IDENTITE.nom, IDENTITE.email, IDENTITE.telephone])
  const apercu = cas.mdp.length > 26 ? `${cas.mdp.slice(0, 23)}…` : cas.mdp

  noter(
    force.acceptable === cas.accepte,
    `${JSON.stringify(apercu).padEnd(28)} ${force.niveau} ${force.libelle.padEnd(12)} ` +
      `${(force.acceptable ? 'accepté' : 'refusé').padEnd(8)} ${cas.note}`,
  )
}

console.log('\n─── 2. La jauge dit-elle la même chose que le serveur ? ────────────────────')

for (const cas of CAS) {
  const force = evaluerMotDePasse(cas.mdp, [IDENTITE.nom, IDENTITE.email, IDENTITE.telephone])

  const analyse = schemaInscription.safeParse({
    ...IDENTITE,
    motDePasse: cas.mdp,
    avatar: undefined,
  })

  // Le schéma peut refuser pour une autre raison que le mot de passe ; on ne
  // regarde donc que les messages portés par ce champ.
  const refuseSurMotDePasse =
    !analyse.success && analyse.error.issues.some((i) => i.path[0] === 'motDePasse')

  noter(
    force.acceptable === !refuseSurMotDePasse,
    `${JSON.stringify(cas.mdp.slice(0, 23)).padEnd(28)} jauge=${
      force.acceptable ? 'accepte' : 'refuse'
    }  serveur=${refuseSurMotDePasse ? 'refuse' : 'accepte'}`,
  )
}

console.log('\n─── 3. Le contexte du compte pénalise-t-il vraiment ? ──────────────────────')

const sansContexte = evaluerMotDePasse('MoussaAdjovi1!')
const avecContexte = evaluerMotDePasse('MoussaAdjovi1!', [IDENTITE.nom])
noter(
  sansContexte.niveau > avecContexte.niveau,
  `« MoussaAdjovi1! » : ${sansContexte.niveau} pour un inconnu, ${avecContexte.niveau} pour Moussa Adjovi`,
)

const analyseContexte = schemaInscription.safeParse({
  ...IDENTITE,
  motDePasse: 'MoussaAdjovi1!',
  avatar: undefined,
})
noter(!analyseContexte.success, 'l’inscription refuse un mot de passe bâti sur le nom saisi')

console.log('\n─── 4. Pas de régression sur les autres règles ─────────────────────────────')

const different = schemaChangementMotDePasse.safeParse({
  motDePasseActuel: 'Jonquille7Mn!',
  motDePasse: 'Jonquille7Mn!',
  confirmation: 'Jonquille7Mn!',
})
noter(!different.success, 'le nouveau mot de passe doit différer de l’actuel')

const confirmation = schemaChangementMotDePasse.safeParse({
  motDePasseActuel: 'Zk9$mPq2wRt7',
  motDePasse: 'Jonquille7Mn!',
  confirmation: 'Jonquille7Mnx',
})
noter(!confirmation.success, 'les deux saisies doivent correspondre')

const valide = schemaChangementMotDePasse.safeParse({
  motDePasseActuel: 'Zk9$mPq2wRt7',
  motDePasse: 'Jonquille7Mn!',
  confirmation: 'Jonquille7Mn!',
})
noter(valide.success, 'un changement légitime passe')

console.log('\n─── 5. Rien ne fuit ────────────────────────────────────────────────────────')

const force = evaluerMotDePasse('Jonquille7Mn!', [IDENTITE.email])
noter(
  !JSON.stringify(force).includes('Jonquille7Mn!'),
  'le verdict rendu ne contient pas le mot de passe',
)
noter(
  !JSON.stringify(force).includes(IDENTITE.email),
  'le verdict rendu ne contient pas les indices de contexte',
)

console.log(
  echecs === 0
    ? `\n✓ ${CAS.length * 2 + 8} vérifications, aucun écart.\n`
    : `\n✗ ${echecs} écart${echecs > 1 ? 's' : ''}.\n`,
)

process.exit(echecs === 0 ? 0 : 1)
