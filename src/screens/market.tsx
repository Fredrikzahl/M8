import { useState } from 'react'
import type { Listing, Obj, ObjType, State, Wish } from '../types'
import { AiTag, Avatar, Btn, Card, Chips, DemoSwitch, Empty, Field, KV, Notice, Page, Pill, Row, Section, Seg, Sheet, StarInput, Thumb, Toggle, Wordmark, ask, toast } from '../ui/kit'
import { SwipeCard } from '../ui/widgets'
import { Icon } from '../ui/icons'
import { back, nav, useRoute } from '../router'
import { canSee, co, coName, insuranceStatus, lst, ob, ratingOf, sellerLabel, useMe, useS, wishOf, type Me } from '../store'
import {
  addWanted, answerBid, completeSale, passListing, placeBid, rateCompany, requestContact, resetPasses, respondWanted, saveWish, sendMessage, toggleFav, withdrawRequest,
} from '../actions'
import { addDays, dateOnly, distKm, fmtDate, fmtPeriod, kr, now, num, OBJ_TYPES, PLACE_NAMES, rel, RENTAL_LABEL, today, tonn } from '../lib/util'
import { estimate, matchScore, rentAmount } from '../lib/logic'
import { CompanyCard, FeeNote, Missing, Num, PlaceInput, TopActions, listingSrc, priceText, qs, readingText } from './common'
import { LeadSheet } from './share'

type Hit = { l: Listing; o: Obj; score: number }
function hits(s: State, me: Me, w = wishOf(s, me)): Hit[] {
  return s.listings
    .filter(l => l.active && l.companyId !== me.company.id && canSee(s, l, me.company.id))
    .map(l => { const o = ob(s, l.objId); return { l, o, score: o ? matchScore(w, l, o) : null } })
    .filter((x): x is Hit => !!x.o && x.score != null)
    .sort((a, b) => b.score - a.score)
}

function MCard({ l, o, score }: { l: Listing; o: Obj; score?: number | null }) {
  const s = useS(), me = useMe()
  const d = distKm(me.company.place, o.place)
  const r = ratingOf(s, l.companyId)
  const ph = l.priceHistory
  const drop = ph.length > 1 && ph[ph.length - 1].price < ph[ph.length - 2].price
  return (
    <div className="mcard">
      <div className="mcard-img">
        <Thumb src={listingSrc(s, l, o)} type={o.type} alt={o.name} />
        <span className="tl"><Pill tone="amber">{l.mode === 'leie' ? 'Til leie' : 'Til salgs'}</Pill></span>
        {score != null && <span className="tr"><Pill tone="glass">{score} % match</Pill></span>}
        <span className="bl">{o.place}{d != null && d > 0 ? ` · ca. ${d} km unna` : ''}</span>
      </div>
      <div className="mcard-b">
        <div className="hstack between" style={{ alignItems: 'flex-start' }}><h1>{o.name}</h1><span className="price">{priceText(l)}</span></div>
        <div className="tags">
          <span className="tagbox">{o.year}</span>{o.type !== 'Redskap' && <span className="tagbox">{readingText(o)}</span>}
          {l.withDriver && <span className="tagbox">Kan leies med fører</span>}{drop && <span className="tagbox">Pris senket</span>}
          {o.attachments.slice(0, 2).map(a => <span key={a} className="tagbox">{a}</span>)}
        </div>
        <div className="discreet"><span><Icon name="shield" size={16} /></span>{sellerLabel(s, l, me.company.id)} · {r.avg != null ? `${r.avg.toLocaleString('nb-NO')} av 5 (${r.n})` : 'ingen vurderinger ennå'}</div>
      </div>
    </div>
  )
}

