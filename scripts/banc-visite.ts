/**
 * Banc de la visite guidée — la machine à états.
 *
 * Il exerce la dérivation de l'avancement depuis les compteurs réels et les
 * deux dates de la table `bailleurs`. Aucune base de données, aucun navigateur.
 *
 *     npm run banc:visite
 *
 * Le parcours à l'écran (halo, bulle, clics) est couvert par
 * `npm run banc:onboarding`, qui exige une pile Supabase locale.
 */

import {
  ETAPES,
  avancement,
  ouvertureAutomatique,
  type EtatVisite,
} from '../src/lib/visite/etapes'
import type { ProgressionVisite } from '../src/lib/types/database'

const VIDE: ProgressionVisite = {
  bailleur_id: 'b',
  nb_logements: 0,
  nb_locataires: 0,
  nb_baux: 0,
  nb_paiements: 0,
  nb_quittances: 0,
}

const p = (o: Partial<ProgressionVisite>): ProgressionVisite => ({ ...VIDE, ...o })

/** Les deux dates de `bailleurs` qui décident de l'état de la visite. */
type Dates = { tutoriel_vu_le: string | null; visite_quittee_le: string | null }

const JAMAIS: Dates = { tutoriel_vu_le: null, visite_quittee_le: null }
const TERMINEE: Dates = { tutoriel_vu_le: '2026-09-12T10:00:00Z', visite_quittee_le: null }
const QUITTEE: Dates = { tutoriel_vu_le: null, visite_quittee_le: '2026-09-12T10:00:00Z' }

let echecs = 0
function noter(reussi: boolean, ligne: string) {
  if (!reussi) echecs += 1
  console.log(`${reussi ? '  ok  ' : ' ÉCHEC'} ${ligne}`)
}

console.log('\n─── 1. Les quatre états ────────────────────────────────────────────────────')

const cas: [string, ProgressionVisite, Dates, EtatVisite][] = [
  ['compte neuf, rien fait', VIDE, JAMAIS, 'non_commencee'],
  ['un logement créé', p({ nb_logements: 1 }), JAMAIS, 'en_cours'],
  ['visite menée à son terme', p({ nb_logements: 1 }), TERMINEE, 'terminee'],
  ['visite quittée en route', p({ nb_logements: 1 }), QUITTEE, 'quittee'],
  ['quittée avant toute action', VIDE, QUITTEE, 'quittee'],
]

for (const [note, prog, dates, attendu] of cas) {
  const a = avancement(prog, dates)
  noter(a.etat === attendu, `${note.padEnd(32)} → ${a.etat}`)
}

console.log('\n─── 2. L’étape courante suit les données ───────────────────────────────────')

const marches: [Partial<ProgressionVisite>, string][] = [
  [{}, 'logement'],
  [{ nb_logements: 1 }, 'locataire'],
  [{ nb_logements: 1, nb_locataires: 1 }, 'bail'],
  [{ nb_logements: 1, nb_locataires: 1, nb_baux: 1 }, 'paiement'],
  [{ nb_logements: 1, nb_locataires: 1, nb_baux: 1, nb_paiements: 1 }, 'quittance'],
]

for (const [prog, attendu] of marches) {
  const a = avancement(p(prog), JAMAIS)
  noter(
    ETAPES[a.index]?.cle === attendu,
    `${JSON.stringify(prog).slice(0, 48).padEnd(50)} → étape « ${ETAPES[a.index]?.cle} »`,
  )
}

const tout = p({
  nb_logements: 1,
  nb_locataires: 1,
  nb_baux: 1,
  nb_paiements: 1,
  nb_quittances: 1,
})
const complet = avancement(tout, JAMAIS)
noter(complet.complet, 'parcours entier accompli → `complet`')
noter(complet.index === ETAPES.length, "l'index dépasse la dernière étape")

console.log('\n─── 3. Ordre inattendu et reprise ──────────────────────────────────────────')

// Un bailleur qui explore seul peut créer un locataire avant un logement.
const desordre = avancement(p({ nb_locataires: 1 }), JAMAIS)
noter(
  ETAPES[desordre.index].cle === 'logement',
  'locataire créé avant logement → la visite pointe toujours le logement manquant',
)
noter(
  desordre.jalons.find((j) => j.cle === 'locataire')?.accompli === true,
  'et le jalon « locataire » est bien coché, sans attendre son tour',
)

// La reprise ne dépend d'aucun curseur : les mêmes données donnent la même étape.
const avant = avancement(p({ nb_logements: 2, nb_locataires: 1 }), JAMAIS)
const apresRedemarrage = avancement(p({ nb_logements: 2, nb_locataires: 1 }), JAMAIS)
noter(
  avant.index === apresRedemarrage.index,
  "après fermeture du navigateur, l'étape se recalcule à l'identique",
)

console.log('\n─── 4. Ouverture automatique ───────────────────────────────────────────────')

noter(ouvertureAutomatique(avancement(VIDE, JAMAIS)), 'compte neuf : la visite s’ouvre')
noter(
  !ouvertureAutomatique(avancement(p({ nb_logements: 1 }), TERMINEE)),
  'terminée : elle ne se rouvre pas',
)
noter(
  !ouvertureAutomatique(avancement(p({ nb_logements: 1 }), QUITTEE)),
  'quittée : elle ne s’impose plus',
)
noter(
  !ouvertureAutomatique(avancement(tout, JAMAIS)),
  'tout accompli sans l’avoir suivie : inutile de l’ouvrir',
)

console.log('\n─── 5. Les jalons ──────────────────────────────────────────────────────────')

const partiel = avancement(p({ nb_logements: 1, nb_locataires: 1 }), JAMAIS)
noter(partiel.jalons.length === ETAPES.length, `${ETAPES.length} jalons, un par étape`)
noter(
  partiel.jalons.filter((j) => j.accompli).length === 2,
  'deux jalons accomplis sur cinq',
)
noter(
  partiel.jalons.filter((j) => j.courant).length === 1,
  'exactement un jalon courant',
)
noter(
  partiel.jalons.find((j) => j.courant)?.cle === 'bail',
  'le jalon courant est le premier non accompli',
)

console.log('\n─── 6. Les textes ──────────────────────────────────────────────────────────')

for (const etape of ETAPES) {
  noter(
    etape.message.length > 0 && etape.message.length <= 220,
    `« ${etape.jalon} » : message de ${etape.message.length} caractères`,
  )
}

const interdits = /\bconforme\b|\bgarantie\b|100\s*%|irréfutable/i
const tousTextes = ETAPES.map((e) => `${e.titre} ${e.message}`).join(' ')
noter(!interdits.test(tousTextes), 'aucune promesse de conformité dans les textes')

console.log(
  echecs === 0 ? `\n✓ Aucun écart.\n` : `\n✗ ${echecs} écart${echecs > 1 ? 's' : ''}.\n`,
)

process.exit(echecs === 0 ? 0 : 1)
