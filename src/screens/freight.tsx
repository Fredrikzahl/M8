import { useState } from 'react'
import type { FreightJob, JobReq, Photo, State, Trip } from '../types'
import { Btn, Card, Chips, DemoSwitch, Empty, Field, KV, MiniMap, Notice, Page, Pill, Row, Section, Seg, Sheet, StarInput, Stars, Toggle, ask, toast } from '../ui/kit'
import { PhotoField, SignaturePad, SwipeCard } from '../ui/widgets'
import { Icon } from '../ui/icons'
import { link, nav, useRoute } from '../router'
import { co, coName, ob, ratingOf, useMe, useS, userName, type Me } from '../store'
import { bidBlock, bidJob, bookTrip, cancelJob, chooseBid, createJob, hitchPrice, jobDeliver, jobPickup, passJob, rateCompany, resetJobPasses, saveTrip, type NewJob } from '../actions'
import { addDays, detourKm, distKm, fmtDT, fmtWhen, kr, now, num, rel, tonn } from '../lib/util'
import { Gallery, Missing, Num, PlaceInput, TopActions, qs } from './common'

const REQ_LABEL: Record<JobReq, string> = { loyve: 'Krever løyve', tippbil: 'Tippbil', maskinhenger: 'Maskinhenger' }
const CARGO = ['Maskiner', 'Masser', 'Paller', 'Privat'] as const
const JOB_LABEL = { apent: 'Åpent for bud', tildelt: 'Tildelt', hentet: 'Hentet', levert: 'Levert', avlyst: 'Avlyst' }
const localDT = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
const kmText = (a: string, b: string) => { const k = distKm(a, b); return k == null ? 'ukjent avstand' : `ca. ${k} km` }
const suggest = (j: FreightJob) => Math.max(800, Math.round(((distKm(j.fromPlace, j.toPlace) ?? 100) * (j.weightKg > 3500 ? 30 : 14)) / 100) * 100)
/** Minste omvei for noen av turene mine, eller null når oppdraget ikke ligger langs en rute. */
function bestDetour(s: State, me: Me, j: FreightJob) {
  const ds = s.trips.filter(t => t.companyId === me.company.id && t.live).map(t => ({ t, d: detourKm(t.from, t.to, j.fromPlace, j.toPlace) })).filter(x => x.d != null && x.t.freeKg >= j.weightKg) as { t: Trip; d: number }[]
  return ds.sort((a, b) => a.d - b.d)[0] ?? null
}

