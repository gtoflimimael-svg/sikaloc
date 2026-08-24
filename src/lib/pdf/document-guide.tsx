import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import { couleurs, LogoMarque } from '@/lib/pdf/base'

/**
 * Guide « Ce que contient une quittance Sikaloc », remis aux prospects.
 *
 * Registre volontairement DESCRIPTIF : le document dit ce que Sikaloc écrit sur
 * ses quittances, jamais ce que la loi exige ni ce qu'un juge en ferait. Les
 * conditions d'utilisation excluent le conseil juridique, et un guide qui
 * promettrait la conformité contredirait le reste du site.
 *
 * Chaque affirmation est vérifiable en ouvrant `/exemple-quittance`, et le
 * guide invite explicitement le lecteur à le faire. C'est aussi une contrainte
 * pour nous : si le document change, ce texte doit changer avec lui.
 */

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 54,
    fontFamily: 'StyreneB',
    fontSize: 10,
    lineHeight: 1.55,
    color: couleurs.body,
  },

  entete: { marginBottom: 30 },
  surTitre: {
    marginTop: 18,
    fontSize: 8,
    letterSpacing: 1.1,
    color: couleurs.primary,
    fontWeight: 500,
  },
  titre: {
    marginTop: 6,
    fontFamily: 'Copernicus',
    fontSize: 25,
    fontWeight: 800,
    color: couleurs.ink,
    lineHeight: 1.15,
  },

  avertissement: {
    marginTop: 20,
    padding: 14,
    backgroundColor: couleurs.canvasSoft,
    borderLeftWidth: 2,
    borderLeftColor: couleurs.primary,
  },

  section: { marginTop: 22 },
  numero: {
    fontSize: 8,
    letterSpacing: 1.1,
    color: couleurs.primary,
    fontWeight: 500,
  },
  sousTitre: {
    marginTop: 4,
    fontFamily: 'Copernicus',
    fontSize: 14,
    fontWeight: 700,
    color: couleurs.ink,
  },
  paragraphe: { marginTop: 7 },

  citation: {
    marginTop: 9,
    marginLeft: 2,
    paddingLeft: 12,
    paddingVertical: 3,
    borderLeftWidth: 2,
    borderLeftColor: couleurs.hairline,
    fontSize: 9.5,
    color: couleurs.mute,
  },

  fort: { fontWeight: 700, color: couleurs.ink },

  recap: {
    marginTop: 26,
    padding: 18,
    backgroundColor: couleurs.canvasSoft,
  },
  recapTitre: {
    fontFamily: 'Copernicus',
    fontSize: 13,
    fontWeight: 700,
    color: couleurs.ink,
    marginBottom: 8,
  },
  recapLigne: { flexDirection: 'row', marginTop: 3 },
  recapNumero: { width: 19, color: couleurs.primary, fontWeight: 500 },

  verification: {
    marginTop: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: couleurs.primary,
  },
  lien: {
    marginTop: 6,
    fontFamily: 'Copernicus',
    fontSize: 14,
    fontWeight: 700,
    color: couleurs.inkDeep,
  },

  piedDePage: {
    position: 'absolute',
    bottom: 26,
    left: 54,
    right: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.7,
    borderTopColor: couleurs.hairline,
    paddingTop: 7,
  },
  textePied: { fontSize: 7.5, color: couleurs.muteSoft },

  mentions: {
    marginTop: 22,
    fontSize: 8,
    lineHeight: 1.5,
    color: couleurs.muteSoft,
  },
})

/**
 * Les dix points, dans l'ordre de lecture d'un document : qui, quoi, quand,
 * combien, puis ce qui en fait une preuve.
 */
