import { useSyncExternalStore } from 'react'

// En liten ruter. Ruten ligger i minnet og speiles til adressefeltet (#/sti) der det er mulig,
// slik at tilbakeknappen og delte lenker virker på en vanlig nettside.
const read = () => { const h = location.hash.replace(/^#/, ''); return h.startsWith('/') ? h : '' }
let path = read() || '/'
const stack: string[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

// Retningen brukes av stilarket til å la nye sider gli inn fra riktig side.
type Dir = 'fwd' | 'back' | 'tab'
function setDir(d: Dir) { try { document.documentElement.dataset.nav = d } catch { /* ingen dokument */ } }

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
  setDir(replace ? 'tab' : 'fwd')
  setHash(to, replace)
  emit()
  try { window.scrollTo(0, 0) } catch { /* ingen rulling */ }
}

/** Hopp til en hovedside fra menyen. Historikken nullstilles, slik at «tilbake» ikke går på kryss av menyen. */
export function navRoot(to: string) {
  if (to === path) { try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { /* ingen rulling */ } return }
  stack.length = 0
  path = to
  setDir('tab')
  setHash(to, false)
  emit()
  try { window.scrollTo(0, 0) } catch { /* ingen rulling */ }
}

export function back(fallback = '/') {
  const prev = stack.pop()
  path = prev ?? fallback
  setDir('back')
  setHash(path, true)
  emit()
  try { window.scrollTo(0, 0) } catch { /* ingen rulling */ }
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const h = read()
    if (!h || h === path) return
    // Nettleserens tilbakeknapp lander på forrige side i vår egen historikk.
    if (stack[stack.length - 1] === h) { stack.pop(); setDir('back') } else { stack.push(path); setDir('fwd') }
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
