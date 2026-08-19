import type { Metadata } from 'next'

import { formaterFCFA } from '@/lib/format'
import { LIMITE_LOGEMENTS_GRATUIT, PRIX_STANDARD_FCFA } from '@/lib/plan'

export const metadata: Metadata = { title: "Conditions d'utilisation" }

export default function PageConditions() {
  return (
    <div className="space-y-xl">
      <header>
        <h1 className="text-display-md font-extrabold tracking-tight text-ink">
          Conditions d&apos;utilisation
        </h1>
        <p className="mt-sm text-body-sm text-mute">Dernière mise à jour : 17 août 2026</p>
      </header>

      <Section titre="1. Objet">
        <p>
          Sikaloc est un outil de gestion locative destiné aux bailleurs individuels
          au Bénin. Il permet d&apos;enregistrer des logements, des locataires et
          des baux, de saisir des paiements, de détecter les retards et de
          produire des quittances de loyer.
        </p>
      </Section>

      <Section titre="2. Rôle de Sikaloc">
        <p>
          Sikaloc est un outil, pas une partie au contrat de bail. Sikaloc ne fournit
          aucun conseil juridique, ne perçoit aucun loyer pour le compte du
          bailleur et n&apos;intervient dans aucun litige entre bailleur et
          locataire.
        </p>
      </Section>

      <Section titre="3. Documents émis" ancre="quittances">
        <ul>
          <li>
            Les quittances et reçus sont générés <strong>sous la responsabilité
            du bailleur</strong>, dont le nom figure sur chaque document.
          </li>
          <li>
            Chaque document porte un numéro unique, la date et l&apos;heure de sa
            génération, ainsi que le détail du paiement en chiffres et en lettres.
          </li>
          <li>
            Lorsque le montant reçu est inférieur au loyer de la période, le
            document émis est un <strong>reçu</strong> et non une quittance : il
            ne libère pas le locataire du solde restant dû.
          </li>
          <li>
            La mention du droit de timbre indique qu&apos;il est à la charge du
            locataire. Sikaloc ne calcule pas son montant et ne procède à aucun
            acquittement : cela relève des parties.
          </li>
          <li>
            La signature apposée est une <strong>signature électronique
            simple</strong> (image téléversée par le bailleur). Elle ne constitue
            pas une signature électronique qualifiée.
          </li>
          <li>
            Un paiement validé peut être corrigé pendant 5 minutes. Passé ce
            délai, il est figé : c&apos;est ce qui garantit la valeur probante du
            document déjà transmis au locataire.
          </li>
        </ul>
      </Section>

      <Section titre="4. Abonnement">
        <ul>
          <li>
            Le plan <strong>Gratuit</strong> permet de gérer jusqu&apos;à{' '}
            {LIMITE_LOGEMENTS_GRATUIT} logements et produit des quittances
            basiques, sans mention du droit de timbre ni relances WhatsApp.
          </li>
          <li>
            Le plan <strong>Standard</strong>, à {formaterFCFA(PRIX_STANDARD_FCFA)}{' '}
            par mois, lève ces limites. Il est payable par Mobile Money, sans
            engagement de durée.
          </li>
          <li>
            En cas d&apos;échec de prélèvement : rappel à J+0, accès en lecture
            seule à J+3, compte suspendu et données archivées à J+30, suppression
            des données personnelles à J+90.
          </li>
        </ul>
      </Section>

      <Section titre="5. Parrainage">
        <p>
          Chaque bailleur dispose d&apos;un code de parrainage. À la première
          souscription payante d&apos;un filleul, le parrain et le filleul
          reçoivent chacun un mois d&apos;abonnement offert. La récompense
          n&apos;est versée qu&apos;une seule fois par filleul.
        </p>
      </Section>

      <Section titre="6. Obligations du bailleur">
        <ul>
          <li>
            Informer ses locataires de la collecte de leurs données avant de les
            enregistrer dans Sikaloc.
          </li>
          <li>
            S&apos;assurer de l&apos;exactitude des montants, périodes et
            identités saisis : ce sont eux qui figurent sur les documents émis.
          </li>
          <li>
            Conserver ses identifiants de connexion confidentiels.
          </li>
        </ul>
      </Section>

      <Section titre="7. Limitation de responsabilité">
        <p>
          Sikaloc met en œuvre les moyens raisonnables pour assurer la disponibilité
          et l&apos;intégrité du service. La responsabilité de Sikaloc ne saurait
          être engagée en cas d&apos;erreur de saisie du bailleur, de litige
          locatif, ou de non-conformité d&apos;un document à une exigence légale
          non couverte par le modèle proposé. Il appartient au bailleur de faire
          valider le modèle de quittance par son conseil.
        </p>
      </Section>
    </div>
  )
}

function Section({
  titre,
  ancre,
  children,
}: {
  titre: string
  ancre?: string
  children: React.ReactNode
}) {
  return (
    <section id={ancre}>
      <h2 className="text-display-xs font-semibold text-ink">{titre}</h2>
      <div className="mt-md space-y-md text-body-md leading-relaxed text-body [&_li]:ml-lg [&_li]:list-disc [&_ul]:space-y-sm">
        {children}
      </div>
    </section>
  )
}
