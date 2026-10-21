import Link from 'next/link'

/**
 * La réponse unique de `/find/[reference]` à tout ce qui n'est pas une annonce
 * publiée : référence inconnue, mal formée, annonce en brouillon, suspendue,
 * clôturée ou supprimée.
 *
 * Elle ne dit pas laquelle — elle ne le sait pas, et un visiteur n'a pas à
 * apprendre qu'une annonce existe mais n'est plus visible. Aucune donnée n'y
 * est lue : pas même la référence demandée.
 */
export default function AnnonceIntrouvable() {
  return (
    <main id="contenu" className="flex min-h-[70vh] items-center justify-center bg-canvas-soft px-lg py-3xl">
      <div className="card card-lg max-w-[32rem] text-center">
        <h1 className="page-title">Cette annonce n’est pas disponible</h1>
        <p className="mt-sm text-body-md text-body">
          Elle n’existe pas, ou elle n’est plus proposée à la location.
        </p>
        <Link href="/find" className="btn btn-primary mt-lg">
          Voir les logements disponibles
        </Link>
      </div>
    </main>
  )
}
