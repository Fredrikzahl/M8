import { Component, useEffect, useState, type ReactNode } from 'react'
import type { View } from './types'
import { meOf, useS, viewsFor, type Me } from './store'
import { match, nav, navRoot, useRoute } from './router'
import { myNotes, setView } from './actions'
import { PLACE_NAMES, VIEW_LABEL, VIEW_SUB } from './lib/util'
import { Avatar, Btn, Dialogs, Empty, Field, Page, Pill, Row, Seg, Sheet, Wordmark } from './ui/kit'
import { Icon } from './ui/icons'
import { Missing, shell } from './screens/common'
import { Palette } from './screens/search'
import { setTheme, THEME_LABEL, useTheme, type ThemeMode } from './lib/theme'
import { Bedrift, Demo, Login, Meldinger, Mer, Om, Varsler } from './screens/account'
import { Forer, ImportObjects, ObjectCard, Park, QrPrint, QuickReport, RegisterObject, Skann, Vask } from './screens/fleet'
import { Rapporter, Verksted } from './screens/workshop'
import { Annonse, Annonser, Foresporsel, Foresporsler, Inntekter } from './screens/lessor'
import { Favoritter, Maskin, MatchThread, Mine, Onsker, Onskes, Sveip } from './screens/market'
import { Kontroll, Leie, Leieforhold, Skjema, Timer } from './screens/rental'
import { FraktJobb, FraktMine, FraktOppdrag, FraktSend, FraktTur } from './screens/freight'
import { BlinkGodkjenn, Blinkskudd, RatingMode, Topp100, Vinnere } from './screens/top'
import { Leads, PartnerInbox, Presentation, SendMaskin } from './screens/share'

type P = Record<string, string>
const ROUTES: [string, (p: P) => ReactNode][] = [
  ['/park', () => <Park />], ['/objekt/ny', () => <RegisterObject />], ['/objekt/:id', p => <ObjectCard id={p.id} />],
  ['/import', () => <ImportObjects />], ['/vask', () => <Vask />], ['/qr/:id', p => <QrPrint id={p.id} />],
  ['/q/:id', p => <QuickReport id={p.id} />], ['/skann', () => <Skann />], ['/forer', () => <Forer />],
  ['/verksted', () => <Verksted />], ['/rapporter', () => <Rapporter />],
  ['/annonser', () => <Annonser />], ['/annonse/:id', p => <Annonse id={p.id} />],
  ['/foresporsler', () => <Foresporsler />], ['/foresporsel/:id', p => <Foresporsel id={p.id} />],
  ['/leieforhold', () => <Leieforhold />], ['/inntekter', () => <Inntekter />],
  ['/leie/:id', p => <Leie id={p.id} />], ['/leie/:id/utlevering', p => <Skjema id={p.id} kind="utlevering" />], ['/leie/:id/retur', p => <Skjema id={p.id} kind="retur" />],
  ['/leie/:id/kontroll', p => <Kontroll id={p.id} />], ['/leie/:id/timer', p => <Timer id={p.id} />],
  ['/sveip', () => <Sveip />], ['/maskin/:id', p => <Maskin id={p.id} />], ['/favoritter', () => <Favoritter />], ['/onsker', () => <Onsker />],
  ['/mine', () => <Mine />], ['/match/:id', p => <MatchThread id={p.id} />], ['/onskes', () => <Onskes />],
  ['/frakt/send', () => <FraktSend />], ['/frakt/oppdrag', () => <FraktOppdrag />], ['/frakt/tur', () => <FraktTur />], ['/frakt/mine', () => <FraktMine />], ['/frakt/jobb/:id', p => <FraktJobb id={p.id} />],
  ['/topp100', () => <Topp100 />], ['/rating', () => <RatingMode />], ['/vinnere', () => <Vinnere />], ['/blinkskudd', () => <Blinkskudd />], ['/blinkskudd/godkjenn', () => <BlinkGodkjenn />],
  ['/send/:id', p => <SendMaskin id={p.id} />], ['/leads', () => <Leads />], ['/partner', () => <PartnerInbox />],
  ['/meldinger', () => <Meldinger />], ['/varsler', () => <Varsler />], ['/bedrift', () => <Bedrift />], ['/mer', () => <Mer />], ['/demo', () => <Demo />], ['/om', () => <Om />],
]