export function FraktSend() {
  const s = useS(), me = useMe(), q = qs(useRoute())
  const [f, setF] = useState({ title: q.get('tittel') ?? '', cargo: 'Maskiner' as NewJob['cargo'], fromPlace: q.get('fra') ?? me.company.place, toPlace: q.get('til') ?? '', weightKg: Number(q.get('kg')) || 0, when: localDT(addDays(now(), 2)), reqs: [] as JobReq[], objId: q.get('obj') ?? undefined as string | undefined })
  const up = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }))
  const mine = s.objects.filter(o => o.companyId === me.company.id && !o.archived && o.type !== 'Redskap')
  const reqs = [...new Set([...f.reqs, ...(f.weightKg > 3500 ? ['loyve' as JobReq] : [])])]
  const job = (): NewJob => ({ title: f.title.trim(), cargo: f.cargo, fromPlace: f.fromPlace.trim(), toPlace: f.toPlace.trim(), weightKg: f.weightKg, when: new Date(f.when).toISOString(), reqs, objId: f.objId })
  const ok = () => { if (!f.title.trim() || !f.fromPlace.trim() || !f.toPlace.trim() || f.weightKg <= 0) { toast('Fyll inn hva som skal fraktes, fra, til og vekt', 'bad'); return false } return true }
  const ready = !!f.fromPlace && !!f.toPlace && f.weightKg > 0
  const trips = !ready ? [] : s.trips
    .filter(t => t.live && t.companyId !== me.company.id && t.accepts.includes(f.cargo) && t.freeKg >= f.weightKg && new Date(t.departAt).getTime() > Date.now() && (!reqs.includes('loyve') || co(s, t.companyId)?.transport?.permit))
    .map(t => ({ t, d: detourKm(t.from, t.to, f.fromPlace, f.toPlace) })).filter((x): x is { t: Trip; d: number } => x.d != null && x.d <= 90).sort((a, b) => a.d - b.d)
  return (
    <Page title="Send noe" eyebrow="LogM8" right={<TopActions />}
      footer={<Btn kind="blue" icon="send" onClick={() => { if (!ok()) return; const id = createJob(job()); toast('Oppdraget er lagt ut. Transportører kan gi bud.', 'ok'); nav(`/frakt/jobb/${id}`) }}>Legg ut for bud</Btn>}>
      {mine.length > 0 && <Field label="Hent fra parken" hint="Valgfritt"><select value={f.objId ?? ''} onChange={e => { const o = mine.find(x => x.id === e.target.value); if (o) up({ objId: o.id, title: o.name, weightKg: o.weightKg, fromPlace: o.place, cargo: 'Maskiner' }); else up({ objId: undefined }) }}><option value="">Noe annet</option>{mine.map(o => <option key={o.id} value={o.id}>{o.name} · {o.place}</option>)}</select></Field>}
      <Field label="Hva skal fraktes?"><input value={f.title} onChange={e => up({ title: e.target.value })} placeholder="For eksempel «Minigraver 3 t»" /></Field>
      <Field label="Type last"><Seg tone="blue" value={f.cargo} onChange={v => up({ cargo: v })} options={[...CARGO]} /></Field>
      <div className="grid2"><Field label="Fra"><PlaceInput value={f.fromPlace} onChange={v => up({ fromPlace: v })} label="Fra" /></Field><Field label="Til"><PlaceInput value={f.toPlace} onChange={v => up({ toPlace: v })} label="Til" /></Field></div>
      <div className="grid2 r"><Field label="Vekt i kg"><Num value={f.weightKg || null} onChange={v => up({ weightKg: v })} /></Field><Field label="Når"><input type="datetime-local" value={f.when} onChange={e => up({ when: e.target.value })} /></Field></div>
      <Field label="Krav til bilen"><Chips value={reqs} options={(Object.keys(REQ_LABEL) as JobReq[]).map(k => [k, REQ_LABEL[k]] as [JobReq, string])} onChange={v => up({ reqs: v })} /></Field>
      {f.weightKg > 3500 && <p className="hint">Over 3,5 tonn krever løyve. Bare transportører med registrert løyve og godsansvar får gi bud.</p>}
      {f.fromPlace && f.toPlace && <p className="hint">{f.fromPlace} til {f.toPlace}: {kmText(f.fromPlace, f.toPlace)}.</p>}

      {ready && <Section title="Biler som kjører ruten likevel">
        {!trips.length && <p className="hint">Ingen ledige biler passer akkurat nå. Legg ut oppdraget, så kan transportører gi bud.</p>}
        {trips.map(({ t, d }) => { const r = ratingOf(s, t.companyId), price = hitchPrice(t, f.fromPlace, f.toPlace); return (
          <Card key={t.id}>
            <div className="hstack between"><h3>{t.vehicleName}</h3><Pill tone="blue">{d === 0 ? 'Samme rute' : `${d} km omvei`}</Pill></div>
            <p className="muted">{t.from} → {t.to} · {fmtWhen(t.departAt)} · {tonn(t.freeKg)} ledig</p>
            <div className="hstack between"><span>{coName(s, t.companyId)} <Stars value={r.avg} n={r.n} /></span>{co(s, t.companyId)?.transport?.permit && <Pill tone="ok">Løyve</Pill>}</div>
            <Btn kind="blue" onClick={async () => { if (!ok()) return; if (await ask(`Henge på ${t.vehicleName} fra ${coName(s, t.companyId)} for ${kr(price)}?`, 'Heng på')) { const id = bookTrip(job(), t.id); toast('Plassen er bestilt', 'ok'); nav(`/frakt/jobb/${id}`) } }}>Heng på for {kr(price)}</Btn>
          </Card>
        ) })}
      </Section>}
    </Page>
  )
}

