/**
 * Banc de la photo de profil — règles et cycle de vie.
 *
 * Il exerce le jugement d'une photo et la période d'avatar temporaire, sans
 * base ni navigateur.
 *
 *     npm run banc:photo
 *
 * La détection de visage elle-même tourne dans le navigateur et se vérifie par
 * `npm run banc:identite`, qui charge le vrai modèle sur de vraies images.
 */

import {
  JOURS_AVATAR_TEMPORAIRE,
  MESSAGES,
  etatIdentite,
  juger,
  messageRappel,
  type MesuresVisage,
} from '../src/lib/identite/regles'
import { comparer, masquer } from '../src/lib/identite/empreinte'

let echecs = 0
const noter = (ok: boolean, ligne: string) => {
  if (!ok) echecs += 1
  console.log(`${ok ? '  ok  ' : ' ÉCHEC'} ${ligne}`)
}

/** Une image 1000×1000 avec les visages qu'on lui donne. */
const image = (visages: MesuresVisage['visages'], nettete = 100): MesuresVisage => ({
  largeurImage: 1000,
  hauteurImage: 1000,
  nettete,
  visages,
})

/** Un visage centré occupant `part` de la surface. */
const visage = (part: number, confiance = 0.9) => {
  const cote = Math.sqrt(part * 1_000_000)
  return { x: 500 - cote / 2, y: 500 - cote / 2, largeur: cote, hauteur: cote, confiance }
}

console.log('\n─── 1. Photos acceptées ────────────────────────────────────────────────────')

noter(juger(image([visage(0.25)])).accepte, 'portrait net, un visage, bien cadré')
noter(juger(image([visage(0.1)])).accepte, 'visage plus petit mais suffisant')
noter(
  juger(image([visage(0.25), { ...visage(0.25), confiance: 0.2 }])).accepte,
  'un second visage sous le seuil de confiance est ignoré',
)

console.log('\n─── 2. Photos refusées ─────────────────────────────────────────────────────')

const refus: [string, MesuresVisage, string][] = [
  ['image minuscule', { largeurImage: 80, hauteurImage: 80, visages: [] }, 'trop_petite'],
  ['aucun visage', image([]), 'aucun_visage'],
  [
    'deux personnes',
    image([
      { x: 100, y: 400, largeur: 200, hauteur: 200, confiance: 0.9 },
      { x: 700, y: 400, largeur: 200, hauteur: 200, confiance: 0.9 },
    ]),
    'plusieurs_visages',
  ],
  ['visage trop petit', image([visage(0.02)]), 'visage_trop_petit'],
  ['photo de trop près', image([visage(0.95)]), 'visage_trop_gros'],
  [
    'visage coupé par le bord',
    image([{ x: -180, y: 300, largeur: 300, hauteur: 300, confiance: 0.9 }]),
    'visage_coupe',
  ],
  ['photo floue', image([visage(0.25)], 3), 'visage_peu_net'],
]

for (const [note, mesures, attendu] of refus) {
  const v = juger(mesures)
  noter(
    !v.accepte && v.motif === attendu,
    `${note.padEnd(28)} → ${v.motif}  « ${MESSAGES[v.motif!].titre} »`,
  )
}

console.log('\n─── 3. Chaque refus sait quoi conseiller ───────────────────────────────────')

for (const [motif, m] of Object.entries(MESSAGES)) {
  noter(
    m.titre.length > 0 && m.conseil.length > 0 && !/conforme|fraude|suspect|refus/i.test(m.conseil),
    `${motif.padEnd(20)} titre + conseil, sans jargon ni soupçon`,
  )
}

console.log('\n─── 4. La photo prime toujours sur l’avatar ────────────────────────────────')

const jours = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

noter(
  etatIdentite({ photo_chemin: 'b/photo.jpg', avatar_temporaire_depuis: jours(30) }).statut ===
    'photo',
  'photo présente + période très ancienne → statut « photo »',
)
noter(
  etatIdentite({ photo_chemin: 'b/photo.jpg', avatar_temporaire_depuis: jours(30) }).rappel ===
    'aucun',
  'et aucun rappel, quelle que soit l’ancienneté',
)

console.log('\n─── 5. La période de cinq jours ────────────────────────────────────────────')

const attendus: [number, string, number][] = [
  [0, 'discret', 5],
  [1, 'discret', 4],
  [2, 'visible', 3],
  [3, 'dernier', 2],
  [4, 'dernier', 1],
  [5, 'permanent', 0],
  [12, 'permanent', 0],
]

for (const [j, rappel, restants] of attendus) {
  const e = etatIdentite({ photo_chemin: null, avatar_temporaire_depuis: jours(j) })
  noter(
    e.rappel === rappel && e.joursRestants === restants,
    `jour ${String(j).padStart(2)} → ${e.rappel.padEnd(10)} ${e.joursRestants} jour(s) restant(s)`,
  )
}

noter(
  etatIdentite({ photo_chemin: null, avatar_temporaire_depuis: jours(9) }).statut === 'expire',
  'au-delà de cinq jours, le statut est « expire »',
)
noter(
  etatIdentite({ photo_chemin: null, avatar_temporaire_depuis: null }).joursRestants ===
    JOURS_AVATAR_TEMPORAIRE,
  'sans date de début, la période entière reste devant',
)

console.log('\n─── 6. L’expiration ne retire aucun droit ──────────────────────────────────')

const expire = etatIdentite({ photo_chemin: null, avatar_temporaire_depuis: jours(40) })
noter(
  !('bloque' in expire) && !('lectureSeule' in expire),
  'l’état ne porte aucun indicateur de blocage',
)
noter(
  (messageRappel(expire) ?? '').length > 0 &&
    !/suspend|bloqu|restrein|supprim/i.test(messageRappel(expire) ?? ''),
  'et le message ne menace de rien',
)

console.log('\n─── 7. Les messages ne promettent rien de faux ─────────────────────────────')

const tous = [
  ...Object.values(MESSAGES).map((m) => `${m.titre} ${m.conseil}`),
  ...([0, 2, 4, 9].map((j) =>
    messageRappel(etatIdentite({ photo_chemin: null, avatar_temporaire_depuis: jours(j) })),
  ) as string[]),
].join(' ')

noter(
  !/vérifi\w* (votre |son )?identité|pièce d.identité|authentifi/i.test(tous),
  'jamais de vérification d’identité annoncée',
)
noter(!/autres utilisateurs|inspire confiance/i.test(tous), 'aucune promesse de visibilité tierce')

console.log('\n─── 8. Aucune donnée biométrique ───────────────────────────────────────────')

const a = new Float32Array([0.1, 0.2, 0.3])
const b = new Float32Array([0.1, 0.2, 0.35])
noter(comparer(a, b).distance < 0.1, 'la comparaison d’empreintes reste purement mathématique')
noter(
  !masquer(a).includes('0.1') && masquer(a).includes('non journalisable'),
  'une empreinte ne peut pas être journalisée par mégarde',
)

const verdict = juger(image([visage(0.25)]))
noter(
  !/descriptor|empreinte|landmark|embedding/i.test(JSON.stringify(verdict)),
  'le verdict rendu ne contient aucune donnée faciale',
)
noter(
  !JSON.stringify(verdict).includes('"x"') && !JSON.stringify(verdict).includes('confiance'),
  'ni les positions, ni les scores de détection',
)

console.log(echecs === 0 ? `\n✓ Aucun écart.\n` : `\n✗ ${echecs} écart(s).\n`)
process.exit(echecs === 0 ? 0 : 1)
