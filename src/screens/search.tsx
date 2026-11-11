import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { View } from '../types'
import { Icon } from '../ui/icons'
import { ObjThumb } from '../ui/kit'
import { nav, navRoot } from '../router'
import { coName, ob, parkOf, useMe, useS, viewsFor } from '../store'
import { setView } from '../actions'
import { RENTAL_LABEL, VIEW_LABEL } from '../lib/util'
import { isDark, setTheme } from '../lib/theme'
import { objSub, priceText } from './common'
import { hits } from './market'

interface Item { id: string; group: string; title: string; sub?: string; icon?: string; thumb?: ReactNode; words: string; run: () => void }

/** Sidene i menyen, per visning. Brukes av søket slik at alt kan nås med tastaturet. */
const PAGES: { view?: View; path: string; title: string; icon: string }[] = [
  { view: 'park', path: '/park', title: 'Parken', icon: 'grid' }, { view: 'park', path: '/verksted', title: 'Verksted', icon: 'wrench' }, { view: 'park', path: '/rapporter', title: 'Rapporter', icon: 'chart' },
  { view: 'utleier', path: '/annonser', title: 'Annonser', icon: 'tag' }, { view: 'utleier', path: '/foresporsler', title: 'Forespørsler', icon: 'chat' },
  { view: 'utleier', path: '/leieforhold', title: 'Leieforhold', icon: 'handshake' }, { view: 'utleier', path: '/inntekter', title: 'Inntekter', icon: 'money' },
  { view: 'leietaker', path: '/sveip', title: 'Markedet', icon: 'heart' }, { view: 'leietaker', path: '/favoritter', title: 'Favoritter', icon: 'star' },
  { view: 'leietaker', path: '/onsker', title: 'Ønsker', icon: 'filter' }, { view: 'leietaker', path: '/mine', title: 'Mine forespørsler og leieforhold', icon: 'list' },
  { view: 'frakt', path: '/frakt/send', title: 'Send noe', icon: 'box' }, { view: 'frakt', path: '/frakt/oppdrag', title: 'Fraktoppdrag', icon: 'truck' },
  { view: 'frakt', path: '/frakt/tur', title: 'Ledig på tur', icon: 'route' }, { view: 'frakt', path: '/frakt/mine', title: 'Mine fraktoppdrag', icon: 'list' },
  { view: 'forer', path: '/forer', title: 'Mine maskiner', icon: 'home' }, { view: 'forer', path: '/skann', title: 'Skann QR', icon: 'qr' },
  { view: 'partner', path: '/partner', title: 'Forespørsler fra kunder', icon: 'chat' },
  { path: '/topp100', title: 'Topp 100', icon: 'trophy' }, { path: '/blinkskudd', title: 'Blinkskudd', icon: 'camera' }, { path: '/varsler', title: 'Varsler', icon: 'bell' },
  { path: '/meldinger', title: 'Meldinger', icon: 'chat' }, { path: '/bedrift', title: 'Bedrift og brukere', icon: 'building' }, { path: '/demo', title: 'Demo-innstillinger', icon: 'spark' },
  { path: '/om', title: 'Om denne versjonen', icon: 'info' },
]

