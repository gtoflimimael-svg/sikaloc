/**
 * Identité faciale — descripteurs et comparaison. **NON ACTIVÉ.**
 *
 * ─── Pourquoi ce fichier existe sans que rien ne l'appelle ──────────────────
 *
 * Il fixe la forme qu'aura la comparaison faciale le jour où elle sera décidée,
 * pour qu'elle n'ait pas à être inventée dans l'urgence — et pour que la
 * décision de l'activer reste une décision, pas un effet de bord d'un
 * développement.
 *
 * Aucun appelant dans le dépôt. `grep -rn "empreinte" src/` doit continuer de
 * ne rendre que ce fichier tant que les conditions ci-dessous ne sont pas
 * réunies.
 *
 * ─── Ce qui manque avant d'activer ──────────────────────────────────────────
 *
 * Un descripteur facial est une donnée biométrique : article 9 du RGPD,
 * catégorie particulière. Le conserver impose, au minimum :
 *
 *   1. une base légale explicite — le consentement, ici, puisqu'aucune autre
 *      ne tient pour un service de gestion locative ;
 *   2. une mention dans la politique de confidentialité, qui n'en dit rien ;
 *   3. une analyse d'impact (AIPD), qui n'existe pas ;
 *   4. une durée de conservation et un effacement, à écrire ;
 *   5. des mentions légales publiées — `/legal/mentions` répond encore 404 ;
 *   6. un avis juridique sur le droit béninois applicable.
 *
 * Tant que ces six points ne sont pas traités, la base ne porte aucune colonne
 * pour les accueillir, et c'est délibéré : on ne peut pas fuiter ce qu'on n'a
 * pas collecté.
 *
 * ─── Et quand ce sera activé ────────────────────────────────────────────────
 *
 * Une correspondance faciale n'est **jamais** une preuve d'identité. Elle dit
 * que deux images se ressemblent, avec une marge d'erreur. Aucun message de
 * Sikaloc ne devra présenter un `correspond: true` comme une vérification
 * d'identité — la nuance est exactement celle qui sépare ce produit d'un
 * dispositif KYC, qui n'est pas ce qu'il est.
 */

import type { Verdict } from '@/lib/identite/regles'

/**
 * Empreinte faciale : 128 nombres décrivant un visage.
 *
 * Elle ne permet pas de reconstituer l'image, mais elle identifie une personne
 * de manière stable — c'est précisément ce qui en fait une donnée biométrique.
 */
export type Empreinte = Float32Array

/** Seuil usuel de face-api. En deçà, deux visages sont considérés proches. */
export const DISTANCE_CORRESPONDANCE = 0.6

export interface Correspondance {
  /** Distance euclidienne entre les deux empreintes. Plus bas = plus proche. */
  distance: number
  /**
   * Les deux visages se ressemblent-ils, au seuil retenu ?
   *
   * Une ressemblance, pas une identité. Ne jamais présenter ce booléen comme
   * une vérification d'identité.
   */
  proche: boolean
}

/**
 * Calcule l'empreinte d'un visage.
 *
 * Volontairement non implémentée : l'écrire reviendrait à rendre son appel
 * possible d'un import, et la seule garantie solide contre un stockage
 * biométrique accidentel est qu'il n'y ait rien à appeler.
 *
 * Le jour venu : charger `faceLandmark68Net` et `faceRecognitionNet` depuis
 * `/modeles/visage`, puis `detectSingleFace().withFaceLandmarks().withFaceDescriptor()`.
 * Compter ~7 Mo de modèles supplémentaires, à charger à la demande et jamais
 * sur le chemin d'une simple photo de profil.
 */
export async function calculerEmpreinte(_image: HTMLCanvasElement): Promise<Empreinte> {
  throw new Error(
    'Empreinte faciale non activée : voir les six conditions en tête de ' +
      'src/lib/identite/empreinte.ts avant toute implémentation.',
  )
}

/**
 * Compare deux empreintes.
 *
 * Pure et sans dépendance — c'est la partie qui n'a jamais besoin de changer,
 * quel que soit le moteur qui produit les empreintes.
 */
export function comparer(a: Empreinte, b: Empreinte): Correspondance {
  if (a.length !== b.length) {
    throw new Error('Empreintes de dimensions différentes.')
  }

  let somme = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    somme += d * d
  }

  const distance = Math.sqrt(somme)
  return { distance, proche: distance < DISTANCE_CORRESPONDANCE }
}

/**
 * Garde-fou de journalisation.
 *
 * Si une empreinte devait un jour traverser un journal ou une réponse d'API,
 * ce serait par inadvertance — un objet passé en entier à `console.log`, un
 * `select('*')` de trop. Cette fonction existe pour qu'il y ait toujours une
 * façon évidente de rendre une empreinte inoffensive avant de l'afficher.
 */
export function masquer(_empreinte: Empreinte): string {
  return '[empreinte faciale — non journalisable]'
}

/** Le verdict d'une photo ne contient jamais d'empreinte. Vérifié par le banc. */
export function verdictSansDonneeFaciale(verdict: Verdict): boolean {
  return !JSON.stringify(verdict).includes('descriptor')
}
