import {
  Document,
  Image,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer'

import { formaterDate, formaterFCFA, formaterHorodatage, formaterPeriode } from '@/lib/format'
import { couleurs, LogoMarque } from '@/lib/pdf/base'
import { montantEnLettresCapitalise } from '@/lib/montant-en-lettres'
import { formaterTelephone } from '@/lib/telephone'
import type { TypePaiement } from '@/lib/types/database'

/**
 * Quittance de loyer / Reçu — template Bénin.
 * Mentions obligatoires : spec §6.1.10.
 *
 * Polices et palette partagées avec les autres documents via `pdf/base.tsx`.
 */

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 42,
    fontFamily: 'Inter',
    fontSize: 10,
    color: couleurs.body,
    // 1.4 plutôt que 1.5 : la quittance doit tenir sur une seule page, une
    // mention légale reportée en page 2 passerait inaperçue.
    lineHeight: 1.4,
  },

  enTete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: couleurs.hairline,
    paddingBottom: 10,
    marginBottom: 12,
  },
  marque: { flexDirection: 'row', alignItems: 'center' },
  blocNumero: { alignItems: 'flex-end' },
  etiquetteNumero: { fontSize: 7.5, color: couleurs.mute, textTransform: 'uppercase', letterSpacing: 0.45 },
  numero: { fontFamily: 'Inter', fontWeight: 600, fontSize: 10.5, color: couleurs.ink },
  bandeauApercu: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 12,
    borderLeftWidth: 2,
    borderLeftColor: couleurs.primary,
    backgroundColor: couleurs.canvasSoft,
  },
  etiquetteApercu: {
    color: couleurs.primary,
    fontSize: 7.5,
    fontFamily: 'Inter',
    fontWeight: 600,
    letterSpacing: 0.7,
  },
  mentionApercu: {
    color: couleurs.mute,
    fontSize: 7,
    textAlign: 'right',
    letterSpacing: 0.25,
  },

  titre: {
    fontFamily: 'Manrope',
    fontWeight: 800,
    fontSize: 22,
    lineHeight: 1.15,
    color: couleurs.ink,
    letterSpacing: -0.6,
    marginBottom: 3,
  },
  sousTitre: { fontFamily: 'Manrope', fontWeight: 500, fontSize: 9.5, color: couleurs.mute, marginBottom: 12 },

  // Bandeau de synthèse — loyer, montant réglé, solde : lisible d'un regard,
  // sans avoir à parcourir le détail du paiement pour se faire une idée.
  recapitulatif: {
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: couleurs.hairline,
  },
  recapCellule: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: couleurs.hairline,
  },
  recapEtiquette: {
    fontFamily: 'Inter',
    fontWeight: 500,
    fontSize: 7.5,
    color: couleurs.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  recapValeur: { fontFamily: 'Manrope', fontWeight: 700, fontSize: 12, color: couleurs.ink },

  colonnes: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  colonne: {
    flex: 1,
    backgroundColor: couleurs.canvasSoft,
    borderRadius: 6,
    padding: 10,
  },
  etiquetteBloc: {
    fontFamily: 'Inter',
    fontWeight: 500,
    fontSize: 8,
    color: couleurs.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  nomPartie: { fontFamily: 'Inter', fontWeight: 600, fontSize: 11, color: couleurs.ink },
  lignePartie: { fontSize: 9, color: couleurs.body },

  section: { marginBottom: 8 },
  titreSection: {
    fontFamily: 'Manrope',
    fontWeight: 700,
    fontSize: 10.5,
    color: couleurs.ink,
    marginBottom: 6,
  },

  ligne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3.5,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.hairline,
  },
  ligneEtiquette: { fontSize: 9.5, color: couleurs.mute },
  ligneValeur: { fontSize: 9.5, color: couleurs.ink, fontFamily: 'Inter', fontWeight: 600 },

  encadreMontant: {
    backgroundColor: couleurs.primaryPale,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: couleurs.primary,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  etiquetteMontant: { fontFamily: 'Inter', fontWeight: 500, fontSize: 8.5, color: couleurs.inkDeep, marginBottom: 2 },
  montantChiffres: {
    fontFamily: 'Manrope',
    fontWeight: 800,
    fontSize: 19,
    lineHeight: 1.2,
    color: couleurs.primary,
    letterSpacing: -0.4,
  },
  montantLettres: {
    // L'espacement sépare le montant en lettres de son montant chiffré sans
    // introduire une autre police que la famille officielle Inter.
    fontSize: 9,
    color: couleurs.primary,
    letterSpacing: 0.2,
    marginTop: 3,
  },

  decharge: {
    borderLeftWidth: 3,
    borderLeftColor: couleurs.signature,
    paddingLeft: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  texteDecharge: { fontSize: 9.5, color: couleurs.ink, lineHeight: 1.45 },

  encadreTimbre: {
    backgroundColor: couleurs.warningPale,
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  texteTimbre: { fontSize: 7.5, color: couleurs.warningContent, lineHeight: 1.35 },

  mentionLegale: {
    fontSize: 7,
    color: couleurs.mute,
    lineHeight: 1.4,
    marginBottom: 4,
  },

  // Deux signataires côte à côte : le document vaut décharge pour les deux
  // parties, la signature du locataire a donc la même place que la vôtre.
  blocSignature: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  cadreSignature: { flex: 1, alignItems: 'center' },
  etiquetteSignature: { fontFamily: 'Inter', fontWeight: 500, fontSize: 8, color: couleurs.mute, marginBottom: 3 },
  imageSignature: { width: 160, height: 36, objectFit: 'contain', marginBottom: 3 },
  zoneSignatureVide: {
    height: 36,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: couleurs.hairline,
    borderStyle: 'dashed',
    borderRadius: 4,
    marginBottom: 4,
  },
  texteSignatureVide: { fontSize: 7, color: couleurs.muteSoft },
  traitSignature: {
    borderTopWidth: 1,
    borderTopColor: couleurs.muteSoft,
    width: '100%',
    paddingTop: 4,
    alignItems: 'center',
  },
  nomSignataire: { fontSize: 9, color: couleurs.ink, fontFamily: 'Inter', fontWeight: 600 },
  mentionSignaturesExemple: {
    fontFamily: 'Inter',
    fontSize: 7.5,
    color: couleurs.mute,
    textAlign: 'center',
    marginTop: 4,
  },

  piedDePage: {
    position: 'absolute',
    bottom: 22,
    left: 42,
    right: 42,
    borderTopWidth: 1,
    borderTopColor: couleurs.hairline,
    paddingTop: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  textePied: { fontSize: 7.5, color: couleurs.muteSoft },
})

export type EtatSignaturePdf = 'apposee' | 'non-apposee' | 'indisponible'

interface DonneesQuittanceCommunes {
  numeroDocument: string
  type: 'Quittance' | 'Reçu'
  dateGeneration: string
  pays: string

  bailleurNom: string
  bailleurTelephone: string
  bailleurAdresse: string | null

  locataireNom: string
  locataireTelephone: string

  logementAdresse: string
  logementVille: string
  logementPays: string
  logementType: string

  loyerMensuel: number
  periodeDebut: string
  periodeFin: string

  montant: number
  datePaiement: string
  modePaiement: string
  typePaiement: TypePaiement
  estPartiel: boolean
  /** Total validé du loyer à cette émission, distinct de ce versement. */
  montantCumule?: number
  /** Excédent du loyer de cette période; il n'est pas reporté automatiquement. */
  montantExcedentaire?: number

  /** Signature du bailleur en data URI, ou null si non téléversée. */
  signatureDataUri: string | null
  /** Signature du locataire en data URI, ou null si non recueillie. */
  signatureLocataireDataUri: string | null
  /** État précis : une erreur de lecture n'est pas assimilée à une absence. */
  signatureBailleurEtat?: EtatSignaturePdf
  signatureLocataireEtat?: EtatSignaturePdf
}

/** Le type de rendu sépare les exemples publics des pièces utilisateurs. */
export type DonneesQuittance = DonneesQuittanceCommunes & (
  | { modeDocument: 'reel'; signaturesExemple?: never }
  | { modeDocument: 'exemple'; signaturesExemple?: boolean }
)

/** Traits vectoriels dessinés pour l'exemple public, jamais pour un document réel. */
function SignatureBailleurExemple() {
  return (
    <Svg width={160} height={36} viewBox="0 0 160 36">
      <Path
        d="M7 27 C13 25 17 14 20 9 C22 6 25 8 23 17 C22 22 21 26 25 22 C29 18 32 10 35 11 C39 11 35 20 33 22 C31 24 37 21 42 16 C47 11 51 10 53 14 C55 18 49 23 46 24 C44 25 50 22 55 18 C60 14 63 14 64 18 C65 22 68 21 73 17 C78 13 83 10 86 13 C89 16 83 22 80 24 C78 25 84 23 89 19 C94 15 98 14 100 18 C102 22 105 21 110 17 C116 12 120 12 119 17 C118 21 116 24 121 23 C127 22 133 17 147 14"
        fill="none"
        stroke="#17311C"
        strokeWidth={1.45}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function SignatureLocataireExemple() {
  return (
    <Svg width={160} height={36} viewBox="0 0 160 36">
      <Path
        d="M10 23 C18 23 24 17 24 11 C24 6 18 6 16 12 C13 19 20 26 27 23 C33 20 34 13 38 13 C42 13 39 20 36 23 C34 25 42 23 49 17 C55 12 60 12 61 16 C62 20 56 24 53 25 C50 26 58 22 65 18 C71 14 75 16 73 21 C72 24 78 22 84 17 C90 12 96 11 98 15 C100 18 95 22 91 24 C89 26 98 24 105 19 C111 15 116 15 116 20 C116 24 121 22 128 17 C134 13 140 13 150 14"
        fill="none"
        stroke="#17311C"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function Ligne({ etiquette, valeur }: { etiquette: string; valeur: string }) {
  return (
    <View style={styles.ligne}>
      <Text style={styles.ligneEtiquette}>{etiquette}</Text>
      <Text style={styles.ligneValeur}>{valeur}</Text>
    </View>
  )
}

export function DocumentQuittance(donnees: DonneesQuittance) {
  const estExemple = donnees.modeDocument === 'exemple'
  const signaturesExemple = estExemple && donnees.signaturesExemple === true
  const estLoyer = donnees.typePaiement === 'Loyer'
  const estQuittance = estLoyer && donnees.type === 'Quittance'
  const cumul = estLoyer ? (donnees.montantCumule ?? donnees.montant) : 0
  const soldeRestant = estLoyer ? Math.max(0, donnees.loyerMensuel - cumul) : 0
  const excedent = estLoyer
    ? Math.max(0, donnees.montantExcedentaire ?? cumul - donnees.loyerMensuel)
    : 0

  /**
   * Le seul cas où le droit de timbre est réellement susceptible de
   * s'appliquer (art. 423 du CGI, LF 2025). La mention générale figure de
   * toute façon en pied de page ; cet encart la rend actionnable en la
   * rattachant au paiement effectivement encaissé.
   */
  const timbrePotentiellementDu =
    donnees.modePaiement === 'Espèces' && donnees.montant > 100_000
  const etatBailleur = donnees.modeDocument === 'reel' && donnees.signatureDataUri
    ? 'apposee'
    : donnees.signatureBailleurEtat ?? 'non-apposee'
  const etatLocataire = donnees.modeDocument === 'reel' && donnees.signatureLocataireDataUri
    ? 'apposee'
    : donnees.signatureLocataireEtat ?? 'non-apposee'
  const mentionEtatSignature = (partie: string, etat: EtatSignaturePdf) => {
    if (etat === 'apposee') return `Signature du ${partie} apposée.`
    if (etat === 'indisponible') return `Signature du ${partie} indisponible pour ce document.`
    return `Signature du ${partie} non apposée.`
  }
  const mentionSignature = signaturesExemple
    ? 'Les signatures graphiques sont illustratives : elles n’ont été apposées par aucune personne réelle et ne sont pas authentifiées.'
    : [
        mentionEtatSignature('bailleur', etatBailleur),
        mentionEtatSignature('locataire', etatLocataire),
      ].join(' ')

  // Les signatures illustratives sont accessibles exclusivement au mode
  // exemple. Les documents réels ne consomment que les signatures autorisées
  // chargées depuis le mécanisme métier existant.
  const signatureBailleurReelle = donnees.modeDocument === 'reel' ? donnees.signatureDataUri : null
  const signatureLocataireReelle = donnees.modeDocument === 'reel' ? donnees.signatureLocataireDataUri : null

  return (
    <Document
      title={`${donnees.type} ${donnees.numeroDocument}`}
      author={donnees.bailleurNom}
      subject={estLoyer
        ? `${donnees.type} de loyer — ${formaterPeriode(donnees.periodeDebut)}`
        : `${donnees.type} — ${donnees.typePaiement}`}
      creator="Sikaloc"
      producer="Sikaloc"
    >
      <Page size="A4" style={styles.page}>
        {estExemple ? (
          <View style={styles.bandeauApercu}>
            <Text style={styles.etiquetteApercu}>EXEMPLE</Text>
            <Text style={styles.mentionApercu}>DOCUMENT FICTIF — SANS VALEUR JUSTIFICATIVE</Text>
          </View>
        ) : null}

        {/* ── En-tête ────────────────────────────────────────────────────── */}
        <View style={styles.enTete}>
          <View style={styles.marque}>
            <LogoMarque hauteur={20} />
          </View>
          <View style={styles.blocNumero}>
            <Text style={styles.etiquetteNumero}>N° de document</Text>
            <Text style={styles.numero}>{donnees.numeroDocument}</Text>
            <Text style={{ fontSize: 8, color: couleurs.mute }}>
              Généré le {formaterHorodatage(donnees.dateGeneration)}
            </Text>
          </View>
        </View>

        <Text style={styles.titre}>
          {estQuittance
            ? 'Quittance de loyer'
            : estLoyer && donnees.estPartiel
              ? 'Reçu de paiement partiel'
              : 'Reçu de paiement'}
        </Text>
        <Text style={styles.sousTitre}>
          {estLoyer
            ? `Période du ${formaterDate(donnees.periodeDebut)} au ${formaterDate(donnees.periodeFin)}`
            : `Paiement enregistré le ${formaterDate(donnees.datePaiement)}`}
          {estLoyer && donnees.estPartiel ? ' — paiement partiel' : ''}
        </Text>

        {/* ── Synthèse ───────────────────────────────────────────────────── */}
        {/* Trois chiffres, lisibles d'un regard, avant même le détail qui
            suit — le loyer dû, ce qui a été réglé, et ce qu'il reste. */}
        <View style={styles.recapitulatif}>
          {estLoyer ? (
            <>
              <View style={styles.recapCellule}>
                <Text style={styles.recapEtiquette}>Loyer mensuel</Text>
                <Text style={styles.recapValeur}>{formaterFCFA(donnees.loyerMensuel)}</Text>
              </View>
              <View style={styles.recapCellule}>
                <Text style={styles.recapEtiquette}>Montant réglé</Text>
                <Text style={styles.recapValeur}>{formaterFCFA(cumul)}</Text>
              </View>
              <View style={[styles.recapCellule, { borderRightWidth: 0 }]}>
                <Text style={styles.recapEtiquette}>
                  {excedent > 0 ? 'Excédent non reporté' : 'Solde restant'}
                </Text>
                <Text
                  style={[
                    styles.recapValeur,
                    soldeRestant > 0 || excedent > 0
                      ? { color: couleurs.warningDeep }
                      : { color: couleurs.positiveDeep },
                  ]}
                >
                  {formaterFCFA(excedent > 0 ? excedent : soldeRestant)}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.recapCellule}>
                <Text style={styles.recapEtiquette}>Nature</Text>
                <Text style={styles.recapValeur}>{donnees.typePaiement}</Text>
              </View>
              <View style={styles.recapCellule}>
                <Text style={styles.recapEtiquette}>Montant reçu</Text>
                <Text style={styles.recapValeur}>{formaterFCFA(donnees.montant)}</Text>
              </View>
              <View style={[styles.recapCellule, { borderRightWidth: 0 }]}>
                <Text style={styles.recapEtiquette}>Report au loyer</Text>
                <Text style={styles.recapValeur}>Non</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Parties ────────────────────────────────────────────────────── */}
        <View style={styles.colonnes}>
          <View style={styles.colonne}>
            <Text style={styles.etiquetteBloc}>Bailleur</Text>
            <Text style={styles.nomPartie}>{donnees.bailleurNom}</Text>
            {donnees.bailleurTelephone ? (
              <Text style={styles.lignePartie}>Tél. {formaterTelephone(donnees.bailleurTelephone)}</Text>
            ) : null}
            {donnees.bailleurAdresse ? (
              <Text style={styles.lignePartie}>{donnees.bailleurAdresse}</Text>
            ) : null}
          </View>

          <View style={styles.colonne}>
            <Text style={styles.etiquetteBloc}>Locataire</Text>
            <Text style={styles.nomPartie}>{donnees.locataireNom}</Text>
            {donnees.locataireTelephone ? (
              <Text style={styles.lignePartie}>Tél. {formaterTelephone(donnees.locataireTelephone)}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Logement et bail ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.titreSection}>{estLoyer ? 'Logement loué' : 'Logement concerné'}</Text>
          <Ligne etiquette="Adresse" valeur={donnees.logementAdresse} />
          <Ligne
            etiquette="Ville"
            valeur={`${donnees.logementVille}, ${donnees.logementPays}`}
          />
          <Ligne etiquette="Type de bien" valeur={donnees.logementType} />
          {estLoyer ? (
            <Ligne etiquette="Loyer mensuel" valeur={formaterFCFA(donnees.loyerMensuel)} />
          ) : null}
        </View>

        {/* ── Paiement ───────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.titreSection}>Détail du paiement</Text>
          <Ligne etiquette="Date de paiement" valeur={formaterDate(donnees.datePaiement)} />
          <Ligne etiquette="Mode de paiement" valeur={donnees.modePaiement} />
          <Ligne etiquette="Nature" valeur={donnees.typePaiement} />
          {estLoyer && donnees.estPartiel ? (
            <Ligne
              etiquette="Solde restant dû pour la période"
              valeur={formaterFCFA(soldeRestant)}
            />
          ) : null}
        </View>

        <View style={styles.encadreMontant}>
          <Text style={styles.etiquetteMontant}>Montant reçu</Text>
          <Text style={styles.montantChiffres}>{formaterFCFA(donnees.montant)}</Text>
          <Text style={styles.montantLettres}>
            {montantEnLettresCapitalise(donnees.montant)} francs CFA
          </Text>
        </View>

        {/* ── Mention de décharge ────────────────────────────────────────── */}
        <View style={styles.decharge}>
          <Text style={styles.texteDecharge}>
            {/* Phrase assemblée en une seule chaîne : découpée en plusieurs
                nœuds JSX, react-pdf peut absorber les espaces de jonction et
                coller « ) » à « pour ». */}
            {`Reçu de ${donnees.locataireNom} la somme de ` +
              `${montantEnLettresCapitalise(donnees.montant)} francs CFA ` +
              `(${formaterFCFA(donnees.montant)}) ` +
              (estLoyer
                ? `pour le loyer de la période du ${formaterDate(donnees.periodeDebut)} au ${formaterDate(donnees.periodeFin)}.`
                : `au titre de ${donnees.typePaiement.toLowerCase()}.`)}
          </Text>
          {estLoyer && excedent > 0 ? (
            <Text style={[styles.texteDecharge, { marginTop: 5 }]}>
              {`L’excédent de ${formaterFCFA(excedent)} n’est pas affecté au mois suivant.`}
            </Text>
          ) : null}
          {estLoyer && donnees.estPartiel ? (
            <Text style={[styles.texteDecharge, { marginTop: 5 }]}>
              {`Ce paiement étant partiel, le présent document vaut reçu et non ` +
                `quittance : il ne libère pas le locataire du solde restant dû ` +
                `pour la période, soit ${formaterFCFA(soldeRestant)}.`}
            </Text>
          ) : null}
        </View>

        {/* ── Signatures ─────────────────────────────────────────────────── */}
        <View style={styles.blocSignature}>
          <View style={styles.cadreSignature}>
            <Text style={styles.etiquetteSignature}>Signature du bailleur</Text>
            {signaturesExemple ? (
              <SignatureBailleurExemple />
            ) : signatureBailleurReelle ? (
              <Image style={styles.imageSignature} src={signatureBailleurReelle} />
            ) : (
              <View style={styles.zoneSignatureVide}>
                <Text style={styles.texteSignatureVide}>
                  {etatBailleur === 'indisponible' ? 'Signature indisponible' : 'Espace de signature'}
                </Text>
              </View>
            )}
            <View style={styles.traitSignature}>
              <Text style={styles.nomSignataire}>{donnees.bailleurNom}</Text>
            </View>
          </View>

          <View style={styles.cadreSignature}>
            <Text style={styles.etiquetteSignature}>Signature du locataire</Text>
            {signaturesExemple ? (
              <SignatureLocataireExemple />
            ) : signatureLocataireReelle ? (
              <Image style={styles.imageSignature} src={signatureLocataireReelle} />
            ) : (
              <View style={styles.zoneSignatureVide}>
                <Text style={styles.texteSignatureVide}>
                  {etatLocataire === 'indisponible' ? 'Signature indisponible' : 'Espace de signature'}
                </Text>
              </View>
            )}
            <View style={styles.traitSignature}>
              <Text style={styles.nomSignataire}>{donnees.locataireNom}</Text>
            </View>
          </View>
        </View>

        {signaturesExemple ? (
          <Text style={styles.mentionSignaturesExemple}>{mentionSignature}</Text>
        ) : null}

        {/* ── Mentions légales ───────────────────────────────────────────── */}
        {timbrePotentiellementDu ? (
          <View style={styles.encadreTimbre}>
            <Text style={styles.texteTimbre}>
              {`Paiement en espèces supérieur à 100 000 FCFA : un droit de timbre ` +
                `de 1 % (soit environ ${formaterFCFA(Math.round(donnees.montant * 0.01))}) ` +
                `est susceptible d'être exigible. Rapprochez-vous de votre conseil.`}
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: 8 }}>
          {/* Imprimée sur toute quittance, quel que soit le plan : c'est une
              information légale qui concerne le locataire autant que le
              bailleur, pas une fonctionnalité à vendre. */}
          <Text style={styles.mentionLegale}>
            Droit de timbre — En cas de paiement en espèces supérieur à
            100 000 FCFA, un droit de timbre de 1 % peut être exigible
            conformément à l&apos;article 423 du CGI (modifié par la LF 2025).
            Pour les paiements par Mobile Money ou virement, ce droit
            n&apos;est pas applicable. Sikaloc ne calcule pas ce montant :
            son acquittement relève de la responsabilité des parties.
          </Text>

          <Text style={styles.mentionLegale}>
            Document généré électroniquement par la plateforme Sikaloc sous la
            responsabilité de {donnees.bailleurNom}, enregistré le{' '}
            {formaterHorodatage(donnees.dateGeneration)}.
          </Text>

          {!signaturesExemple ? (
            <Text style={styles.mentionLegale}>{mentionSignature}</Text>
          ) : null}
        </View>

        <View style={styles.piedDePage} fixed>
          <Text style={styles.textePied}>
            {donnees.numeroDocument} · {donnees.type} · {donnees.pays}
          </Text>
          <Text style={styles.textePied}>
            Généré par Sikaloc · sikaloc.com
          </Text>
        </View>
      </Page>
    </Document>
  )
}
