import { cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactElement, type ReactNode } from 'react'
import { Icon } from './icons'
import { back, link, nav } from '../router'
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

// Merket over tittelen viser hvilken del av appen siden hører til. Delene skrives som ordmerke med sin egen farge.
const MARKS: Record<string, 'amber' | 'blue' | 'green'> = { PlanM8: 'amber', FleetM8: 'green', SaleM8: 'amber', LogM8: 'blue' }
const upFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
/** Skilletegnet «·» holdes sammen med ordet foran, slik at en ny linje aldri begynner med en prikk. */
const tie = (x: ReactNode) => (typeof x === 'string' ? x.replaceAll(' · ', '\u00A0· ') : x)
export function Eyebrow({ text }: { text: string }) {
  const [head, ...rest] = text.split(' · ')
  const tail = rest.join(' · ')
  const mark = MARKS[head]
    ? <Wordmark a={head.slice(0, -2)} tone={MARKS[head]} size={17} />
    : head === 'Topp 100' ? <span className="wordmark tmark">Topp <span className="wm-amber">100</span></span> : null
  if (!mark) return <p className="eyebrow">{tie(text)}</p>
  return <p className="eyebrow brand">{mark}{tail && <span>{upFirst(tail)}</span>}</p>
}

/**
 * Rammen rundt en skjerm. Toppfeltet står fast øverst. Den store tittelen ruller bort,
 * og da får toppfeltet glassbakgrunn og en liten tittel. Med `flush` ligger toppfeltet over et toppbilde.
 */
