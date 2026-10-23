export default function ChargementFind() {
  return (
    <div className="find-catalog-page min-h-screen">
      <main id="contenu" role="status" aria-live="polite" className="find-catalog-main mx-auto max-w-[1320px]">
        <header className="find-catalog-intro">
          <p className="find-catalog-eyebrow">Catalogue immobilier <span aria-hidden="true">·</span> Bénin</p>
          <h1>Trouvez un logement qui vous ressemble.</h1>
          <p className="find-catalog-description">Nous recherchons les annonces publiées qui correspondent à vos critères.</p>
        </header>
        <div className="find-skeleton-search" aria-hidden="true" />
        <div aria-hidden="true" className="find-property-grid find-skeleton-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="find-skeleton-card motion-safe:animate-pulse">
              <div className="find-skeleton-photo" />
              <div className="find-skeleton-copy">
                <div className="find-skeleton-line find-skeleton-line-short" />
                <div className="find-skeleton-line find-skeleton-line-title" />
                <div className="find-skeleton-line find-skeleton-line-price" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
