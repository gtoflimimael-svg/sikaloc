/** Une page absente vaut 1 ; une page ambiguë ou hors bornes est refusée. */
export function lireNumeroPage(brut: string | string[] | undefined, maximum = 1000): number | null {
  if (brut === undefined) return 1
  if (typeof brut !== 'string' || !/^[1-9]\d{0,3}$/.test(brut)) return null
  const page = Number(brut)
  return page <= maximum ? page : null
}