const SECTIONS: { titre: string; blocs: { texte: string; citation?: boolean }[] }[] = [
  {
    titre: 'Qui, exactement',
    blocs: [
      {
        texte:
          'Le document nomme les deux parties, sans abréviation ni initiale. Le bailleur — nom, téléphone, adresse. Le locataire — nom, téléphone.',
      },
      {
        texte:
          'Ces informations viennent de votre fiche et de celle du locataire. Vous les saisissez une fois ; elles se reportent ensuite sur chaque document, sans ressaisie et sans risque de faute de frappe d’un mois sur l’autre.',
      },
    ],
  },
  {
    titre: 'Quel logement',
    blocs: [
      { texte: 'L’adresse complète du bien loué, sa ville, son pays, et son type.' },
      {
        texte:
          'Un reçu qui ne nomme pas le logement ne se rattache à rien : si vous louez plusieurs biens, rien ne dit lequel a été payé. Chaque document Sikaloc désigne son logement, et un seul.',
      },
    ],
  },
  {
    titre: 'Quelle période, au jour près',
    blocs: [
      { texte: 'Le document porte une date de début et une date de fin, complètes.' },
      { texte: 'Pas « loyer de mars » : du 1er mars 2026 au 31 mars 2026.', citation: true },
      {
        texte:
          'Un mois nommé sans ses bornes laisse place à l’interprétation. Deux dates n’en laissent aucune.',
      },
    ],
  },
  {
    titre: 'Combien, en chiffres et en lettres',
    blocs: [
      { texte: 'Le montant reçu apparaît deux fois — en chiffres, puis en toutes lettres.' },
      { texte: 'Soixante mille francs CFA (60 000 FCFA)', citation: true },
      {
        texte:
          'Cette double écriture est une pratique ancienne des documents financiers : un chiffre seul se retouche, un montant écrit en lettres beaucoup moins.',
      },
      {
        texte:
          'Le document rappelle aussi le loyer mensuel prévu au bail. On voit donc d’un coup d’œil ce qui était attendu et ce qui a été versé.',
      },
    ],
  },
  {
    titre: 'Une quittance ou un reçu — la différence est faite pour vous',
    blocs: [
      { texte: 'C’est le point que les carnets ignorent presque toujours.' },
      {
        texte:
          'Le locataire a payé la totalité ? Le document est une quittance. Il porte cette phrase :',
      },
      {
        texte:
          'Reçu de [nom du locataire] la somme de [montant en lettres] francs CFA ([montant]) pour le loyer de la période du [date] au [date].',
        citation: true,
      },
      {
        texte:
          'Le locataire n’a payé qu’une partie ? Le document devient un reçu, et il le dit lui-même :',
      },
      {
        texte:
          'Ce paiement étant partiel, le présent document vaut reçu et non quittance : il ne libère pas le locataire du solde restant dû pour la période, soit [montant].',
        citation: true,
      },
      {
        texte:
          'Le solde est calculé et inscrit noir sur blanc. Vous ne remettez donc jamais, par inadvertance, un papier qui laisserait croire qu’un loyer partiellement réglé est soldé. C’est le genre de malentendu qui se découvre des mois plus tard, quand plus personne ne se souvient de rien.',
      },
    ],
  },
  {
    titre: 'Comment le paiement a été fait',
    blocs: [
      {
        texte:
          'La date du versement, le mode — Mobile Money, espèces, virement bancaire — et la nature du paiement.',
      },
      {
        texte:
          'Le mode n’est pas un détail décoratif. Un virement laisse une trace bancaire, le Mobile Money laisse un identifiant de transaction, les espèces ne laissent que votre document. Savoir, six mois après, comment une somme a été réglée change ce que vous pouvez retrouver.',
      },
      {
        texte:
          'Un cas est traité automatiquement : au-delà de 100 000 FCFA réglés en espèces, le document ajoute une note rappelant qu’un droit de timbre peut être dû. Elle apparaît sans que vous ayez à y penser, et uniquement dans ce cas.',
      },
    ],
  },
  {
    titre: 'Deux signatures, pas une',
    blocs: [
      { texte: 'La plupart des reçus ne portent que la signature du bailleur.' },
      {
        texte:
          'Le document Sikaloc en prévoit deux : celle du bailleur, qui reconnaît avoir reçu la somme, et celle du locataire, qui reconnaît l’avoir versée. Un document signé d’un seul côté n’engage qu’un seul côté.',
      },
      {
        texte:
          'Vous enregistrez votre signature une fois — vous la dessinez à l’écran, ou vous photographiez celle que vous utilisez déjà sur vos papiers, et Sikaloc en détache le trait. Elle se reporte ensuite sur chaque document.',
      },
    ],
  },
  {
    titre: 'Un numéro qui ne se répète jamais',
    blocs: [
      {
        texte:
          'Chaque document reçoit un numéro continu, de la forme 2026-0001, attribué au moment de l’émission. Il porte aussi sa date et son heure.',
      },
      {
        texte:
          'Deux documents ne peuvent pas porter le même numéro, et aucun numéro n’est sauté. Si l’on vous demande un jour l’historique complet d’un locataire, la suite se lit sans trou — et un trou, dans une numérotation, se remarque immédiatement.',
      },
    ],
  },
  {
    titre: 'Une empreinte, conservée par Sikaloc',
    blocs: [
      {
        texte:
          'À l’instant où le PDF est produit, Sikaloc en calcule une empreinte numérique : une suite de caractères qui dépend de chaque octet du fichier. Changez une virgule, un chiffre, un pixel — l’empreinte change entièrement.',
      },
      {
        texte:
          'Cette empreinte ne figure pas sur le document. Elle est enregistrée de notre côté, au moment de l’émission. Elle permet de comparer un fichier qu’on vous présente à celui qui a réellement été émis, et de constater s’il a été modifié depuis.',
      },
    ],
  },
  {
    titre: 'Cinq minutes pour corriger, puis c’est figé',
    blocs: [
      { texte: 'Une erreur de saisie arrive : un montant, un mois, un mode de paiement.' },
      {
        texte:
          'Sikaloc vous laisse cinq minutes après la validation pour corriger. Passé ce délai, le paiement est figé et ne peut plus être modifié.',
      },
      {
        texte:
          'Ce n’est pas une contrainte arbitraire. Un document qu’on peut rééditer indéfiniment ne prouve pas grand-chose ; c’est justement parce qu’il devient impossible à retoucher qu’il garde sa valeur.',
      },
    ],
  },
]

