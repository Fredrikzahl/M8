import { useEffect, useRef, useState } from 'react'
import type { FormDamage, HandoverForm, Photo, Rental, State } from '../types'
import { AiTag, Btn, Card, Chips, DemoSwitch, Empty, Field, KV, Notice, Page, Pill, Row, Section, Seg, Sheet, StarInput, Thumb, Toggle, ask, toast } from '../ui/kit'
import { DamageSketch, GuidedCamera, SignaturePad } from '../ui/widgets'
import { Icon } from '../ui/icons'
import { link, nav } from '../router'
import { coName, ob, useMe, useS, userName } from '../store'
import {
  addClaim, addTime, answerClaim, answerInspection, approveTime, cancelRental, decideFinding, jobFromRental, lockInspection, payAdvance, rateCompany, saveForm,
  sendInspection, toggleLine,
} from '../actions'
import { daysBetween, fmtDate, fmtDT, fmtPeriod, kr, meterUnit, now, num, RENTAL_LABEL, rentalDays, sum, today, UNIT_LABEL } from '../lib/util'
import { fees, fuelLabel, inspectionTotal, rentAmount, shotsFor, suggestReading } from '../lib/logic'
import { genSrc, getPos, img } from '../lib/images'
import { overlayShape } from '../lib/shapes'
import { canPrint, printPage, saveFile } from '../lib/files'
import { CompanyCard, FeeNote, Gallery, History, Missing, Num, TopActions } from './common'

const tone = (r: Rental) => (r.status === 'avbrutt' ? 'mute' : r.status === 'avsluttet' || r.status === 'oppgjort' ? 'ok' : r.status === 'godkjent' ? 'warn' : 'info')
const party = (s: State, r: Rental, companyId: string) => (r.lessorId === companyId ? 'utleier' : r.lesseeId === companyId ? 'leietaker' : null)
/** En bruker hos motparten, slik at demoen kan vise den andre siden. */
const counterpart = (s: State, r: Rental, side: 'utleier' | 'leietaker') =>
  side === 'utleier' ? s.requests.find(q => q.id === r.requestId)?.fromUserId ?? s.users.find(u => u.memberships.some(m => m.companyId === r.lesseeId))?.id
    : s.users.find(u => u.memberships.some(m => m.companyId === r.lessorId && (m.roles.includes('admin') || m.roles.includes('leder'))))?.id

export function Leieforhold() {
  const s = useS(), me = useMe()
  const mine = s.rentals.filter(r => r.lessorId === me.company.id)
  const live = mine.filter(r => !['avsluttet', 'avbrutt'].includes(r.status))
  const done = mine.filter(r => ['avsluttet', 'avbrutt'].includes(r.status))
  const row = (r: Rental) => { const o = ob(s, r.objId)!; return (
    <Row key={r.id} to={`/leie/${r.id}`} thumb={<Thumb src={o.photos[0]?.src} type={o.type} alt={o.name} />} title={`#${r.no} · ${o.name}`} sub={`${coName(s, r.lesseeId)} · ${fmtPeriod(r.from, r.to)}`} right={<Pill tone={tone(r)}>{RENTAL_LABEL[r.status]}</Pill>} />
  ) }
  return (
    <Page title="Leieforhold" eyebrow="SaleM8 · utleier" right={<TopActions />} wide>
      {!mine.length && <Empty title="Ingen leieforhold" text="Når du godkjenner en forespørsel om leie, opprettes leieforholdet her."><Btn to="/foresporsler">Se forespørsler</Btn></Empty>}
      {live.length > 0 && <Section title="Pågår"><div className="cols">{live.map(row)}</div></Section>}
      {done.length > 0 && <Section title="Avsluttet"><div className="cols">{done.map(row)}</div></Section>}
    </Page>
  )
}