export function Sveip() {
  const s = useS(), me = useMe()
  const [mode, setMode] = useState<'sveip' | 'liste'>('sveip')
  const all = hits(s, me)
  const passed = s.passes[me.user.id] ?? []
  const asked = new Set(s.requests.filter(r => r.fromCompanyId === me.company.id && (r.status === 'venter' || r.status === 'godkjent')).map(r => r.listingId))
  const cards = all.filter(x => !passed.includes(x.l.id) && !asked.has(x.l.id))
  const top = cards[0]
  const fav = (id: string) => s.favorites.some(f => f.userId === me.user.id && f.listingId === id)
  const ins = insuranceStatus(me.company).filter(i => i.tone !== 'ok')
  return (
    <Page brand={<h1><Wordmark a="Sale" size={30} /></h1>} eyebrow="Markedet" right={<TopActions />}>
      {ins.length > 0 && <Notice tone="warn" icon="shield">{ins[0].text}. Utleier ser dette når du spør om leie. <button className="link" onClick={() => nav('/bedrift')}>Legg inn forsikringsbevis</button></Notice>}
      <Seg value={mode} onChange={setMode} options={[['sveip', 'Sveip'], ['liste', `Liste (${all.length})`]]} />
      {mode === 'sveip' && (
        <div className="deck">
          {top ? <>
            <SwipeCard id={top.l.id} onLeft={() => passListing(top.l.id)} onRight={() => nav(`/maskin/${top.l.id}`)}>
              <div onClick={() => nav(`/maskin/${top.l.id}`)} role="link" tabIndex={-1}><MCard {...top} /></div>
            </SwipeCard>
            <div className="swipe-btns">
              <button className="round" aria-label="Ikke interessert" onClick={() => passListing(top.l.id)}><Icon name="close" size={26} /></button>
              <button className="round ink" aria-label={fav(top.l.id) ? 'Fjern fra favoritter' : 'Lagre som favoritt'} onClick={() => { toggleFav(top.l.id); toast(fav(top.l.id) ? 'Fjernet fra favoritter' : 'Lagret i favoritter. Du får varsel hvis prisen senkes.') }}><Icon name="heart" size={20} fill={fav(top.l.id)} /></button>
              <button className="round amber" aria-label="Interessert, se mer" onClick={() => nav(`/maskin/${top.l.id}`)}><Icon name="check" size={28} sw={2.6} /></button>
            </div>
            <p className="hint center">Sveip til høyre for å se mer og spørre, til venstre for å gå videre. {cards.length} treff igjen.</p>
          </> : (
            <Empty title="Ingen flere treff" text={all.length ? 'Du har sett alt som passer ønskene dine akkurat nå.' : 'Ingen annonser passer ønskene dine. Prøv å utvide søket.'}>
              {passed.length > 0 && <Btn kind="amber" onClick={() => resetPasses()}>Vis forkastede på nytt</Btn>}
              <Btn kind="ghost" to="/onsker">Endre ønsker</Btn>
              <Btn kind="ghost" to="/onskes">Legg ut «ønskes»</Btn>
            </Empty>
          )}
        </div>
      )}
      {mode === 'liste' && <>
        {!all.length && <Empty title="Ingen treff" text="Ingen annonser passer ønskene dine."><Btn to="/onsker">Endre ønsker</Btn></Empty>}
        <div className="list">
          {all.map(({ l, o, score }) => (
            <Row key={l.id} to={`/maskin/${l.id}`} thumb={<Thumb src={listingSrc(s, l, o)} type={o.type} alt={o.name} className="lg" />} title={o.name}
              sub={`${o.year} · ${readingText(o)} · ${o.place}`} right={<><b>{priceText(l)}</b><Pill tone={l.mode === 'leie' ? 'amber' : 'ink'}>{score} % match</Pill></>} />
          ))}
        </div>
      </>}
    </Page>
  )
}

