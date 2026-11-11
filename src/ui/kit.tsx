import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { Icon } from './icons'
import { back, nav } from '../router'
import { img } from '../lib/images'
import { NORWAY, SHAPES, TYPE_SHAPE } from '../lib/shapes'
import { coords, initials } from '../lib/util'
import type { Obj, ObjType } from '../types'
import { login } from '../actions'
import { store } from '../store'

type Kids = { children?: ReactNode }
const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(' ')

// ---------- Side ----------
export function Wordmark({ a, tone = 'amber', size = 26 }: { a: string; tone?: 'amber' | 'blue' | 'green' | 'plain'; size?: number }) {
  return <span className="wordmark" style={{ fontSize: size }}>{a}<span className={'wm-' + tone}>M8</span></span>
}

export function Page(p: Kids & { title?: ReactNode; eyebrow?: string; sub?: ReactNode; back?: boolean | string; right?: ReactNode; tone?: 'light' | 'dark' | 'night'; wide?: boolean; footer?: ReactNode; brand?: ReactNode; flush?: boolean }) {
  return (
    <div className={cx('screen', p.tone && p.tone !== 'light' && 'dark', p.tone === 'night' && 'night')}>
      <header className="top">
        <div className={cx('top-in', p.wide && 'wide')}>
          {p.back && <button className="iconbtn" aria-label="Tilbake" onClick={() => back(typeof p.back === 'string' ? p.back : '/')}><Icon name="back" sw={2.5} size={20} /></button>}
          <div className="top-title">
            {p.eyebrow && <p className="eyebrow">{p.eyebrow}</p>}
            {p.brand ?? <h1>{p.title}</h1>}
          </div>
          {p.right && <div className="top-right">{p.right}</div>}
        </div>
        {p.sub && <div className={cx('top-in', p.wide && 'wide')}><p className="top-sub">{p.sub}</p></div>}
      </header>
      <div className={cx('page', p.wide && 'wide', p.flush && 'flush')}>{p.children}</div>
      {p.footer && <footer className="bar"><div className={cx('bar-in', p.wide && 'wide')}>{p.footer}</div></footer>}
    </div>
  )
}

// ---------- Byggeklosser ----------
export const Card = ({ children, className, onClick, style }: Kids & { className?: string; onClick?: () => void; style?: CSSProperties }) =>
  onClick ? <button className={cx('card card-btn', className)} onClick={onClick} style={style}>{children}</button> : <div className={cx('card', className)} style={style}>{children}</div>

export function Btn(p: Kids & { kind?: 'primary' | 'amber' | 'blue' | 'ghost' | 'danger' | 'quiet'; onClick?: () => void; block?: boolean; small?: boolean; disabled?: boolean; icon?: string; to?: string; label?: string }) {
  return (
    <button className={cx('btn', p.kind ?? 'primary', p.block && 'block', p.small && 'small')} disabled={p.disabled} aria-label={p.label}
      onClick={() => { if (p.to) nav(p.to); p.onClick?.() }}>
      {p.icon && <Icon name={p.icon} size={p.small ? 16 : 18} />}{p.children}
    </button>
  )
}

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'amber' | 'plain' | 'mute' | 'ink' | 'blue'
export const Pill = ({ tone = 'plain', children }: Kids & { tone?: Tone | string }) => <span className={'pill ' + tone}>{children}</span>

export function Seg<T extends string>({ value, onChange, options, tone }: { value: T; onChange: (v: T) => void; options: (T | [T, string])[]; tone?: 'amber' | 'blue' }) {
  return (
    <div className={cx('seg', tone)} role="group">
      {options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <button key={v} aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button> })}
    </div>
  )
}

export function Chips<T extends string>({ value, onChange, options, single }: { value: T[]; onChange: (v: T[]) => void; options: (T | [T, string])[]; single?: boolean }) {
  return (
    <div className="chips">
      {options.map(o => {
        const [v, l] = Array.isArray(o) ? o : [o, o]
        const on = value.includes(v)
        return <button key={v} className="chip" aria-pressed={on} onClick={() => onChange(single ? [v] : on ? value.filter(x => x !== v) : [...value, v])}>{l}</button>
      })}
    </div>
  )
}

export function Field({ label, hint, children, row }: Kids & { label: string; hint?: ReactNode; row?: boolean }) {
  return <label className={cx('field', row && 'row')}><span className="field-l">{label}{hint && <small>{hint}</small>}</span>{children}</label>
}
export const Toggle = ({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; sub?: ReactNode }) => (
  <label className="toggle"><span><b>{label}</b>{sub && <small>{sub}</small>}</span><input type="checkbox" role="switch" checked={on} onChange={e => onChange(e.target.checked)} /></label>
)

