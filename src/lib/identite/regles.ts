/**
 * Les règles de la photo de profil — sans dépendance, testables sans navigateur.
 *
 * ─── Ce que ce module décide, et ce qu'il ne décide pas ─────────────────────
 *
 * Il dit si une photo est *exploitable* comme photo de profil. Il ne dit rien
 * de l'identité de la personne dessus. Ce sont deux choses différentes, et les
 * confondre serait la faute la plus facile à commettre ici :
 *
 *   • valider une photo de profil = un visage est là, net, assez grand, cadré ;
 *   • vérifier une identité = confronter une personne à un document officiel.
 *
 * Sikaloc fait la première. La seconde n'est pas faite, pas commencée, et rien
 * dans l'interface ne doit laisser croire le contraire.
 *
 * ─── Pourquoi les seuils vivent ici ─────────────────────────────────────────
 *
 * Séparés de la bibliothèque qui les mesure : ils se relisent, se discutent et
 * se testent sans charger 30 Mo de modèles. Changer de moteur de détection
 * demain ne devrait pas changer ce qu'on considère comme une bonne photo.
 */

/** Part minimale de l'image occupée par le visage. */
export const PART_VISAGE_MINIMALE = 0.08
/** Au-delà, le visage déborde : photo prise de trop près, oreilles coupées. */
export const PART_VISAGE_MAXIMALE = 0.9
/** Confiance minimale du détecteur pour retenir un visage. */
export const CONFIANCE_MINIMALE = 0.5
/** Côté minimal de l'image, en pixels. En deçà, rien n'est exploitable. */
export const COTE_MINIMAL = 200
/** Le visage doit rester dans cette marge des bords, en part de l'image. */
export const MARGE_BORD = 0.02
/** Poids maximal accepté à l'envoi. Le navigateur réduit avant, c'est un rempart. */
export const POIDS_MAXIMAL = 3 * 1024 * 1024

/** Durée de la période pendant laquelle l'avatar tient lieu de photo. */
export const JOURS_AVATAR_TEMPORAIRE = 5

export type MotifRefus =
  | 'illisible'
  | 'trop_petite'
  | 'aucun_visage'
  | 'plusieurs_visages'
  | 'visage_trop_petit'
  | 'visage_trop_gros'
  | 'visage_coupe'
  | 'visage_peu_net'

/**
 * Ce qu'on montre au bailleur quand la photo ne convient pas.
 *
 * Un constat, puis quoi faire. Jamais de soupçon : quelqu'un dont la photo est
 * refusée a mal cadré, pas triché. Le ton du produit ne change pas parce qu'on
 * parle d'un visage.
 */
export const MESSAGES: Record<MotifRefus, { titre: string; conseil: string }> = {
  illisible: {
    titre: 'Fichier illisible',
    conseil: 'Choisissez une image au format JPEG, PNG ou WebP.',
  },
  trop_petite: {
    titre: 'Image trop petite',
    conseil: `Choisissez une image d’au moins ${COTE_MINIMAL} pixels de côté.`,
  },
  aucun_visage: {
    titre: 'Visage non détecté',
    conseil:
      'Utilisez une photo où votre visage est bien visible, de face et suffisamment éclairé.',
  },
  plusieurs_visages: {
    titre: 'Plusieurs visages détectés',
    conseil: 'Choisissez une photo où vous êtes seul.',
  },
  visage_trop_petit: {
    titre: 'Visage trop petit',
    conseil: 'Rapprochez-vous, ou recadrez la photo autour de votre visage.',
  },
  visage_trop_gros: {
    titre: 'Photo prise de trop près',
    conseil: 'Reculez un peu : le haut de la tête et le menton doivent tenir dans le cadre.',
  },
  visage_coupe: {
    titre: 'Visage coupé par le bord',
    conseil: 'Centrez votre visage dans la photo.',
  },
  visage_peu_net: {
    titre: 'Photo peu nette',
    conseil: 'Reprenez la photo en tenant l’appareil immobile, dans un endroit bien éclairé.',
  },
}

/** Mesures brutes rendues par le moteur de vision, indépendantes de sa marque. */
export interface MesuresVisage {
  largeurImage: number
  hauteurImage: number
  /** Un par visage détecté. */
  visages: {
    /** Coins, en pixels de l'image. */
    x: number
    y: number
    largeur: number
    hauteur: number
    confiance: number
  }[]
  /** Variance du laplacien, si le moteur a su la calculer. Plus haut = plus net. */
  nettete?: number
}

export interface Verdict {
  accepte: boolean
  motif?: MotifRefus
  /** Les contrôles passés, dans l'ordre, pour l'affichage pas à pas. */
  controles: { cle: string; libelle: string; ok: boolean }[]
}

/** Seuil de netteté. Volontairement bas : on écarte le flou franc, pas le grain. */
const NETTETE_MINIMALE = 12

/**
 * Applique les règles aux mesures.
 *
 * L'ordre compte : on signale la cause la plus en amont. Dire « visage trop
 * petit » à propos d'une image de 80 pixels serait exact et inutile.
 */