export function Maskin({ id }: { id: string }) {
  const s = useS(), me = useMe(), path = useRoute(), l = lst(s, id), o = ob(s, l?.objId)
  const [askOpen, setAskOpen] = useState(false)
  const [open, setOpen] = useState<string | null>('spes')
  const [f, setF] = useState({ from: l?.from && l.from > today() ? l.from : dateOnly(addDays(now(), 2)), to: l?.to ?? dateOnly(addDays(now(), 9)), withDriver: false, message: '' })
  if (!l || !o) return <Missing what="annonsen" />
  const own = l.companyId === me.company.id
  const mine = s.requests.find(r => r.listingId === l.id && r.fromCompanyId === me.company.id && r.status !== 'trukket' && r.status !== 'avslatt')
  const visible = own || !!mine || qs(path).get('t') === l.linkToken || canSee(s, { ...l, active: true }, me.company.id)
  if (!visible) return <Missing what="annonsen" />
  const score = own ? null : matchScore(wishOf(s, me), l, o)
  const isFav = s.favorites.some(x => x.userId === me.user.id && x.listingId === l.id)
  const rent = rentAmount({ from: f.from, to: f.to, price: l.price, unit: l.unit })
  const e = estimate(o)
  const ins = insuranceStatus(me.company).filter(i => i.tone !== 'ok')
  const send = () => {
    if (l.mode === 'leie' && f.to < f.from) { toast('Sluttdatoen er før startdatoen', 'bad'); return }
    requestContact(l.id, l.mode === 'leie' ? { from: f.from, to: f.to, withDriver: f.withDriver && l.withDriver, message: f.message.trim() || undefined } : { message: f.message.trim() || undefined })
    setAskOpen(false); toast('Forespørselen er sendt. Du får varsel når selgeren svarer.', 'ok'); nav('/mine', true)
  }
  const acc = (key: string, title: string, sub: string, body: React.ReactNode) => (
    <div key={key}>
      <button className="acc-h" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)}>{title}<span>{sub} {open === key ? '−' : '+'}</span></button>
      {open === key && <div className="acc-b">{body}</div>}
    </div>
  )
  return (
    <Page flush footer={own ? <Btn kind="amber" to={`/annonse/${l.id}`}>Rediger annonsen</Btn>
      : mine ? <Btn kind="amber" to={mine.rentalId ? `/leie/${mine.rentalId}` : mine.status === 'godkjent' ? `/match/${mine.id}` : '/mine'}>{mine.status === 'godkjent' ? 'Åpne samtalen' : 'Forespørselen venter på svar'}</Btn>
        : l.active ? <><button className={'iconbtn' + (isFav ? ' on' : '')} style={{ height: 48, width: 48 }} aria-label={isFav ? 'Fjern fra favoritter' : 'Lagre som favoritt'} onClick={() => toggleFav(l.id)}><Icon name="heart" size={20} fill={isFav} /></button><Btn kind="amber" onClick={() => setAskOpen(true)}>{l.mode === 'leie' ? 'Spør om leie' : 'Be om kontakt'}</Btn></> : undefined}>
      <div className="hero">
        <Thumb src={listingSrc(s, l, o)} type={o.type} alt={o.name} />
        <button className="iconbtn" aria-label="Tilbake" onClick={() => back('/sveip')}><Icon name="back" sw={2.5} size={20} /></button>
        <span className="bl"><Pill tone="amber">{l.mode === 'leie' ? 'Til leie' : 'Til salgs'}</Pill></span>
        {score != null && <span className="br"><Pill tone="glass">{score} % match</Pill></span>}
      </div>
      <div className="padx">
        {!l.active && !own && <Notice tone="plain" icon="info">Annonsen er ikke lenger aktiv.</Notice>}
        {own && <Notice tone="info" icon="eye">Slik ser annonsen ut for andre. Navnet ditt skjules til du har akseptert kjøperen.</Notice>}
        <div className="hstack between" style={{ alignItems: 'flex-start' }}>
          <div><h1>{o.name}</h1><p className="muted">{[o.make, o.model, o.year].filter(Boolean).join(' · ')} · {o.place}</p></div>
          <div className="right"><p className="price">{priceText(l)}</p>{l.mode === 'leie' && l.from && <small>Ledig {fmtPeriod(l.from, l.to)}</small>}</div>
        </div>
        <div className="tags">
          {o.type !== 'Redskap' && <span className="tagbox">{readingText(o)}</span>}<span className="tagbox">{tonn(o.weightKg)}</span><span className="tagbox">Tilstand {o.condition}/5</span>
          {l.withDriver && <span className="tagbox">Fører {kr(l.driverRate ?? 0)}/t</span>}{l.bidDeadline && <span className="tagbox">Budfrist {fmtDate(l.bidDeadline)}</span>}
        </div>
        {l.reservedFor && l.reservedFor !== me.company.id && !own && <Notice tone="warn" icon="lock">Reservert for en annen kjøper etter akseptert bud.</Notice>}
        <p>{l.text}</p>
        {l.mode === 'salg' && <Card className="tight"><div className="hstack between"><b>PlanM8-estimat: kr {num(e.low)}–{num(e.high)}</b><AiTag text="Estimat" /></div><p className="hint">Et intervall fra en enkel formel, ikke en takst. Når selgeren har akseptert deg, kan du bestille takst.</p></Card>}
        <div className="acc">
          {acc('spes', 'Spesifikasjoner', `${Object.keys(o.specs).length + 3} punkter`, <KV rows={[['Type', o.type], ['Årsmodell', o.year], ['Vekt', tonn(o.weightKg)], ...Object.entries(o.specs)]} />)}
          {acc('redskap', 'Redskap', `${o.attachments.length} stk.`, o.attachments.length ? <div className="tags">{o.attachments.map(a => <span key={a} className="tagbox">{a}</span>)}</div> : <p className="hint">Ingen redskap følger med.</p>)}
          {acc('dok', 'Dokumentasjon', `${o.docs.length} dokumenter`, <><KV rows={o.docs.map(x => [x.name, fmtDate(x.at, true)])} /><p className="hint">{o.photos.length} bilder med tid og sted. Dokumentene åpnes når selgeren har akseptert deg.</p></>)}
          {l.mode === 'leie' && acc('vilkar', 'Vilkår', `${l.terms.advancePct} % forskudd`, <KV rows={[
            ['Forskudd', `${l.terms.advancePct} % ved bestilling`], ...(l.terms.freight ? [['Frakt tur og retur', kr(l.terms.freight)] as [string, string]] : []), ...(l.terms.wash ? [['Vask', kr(l.terms.wash)] as [string, string]] : []),
            ['Drivstoff', `${kr(l.terms.fuelPerQuarter)} per kvart tank som mangler`], ['Dekk eller belter', `${kr(l.terms.tirePerMm)} per mm`], ['Slitasje', `${kr(l.terms.wearPerHour)} per time`],
          ]} />)}
          {l.priceHistory.length > 1 && acc('pris', 'Prishistorikk', `${l.priceHistory.length} priser`, <KV rows={l.priceHistory.map(p => [fmtDate(p.at, true), kr(p.price)])} />)}
        </div>
        <Card className="tight">
          <div className="discreet" style={{ border: 'none', padding: 0 }}><span><Icon name="shield" size={16} /></span><b>{sellerLabel(s, l, me.company.id)}</b></div>
          <p className="hint">{sellerLabel(s, l, me.company.id) === 'Verifisert bedrift' ? 'Selgeren er verifisert med organisasjonsnummer. Navnet vises når selgeren har akseptert deg.' : `${co(s, l.companyId)?.place} · org.nr. ${co(s, l.companyId)?.orgnr}`}</p>
        </Card>
        {mine && <Notice tone={mine.status === 'godkjent' ? 'ok' : 'info'} icon="chat">{mine.status === 'godkjent' ? 'Selgeren har akseptert deg.' : `Forespørselen ble sendt ${rel(mine.createdAt)} og venter på svar.`}</Notice>}
      </div>
      {askOpen && (
        <Sheet title={l.mode === 'leie' ? 'Spør om leie' : 'Be om kontakt'} onClose={() => setAskOpen(false)} footer={<><Btn kind="ghost" onClick={() => setAskOpen(false)}>Avbryt</Btn><Btn kind="amber" icon="send" onClick={send}>Send forespørsel</Btn></>}>
          {l.mode === 'leie' && <>
            <div className="grid2"><Field label="Fra"><input type="date" value={f.from} min={today()} onChange={ev => setF({ ...f, from: ev.target.value })} /></Field><Field label="Til"><input type="date" value={f.to} min={f.from} onChange={ev => setF({ ...f, to: ev.target.value })} /></Field></div>
            {l.withDriver && <Toggle on={f.withDriver} onChange={v => setF({ ...f, withDriver: v })} label="Med fører" sub={`${kr(l.driverRate ?? 0)} per time. Timene godkjenner du selv.`} />}
            <KV rows={[['Leie for perioden', kr(rent)], [`Forskudd ${l.terms.advancePct} %`, kr((rent * l.terms.advancePct) / 100)]]} />
            <FeeNote amount={rent} side="leietaker" />
          </>}
          <Field label="Melding til selgeren" hint="Valgfritt"><textarea value={f.message} onChange={ev => setF({ ...f, message: ev.target.value })} placeholder={l.mode === 'leie' ? 'Hva skal maskinen brukes til?' : 'Fortell kort hva dere ser etter'} /></Field>
          <p className="hint">Selgeren ser bedriftsprofilen din, vurderingene og status på forsikringen, og velger selv om de vil godkjenne.</p>
          {ins.length > 0 && l.mode === 'leie' && <Notice tone="warn" icon="shield">{ins.map(i => i.text).join('. ')}. Dette kan gjøre at utleier sier nei.</Notice>}
        </Sheet>
      )}
    </Page>
  )
}