function JCard({ j, detour }: { j: FreightJob; detour?: { t: Trip; d: number } | null }) {
  const s = useS(), r = ratingOf(s, j.ownerId)
  return (
    <div className="mcard">
      <div className="mcard-b">
        <div className="hstack between"><Pill tone="blue">{j.cargo}</Pill>{j.tag && <Pill>{j.tag}</Pill>}</div>
        <h2 className="h1">{j.title}</h2>
        <div className="routeline"><b>{j.fromPlace}</b><Icon name="right" size={18} /><b>{j.toPlace}</b></div>
        <div className="tags"><span className="tagbox">{kmText(j.fromPlace, j.toPlace)}</span><span className="tagbox">{tonn(j.weightKg)}</span><span className="tagbox">{fmtWhen(j.when)}</span>{j.reqs.map(q => <span key={q} className="tagbox">{REQ_LABEL[q]}</span>)}</div>
        {detour && <Notice tone="ok" icon="route">Langs turen din {detour.t.from} → {detour.t.to}: {detour.d === 0 ? 'ingen omvei' : `${detour.d} km omvei`}.</Notice>}
        <div className="discreet"><span><Icon name="building" size={16} /></span>{coName(s, j.ownerId)} · {r.avg != null ? `${r.avg.toLocaleString('nb-NO')} av 5` : 'ingen vurderinger'} · {j.bids.length} bud</div>
      </div>
    </div>
  )
}

function BidSheet({ j, onClose, onDone }: { j: FreightJob; onClose: () => void; onDone?: () => void }) {
  const s = useS(), me = useMe()
  const block = bidBlock(s, j, me.company.id)
  const trips = s.trips.filter(t => t.companyId === me.company.id && t.live)
  const [amount, setAmount] = useState(suggest(j))
  const [trip, setTrip] = useState(bestDetour(s, me, j)?.t.id ?? '')
  const pct = s.settings.freightCommissionPct
  return (
    <Sheet title="Gi bud" onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Avbryt</Btn><Btn kind="blue" disabled={!!block} onClick={() => { if (amount <= 0) { toast('Skriv inn et beløp', 'bad'); return } const err = bidJob(j.id, amount, trip || undefined); if (err) { toast(err, 'bad'); return } toast('Budet er sendt', 'ok'); onDone?.(); onClose() }}>Send bud</Btn></>}>
      <p><b>{j.title}</b> · {j.fromPlace} → {j.toPlace} · {tonn(j.weightKg)}</p>
      {block && <Notice tone="bad" icon="lock">{block} <button className="link" onClick={() => { onClose(); nav('/bedrift') }}>Åpne bedriftsprofilen</button></Notice>}
      {!block && j.reqs.includes('loyve') && <Notice tone="ok" icon="shield">Løyve og godsansvar er kontrollert mot bedriftsprofilen din.</Notice>}
      <Field label="Ditt bud i kroner" hint={`Forslag ut fra avstand og vekt: ${kr(suggest(j))}`}><Num value={amount} onChange={setAmount} /></Field>
      {trips.length > 0 && <Field label="Kjøres på turen" hint="Valgfritt. Kunden ser at bilen kjører ruten likevel."><select value={trip} onChange={e => setTrip(e.target.value)}><option value="">Egen tur</option>{trips.map(t => <option key={t.id} value={t.id}>{t.from} → {t.to}, {fmtWhen(t.departAt)}</option>)}</select></Field>}
      <p className="hint">{pct ? `Kommisjon ${pct} %: du får ${kr(amount * (1 - pct / 100))} utbetalt.` : 'Kommisjonssatsen er ikke bestemt, så ingen kommisjon er trukket fra.'}</p>
    </Sheet>
  )
}