export function Leie({ id }: { id: string }) {
  const s = useS(), me = useMe(), r = s.rentals.find(x => x.id === id)
  const [pay, setPay] = useState(false)
  const [claim, setClaim] = useState<null | 'skade' | 'kompensasjon'>(null)
  const [ct, setCt] = useState({ text: '', amount: 0 })
  const [stars, setStars] = useState(0)
  const [rtext, setRtext] = useState('')
  const side = r ? party(s, r, me.company.id) : null
  if (!r || !side) return <Missing what="leieforholdet" />
  const o = ob(s, r.objId)!, lessor = side === 'utleier', otherId = lessor ? r.lesseeId : r.lessorId
  const rent = rentAmount(r), days = rentalDays(r.from, r.to)
  const cur = { godkjent: 2, forskudd: 3, utlevert: 4, returnert: 6, kontroll: 6, oppgjort: 7, avsluttet: 8, avbrutt: 0 }[r.status]
  const jobs = s.jobs.filter(j => j.rentalId === r.id && j.status !== 'avlyst')
  const total = inspectionTotal(r.inspection)
  const rated = s.ratings.some(x => x.refId === r.id && x.fromCompanyId === me.company.id)
  const other = counterpart(s, r, side)
  const hours = sum(r.timesheet.map(e => e.hours))
  const order = (leg: 'utlevering' | 'retur') => { const jid = jobFromRental(r.id, leg); toast('Fraktoppdraget er lagt ut for bud', 'ok'); nav(`/frakt/jobb/${jid}`) }
  const step = (n: number, title: string, sub: string, body?: React.ReactNode) => (
    <div className={'tl-step ' + (r.status === 'avbrutt' ? 'todo' : n < cur ? 'done' : n === cur ? 'cur' : 'todo')}>
      <span className="tl-dot">{n < cur && r.status !== 'avbrutt' ? <Icon name="check" size={14} sw={3} /> : n}</span>
      <div className="tl-body"><div><h3>{title}</h3><p>{sub}</p></div>{body}</div>
    </div>
  )
  return (
    <Page title={o.name} eyebrow={`Leieforhold #${r.no}`} back={lessor ? '/leieforhold' : '/mine'} right={<Pill tone={tone(r)}>{RENTAL_LABEL[r.status]}</Pill>}>
      <Card>
        <Row to={lessor ? `/objekt/${o.id}` : `/maskin/${r.listingId}`} thumb={<Thumb src={o.photos[0]?.src} type={o.type} alt={o.name} className="lg" />} title={o.name} sub={`${o.internalId} · ${o.place}`} />
        <KV rows={[
          [lessor ? 'Leietaker' : 'Utleier', coName(s, otherId)], ['Periode', `${fmtPeriod(r.from, r.to)} (${days} dager)`], ['Pris', `${kr(r.price)} ${UNIT_LABEL[r.unit]}`],
          ['Leie for perioden', kr(rent)], ...(r.withDriver ? [['Fører', `${r.driverId ? userName(s, r.driverId) : 'Avtales'}, ${kr(r.driverRate ?? 0)}/t`] as [string, string]] : []),
        ]} />
      </Card>
      {r.status === 'avbrutt' && <Notice tone="plain" icon="info">Leieforholdet ble avbrutt.{r.advance.refundedAt ? ' Forskuddet er tilbakebetalt.' : ''}</Notice>}

      <div className="timeline">
        {step(1, 'Forespørsel godkjent', `Utleier godkjente ${fmtDate(r.createdAt)}`)}
        {step(2, 'Forskudd', r.advance.paidAt ? `${kr(r.advance.amount)} betalt ${fmtDate(r.advance.paidAt)}${r.advance.refundedAt ? ', tilbakebetalt' : r.advance.releasedAt ? ', utbetalt til utleier' : ', holdes til utlevering'}` : `${kr(r.advance.amount)} (${r.terms.advancePct} % av leien)`,
          r.status === 'godkjent' && (lessor ? <p className="hint">Venter på at leietaker betaler forskuddet.</p> : <Btn kind="amber" icon="money" onClick={() => setPay(true)}>Betal forskudd {kr(r.advance.amount)}</Btn>))}
        {step(3, 'Utlevering', r.handover ? `Utlevert ${fmtDT(r.handover.completedAt)} med ${r.handover.photos.length} bilder og signatur` : 'Skjema med bilder, måler og signatur fra begge parter',
          <>
            {r.status === 'forskudd' && <Btn kind="amber" icon="camera" to={`/leie/${r.id}/utlevering`}>Start utlevering</Btn>}
            {r.status === 'forskudd' && !jobs.length && <Btn kind="quiet" small icon="truck" onClick={() => order('utlevering')}>Bestill frakt til leietaker</Btn>}
            {r.handover && <a className="link" {...link(`/leie/${r.id}/utlevering`)}>Se utleveringsskjemaet</a>}
          </>)}
        {step(4, 'I leie', r.status === 'utlevert' ? (daysBetween(today(), r.to) >= 0 ? `${daysBetween(today(), r.to)} dager igjen` : `Skulle vært levert ${fmtDate(r.to)}`) : r.ret ? `${days} dager` : 'Fra utlevering til retur',
          r.status === 'utlevert' && <>
            {r.withDriver && <Btn kind="quiet" small icon="clock" to={`/leie/${r.id}/timer`}>Timer for fører · {num(hours)} t ført</Btn>}
            <div className="hstack wrap">
              <Btn kind="ghost" small icon="warn" onClick={() => { setCt({ text: '', amount: 0 }); setClaim('skade') }}>Meld skade</Btn>
              {!lessor && <Btn kind="ghost" small onClick={() => { setCt({ text: '', amount: 0 }); setClaim('kompensasjon') }}>Be om kompensasjon</Btn>}
            </div>
          </>)}
        {step(5, 'Retur', r.ret ? `Returnert ${fmtDT(r.ret.completedAt)} med ${r.ret.photos.length} bilder og signatur` : 'Samme bilder som ved utlevering, slik at de kan sammenlignes',
          <>
            {r.status === 'utlevert' && <Btn kind="amber" icon="camera" to={`/leie/${r.id}/retur`}>Start retur</Btn>}
            {r.status === 'utlevert' && jobs.length < 2 && <Btn kind="quiet" small icon="truck" onClick={() => order('retur')}>Bestill returfrakt</Btn>}
            {r.ret && <a className="link" {...link(`/leie/${r.id}/retur`)}>Se returskjemaet</a>}
          </>)}
        {step(6, 'Mottakskontroll', r.inspection?.lockedAt ? `Låst ${fmtDate(r.inspection.lockedAt)} av ${r.inspection.lockedBy}` : r.inspection?.sentAt ? (r.inspection.lesseeStatus ? `Leietaker har ${r.inspection.lesseeStatus === 'godkjent' ? 'godkjent' : 'kommentert'}` : 'Sendt til leietaker') : 'Avtalt mot målt, linje for linje',
          r.inspection && <Btn kind={cur === 6 ? 'amber' : 'quiet'} small={cur !== 6} icon="file" to={`/leie/${r.id}/kontroll`}>{r.inspection.lockedAt ? 'Se mottakskontrollen' : lessor ? 'Åpne mottakskontrollen' : r.inspection.sentAt ? 'Se og svar på mottakskontrollen' : 'Utleier går gjennom returen'}</Btn>)}
        {step(7, 'Oppgjør og vurdering', r.inspection?.lockedAt ? `Sum ${kr(total)}, forskudd ${kr(r.advance.amount)} trukket fra` : 'Faktureres etter låst mottakskontroll',
          r.inspection?.lockedAt && <>
            <KV rows={[['Til fakturering', kr(total - r.advance.amount)], ...(lessor ? [['Utbetalt etter gebyr', kr(fees(s.settings.feeModel, total).lessorGets)] as [string, string]] : [['Du betaler totalt', kr(fees(s.settings.feeModel, total).lesseePays)] as [string, string]])]} />
            <FeeNote amount={total} side={side} />
            {!rated ? (
              <Card className="tight">
                <h3>Gi {coName(s, otherId)} en vurdering</h3>
                <StarInput value={stars} onChange={setStars} />
                <input value={rtext} onChange={e => setRtext(e.target.value)} placeholder="Kort kommentar (valgfritt)" aria-label="Kommentar" />
                <Btn disabled={!stars} onClick={() => { rateCompany('leie', r.id, otherId, stars, rtext.trim() || undefined); toast('Takk for vurderingen', 'ok') }}>Send vurdering</Btn>
              </Card>
            ) : <p className="hint">Du har gitt vurdering.{r.status === 'oppgjort' ? ' Leieforholdet avsluttes når motparten også har gitt sin.' : ''}</p>}
          </>)}
      </div>

      {jobs.length > 0 && <Section title="Frakt">{jobs.map(j => <Row key={j.id} to={`/frakt/jobb/${j.id}`} thumb={<span className="taskicon flytt"><Icon name="truck" size={20} /></span>} title={`${j.fromPlace} → ${j.toPlace}`} sub={`Oppdrag #${j.no}`} right={<Pill tone={j.status === 'levert' ? 'ok' : 'blue'}>{{ apent: `${j.bids.length} bud`, tildelt: 'Tildelt', hentet: 'Hentet', levert: 'Levert', avlyst: 'Avlyst' }[j.status]}</Pill>} />)}</Section>}

      {r.claims.length > 0 && <Section title="Skader og krav">
        {r.claims.map(c => (
          <Card key={c.id} className="tight">
            <div className="hstack between"><b>{c.type === 'skade' ? 'Skade meldt' : 'Krav om kompensasjon'} av {c.byCompanyId === me.company.id ? 'deg' : coName(s, c.byCompanyId)}</b><Pill tone={c.status === 'godtatt' ? 'ok' : c.status === 'bestridt' ? 'bad' : 'warn'}>{{ sendt: 'Venter på svar', godtatt: 'Godtatt', bestridt: 'Bestridt' }[c.status]}</Pill></div>
            <p>{c.text}{c.amount ? ` · ${kr(c.amount)}` : ''}</p>
            {c.status === 'sendt' && c.byCompanyId !== me.company.id && <div className="hstack"><Btn kind="quiet" small onClick={() => answerClaim(r.id, c.id, true)}>Godta</Btn><Btn kind="ghost" small onClick={() => answerClaim(r.id, c.id, false)}>Bestrid</Btn></div>}
          </Card>
        ))}
      </Section>}

      <CompanyCard id={otherId} title={lessor ? 'Leietaker' : 'Utleier'} />
      {other && <DemoSwitch userId={other} to={`/leie/${r.id}`} />}
      <Section title="Logg"><History events={[...r.log].reverse()} /></Section>
      {(r.status === 'godkjent' || r.status === 'forskudd') && <Btn kind="ghost" onClick={async () => { if (await ask(r.advance.paidAt ? 'Avbryte leieforholdet? Forskuddet betales tilbake.' : 'Avbryte leieforholdet?', 'Avbryt leieforholdet', true)) { cancelRental(r.id); toast('Leieforholdet er avbrutt') } }}>Avbryt leieforholdet</Btn>}

      {pay && (
        <Sheet title="Betal forskudd" onClose={() => setPay(false)} footer={<><Btn kind="ghost" onClick={() => setPay(false)}>Avbryt</Btn><Btn kind="amber" onClick={() => { payAdvance(r.id); setPay(false); toast('Forskuddet er betalt. Utleier får beskjed.', 'ok') }}>Betal {kr(r.advance.amount)}</Btn></>}>
          <KV rows={[['Leie for perioden', kr(rent)], [`Forskudd ${r.terms.advancePct} %`, kr(r.advance.amount)]]} />
          <Notice tone="plain" icon="lock">Forskuddet holdes av betalingspartneren til utleveringen er bekreftet med bilder og signatur. Avbrytes leien før det, får du pengene tilbake.</Notice>
          <Notice tone="warn" icon="info">Betalingen er simulert i denne versjonen. Ingen penger flyttes.</Notice>
        </Sheet>
      )}
      {claim && (
        <Sheet title={claim === 'skade' ? 'Meld skade' : 'Be om kompensasjon'} onClose={() => setClaim(null)} footer={<><Btn kind="ghost" onClick={() => setClaim(null)}>Avbryt</Btn><Btn onClick={() => { if (!ct.text.trim()) { toast('Beskriv hva det gjelder', 'bad'); return } addClaim(r.id, claim, ct.text.trim(), ct.amount || undefined); setClaim(null); toast('Sendt til motparten', 'ok') }}>Send</Btn></>}>
          <p className="hint">{claim === 'skade' ? 'Meld fra med en gang noe skjer, så blir oppgjøret ryddig.' : 'For eksempel ved driftsstans som skyldes maskinen.'}</p>
          <Field label="Hva har skjedd?"><textarea value={ct.text} onChange={e => setCt({ ...ct, text: e.target.value })} /></Field>
          <Field label="Beløp" hint="Valgfritt"><Num value={ct.amount || null} onChange={v => setCt({ ...ct, amount: v })} /></Field>
        </Sheet>
      )}
    </Page>
  )
}

