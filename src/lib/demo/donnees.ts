export type StatutPeriodeDemo = 'regle' | 'partiel' | 'impaye'
export type StatutCandidatureDemo = 'nouvelle' | 'a_etudier' | 'acceptee' | 'refusee'

export interface ProfilDemo {
  id: string
  nom: string
  role: 'pro' | 'me' | 'find'
  libelle: string
  organisation?: string
}

export interface LogementDemo {
  id: string
  proprietaireId: string
  titre: string
  ville: string
  quartier: string
  type: string
  loyer: number
  chambres: number
  surface: number
  statut: 'occupe' | 'disponible'
  publie: boolean
  description: string
  equipements: string[]
}

export interface BailDemo {
  id: string
  logementId: string
  proprietaireId: string
  locataireId: string
  debut: string
  fin?: string
  statut: 'actif' | 'termine'
  loyer: number
}

export interface PeriodeDemo {
  id: string
  bailId: string
  mois: string
  echeance: string
  montantDu: number
  montantRegle: number
  statut: StatutPeriodeDemo
}

export interface PaiementDemo {
  id: string
  periodeId: string
  date: string
  montant: number
  moyen: string
}

export interface CandidatureDemo {
  id: string
  logementId: string
  candidatId: string
  date: string
  statut: StatutCandidatureDemo
  message: string
}

export interface DonneesDemo {
  logements: LogementDemo[]
  baux: BailDemo[]
  periodes: PeriodeDemo[]
  paiements: PaiementDemo[]
  candidatures: CandidatureDemo[]
}

export const PROFILS_DEMO: ProfilDemo[] = [
  { id: 'pro-petit', nom: 'Aïcha Kora', role: 'pro', libelle: 'Petit portefeuille', organisation: '2 logements' },
  { id: 'pro-actif', nom: 'Mariam Adandé', role: 'pro', libelle: 'Bailleur actif', organisation: '2 logements' },
  { id: 'pro-gestion', nom: 'Maison Élan', role: 'pro', libelle: 'Gestionnaire', organisation: '2 logements' },
  { id: 'me-ada', nom: 'Ada Sossou', role: 'me', libelle: 'Locataire · compte A' },
  { id: 'me-bio', nom: 'Bio Kponton', role: 'me', libelle: 'Locataire · compte B' },
  { id: 'me-celestin', nom: 'Célestin Hounkpatin', role: 'me', libelle: 'Locataire · compte C' },
  { id: 'me-dossi', nom: 'Dossi Ahouansou', role: 'me', libelle: 'Locataire · compte D' },
  { id: 'me-espoir', nom: 'Espoir Zinsou', role: 'me', libelle: 'Locataire · compte E' },
  { id: 'me-farida', nom: 'Farida Sènou', role: 'me', libelle: 'Locataire · compte F' },
  { id: 'me-ghislain', nom: 'Ghislain Toko', role: 'me', libelle: 'Locataire · compte G' },
  { id: 'find-amina', nom: 'Amina Yayi', role: 'find', libelle: 'Candidat · profil A' },
  { id: 'find-koffi', nom: 'Koffi Hounsa', role: 'find', libelle: 'Candidat · profil B' },
]

export const LOCATAIRES_DEMO = [
  { id: 'loc-ada', nom: 'Ada Sossou', profilId: 'me-ada' },
  { id: 'loc-bio', nom: 'Bio Kponton', profilId: 'me-bio' },
  { id: 'loc-celestin', nom: 'Célestin Hounkpatin', profilId: 'me-celestin' },
  { id: 'loc-dossi', nom: 'Dossi Ahouansou', profilId: 'me-dossi' },
  { id: 'loc-espoir', nom: 'Espoir Zinsou', profilId: 'me-espoir' },
  { id: 'loc-farida', nom: 'Farida Sènou', profilId: 'me-farida' },
  { id: 'loc-ghislain', nom: 'Ghislain Toko', profilId: 'me-ghislain' },
] as const

export const CANDIDATS_DEMO = [
  { id: 'find-amina', nom: 'Amina Yayi' },
  { id: 'find-koffi', nom: 'Koffi Hounsa' },
] as const

const PROPRIETAIRES = ['pro-petit', 'pro-actif', 'pro-gestion']