export function FraktOppdrag() {
  const s = useS(), me = useMe()
  const hasTrips = s.trips.some(t => t.companyId === me.company.id && t.live)
  const [mode, setMode] = useState<'rute' | 'alle'>(hasTrips ? 'rute' : 'alle')
  const [bid, setBid] = useState<FreightJob | null>(null)
  const passed = s.jobPasses[me.user.id] ?? []
  const open = s.jobs.filter(j => j.status === 'apent' && j.ownerId !== me.company.id && !j.bids.some(b => b.companyId === me.company.id))
    .map(j => ({ j, detour: bestDetour(s, me, j) }))
  const list = (mode === 'rute' ? open.filter(x => x.detour && x.detour.d <= 120).sort((a, b) => a.detour!.d - b.detour!.d) : [...open].sort((a, b) => a.j.when.localeCompare(b.j.when))).filter(x => !passed.includes(x.j.id))
  const top = list[0]
  return (
    <Page title="Oppdrag" eyebrow="LogM8" right={<TopActions />}>
      {!me.company.transport?.permit && <Notice tone="warn" icon="shield">Bedriften har ikke registrert løyve. Du kan gi bud på oppdrag under 3,5 tonn.</Notice>}
      <Seg tone="blue" value={mode} onChange={setMode} options={[['rute', 'Langs ruten'], ['alle', 'Alle oppdrag']]} />
      <div className="deck">
        {top ? <>
          <SwipeCard id={top.j.id} onLeft={() => passJob(top.j.id)} onRight={() => setBid(top.j)}><JCard j={top.j} detour={top.detour} /></SwipeCard>
          <div className="swipe-btns">
            <button className="round" aria-label="Ikke aktuelt" onClick={() => passJob(top.j.id)}><Icon name="close" size={26} /></button>
            <button className="round ink" aria-label="Se detaljer" onClick={() => nav(`/frakt/jobb/${top.j.id}`)}><Icon name="info" size={20} /></button>
            <button className="round blue" aria-label="Gi bud" onClick={() => setBid(top.j)}><Icon name="check" size={28} sw={2.6} /></button>
          </div>
          <p className="hint center">Sveip til høyre for å gi bud, til venstre for å gå videre. {list.length} oppdrag igjen.</p>
        </> : (
          <Empty title={mode === 'rute' ? 'Ingen oppdrag langs ruten' : 'Ingen åpne oppdrag'} text={mode === 'rute' ? (hasTrips ? 'Ingen åpne oppdrag ligger langs turene dine akkurat nå.' : 'Legg inn en ledig tur, så viser vi oppdrag som passer ruten.') : 'Du har sett alle oppdragene.'}>
            {mode === 'rute' && <Btn kind="blue" to="/frakt/tur">Legg inn ledig tur</Btn>}
            {passed.length > 0 && <Btn kind="ghost" onClick={() => resetJobPasses()}>Vis forkastede på nytt</Btn>}
            {mode === 'rute' && <Btn kind="ghost" onClick={() => setMode('alle')}>Se alle oppdrag</Btn>}
          </Empty>
        )}
      </div>
      {bid && <BidSheet j={bid} onClose={() => setBid(null)} />}
    </Page>
  )
}

type TripForm = Omit<Trip, 'id' | 'companyId' | 'userId'> & { id?: string }

