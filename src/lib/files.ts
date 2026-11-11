// Lagring av filer, utskrift og kopiering. Fungerer både på en vanlig nettside og
// inne i en Claude-artefakt, der nedlasting må gå gjennom vertssiden.

type ClaudeHost = { use?: (name: string) => Promise<{ save: (r: { filename: string; data: string | Blob }) => Promise<unknown> } | null> }
const host = (): ClaudeHost | undefined => (window as unknown as { claude?: ClaudeHost }).claude

/** Sant når appen kjører som forhåndsvisning i en artefakt og ikke på egen adresse. */
export const inArtifact = () => import.meta.env.MODE === 'artifact' || !!host()?.use
export const canPrint = () => !inArtifact()

export async function saveFile(filename: string, data: string | Blob, mime = 'text/plain'): Promise<'lagret' | 'avbrutt' | 'utilgjengelig'> {
  const h = host()
  if (h?.use) {
    try {
      const dl = await h.use('downloads')
      if (!dl) return 'utilgjengelig'
      await dl.save({ filename, data })
      return 'lagret'
    } catch (e) {
      return (e as { code?: string })?.code === 'declined' ? 'avbrutt' : 'utilgjengelig'
    }
  }
  try {
    const blob = typeof data === 'string' ? new Blob([data], { type: mime + ';charset=utf-8' }) : data
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return 'lagret'
  } catch { return 'utilgjengelig' }
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { /* prøver gammel metode */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy'); ta.remove()
    return ok
  } catch { return false }
}

export function printPage() { try { window.print() } catch { /* ikke tilgjengelig her */ } }

/** Adressen til en side i appen, slik den kan deles eller legges i en QR-kode. */
export function appUrl(path: string) {
  const base = !inArtifact() && /^https?:/.test(location.protocol) ? location.origin + location.pathname : 'https://planm8.example/'
  return `${base}#${path}`
}
