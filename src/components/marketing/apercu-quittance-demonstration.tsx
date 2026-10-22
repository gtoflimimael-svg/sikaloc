import Image from 'next/image'

/**
 * Aperçu éditorial, pas une capture ni une quittance émise.
 * Les rubriques suivent `DocumentQuittance`; toutes les valeurs affichées
 * sont synthétiques et le document porte une mention explicite de démonstration.
 */
export function ApercuQuittanceDemonstration() {
  return (
    <div className="home-document-stage">
      <article
        className="home-receipt-paper"
        aria-label="Aperçu fictif de la structure d’une quittance de loyer Sikaloc"
      >
        <p className="home-receipt-disclaimer">DÉMONSTRATION — DOCUMENT FICTIF</p>

        <header className="home-receipt-header">
          <Image
            src="/marque/sikaloc-officiel-vert.svg"
            alt="Sikaloc"
            width={126}
            height={36}
            className="home-receipt-logo"
          />
          <div className="home-receipt-number">
            <span>N° de document</span>
            <strong>EXEMPLE-SIKALOC</strong>
            <small>Généré le 5 mars 2026</small>
          </div>
        </header>

        <div className="home-receipt-heading">
          <h3>Quittance de loyer</h3>
          <p>Période du 1 au 31 mars 2026</p>
        </div>

        <dl className="home-receipt-summary" aria-label="Résumé fictif de la période">
          <div>
            <dt>Loyer mensuel</dt>
            <dd>75 000 FCFA</dd>
          </div>
          <div>
            <dt>Montant réglé</dt>
            <dd>75 000 FCFA</dd>
          </div>
          <div>
            <dt>Solde restant</dt>
            <dd>0 FCFA</dd>
          </div>
        </dl>

        <div className="home-receipt-parties">
          <section>
            <h4>Bailleur</h4>
            <p>Bailleur de démonstration</p>
          </section>
          <section>
            <h4>Locataire</h4>
            <p>Locataire de démonstration</p>
          </section>
        </div>

        <div className="home-receipt-details">
          <section>
            <h4>Logement loué</h4>
            <p><span>Adresse</span><strong>Logement fictif</strong></p>
            <p><span>Ville</span><strong>Cotonou, Bénin</strong></p>
            <p><span>Type de bien</span><strong>Appartement</strong></p>
          </section>
          <section>
            <h4>Détail du paiement</h4>
            <p><span>Date</span><strong>5 mars 2026</strong></p>
            <p><span>Mode</span><strong>Mobile Money</strong></p>
            <p><span>Nature</span><strong>Loyer</strong></p>
          </section>
        </div>

        <div className="home-receipt-amount">
          <span>Montant reçu · exemple fictif</span>
          <strong>75 000 FCFA</strong>
          <small>Soixante-quinze mille francs CFA</small>
        </div>

        <p className="home-receipt-note">
          Exemple de présentation d’un paiement intégral pour la période indiquée.
        </p>
      </article>
    </div>
  )
}