// ---------- Utleverings- og returskjema ----------
export function Skjema({ id, kind }: { id: string; kind: 'utlevering' | 'retur' }) {
  const s = useS(), me = useMe(), r = s.rentals.find(x => x.id === id)
  if (!r || !party(s, r, me.company.id)) return <Missing what="leieforholdet" />
  const done = kind === 'utlevering' ? r.handover : r.ret
  if (done) return <SkjemaView r={r} f={done} />
  if ((kind === 'utlevering' && r.status !== 'forskudd') || (kind === 'retur' && r.status !== 'utlevert')) {
    return <Page title={kind === 'utlevering' ? 'Utlevering' : 'Retur'} back={`/leie/${id}`}><Empty title="Ikke klart ennå" text={kind === 'utlevering' ? 'Utleveringen kan starte når forskuddet er betalt.' : 'Returen kan starte når objektet er utlevert.'}><Btn to={`/leie/${id}`}>Til leieforholdet</Btn></Empty></Page>
  }
  return <SkjemaEdit r={r} kind={kind} />
}

function SkjemaView({ r, f }: { r: Rental; f: HandoverForm }) {
  const s = useS(), o = ob(s, r.objId)!
  return (
    <Page title={f.kind === 'utlevering' ? 'Utleveringsskjema' : 'Returskjema'} eyebrow={`Leieforhold #${r.no} · ${o.name}`} back={`/leie/${r.id}`}>
      <Notice tone="ok" icon="lock">Fullført {fmtDT(f.completedAt)}. Skjemaet er låst og kan ikke endres.</Notice>
      <Card><KV rows={[
        ['Sted', f.place], [o.meter === 'timer' ? 'Timer' : 'Kilometer', <span key="r">{num(f.reading)} {meterUnit(o.meter)} {f.readingAi && <AiTag text="Lest av bilde" />}</span>], ['Drivstoff', fuelLabel(f.fuel)], ['Dekk eller belter', `${f.tireMm} mm`],
        ['Utstyr', f.tools.join(', ') || 'Ingen'], ['Nøkler', f.keys], ['Papirer', f.papers ? 'Ja' : 'Nei'], ['Levert av', f.deliveredBy], ['Mottatt av', f.receivedBy],
      ]} /></Card>
      <Section title={`Bilder (${f.photos.length})`}><Gallery photos={f.photos} type={o.type} /></Section>
      <Section title="Skader"><DamageSketch type={o.type} damages={f.damages} readOnly />{!f.damages.length && <p className="hint">Ingen skader merket.</p>}</Section>
      <Section title="Signaturer">
        <div className="grid2">
          {[['Utleier', f.signLessor], ['Leietaker', f.signLessee]].map(([l, v]) => <div key={l} className="sign"><b>{l}</b>{v ? <img src={v} alt={`Signatur ${l}`} className="sign-img" /> : <p className="hint">Mangler</p>}</div>)}
        </div>
      </Section>
    </Page>
  )
}

