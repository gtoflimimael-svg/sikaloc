// Preview stub for `next/navigation`. usePathname returns the dashboard route
// so navigation previews show a realistic active state.
export function usePathname(): string {
  return '/app'
}

export function useRouter() {
  return {
    push() {},
    replace() {},
    back() {},
    forward() {},
    refresh() {},
    prefetch() {},
  }
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams()
}

export function useParams(): Record<string, string> {
  return {}
}

export function useSelectedLayoutSegment(): string | null {
  return null
}

export function redirect(_url: string): void {}
export function notFound(): void {}