export const Section = ({ title, right, children }: Kids & { title: ReactNode; right?: ReactNode }) => (
  <section className="section"><div className="section-h"><h2>{title}</h2>{right}</div>{children}</section>
)
export const Stat = ({ label, value, tone }: { label: string; value: ReactNode; tone?: 'amber' | 'ink' | 'blue' }) => (
  <div className={cx('stat', tone)}><p>{label}</p><b>{value}</b></div>
)
export const KV = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="kv">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
)
export const Empty = ({ title, text, children }: Kids & { title: string; text?: string }) => (
  <div className="empty"><h2>{title}</h2>{text && <p>{text}</p>}{children}</div>
)
export const Notice = ({ tone = 'info', children, icon }: Kids & { tone?: 'info' | 'ok' | 'warn' | 'bad' | 'plain'; icon?: string }) => (
  <div className={'notice ' + tone}>{icon && <Icon name={icon} size={18} />}<div>{children}</div></div>
)
export const AiTag = ({ text = 'Simulert AI' }: { text?: string }) => <span className="aitag"><Icon name="spark" size={13} />{text}</span>
export const Bar = ({ pct, tone }: { pct: number; tone?: string }) => <div className="pbar"><div className={tone} style={{ width: Math.max(0, Math.min(100, pct)) + '%' }} /></div>
export const Avatar = ({ name, size = 44 }: { name: string; size?: number }) => <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(name)}</div>

export function Stars({ value, n }: { value: number | null; n?: number }) {
  return <span className="stars"><Icon name="star" size={14} fill />{value == null ? 'Ingen vurderinger' : value.toLocaleString('nb-NO', { minimumFractionDigits: 1 })}{n != null && value != null && <small> ({n})</small>}</span>
}
export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return <div className="starinput" role="group" aria-label="Vurdering">{[1, 2, 3, 4, 5].map(i => <button key={i} aria-label={`${i} av 5`} aria-pressed={i <= value} onClick={() => onChange(i)}><Icon name="star" size={30} fill={i <= value} /></button>)}</div>
}

/** Rad i en liste: bilde, tittel, undertekst og noe til høyre. */
export function Row(p: Kids & { thumb?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; to?: string }) {
  const body = <>{p.thumb}<div className="row-main"><h3>{p.title}</h3>{p.sub && <p>{p.sub}</p>}{p.children}</div>{p.right && <div className="row-right">{p.right}</div>}</>
  const click = p.onClick ?? (p.to ? () => nav(p.to!) : undefined)
  return click ? <button className="row row-btn" onClick={click}>{body}</button> : <div className="row">{body}</div>
}

// ---------- Bilder og tegninger ----------
export function MachineArt({ type, shape, outline, className }: { type: ObjType; shape?: string; outline?: boolean; className?: string }) {
  const t = TYPE_SHAPE[type]
  const key = shape || t.shape
  const k = shape ? 1 : t.scale
  return (
    <svg viewBox="0 0 200 120" className={cx('art', outline && 'outline', className)} role="img" aria-label={`Tegning av ${type.toLowerCase()}`} preserveAspectRatio="xMidYMid meet">
      <g transform={`translate(${100 - 100 * k} ${112 - 112 * k}) scale(${k})`}>
        {(SHAPES[key] ?? []).map((p, i) => <path key={i} d={p.d} className={'art-' + p.role} />)}
      </g>
    </svg>
  )
}
export function Thumb({ src, type, alt = '', className, shape }: { src?: string; type: ObjType; alt?: string; className?: string; shape?: string }) {
  const url = img(src)
  return url
    ? <img src={url} alt={alt} className={cx('thumb', className)} loading="lazy" />
    : <div className={cx('thumb thumb-art', className)}><MachineArt type={type} shape={shape} /></div>
}
export const ObjThumb = ({ o, className }: { o: Pick<Obj, 'photos' | 'type' | 'name'>; className?: string }) => <Thumb src={o.photos[0]?.src} type={o.type} alt={o.name} className={className} />