const RECAPITULATIF = [
  'Les deux parties nommées, avec leurs coordonnées',
  'Le logement désigné, adresse complète',
  'La période bornée par deux dates',
  'Le montant en chiffres et en lettres',
  'Quittance ou reçu selon ce qui a réellement été payé',
  'La date, le mode et la nature du règlement',
  'Deux emplacements de signature',
  'Un numéro continu, daté et horodaté',
  'Une empreinte enregistrée à l’émission',
  'Cinq minutes pour corriger, puis le document est figé',
]

export function DocumentGuide() {
  return (
    <Document
      title="Ce que contient une quittance Sikaloc"
      author="Sikaloc"
      subject="Description du document produit par Sikaloc"
      language="fr"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.entete}>
          <LogoMarque hauteur={19} />
          <Text style={styles.surTitre}>GUIDE POUR LES BAILLEURS</Text>
          <Text style={styles.titre}>Ce que contient une quittance Sikaloc</Text>
        </View>

        <View style={styles.avertissement}>
          <Text>
            Ce guide ne vous dit pas ce que la loi exige, ni ce qu’un juge acceptera. Ce n’est
            pas notre métier, et nos conditions d’utilisation l’excluent expressément.
          </Text>
          <Text style={styles.paragraphe}>
            Il décrit une seule chose : <Text style={styles.fort}>ce que Sikaloc écrit sur le
            document qu’il produit</Text>, ligne par ligne. Tout ce qui suit est visible sur un
            document réel, sans créer de compte.
          </Text>
          <Text style={styles.paragraphe}>
            Un guide qui décrit un produit doit pouvoir être contredit par le produit.
          </Text>
        </View>

        {SECTIONS.map((section, rang) => (
          <View key={section.titre} style={styles.section} wrap={false}>
            <Text style={styles.numero}>{String(rang + 1).padStart(2, '0')}</Text>
            <Text style={styles.sousTitre}>{section.titre}</Text>
            {section.blocs.map((bloc) => (
              <Text
                key={bloc.texte}
                style={bloc.citation ? styles.citation : styles.paragraphe}
              >
                {bloc.texte}
              </Text>
            ))}
          </View>
        ))}

        <View style={styles.section} wrap={false}>
          <Text style={styles.numero}>ET LE LOCATAIRE ?</Text>
          <Text style={styles.paragraphe}>
            Il reçoit sa quittance sur WhatsApp, par un lien de téléchargement valable 30 jours.
            Pas de compte à créer, pas de mot de passe, pas d’application à installer. Il
            télécharge son document et le garde.
          </Text>
        </View>

        <View style={styles.recap} wrap={false}>
          <Text style={styles.recapTitre}>En résumé — les dix points</Text>
          {RECAPITULATIF.map((ligne, rang) => (
            <View key={ligne} style={styles.recapLigne}>
              <Text style={styles.recapNumero}>{rang + 1}.</Text>
              <Text style={{ flex: 1 }}>{ligne}</Text>
            </View>
          ))}
        </View>

        <View style={styles.verification} wrap={false}>
          <Text style={styles.fort}>Vérifiez par vous-même</Text>
          <Text style={styles.paragraphe}>
            Ouvrez un document réel, sans créer de compte :
          </Text>
          <Text style={styles.lien}>sikaloc.com/exemple-quittance</Text>
          <Text style={styles.paragraphe}>
            Si quelque chose dans ce guide ne correspond pas à ce que vous y voyez,
            écrivez-nous.
          </Text>
        </View>

        <Text style={styles.mentions}>
          Ce document décrit le fonctionnement d’un outil. Il ne constitue pas un conseil
          juridique et ne remplace pas l’avis d’un professionnel du droit.
        </Text>

        <View style={styles.piedDePage} fixed>
          <Text style={styles.textePied}>Ce que contient une quittance Sikaloc</Text>
          <Text
            style={styles.textePied}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages} · sikaloc.com`}
          />
        </View>
      </Page>
    </Document>
  )
}
