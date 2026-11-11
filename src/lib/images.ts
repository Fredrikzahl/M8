import type { ObjType, Photo } from '../types'
import { SHAPES, TYPE_SHAPE } from './shapes'
import { now, uid } from './util'

// Demobilder plukkes opp fra src/assets/demo-photos når de finnes ved bygging.
const found = import.meta.glob('../assets/demo-photos/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' }) as Record<string, string>
const DEMO: Record<string, string> = {}
for (const [path, url] of Object.entries(found)) DEMO[path.split('/').pop()!.replace(/\.\w+$/, '')] = url

// Bilder tatt i appen lagres i nettleserens IndexedDB, ikke i selve tilstanden.
const mem = new Map<string, string>()
let db: IDBDatabase | null = null

export function initImages(): Promise<void> {
  return new Promise(resolve => {
    const done = () => resolve()
    const timer = setTimeout(done, 1500)
    try {
      const req = indexedDB.open('m8-bilder', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('img')
      req.onerror = () => { clearTimeout(timer); done() }
      req.onsuccess = () => {
        db = req.result
        const cur = db.transaction('img').objectStore('img').openCursor()
        cur.onsuccess = () => {
          const c = cur.result
          if (c) { mem.set(String(c.key), c.value as string); c.continue() } else { clearTimeout(timer); done() }
        }
        cur.onerror = () => { clearTimeout(timer); done() }
      }
    } catch { clearTimeout(timer); done() }
  })
}

export function saveImage(dataUrl: string): string {
  const id = 'img:' + uid()
  mem.set(id, dataUrl)
  try { db?.transaction('img', 'readwrite').objectStore('img').put(dataUrl, id) } catch { /* bildet lever videre i minnet */ }
  return id
}
/** Referanse til et tegnet demobilde. Bildet lages først når det skal vises. */
export const genSrc = (type: ObjType, shape: string, label: string) => `gen:${type}|${shape}|${label}`

export function clearImages() {
  mem.clear()
  try { db?.transaction('img', 'readwrite').objectStore('img').clear() } catch { /* ingenting å tømme */ }
}
/** Gjør en bildereferanse om til noe en <img> kan vise. Undefined betyr at tegningen skal brukes. */
export function img(src?: string): string | undefined {
  if (!src) return undefined
  if (src.startsWith('demo:')) return DEMO[src.slice(5)]
  if (src.startsWith('img:')) return mem.get(src)
  if (src.startsWith('gen:')) {
    let v = mem.get(src)
    if (!v) { const [type, shape, label] = src.slice(4).split('|'); v = demoPhoto(type as ObjType, shape, label); mem.set(src, v) }
    return v
  }
  return src
}

function fit(w: number, h: number, max: number) { const k = Math.min(1, max / Math.max(w, h)); return [Math.round(w * k), Math.round(h * k)] }

export function fileToDataUrl(file: File, max = 1280, q = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => {
      const [w, h] = fit(im.naturalWidth, im.naturalHeight, max)
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h
      cv.getContext('2d')!.drawImage(im, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(cv.toDataURL('image/jpeg', q))
    }
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Kunne ikke lese bildet')) }
    im.src = url
  })
}

export function frameToDataUrl(video: HTMLVideoElement, max = 1280, q = 0.72) {
  const [w, h] = fit(video.videoWidth, video.videoHeight, max)
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  cv.getContext('2d')!.drawImage(video, 0, 0, w, h)
  return cv.toDataURL('image/jpeg', q)
}

export function drawShape(ctx: CanvasRenderingContext2D, shape: string, x: number, y: number, w: number, colors = { body: '#F2A33A', dark: '#0C1612', glass: '#BFCBC3' }) {
  const k = w / 200
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k)
  for (const p of SHAPES[shape] ?? []) { ctx.fillStyle = colors[p.role]; ctx.fill(new Path2D(p.d)) }
  ctx.restore()
}