function SkjemaEdit({ r, kind }: { r: Rental; kind: 'utlevering' | 'retur' }) {
  const s = useS(), me = useMe(), o = ob(s, r.objId)!
  const shots = shotsFor(o.type), out = r.handover
  const lessorName = me.company.id === r.lessorId ? me.user.name : userName(s, counterpart(s, r, 'leietaker'))
  const lesseeName = me.company.id === r.lesseeId ? me.user.name : userName(s, counterpart(s, r, 'utleier'))
  const [photos, setPhotos] = useState<Record<string, Photo | undefined>>({})
  const [cam, setCam] = useState(false)
  const [f, setF] = useState({
    reading: kind === 'retur' ? out!.reading : o.reading, fuel: kind === 'retur' ? out!.fuel : 4, tireMm: kind === 'retur' ? out!.tireMm : 14, tools: kind === 'retur' ? out!.tools : o.attachments.slice(0, 1),
    keys: kind === 'retur' ? out!.keys : 2, papers: true, deliveredBy: kind === 'utlevering' ? lessorName : lesseeName, receivedBy: kind === 'utlevering' ? lesseeName : lessorName, readingAi: false,
  })
  const [damages, setDamages] = useState<FormDamage[]>(kind === 'retur' ? out!.damages.map(d => ({ ...d, isNew: false })) : [])
  const [signLessor, setSignLessor] = useState<string>()
  const [signLessee, setSignLessee] = useState<string>()
  const pos = useRef<{ lat: number; lon: number }>(undefined)
  useEffect(() => { getPos().then(p => { pos.current = p }) }, [])
  const up = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }))
  const missing = shots.filter(x => x.required && !photos[x.key])
  const sugg = suggestReading(o, kind, r)
  const fuelSugg = kind === 'utlevering' ? 4 : Math.max(0, out!.fuel - 1)
  const demoAll = () => setPhotos(p => { const n = { ...p }; for (const x of missing) n[x.key] = { id: 'ph' + x.key + Date.now(), src: genSrc(o.type, overlayShape(o.type, x.overlay), x.label), angle: x.label, at: now(), place: o.place, pos: pos.current, source: 'demo' }; return n })
  const save = () => {
    if (missing.length) { toast(`Mangler ${missing.length} bilder: ${missing.map(m => m.label).join(', ')}`, 'bad'); return }
    if (f.reading < (kind === 'retur' ? out!.reading : o.reading)) { toast('Måleren viser mindre enn sist. Sjekk tallet.', 'bad'); return }
    if (!signLessor || !signLessee) { toast('Begge parter må signere', 'bad'); return }
    saveForm(r.id, { kind, at: now(), place: o.place, pos: pos.current, ...f, damages, photos: shots.map(x => photos[x.key]).filter((p): p is Photo => !!p), signLessor, signLessee })
    toast(kind === 'utlevering' ? 'Utleveringen er bekreftet. Forskuddet utbetales til utleier.' : 'Returen er registrert. Mottakskontrollen er klar.', 'ok')
    nav(kind === 'retur' && me.company.id === r.lessorId ? `/leie/${r.id}/kontroll` : `/leie/${r.id}`, true)
  }
  return (
    <Page title={kind === 'utlevering' ? 'Utlevering' : 'Retur'} eyebrow={`Leieforhold #${r.no} · ${o.name}`} back={`/leie/${r.id}`} sub="Fylles ut sammen ved maskinen. Begge signerer til slutt."
      footer={<Btn kind="amber" icon="check" onClick={save}>{kind === 'utlevering' ? 'Bekreft utlevering' : 'Bekreft retur'}</Btn>}>
      <Section title={`1. Bilder · ${shots.filter(x => photos[x.key]).length} av ${shots.length}`} right={missing.length > 0 ? <Pill tone="warn">{missing.length} mangler</Pill> : <Pill tone="ok">Alle påkrevde tatt</Pill>}>
        <div className="shots">
          {shots.map(x => { const p = photos[x.key]; return (
            <button key={x.key} className={'shotbox' + (p ? '' : ' missing') + (x.required ? ' req' : '')} onClick={() => setCam(true)} aria-label={`${x.label}${p ? ', tatt' : ', mangler'}`}>
              {p ? <img src={img(p.src)} alt={x.label} /> : <Icon name="camera" size={22} />}<span>{x.label}{!x.required && ' (valgfritt)'}</span>
            </button>
          ) })}
        </div>
        <div className="hstack wrap"><Btn kind="primary" small icon="camera" onClick={() => setCam(true)}>Åpne kameraet</Btn>{missing.length > 0 && <Btn kind="ghost" small onClick={demoAll}>Fyll ut med demobilder</Btn>}</div>
        <p className="hint">Kameraet viser et omriss for hvert bilde, slik at vinklene blir like ved utlevering og retur. Tid og posisjon lagres.</p>
      </Section>

      <Section title="2. Måler og drivstoff">
        <Card>
          <Field label={o.meter === 'timer' ? 'Timeteller' : 'Kilometerteller'} hint={kind === 'retur' ? `Ved utlevering: ${num(out!.reading)} ${meterUnit(o.meter)}` : undefined} row><Num value={f.reading} onChange={v => up({ reading: v, readingAi: false })} /></Field>
          {photos.teller && f.reading !== sugg && <div className="hstack between"><span className="hstack" style={{ gap: 6 }}><AiTag />leser {num(sugg)} {meterUnit(o.meter)} av bildet</span><Btn kind="quiet" small onClick={() => up({ reading: sugg, readingAi: true })}>Bruk tallet</Btn></div>}
          {f.readingAi && <p className="hint">Tallet er hentet fra bildet og bekreftet av deg.</p>}
          <Field label="Drivstoff"><Seg value={String(f.fuel)} onChange={v => up({ fuel: Number(v) })} options={[0, 1, 2, 3, 4].map(n => [String(n), fuelLabel(n)] as [string, string])} /></Field>
          {photos.drivstoff && f.fuel !== fuelSugg && <div className="hstack between"><span className="hstack" style={{ gap: 6 }}><AiTag />leser {fuelLabel(fuelSugg).toLowerCase()} tank av bildet</span><Btn kind="quiet" small onClick={() => up({ fuel: fuelSugg })}>Bruk</Btn></div>}
          <Field label="Dekk eller belter, mm mønster" hint={kind === 'retur' ? `Ved utlevering: ${out!.tireMm} mm` : undefined} row><Num value={f.tireMm} onChange={v => up({ tireMm: v })} /></Field>
        </Card>
      </Section>

      <Section title="3. Utstyr som følger med">
        <Card>
          {o.attachments.length > 0 ? <Chips value={f.tools} options={o.attachments} onChange={v => up({ tools: v })} /> : <p className="hint">Objektet har ikke registrert redskap.</p>}
          <Field label="Antall nøkler" row><Num value={f.keys} onChange={v => up({ keys: Math.round(v) })} /></Field>
          <Toggle on={f.papers} onChange={v => up({ papers: v })} label="Papirer og instruksjonsbok følger med" />
        </Card>
      </Section>

      <Section title={kind === 'retur' ? '4. Nye skader' : '4. Skader ved utlevering'}>
        <DamageSketch type={o.type} damages={damages} onChange={setDamages} isNew={kind === 'retur'} />
        {kind === 'retur' && <p className="hint">Skader fra utleveringen vises i hvitt. Nye skader merkes i rødt og tas med i mottakskontrollen.</p>}
      </Section>

      <Section title="5. Signaturer">
        <Card>
          <div className="grid2"><Field label="Levert av"><input value={f.deliveredBy} onChange={e => up({ deliveredBy: e.target.value })} /></Field><Field label="Mottatt av"><input value={f.receivedBy} onChange={e => up({ receivedBy: e.target.value })} /></Field></div>
          <SignaturePad label={`Utleier, ${coName(s, r.lessorId)}`} value={signLessor} onChange={setSignLessor} />
          <SignaturePad label={`Leietaker, ${coName(s, r.lesseeId)}`} value={signLessee} onChange={setSignLessee} />
        </Card>
      </Section>
      {cam && <GuidedCamera title={kind === 'utlevering' ? 'Utlevering' : 'Retur'} type={o.type} place={o.place} shots={shots} photos={photos} onPhoto={(k, p) => setPhotos(x => ({ ...x, [k]: p }))} onClose={() => setCam(false)} />}
    </Page>
  )
}