export function FraktTur() {
  const s = useS(), me = useMe()
  const mine = s.trips.filter(t => t.companyId === me.company.id)
  const vehicles = s.objects.filter(o => o.companyId === me.company.id && !o.archived && ['Lastebil', 'Varebil', 'Tilhenger'].includes(o.type))
  const blank: TripForm = { vehicleId: vehicles[0]?.id, vehicleName: vehicles[0]?.name ?? '', from: me.company.place, to: '', departAt: localDT(addDays(now(), 1)), freeKg: 5000, accepts: ['Maskiner'], pricePerKm: 22, live: true }
  const [f, setF] = useState<TripForm | null>(null)
  const up = (p: Partial<TripForm>) => setF(x => ({ ...x!, ...p }))
  const fits = (t: Trip) => s.jobs.filter(j => j.status === 'apent' && j.ownerId !== me.company.id && t.accepts.includes(j.cargo) && j.weightKg <= t.freeKg && (detourKm(t.from, t.to, j.fromPlace, j.toPlace) ?? 999) <= 120).length
  const save = () => {
    if (!f) return
    if (!f.vehicleName.trim() || !f.from.trim() || !f.to.trim()) { toast('Fyll inn bil, fra og til', 'bad'); return }
    saveTrip({ ...f, departAt: new Date(f.departAt).toISOString() }); setF(null); toast('Turen er lagret. Kunder langs ruten kan henge seg på.', 'ok')
  }
  return (
    <Page title="Ledig på tur" eyebrow="LogM8" right={<TopActions />} sub="Kjører du likevel, kan andre henge seg på. Du får også forslag til returlast.">
      <Btn kind="blue" icon="plus" onClick={() => setF({ ...blank })}>Ny ledig tur</Btn>
      {!mine.length && <p className="hint">Du har ingen turer ennå.</p>}
      {mine.map(t => { const n = t.live ? fits(t) : 0; return (
        <Card key={t.id}>
          <div className="hstack between"><h3>{t.from} → {t.to}</h3><Pill tone={t.live ? 'blue' : 'mute'}>{t.live ? 'Synlig' : 'Skjult'}</Pill></div>
          <p className="muted">{t.vehicleName} · {fmtWhen(t.departAt)} · {tonn(t.freeKg)} ledig · {kr(t.pricePerKm)} per km</p>
          <div className="tags">{t.accepts.map(a => <span key={a} className="tagbox">{a}</span>)}</div>
          {n > 0 && <Notice tone="ok" icon="route">{n} åpne oppdrag passer denne turen. <a className="link" {...link('/frakt/oppdrag')}>Se oppdragene</a></Notice>}
          <div className="hstack"><Btn kind="quiet" small onClick={() => setF({ ...t, departAt: localDT(t.departAt) })}>Endre</Btn><Btn kind="ghost" small onClick={() => saveTrip({ ...t, live: !t.live })}>{t.live ? 'Skjul' : 'Vis igjen'}</Btn></div>
        </Card>
      ) })}
      {f && (
        <Sheet title={f.id ? 'Endre tur' : 'Ny ledig tur'} onClose={() => setF(null)} footer={<><Btn kind="ghost" onClick={() => setF(null)}>Avbryt</Btn><Btn kind="blue" onClick={save}>Lagre tur</Btn></>}>
          {vehicles.length > 0
            ? <Field label="Bil"><select value={f.vehicleId ?? ''} onChange={e => { const v = vehicles.find(x => x.id === e.target.value); up({ vehicleId: v?.id, vehicleName: v?.name ?? f.vehicleName }) }}>{vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}<option value="">Annen bil</option></select></Field>
            : <Field label="Bil"><input value={f.vehicleName} onChange={e => up({ vehicleName: e.target.value })} placeholder="For eksempel «Lastebil med kran»" /></Field>}
          {vehicles.length > 0 && !f.vehicleId && <Field label="Navn på bilen"><input value={f.vehicleName} onChange={e => up({ vehicleName: e.target.value })} /></Field>}
          <div className="grid2"><Field label="Fra"><PlaceInput value={f.from} onChange={v => up({ from: v })} label="Fra" /></Field><Field label="Til"><PlaceInput value={f.to} onChange={v => up({ to: v })} label="Til" /></Field></div>
          <Field label="Avreise"><input type="datetime-local" value={f.departAt} onChange={e => up({ departAt: e.target.value })} /></Field>
          <div className="grid2"><Field label="Ledig kapasitet, kg"><Num value={f.freeKg} onChange={v => up({ freeKg: v })} /></Field><Field label="Pris per km"><Num value={f.pricePerKm} onChange={v => up({ pricePerKm: v })} /></Field></div>
          <Field label="Tar med"><Chips value={f.accepts} options={[...CARGO]} onChange={v => up({ accepts: v })} /></Field>
          <Toggle on={f.live} onChange={v => up({ live: v })} label="Synlig for kunder" />
        </Sheet>
      )}
    </Page>
  )
}

