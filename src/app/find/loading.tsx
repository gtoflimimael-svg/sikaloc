export default function ChargementFind() {
  return (
    <main id="contenu" role="status" aria-live="polite" className="app-main mx-auto max-w-[1200px]">
      <div className="rounded-xl bg-surface-dark p-xl text-on-dark">
        <p className="text-body-sm font-semibold text-primary">Sikaloc Find</p>
        <h1 className="mt-sm text-display-sm font-bold text-on-dark">Chargement des logements…</h1>
        <p className="mt-sm text-body-sm text-on-dark-mute">Nous recherchons les annonces publiées qui correspondent à vos critères.</p>
      </div>
      <div aria-hidden="true" className="mt-2xl grid gap-lg sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="overflow-hidden rounded-xl border border-hairline bg-canvas motion-safe:animate-pulse"><div className="aspect-[4/3] bg-canvas-sage" /><div className="space-y-sm p-lg"><div className="h-5 w-2/3 rounded bg-canvas-sage" /><div className="h-4 w-1/2 rounded bg-canvas-sage" /></div></div>)}
      </div>
    </main>
  )
}
