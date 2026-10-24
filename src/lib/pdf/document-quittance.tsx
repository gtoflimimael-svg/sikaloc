import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import type { ReactNode } from 'react'

import { formaterDate, formaterFCFA, formaterHorodatage, formaterPeriode } from '@/lib/format'
import { couleurs, LogoMarque } from '@/lib/pdf/base'
import { montantEnLettresCapitalise } from '@/lib/montant-en-lettres'
import { formaterTelephone } from '@/lib/telephone'
import type { TypePaiement } from '@/lib/types/database'

/** Mise en page documentaire commune aux quittances et reçus Sikaloc. */
const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 48,
    paddingHorizontal: 46,
    fontFamily: 'Inter',
    fontSize: 9.4,
    color: couleurs.body,
    lineHeight: 1.42,
  },
  exemple: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 16,
    backgroundColor: couleurs.canvasSoft,
    borderLeftWidth: 2,
    borderLeftColor: couleurs.primary,
  },
  exempleLabel: {
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 8,
    color: couleurs.primary,
    letterSpacing: 0.8,
  },
  exempleMention: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 7.5,
    color: couleurs.ink,
    textAlign: 'right',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.hairline,
  },
  logo: { flexShrink: 0 },
  reference: { alignItems: 'flex-end', maxWidth: '62%' },
  referenceLabel: {
    fontSize: 7.5,
    fontWeight: 600,
    color: couleurs.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  referenceValue: {
    maxWidth: '100%',
    fontFamily: 'Manrope',
    fontWeight: 700,
    fontSize: 9.5,
    color: couleurs.ink,
    textAlign: 'right',
  },
  dateEmission: { marginTop: 2, fontSize: 8, color: couleurs.mute },
  intro: { marginBottom: 15 },
  typeDocument: {
    marginBottom: 5,
    fontSize: 7.5,
    fontWeight: 700,
    color: couleurs.primary,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Manrope',
    fontWeight: 800,
    fontSize: 25,
    lineHeight: 1.13,
    color: couleurs.ink,
    letterSpacing: -0.5,
  },
  period: {
    marginTop: 4,
    fontFamily: 'Inter',
    fontSize: 10,
    color: couleurs.mute,
  },
  recap: {
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 18,
    borderRadius: 6,
    backgroundColor: couleurs.primaryPale,
  },
  recapCell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: couleurs.hairline,
  },
  recapCellLast: { borderRightWidth: 0 },
  recapLabel: {
    marginBottom: 4,
    fontSize: 7.2,
    fontWeight: 600,
    color: couleurs.mute,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  recapValue: {
    fontFamily: 'Manrope',
    fontWeight: 700,
    fontSize: 12.2,
    lineHeight: 1.2,
    color: couleurs.ink,
  },
  recapValueEmphasis: { fontSize: 14.2, color: couleurs.primary },
  parties: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  partie: {
    flex: 1,
    minWidth: 0,
    paddingTop: 7,
    paddingRight: 14,
    borderTopWidth: 1.4,
    borderTopColor: couleurs.primary,
  },
  partieSeconde: { paddingLeft: 14, paddingRight: 0, borderTopColor: couleurs.hairline },
  partieLabel: {
    marginBottom: 4,
    fontSize: 7.5,
    fontWeight: 700,
    color: couleurs.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.65,
  },
  partieNom: {
    fontFamily: 'Manrope',
    fontWeight: 700,
    fontSize: 10.5,
    lineHeight: 1.28,
    color: couleurs.ink,
  },
  partieInfo: { marginTop: 2, fontSize: 8.2, color: couleurs.mute },
  details: { flexDirection: 'row', marginBottom: 15 },
  detailColumn: { flex: 1, minWidth: 0, paddingRight: 13 },
  detailColumnSecond: {
    paddingRight: 0,
    paddingLeft: 13,
    borderLeftWidth: 1,
    borderLeftColor: couleurs.hairline,
  },
  detailHeading: {
    marginBottom: 6,
    fontFamily: 'Manrope',
    fontWeight: 700,
    fontSize: 10.2,
    color: couleurs.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3.5,
    borderBottomWidth: 0.6,
    borderBottomColor: couleurs.hairline,
  },
  rowLabel: { width: '39%', paddingRight: 5, fontSize: 8, color: couleurs.mute },
  rowValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 8.4,
    fontWeight: 600,
    color: couleurs.ink,
    textAlign: 'right',
  },
  statement: {
    marginBottom: 13,
    paddingLeft: 10,
    paddingVertical: 2,
    borderLeftWidth: 2,
    borderLeftColor: couleurs.signature,
  },
  statementText: { fontSize: 9, lineHeight: 1.46, color: couleurs.ink },
  statementLabel: {
    marginTop: 5,
    fontSize: 7.3,
    fontWeight: 700,
    color: couleurs.mute,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  statementAmount: { fontFamily: 'Manrope', fontWeight: 700, color: couleurs.primary },
  statementNote: { marginTop: 4, fontSize: 8.4, lineHeight: 1.4, color: couleurs.mute },
  signatures: { flexDirection: 'row', marginBottom: 11 },
  signature: { flex: 1, minWidth: 0, paddingRight: 14 },
  signatureSecond: { paddingRight: 0, paddingLeft: 14 },
  signatureLabel: {
    marginBottom: 3,
    fontSize: 7.8,
    fontWeight: 600,
    color: couleurs.mute,
  },
  signatureArea: {
    height: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureImage: { width: '78%', height: 29, objectFit: 'contain' },
  signatureStatus: { fontSize: 7.2, color: couleurs.muteSoft, textAlign: 'center' },
  signatureLine: {
    paddingTop: 4,
    borderTopWidth: 0.7,
    borderTopColor: couleurs.muteSoft,
    alignItems: 'center',
  },
  signerName: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 8.5,
    color: couleurs.ink,
    textAlign: 'center',
  },
  stampNotice: {
    marginBottom: 6,
    paddingVertical: 5,
    paddingHorizontal: 7,
    backgroundColor: couleurs.warningPale,
  },
  stampText: { fontSize: 7.7, lineHeight: 1.35, color: couleurs.warningContent },
  legal: { marginBottom: 4, fontSize: 7.7, lineHeight: 1.38, color: couleurs.mute },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 46,
    right: 46,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: couleurs.hairline,
  },
  footerText: { fontSize: 7.5, color: couleurs.muteSoft },
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
  /** Cumul validé du loyer de la période au moment de l'émission. */
  montantCumule?: number
  /** Excédent de cette période, non reporté automatiquement. */
  montantExcedentaire?: number
  /** Signature du bailleur chargée après vérification de l'autorisation. */
  signatureDataUri: string | null
  /** Signature du locataire chargée après vérification de l'autorisation. */
  signatureLocataireDataUri: string | null
  signatureBailleurEtat?: EtatSignaturePdf
  signatureLocataireEtat?: EtatSignaturePdf
}