const LOGEMENTS_INITIAUX: LogementDemo[] = [
  { id: 'log-01', proprietaireId: PROPRIETAIRES[0], titre: 'Studio lumineux', ville: 'Cotonou', quartier: 'Cadjèhoun', type: 'Studio', loyer: 65000, chambres: 1, surface: 28, statut: 'occupe', publie: false, description: 'Un studio fonctionnel dans un quartier résidentiel, à proximité des commerces.', equipements: ['electricite', 'cuisine_interieure'] },
  { id: 'log-02', proprietaireId: PROPRIETAIRES[0], titre: 'Appartement familial', ville: 'Abomey-Calavi', quartier: 'Zogbadjè', type: 'Appartement', loyer: 115000, chambres: 2, surface: 64, statut: 'occupe', publie: false, description: 'Un appartement de deux chambres avec un séjour traversant.', equipements: ['cour_cloturee', 'eau_courante'] },
  { id: 'log-03', proprietaireId: PROPRIETAIRES[1], titre: 'Appartement du Patio', ville: 'Cotonou', quartier: 'Fidjrossè', type: 'Appartement', loyer: 140000, chambres: 2, surface: 72, statut: 'occupe', publie: false, description: 'Un logement aéré avec balcon, dans un secteur calme de Fidjrossè.', equipements: ['cour_cloturee', 'cuisine_interieure'] },
  { id: 'log-04', proprietaireId: PROPRIETAIRES[1], titre: 'Deux-pièces des Cocotiers', ville: 'Cotonou', quartier: 'Agla', type: 'Appartement', loyer: 95000, chambres: 2, surface: 56, statut: 'disponible', publie: true, description: 'Un deux-pièces pratique, avec accès facile aux axes principaux.', equipements: ['cour_cloturee', 'compteur_electrique_individuel'] },
  { id: 'log-05', proprietaireId: PROPRIETAIRES[2], titre: 'Maison Cour Verte', ville: 'Porto-Novo', quartier: 'Ouando', type: 'Maison', loyer: 180000, chambres: 3, surface: 118, statut: 'occupe', publie: false, description: 'Une maison familiale organisée autour d’une cour intérieure.', equipements: ['cour_cloturee', 'eau_courante'] },
  { id: 'log-06', proprietaireId: PROPRIETAIRES[2], titre: 'Studio près du marché', ville: 'Abomey-Calavi', quartier: 'Arconville', type: 'Studio', loyer: 55000, chambres: 1, surface: 25, statut: 'disponible', publie: true, description: 'Un studio compact et bien ventilé, disponible à la visite.', equipements: ['electricite', 'cour_cloturee'] },
]

const BAUX_INITIAUX: BailDemo[] = [
  { id: 'bail-01', logementId: 'log-01', proprietaireId: PROPRIETAIRES[0], locataireId: 'loc-farida', debut: '2026-01-01', fin: '2026-05-31', statut: 'termine', loyer: 65000 },
  { id: 'bail-02', logementId: 'log-02', proprietaireId: PROPRIETAIRES[0], locataireId: 'loc-bio', debut: '2026-06-01', statut: 'actif', loyer: 115000 },
  { id: 'bail-03', logementId: 'log-03', proprietaireId: PROPRIETAIRES[1], locataireId: 'loc-celestin', debut: '2026-06-01', statut: 'actif', loyer: 140000 },
  { id: 'bail-04', logementId: 'log-03', proprietaireId: PROPRIETAIRES[1], locataireId: 'loc-dossi', debut: '2026-01-01', fin: '2026-05-31', statut: 'termine', loyer: 140000 },
  { id: 'bail-05', logementId: 'log-05', proprietaireId: PROPRIETAIRES[2], locataireId: 'loc-ghislain', debut: '2026-01-01', fin: '2026-05-31', statut: 'termine', loyer: 180000 },
  { id: 'bail-06', logementId: 'log-04', proprietaireId: PROPRIETAIRES[1], locataireId: 'loc-celestin', debut: '2026-01-01', fin: '2026-05-31', statut: 'termine', loyer: 95000 },
  { id: 'bail-07', logementId: 'log-05', proprietaireId: PROPRIETAIRES[2], locataireId: 'loc-espoir', debut: '2026-06-01', statut: 'actif', loyer: 180000 },
  { id: 'bail-08', logementId: 'log-06', proprietaireId: PROPRIETAIRES[2], locataireId: 'loc-espoir', debut: '2026-01-01', fin: '2026-05-31', statut: 'termine', loyer: 55000 },
  { id: 'bail-09', logementId: 'log-01', proprietaireId: PROPRIETAIRES[0], locataireId: 'loc-ada', debut: '2026-06-01', statut: 'actif', loyer: 65000 },
]

const MOIS_ACTIFS = [
  { libelle: 'Juin 2026', cle: '2026-06', echeance: '2026-06-05' },
  { libelle: 'Juillet 2026', cle: '2026-07', echeance: '2026-07-05' },
  { libelle: 'Août 2026', cle: '2026-08', echeance: '2026-08-05' },
  { libelle: 'Septembre 2026', cle: '2026-09', echeance: '2026-09-05' },
  { libelle: 'Octobre 2026', cle: '2026-10', echeance: '2026-10-05' },
]