/** Søk og hurtigkommandoer. Åpnes med Ctrl K eller ⌘K, eller fra søkeknappen. */
export function Palette({ onClose }: { onClose: () => void }) {
  const s = useS(), me = useMe()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const views = viewsFor(me.roles)

  const all = useMemo<Item[]>(() => {
    const out: Item[] = []
    const go = (to: string, v?: View) => () => { if (v && v !== me.view) setView(v); nav(to) }
    for (const p of PAGES) {
      if (p.view && !views.includes(p.view)) continue
      if (p.path === '/rapporter' && !me.roles.some(r => r === 'admin' || r === 'leder')) continue
      out.push({ id: 'p' + p.path, group: 'Gå til', title: p.title, sub: p.view ? VIEW_LABEL[p.view] : undefined, icon: p.icon, words: p.title + ' ' + (p.view ? VIEW_LABEL[p.view] : ''), run: () => { if (p.view && p.view !== me.view) setView(p.view); navRoot(p.path) } })
    }
    const canPark = views.includes('park')
    if (canPark || views.includes('forer')) for (const o of parkOf(s, me.company.id)) {
      out.push({ id: 'o' + o.id, group: 'Objekter', title: o.name, sub: objSub(o), thumb: <ObjThumb o={o} />, words: [o.name, o.internalId, o.type, o.make, o.model, o.place, o.department, o.regnr, o.serial].filter(Boolean).join(' '), run: go(canPark ? `/objekt/${o.id}` : `/q/${o.id}`, canPark ? 'park' : 'forer') })
    }
    if (views.includes('leietaker')) for (const h of hits(s, me)) {
      out.push({ id: 'l' + h.l.id, group: 'I markedet', title: h.o.name, sub: `${h.l.mode === 'leie' ? 'Til leie' : 'Til salgs'} · ${priceText(h.l)} · ${h.o.place}`, thumb: <ObjThumb o={h.o} />, words: [h.o.name, h.o.type, h.o.make, h.o.model, h.o.place, h.l.mode === 'leie' ? 'leie' : 'salg kjøp'].filter(Boolean).join(' '), run: go(`/maskin/${h.l.id}`, 'leietaker') })
    }
    for (const r of s.rentals) {
      if (r.lessorId !== me.company.id && r.lesseeId !== me.company.id) continue
      if (!views.includes('utleier') && !views.includes('leietaker')) continue
      const o = ob(s, r.objId), other = coName(s, r.lessorId === me.company.id ? r.lesseeId : r.lessorId)
      out.push({ id: 'r' + r.id, group: 'Leieforhold', title: `#${r.no} ${o?.name ?? ''}`, sub: `${other} · ${RENTAL_LABEL[r.status]}`, icon: 'handshake', words: `${r.no} ${o?.name ?? ''} ${other} leie`, run: go(`/leie/${r.id}`) })
    }
    if (views.includes('frakt')) for (const j of s.jobs) {
      const mine = j.ownerId === me.company.id || j.bids.some(b => b.companyId === me.company.id)
      if (!mine) continue
      out.push({ id: 'j' + j.id, group: 'Fraktoppdrag', title: `#${j.no} ${j.title}`, sub: `${j.fromPlace} til ${j.toPlace}`, icon: 'truck', words: `${j.no} ${j.title} ${j.fromPlace} ${j.toPlace} frakt`, run: go(`/frakt/jobb/${j.id}`, 'frakt') })
    }
    const act = (id: string, title: string, icon: string, words: string, run: () => void) => out.push({ id, group: 'Handlinger', title, icon, words: title + ' ' + words, run })
    if (canPark && me.roles.some(r => r === 'admin' || r === 'leder' || r === 'verksmester')) act('a-ny', 'Registrer nytt objekt', 'plus', 'legg til maskin ny', go('/objekt/ny', 'park'))
    if (views.includes('frakt')) act('a-frakt', 'Bestill frakt', 'truck', 'send transport', go('/frakt/send', 'frakt'))
    act('a-tema', isDark() ? 'Bytt til lys modus' : 'Bytt til mørk modus', isDark() ? 'sun' : 'moon', 'tema utseende dark light mørk lys', () => setTheme(isDark() ? 'light' : 'dark'))
    act('a-bruker', 'Bytt demobruker', 'swap', 'logg inn bruker konto', () => nav('/login'))
    return out
  }, [s, me.user.id, me.company.id, me.view]) // eslint-disable-line

  const shown = useMemo(() => {
    const t = q.toLowerCase().split(/\s+/).filter(Boolean)
    const hit = all.filter(i => { const w = i.words.toLowerCase(); return t.every(x => w.includes(x)) })
    // Uten søkeord vises bare sider og handlinger. Med søkeord vises inntil seks treff per gruppe.
    const groups = new Map<string, Item[]>()
    for (const i of hit) {
      if (!t.length && i.group !== 'Gå til' && i.group !== 'Handlinger') continue
      const g = groups.get(i.group) ?? []
      if (g.length < (t.length ? 6 : 30)) g.push(i)
      groups.set(i.group, g)
    }
    const order = t.length ? ['Objekter', 'I markedet', 'Leieforhold', 'Fraktoppdrag', 'Gå til', 'Handlinger'] : ['Gå til', 'Handlinger']
    return order.flatMap(g => groups.get(g) ?? [])
  }, [all, q])

  useEffect(() => { setSel(0) }, [q])
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [sel])
  useEffect(() => {
    document.documentElement.classList.add('locked')
    return () => { if (!document.querySelector('.sheet-back')) document.documentElement.classList.remove('locked') }
  }, [])

  const run = (i?: Item) => { if (!i) return; onClose(); i.run() }
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(x => Math.min(shown.length - 1, x + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(x => Math.max(0, x - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(shown[sel]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }
  let last = ''
  return (
    <div className="pal-back" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pal" role="dialog" aria-modal="true" aria-label="Søk" onKeyDown={key}>
        <div className="pal-top">
          <Icon name="search" size={20} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Søk etter maskin, side eller handling" aria-label="Søk" role="combobox" aria-expanded="true" aria-controls="pal-list" autoComplete="off" spellCheck={false} enterKeyHint="go" />
          <button className="iconbtn plain" aria-label="Lukk søk" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="pal-list" id="pal-list" role="listbox" ref={list}>
          {!shown.length && <p className="hint" style={{ padding: '28px 12px', textAlign: 'center' }}>Ingen treff på «{q}».</p>}
          {shown.map((i, k) => {
            const cap = i.group !== last ? (last = i.group, <p className="pal-cap" key={'c' + i.group}>{i.group}</p>) : null
            return (
              <div key={i.id}>
                {cap}
                <button className="pal-item" role="option" aria-selected={k === sel} onMouseMove={() => { if (k !== sel) setSel(k) }} onClick={() => run(i)}>
                  <span className="pal-ic">{i.thumb ?? <Icon name={i.icon ?? 'right'} size={17} />}</span>
                  <span><b>{i.title}</b>{i.sub && <small>{i.sub}</small>}</span>
                  <span className="pal-go"><Icon name="enter" size={16} /></span>
                </button>
              </div>
            )
          })}
        </div>
        <div className="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> velg</span><span><kbd>↵</kbd> åpne</span><span><kbd>esc</kbd> lukk</span></div>
      </div>
    </div>
  )
}
