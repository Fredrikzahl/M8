import { useSyncExternalStore } from 'react'

// En liten ruter. Ruten ligger i minnet og speiles til adressefeltet (#/sti) der det er mulig,
// slik at tilbakeknappen og delte lenker virker på en vanlig nettside.
const read = () => { const h = location.hash.replace(/^#/, ''); return h.startsWith('/') ? h : '' }
let path = read() || '/'
const stack: string[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

function setHash(p: string, replace: boolean) {
  try {
    if (replace) history.replaceState(null, '', '#' + p)
    else location.hash = p
  } catch { /* adressefeltet kan ikke endres her */ }
}

export function nav(to: string, replace = false) {
  if (to === path) return
  if (!replace) stack.push(path)
  path = to
  setHash(to, replace)
  emit()
  try { window.scrollTo(0, 0) } catch { /* ingen rulling */ }
}

export function back(fallback = '/') {
  const prev = stack.pop()
  path = prev ?? fallback
  setHash(path, true)
  emit()
  try { window.scrollTo(0, 0) } catch { /* ingen rulling */ }
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const h = read()
    if (!h || h === path) return
    stack.push(path)
    path = h
    emit()
  })
}

export const useRoute = () => useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l) } }, () => path)

/** Sammenligner en rute som «/objekt/:id» med gjeldende sti. */
export function match(pattern: string, p: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean), b = p.split('?')[0].split('/').filter(Boolean)
  if (a.length !== b.length) return null
  const out: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) out[a[i].slice(1)] = decodeURIComponent(b[i])
    else if (a[i] !== b[i]) return null
  }
  return out
}
