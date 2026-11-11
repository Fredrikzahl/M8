import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import qrcode from 'qrcode-generator'
import type { FormDamage, ObjType, Photo } from '../types'
import type { Shot } from '../lib/logic'
import { fileToDataUrl, frameToDataUrl, genSrc, getPos, img, makePhoto } from '../lib/images'
import { overlayShape } from '../lib/shapes'
import { now, uid } from '../lib/util'
import { Icon } from './icons'
import { Btn, MachineArt, cx } from './kit'

// ---------- Kamera med omriss ----------
// Bruker kameraet direkte når nettleseren tillater det. Ellers kan brukeren åpne
// telefonens kamera via filvelgeren, eller bruke et tegnet demobilde.
export function GuidedCamera(p: {
  title: string; type: ObjType; shots: Shot[]; photos: Record<string, Photo | undefined>; place?: string
  onPhoto: (key: string, photo: Photo) => void; onClose: () => void; extra?: ReactNode
}) {
  const firstMissing = () => Math.max(0, p.shots.findIndex(s => !p.photos[s.key]))
  const [i, setI] = useState(firstMissing)
  const [live, setLive] = useState<'venter' | 'ja' | 'nei'>('venter')
  const [flash, setFlash] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const pos = useRef<{ lat: number; lon: number } | undefined>(undefined)
  const shot = p.shots[Math.min(i, p.shots.length - 1)]
  const requiredLeft = p.shots.filter(s => s.required && !p.photos[s.key]).length
  const taken = p.photos[shot.key]

  useEffect(() => {
    let stream: MediaStream | undefined, dead = false
    getPos().then(x => { pos.current = x })
    const md = navigator.mediaDevices
    if (!md?.getUserMedia) { setLive('nei'); return }
    md.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(s => {
        if (dead) { s.getTracks().forEach(t => t.stop()); return }
        stream = s
        if (video.current) { video.current.srcObject = s; video.current.play().catch(() => undefined) }
        setLive('ja')
      })
      .catch(() => setLive('nei'))
    return () => { dead = true; stream?.getTracks().forEach(t => t.stop()) }
  }, [])

  const done = (photo: Photo) => {
    p.onPhoto(shot.key, photo)
    setFlash(true); setTimeout(() => setFlash(false), 160)
    const next = p.shots.findIndex((s, k) => k !== i && !p.photos[s.key] && k > i)
    const any = p.shots.findIndex((s, k) => k !== i && !p.photos[s.key])
    if (next >= 0) setI(next); else if (any >= 0) setI(any)
  }
  const shoot = () => {
    if (live === 'ja' && video.current?.videoWidth) done(makePhoto(frameToDataUrl(video.current), 'app', shot.label, p.place, pos.current))
    else file.current?.click()
  }
  const demo = () => done({ id: uid('ph'), src: genSrc(p.type, overlayShape(p.type, shot.overlay), shot.label), angle: shot.label, at: now(), place: p.place, pos: pos.current, source: 'demo' })
  const onFile = async (f?: File) => { if (f) try { done(makePhoto(await fileToDataUrl(f), live === 'ja' ? 'app' : 'opplastet', shot.label, p.place, pos.current)) } catch { /* kunne ikke lese fila */ } }

  return (
    <div className="cam" role="dialog" aria-modal="true" aria-label="Kamera">
      <div className="cam-top">
        <div><p className="eyebrow">{p.title}</p><h1>{shot.label}</h1></div>
        <span className="pill ink-inv">{Math.min(i + 1, p.shots.length)} av {p.shots.length}</span>
        <button className="iconbtn" aria-label="Lukk kamera" onClick={p.onClose}><Icon name="close" size={18} /></button>
      </div>
      <div className={cx('cam-view', flash && 'flash')}>
        <video ref={video} playsInline muted style={{ display: live === 'ja' && !taken ? 'block' : 'none' }} />
        {taken && <img src={img(taken.src)} alt={shot.label} />}
        {!taken && <MachineArt type={p.type} shape={overlayShape(p.type, shot.overlay)} outline className="cam-outline" />}
        {taken && <span className="cam-ok"><Icon name="check" size={16} sw={3} />Tatt</span>}
        <div className="cam-hint">
          <p>{shot.hint}</p>
          <small>{live === 'nei' ? 'Kameraet er ikke tilgjengelig her. Velg et bilde eller bruk et demobilde.' : 'Tid og posisjon lagres automatisk'}</small>
        </div>
      </div>
      <div className="cam-dots">{p.shots.map((s, k) => <button key={s.key} aria-label={s.label} className={cx(p.photos[s.key] && 'done', k === i && 'cur', !s.required && 'opt')} onClick={() => setI(k)} />)}</div>
      <div className="cam-bar">
        <Btn kind="ghost" small onClick={demo}>Demobilde</Btn>
        <button className="shutter" onClick={shoot} aria-label={taken ? 'Ta bildet på nytt' : 'Ta bilde'} />
        {requiredLeft === 0 ? <Btn kind="amber" small onClick={p.onClose}>Ferdig</Btn> : p.extra ?? <Btn kind="ghost" small onClick={() => file.current?.click()}>Velg bilde</Btn>}
      </div>
      <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}

/** Ett enkelt bilde, for eksempel ved feilmelding eller registrering. */
export function PhotoField({ photo, onPhoto, type, label, hint, place }: { photo?: Photo; onPhoto: (p: Photo) => void; type: ObjType; label: string; hint: string; place?: string }) {
  const [open, setOpen] = useState(false)
  const url = img(photo?.src)
  return (
    <>
      <button className={cx('photofield', !!photo && 'has')} onClick={() => setOpen(true)}>
        {url ? <img src={url} alt={label} /> : <span className="photofield-empty"><Icon name="camera" size={26} /><b>{label}</b><small>{hint}</small></span>}
        {photo && <span className="pill ink">Bytt bilde</span>}
      </button>
      {open && <GuidedCamera title={label} type={type} place={place} shots={[{ key: 'x', label, hint, overlay: 'side', required: true }]} photos={{}} onPhoto={(_, ph) => { onPhoto(ph); setOpen(false) }} onClose={() => setOpen(false)} />}
    </>
  )
}

// ---------- Sveipekort ----------
export function SwipeCard({ id, onLeft, onRight, children }: { id: string; onLeft: () => void; onRight: () => void; children: ReactNode }) {
  const [dx, setDx] = useState(0)
  const [out, setOut] = useState(0)
  const start = useRef<number | null>(null)
  useEffect(() => { setDx(0); setOut(0); start.current = null }, [id])
  const fly = (dir: number) => { setOut(dir); setTimeout(dir < 0 ? onLeft : onRight, 180) }
  const up = () => { if (start.current == null) return; start.current = null; if (dx > 90) fly(1); else if (dx < -90) fly(-1); else setDx(0) }
  return (
    <div className="swipe" tabIndex={0}
      onKeyDown={e => { if (e.key === 'ArrowLeft') fly(-1); if (e.key === 'ArrowRight') fly(1) }}
      onPointerDown={e => { if ((e.target as HTMLElement).closest('button,a,input')) return; start.current = e.clientX; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }}
      onPointerMove={e => { if (start.current != null) setDx(e.clientX - start.current) }}
      onPointerUp={up} onPointerCancel={up}
      style={{ transform: out ? `translateX(${out * 130}%) rotate(${out * 14}deg)` : `translateX(${dx}px) rotate(${dx / 28}deg)`, transition: start.current != null ? 'none' : 'transform .18s ease', opacity: out ? 0 : 1 }}>
      {dx > 40 && <span className="swipe-tag yes">Ja</span>}
      {dx < -40 && <span className="swipe-tag no">Nei</span>}
      {children}
    </div>
  )
}

// ---------- Signatur ----------
export function SignaturePad({ value, onChange, label }: { value?: string; onChange: (v?: string) => void; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  const xy = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 600, ((e.clientY - r.top) / r.height) * 180] }
  const ctx = () => { const c = ref.current!.getContext('2d')!; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#13201B'; return c }
  return (
    <div className="sign">
      <div className="sign-h"><b>{label}</b>{value && <button className="link" onClick={() => { ctx().clearRect(0, 0, 600, 180); dirty.current = false; onChange(undefined) }}>Tøm</button>}</div>
      {value && !dirty.current
        ? <img src={value} alt={`Signatur: ${label}`} className="sign-img" />
        : <canvas ref={ref} width={600} height={180} aria-label={`Signer her: ${label}`}
            onPointerDown={e => { drawing.current = true; ref.current!.setPointerCapture(e.pointerId); const [x, y] = xy(e); const c = ctx(); c.beginPath(); c.moveTo(x, y) }}
            onPointerMove={e => { if (!drawing.current) return; const [x, y] = xy(e); const c = ctx(); c.lineTo(x, y); c.stroke(); dirty.current = true }}
            onPointerUp={() => { if (!drawing.current) return; drawing.current = false; if (dirty.current) onChange(ref.current!.toDataURL('image/png')) }} />}
      {!value && <small>Signer med finger eller mus</small>}
    </div>
  )
}

// ---------- QR-kode ----------
export function QrSvg({ text, size = 200 }: { text: string; size?: number }) {
  const d = useMemo(() => {
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make()
    const n = qr.getModuleCount()
    let path = ''
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + 2} ${r + 2}h1v1h-1z`
    return { path, n: n + 4 }
  }, [text])
  return <svg viewBox={`0 0 ${d.n} ${d.n}`} width={size} height={size} role="img" aria-label="QR-kode" shapeRendering="crispEdges"><rect width={d.n} height={d.n} fill="#fff" /><path d={d.path} fill="#13201B" /></svg>
}

// ---------- Skader merket på tegning ----------
export function DamageSketch({ type, damages, onChange, readOnly, isNew }: { type: ObjType; damages: FormDamage[]; onChange?: (d: FormDamage[]) => void; readOnly?: boolean; isNew?: boolean }) {
  const add = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !onChange) return
    const r = e.currentTarget.getBoundingClientRect()
    onChange([...damages, { id: uid('s'), x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, note: '', isNew }])
  }
  return (
    <div className="sketch-wrap">
      <div className={cx('sketch', readOnly && 'ro')} onClick={add} role={readOnly ? undefined : 'button'} aria-label="Trykk på tegningen der skaden er">
        <MachineArt type={type} />
        {damages.map((d, k) => <span key={d.id} className={cx('mark', d.isNew && 'new')} style={{ left: d.x * 100 + '%', top: d.y * 100 + '%' }}>{k + 1}</span>)}
      </div>
      {!readOnly && <small>Trykk på tegningen der skaden er.</small>}
      {damages.map((d, k) => (
        <div className="mark-row" key={d.id}>
          <span className={cx('mark static', d.isNew && 'new')}>{k + 1}</span>
          {readOnly || !onChange || (isNew && !d.isNew)
            ? <span>{d.note || 'Skade uten beskrivelse'}{isNew && !d.isNew && <small> · fra utlevering</small>}</span>
            : <><input value={d.note} placeholder="Beskriv skaden" aria-label={`Beskrivelse av skade ${k + 1}`} onChange={e => onChange(damages.map(x => x.id === d.id ? { ...x, note: e.target.value } : x))} />
              <button className="iconbtn small" aria-label="Fjern merket" onClick={() => onChange(damages.filter(x => x.id !== d.id))}><Icon name="close" size={14} /></button></>}
        </div>
      ))}
    </div>
  )
}