export function Favoritter() {
  const s = useS(), me = useMe()
  const favs = s.favorites.filter(f => f.userId === me.user.id)
  return (
    <Page title="Favoritter" eyebrow="SaleM8" right={<TopActions />} sub="Du får varsel når prisen senkes eller objektet blir solgt.">
      {!favs.length && <Empty title="Ingen favoritter" text="Trykk på hjertet på en annonse for å lagre den her."><Btn to="/sveip">Til markedet</Btn></Empty>}
      <div className="list">
        {favs.map(f => {
          const l = lst(s, f.listingId), o = ob(s, l?.objId)
          if (!l || !o) return null
          const gone = !l.active
          return (
            <Row key={f.id} to={`/maskin/${l.id}`} thumb={<Thumb src={listingSrc(s, l, o)} type={o.type} alt={o.name} className="lg" />} title={o.name} sub={`${priceText(l)} · ${o.place}`}
              right={<>
                {gone ? <Pill tone="mute">{o.status === 'solgt' ? 'Solgt' : 'Ikke aktiv'}</Pill> : l.price < f.seenPrice ? <Pill tone="ok">Senket {kr(f.seenPrice - l.price)}</Pill> : <Pill tone={l.mode === 'leie' ? 'amber' : 'ink'}>{l.mode === 'leie' ? 'Til leie' : 'Til salgs'}</Pill>}
                <span role="button" tabIndex={0} className="link" onClick={ev => { ev.stopPropagation(); toggleFav(l.id) }} onKeyDown={ev => { if (ev.key === 'Enter') { ev.stopPropagation(); toggleFav(l.id) } }}>Fjern</span>
              </>} />
          )
        })}
      </div>
    </Page>
  )
}