/** Le mode exemple ne peut pas recevoir de signatures d'utilisateurs. */
export type DonneesQuittance = DonneesQuittanceCommunes &
  ({ modeDocument: 'reel' } | { modeDocument: 'exemple' })

function Ligne({ etiquette, valeur }: { etiquette: string; valeur: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{etiquette}</Text>
      <Text style={styles.rowValue}>{valeur}</Text>
    </View>
  )
}

function SectionDetails({
  titre,
  children,
  seconde = false,
}: {
  titre: string
  children: ReactNode
  seconde?: boolean
}) {
  return (
    <View style={[styles.detailColumn, seconde ? styles.detailColumnSecond : undefined]} wrap={false}>
      <Text style={styles.detailHeading}>{titre}</Text>
      {children}
    </View>
  )
}

export function DocumentQuittance(donnees: DonneesQuittance) {
  const estExemple = donnees.modeDocument === 'exemple'
  const estLoyer = donnees.typePaiement === 'Loyer'
  const estQuittance = estLoyer && donnees.type === 'Quittance'
  const cumul = estLoyer ? (donnees.montantCumule ?? donnees.montant) : 0
  const soldeRestant = estLoyer ? Math.max(0, donnees.loyerMensuel - cumul) : 0
  const excedent = estLoyer
    ? Math.max(0, donnees.montantExcedentaire ?? cumul - donnees.loyerMensuel)
    : 0

  // Présentation conservée: seuil, taux et conditions restent ceux du template
  // historique. Aucune modification de calcul ou de règle fiscale ici.
  const timbrePotentiellementDu =
    donnees.modePaiement === 'Espèces' && donnees.montant > 100_000

  const etatBailleur: EtatSignaturePdf = donnees.signatureDataUri
    ? 'apposee'
    : donnees.signatureBailleurEtat ?? 'non-apposee'
  const etatLocataire: EtatSignaturePdf = donnees.signatureLocataireDataUri
    ? 'apposee'
    : donnees.signatureLocataireEtat ?? 'non-apposee'

  const mentionEtatSignature = (partie: string, etat: EtatSignaturePdf) => {
    if (etat === 'apposee') return `Signature du ${partie} apposée.`
    if (etat === 'indisponible') return `Signature du ${partie} indisponible pour ce document.`
    return `Signature du ${partie} non apposée.`
  }

  // Le montant de quittance correspond au cumul de la période, tandis qu'un
  // reçu ne porte que sur le versement enregistré dans cette pièce.
  const montantAtteste = estQuittance ? cumul : donnees.montant
  const montantEnLettres = montantEnLettresCapitalise(montantAtteste)
  const signatureBailleur = estExemple ? null : donnees.signatureDataUri
  const signatureLocataire = estExemple ? null : donnees.signatureLocataireDataUri

  const declaration = estQuittance
    ? `Le bailleur reconnaît que le loyer de la période du ${formaterDate(donnees.periodeDebut)} au ${formaterDate(donnees.periodeFin)} a été intégralement réglé.`
    : estLoyer
      ? `Le bailleur reconnaît avoir reçu du locataire le versement enregistré le ${formaterDate(donnees.datePaiement)} au titre du loyer de la période du ${formaterDate(donnees.periodeDebut)} au ${formaterDate(donnees.periodeFin)}.`
      : `Le bailleur reconnaît avoir reçu du locataire un versement au titre de ${donnees.typePaiement.toLowerCase()}, enregistré le ${formaterDate(donnees.datePaiement)}.`

  return (
    <Document
      title={`${donnees.type} ${donnees.numeroDocument}`}
      author="Sikaloc"
      subject={estLoyer
        ? `${donnees.type} de loyer - ${formaterPeriode(donnees.periodeDebut)}`
        : `${donnees.type} - ${donnees.typePaiement}`}
      creator="Sikaloc"
      producer="Sikaloc"
    >
      <Page size="A4" style={styles.page}>
        {estExemple ? (
          <View style={styles.exemple} wrap={false}>
            <Text style={styles.exempleLabel}>EXEMPLE</Text>
            <Text style={styles.exempleMention}>DOCUMENT FICTIF — SANS VALEUR JUSTIFICATIVE</Text>
          </View>
        ) : null}

        <View style={styles.header} wrap={false}>
          <View style={styles.logo}>
            <LogoMarque hauteur={20} />
          </View>
          <View style={styles.reference}>
            <Text style={styles.referenceLabel}>Référence du document</Text>
            <Text style={styles.referenceValue}>{donnees.numeroDocument}</Text>
            <Text style={styles.dateEmission}>Émis le {formaterHorodatage(donnees.dateGeneration)}</Text>
          </View>
        </View>

        <View style={styles.intro} wrap={false}>
          <Text style={styles.typeDocument}>
            {estLoyer && donnees.estPartiel ? 'Reçu · versement partiel' : donnees.type}
          </Text>
          <Text style={styles.title}>
            {estQuittance ? 'Quittance de loyer' : 'Reçu de paiement'}
          </Text>
          <Text style={styles.period}>
            {estLoyer
              ? `Loyer du ${formaterDate(donnees.periodeDebut)} au ${formaterDate(donnees.periodeFin)}`
              : `Paiement enregistré le ${formaterDate(donnees.datePaiement)}`}
          </Text>
        </View>

        <View style={styles.recap} wrap={false}>
          {estLoyer ? (
            <>
              <View style={styles.recapCell}>
                <Text style={styles.recapLabel}>Loyer dû</Text>
                <Text style={styles.recapValue}>{formaterFCFA(donnees.loyerMensuel)}</Text>
              </View>
              <View style={styles.recapCell}>
                <Text style={styles.recapLabel}>Total réglé</Text>
                <Text style={[styles.recapValue, styles.recapValueEmphasis]}>{formaterFCFA(cumul)}</Text>
              </View>
              <View style={[styles.recapCell, styles.recapCellLast]}>
                <Text style={styles.recapLabel}>{excedent > 0 ? 'Excédent non reporté' : 'Solde restant'}</Text>
                <Text style={[
                  styles.recapValue,
                  soldeRestant === 0 && excedent === 0 ? { color: couleurs.positiveDeep } : { color: couleurs.warningDeep },
                ]}>
                  {formaterFCFA(excedent > 0 ? excedent : soldeRestant)}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.recapCell}>
                <Text style={styles.recapLabel}>Nature du règlement</Text>
                <Text style={styles.recapValue}>{donnees.typePaiement}</Text>
              </View>
              <View style={[styles.recapCell, styles.recapCellLast]}>
                <Text style={styles.recapLabel}>Montant reçu</Text>
                <Text style={[styles.recapValue, styles.recapValueEmphasis]}>{formaterFCFA(donnees.montant)}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.parties} wrap={false}>
          <View style={styles.partie}>
            <Text style={styles.partieLabel}>Bailleur</Text>
            <Text style={styles.partieNom}>{donnees.bailleurNom}</Text>
            {donnees.bailleurTelephone ? (
              <Text style={styles.partieInfo}>Tél. {formaterTelephone(donnees.bailleurTelephone)}</Text>
            ) : null}
            {donnees.bailleurAdresse ? (
              <Text style={styles.partieInfo}>{donnees.bailleurAdresse}</Text>
            ) : null}
          </View>
          <View style={[styles.partie, styles.partieSeconde]}>
            <Text style={styles.partieLabel}>Locataire</Text>
            <Text style={styles.partieNom}>{donnees.locataireNom}</Text>
            {donnees.locataireTelephone ? (
              <Text style={styles.partieInfo}>Tél. {formaterTelephone(donnees.locataireTelephone)}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.details}>
          <SectionDetails titre="Logement concerné">
            <Ligne etiquette="Adresse" valeur={donnees.logementAdresse} />
            <Ligne etiquette="Ville" valeur={`${donnees.logementVille}, ${donnees.logementPays}`} />
            <Ligne etiquette="Type de bien" valeur={donnees.logementType} />
            {estLoyer ? <Ligne etiquette="Loyer contractuel" valeur={formaterFCFA(donnees.loyerMensuel)} /> : null}
          </SectionDetails>
          <SectionDetails titre="Versement associé" seconde>
            <Ligne etiquette="Date" valeur={formaterDate(donnees.datePaiement)} />
            <Ligne etiquette="Mode" valeur={donnees.modePaiement} />
            <Ligne etiquette="Nature" valeur={donnees.typePaiement} />
            {estLoyer ? <Ligne etiquette="Montant du versement" valeur={formaterFCFA(donnees.montant)} /> : null}
          </SectionDetails>
        </View>

        <View style={styles.statement}>
          <Text style={styles.statementText}>{declaration}</Text>
          <Text style={styles.statementLabel}>
            {estQuittance ? 'Total réglé pour la période' : 'Montant de ce reçu'}
          </Text>
          <Text style={styles.statementAmount}>
            {montantEnLettres} francs CFA ({formaterFCFA(montantAtteste)})
          </Text>
          {estLoyer && donnees.type === 'Reçu' ? (
            <Text style={styles.statementNote}>
              {`Ce reçu porte uniquement sur le versement indiqué. Il n'atteste pas le règlement intégral de la période. Solde restant : ${formaterFCFA(soldeRestant)}.`}
            </Text>
          ) : null}
          {estLoyer && excedent > 0 ? (
            <Text style={styles.statementNote}>
              {`L'excédent de ${formaterFCFA(excedent)} n'est pas affecté à la période suivante.`}
            </Text>
          ) : null}
          {!estQuittance && !estLoyer ? (
            <Text style={styles.statementNote}>
              Cette mention porte sur le versement enregistré dans Sikaloc et ne constitue pas une confirmation par un prestataire de paiement.
            </Text>
          ) : null}
        </View>

        <View style={styles.signatures} wrap={false}>
          <View style={styles.signature}>
            <Text style={styles.signatureLabel}>Signature du bailleur</Text>
            <View style={styles.signatureArea}>
              {signatureBailleur ? (
                <Image style={styles.signatureImage} src={signatureBailleur} />
              ) : (
                <Text style={styles.signatureStatus}>
                  {estExemple
                    ? 'Aucune signature réelle reproduite sur cet exemple'
                    : etatBailleur === 'indisponible' ? 'Signature indisponible' : 'Aucune signature apposée'}
                </Text>
              )}
            </View>
            <View style={styles.signatureLine}>
              <Text style={styles.signerName}>{donnees.bailleurNom}</Text>
            </View>
          </View>
          <View style={[styles.signature, styles.signatureSecond]}>
            <Text style={styles.signatureLabel}>Signature du locataire</Text>
            <View style={styles.signatureArea}>
              {signatureLocataire ? (
                <Image style={styles.signatureImage} src={signatureLocataire} />
              ) : (
                <Text style={styles.signatureStatus}>
                  {estExemple
                    ? 'Aucune signature réelle reproduite sur cet exemple'
                    : etatLocataire === 'indisponible' ? 'Signature indisponible' : 'Aucune signature apposée'}
                </Text>
              )}
            </View>
            <View style={styles.signatureLine}>
              <Text style={styles.signerName}>{donnees.locataireNom}</Text>
            </View>
          </View>
        </View>
        {timbrePotentiellementDu ? (
          <View style={styles.stampNotice}>
            <Text style={styles.stampText}>
              {`Paiement en espèces supérieur à 100 000 FCFA : un droit de timbre de 1 % (soit environ ${formaterFCFA(Math.round(donnees.montant * 0.01))}) est susceptible d'être exigible. Rapprochez-vous de votre conseil.`}
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: 7 }}>
          <Text style={styles.legal}>
            Droit de timbre — En cas de paiement en espèces supérieur à
            100 000 FCFA, un droit de timbre de 1 % peut être exigible
            conformément à l&apos;article 423 du CGI (modifié par la LF 2025).
            Pour les paiements par Mobile Money ou virement, ce droit
            n&apos;est pas applicable. Sikaloc ne calcule pas ce montant :
            son acquittement relève de la responsabilité des parties.
          </Text>
          <Text style={styles.legal}>
            Document généré électroniquement par Sikaloc sous la responsabilité
            de {donnees.bailleurNom}, le {formaterHorodatage(donnees.dateGeneration)}.
          </Text>
          {!estExemple ? (
            <Text style={styles.legal}>
              {[mentionEtatSignature('bailleur', etatBailleur), mentionEtatSignature('locataire', etatLocataire)].join(' ')}
            </Text>
          ) : null}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {donnees.numeroDocument} · {donnees.type} · {donnees.pays}
          </Text>
          <Text style={styles.footerText}>Sikaloc · sikaloc.com</Text>
        </View>
      </Page>
    </Document>
  )
}