interface Tab { path: string; label: string; icon: string; also?: string[] }
const TABS: Record<View, Tab[]> = {
  park: [
    { path: '/park', label: 'Parken', icon: 'grid', also: ['/objekt', '/import', '/vask', '/qr'] }, { path: '/verksted', label: 'Verksted', icon: 'wrench' },
    { path: '/rapporter', label: 'Rapporter', icon: 'chart' }, { path: '/topp100', label: 'Topp 100', icon: 'trophy', also: ['/rating', '/vinnere', '/blinkskudd'] }, { path: '/mer', label: 'Mer', icon: 'more' },
  ],
  utleier: [
    { path: '/annonser', label: 'Annonser', icon: 'tag', also: ['/annonse'] }, { path: '/foresporsler', label: 'Forespørsler', icon: 'chat', also: ['/foresporsel'] },
    { path: '/leieforhold', label: 'Leieforhold', icon: 'handshake', also: ['/leie'] }, { path: '/inntekter', label: 'Inntekter', icon: 'money' }, { path: '/mer', label: 'Mer', icon: 'more' },
  ],
  leietaker: [
    { path: '/sveip', label: 'Sveip', icon: 'heart', also: ['/maskin'] }, { path: '/favoritter', label: 'Favoritter', icon: 'star' }, { path: '/onsker', label: 'Ønsker', icon: 'filter' },
    { path: '/mine', label: 'Mine', icon: 'list', also: ['/leie', '/match'] }, { path: '/mer', label: 'Mer', icon: 'more' },
  ],
  frakt: [
    { path: '/frakt/send', label: 'Send', icon: 'box' }, { path: '/frakt/oppdrag', label: 'Oppdrag', icon: 'truck' }, { path: '/frakt/tur', label: 'Ledig tur', icon: 'route' },
    { path: '/frakt/mine', label: 'Mine', icon: 'list', also: ['/frakt/jobb'] }, { path: '/mer', label: 'Mer', icon: 'more' },
  ],
  forer: [
    { path: '/forer', label: 'Mine', icon: 'home' }, { path: '/skann', label: 'Skann', icon: 'qr', also: ['/q'] }, { path: '/blinkskudd', label: 'Blinkskudd', icon: 'camera' },
    { path: '/topp100', label: 'Topp 100', icon: 'trophy', also: ['/rating', '/vinnere'] }, { path: '/mer', label: 'Mer', icon: 'more' },
  ],
  partner: [{ path: '/partner', label: 'Forespørsler', icon: 'chat' }, { path: '/topp100', label: 'Topp 100', icon: 'trophy', also: ['/rating', '/vinnere'] }, { path: '/mer', label: 'Mer', icon: 'more' }],
}
// Verksmester har ikke tilgang til ledelsesrapportene.
const tabsFor = (me: Me) => TABS[me.view].filter(t => t.path !== '/rapporter' || me.roles.some(r => r === 'admin' || r === 'leder'))

export const homeOf = (me: Pick<Me, 'view' | 'roles'>, view: View = me.view) =>
  ({ park: '/park', utleier: '/annonser', leietaker: '/sveip', frakt: me.roles.includes('sjafor') ? '/frakt/oppdrag' : '/frakt/send', forer: '/forer', partner: '/partner' }[view])

const ROUTE_VIEW: [string, View][] = [
  ['/park', 'park'], ['/objekt', 'park'], ['/import', 'park'], ['/vask', 'park'], ['/qr', 'park'], ['/verksted', 'park'], ['/rapporter', 'park'],
  ['/annonser', 'utleier'], ['/annonse', 'utleier'], ['/foresporsler', 'utleier'], ['/foresporsel', 'utleier'], ['/leieforhold', 'utleier'], ['/inntekter', 'utleier'],
  ['/sveip', 'leietaker'], ['/maskin', 'leietaker'], ['/favoritter', 'leietaker'], ['/onsker', 'leietaker'], ['/mine', 'leietaker'],
  ['/frakt', 'frakt'], ['/forer', 'forer'], ['/partner', 'partner'],
]
const routeView = (full: string) => { const path = full.split('?')[0]; return ROUTE_VIEW.find(([p]) => path === p || path.startsWith(p + '/'))?.[1] }