// ---------- Mottakskontroll ----------
function docHtml(s: State, r: Rental) {
  const o = ob(s, r.objId)!, i = r.inspection!, total = inspectionTotal(i)
  const esc = (t: string) => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
  const rows = i.lines.filter(l => l.on).map(l => `<tr><td>${esc(l.label)}</td><td>${esc(l.measured)}</td><td style="text-align:right">${kr(l.amount)}</td></tr>`).join('')
  return `<!doctype html><html lang="nb"><meta charset="utf-8"><title>Mottakskontroll ${r.no}</title><style>body{font-family:Arial,sans-serif;max-width:720px;margin:40px auto;color:#13201B}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}h1{font-size:24px}</style>
<h1>Mottakskontroll, leieforhold #${r.no}</h1><p>${esc(o.name)} (${esc(o.internalId)})<br>Utleier: ${esc(coName(s, r.lessorId))}<br>Leietaker: ${esc(coName(s, r.lesseeId))}<br>Periode: ${fmtDate(r.from, true)} til ${fmtDate(r.to, true)}</p>
<table><tr><th>Linje</th><th>Grunnlag</th><th style="text-align:right">Beløp</th></tr>${rows}<tr><th colspan="2">Sum</th><th style="text-align:right">${kr(total)}</th></tr><tr><td colspan="2">Forskudd betalt</td><td style="text-align:right">- ${kr(r.advance.amount)}</td></tr><tr><th colspan="2">Til fakturering</th><th style="text-align:right">${kr(total - r.advance.amount)}</th></tr></table>
<p>Funn: ${i.findings.map(f => `${esc(f.text)} (${f.status})`).join('; ') || 'ingen'}</p>
<p>Leietaker: ${i.lesseeStatus === 'godkjent' ? 'godkjent' : i.lesseeStatus === 'kommentert' ? 'kommentert: ' + esc(i.lesseeComment ?? '') : 'ikke besvart'}<br>Låst ${i.lockedAt ? fmtDT(i.lockedAt) : ''} av ${esc(i.lockedBy ?? '')}</p></html>`
}

