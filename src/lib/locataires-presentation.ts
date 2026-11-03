/** Le bail conserve le locataire et son historique : il bloque sa suppression. */
export function peutSupprimerLocataire(nombreBaux: number): boolean {
  return nombreBaux === 0
}

export type InvitationLocatairePresentation = {
  cree_le: string
  expire_le: string
  utilisee_le: string | null
  annulee_le: string | null
}

export type ActionInvitationLocataire = 'inviter' | 'renvoyer' | null

export type PresentationAccesMe = {
  libelle: string
  ton: 'positive' | 'warning' | 'neutral'
  action: ActionInvitationLocataire
  emailRequis: boolean
  renvoiTemporise: boolean
}

/**
 * Présente l'accès Me sans confondre l'invitation, son acceptation et le bail.
 * Une lecture indisponible ou un rattachement incohérent ne rend jamais une
 * action d'invitation disponible par défaut.
 */
export function presenterAccesMe({
  compteLie,
  invitation,
  erreurChargement = false,
  emailDisponible,
  delaiRenvoiSecondes,
  maintenant = Date.now(),
}: {
  compteLie: boolean
  invitation: InvitationLocatairePresentation | null
  erreurChargement?: boolean
  emailDisponible: boolean
  delaiRenvoiSecondes: number
  maintenant?: number
}): PresentationAccesMe {
  if (compteLie) {
    return { libelle: 'Accès Me actif', ton: 'positive', action: null, emailRequis: false, renvoiTemporise: false }
  }

  if (erreurChargement) {
    return { libelle: 'Statut Me indisponible', ton: 'neutral', action: null, emailRequis: false, renvoiTemporise: false }
  }

  if (invitation?.utilisee_le) {
    return { libelle: 'Rattachement à vérifier', ton: 'warning', action: null, emailRequis: false, renvoiTemporise: false }
  }

  if (!invitation) {
    return emailDisponible
      ? { libelle: 'Non invité', ton: 'neutral', action: 'inviter', emailRequis: false, renvoiTemporise: false }
      : { libelle: 'E-mail requis pour Me', ton: 'neutral', action: null, emailRequis: false, renvoiTemporise: false }
  }

  const creeLe = Date.parse(invitation.cree_le)
  if (!Number.isFinite(creeLe)) {
    return { libelle: 'Statut Me indisponible', ton: 'neutral', action: null, emailRequis: false, renvoiTemporise: false }
  }
  const secondesRestantes = Math.ceil((creeLe + delaiRenvoiSecondes * 1000 - maintenant) / 1000)
  const renvoiTemporise = secondesRestantes > 0

  if (invitation.annulee_le) {
    return {
      libelle: 'Invitation annulée',
      ton: 'neutral',
      action: emailDisponible && !renvoiTemporise ? 'inviter' : null,
      emailRequis: !emailDisponible,
      renvoiTemporise: emailDisponible && renvoiTemporise,
    }
  }

  const expiration = Date.parse(invitation.expire_le)
  if (!Number.isFinite(expiration)) {
    return { libelle: 'Statut Me indisponible', ton: 'neutral', action: null, emailRequis: false, renvoiTemporise: false }
  }

  const expiree = expiration <= maintenant
  return {
    libelle: expiree ? 'Invitation expirée' : 'Invitation en attente',
    ton: 'warning',
    action: emailDisponible && !renvoiTemporise ? 'renvoyer' : null,
    emailRequis: !emailDisponible,
    renvoiTemporise: emailDisponible && renvoiTemporise,
  }
}

/** Résume les baux sans confondre un historique résilié et l'absence de bail. */
export function presenterSituationLocative(
  baux: ReadonlyArray<{ statut: string }> | null | undefined,
): string {
  const liste = baux ?? []
  const actifs = liste.filter((bail) => bail.statut === 'Actif').length

  if (actifs > 0) return `${actifs} ${actifs > 1 ? 'baux' : 'bail'} actif${actifs > 1 ? 's' : ''}`
  if (liste.length === 0) return 'Sans bail'

  const resilies = liste.filter((bail) => bail.statut === 'Résilié').length
  if (resilies === liste.length) {
    return `${resilies} ${resilies > 1 ? 'baux' : 'bail'} résilié${resilies > 1 ? 's' : ''}`
  }

  return 'Bail à vérifier'
}
