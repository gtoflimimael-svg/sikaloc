// Preview stub for `next/link` — the real one needs an App Router context that
// design previews don't have (it throws "expected app router to be mounted").
// A plain anchor keeps href, className and children behaving identically.
import type { AnchorHTMLAttributes, ReactNode } from 'react'

type HrefLike = string | { pathname?: string }

export default function Link({
  href,
  children,
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  ...rest
}: {
  href?: HrefLike
  children?: ReactNode
  prefetch?: boolean
  replace?: boolean
  scroll?: boolean
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const url = typeof href === 'string' ? href : (href?.pathname ?? '#')
  return (
    <a href={url} {...rest}>
      {children}
    </a>
  )
}