export function FraktMine() {
  const s = useS(), me = useMe()
  const sending = s.jobs.filter(j => j.ownerId === me.company.id)
  const driving = s.jobs.filter(j => j.bids.find(b => b.id === j.chosenBidId)?.companyId === me.company.id)
  const bidding = s.jobs.filter(j => j.status === 'apent' && j.bids.some(b => b.companyId === me.company.id))
  const row = (j: FreightJob, right: React.ReactNode) => <Row key={j.id} to={`/frakt/jobb/${j.id}`} thumb={<span className="taskicon flytt"><Icon name="truck" size={20} /></span>} title={j.title} sub={`${j.fromPlace} → ${j.toPlace} · ${fmtWhen(j.when)}`} right={right} />
  const pill = (j: FreightJob) => <Pill tone={j.status === 'levert' ? 'ok' : j.status === 'avlyst' ? 'mute' : 'blue'}>{j.status === 'apent' ? `${j.bids.length} bud` : JOB_LABEL[j.status]}</Pill>
  return (
    <Page title="Mine oppdrag" eyebrow="LogM8" right={<TopActions />} wide>
      {!sending.length && !driving.length && !bidding.length && <Empty title="Ingen oppdrag ennå" text="Send noe, eller gi bud på et oppdrag."><Btn kind="blue" to="/frakt/send">Send noe</Btn><Btn kind="ghost" to="/frakt/oppdrag">Se oppdrag</Btn></Empty>}
      {driving.length > 0 && <Section title="Jeg kjører"><div className="cols">{driving.map(j => row(j, pill(j)))}</div></Section>}
      {bidding.length > 0 && <Section title="Bud som venter"><div className="cols">{bidding.map(j => row(j, <b className="num">{kr(j.bids.find(b => b.companyId === me.company.id)!.amount)}</b>))}</div></Section>}
      {sending.length > 0 && <Section title="Jeg sender"><div className="cols">{sending.map(j => row(j, pill(j)))}</div></Section>}
    </Page>
  )
}

