import { Component, useEffect, useState, type ReactNode } from 'react'
import type { View } from './types'
import { meOf, useS, viewsFor, type Me } from './store'
import { match, nav, useRoute } from './router'
import { myNotes, setView } from './actions'
import { PLACE_NAMES, VIEW_LABEL, VIEW_SUB } from './lib/util'
import { Avatar, Btn, Dialogs, Empty, Page, Pill, Row, Sheet, Wordmark } from './ui/kit'
import { Icon } from './ui/icons'
import { Missing, shell } from './screens/common'
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
    return <Page title="Noe gikk galt"><Empty title="Siden kunne ikke vises" text="Gå tilbake og prøv igjen. Hvis det gjentar seg, kan du nullstille demodataene under Mer."><Btn to="/">Til forsiden</Btn></Empty></Page>
  }
}

export function App() {
  const s = useS(), path = useRoute(), me = meOf(s)
  const [viewsOpen, setViewsOpen] = useState(false)
  useEffect(() => { shell.setOpener(() => setViewsOpen(true)) }, [])
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
  if (!mayView && rv !== 'forer') screen = <Page title="Ingen tilgang" back><Empty title="Denne siden er ikke for din rolle" text={`Du er logget inn som ${me.user.name}. Bytt demobruker for å se denne delen av appen.`}><Btn to="/login">Bytt demobruker</Btn></Empty></Page>

  const tabs = tabsFor(me)
  const clean = real.split('?')[0]
  const active = tabs.find(t => clean === t.path || clean.startsWith(t.path + '/')) ?? tabs.find(t => t.also?.some(a => clean === a || clean.startsWith(a + '/')))
  const badge = (p: string) =>
    p === '/verksted' ? s.tasks.filter(t => t.companyId === me.company.id && t.status === 'ny').length
      : p === '/foresporsler' ? s.requests.filter(r => r.toCompanyId === me.company.id && r.status === 'venter').length
        : p === '/partner' ? s.leads.filter(l => l.toCompanyId === me.company.id && l.status === 'sendt').length : 0
  const unread = myNotes(s, me).filter(n => !n.read).length
  const views = viewsFor(me.roles)
  const go = (v: View) => { setView(v); nav(homeOf(me, v)); setViewsOpen(false) }

  return (
    <div className="app">
      <nav className="side" aria-label="Hovedmeny">
        <Wordmark a="Plan" tone="plain" size={30} />
        {tabs.map(t => (
          <button key={t.path} className="side-link" aria-current={active === t ? 'page' : undefined} onClick={() => nav(t.path)}>
            <Icon name={t.icon} size={20} />{t.label}{badge(t.path) > 0 && <span className="dot">{badge(t.path)}</span>}
          </button>
        ))}
        {views.length > 1 && <><div className="side-sep" /><p className="side-cap">Visning</p></>}
        {views.length > 1 && views.map(v => <button key={v} className="side-link" aria-pressed={v === me.view} onClick={() => go(v)}><Icon name={v === me.view ? 'check' : 'right'} size={16} />{VIEW_LABEL[v]}</button>)}
        <div className="side-foot">
          <button className="side-link" onClick={() => nav('/varsler')}><Icon name="bell" size={20} />Varsler{unread > 0 && <span className="dot">{unread}</span>}</button>
          <button className="side-link side-user" onClick={() => nav('/login')} aria-label="Bytt demobruker">
            <Avatar name={me.user.name} size={36} /><span><b>{me.user.name}</b><small>{me.company.name}</small></span>
          </button>
        </div>
      </nav>
      <main className="main"><Guard k={real}>{screen ?? <Missing />}</Guard></main>
      <nav className="tabs" aria-label="Hovedmeny">
        {tabs.map(t => (
          <button key={t.path} className="tab" aria-current={active === t ? 'page' : undefined} onClick={() => nav(t.path)}>
            <Icon name={t.icon} size={22} sw={active === t ? 2.4 : 2} /><span>{t.label}</span>{badge(t.path) > 0 && <span className="dot">{badge(t.path)}</span>}
          </button>
        ))}
      </nav>
      {viewsOpen && (
        <Sheet title="Bytt visning" onClose={() => setViewsOpen(false)}>
          <p className="hint">Du er {me.user.name} hos {me.company.name}. Visningene følger rollene dine.</p>
          {views.map(v => <Row key={v} title={VIEW_LABEL[v]} sub={VIEW_SUB[v]} right={v === me.view ? <Pill tone="amber">Aktiv</Pill> : <Icon name="right" size={18} />} onClick={() => go(v)} />)}
          <Btn kind="ghost" block icon="user" onClick={() => { setViewsOpen(false); nav('/login') }}>Bytt demobruker</Btn>
        </Sheet>
      )}
      <Dialogs />{places}
    </div>
  )
}
