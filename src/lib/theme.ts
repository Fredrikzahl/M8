import { useSyncExternalStore } from 'react'

// Lys, mørk eller automatisk modus. Valget huskes i denne nettleseren.
// I automatisk modus følger appen systemet (eller siden den er lagt inn i).
export type ThemeMode = 'auto' | 'light' | 'dark'
const KEY = 'm8-tema'
export const THEME_LABEL: Record<ThemeMode, string> = { auto: 'Følger systemet', light: 'Lys', dark: 'Mørk' }

function read(): ThemeMode {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto' } catch { return 'auto' }
}
let mode: ThemeMode = 'auto'
const listeners = new Set<() => void>()

function paint(first = false) {
  const el = document.documentElement
  if (mode === 'auto') { if (!first) el.removeAttribute('data-theme') } else el.setAttribute('data-theme', mode)
  // Farge på nettleserens ramme og statuslinje følger bakgrunnen.
  try {
    const bg = getComputedStyle(el).getPropertyValue('--bg').trim()
    if (bg) document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', bg))
  } catch { /* ikke viktig */ }
}

export function initTheme() {
  mode = read()
  paint(true)
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (mode === 'auto') paint(true) }) } catch { /* eldre nettlesere */ }
}

export function setTheme(m: ThemeMode) {
  mode = m
  try { if (m === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, m) } catch { /* lagring er ikke tilgjengelig */ }
  paint()
  listeners.forEach(l => l())
}

/** Sant når siden vises mørk akkurat nå, uansett om det er valgt eller følger systemet. */
export function isDark() {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'dark') return true
  if (attr === 'light') return false
  try { return matchMedia('(prefers-color-scheme: dark)').matches } catch { return false }
}

export const useTheme = () => useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l) } }, () => mode)