export function FraktJobb({ id }: { id: string }) {
  const s = useS(), me = useMe(), j = s.jobs.find(x => x.id === id)
  const [bid, setBid] = useState(false)
  const [photo, setPhoto] = useState<Photo>()
  const [recv, setRecv] = useState('')
  const [sign, setSign] = useState<string>()
  const [stars, setStars] = useState(0)
  if (!j) return <Missing what="oppdraget" />
  const owner = j.ownerId === me.company.id
  const chosen = j.bids.find(b => b.id === j.chosenBidId)
  const carrier = chosen?.companyId === me.company.id
  const myBid = j.bids.find(b => b.companyId === me.company.id)
  if (!owner && !carrier && !myBid && j.status !== 'apent') return <Missing what="oppdraget" />
  const o = ob(s, j.objId), type = o?.type ?? 'Lastebil'
  const pct = s.settings.freightCommissionPct
  const rated = s.ratings.some(r => r.refId === j.id && r.fromCompanyId === me.company.id)
  const bids = [...j.bids].sort((a, b) => a.amount - b.amount)
  const demoUser = owner ? (chosen?.userId ?? (j.reqs.includes('loyve') ? 'per' : 'lars')) : j.ownerUserId
  return (
    <Page title={j.title} eyebrow={`Fraktoppdrag #${j.no}`} back="/frakt/mine" right={<Pill tone={j.status === 'levert' ? 'ok' : j.status === 'avlyst' ? 'mute' : 'blue'}>{JOB_LABEL[j.status]}</Pill>}
      footer={!owner && !carrier && j.status === 'apent' ? <Btn kind="blue" onClick={() => setBid(true)}>{myBid ? `Endre budet (${kr(myBid.amount)})` : 'Gi bud'}</Btn> : undefined}>
      <MiniMap height={220} points={[{ place: j.fromPlace, label: 'Fra' }, { place: j.toPlace, label: 'Til', tone: 'amber' }]} />
      <Card>
        <div className="routeline"><b>{j.fromPlace}</b><Icon name="right" size={18} /><b>{j.toPlace}</b></div>
        <KV rows={[
          ['Last', `${j.cargo}, ${tonn(j.weightKg)}`], ['Når', fmtDT(j.when)], ['Avstand', kmText(j.fromPlace, j.toPlace)], ['Krav', j.reqs.map(q => REQ_LABEL[q]).join(', ') || 'Ingen'],
          ['Kunde', coName(s, j.ownerId)], ...(chosen ? [['Transportør', coName(s, chosen.companyId)] as [string, string], ['Avtalt pris', kr(chosen.amount)] as [string, string]] : []),
          ...(chosen && pct ? [[`Kommisjon ${pct} %`, kr((chosen.amount * pct) / 100)] as [string, string]] : []),
        ]} />
        {j.rentalId && (owner || carrier) && <a className="link" {...link(`/leie/${j.rentalId}`)}>Hører til et leieforhold</a>}
      </Card>

      {owner && j.status === 'apent' && <Section title={`Bud (${bids.length})`}>
        {!bids.length && <p className="hint">Ingen bud ennå. Transportører som kjører ruten, ser oppdraget først.</p>}
        {bids.map(b => { const c = co(s, b.companyId), r = ratingOf(s, b.companyId), t = s.trips.find(x => x.id === b.tripId); return (
          <Card key={b.id}>
            <div className="hstack between"><h3>{c?.name}</h3><b className="num">{kr(b.amount)}</b></div>
            <div className="hstack wrap"><Stars value={r.avg} n={r.n} />{c?.transport?.permit && <Pill tone="ok">Løyve kontrollert</Pill>}{c?.insurance.some(i => i.coverage === 'gods') && <Pill tone="ok">Godsansvar</Pill>}</div>
            {t && <p className="hint">Kjører {t.from} → {t.to} likevel, {fmtWhen(t.departAt)}.</p>}
            <Btn kind="blue" small onClick={() => { chooseBid(j.id, b.id); toast(`${c?.name} har fått oppdraget`, 'ok') }}>Velg dette budet</Btn>
          </Card>
        ) })}
      </Section>}
      {!owner && myBid && j.status === 'apent' && <Notice tone="info" icon="clock">Du har gitt bud på {kr(myBid.amount)}. Kunden velger transportør.</Notice>}

      {carrier && j.status === 'tildelt' && (
        <Section title="Henting">
          <PhotoField photo={photo} onPhoto={setPhoto} type={type} label="Bilde av lasten på bilen" hint="Hele lasten og sikringen skal synes" place={j.fromPlace} />
          <Btn kind="blue" disabled={!photo} onClick={() => { jobPickup(j.id, [photo!]); setPhoto(undefined); toast('Hentingen er bekreftet', 'ok') }}>Bekreft henting</Btn>
        </Section>
      )}
      {carrier && j.status === 'hentet' && (
        <Section title="Levering">
          <PhotoField photo={photo} onPhoto={setPhoto} type={type} label="Bilde ved levering" hint="Lasten på leveringsstedet" place={j.toPlace} />
          <Field label="Mottatt av"><input value={recv} onChange={e => setRecv(e.target.value)} placeholder="Navn på den som tar imot" /></Field>
          <SignaturePad label="Signatur fra mottaker" value={sign} onChange={setSign} />
          <Btn kind="blue" disabled={!photo || !recv.trim() || !sign} onClick={() => { jobDeliver(j.id, [photo!], recv.trim(), sign); toast('Leveringen er bekreftet', 'ok') }}>Bekreft levering</Btn>
        </Section>
      )}

      {(j.pickup || j.delivery) && <Section title="Dokumentasjon">
        <Card>
          <KV rows={[
            ...(j.pickup ? [['Hentet', `${fmtDT(j.pickup.at)} av ${userName(s, j.pickup.by)}`] as [string, string]] : []),
            ...(j.delivery ? [['Levert', fmtDT(j.delivery.at)] as [string, string], ['Mottatt av', j.delivery.receivedBy] as [string, string]] : []),
          ]} />
          <Gallery photos={[...(j.pickup?.photos ?? []), ...(j.delivery?.photos ?? [])]} type={type} />
          {j.delivery?.sign && <div className="sign"><b>Signatur fra mottaker</b><img src={j.delivery.sign} alt="Signatur fra mottaker" className="sign-img" /></div>}
        </Card>
      </Section>}

      {owner && j.status === 'levert' && chosen && !rated && (
        <Card>
          <h2>Gi {coName(s, chosen.companyId)} en vurdering</h2>
          <StarInput value={stars} onChange={setStars} />
          <Btn disabled={!stars} onClick={() => { rateCompany('frakt', j.id, chosen.companyId, stars); toast('Takk for vurderingen', 'ok') }}>Send vurdering</Btn>
        </Card>
      )}
      {owner && (j.status === 'apent' || j.status === 'tildelt') && <Btn kind="ghost" onClick={async () => { if (await ask('Avlyse oppdraget?', 'Avlys', true)) { cancelJob(j.id); toast('Oppdraget er avlyst') } }}>Avlys oppdraget</Btn>}
      {(owner || carrier || myBid) && <DemoSwitch userId={demoUser} to={`/frakt/jobb/${j.id}`} />}
      <p className="hint">Lagt ut {rel(j.createdAt)}.</p>
      {bid && <BidSheet j={j} onClose={() => setBid(false)} />}
    </Page>
  )
}