export function Kontroll({ id }: { id: string }) {
  const s = useS(), me = useMe(), r = s.rentals.find(x => x.id === id)
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [comment, setComment] = useState<string | null>(null)
  const side = r ? party(s, r, me.company.id) : null
  if (!r || !side) return <Missing what="leieforholdet" />
  const o = ob(s, r.objId)!, i = r.inspection
  if (!i) return <Page title="Mottakskontroll" back={`/leie/${id}`}><Empty title="Ikke klart ennå" text="Mottakskontrollen opprettes automatisk når returen er registrert."><Btn to={`/leie/${id}`}>Til leieforholdet</Btn></Empty></Page>
  const lessor = side === 'utleier', locked = !!i.lockedAt, canEdit = lessor && !locked
  const total = inspectionTotal(i), open = i.findings.filter(f => f.status === 'mulig').length
  const other = counterpart(s, r, side)
  const shot = (form: HandoverForm | undefined, angle: string) => form?.photos.find(p => p.angle === angle) ?? form?.photos[1] ?? form?.photos[0]
  const footer = locked ? <>
    {canPrint() && <Btn kind="ghost" onClick={printPage}>Skriv ut</Btn>}
    <Btn icon="download" onClick={async () => { const res = await saveFile(`mottakskontroll-${r.no}.html`, docHtml(s, r), 'text/html'); toast(res === 'lagret' ? 'Dokumentet er lagret' : 'Kunne ikke lagre fila her', res === 'lagret' ? 'ok' : 'bad') }}>Last ned</Btn>
  </> : lessor ? (!i.sentAt || i.lesseeStatus === 'kommentert'
    ? <Btn kind="amber" icon="send" disabled={open > 0} onClick={() => { sendInspection(r.id); toast('Sendt til leietaker for godkjenning', 'ok') }}>{open > 0 ? `Vurder ${open} funn først` : i.sentAt ? 'Send på nytt til leietaker' : 'Send til leietaker'}</Btn>
    : <Btn kind="amber" icon="lock" onClick={async () => { if (i.lesseeStatus === 'godkjent' || await ask('Leietaker har ikke svart ennå. Vil du låse mottakskontrollen likevel?', 'Lås')) { lockInspection(r.id); toast('Mottakskontrollen er låst og klar for fakturering', 'ok') } }}>Lås mottakskontrollen</Btn>)
    : i.sentAt && !i.lesseeStatus ? <><Btn kind="ghost" onClick={() => setComment('')}>Kommenter</Btn><Btn kind="amber" icon="check" onClick={() => { answerInspection(r.id, true); toast('Du har godkjent mottakskontrollen', 'ok') }}>Godkjenn</Btn></> : undefined
  return (
    <Page title="Mottakskontroll" eyebrow={`Leieforhold #${r.no}`} back={`/leie/${id}`} footer={footer}>
      {locked ? <Notice tone="ok" icon="lock">Låst {fmtDT(i.lockedAt)} av {i.lockedBy}. Dokumentet kan ikke endres.</Notice>
        : lessor ? <Notice tone="info" icon="info">{!i.sentAt ? 'Gå gjennom funnene og linjene, og send kontrollen til leietaker.' : i.lesseeStatus === 'godkjent' ? 'Leietaker har godkjent. Du kan låse.' : i.lesseeStatus === 'kommentert' ? `Leietaker har kommentert: «${i.lesseeComment}»` : 'Sendt til leietaker. Venter på svar.'}</Notice>
          : <Notice tone="info" icon="info">{!i.sentAt ? 'Utleier går gjennom returen. Du får varsel når kontrollen er klar.' : i.lesseeStatus ? `Du har ${i.lesseeStatus === 'godkjent' ? 'godkjent' : 'kommentert'}. Utleier låser kontrollen.` : 'Se over linjene. Godkjenn, eller skriv en kommentar hvis noe ikke stemmer.'}</Notice>}
      <div className="doc">
        <div className="hstack between"><div><h2 className="h1">Mottakskontroll</h2><p className="muted">{o.name} · {o.internalId}</p></div><Pill tone={locked ? 'ok' : 'warn'}>{locked ? 'Låst' : 'Utkast'}</Pill></div>
        <KV rows={[['Utleier', coName(s, r.lessorId)], ['Leietaker', coName(s, r.lesseeId)], ['Periode', fmtPeriod(r.from, r.to)], [o.meter === 'timer' ? 'Timer' : 'Kilometer', `${num(r.handover!.reading)} → ${num(r.ret!.reading)} ${meterUnit(o.meter)}`], ['Drivstoff', `${fuelLabel(r.handover!.fuel)} → ${fuelLabel(r.ret!.fuel)}`]]} />

        {i.findings.length > 0 && <div className="stack">
          <div className="hstack between"><h2>Sammenligning av bilder</h2><AiTag /></div>
          {i.findings.map(f => { const a = shot(r.handover, f.angle), b = shot(r.ret, f.angle); return (
            <div key={f.id} className="stack s">
              <div className="cmp">
                <div>{a && <img src={img(a.src)} alt="Ved utlevering" />}<span><Pill tone="glass">Utlevering</Pill></span></div>
                <div>{b && <img src={img(b.src)} alt="Ved retur" />}<span><Pill tone="glass">Retur</Pill></span>{f.status !== 'avvist' && <i />}</div>
              </div>
              <div className="hstack between"><b>{f.text}</b><Pill tone={f.status === 'bekreftet' ? 'bad' : f.status === 'avvist' ? 'mute' : 'warn'}>{{ mulig: 'Må vurderes', bekreftet: 'Bekreftet', avvist: 'Avvist' }[f.status]}</Pill></div>
              <p className="hint">{f.angle}. Funnet er et forslag. Et menneske bekrefter eller avviser før det får følger.</p>
              {canEdit && f.status === 'mulig' && (
                <div className="hstack wrap">
                  <div style={{ width: 130 }}><Num value={amounts[f.id] ?? null} placeholder="Beløp kr" label="Beløp for utbedring" onChange={v => setAmounts(x => ({ ...x, [f.id]: v }))} /></div>
                  <Btn kind="primary" small onClick={() => decideFinding(r.id, f.id, true, amounts[f.id] ?? 0)}>Bekreft skade</Btn>
                  <Btn kind="ghost" small onClick={() => decideFinding(r.id, f.id, false)}>Avvis</Btn>
                </div>
              )}
            </div>
          ) })}
        </div>}

        <div className="lines">
          <div className="line head"><span>Avtalt og målt</span><span className="m">Grunnlag</span><span className="v">Beløp</span></div>
          {i.lines.map(l => (
            <div key={l.id} className={'line' + (l.on ? '' : ' off')}>
              <label><input type="checkbox" checked={l.on} disabled={!canEdit} onChange={() => toggleLine(r.id, l.id)} /><span>{l.label} {l.kind === 'malt' && <small>målt</small>}</span></label>
              <span className="m">{l.measured}</span><span className="v">{kr(l.amount)}</span>
            </div>
          ))}
          <div className="line total"><span>Sum</span><span /><span className="v">{kr(total)}</span></div>
        </div>
        <KV rows={[['Forskudd betalt', `− ${kr(r.advance.amount)}`], ['Til fakturering', kr(total - r.advance.amount)]]} />
        <FeeNote amount={total} side={side} />
        {i.lesseeStatus && <p className="hint">Leietaker: {i.lesseeStatus === 'godkjent' ? 'godkjent' : `kommentert: «${i.lesseeComment}»`}</p>}
      </div>
      {canEdit && <p className="hint">Hak av linjene som skal med. Linjer uten hake faktureres ikke.</p>}
      {other && <DemoSwitch userId={other} to={`/leie/${r.id}/kontroll`} />}
      {comment != null && (
        <Sheet title="Kommenter mottakskontrollen" onClose={() => setComment(null)} footer={<><Btn kind="ghost" onClick={() => setComment(null)}>Avbryt</Btn><Btn onClick={() => { if (!comment.trim()) { toast('Skriv hva som ikke stemmer', 'bad'); return } answerInspection(r.id, false, comment.trim()); setComment(null); toast('Kommentaren er sendt til utleier', 'ok') }}>Send kommentar</Btn></>}>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Hva stemmer ikke?" aria-label="Kommentar" autoFocus />
        </Sheet>
      )}
    </Page>
  )
}

