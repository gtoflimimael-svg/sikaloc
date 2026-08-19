import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'

import { formaterDate, formaterFCFA, formaterHorodatage, formaterPeriode } from '@/lib/format'
import { montantEnLettresCapitalise } from '@/lib/montant-en-lettres'

/**
 * Quittance de loyer / Reçu — template Bénin.
 * Mentions obligatoires : spec §6.1.10.
 *
 * Sur la police : le document utilise Helvetica, intégrée au standard PDF.
 * Enregistrer Inter imposerait de télécharger un fichier de police à chaque
 * rendu — un aller-retour réseau au milieu d'une fonction serverless, pour un
 * document qui n'a pas vocation à être une pièce de marque.
 */

const couleurs = {
  ink: '#131314',
  body: '#3A3A3D',
  mute: '#64646C',
  muteSoft: '#82828E',
  primary: '#5C5CCC',
  inkDeep: '#3E3EA9',
  canvasSoft: '#F4F4FB',
  hairline: '#D8D8E6',
  primaryPale: '#DEDEEF',
  warningPale: '#FAF0D4',
  warningContent: '#6B5210',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 42,
    fontFamily: 'Helvetica',
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
  pastille: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: couleurs.primary,
    marginRight: 8,
  },
  motMarque: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 17,
    color: couleurs.ink,
    letterSpacing: -0.5,
  },
  blocNumero: { alignItems: 'flex-end' },
  etiquetteNumero: { fontSize: 8, color: couleurs.mute, textTransform: 'uppercase' },
  numero: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: couleurs.ink },

  titre: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 21,
    lineHeight: 1.2,
    color: couleurs.ink,
    letterSpacing: -0.6,
    marginBottom: 3,
  },
  sousTitre: { fontSize: 9.5, color: couleurs.mute, marginBottom: 12 },

  colonnes: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  colonne: {
    flex: 1,
    backgroundColor: couleurs.canvasSoft,
    borderRadius: 8,
    padding: 9,
  },
  etiquetteBloc: {
    fontSize: 8,
    color: couleurs.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  nomPartie: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: couleurs.ink },
  lignePartie: { fontSize: 9, color: couleurs.body },

  section: { marginBottom: 8 },
  titreSection: {
    fontFamily: 'Helvetica-Bold',
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
  ligneValeur: { fontSize: 9.5, color: couleurs.ink, fontFamily: 'Helvetica-Bold' },

  encadreMontant: {
    backgroundColor: couleurs.primaryPale,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  etiquetteMontant: { fontSize: 8.5, color: couleurs.inkDeep, marginBottom: 2 },
  montantChiffres: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    lineHeight: 1.2,
    color: couleurs.inkDeep,
    letterSpacing: -0.4,
  },
  montantLettres: {
    fontSize: 9,
    color: couleurs.inkDeep,
    fontStyle: 'italic',
    marginTop: 3,
  },

  decharge: {
    borderLeftWidth: 3,
    borderLeftColor: couleurs.primary,
    paddingLeft: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  texteDecharge: { fontSize: 9.5, color: couleurs.ink, lineHeight: 1.45 },

  encadreTimbre: {
    backgroundColor: couleurs.warningPale,
    borderRadius: 6,
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

  blocSignature: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cadreSignature: { width: 180, alignItems: 'center' },
  etiquetteSignature: { fontSize: 8, color: couleurs.mute, marginBottom: 3 },
  imageSignature: { height: 36, objectFit: 'contain', marginBottom: 3 },
  zoneSignatureVide: {
    height: 36,
    width: '100%',
    borderWidth: 1,
    borderColor: couleurs.hairline,
    borderStyle: 'dashed',
    borderRadius: 4,
    marginBottom: 4,
  },
  traitSignature: {
    borderTopWidth: 1,
    borderTopColor: couleurs.muteSoft,
    width: '100%',
    paddingTop: 4,
  },
  nomSignataire: { fontSize: 9, color: couleurs.ink, fontFamily: 'Helvetica-Bold' },

  filigrane: {
    position: 'absolute',
    top: 330,
    left: 100,
    fontSize: 62,
    color: couleurs.muteSoft,
    opacity: 0.12,
    fontFamily: 'Helvetica-Bold',
    transform: 'rotate(-28deg)',
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

export interface DonneesQuittance {
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
  typePaiement: string
  estPartiel: boolean

  /** Signature du bailleur en data URI, ou null si non téléversée. */
  signatureDataUri: string | null

  /**
   * Le plan Gratuit produit une quittance basique sans mention de timbre
   * (spec §4.2). Le plan Standard ajoute les mentions de conformité Bénin.
   */
  mentionsConformes: boolean

  /** Aperçu écran : marque le document d'un filigrane. */
  apercu?: boolean
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
  const estQuittance = donnees.type === 'Quittance'
  const soldeRestant = Math.max(0, donnees.loyerMensuel - donnees.montant)

  /**
   * Le seul cas où le droit de timbre est réellement susceptible de
   * s'appliquer (art. 423 du CGI, LF 2025). La mention générale figure de
   * toute façon en pied de page ; cet encart la rend actionnable en la
   * rattachant au paiement effectivement encaissé.
   */
  const timbrePotentiellementDu =
    donnees.mentionsConformes &&
    donnees.modePaiement === 'Espèces' &&
    donnees.montant > 100_000

  return (
    <Document
      title={`${donnees.type} ${donnees.numeroDocument}`}
      author={donnees.bailleurNom}
      subject={`${donnees.type} de loyer — ${formaterPeriode(donnees.periodeDebut)}`}
      creator="Sikaloc"
      producer="Sikaloc"
    >
      <Page size="A4" style={styles.page}>
        {donnees.apercu ? <Text style={styles.filigrane}>APERÇU</Text> : null}

        {/* ── En-tête ────────────────────────────────────────────────────── */}
        <View style={styles.enTete}>
          <View style={styles.marque}>
            <View style={styles.pastille} />
            <Text style={styles.motMarque}>Sikaloc</Text>
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
          {estQuittance ? 'Quittance de loyer' : 'Reçu de paiement partiel'}
        </Text>
        <Text style={styles.sousTitre}>
          Période du {formaterDate(donnees.periodeDebut)} au {formaterDate(donnees.periodeFin)}
          {donnees.estPartiel ? ' — paiement partiel' : ''}
        </Text>

        {/* ── Parties ────────────────────────────────────────────────────── */}
        <View style={styles.colonnes}>
          <View style={styles.colonne}>
            <Text style={styles.etiquetteBloc}>Bailleur</Text>
            <Text style={styles.nomPartie}>{donnees.bailleurNom}</Text>
            <Text style={styles.lignePartie}>Tél. {donnees.bailleurTelephone}</Text>
            {donnees.bailleurAdresse ? (
              <Text style={styles.lignePartie}>{donnees.bailleurAdresse}</Text>
            ) : null}
          </View>

          <View style={styles.colonne}>
            <Text style={styles.etiquetteBloc}>Locataire</Text>
            <Text style={styles.nomPartie}>{donnees.locataireNom}</Text>
            <Text style={styles.lignePartie}>Tél. {donnees.locataireTelephone}</Text>
          </View>
        </View>

        {/* ── Logement et bail ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.titreSection}>Logement loué</Text>
          <Ligne etiquette="Adresse" valeur={donnees.logementAdresse} />
          <Ligne
            etiquette="Ville"
            valeur={`${donnees.logementVille}, ${donnees.logementPays}`}
          />
          <Ligne etiquette="Type de bien" valeur={donnees.logementType} />
          <Ligne etiquette="Loyer mensuel" valeur={formaterFCFA(donnees.loyerMensuel)} />
        </View>

        {/* ── Paiement ───────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.titreSection}>Détail du paiement</Text>
          <Ligne etiquette="Date de paiement" valeur={formaterDate(donnees.datePaiement)} />
          <Ligne etiquette="Mode de paiement" valeur={donnees.modePaiement} />
          <Ligne etiquette="Nature" valeur={donnees.typePaiement} />
          {donnees.estPartiel ? (
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
              `(${formaterFCFA(donnees.montant)}) pour le loyer de la période du ` +
              `${formaterDate(donnees.periodeDebut)} au ${formaterDate(donnees.periodeFin)}.`}
          </Text>
          {donnees.estPartiel ? (
            <Text style={[styles.texteDecharge, { marginTop: 5 }]}>
              {`Ce paiement étant partiel, le présent document vaut reçu et non ` +
                `quittance : il ne libère pas le locataire du solde restant dû ` +
                `pour la période, soit ${formaterFCFA(soldeRestant)}.`}
            </Text>
          ) : null}
        </View>

        {/* ── Signature ──────────────────────────────────────────────────── */}
        <View style={styles.blocSignature}>
          <View style={styles.cadreSignature}>
            <Text style={styles.etiquetteSignature}>Signature du bailleur</Text>
            {donnees.signatureDataUri ? (
              <Image style={styles.imageSignature} src={donnees.signatureDataUri} />
            ) : (
              <View style={styles.zoneSignatureVide} />
            )}
            <View style={styles.traitSignature}>
              <Text style={styles.nomSignataire}>{donnees.bailleurNom}</Text>
            </View>
          </View>
        </View>

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
          {donnees.mentionsConformes ? (
            <Text style={styles.mentionLegale}>
              Droit de timbre — En cas de paiement en espèces supérieur à
              100 000 FCFA, un droit de timbre de 1 % peut être exigible
              conformément à l&apos;article 423 du CGI (modifié par la LF 2025).
              Pour les paiements par Mobile Money ou virement, ce droit
              n&apos;est pas applicable. Sikaloc ne calcule pas ce montant :
              son acquittement relève de la responsabilité des parties.
            </Text>
          ) : null}

          <Text style={styles.mentionLegale}>
            Document généré électroniquement par la plateforme Sikaloc sous la
            responsabilité de {donnees.bailleurNom}, enregistré le{' '}
            {formaterHorodatage(donnees.dateGeneration)}.
          </Text>

          <Text style={styles.mentionLegale}>
            La signature apposée est une signature électronique simple, non
            qualifiée au sens de la réglementation applicable.
          </Text>
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