export function Page(p: Kids & { title?: ReactNode; eyebrow?: string; sub?: ReactNode; back?: boolean | string; right?: ReactNode; tone?: 'light' | 'dark' | 'night'; wide?: boolean; footer?: ReactNode; brand?: ReactNode; flush?: boolean; short?: string }) {
  const root = useRef<HTMLDivElement>(null), head = useRef<HTMLElement>(null), body = useRef<HTMLDivElement>(null), right = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  const over = !!p.flush
  const short = p.short ?? (typeof p.title === 'string' ? p.title : p.eyebrow)
  useEffect(() => {
    const el = over ? body.current?.firstElementChild : head.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { rootMargin: '-58px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [over])
  // Den store tittelen på hovedsidene deler linje med knappene til høyre, og må vite hvor brede de er.
  useLayoutEffect(() => { root.current?.style.setProperty('--right-w', (right.current?.offsetWidth ?? 0) + 'px') })
  // Fanen i nettleseren får sidens navn, slik at historikk, bokmerker og skjermlesere vet hvor man er.
  useEffect(() => { try { document.title = short ? `${short} – PlanM8` : 'PlanM8' } catch { /* ingen side */ } }, [short])
  return (
    <div ref={root} className={cx('screen', p.tone && p.tone !== 'light' && 'dark', p.tone === 'night' && 'night')}>
      <div className={cx('pnav', stuck && 'stuck', over && 'over')}>
        <div className={cx('pnav-in', p.wide && 'wide')}>
          {p.back && <button className="navbtn" aria-label="Tilbake" onClick={() => back(typeof p.back === 'string' ? p.back : '/')}><Icon name="back" sw={2.2} size={22} /></button>}
          <div className="pnav-title" aria-hidden="true">{short}</div>
          <div className="pnav-right" ref={right}>{p.right}</div>
        </div>
      </div>
      {!over && (
        <header ref={head} className={cx('phead', !p.back && 'root')}>
          <div className={cx('phead-in', p.wide && 'wide')}>
            <div className="phead-t">
              {p.eyebrow && <Eyebrow text={p.eyebrow} />}
              {p.brand ?? <h1>{p.title}</h1>}
            </div>
            {p.sub && <p className="top-sub">{p.sub}</p>}
          </div>
        </header>
      )}
      <div ref={body} className={cx('page', p.wide && 'wide', p.flush && 'flush')}>{p.children}</div>
      {p.footer && <footer className="bar"><div className={cx('bar-in', p.wide && 'wide')}>{p.footer}</div></footer>}
    </div>
  )
}

// ---------- Byggeklosser ----------
export const Card = ({ children, className, onClick, style }: Kids & { className?: string; onClick?: () => void; style?: CSSProperties }) =>
  onClick ? <button className={cx('card card-btn', className)} onClick={onClick} style={style}>{children}</button> : <div className={cx('card', className)} style={style}>{children}</div>

export function Btn(p: Kids & { kind?: 'primary' | 'amber' | 'blue' | 'ghost' | 'danger' | 'quiet'; onClick?: () => void; block?: boolean; small?: boolean; disabled?: boolean; icon?: string; to?: string; label?: string }) {
  const cls = cx('btn', p.kind ?? 'primary', p.block && 'block', p.small && 'small')
  const body = <>{p.icon && <Icon name={p.icon} size={p.small ? 16 : 18} />}{p.children}</>
  // En knapp som bare går til en annen side, er en lenke. Da virker også «åpne i ny fane».
  if (p.to && !p.disabled) {
    const l = link(p.to)
    return <a className={cls} aria-label={p.label} href={l.href} onClick={(e: RMouseEvent) => { l.onClick(e); if (e.defaultPrevented) p.onClick?.() }}>{body}</a>
  }
  return <button type="button" className={cls} disabled={p.disabled} aria-label={p.label} onClick={() => p.onClick?.()}>{body}</button>
}

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'amber' | 'plain' | 'mute' | 'ink' | 'blue'
export const Pill = ({ tone = 'plain', children }: Kids & { tone?: Tone | string }) => <span className={'pill ' + tone}>{children}</span>

export function Seg<T extends string>({ value, onChange, options, tone, labelledBy }: { value: T; onChange: (v: T) => void; options: (T | [T, string])[]; tone?: 'amber' | 'blue'; labelledBy?: string }) {
  return (
    <div className={cx('seg', tone)} role="group" aria-labelledby={labelledBy}>
      {options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <button key={v} aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button> })}
    </div>
  )
}

export function Chips<T extends string>({ value, onChange, options, single, labelledBy }: { value: T[]; onChange: (v: T[]) => void; options: (T | [T, string])[]; single?: boolean; labelledBy?: string }) {
  return (
    <div className="chips" role="group" aria-labelledby={labelledBy}>
      {options.map(o => {
        const [v, l] = Array.isArray(o) ? o : [o, o]
        const on = value.includes(v)
        return <button key={v} className="chip" aria-pressed={on} onClick={() => onChange(single ? [v] : on ? value.filter(x => x !== v) : [...value, v])}>{l}</button>
      })}
    </div>
  )
}

/**
 * Ledetekst over et felt. Rundt ett inntastingsfelt er dette en vanlig <label>.
 * Rundt en gruppe med knapper navngir den gruppen i stedet, slik at et trykk på ledeteksten ikke velger den første knappen.
 */
export function Field({ label, hint, children, row }: Kids & { label: string; hint?: ReactNode; row?: boolean }) {
  const id = useId()
  const cls = cx('field', row && 'inline')
  const group = isValidElement(children) && (children.type === Seg || children.type === Chips || children.type === StarInput)
  if (group) return <div className={cls}><span className="field-l" id={id}>{label}{hint && <small>{hint}</small>}</span>{cloneElement(children as ReactElement<{ labelledBy?: string }>, { labelledBy: id })}</div>
  return <label className={cls}><span className="field-l">{label}{hint && <small>{hint}</small>}</span>{children}</label>
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
export const Empty = ({ title, text, children, icon = 'box' }: Kids & { title: string; text?: string; icon?: string }) => (
  <div className="empty"><div className="empty-ic"><Icon name={icon} size={26} /></div><h2>{title}</h2>{text && <p>{text}</p>}{children}</div>
)
export const Notice = ({ tone = 'info', children, icon }: Kids & { tone?: 'info' | 'ok' | 'warn' | 'bad' | 'plain'; icon?: string }) => (
  <div className={'notice ' + tone}>{icon && <Icon name={icon} size={18} />}<div>{children}</div></div>
)
export const AiTag = ({ text = 'Simulert AI' }: { text?: string }) => <span className="aitag"><Icon name="spark" size={13} />{text}</span>
export const Bar = ({ pct, tone }: { pct: number; tone?: string }) => <div className="pbar"><div className={tone} style={{ width: Math.max(0, Math.min(100, pct)) + '%' }} /></div>
/** Initialer på en farget flate. Fargen følger navnet, slik at samme bedrift alltid ser lik ut. */
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return <div className={'avatar c' + (h % 5)} style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(name)}</div>
}