export function juger(mesures: MesuresVisage): Verdict {
  const { largeurImage: L, hauteurImage: H, visages } = mesures

  const controle = (cle: string, libelle: string, ok: boolean) => ({ cle, libelle, ok })

  if (L < COTE_MINIMAL || H < COTE_MINIMAL) {
    return {
      accepte: false,
      motif: 'trop_petite',
      controles: [controle('taille', 'Image exploitable', false)],
    }
  }

  const retenus = visages.filter((v) => v.confiance >= CONFIANCE_MINIMALE)

  const controles = [
    controle('taille', 'Image exploitable', true),
    controle('presence', 'Visage détecté', retenus.length >= 1),
    controle('unicite', 'Un seul visage', retenus.length === 1),
  ]

  if (retenus.length === 0) {
    return { accepte: false, motif: 'aucun_visage', controles }
  }
  if (retenus.length > 1) {
    return { accepte: false, motif: 'plusieurs_visages', controles }
  }

  const v = retenus[0]
  const part = (v.largeur * v.hauteur) / (L * H)
  const assezGrand = part >= PART_VISAGE_MINIMALE
  const pasTropGros = part <= PART_VISAGE_MAXIMALE

  const dansLeCadre =
    v.x >= -MARGE_BORD * L &&
    v.y >= -MARGE_BORD * H &&
    v.x + v.largeur <= L * (1 + MARGE_BORD) &&
    v.y + v.hauteur <= H * (1 + MARGE_BORD)

  controles.push(
    controle('cadrage', 'Visage bien cadré', assezGrand && pasTropGros && dansLeCadre),
  )

  if (!assezGrand) return { accepte: false, motif: 'visage_trop_petit', controles }
  if (!pasTropGros) return { accepte: false, motif: 'visage_trop_gros', controles }
  if (!dansLeCadre) return { accepte: false, motif: 'visage_coupe', controles }

  const net = mesures.nettete === undefined || mesures.nettete >= NETTETE_MINIMALE
  controles.push(controle('nettete', 'Photo nette', net))

  if (!net) return { accepte: false, motif: 'visage_peu_net', controles }

  return { accepte: true, controles }
}

// ─── Période d'avatar temporaire ────────────────────────────────────────────

export type StatutIdentite = 'photo' | 'temporaire' | 'expire'

export interface EtatIdentite {
  statut: StatutIdentite
  /** Jours restants avant expiration. 0 une fois la période écoulée. */
  joursRestants: number
  /** Faut-il rappeler au bailleur d'ajouter sa photo, et avec quelle insistance ? */
  rappel: 'aucun' | 'discret' | 'visible' | 'dernier' | 'permanent'
}

/**
 * Où en est le bailleur.
 *
 * La photo prime toujours : dès qu'elle existe, la période n'a plus de sens et
 * le rappel disparaît, quelle qu'ait été son ancienneté.
 *
 * L'expiration ne retire aucun droit. Elle rend le rappel permanent, et c'est
 * tout : à ce jour, personne d'autre que le bailleur ne voit sa photo, donc
 * restreindre son compte serait un coût réel pour un bénéfice nul. Ce choix est
 * à revoir le jour où l'espace locataire existera — c'est là que la photo
 * commencera à servir à quelqu'un d'autre qu'à son propriétaire.
 */
export function etatIdentite(bailleur: {
  photo_chemin: string | null
  avatar_temporaire_depuis: string | null
}): EtatIdentite {
  if (bailleur.photo_chemin) {
    return { statut: 'photo', joursRestants: 0, rappel: 'aucun' }
  }

  if (!bailleur.avatar_temporaire_depuis) {
    return { statut: 'temporaire', joursRestants: JOURS_AVATAR_TEMPORAIRE, rappel: 'discret' }
  }

  const debut = new Date(bailleur.avatar_temporaire_depuis).getTime()
  const jours = Math.floor((Date.now() - debut) / 86_400_000)
  const restants = Math.max(0, JOURS_AVATAR_TEMPORAIRE - jours)

  if (restants === 0) {
    return { statut: 'expire', joursRestants: 0, rappel: 'permanent' }
  }

  // Discret les deux premiers jours, plus visible au troisième, insistant au
  // dernier. Un rappel qui crie dès le premier jour n'est plus un rappel.
  const rappel = jours <= 1 ? 'discret' : jours <= 2 ? 'visible' : 'dernier'

  return { statut: 'temporaire', joursRestants: restants, rappel }
}

/** Le texte du rappel, selon l'insistance. Jamais accusateur, jamais alarmiste. */
export function messageRappel(etat: EtatIdentite): string | null {
  switch (etat.rappel) {
    case 'aucun':
      return null
    case 'discret':
      return 'Ajoutez votre photo de profil pour compléter votre compte.'
    case 'visible':
      return `Votre avatar est temporaire. Il vous reste ${etat.joursRestants} jour${
        etat.joursRestants > 1 ? 's' : ''
      } pour ajouter votre photo.`
    case 'dernier':
      return `Dernier jour : ajoutez votre photo de profil pour remplacer votre avatar.`
    case 'permanent':
      return 'Votre période d’avatar temporaire est écoulée. Ajoutez votre photo de profil.'
  }
}