export function Timer({ id }: { id: string }) {
  const s = useS(), me = useMe(), r = s.rentals.find(x => x.id === id)
  const [f, setF] = useState({ date: today(), hours: 7.5, note: '' })
  const side = r ? party(s, r, me.company.id) : null
  if (!r || !side) return <Missing what="leieforholdet" />
  const lessor = side === 'utleier', open = r.status === 'utlevert'
  const approved = sum(r.timesheet.filter(e => e.approved).map(e => e.hours))
  return (
    <Page title="Timer for fører" eyebrow={`Leieforhold #${r.no}`} back={`/leie/${id}`} sub={`${r.driverId ? userName(s, r.driverId) : 'Fører'} · ${kr(r.driverRate ?? 0)} per time`}>
      <div className="stats"><div className="stat"><p>Ført</p><b>{num(sum(r.timesheet.map(e => e.hours)))} t</b></div><div className="stat amber"><p>Godkjent</p><b>{num(approved)} t</b></div><div className="stat"><p>Beløp</p><b>{kr(approved * (r.driverRate ?? 0))}</b></div></div>
      {!r.timesheet.length && <p className="hint">Ingen timer er ført ennå.</p>}
      <div className="list">
        {r.timesheet.map(e => (
          <Row key={e.id} title={`${fmtDate(e.date)} · ${String(e.hours).replace('.', ',')} t`} sub={`${e.note ? e.note + ' · ' : ''}ført av ${userName(s, e.by)}`}
            right={e.approved ? <Pill tone="ok">Godkjent</Pill> : !lessor ? <Btn kind="amber" small onClick={() => approveTime(r.id, e.id)}>Godkjenn</Btn> : <Pill tone="warn">Venter</Pill>} />
        ))}
      </div>
      {lessor && open && (
        <Card>
          <h2>Før timer</h2>
          <div className="grid2"><Field label="Dato"><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field><Field label="Timer"><Num value={f.hours} onChange={v => setF({ ...f, hours: v })} /></Field></div>
          <Field label="Merknad"><input value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="Valgfritt" /></Field>
          <Btn onClick={() => { if (f.hours <= 0 || f.hours > 24) { toast('Timer må være mellom 0 og 24', 'bad'); return } addTime(r.id, f.date, f.hours, f.note.trim() || undefined); toast('Timene er ført. Leietaker godkjenner.', 'ok') }}>Legg til</Btn>
        </Card>
      )}
      {!lessor && <p className="hint">Du godkjenner timene. Bare godkjente timer tas med i mottakskontrollen.</p>}
      {!open && <p className="hint">Timer kan føres mens objektet er utlevert.</p>}
    </Page>
  )
}
