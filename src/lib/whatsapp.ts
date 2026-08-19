import { formaterDate, formaterFCFA, formaterPeriode } from '@/lib/format'

/**
 * Liens WhatsApp — spec §6.1.9 et §6.1.11.
 *
 * Aucune API WhatsApp Business dans le MVP : on construit un lien `wa.me` avec
 * le message pré-rempli, le bailleur appuie lui-même sur « Envoyer ».
 */

/**
 * Normalise un numéro béninois au format international sans « + ».
 *
 * `wa.me` n'accepte ni espaces, ni tirets, ni indicatif préfixé de zéros. Un
 * numéro local à 8 ou 10 chiffres est préfixé de l'indicatif Bénin (229).
 */
export function normaliserNumero(telephone: string, indicatifDefaut = '229'): string {
  let chiffres = telephone.replace(/[^\d+]/g, '')

  if (chiffres.startsWith('+')) return chiffres.slice(1)
  if (chiffres.startsWith('00')) return chiffres.slice(2)

  // Numéro national écrit avec un zéro de tête.
  chiffres = chiffres.replace(/^0+/, '')

  // Déjà préfixé de l'indicatif : on ne le double pas.
  if (chiffres.startsWith(indicatifDefaut)) return chiffres

  return `${indicatifDefaut}${chiffres}`
}

function lienWaMe(telephone: string, message: string): string {
  return `https://wa.me/${normaliserNumero(telephone)}?text=${encodeURIComponent(message)}`
}

/** Prénom = premier mot du nom complet. */
function prenom(nomComplet: string): string {
  return nomComplet.trim().split(/\s+/)[0] ?? nomComplet
}

export interface DonneesRelance {
  locataireNom: string
  locataireTelephone: string
  periodeDebut: string
  montantDu: number
  dateEcheance: string
  bailleurNom: string
}

/** Message de relance d'impayé — texte de la spec §6.1.9, à l'identique. */
export function lienRelanceImpaye(donnees: DonneesRelance): string {
  const message = [
    `Bonjour ${prenom(donnees.locataireNom)},`,
    '',
    `J'espère que vous allez bien. Je vous rappelle que le loyer de ${formaterPeriode(donnees.periodeDebut)} s'élève à ${formaterFCFA(donnees.montantDu)} et était dû le ${formaterDate(donnees.dateEcheance)}.`,
    '',
    'Pourriez-vous procéder au règlement dès que possible ? Merci beaucoup.',
    '',
    donnees.bailleurNom,
    'Bailleur — Sikaloc',
  ].join('\n')

  return lienWaMe(donnees.locataireTelephone, message)
}

export interface DonneesEnvoiQuittance {
  locataireNom: string
  locataireTelephone: string
  periodeDebut: string
  lienTelechargement: string
  bailleurNom: string
  typeDocument: 'Quittance' | 'Reçu'
}

/** Message d'envoi de quittance — texte de la spec §6.1.11. */
export function lienEnvoiQuittance(donnees: DonneesEnvoiQuittance): string {
  const article = donnees.typeDocument === 'Quittance' ? 'votre quittance' : 'votre reçu'

  const message = [
    `Bonjour ${prenom(donnees.locataireNom)},`,
    '',
    `Veuillez trouver ci-joint ${article} pour le loyer de ${formaterPeriode(donnees.periodeDebut)}.`,
    '',
    `Téléchargement : ${donnees.lienTelechargement}`,
    '',
    '(Lien valable 30 jours)',
    '',
    donnees.bailleurNom,
  ].join('\n')

  return lienWaMe(donnees.locataireTelephone, message)
}

/** Invitation de parrainage — spec §4.5. */
export function lienParrainage(lienInscription: string, bailleurNom: string): string {
  const message = [
    'Bonjour,',
    '',
    `J'utilise Sikaloc pour gérer mes loyers : quittances conformes en 3 clics, suivi des impayés, envoi au locataire par WhatsApp.`,
    '',
    `Inscrivez-vous avec mon lien et nous recevons chacun 1 mois offert : ${lienInscription}`,
    '',
    bailleurNom,
  ].join('\n')

  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
