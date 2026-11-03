'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './editorial.module.css'

export function NavigationLegale({ mentions }: { mentions: boolean }) {
  const chemin = usePathname()
  const liens = [
    ['/legal/conditions', 'Conditions d’utilisation'],
    ['/legal/confidentialite', 'Confidentialité'],
    ...(mentions ? [['/legal/mentions', 'Mentions légales']] : []),
  ]
  return <nav aria-label="Documents juridiques" className={styles.legalNav}>
    {liens.map(([href, libelle]) => <Link key={href} href={href} aria-current={chemin === href ? 'page' : undefined}>{libelle}</Link>)}
  </nav>
}