export function Stars({ value, n }: { value: number | null; n?: number }) {
  return <span className="stars"><Icon name="star" size={14} fill />{value == null ? 'Ingen vurderinger' : value.toLocaleString('nb-NO', { minimumFractionDigits: 1 })}{n != null && value != null && <small> ({n})</small>}</span>
}
export function StarInput({ value, onChange, labelledBy }: { value: number; onChange: (n: number) => void; labelledBy?: string }) {
  return <div className="starinput" role="group" aria-label={labelledBy ? undefined : 'Vurdering'} aria-labelledby={labelledBy}>{[1, 2, 3, 4, 5].map(i => <button key={i} aria-label={`${i} av 5`} aria-pressed={i <= value} onClick={() => onChange(i)}><Icon name="star" size={30} fill={i <= value} /></button>)}</div>
}

/**
 * Rad i en liste: bilde, tittel, undertekst og noe til høyre.
 * En rad som kan åpnes, har tittelen som lenke eller knapp, og trykkflaten dekker hele raden.
 * Slik kan raden også inneholde egne knapper til høyre uten at knapper ligger inni hverandre.
 */
export function Row(p: Kids & { thumb?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; to?: string }) {
  const title = p.onClick ? <button type="button" className="row-hit" onClick={p.onClick}>{p.title}</button>
    : p.to ? <a className="row-hit" {...link(p.to)}>{p.title}</a> : p.title
  return (
    <div className={cx('row', (p.onClick || p.to) && 'row-btn')}>
      {p.thumb}<div className="row-main"><h3>{title}</h3>{p.sub && <p>{tie(p.sub)}</p>}{p.children}</div>{p.right && <div className="row-right">{p.right}</div>}
    </div>
  )
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
  // Kartet tegnes i skjermens egne punkter, slik at tekst og merker har samme størrelse på mobil og PC.
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => { const w = Math.round(el.clientWidth); if (w > 0) setW(Math.max(280, w)) }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(fit); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = height, scale = Math.min(H / spanLat, W / (Math.max(2, pts.length ? Math.max(...lons) - Math.min(...lons) : 8) * 1.5 * kx))
  const proj = (lat: number, lon: number): [number, number] => [W / 2 + (lon - midLon) * kx * scale, H / 2 - (lat - midLat) * scale]
  const groups = new Map<string, typeof pts>()
  for (const p of pts) groups.set(p.place, [...(groups.get(p.place) ?? []), p])
  return (
    <div className="map" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Forenklet kart over hvor objektene står">
        <rect width={W} height={H} className="map-sea" />
        <polygon points={NORWAY.map(([lon, lat]) => proj(lat, lon).join(',')).join(' ')} className="map-land" />
        {[...groups.entries()].map(([place, g]) => {
          const [x, y] = proj(g[0].c[0], g[0].c[1])
          return (
            <g key={place} className="map-pin" onClick={g[0].onClick} style={{ cursor: g[0].onClick ? 'pointer' : undefined }}
              {...(g[0].onClick ? { role: 'button', tabIndex: 0, 'aria-label': `${place}: ${g.length} objekt`, onKeyDown: (e: { key: string; preventDefault(): void }) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); g[0].onClick!() } } } : {})}>
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
const openSheets: symbol[] = []
function lockScroll(on: boolean) { try { document.documentElement.classList.toggle('locked', on) } catch { /* ingen side */ } }

/**
 * Ark som kommer opp fra bunnen på mobil og vises som dialog på PC.
 * Kan lukkes med kryss, Escape, trykk utenfor eller ved å dra det ned.
 */
export function Sheet({ title, onClose, children, footer }: Kids & { title: string; onClose: () => void; footer?: ReactNode }) {
  const [closing, setClosing] = useState(false)
  const [dy, setDy] = useState(0)
  const el = useRef<HTMLDivElement>(null)
  const latest = useRef(onClose); latest.current = onClose
  const timer = useRef<number | undefined>(undefined)
  const drag = useRef<{ y: number; t: number } | null>(null)
  const close = useCallback(() => {
    if (timer.current != null) return
    setClosing(true)
    timer.current = window.setTimeout(() => latest.current(), 200)
  }, [])
  useEffect(() => {
    const id = Symbol('ark')
    const before = document.activeElement as HTMLElement | null
    openSheets.push(id); lockScroll(true)
    if (el.current && !el.current.contains(document.activeElement)) el.current.focus({ preventScroll: true })
    const k = (e: KeyboardEvent) => {
      if (openSheets[openSheets.length - 1] !== id) return
      if (e.key === 'Escape') close()
      if (e.key === 'Tab' && el.current) {
        // Hold tastaturfokus inne i arket.
        const f = [...el.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => !x.hasAttribute('disabled') && x.offsetParent !== null)
        if (!f.length) return
        const first = f[0], last = f[f.length - 1], cur = document.activeElement
        if (e.shiftKey && (cur === first || cur === el.current)) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', k)
    return () => {
      window.removeEventListener('keydown', k)
      window.clearTimeout(timer.current)
      const i = openSheets.indexOf(id); if (i >= 0) openSheets.splice(i, 1)
      lockScroll(openSheets.length > 0)
      try { before?.focus({ preventScroll: true }) } catch { /* elementet finnes ikke lenger */ }
    }
  }, [close])
  const down = (e: RPointerEvent) => {
    if (window.innerWidth >= 700 || (e.target as HTMLElement).closest('button')) return
    drag.current = { y: e.clientY, t: Date.now() }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ikke støttet */ }
  }
  const move = (e: RPointerEvent) => { if (drag.current) setDy(Math.max(0, e.clientY - drag.current.y)) }
  const up = (e: RPointerEvent) => {
    const d = drag.current; if (!d) return
    drag.current = null
    const dist = Math.max(0, e.clientY - d.y), speed = dist / Math.max(1, Date.now() - d.t)
    if (dist > 120 || (dist > 36 && speed > 0.6)) close(); else setDy(0)
  }
  const grip = { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up }
  return (
    <div className={cx('sheet-back', closing && 'closing')} onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div ref={el} className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        style={dy ? { transform: `translateY(${dy}px)`, transition: drag.current ? 'none' : undefined } : { transition: 'transform .3s var(--spring)' }}>
        <div className="sheet-grab" {...grip} aria-hidden="true" />
        <div className="sheet-h" {...grip}><h2>{title}</h2><button className="iconbtn" aria-label="Lukk" onClick={close}><Icon name="close" size={16} sw={2.4} /></button></div>
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
      <div className="toasts" aria-live="polite">
        {u.toasts.map(t => <div key={t.id} className={cx('toast', t.tone, t.text.length > 46 && 'long')}><Icon name={t.tone === 'ok' ? 'check' : t.tone === 'bad' ? 'warn' : 'info'} size={18} sw={2.3} />{t.text}</div>)}
      </div>
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
