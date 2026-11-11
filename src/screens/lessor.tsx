import { useState } from 'react'
import type { Listing, Terms, Visibility } from '../types'
import { AiTag, Btn, Card, Chips, DemoSwitch, Empty, Field, KV, Notice, Page, Pill, Row, Section, Seg, Sheet, Stat, Thumb, Toggle, toast } from '../ui/kit'
import { nav } from '../router'
import { co, coName, insuranceStatus, lst, ob, openFault, ratingOf, useMe, useS, userName } from '../store'
import { decideRequest, saveListing, setAvailability } from '../actions'
import { fmtDate, fmtPeriod, kr, rel, RENTAL_LABEL, sum, toCsv, today } from '../lib/util'
import { adText, fees, FEE_LABEL, inspectionTotal, rentAmount } from '../lib/logic'
import { appUrl, copyText, saveFile } from '../lib/files'
import { CompanyCard, Missing, Num, TopActions, VIS_LABEL, listingSrc, priceText } from './common'

export function Annonser() {
  const s = useS(), me = useMe()
  const [pick, setPick] = useState<'leie' | 'salg' | null>(null)
  const mine = s.listings.filter(l => l.companyId === me.company.id && !ob(s, l.objId)?.archived).sort((a, b) => Number(b.active) - Number(a.active))
  const free = s.objects.filter(o => o.companyId === me.company.id && !o.archived && o.status === 'i_drift')
  const add = (objId: string) => {
    const err = setAvailability(objId, pick!)
    if (err) { toast(err, 'bad'); return }
    const l = s.listings.find(x => x.objId === objId && x.mode === pick)
    setPick(null); toast('Annonsen er laget fra objektkortet', 'ok')
    if (l) nav(`/annonse/${l.id}`)
  }
  return (
    <Page title="Annonser" eyebrow="SaleM8 · utleier" right={<TopActions />} wide>
      <div className="hstack wrap"><Btn kind="amber" small icon="plus" onClick={() => setPick('leie')}>Lei ut et objekt</Btn><Btn kind="quiet" small icon="tag" onClick={() => setPick('salg')}>Selg et objekt</Btn></div>
      {!mine.length && <Empty title="Ingen annonser" text="Merk et objekt som ledig, så lages annonsen automatisk fra objektkortet." />}
      <div className="cols">
        {mine.map(l => {
          const o = ob(s, l.objId)!
          const reqs = s.requests.filter(r => r.listingId === l.id && r.status === 'venter').length
          const favs = s.favorites.filter(f => f.listingId === l.id).length
          return (
            <Row key={l.id} to={`/annonse/${l.id}`} thumb={<Thumb src={listingSrc(s, l, o)} type={o.type} alt={o.name} />} title={o.name}
              sub={`${priceText(l)} · ${VIS_LABEL[l.visibility]}${favs ? ` · ${favs} favoritter` : ''}`}
              right={<><Pill tone={l.active ? 'amber' : 'mute'}>{l.active ? (l.mode === 'leie' ? 'Til leie' : 'Til salgs') : 'Ikke aktiv'}</Pill>{reqs > 0 && <Pill tone="ink">{reqs} venter</Pill>}</>} />
          )
        })}
      </div>
      {pick && (
        <Sheet title={pick === 'leie' ? 'Hvilket objekt er ledig?' : 'Hvilket objekt skal selges?'} onClose={() => setPick(null)}>
          {!free.length && <p className="hint">Ingen objekter står som «I drift». Objekter med annonse fra før finner du i listen.</p>}
          {free.map(o => <Row key={o.id} onClick={() => add(o.id)} thumb={<Thumb src={o.photos[0]?.src} type={o.type} />} title={o.name} sub={`${o.internalId} · ${o.place}`} right={openFault(s, o.id) ? <Pill tone="bad">Åpen feil</Pill> : undefined} />)}
        </Sheet>
      )}
    </Page>
  )
}

const TERM_FIELDS: [keyof Terms, string, string][] = [
  ['advancePct', 'Forskudd', 'Prosent av leien'], ['freight', 'Frakt tur og retur', 'Kroner'], ['wash', 'Vask', 'Kroner'], ['serviceAgreement', 'Serviceavtale', 'Kroner'],
  ['insurance', 'Forsikring', 'Kroner'], ['misc', 'Diverse tillegg', 'Kroner'], ['fuelPerQuarter', 'Drivstoff', 'Kroner per kvart tank'], ['tirePerMm', 'Dekk eller belter', 'Kroner per mm slitasje'], ['wearPerHour', 'Slitasje', 'Kroner per time'],
]