// ---------- Kart ----------
export function MiniMap({ points, height = 300 }: { points: { place: string; label: string; tone?: string; onClick?: () => void }[]; height?: number }) {
  const pts = points.map(p => ({ ...p, c: coords(p.place) })).filter(p => p.c) as { place: string; label: string; tone?: string; onClick?: () => void; c: [number, number] }[]
  const unknown = points.length - pts.length
  const lats = pts.map(p => p.c[0]), lons = pts.map(p => p.c[1])
  const midLat = pts.length ? (Math.min(...lats) + Math.max(...lats)) / 2 : 66
  const kx = Math.cos((midLat * Math.PI) / 180)
  const spanLat = Math.max(1.2, pts.length ? Math.max(...lats) - Math.min(...lats) : 6) * 1.5
  const midLon = pts.length ? (Math.min(...lons) + Math.max(...lons)) / 2 : 14
  const W = 600, H = height, scale = Math.min(H / spanLat, W / (Math.max(2, pts.length ? Math.max(...lons) - Math.min(...lons) : 8) * 1.5 * kx))
  const proj = (lat: number, lon: number): [number, number] => [W / 2 + (lon - midLon) * kx * scale, H / 2 - (lat - midLat) * scale]
  const groups = new Map<string, typeof pts>()
  for (const p of pts) groups.set(p.place, [...(groups.get(p.place) ?? []), p])
  return (
    <div className="map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Forenklet kart over hvor objektene står">
        <rect width={W} height={H} className="map-sea" />
        <polygon points={NORWAY.map(([lon, lat]) => proj(lat, lon).join(',')).join(' ')} className="map-land" />
        {[...groups.entries()].map(([place, g]) => {
          const [x, y] = proj(g[0].c[0], g[0].c[1])
          return (
            <g key={place} className="map-pin" onClick={g[0].onClick} style={{ cursor: g[0].onClick ? 'pointer' : undefined }}>
              <circle cx={x} cy={y} r={g.length > 1 ? 15 : 11} className={g.some(p => p.tone === 'bad') ? 'bad' : g.some(p => p.tone === 'amber') ? 'amber' : ''} />
              <text x={x} y={y + 4.5} textAnchor="middle" className="map-n">{g.length}</text>
              <text x={x + 20} y={y + 5} className="map-l">{place}</text>
            </g>
          )
        })}
      </svg>
      <p className="hint">Forenklet kart uten veier. {unknown > 0 && `${unknown} objekt står på et sted kartet ikke kjenner.`}</p>
    </div>
  )
}

// ---------- Ark, bekreftelse og beskjeder ----------
export function Sheet({ title, onClose, children, footer }: Kids & { title: string; onClose: () => void; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="sheet-back" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-h"><h2>{title}</h2><button className="iconbtn" aria-label="Lukk" onClick={onClose}><Icon name="close" size={18} /></button></div>
        <div className="sheet-b">{children}</div>
        {footer && <div className="sheet-f">{footer}</div>}
      </div>
    </div>
  )
}

interface Ui { toasts: { id: number; text: string; tone?: string }[]; ask: null | { text: string; yes: string; danger?: boolean; done: (v: boolean) => void } }
let ui: Ui = { toasts: [], ask: null }
const uiL = new Set<() => void>()
const setUi = (u: Partial<Ui>) => { ui = { ...ui, ...u }; uiL.forEach(l => l()) }
let tid = 0
export function toast(text: string, tone?: 'ok' | 'bad') {
  const id = ++tid
  setUi({ toasts: [...ui.toasts, { id, text, tone }].slice(-2) })
  setTimeout(() => setUi({ toasts: ui.toasts.filter(t => t.id !== id) }), 3600)
}
/** Erstatter nettleserens confirm(), som ikke virker overalt. */
export const ask = (text: string, yes = 'Bekreft', danger = false) => new Promise<boolean>(done => setUi({ ask: { text, yes, danger, done } }))

export function Dialogs() {
  const u = useSyncExternalStore(l => { uiL.add(l); return () => { uiL.delete(l) } }, () => ui)
  const close = (v: boolean) => { u.ask?.done(v); setUi({ ask: null }) }
  return (
    <>
      {u.ask && (
        <Sheet title="Bekreft" onClose={() => close(false)} footer={<><Btn kind="ghost" onClick={() => close(false)}>Avbryt</Btn><Btn kind={u.ask.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{u.ask.yes}</Btn></>}>
          <p className="lead">{u.ask.text}</p>
        </Sheet>
      )}
      <div className="toasts" aria-live="polite">{u.toasts.map(t => <div key={t.id} className={'toast ' + (t.tone ?? '')}>{t.text}</div>)}</div>
    </>
  )
}

/** Demohjelp: bytt til motparten for å se den andre siden av en flyt. */
export function DemoSwitch({ userId, to, children }: Kids & { userId: string; to: string }) {
  const s = store.get()
  const u = s.users.find(x => x.id === userId)
  if (!u || s.session?.userId === userId) return null
  const c = s.companies.find(x => x.id === u.memberships[0].companyId)
  return (
    <button className="demoswitch" onClick={() => { login(userId); nav(to, true); toast(`Du ser nå appen som ${u.name}, ${c?.name}`) }}>
      <Icon name="swap" size={16} /><span><b>Demo:</b> {children ?? `se dette som ${u.name} hos ${c?.name}`}</span><Icon name="right" size={16} />
    </button>
  )
}

export function useLocal<T>(initial: T) { return useState<T>(initial) }
export { cx }
