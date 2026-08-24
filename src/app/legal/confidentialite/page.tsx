import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Politique de confidentialité' }

/**
 * Spec §11.2 — la politique de confidentialité doit être rédigée et accessible
 * depuis le pied de page.
 *
 * Ce texte décrit fidèlement ce que le code fait réellement (RLS, hébergement
 * Francfort, consentement locataire, durées de conservation). Il doit être revu
 * par un conseil juridique avant la mise en production.
 */
export default function PageConfidentialite() {
  return (
    <div className="space-y-xl">
      <header>
        <h1 className="text-display-md font-extrabold tracking-tight text-ink">
          Politique de confidentialité
        </h1>
        <p className="mt-sm text-body-sm text-mute">
          Dernière mise à jour : 17 août 2026
        </p>
      </header>

      <Section titre="1. Qui traite vos données">
        <p>
          Sikaloc est une plateforme de gestion locative destinée aux bailleurs
          individuels. Le bailleur qui utilise Sikaloc est responsable des données
          de ses locataires ; Sikaloc agit comme sous-traitant technique pour leur
          hébergement et leur traitement.
        </p>
      </Section>

      <Section titre="2. Données collectées">
        <p>Sikaloc enregistre :</p>
        <ul>
          <li>
            <strong>Pour le bailleur</strong> : nom, adresse email, numéro de
            téléphone, adresse postale si renseignée, image de signature si
            téléversée, et l&apos;empreinte chiffrée du mot de passe.
          </li>
          <li>
            <strong>Pour le locataire</strong> : nom, numéro de téléphone,
            adresse email si renseignée. Ces données sont saisies par le bailleur,
            qui atteste avoir informé le locataire au préalable.
          </li>
          <li>
            <strong>Données d&apos;activité</strong> : logements, baux, paiements,
            quittances émises et tentatives de connexion (à des fins de sécurité).
          </li>
        </ul>
      </Section>

      <Section titre="3. Finalités">
        <p>
          Les données servent exclusivement à fournir le service : suivi des
          loyers, détection des retards, génération et transmission des quittances,
          gestion de l&apos;abonnement. Elles ne sont ni vendues, ni louées, ni
          utilisées à des fins publicitaires.
        </p>
        <p>
          Une seule finalité distincte existe : l&apos;envoi du guide
          «&nbsp;Ce que contient une quittance Sikaloc&nbsp;» aux personnes qui
          en font la demande depuis la page d&apos;accueil. Ces personnes
          n&apos;ont pas de compte ; leur adresse est conservée séparément et
          n&apos;est jamais rapprochée des données de gestion locative.
        </p>
      </Section>

      <Section titre="3 bis. Demande du guide — base légale et retrait">
        <p>
          <strong>Base légale&nbsp;:</strong> votre consentement, recueilli en
          deux temps. L&apos;adresse saisie ne reçoit qu&apos;un message de
          confirmation&nbsp;; le guide n&apos;est envoyé qu&apos;après que vous
          avez cliqué le lien qu&apos;il contient. Sans ce clic, rien d&apos;autre
          ne vous est adressé.
        </p>
        <p>
          <strong>Données collectées&nbsp;:</strong> votre adresse email, la date
          de la demande et celle de la confirmation. Rien d&apos;autre — ni nom,
          ni téléphone, ni traceur publicitaire.
        </p>
        <p>
          <strong>Retrait&nbsp;:</strong> chaque message contient un lien de
          désinscription. Un seul clic suffit, sans justification et sans étape
          intermédiaire. La date du retrait est conservée, précisément pour ne
          pas vous réinscrire par erreur.
        </p>
      </Section>

      <Section titre="4. Consentement du locataire">
        <p>
          Avant d&apos;enregistrer un locataire, le bailleur doit cocher une case
          attestant l&apos;avoir informé de la collecte de ses données
          personnelles. La date de cette attestation est conservée.
        </p>
      </Section>

      <Section titre="5. Hébergement et sécurité">
        <ul>
          <li>Les données sont hébergées en Europe (Francfort, Allemagne).</li>
          <li>
            Chaque bailleur est cloisonné au niveau de la base de données
            (Row Level Security) : il lui est techniquement impossible de lire les
            données d&apos;un autre bailleur.
          </li>
          <li>
            Les quittances PDF et les signatures sont stockées dans des espaces
            privés. Leur partage passe par des liens signés à durée limitée
            (30 jours).
          </li>
          <li>
            Les mots de passe sont hachés (bcrypt) et ne sont jamais stockés en
            clair. Les échanges sont chiffrés en HTTPS.
          </li>
        </ul>
      </Section>

      <Section titre="6. Durée de conservation">
        <p>
          Les données sont conservées tant que le compte est actif. En cas
          d&apos;impayé d&apos;abonnement : accès en lecture seule à J+3, compte
          suspendu et données archivées à J+30, suppression définitive des données
          personnelles à J+90. Le bailleur peut exporter ses documents avant
          suppression.
        </p>
        <p>
          Les adresses inscrites au guide sont conservées trois ans à compter du
          dernier échange, ou jusqu&apos;à votre désinscription si elle intervient
          avant. Une adresse restée sans confirmation est effacée au bout de
          trente jours.
        </p>
      </Section>

      <Section titre="7. Vos droits">
        <p>
          Toute personne concernée dispose d&apos;un droit d&apos;accès, de
          rectification et de suppression de ses données. Un locataire exerce ces
          droits auprès de son bailleur, qui peut les honorer directement depuis
          son espace Sikaloc. Pour toute demande complémentaire :{' '}
          <a href="mailto:bonjour@sikaloc.com" className="underline">
            bonjour@sikaloc.com
          </a>
          .
        </p>
      </Section>

      <Section titre="8. Sous-traitants">
        <ul>
          <li>Supabase — hébergement de la base de données et des fichiers (Europe).</li>
          <li>Vercel — hébergement de l&apos;application web.</li>
          <li>FedaPay — traitement des paiements d&apos;abonnement par Mobile Money.</li>
          <li>Resend — acheminement des emails transactionnels.</li>
          <li>
            WhatsApp — Sikaloc n&apos;envoie aucun message automatiquement : il
            prépare un texte que le bailleur envoie lui-même depuis son propre
            compte.
          </li>
        </ul>
      </Section>
    </div>
  )
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-display-xs font-semibold text-ink">{titre}</h2>
      <div className="mt-md space-y-md text-body-md leading-relaxed text-body [&_li]:ml-lg [&_li]:list-disc [&_ul]:space-y-sm">
        {children}
      </div>
    </section>
  )
}