export function Onsker() {
  const s = useS(), me = useMe()
  const [w, setW] = useState<Wish>(wishOf(s, me))
  const up = (p: Partial<Wish>) => setW(x => ({ ...x, ...p }))
  const n = hits(s, me, w).length
  const dirty = JSON.stringify(w) !== JSON.stringify(wishOf(s, me))
  return (
    <Page title="Ønsker" eyebrow="SaleM8" right={<TopActions />} sub="Markedet viser det som passer best først."
      footer={<Btn kind="amber" disabled={!dirty} onClick={() => { saveWish(w); toast(`Ønskene er lagret. ${n} annonser passer nå.`, 'ok') }}>Lagre ønsker · {n} treff</Btn>}>
      <Field label="Jeg vil"><Seg tone="amber" value={w.mode} onChange={v => up({ mode: v })} options={[['leie', 'Leie'], ['kjope', 'Kjøpe'], ['begge', 'Begge']]} /></Field>
      <Field label="Type" hint="Ingen valgt betyr alle typer"><Chips value={w.types} options={OBJ_TYPES} onChange={v => up({ types: v as ObjType[] })} /></Field>
      <div className="grid2">
        <Field label="Område"><select value={w.area} onChange={e => up({ area: e.target.value })}>{[...new Set([w.area, ...PLACE_NAMES])].map(p => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Avstand"><select value={w.radiusKm ?? 0} onChange={e => up({ radiusKm: Number(e.target.value) || null })}><option value={50}>Innen 50 km</option><option value={100}>Innen 100 km</option><option value={250}>Innen 250 km</option><option value={500}>Innen 500 km</option><option value={0}>Hele landet</option></select></Field>
      </div>
      <Field label={`Høyst ${num(w.maxReading)} timer`} hint="Gjelder maskiner med timeteller"><input type="range" min={500} max={15000} step={500} value={w.maxReading} onChange={e => up({ maxReading: Number(e.target.value) })} /></Field>
      <Field label={`Årsmodell fra ${w.yearFrom}`}><input type="range" min={2005} max={new Date().getFullYear()} value={w.yearFrom} onChange={e => up({ yearFrom: Number(e.target.value) })} /></Field>
      <Field label="Høyeste pris" hint="La stå tom for ingen grense. Gjelder dagspris ved leie."><Num value={w.maxPrice} onChange={v => up({ maxPrice: v || null })} placeholder="Ingen grense" /></Field>
      <Card><Toggle on={w.notify} onChange={v => up({ notify: v })} label="Varsle meg om nye treff" sub="Varselet vises i appen" /></Card>
      <Btn kind="ghost" to="/onskes" icon="filter">Finner du ikke det du leter etter? Legg ut «ønskes»</Btn>
    </Page>
  )
}

export function Mine() {
  const s = useS(), me = useMe()
  const reqs = s.requests.filter(r => r.fromCompanyId === me.company.id)
  const waiting = reqs.filter(r => r.status === 'venter')
  const rentals = s.rentals.filter(r => r.lesseeId === me.company.id)
  const deals = reqs.filter(r => r.status === 'godkjent' && r.mode === 'salg')
  const no = reqs.filter(r => r.status === 'avslatt').slice(0, 6)
  const none = !waiting.length && !rentals.length && !deals.length && !no.length
  return (
    <Page title="Mine" eyebrow="SaleM8" right={<TopActions />} wide sub="Forespørsler, leieforhold og kjøp.">
      {none && <Empty title="Ingenting her ennå" text="Når du spør om å leie eller kjøpe noe, følger du saken her."><Btn to="/sveip">Til markedet</Btn></Empty>}
      {waiting.length > 0 && <Section title="Venter på svar">
        <div className="cols">{waiting.map(r => { const o = ob(s, r.objId)!; return (
          <Card key={r.id} className="tight">
            <Row to={`/maskin/${r.listingId}`} thumb={<Thumb src={o.photos[0]?.src} type={o.type} />} title={o.name} sub={r.mode === 'leie' ? fmtPeriod(r.from, r.to) : 'Kjøp'} right={<Pill tone="warn">Venter</Pill>} />
            <div className="hstack between"><small>Sendt {rel(r.createdAt)}</small><button className="link" onClick={async () => { if (await ask('Trekke forespørselen?', 'Trekk')) withdrawRequest(r.id) }}>Trekk forespørselen</button></div>
          </Card>
        ) })}</div>
      </Section>}
      {rentals.length > 0 && <Section title="Leieforhold">
        <div className="cols">{rentals.map(r => { const o = ob(s, r.objId)!; return (
          <Row key={r.id} to={`/leie/${r.id}`} thumb={<Thumb src={o.photos[0]?.src} type={o.type} />} title={`#${r.no} · ${o.name}`} sub={`${coName(s, r.lessorId)} · ${fmtPeriod(r.from, r.to)}`}
            right={<Pill tone={r.status === 'godkjent' ? 'warn' : r.status === 'avsluttet' || r.status === 'oppgjort' ? 'ok' : r.status === 'avbrutt' ? 'mute' : 'info'}>{r.status === 'godkjent' ? 'Betal forskudd' : RENTAL_LABEL[r.status]}</Pill>} />
        ) })}</div>
      </Section>}
      {deals.length > 0 && <Section title="Kjøp og samtaler">
        <div className="cols">{deals.map(r => { const o = ob(s, r.objId)!; const sold = s.sales.some(x => x.objId === o.id && x.buyerId === me.company.id); return (
          <Row key={r.id} to={`/match/${r.id}`} thumb={<Thumb src={o.photos[0]?.src} type={o.type} />} title={o.name} sub={coName(s, r.toCompanyId)} right={<Pill tone={sold ? 'ok' : 'amber'}>{sold ? 'Kjøpt' : 'Akseptert'}</Pill>} />
        ) })}</div>
      </Section>}
      {no.length > 0 && <Section title="Avslått">
        <div className="cols">{no.map(r => <Row key={r.id} title={ob(s, r.objId)?.name ?? 'Objekt'} sub={r.reason ?? 'Uten begrunnelse'} right={<small>{r.decidedAt ? fmtDate(r.decidedAt) : ''}</small>} />)}</div>
      </Section>}
    </Page>
  )
}

/** Samtalen mellom kjøper og selger etter at selgeren har akseptert. Her skjer også bud og salg. */
export function MatchThread({ id }: { id: string }) {
  const s = useS(), me = useMe(), r = s.requests.find(x => x.id === id)
  const [text, setText] = useState('')
  const [bid, setBid] = useState<null | { counterOf?: string }>(null)
  const [amount, setAmount] = useState(0)
  const [lead, setLead] = useState(false)
  const [stars, setStars] = useState(0)
  if (!r || r.status !== 'godkjent' || (r.fromCompanyId !== me.company.id && r.toCompanyId !== me.company.id)) return <Missing what="samtalen" />
  const seller = r.toCompanyId === me.company.id
  const otherId = seller ? r.fromCompanyId : r.toCompanyId
  const l = lst(s, r.listingId), o = ob(s, r.objId)
  if (!l || !o) return <Missing what="annonsen" />
  const msgs = s.messages.filter(m => m.requestId === id)
  const bids = s.bids.filter(b => b.requestId === id)
  const sale = s.sales.find(x => x.listingId === l.id && x.buyerId === r.fromCompanyId)
  const soldElsewhere = !sale && o.status === 'solgt'
  const okBid = bids.find(b => b.status === 'akseptert')
  const live = bids.filter(b => b.status === 'aktivt').slice(-1)[0]
  const deadlinePassed = !!l.bidDeadline && l.bidDeadline < today()
  const rated = sale && s.ratings.some(x => x.refId === sale.id && x.fromCompanyId === me.company.id)
  const otherUser = seller ? r.fromUserId : s.users.find(u => u.memberships.some(m => m.companyId === r.toCompanyId && (m.roles.includes('admin') || m.roles.includes('leder'))))?.id
  const BID = { aktivt: 'Venter på svar', akseptert: 'Akseptert', avslatt: 'Avslått', motbud: 'Besvart med motbud', trukket: 'Erstattet', utlopt: 'Utløpt' }
  const finish = async () => {
    const price = okBid?.amount ?? l.price
    if (await ask(`Gjennomføre salget av ${o.name} til ${coName(s, r.fromCompanyId)} for ${kr(price)}? Objektet flyttes til arkivet ditt, og kjøperen får et nytt objektkort med bare serienummer og modell.`, 'Gjennomfør salg')) { completeSale(r.id, price); toast('Salget er gjennomført', 'ok') }
  }
  return (
    <Page title={coName(s, otherId)} eyebrow={seller ? 'Kjøper' : 'Selger'} back={seller ? '/foresporsler' : '/mine'}
      footer={<><input value={text} onChange={e => setText(e.target.value)} placeholder="Skriv en melding" aria-label="Melding" onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { sendMessage(id, text.trim()); setText('') } }} /><Btn kind="amber" icon="send" label="Send melding" disabled={!text.trim()} onClick={() => { sendMessage(id, text.trim()); setText('') }}>{''}</Btn></>}>
      <Row to={seller ? `/objekt/${o.id}` : `/maskin/${l.id}`} thumb={<Thumb src={listingSrc(s, l, o)} type={o.type} alt={o.name} />} title={o.name} sub={`${priceText(l)}${l.bidDeadline ? ` · budfrist ${fmtDate(l.bidDeadline)}` : ''}`} right={<Icon name="right" size={18} />} />
      {r.rentalId && <Btn kind="quiet" to={`/leie/${r.rentalId}`} icon="handshake">Åpne leieforholdet</Btn>}
      {sale && <Notice tone="ok" icon="check">Salget ble gjennomført {fmtDate(sale.at)} for {kr(sale.price)}. {seller ? 'Objektet ligger i arkivet ditt.' : <button className="link" onClick={() => nav(`/objekt/${sale.newObjId}`)}>Åpne det nye objektkortet</button>}</Notice>}
      {soldElsewhere && <Notice tone="plain" icon="info">Objektet er solgt til en annen kjøper.</Notice>}

      <div className="chat">
        {msgs.map(m => m.kind === 'system'
          ? <div key={m.id} className="msg sys">{m.text}</div>
          : <div key={m.id} className={'msg' + (m.fromCompanyId === me.company.id ? ' me' : '')}>{m.kind === 'visning' && <b>Ønske om visning: </b>}{m.text}<small>{rel(m.at)}</small></div>)}
        {!msgs.length && <p className="hint center">Ingen meldinger ennå.</p>}
      </div>

      {r.mode === 'salg' && !sale && !soldElsewhere && (
        <Section title="Bud">
          {l.reservedFor === r.fromCompanyId && <Notice tone="ok" icon="lock">Objektet er reservert for {seller ? coName(s, r.fromCompanyId) : 'deg'} etter akseptert bud.</Notice>}
          {!bids.length && <p className="hint">Ingen bud ennå. {seller ? 'Du kan vente på bud, eller gjennomføre salget til prisantydning.' : 'Gi et bud, eller avtal prisantydning med selgeren.'}</p>}
          {bids.map(b => (
            <Card key={b.id} className="tight">
              <div className="hstack between"><b>{b.counterOf ? 'Motbud' : 'Bud'} fra {b.fromCompanyId === me.company.id ? 'deg' : coName(s, b.fromCompanyId)}</b><b className="num">{kr(b.amount)}</b></div>
              <div className="hstack between"><small>{rel(b.at)}{b.status === 'aktivt' && b.expires ? ` · gjelder til ${fmtDate(b.expires)}` : ''}</small><Pill tone={b.status === 'akseptert' ? 'ok' : b.status === 'aktivt' ? 'warn' : 'mute'}>{BID[b.status]}</Pill></div>
              {b.status === 'aktivt' && b.fromCompanyId !== me.company.id && (
                <div className="hstack wrap">
                  <Btn kind="amber" small onClick={() => { answerBid(b.id, true); toast('Budet er akseptert', 'ok') }}>Aksepter</Btn>
                  <Btn kind="quiet" small onClick={() => { setAmount(b.amount); setBid({ counterOf: b.id }) }}>Motbud</Btn>
                  <Btn kind="ghost" small onClick={() => answerBid(b.id, false)}>Avslå</Btn>
                </div>
              )}
            </Card>
          ))}
          {deadlinePassed && <Notice tone="warn" icon="clock">Budfristen gikk ut {fmtDate(l.bidDeadline)}.</Notice>}
          <div className="hstack wrap">
            {!seller && !okBid && !deadlinePassed && (!live || live.fromCompanyId !== me.company.id) && <Btn kind="amber" small icon="money" onClick={() => { setAmount(l.price); setBid({}) }}>Gi bud</Btn>}
            {seller && <Btn kind={okBid ? 'amber' : 'quiet'} small icon="check" onClick={finish}>Gjennomfør salg for {kr(okBid?.amount ?? l.price)}</Btn>}
          </div>
          <p className="hint">Alle bud og svar logges med tidspunkt. Kontraktshjelpen overfører serienummer og modell til ny eier når salget gjennomføres.</p>
        </Section>
      )}

      {!sale && !soldElsewhere && r.mode === 'salg' && !seller && (
        <Section title="Før du bestemmer deg">
          <div className="hstack wrap">
            <Btn kind="quiet" small icon="calendar" onClick={() => { sendMessage(id, 'Vi vil gjerne komme og se på maskinen. Når passer det?', 'visning'); toast('Ønsket om visning er sendt') }}>Be om visning</Btn>
            <Btn kind="quiet" small icon="file" onClick={() => setLead(true)}>Bestill takst</Btn>
          </div>
        </Section>
      )}
      {sale && !seller && <Btn kind="blue" icon="truck" to={`/frakt/send?tittel=${encodeURIComponent(o.name)}&fra=${encodeURIComponent(o.place)}&til=${encodeURIComponent(me.company.place)}&kg=${o.weightKg}&obj=${sale.newObjId}`}>Bestill frakt av maskinen</Btn>}
      {sale && !rated && (
        <Card>
          <h2>Gi {coName(s, otherId)} en vurdering</h2>
          <StarInput value={stars} onChange={setStars} />
          <Btn disabled={!stars} onClick={() => { rateCompany('salg', sale.id, otherId, stars); toast('Takk for vurderingen', 'ok') }}>Send vurdering</Btn>
        </Card>
      )}
      <CompanyCard id={otherId} />
      {otherUser && <DemoSwitch userId={otherUser} to={`/match/${id}`} />}
      {bid && (
        <Sheet title={bid.counterOf ? 'Gi motbud' : 'Gi bud'} onClose={() => setBid(null)} footer={<><Btn kind="ghost" onClick={() => setBid(null)}>Avbryt</Btn><Btn kind="amber" onClick={() => { if (amount <= 0) { toast('Skriv inn et beløp', 'bad'); return } placeBid(id, amount, bid.counterOf); setBid(null); toast('Budet er sendt', 'ok') }}>Send {bid.counterOf ? 'motbud' : 'bud'}</Btn></>}>
          <p className="hint">Prisantydning er {kr(l.price)}. Budet gjelder i sju dager.</p>
          <Field label="Beløp i kroner"><Num value={amount} onChange={setAmount} /></Field>
        </Sheet>
      )}
      {lead && <LeadSheet type="takst" text={`Takst av ${o.name} (${o.year}), står i ${o.place}.`} onClose={() => setLead(false)} />}
    </Page>
  )
}