class Guard extends Component<{ children: ReactNode; k: string }, { err: boolean; k: string }> {
  state = { err: false, k: this.props.k }
  static getDerivedStateFromError() { return { err: true } }
  static getDerivedStateFromProps(p: { k: string }, s: { err: boolean; k: string }) { return p.k !== s.k ? { err: false, k: p.k } : null }
  render() {
    if (!this.state.err) return this.props.children
    return <Page title="Noe gikk galt"><Empty icon="warn" title="Siden kunne ikke vises" text="Gå tilbake og prøv igjen. Hvis det gjentar seg, kan du nullstille demodataene under Mer."><Btn to="/">Til forsiden</Btn></Empty></Page>
  }
}

export function App() {
  const s = useS(), path = useRoute(), me = meOf(s)
  const [viewsOpen, setViewsOpen] = useState(false)
  const [search, setSearch] = useState(false)
  const theme = useTheme()
  useEffect(() => {
    shell.setOpener(() => setViewsOpen(true)); shell.setSearch(() => setSearch(true))
    // Ctrl K eller ⌘K åpner søket fra hvor som helst. Skråstrek gjør det samme når man ikke skriver i et felt.
    const k = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '')
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey)) { e.preventDefault(); setSearch(x => !x) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  const rv = routeView(path)
  const mayView = me && rv ? viewsFor(me.roles).includes(rv) : true
  // Leieforhold og samtaler hører til den siden av saken brukeren står på.
  const seg = path.split('?')[0].split('/')
  const rental = seg[1] === 'leie' ? s.rentals.find(x => x.id === seg[2]) : undefined
  const request = seg[1] === 'match' ? s.requests.find(x => x.id === seg[2]) : undefined
  const sideView: View | undefined = !me ? undefined : rental ? (rental.lessorId === me.company.id ? 'utleier' : 'leietaker') : request ? (request.toCompanyId === me.company.id ? 'utleier' : 'leietaker') : undefined
  const want = rv ?? (sideView && me && viewsFor(me.roles).includes(sideView) ? sideView : undefined)
  useEffect(() => { if (me && want && want !== me.view && mayView) setView(want) }, [path, me?.view, me?.user.id, want]) // eslint-disable-line

  const pres = match('/p/:token', path)
  const places = <datalist id="steder">{PLACE_NAMES.map(p => <option key={p} value={p} />)}</datalist>
  if (pres) return <div className="app"><main className="main bare"><Presentation token={pres.token} /></main><Dialogs />{places}</div>
  if (!me || path.split('?')[0] === '/login') return <div className="app"><main className="main bare"><Login /></main><Dialogs />{places}</div>

  const real = path === '/' ? homeOf(me) : path
  let screen: ReactNode = null
  for (const [pat, f] of ROUTES) { const m = match(pat, real); if (m) { screen = f(m); break } }
  if (!mayView && rv !== 'forer') screen = <Page title="Ingen tilgang" back><Empty icon="lock" title="Denne siden er ikke for din rolle" text={`Du er logget inn som ${me.user.name}. Bytt demobruker for å se denne delen av appen.`}><Btn to="/login">Bytt demobruker</Btn></Empty></Page>

  const tabs = tabsFor(me)
  const clean = real.split('?')[0]
  const active = tabs.find(t => clean === t.path || clean.startsWith(t.path + '/')) ?? tabs.find(t => t.also?.some(a => clean === a || clean.startsWith(a + '/')))
  const badge = (p: string) =>
    p === '/verksted' ? s.tasks.filter(t => t.companyId === me.company.id && t.status === 'ny').length
      : p === '/foresporsler' ? s.requests.filter(r => r.toCompanyId === me.company.id && r.status === 'venter').length
        : p === '/partner' ? s.leads.filter(l => l.toCompanyId === me.company.id && l.status === 'sendt').length : 0
  const unread = myNotes(s, me).filter(n => !n.read).length
  const views = viewsFor(me.roles)
  const go = (v: View) => { setView(v); navRoot(homeOf(me, v)); setViewsOpen(false) }
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')
  const nextTheme: ThemeMode = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto'
  const themeIcon = theme === 'auto' ? 'auto' : theme === 'light' ? 'sun' : 'moon'

  return (
    <div className="app" data-view={me.view}>
      <nav className="side" aria-label="Hovedmeny">
        <div className="side-brand">
          <Wordmark a="Plan" tone="amber" size={26} />
          <button className="iconbtn plain small" aria-label={`Utseende: ${THEME_LABEL[theme]}. Bytt til ${THEME_LABEL[nextTheme].toLowerCase()}`} title={`Utseende: ${THEME_LABEL[theme]}`} onClick={() => setTheme(nextTheme)}><Icon name={themeIcon} size={17} /></button>
        </div>
        <button className="side-search" onClick={() => setSearch(true)}><Icon name="search" size={16} /><span>Søk</span><kbd>{mac ? '⌘K' : 'Ctrl K'}</kbd></button>
        {tabs.map(t => (
          <button key={t.path} className="side-link" aria-current={active === t ? 'page' : undefined} onClick={() => navRoot(t.path)}>
            <Icon name={t.icon} size={19} />{t.label}{badge(t.path) > 0 && <span className="dot">{badge(t.path)}</span>}
          </button>
        ))}
        {views.length > 1 && <><div className="side-sep" /><p className="side-cap">Visninger</p></>}
        {views.length > 1 && views.map(v => (
          <button key={v} className="side-link" aria-pressed={v === me.view} onClick={() => go(v)}>
            <i className={'vdot ' + v} />{VIEW_LABEL[v]}{v === me.view && <span className="chk"><Icon name="check" size={16} sw={2.4} /></span>}
          </button>
        ))}
        <div className="side-foot">
          <button className="side-link" aria-current={clean === '/varsler' ? 'page' : undefined} onClick={() => nav('/varsler')}><Icon name="bell" size={19} />Varsler{unread > 0 && <span className="dot">{unread}</span>}</button>
          <button className="side-link side-user" onClick={() => nav('/login')} aria-label={`${me.user.name}, ${me.company.name}. Bytt demobruker`}>
            <Avatar name={me.user.name} size={34} /><span><b>{me.user.name}</b><small>{me.company.name}</small></span><Icon name="swap" size={16} />
          </button>
        </div>
      </nav>
      <main className="main"><Guard k={real}>{screen ?? <Missing />}</Guard></main>
      <nav className="tabs" aria-label="Hovedmeny">
        {tabs.map(t => (
          <button key={t.path} className="tab" aria-current={active === t ? 'page' : undefined} onClick={() => navRoot(t.path)}>
            <span className="tab-ic"><Icon name={t.icon} size={22} sw={active === t ? 2.2 : 1.9} />{badge(t.path) > 0 && <span className="dot">{badge(t.path)}</span>}</span><span>{t.label}</span>
          </button>
        ))}
      </nav>
      {viewsOpen && (
        <Sheet title="Bytt visning" onClose={() => setViewsOpen(false)}>
          <div className="hstack"><Avatar name={me.user.name} /><div className="grow"><b>{me.user.name}</b><p className="hint">{me.company.name}. Visningene følger rollene dine.</p></div></div>
          {views.map(v => <Row key={v} title={VIEW_LABEL[v]} sub={VIEW_SUB[v]} right={v === me.view ? <Pill tone="amber">Aktiv</Pill> : <Icon name="right" size={18} />} onClick={() => go(v)} />)}
          <Field label="Utseende"><Seg value={theme} onChange={setTheme} options={[['auto', 'Automatisk'], ['light', 'Lys'], ['dark', 'Mørk']]} /></Field>
          <Btn kind="ghost" block icon="swap" onClick={() => { setViewsOpen(false); nav('/login') }}>Bytt demobruker</Btn>
        </Sheet>
      )}
      {search && <Palette onClose={() => setSearch(false)} />}
      <Dialogs />{places}
    </div>
  )
}