/** Et tegnet demobilde, slik at skjemaene kan prøves på en maskin uten kamera. */
export function demoPhoto(type: ObjType, shape: string, label: string): string {
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 480
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#2B3F36'; ctx.fillRect(0, 0, 640, 480)
  ctx.fillStyle = '#3A5247'; ctx.fillRect(0, 372, 640, 108)
  drawShape(ctx, shape || TYPE_SHAPE[type].shape, 100, 108, 440)
  ctx.fillStyle = 'rgba(19,32,27,0.82)'; ctx.fillRect(0, 0, 640, 44)
  ctx.fillStyle = '#F4F2EC'; ctx.font = '600 20px "Public Sans", Arial, sans-serif'; ctx.textBaseline = 'middle'
  ctx.fillText(`Demobilde · ${label}`, 16, 23)
  return cv.toDataURL('image/jpeg', 0.7)
}

export function getPos(timeout = 2500): Promise<{ lat: number; lon: number } | undefined> {
  return new Promise(resolve => {
    const t = setTimeout(() => resolve(undefined), timeout + 300)
    try {
      navigator.geolocation.getCurrentPosition(
        p => { clearTimeout(t); resolve({ lat: Math.round(p.coords.latitude * 1e4) / 1e4, lon: Math.round(p.coords.longitude * 1e4) / 1e4 }) },
        () => { clearTimeout(t); resolve(undefined) },
        { timeout, maximumAge: 60000 },
      )
    } catch { clearTimeout(t); resolve(undefined) }
  })
}

export function makePhoto(dataUrl: string, source: Photo['source'], angle?: string, place?: string, pos?: Photo['pos']): Photo {
  return { id: uid('ph'), src: saveImage(dataUrl), angle, at: now(), place, pos, source }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src })
}

/** Ferdig bilde til sosiale medier: «Min maskin er nr. 12 i Norge». */
export async function rankCard(o: { rank: number; name: string; company: string; type: ObjType; src?: string; total: number }): Promise<Blob> {
  const S = 1080
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#0C1612'; ctx.fillRect(0, 0, S, S)
  const url = img(o.src)
  const im = url ? await loadImage(url) : null
  if (im) {
    const k = Math.max(S / im.naturalWidth, 700 / im.naturalHeight)
    const w = im.naturalWidth * k, h = im.naturalHeight * k
    ctx.drawImage(im, (S - w) / 2, 150 + (700 - h) / 2 - 60, w, h)
  } else {
    ctx.fillStyle = '#22342C'; ctx.fillRect(0, 150, S, 620)
    drawShape(ctx, TYPE_SHAPE[o.type].shape, 190, 250, 700)
  }
  ctx.fillStyle = '#0C1612'; ctx.fillRect(0, 0, S, 150); ctx.fillRect(0, 770, S, 310)
  ctx.textBaseline = 'alphabetic'
  ctx.font = '600 74px Oswald, "Arial Narrow", Arial, sans-serif'
  ctx.fillStyle = '#F4F2EC'; ctx.fillText('TOPP', 60, 108)
  ctx.fillStyle = '#F2A33A'; ctx.fillText('100', 60 + ctx.measureText('TOPP ').width, 108)
  ctx.font = '600 30px "Public Sans", Arial, sans-serif'; ctx.fillStyle = '#BFCBC3'; ctx.textAlign = 'right'
  ctx.fillText('PlanM8', S - 60, 104); ctx.textAlign = 'left'
  ctx.fillStyle = '#F2A33A'; ctx.font = '600 150px Oswald, "Arial Narrow", Arial, sans-serif'
  ctx.fillText(`Nr. ${o.rank}`, 60, 930)
  ctx.fillStyle = '#F4F2EC'; ctx.font = '700 46px "Public Sans", Arial, sans-serif'
  ctx.fillText(`Min maskin er nr. ${o.rank} i Norge`, 60, 995)
  ctx.fillStyle = '#BFCBC3'; ctx.font = '400 32px "Public Sans", Arial, sans-serif'
  ctx.fillText(`${o.name} · ${o.company} · av ${o.total} maskiner`.slice(0, 62), 60, 1044)
  return new Promise(resolve => cv.toBlob(b => resolve(b ?? new Blob()), 'image/png'))
}