export function Onskes() {
  const s = useS(), me = useMe()
  const [add, setAdd] = useState(false)
  const [f, setF] = useState({ mode: 'leie' as 'leie' | 'kjope', type: 'Gravemaskin' as ObjType, text: '', area: me.company.place })
  const [reply, setReply] = useState<string | null>(null)
  const [rt, setRt] = useState({ text: '', listingId: '' })
  const mineL = s.listings.filter(l => l.companyId === me.company.id && l.active)
  return (
    <Page title="Ønskes kjøpt eller leid" eyebrow="SaleM8" back="/mer" wide sub="Etterlysninger fra bedrifter som leter. Har du det de trenger, kan du svare."
      right={<Btn kind="amber" small icon="plus" onClick={() => setAdd(true)}>Ny</Btn>}>
      {!s.wanted.length && <Empty title="Ingen etterlysninger" text="Legg ut hva du leter etter, så kan eiere svare deg." />}
      <div className="cols">
        {s.wanted.map(w => {
          const own = w.companyId === me.company.id
          return (
            <Card key={w.id}>
              <div className="hstack between"><Pill tone="amber">Ønskes {w.mode === 'leie' ? 'leid' : 'kjøpt'}</Pill><small>{rel(w.at)}</small></div>
              <h3>{w.type} · {w.area}</h3>
              <p>{w.text}</p>
              <p className="hint">{own ? 'Din etterlysning' : 'Verifisert bedrift'}</p>
              {w.responses.filter(x => own || x.companyId === me.company.id).map(x => (
                <div key={x.id} className="msg" style={{ maxWidth: '100%' }}><b>{own ? coName(s, x.companyId) : 'Ditt svar'}: </b>{x.text}{x.listingId && <> <button className="link" onClick={() => nav(`/maskin/${x.listingId}`)}>Se annonsen</button></>}</div>
              ))}
              {own && !w.responses.length && <p className="hint">Ingen svar ennå.</p>}
              {!own && <Btn kind="quiet" small onClick={() => { setReply(w.id); setRt({ text: '', listingId: '' }) }}>Svar</Btn>}
            </Card>
          )
        })}
      </div>
      {add && (
        <Sheet title="Ny etterlysning" onClose={() => setAdd(false)} footer={<><Btn kind="ghost" onClick={() => setAdd(false)}>Avbryt</Btn><Btn kind="amber" onClick={() => { if (!f.text.trim()) { toast('Beskriv hva du leter etter', 'bad'); return } addWanted({ ...f, text: f.text.trim() }); setAdd(false); toast('Etterlysningen er lagt ut', 'ok') }}>Legg ut</Btn></>}>
          <Seg tone="amber" value={f.mode} onChange={v => setF({ ...f, mode: v })} options={[['leie', 'Ønskes leid'], ['kjope', 'Ønskes kjøpt']]} />
          <div className="grid2">
            <Field label="Type"><select value={f.type} onChange={e => setF({ ...f, type: e.target.value as ObjType })}>{OBJ_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Område"><PlaceInput value={f.area} onChange={v => setF({ ...f, area: v })} /></Field>
          </div>
          <Field label="Hva leter du etter?"><textarea value={f.text} onChange={e => setF({ ...f, text: e.target.value })} placeholder="Størrelse, periode og hva den skal brukes til" /></Field>
        </Sheet>
      )}
      {reply && (
        <Sheet title="Svar på etterlysningen" onClose={() => setReply(null)} footer={<><Btn kind="ghost" onClick={() => setReply(null)}>Avbryt</Btn><Btn kind="amber" onClick={() => { if (!rt.text.trim()) { toast('Skriv et svar', 'bad'); return } respondWanted(reply, rt.text.trim(), rt.listingId || undefined); setReply(null); toast('Svaret er sendt', 'ok') }}>Send svar</Btn></>}>
          <Field label="Svar"><textarea value={rt.text} onChange={e => setRt({ ...rt, text: e.target.value })} placeholder="Hva kan du tilby?" /></Field>
          {mineL.length > 0 && <Field label="Legg ved en av annonsene dine" hint="Valgfritt"><select value={rt.listingId} onChange={e => setRt({ ...rt, listingId: e.target.value })}><option value="">Ingen</option>{mineL.map(l => <option key={l.id} value={l.id}>{ob(s, l.objId)?.name} · {priceText(l)}</option>)}</select></Field>}
        </Sheet>
      )}
    </Page>
  )
}