export function Annonse({ id }: { id: string }) {
  const s = useS(), me = useMe(), l = lst(s, id)
  const [d, setD] = useState<Listing | undefined>(l)
  if (!l || !d || l.companyId !== me.company.id) return <Missing what="annonsen" />
  const o = ob(s, l.objId)!
  const up = (p: Partial<Listing>) => setD(x => ({ ...x!, ...p }))
  const dirty = JSON.stringify({ ...d, active: l.active, priceHistory: l.priceHistory, reservedFor: l.reservedFor }) !== JSON.stringify(l)
  const drivers = s.users.filter(u => u.memberships.some(m => m.companyId === me.company.id && m.roles.includes('forer')))
  const others = s.companies.filter(c => c.id !== me.company.id && !c.partnerKinds.length)
  const blink = s.blinks.find(b => b.objId === o.id && b.status === 'godkjent')
  const link = appUrl(`/maskin/${l.id}?t=${l.linkToken}`)
  const save = () => {
    const { active: _a, priceHistory: _p, reservedFor: _r, ...patch } = d
    saveListing(l.id, patch); toast(d.price < l.price ? 'Lagret. De som har annonsen som favoritt, får varsel om prisfallet.' : 'Annonsen er lagret', 'ok')
  }
  const toggle = (on: boolean) => { const err = setAvailability(o.id, on ? l.mode : 'i_drift'); toast(err ?? (on ? 'Annonsen er aktiv' : 'Annonsen er tatt ned'), err ? 'bad' : 'ok') }
  return (
    <Page title={o.name} eyebrow={l.mode === 'leie' ? 'Annonse · til leie' : 'Annonse · til salgs'} back="/annonser"
      footer={<><Btn kind="ghost" to={`/maskin/${l.id}`}>Se som kjøper</Btn><Btn kind="amber" disabled={!dirty} onClick={save}>Lagre endringer</Btn></>}>
      <Row to={`/objekt/${o.id}`} thumb={<Thumb src={listingSrc(s, d, o)} type={o.type} alt={o.name} className="lg" />} title={o.name} sub={`${o.internalId} · ${o.place} · objektkortet er kilden til annonsen`} />
      <Card>
        <Toggle on={l.active} onChange={toggle} label="Annonsen er aktiv" sub={l.active ? 'Synlig for dem du deler med' : 'Ingen ser annonsen nå'} />
        {openFault(s, o.id) && <Notice tone="bad" icon="warn">Objektet har en åpen feil og kan ikke leies ut før feilen er løst.</Notice>}
        {l.reservedFor && <Notice tone="ok" icon="lock">Reservert for {coName(s, l.reservedFor)} etter akseptert bud. <button className="link" onClick={() => saveListing(l.id, { reservedFor: undefined })}>Fjern reservasjonen</button></Notice>}
      </Card>

      <Section title="Pris">
        <Card>
          <div className="grid2">
            <Field label={l.mode === 'leie' ? 'Leiepris' : 'Prisantydning'}><Num value={d.price} onChange={v => up({ price: v })} /></Field>
            {l.mode === 'leie' && <Field label="Per"><select value={d.unit} onChange={e => up({ unit: e.target.value as Listing['unit'] })}><option value="dag">Dag</option><option value="uke">Uke</option><option value="mnd">Måned</option></select></Field>}
            {l.mode === 'salg' && <Field label="Budfrist"><input type="date" value={d.bidDeadline ?? ''} onChange={e => up({ bidDeadline: e.target.value || undefined })} /></Field>}
          </div>
          {l.mode === 'leie' && <div className="grid2"><Field label="Ledig fra"><input type="date" value={d.from ?? ''} onChange={e => up({ from: e.target.value || undefined })} /></Field><Field label="Ledig til"><input type="date" value={d.to ?? ''} onChange={e => up({ to: e.target.value || undefined })} /></Field></div>}
          {l.priceHistory.length > 1 && <p className="hint">Prishistorikk: {l.priceHistory.map(p => `${kr(p.price)} (${fmtDate(p.at)})`).join(' → ')}</p>}
        </Card>
      </Section>

      {l.mode === 'leie' && (
        <Section title="Fører">
          <Card>
            <Toggle on={d.withDriver} onChange={v => up({ withDriver: v })} label="Kan leies med fører" sub="Timene føres i leieforholdet og godkjennes av leietaker" />
            {d.withDriver && <div className="grid2">
              <Field label="Timepris fører"><Num value={d.driverRate ?? 0} onChange={v => up({ driverRate: v })} /></Field>
              <Field label="Fører"><select value={d.driverId ?? ''} onChange={e => up({ driverId: e.target.value || undefined })}><option value="">Avtales</option>{drivers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            </div>}
          </Card>
        </Section>
      )}

      <Section title="Hvem får se annonsen">
        <Seg value={d.visibility} onChange={v => up({ visibility: v as Visibility })} options={(Object.keys(VIS_LABEL) as Visibility[]).map(k => [k, VIS_LABEL[k].replace('Bare med lenke', 'Lenke')] as [Visibility, string])} />
        {d.visibility === 'partnere' && <p className="hint">Vises for partnerne dine: {me.company.partners.map(p => coName(s, p)).join(', ') || 'ingen partnere er lagt til ennå'}.</p>}
        {d.visibility === 'utvalgte' && <Chips value={d.invited} options={others.map(c => [c.id, c.name] as [string, string])} onChange={v => up({ invited: v })} />}
        {d.visibility === 'alle' && <p className="hint">Vises i sveip-markedet for alle verifiserte bedrifter. Navnet ditt vises som «Verifisert bedrift» til du har akseptert kjøperen.</p>}
        {d.visibility === 'lenke' && <Card className="tight"><p className="hint" style={{ overflowWrap: 'anywhere' }}>{link}</p><Btn kind="quiet" small icon="copy" onClick={async () => toast((await copyText(link)) ? 'Lenken er kopiert' : 'Kunne ikke kopiere lenken', 'ok')}>Kopier lenke</Btn></Card>}
      </Section>

      <Section title="Annonsetekst" right={<Btn kind="quiet" small icon="spark" onClick={() => up({ text: adText(o, l.mode, d.withDriver) })}>Foreslå tekst</Btn>}>
        <textarea value={d.text} onChange={e => up({ text: e.target.value })} rows={4} aria-label="Annonsetekst" />
        <p className="hint hstack" style={{ gap: 6 }}><AiTag />Forslaget settes sammen av opplysningene på objektkortet.</p>
        {blink && <Card className="tight"><Toggle on={!!d.useBlink} onChange={v => up({ useBlink: v })} label="Bruk blinkskuddet som annonsebilde" sub="Bildet som er godkjent for Topp 100" /></Card>}
      </Section>

      {l.mode === 'leie' && (
        <Section title="Vilkår og satser">
          <p className="hint">Satsene brukes i mottakskontrollen når objektet kommer tilbake.</p>
          <Card>{TERM_FIELDS.map(([k, label, hint]) => <Field key={k} label={label} hint={hint} row><Num value={d.terms[k]} onChange={v => up({ terms: { ...d.terms, [k]: v } })} /></Field>)}</Card>
        </Section>
      )}
    </Page>
  )
}

export function Foresporsler() {
  const s = useS(), me = useMe()
  const all = s.requests.filter(r => r.toCompanyId === me.company.id)
  const pending = all.filter(r => r.status === 'venter')
  const decided = all.filter(r => r.status !== 'venter').slice(0, 12)
  const listings = [...new Set(pending.map(r => r.listingId))]
  return (
    <Page title="Forespørsler" eyebrow="SaleM8 · utleier" right={<TopActions />} wide sub="Du velger selv hvem som får leie eller kjøpe. Navnet ditt vises først når du har godkjent.">
      {!pending.length && <Empty title="Ingen venter på svar" text="Nye forespørsler dukker opp her og som varsel." />}
      {listings.map(lid => {
        const l = lst(s, lid), o = ob(s, l?.objId)
        const rs = pending.filter(r => r.listingId === lid)
        return (
          <Section key={lid} title={`${o?.name ?? 'Objekt'} · ${rs.length} ${rs.length === 1 ? 'forespørsel' : 'forespørsler'}`} right={l && <small>{priceText(l)}</small>}>
            <div className="cols">
              {rs.map(r => {
                const c = co(s, r.fromCompanyId)!, rt = ratingOf(s, c.id)
                return (
                  <Card key={r.id}>
                    <div className="hstack between"><h3>{c.name}</h3>{c.verified ? <Pill tone="ok">Verifisert</Pill> : <Pill tone="warn">Ikke verifisert</Pill>}</div>
                    <p className="hint">{rt.avg != null ? `${rt.avg.toLocaleString('nb-NO')} av 5 fra ${rt.n} vurderinger` : 'Ingen vurderinger ennå'} · sendt {rel(r.createdAt)}</p>
                    <div className="hstack wrap">{insuranceStatus(c).map(i => <Pill key={i.text} tone={i.tone}>{i.text}</Pill>)}</div>
                    {r.mode === 'leie' && <p><b>{fmtPeriod(r.from, r.to)}</b>{r.withDriver ? ' · ønsker fører' : ''}</p>}
                    {r.message && <p className="muted">«{r.message}»</p>}
                    <Btn kind="primary" small to={`/foresporsel/${r.id}`}>Se profil og svar</Btn>
                  </Card>
                )
              })}
            </div>
          </Section>
        )
      })}
      {decided.length > 0 && <Section title="Besvart">
        <div className="cols">{decided.map(r => (
          <Row key={r.id} to={r.rentalId ? `/leie/${r.rentalId}` : r.status === 'godkjent' ? `/match/${r.id}` : `/foresporsel/${r.id}`} title={coName(s, r.fromCompanyId)} sub={`${ob(s, r.objId)?.name} · ${r.mode === 'leie' ? fmtPeriod(r.from, r.to) : 'kjøp'}`}
            right={<Pill tone={r.status === 'godkjent' ? 'ok' : r.status === 'avslatt' ? 'bad' : 'mute'}>{{ godkjent: 'Godkjent', avslatt: 'Avslått', trukket: 'Trukket', venter: 'Venter' }[r.status]}</Pill>} />
        ))}</div>
      </Section>}
    </Page>
  )
}

const REASONS = ['Objektet er ikke ledig i perioden', 'Forsikringsbevis mangler', 'Vi leier bare ut til kjente kunder', 'Perioden er for kort']

export function Foresporsel({ id }: { id: string }) {
  const s = useS(), me = useMe(), r = s.requests.find(x => x.id === id)
  const [no, setNo] = useState(false)
  const [reason, setReason] = useState('')
  if (!r || r.toCompanyId !== me.company.id) return <Missing what="forespørselen" />
  const l = lst(s, r.listingId), o = ob(s, r.objId)!
  const amount = l && r.from && r.to ? rentAmount({ from: r.from, to: r.to, price: l.price, unit: l.unit }) : 0
  const approve = () => {
    const err = decideRequest(r.id, true)
    if (err) { toast(err, 'bad'); return }
    toast(r.mode === 'leie' ? 'Godkjent. Leieforholdet er opprettet, og leietaker får beskjed om forskudd.' : 'Godkjent. Dere ser nå hverandres firma.', 'ok')
    const fresh = s.requests.find(x => x.id === id)
    nav(r.mode === 'leie' ? '/leieforhold' : `/match/${fresh?.id ?? id}`, true)
  }
  return (
    <Page title="Forespørsel" eyebrow={o.name} back="/foresporsler"
      footer={r.status === 'venter' ? <><Btn kind="ghost" onClick={() => setNo(true)}>Avslå</Btn><Btn kind="amber" onClick={approve}>Godkjenn</Btn></> : undefined}>
      {r.status !== 'venter' && <Notice tone={r.status === 'godkjent' ? 'ok' : 'plain'} icon="info">Forespørselen er {{ godkjent: 'godkjent', avslatt: 'avslått', trukket: 'trukket av avsender', venter: '' }[r.status]}{r.reason ? `: ${r.reason}` : '.'}</Notice>}
      <Card>
        <Row to={`/objekt/${o.id}`} thumb={<Thumb src={o.photos[0]?.src} type={o.type} />} title={o.name} sub={l ? priceText(l) : ''} />
        <KV rows={[
          ['Gjelder', r.mode === 'leie' ? 'Leie' : 'Kjøp'], ...(r.mode === 'leie' ? [['Periode', fmtPeriod(r.from, r.to)] as [string, string], ['Fører', r.withDriver ? 'Ønsker fører' : 'Uten fører'] as [string, string], ['Leie for perioden', kr(amount)] as [string, string]] : []),
          ['Kontaktperson', userName(s, r.fromUserId)], ['Sendt', fmtDate(r.createdAt)],
        ]} />
        {r.message && <p className="muted">«{r.message}»</p>}
      </Card>
      <CompanyCard id={r.fromCompanyId} full title={r.mode === 'leie' ? 'Leietaker' : 'Kjøper'} />
      {r.status === 'venter' && r.mode === 'leie' && <Notice tone="plain" icon="info">Når du godkjenner, opprettes leieforholdet og de andre forespørslene på objektet avslås automatisk.</Notice>}
      <DemoSwitch userId={r.fromUserId} to={r.rentalId ? `/leie/${r.rentalId}` : '/mine'} />
      {no && (
        <Sheet title="Avslå forespørselen" onClose={() => setNo(false)} footer={<><Btn kind="ghost" onClick={() => setNo(false)}>Avbryt</Btn><Btn kind="danger" onClick={() => { decideRequest(r.id, false, reason.trim() || undefined); toast('Forespørselen er avslått'); nav('/foresporsler', true) }}>Avslå</Btn></>}>
          <p className="hint">Du trenger ikke å gi en begrunnelse, men det hjelper den som spør.</p>
          <Chips single value={REASONS.includes(reason) ? [reason] : []} options={REASONS} onChange={v => setReason(v[0] ?? '')} />
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Begrunnelse (valgfritt)" aria-label="Begrunnelse" />
        </Sheet>
      )}
    </Page>
  )
}

export function Inntekter() {
  const s = useS(), me = useMe(), model = s.settings.feeModel
  const rentals = s.rentals.filter(r => r.lessorId === me.company.id && r.status !== 'avbrutt')
  const value = (r: typeof rentals[number]) => (r.inspection?.lockedAt ? inspectionTotal(r.inspection) : rentAmount(r))
  const settled = rentals.filter(r => r.inspection?.lockedAt)
  const open = rentals.filter(r => !r.inspection?.lockedAt)
  const held = sum(rentals.filter(r => r.advance.paidAt && !r.advance.releasedAt && !r.advance.refundedAt).map(r => r.advance.amount))
  const sales = s.sales.filter(x => x.sellerId === me.company.id)
  const gross = sum(settled.map(value))
  const exportCsv = async () => {
    const rows: (string | number)[][] = [['Leieforhold', 'Objekt', 'Leietaker', 'Fra', 'Til', 'Linje', 'Målt', 'Beløp']]
    for (const r of settled) for (const li of r.inspection!.lines.filter(x => x.on)) rows.push([`#${r.no}`, ob(s, r.objId)?.name ?? '', coName(s, r.lesseeId), r.from, r.to, li.label, li.measured, li.amount])
    const res = await saveFile(`fakturagrunnlag-${today()}.csv`, toCsv(rows), 'text/csv')
    toast(res === 'lagret' ? 'Fakturagrunnlaget er lagret' : 'Kunne ikke lagre fila her', res === 'lagret' ? 'ok' : 'bad')
  }
  return (
    <Page title="Inntekter" eyebrow="SaleM8 · utleier" right={<TopActions />} wide>
      <div className="stats">
        <Stat label="Oppgjort" value={kr(gross)} tone="ink" />
        <Stat label="Etter gebyr" value={kr(fees(model, gross).lessorGets)} tone="amber" />
        <Stat label="Pågående leie" value={kr(sum(open.map(value)))} />
        <Stat label="Forskudd på vent" value={kr(held)} />
      </div>
      <Notice tone="plain" icon="info">Gebyrmodell i demoen: {FEE_LABEL[model]}.<small>Forskudd holdes til utleveringen er bekreftet. Betalingen er simulert, ingen penger flyttes.</small></Notice>
      <Section title="Leieforhold" right={settled.length > 0 && <Btn kind="quiet" small icon="download" onClick={exportCsv}>Fakturagrunnlag</Btn>}>
        {!rentals.length && <p className="hint">Ingen leieforhold ennå.</p>}
        <div className="cols">
          {rentals.map(r => (
            <Row key={r.id} to={`/leie/${r.id}`} title={`#${r.no} · ${ob(s, r.objId)?.name}`} sub={`${coName(s, r.lesseeId)} · ${fmtPeriod(r.from, r.to)}`}
              right={<><b className="num">{kr(value(r))}</b><Pill tone={r.inspection?.lockedAt ? 'ok' : 'info'}>{r.inspection?.lockedAt ? 'Oppgjort' : RENTAL_LABEL[r.status]}</Pill></>} />
          ))}
        </div>
      </Section>
      {sales.length > 0 && <Section title="Salg">
        <div className="cols">{sales.map(x => <Row key={x.id} title={ob(s, x.objId)?.name ?? x.model} sub={`Solgt til ${coName(s, x.buyerId)} · ${fmtDate(x.at, true)}`} right={<b className="num">{kr(x.price)}</b>} />)}</div>
      </Section>}
    </Page>
  )
}
