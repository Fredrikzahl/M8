import { useSyncExternalStore } from 'react'

// Installering som egen app. Chrome, Edge og Android gir et eget spørsmål vi kan vise ved trykk.
// Safari på iPhone og iPad har ikke det, så der forklarer vi hvordan det gjøres fra delemenyen.
interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let saved: InstallEvent | null = null
let done = false
const listeners = new Set<() => void>()
const tell = () => listeners.forEach(l => l())

const standalone = () => {
  try { return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true } catch { return false }
}
const framed = () => { try { return window.self !== window.top } catch { return true } }
const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export type InstallState = 'installed' | 'ready' | 'ios' | 'manual' | 'none'
function state(): InstallState {
  if (done || standalone()) return 'installed'
  if (framed()) return 'none'
  if (saved) return 'ready'
  return ios() ? 'ios' : 'manual'
}

/** Starter lyttingen og registrerer tjenestearbeideren. Kalles én gang når appen starter. */
export function initInstall() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); saved = e as InstallEvent; tell() })
  window.addEventListener('appinstalled', () => { saved = null; done = true; tell() })
  // Tjenestearbeideren finnes bare i det vanlige bygget, ikke i utviklingsmodus eller i énfilsbygget.
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  if (import.meta.env.PROD && import.meta.env.MODE !== 'artifact' && secure && !framed() && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* appen virker uten */ }) })
  }
}

/** Viser nettleserens spørsmål om installering. Svarer sant når brukeren sa ja. */
export async function promptInstall() {
  if (!saved) return false
  const e = saved
  saved = null
  await e.prompt()
  const { outcome } = await e.userChoice
  if (outcome === 'accepted') done = true
  tell()
  return outcome === 'accepted'
}

export const useInstall = () => useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l) } }, state)
