import { juger, type MesuresVisage, type Verdict } from '@/lib/identite/regles'

/**
 * Sikaloc Identity Engine — la seule porte d'entrée.
 *
 * ─── Pourquoi cette couche existe ───────────────────────────────────────────
 *
 *     analyserPhoto()                    ← ce que le reste de Sikaloc appelle
 *            │
 *            ├── regles.ts               les seuils, purs, sans dépendance
 *            │
 *            ├── Qualité / Vision
 *            │     └── vision-face-api   analyse d'une image fixe   [ACTIF]
 *            │     └── vision-mediapipe  cadrage en direct          [à venir]
 *            │
 *            └── Identité faciale
 *                  └── empreinte.ts      descripteurs, comparaison  [PRÉPARÉ]
 *
 * Aucun composant n'importe jamais `@vladmandic/face-api` directement. Changer
 * de moteur — ou en ajouter un pour la caméra — se fait ici, sans toucher à un
 * seul écran.
 *
 * ─── Ce qui tourne, et où ───────────────────────────────────────────────────
 *
 * Tout dans le navigateur du bailleur. La photo n'atteint le serveur que si
 * elle a été acceptée, et seulement comme image : jamais son analyse, jamais un
 * descripteur, jamais une mesure de visage. Le serveur ne reçoit pas « voici un
 * visage de tel écartement », il reçoit un fichier.
 *
 * Trois raisons, dans cet ordre : une photo écartée n'a aucune raison de
 * quitter l'appareil ; le serveur n'a pas à porter de calcul biométrique ; et
 * ce qui n'est jamais transmis n'a pas à être protégé.
 *
 * ─── Le mot « identité » ────────────────────────────────────────────────────
 *
 * Ce moteur juge si une photo est **exploitable**. Il ne vérifie l'identité de
 * personne. Aucun message de l'interface ne doit suggérer le contraire.
 */

export type { Verdict, MesuresVisage } from '@/lib/identite/regles'
export {
  MESSAGES,
  etatIdentite,
  messageRappel,
  JOURS_AVATAR_TEMPORAIRE,
  POIDS_MAXIMAL,
  type EtatIdentite,
  type MotifRefus,
  type StatutIdentite,
} from '@/lib/identite/regles'

/**
 * Analyse une photo choisie par le bailleur.
 *
 * Le moteur de vision est chargé à la demande : ~1,4 Mo qui ne pèsent que sur
 * l'écran photo, et jamais sur une page de connexion ouverte depuis un
 * téléphone.
 */
export async function analyserPhoto(fichier: File): Promise<Verdict> {
  const { mesurer } = await import('@/lib/identite/vision-face-api')

  let mesures: MesuresVisage
  try {
    mesures = await mesurer(fichier)
  } catch {
    // Fichier corrompu, format que le navigateur ne sait pas décoder, mémoire
    // insuffisante : tout cela se répond de la même façon à l'utilisateur.
    return {
      accepte: false,
      motif: 'illisible',
      controles: [{ cle: 'taille', libelle: 'Image exploitable', ok: false }],
    }
  }

  return juger(mesures)
}