const MOIS_ARCHIVES = [
  { libelle: 'Janvier 2026', cle: '2026-01', echeance: '2026-01-05' },
  { libelle: 'Février 2026', cle: '2026-02', echeance: '2026-02-05' },
  { libelle: 'Mars 2026', cle: '2026-03', echeance: '2026-03-05' },
  { libelle: 'Avril 2026', cle: '2026-04', echeance: '2026-04-05' },
  { libelle: 'Mai 2026', cle: '2026-05', echeance: '2026-05-05' },
]

const STATUTS_PAR_BAIL: StatutPeriodeDemo[][] = [
  ['regle', 'regle', 'regle', 'regle', 'regle'],
  ['regle', 'regle', 'regle', 'regle', 'regle'],
  ['regle', 'regle', 'regle', 'partiel', 'impaye'],
  ['regle', 'regle', 'regle', 'regle', 'regle'],
  ['regle', 'regle', 'regle', 'regle', 'impaye'],
  ['regle', 'regle', 'regle', 'regle', 'regle'],
  ['regle', 'regle', 'regle', 'partiel', 'impaye'],
  ['regle', 'regle', 'regle', 'regle', 'regle'],
  ['regle', 'regle', 'regle', 'regle', 'regle'],
]

function distribuerMontant(total: number, parts: number): number[] {
  const montantParPart = Math.floor(total / parts)
  return Array.from({ length: parts }, (_, index) =>
    index === parts - 1 ? total - montantParPart * (parts - 1) : montantParPart,
  )
}

function creerPeriodesEtPaiements() {
  const periodes: PeriodeDemo[] = []
  const paiements: PaiementDemo[] = []

  BAUX_INITIAUX.forEach((bail, bailIndex) => {
    const mois = bail.statut === 'termine' ? MOIS_ARCHIVES : MOIS_ACTIFS
    STATUTS_PAR_BAIL[bailIndex].forEach((statut, moisIndex) => {
      const periode = mois[moisIndex]
      const periodeId = `${bail.id}-${periode.cle}`
      const montantRegle = statut === 'regle'
        ? bail.loyer
        : statut === 'partiel'
          ? Math.floor(bail.loyer / 2)
          : 0
      periodes.push({
        id: periodeId,
        bailId: bail.id,
        mois: periode.libelle,
        echeance: periode.echeance,
        montantDu: bail.loyer,
        montantRegle,
        statut,
      })

      const nombreVersements = statut === 'partiel' ? (bailIndex === 2 ? 2 : 3) : 1
      const montants = statut === 'impaye'
        ? []
        : distribuerMontant(montantRegle, nombreVersements)

      montants.forEach((montant, versementIndex) => {
        paiements.push({
          id: `paiement-demo-${bailIndex + 1}-${moisIndex + 1}-${versementIndex + 1}`,
          periodeId,
          date: `${periode.cle}-${String(10 + versementIndex * 4).padStart(2, '0')}`,
          montant,
          moyen: versementIndex % 2 === 0 ? 'Virement (exemple)' : 'Espèces (exemple)',
        })
      })
    })
  })

  return { periodes, paiements }
}

const CANDIDATURES_INITIALES: CandidatureDemo[] = [
  { id: 'cand-01', logementId: 'log-04', candidatId: 'find-amina', date: '2026-10-03', statut: 'nouvelle', message: 'Je souhaite connaître les créneaux de visite disponibles.' },
  { id: 'cand-02', logementId: 'log-04', candidatId: 'find-koffi', date: '2026-10-04', statut: 'a_etudier', message: 'Le logement correspond à ma recherche. Je reste disponible pour échanger.' },
  { id: 'cand-03', logementId: 'log-06', candidatId: 'find-amina', date: '2026-10-05', statut: 'acceptee', message: 'Je peux me rendre disponible pour une visite cette semaine.' },
  { id: 'cand-04', logementId: 'log-06', candidatId: 'find-koffi', date: '2026-10-06', statut: 'refusee', message: 'Merci de me préciser les conditions de location.' },
]

export function creerDonneesDemo(): DonneesDemo {
  const { periodes, paiements } = creerPeriodesEtPaiements()

  return {
    logements: LOGEMENTS_INITIAUX.map((logement) => ({ ...logement, equipements: [...logement.equipements] })),
    baux: BAUX_INITIAUX.map((bail) => ({ ...bail })),
    periodes,
    paiements,
    candidatures: CANDIDATURES_INITIALES.map((candidature) => ({ ...candidature })),
  }
}

