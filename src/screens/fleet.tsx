import { useEffect, useRef, useState } from 'react'
import type { LeadType, Obj, ObjStatus, ObjType, Photo, TaskType } from '../types'
import { AiTag, Bar, Btn, Card, Chips, Empty, Field, KV, MiniMap, Notice, ObjThumb, Page, Pill, Row, Section, Seg, Sheet, Stat, Thumb, ask, toast } from '../ui/kit'
import { GuidedCamera, PhotoField, QrSvg } from '../ui/widgets'
import { Icon } from '../ui/icons'
import { back, link, nav, useRoute } from '../router'
import { activeRental, coName, isAdmin, ob, openFault, parkOf, useMe, useS, userName } from '../store'
import { addDoc, addObjPhoto, addObject, importObjects, reportTask, setAvailability, updateObject, washConfirm, washFinish, washStart, type NewObj } from '../actions'
import { daysBetween, fmtDate, meterUnit, num, OBJ_TYPES, parseCsv, parseNum, rel, STATUS_LABEL, STATUS_TONE, TASK_ICON, TASK_LABEL, toCsv, today, tonn } from '../lib/util'
import { estimate, guessType, shotsFor } from '../lib/logic'
import { appUrl, canPrint, printPage, saveFile } from '../lib/files'
import { Gallery, History, Missing, Num, PlaceInput, TopActions, objSub, priceText, readingText } from './common'
import { LeadSheet } from './share'

const StatusPill = ({ o }: { o: Pick<Obj, 'status'> }) => <Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill>

// ---------- Parken ----------
export function Park() {
  const s = useS(), me = useMe()
  const all = parkOf(s, me.company.id)
  const [mode, setMode] = useState<'liste' | 'kart' | 'avd'>('liste')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ObjStatus | 'alle'>('alle')
  const [type, setType] = useState<ObjType | 'alle'>('alle')
  const [faultOnly, setFaultOnly] = useState(false)
  const [place, setPlace] = useState('')
  const faults = new Set(s.tasks.filter(t => t.type === 'feil' && t.status !== 'utfort').map(t => t.objId))
  const list = all.filter(o =>
    (status === 'alle' || o.status === status) && (type === 'alle' || o.type === type) && (!faultOnly || faults.has(o.id)) && (!place || o.place === place) &&
    (!q || `${o.name} ${o.internalId} ${o.model} ${o.regnr ?? ''} ${o.serial} ${o.place}`.toLowerCase().includes(q.toLowerCase())))
  const stale = all.filter(o => !o.hired && daysBetween(o.checkedAt ?? o.readingAt, today()) > 90).length
  const statuses = [...new Set(all.map(o => o.status))]
  const types = [...new Set(all.map(o => o.type))]
  const row = (o: Obj & { hired?: boolean }) => (
    <Row key={o.id} to={`/objekt/${o.id}`} thumb={<ObjThumb o={o} />} title={o.name} sub={objSub(o)}
      right={<><StatusPill o={o} />{faults.has(o.id) && <Pill tone="bad">Åpen feil</Pill>}</>} />
  )
  const depts = [...new Set(all.map(o => o.department || 'Uten avdeling'))].sort()
  return (
    <Page title="Parken" eyebrow="FleetM8" right={<TopActions />} wide>
      <div className="stats">
        <Stat label="Objekter" value={all.length} />
        <Stat label="Ledige" value={all.filter(o => o.status === 'ledig').length} tone="amber" />
        <Stat label="Utleid" value={all.filter(o => o.status === 'utleid').length} />
        <Stat label="Åpne feil" value={all.filter(o => faults.has(o.id)).length} />
      </div>
      {!all.length && <Empty title="Parken er tom" text="Registrer det første objektet med et bilde, eller importer hele parken fra et regneark."><Btn kind="amber" to="/objekt/ny" icon="plus">Registrer objekt</Btn><Btn kind="ghost" to="/import" icon="upload">Importer fra regneark</Btn></Empty>}
      {all.length > 0 && <>
        {stale > 0 && me.company.alerts.stale && <Notice tone="warn" icon="clock">{stale} objekter er ikke bekreftet på over 90 dager. <a className="link" {...link('/vask')}>Vask parken</a></Notice>}
        <div className="actions">
          <Btn kind="amber" small icon="plus" to="/objekt/ny">Registrer</Btn>
          <Btn kind="quiet" small icon="upload" to="/import">Importer</Btn>
          <Btn kind="quiet" small icon="check" to="/vask">Vask parken</Btn>
          <Btn kind="quiet" small icon="qr" to="/qr/alle">QR-koder</Btn>
        </div>
        <Seg value={mode} onChange={setMode} options={[['liste', 'Liste'], ['kart', 'Kart'], ['avd', 'Avdelinger']]} />
        <div className="filters">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Søk på navn, nummer eller sted" aria-label="Søk i parken" />
          <select value={status} onChange={e => setStatus(e.target.value as ObjStatus | 'alle')} aria-label="Status"><option value="alle">Alle statuser</option>{statuses.map(x => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}</select>
          <select value={type} onChange={e => setType(e.target.value as ObjType | 'alle')} aria-label="Type"><option value="alle">Alle typer</option>{types.map(x => <option key={x} value={x}>{x}</option>)}</select>
        </div>
        <div className="chips">
          <button className="chip" aria-pressed={faultOnly} onClick={() => setFaultOnly(!faultOnly)}>Åpen feil</button>
          {place && <button className="chip" aria-pressed="true" onClick={() => setPlace('')}>{place} ✕</button>}
          <span className="hint" style={{ alignSelf: 'center' }}>{list.length} av {all.length}</span>
        </div>
        {mode === 'liste' && <div className="cols">{list.map(row)}</div>}
        {mode === 'liste' && !list.length && <p className="hint">Ingen objekter passer filteret.</p>}
        {mode === 'kart' && <>
          <MiniMap points={list.map(o => ({ place: o.place, label: o.name, tone: faults.has(o.id) ? 'bad' : o.status === 'ledig' || o.status === 'til_salgs' ? 'amber' : undefined, onClick: () => { setPlace(o.place); setMode('liste') } }))} />
          <div className="chips">{[...new Set(list.map(o => o.place))].map(p => <button key={p} className="chip" onClick={() => { setPlace(p); setMode('liste') }}>{p} · {list.filter(o => o.place === p).length}</button>)}</div>
          <p className="hint">Rav betyr ledig eller til salgs. Rødt betyr åpen feil. Trykk på et sted for å se objektene.</p>
        </>}
        {mode === 'avd' && depts.map(d => {
          const g = list.filter(o => (o.department || 'Uten avdeling') === d)
          if (!g.length) return null
          const use = Math.round((g.reduce((a, o) => a + o.usage30, 0) / (g.length * 30)) * 100)
          return (
            <Section key={d} title={`${d} · ${g.length} objekter`} right={<small>Brukt {use} % siste 30 dager</small>}>
              <Bar pct={use} tone={use < 30 ? 'low' : undefined} />
              <div className="cols">{g.map(row)}</div>
            </Section>
          )
        })}
      </>}
    </Page>
  )
}

// ---------- Objektkort ----------
export function ObjectCard({ id }: { id: string }) {
  const s = useS(), me = useMe(), o = ob(s, id)
  const [sheet, setSheet] = useState<null | 'reading' | 'edit' | 'cam'>(null)
  const [lead, setLead] = useState<LeadType | null>(null)
  const [shots, setShots] = useState<Record<string, Photo | undefined>>({})
  const file = useRef<HTMLInputElement>(null)
  if (!o) return <Missing what="objektet" />
  const own = o.companyId === me.company.id
  const hiredRental = s.rentals.find(r => r.objId === o.id && r.lesseeId === me.company.id && r.status === 'utlevert')
  if (!own && !hiredRental) return <Missing what="objektet" />
  const admin = isAdmin(me), fault = openFault(s, o.id), rental = activeRental(s, o.id)
  const listing = s.listings.find(l => l.objId === o.id && l.active)
  const avail = o.status === 'ledig' ? 'leie' : o.status === 'til_salgs' ? 'salg' : 'i_drift'
  const locked = !!o.archived || o.status === 'utleid' || o.status === 'solgt' || o.status === 'utrangert'
  const e = estimate(o)
  const tasks = s.tasks.filter(t => t.objId === o.id && t.status !== 'utfort')
  const drivers = s.users.filter(u => u.memberships.some(m => m.companyId === o.companyId && m.roles.includes('forer')))
  const sv = o.service
  const svLeft = sv.nextAt != null ? sv.nextAt - o.reading : null
  const euDays = sv.euDate ? daysBetween(today(), sv.euDate) : null
  const setAvail = (v: 'i_drift' | 'leie' | 'salg') => {
    const err = setAvailability(o.id, v)
    if (err) toast(err, 'bad'); else toast(v === 'i_drift' ? 'Tatt ut av markedet' : v === 'leie' ? 'Merket ledig. Annonsen er laget fra objektkortet.' : 'Lagt ut for salg. Annonsen er laget fra objektkortet.', 'ok')
  }
  return (
    <Page flush back="/park" title={o.name}>
      <div className="hero">
        <ObjThumb o={o} />
        <span className="bl"><StatusPill o={hiredRental ? { status: 'innleid' } : o} /></span>
        {o.photos.length > 1 && <span className="br"><Pill tone="glass">{o.photos.length} bilder</Pill></span>}
      </div>
      <div className="padx">
        <div>
          <p className="eyebrow">{o.internalId} · {o.type}</p>
          <h1>{o.name}</h1>
          <p className="muted">{[o.make, o.model, o.year].filter(Boolean).join(' · ')}</p>
        </div>
        {hiredRental && <Notice tone="info" icon="handshake">Innleid fra {coName(s, o.companyId)} til {fmtDate(hiredRental.to)}. <a className="link" {...link(`/leie/${hiredRental.id}`)}>Åpne leieforholdet</a></Notice>}
        {o.archived && <Notice tone="plain" icon="lock">Arkivert {fmtDate(o.archived.at, true)}: {o.archived.reason.toLowerCase()}{o.archived.soldTo ? ` til ${o.archived.soldTo}` : ''}. Kortet kan ikke endres.</Notice>}
        {o.transferNote && <Notice tone="info" icon="info">{o.transferNote}</Notice>}
        {fault && <Notice tone="bad" icon="warn">Åpen feil: {fault.title.replace(/[.\s]+$/, "")}. Objektet er sperret for utleie til feilen er løst. <a className="link" {...link('/verksted')}>Se oppgaven</a></Notice>}
        {own && rental && <Notice tone="ok" icon="handshake">{rental.status === 'utlevert' ? 'Utleid til' : 'Avtalt leie med'} {coName(s, rental.lesseeId)}, {fmtDate(rental.from)} til {fmtDate(rental.to)}. <a className="link" {...link(`/leie/${rental.id}`)}>Åpne leieforholdet</a></Notice>}

        {own && !o.archived && admin && (
          <Card>
            <div className="hstack between"><h2>Tilgjengelighet</h2><small>Ett trykk lager annonsen</small></div>
            <Seg tone="amber" value={avail} onChange={v => !locked && setAvail(v)} options={[['i_drift', 'I drift'], ['leie', 'Leie'], ['salg', 'Salg']]} />
            {locked && <p className="hint">Kan ikke endres mens objektet er {STATUS_LABEL[o.status].toLowerCase()}.</p>}
            {listing && (
              <Row to={`/annonse/${listing.id}`} title={priceText(listing)} sub={`Vises for ${{ partnere: 'partnere', utvalgte: 'utvalgte bedrifter', alle: 'alle i markedet', lenke: 'de som har lenken' }[listing.visibility]}${listing.withDriver ? ' · kan leies med fører' : ''}`} right={<Btn kind="quiet" small>Rediger annonse</Btn>} />
            )}
          </Card>
        )}

        <Card>
          <KV rows={[
            ...(o.type !== 'Redskap' ? [[o.meter === 'timer' ? 'Timer' : 'Kilometer', <span key="r">{readingText(o)} <small>bekreftet {rel(o.readingAt)}</small></span>] as [string, React.ReactNode]] : []),
            ['Sted', o.place || 'Ikke satt'], ['Avdeling', o.department || 'Ingen'],
            ['Ansvarlig fører', o.responsible ? userName(s, o.responsible) : 'Ingen'],
            ['Serienummer', o.serial || 'Ikke registrert'], ...(o.regnr ? [['Registreringsnummer', o.regnr] as [string, string]] : []),
            ['Vekt', o.weightKg ? tonn(o.weightKg) : 'Ikke registrert'], ['Tilstand', `${o.condition} av 5`],
            ...Object.entries(o.specs),
          ]} />
          {own && !o.archived && <div className="hstack wrap">
            {o.type !== 'Redskap' && <Btn kind="quiet" small icon="clock" onClick={() => setSheet('reading')}>Bekreft {o.meter === 'timer' ? 'timer' : 'km'}</Btn>}
            {admin && <Btn kind="quiet" small icon="edit" onClick={() => setSheet('edit')}>Rediger</Btn>}
          </div>}
        </Card>

        {own && !o.archived && (
          <Card className="inv">
            <div className="hstack between"><p className="eyebrow">Verdiestimat</p><AiTag text="Estimat, ikke takst" /></div>
            <p className="bignum">kr {num(e.low)} – {num(e.high)}</p>
            <p className="hint">Regnet ut fra type, årsmodell, {o.meter === 'timer' ? 'timer' : 'km'} og tilstand. Vil du ha et tall å handle på, bestill takst eller be om bud.</p>
            <div className="hstack wrap"><Btn kind="amber" small onClick={() => setLead('takst')}>Bestill takst</Btn><Btn kind="ghost" small onClick={() => setLead('innbytte')}>Be om bud fra forhandlere</Btn></div>
          </Card>
        )}

        {(svLeft != null || euDays != null) && (
          <Card>
            <h2>Service og kontroll</h2>
            {svLeft != null && <>
              <div className="hstack between"><span>Neste service ved {num(sv.nextAt!)} {meterUnit(o.meter)}</span><b>{svLeft > 0 ? `om ${num(svLeft)} ${meterUnit(o.meter)}` : 'forfalt'}</b></div>
              <Bar pct={sv.interval ? 100 - (svLeft / sv.interval) * 100 : 100} tone={svLeft <= 50 ? undefined : 'green'} />
            </>}
            {euDays != null && <div className="hstack between"><span>EU-kontroll innen {fmtDate(sv.euDate, true)}</span><Pill tone={euDays < 0 ? 'bad' : euDays <= 30 ? 'warn' : 'ok'}>{euDays < 0 ? 'Forfalt' : `om ${euDays} dager`}</Pill></div>}
            <p className="hint">Oppgaver til verksmester opprettes automatisk når fristen nærmer seg.</p>
          </Card>
        )}

        {tasks.length > 0 && <Section title="Åpne oppgaver">{tasks.map(t => <Row key={t.id} to="/verksted" thumb={<span className={'taskicon ' + t.type}>{TASK_ICON[t.type]}</span>} title={t.title} sub={`${userName(s, t.reportedBy)} · ${rel(t.at)}`} right={<Pill tone={t.status === 'ny' ? 'warn' : 'info'}>{t.status === 'ny' ? 'Ny' : 'Under arbeid'}</Pill>} />)}</Section>}

        {o.attachments.length > 0 && <Section title="Redskap som følger med"><div className="tags">{o.attachments.map(a => <span key={a} className="tagbox">{a}</span>)}</div></Section>}

        <Section title="Bilder" right={own && !o.archived && <Btn kind="quiet" small icon="camera" onClick={() => setSheet('cam')}>Ta bildeserie</Btn>}>
          <Gallery photos={o.photos} type={o.type} />
        </Section>

        <Section title="Dokumenter" right={own && !o.archived && <Btn kind="quiet" small icon="upload" onClick={() => file.current?.click()}>Last opp</Btn>}>
          {o.docs.map(d => <Row key={d.id} thumb={<span className="taskicon"><Icon name="file" size={20} /></span>} title={d.name} sub={`${d.kind} · ${fmtDate(d.at, true)}`} />)}
          {!o.docs.length && <p className="hint">Ingen dokumenter.</p>}
          <input ref={file} type="file" hidden onChange={ev => { const f = ev.target.files?.[0]; if (f) { addDoc(o.id, f.name); toast('Dokumentet er registrert. Denne versjonen lagrer bare filnavnet.') } ev.target.value = '' }} />
        </Section>

        {own && !o.archived && (
          <Section title="Gjør noe med objektet">
            <div className="grid2">
              <Btn kind="quiet" icon="qr" to={`/qr/${o.id}`}>QR-kode</Btn>
              <Btn kind="quiet" icon="send" to={`/send/${o.id}`}>Send maskin</Btn>
              <Btn kind="quiet" icon="wrench" to={`/q/${o.id}`}>Meld til verksmester</Btn>
              <Btn kind="quiet" icon="camera" to={`/blinkskudd?obj=${o.id}`}>Blinkskudd</Btn>
            </div>
          </Section>
        )}
        {own && !o.archived && admin && (
          <Section title="Be om tilbud">
            <p className="hint">Forespørselen går til leverandører du velger. De ser bare det som trengs for å gi pris.</p>
            <Chips value={[]} options={[['redskap', 'Pris på redskap'], ['service', 'Service'], ['finans', 'Finansiering'], ['forsikring', 'Forsikring'], ['innbytte', 'Innbytte']]} onChange={v => setLead(v[0] as LeadType)} />
          </Section>
        )}

        <Section title="Historikk"><History events={o.history} /></Section>
        {own && !o.archived && admin && o.status !== 'utleid' && (
          <Btn kind="ghost" icon="trash" onClick={async () => { if (await ask(`Utrangere ${o.name}? Objektet tas ut av parken og legges i arkivet.`, 'Utranger', true)) { updateObject(o.id, { status: 'utrangert', archived: { at: new Date().toISOString(), reason: 'Utrangert' } }); toast('Objektet er arkivert'); back('/park') } }}>Utranger objektet</Btn>
        )}
      </div>
      {sheet === 'reading' && <ReadingSheet o={o} onClose={() => setSheet(null)} />}
      {sheet === 'edit' && <EditSheet o={o} drivers={drivers.map(d => [d.id, d.name])} depts={me.company.departments} onClose={() => setSheet(null)} />}
      {sheet === 'cam' && <GuidedCamera title={o.name} type={o.type} place={o.place} shots={shotsFor(o.type)} photos={shots} onPhoto={(k, p) => { setShots(x => ({ ...x, [k]: p })); addObjPhoto(o.id, p) }} onClose={() => { setSheet(null); setShots({}) }} />}
      {lead && <LeadSheet type={lead} objId={o.id} onClose={() => setLead(null)} />}
    </Page>
  )
}

function ReadingSheet({ o, onClose }: { o: Obj; onClose: () => void }) {
  const [v, setV] = useState(o.reading)
  return (
    <Sheet title={`Bekreft ${o.meter === 'timer' ? 'timer' : 'km'}`} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Avbryt</Btn><Btn onClick={() => {
      if (v < o.reading) { toast('Tallet er lavere enn sist. Sjekk telleren.', 'bad'); return }
      if (v === o.reading) updateObject(o.id, { readingAt: new Date().toISOString(), checkedAt: new Date().toISOString() }); else updateObject(o.id, { reading: v, checkedAt: new Date().toISOString() }, 'sjekkpunkt')
      toast('Sjekkpunkt lagret', 'ok'); onClose()
    }}>Lagre</Btn></>}>
      <p className="hint">Sist bekreftet {rel(o.readingAt)}: {readingText(o)}.</p>
      <Field label={o.meter === 'timer' ? 'Timer nå' : 'Kilometer nå'}><Num value={v} onChange={setV} /></Field>
    </Sheet>
  )
}

function EditSheet({ o, drivers, depts, onClose }: { o: Obj; drivers: [string, string][]; depts: string[]; onClose: () => void }) {
  const [f, setF] = useState({ name: o.name, make: o.make, model: o.model, serial: o.serial, regnr: o.regnr ?? '', year: o.year, department: o.department, place: o.place, weightKg: o.weightKg, condition: o.condition, responsible: o.responsible ?? '', attachments: o.attachments.join(', '), interval: o.service.interval ?? 0, nextAt: o.service.nextAt ?? 0, euDate: o.service.euDate ?? '', purchasePrice: o.purchasePrice ?? 0 })
  const up = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }))
  const save = () => {
    updateObject(o.id, {
      name: f.name.trim() || o.name, make: f.make, model: f.model, serial: f.serial, regnr: f.regnr || undefined, year: f.year || o.year, department: f.department, place: f.place, weightKg: f.weightKg,
      condition: f.condition, responsible: f.responsible || undefined, attachments: f.attachments.split(',').map(x => x.trim()).filter(Boolean), purchasePrice: f.purchasePrice || undefined,
      service: { interval: f.interval || undefined, nextAt: f.nextAt || undefined, euDate: f.euDate || undefined },
    })
    toast('Objektkortet er oppdatert', 'ok'); onClose()
  }
  return (
    <Sheet title="Rediger objekt" onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Avbryt</Btn><Btn onClick={save}>Lagre</Btn></>}>
      <Field label="Navn"><input value={f.name} onChange={e => up({ name: e.target.value })} /></Field>
      <div className="grid2"><Field label="Merke"><input value={f.make} onChange={e => up({ make: e.target.value })} /></Field><Field label="Modell"><input value={f.model} onChange={e => up({ model: e.target.value })} /></Field></div>
      <div className="grid2"><Field label="Serienummer"><input value={f.serial} onChange={e => up({ serial: e.target.value })} /></Field><Field label="Reg.nr."><input value={f.regnr} onChange={e => up({ regnr: e.target.value })} /></Field></div>
      <div className="grid2"><Field label="Årsmodell"><Num value={f.year} onChange={v => up({ year: Math.round(v) })} /></Field><Field label="Vekt i kg"><Num value={f.weightKg} onChange={v => up({ weightKg: v })} /></Field></div>
      <div className="grid2">
        <Field label="Sted"><PlaceInput value={f.place} onChange={v => up({ place: v })} /></Field>
        <Field label="Avdeling"><select value={f.department} onChange={e => up({ department: e.target.value })}><option value="">Ingen</option>{depts.map(d => <option key={d}>{d}</option>)}</select></Field>
      </div>
      <div className="grid2">
        <Field label="Ansvarlig fører"><select value={f.responsible} onChange={e => up({ responsible: e.target.value })}><option value="">Ingen</option>{drivers.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></Field>
        <Field label="Tilstand"><select value={f.condition} onChange={e => up({ condition: Number(e.target.value) as Obj['condition'] })}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} av 5</option>)}</select></Field>
      </div>
      <Field label="Redskap som følger med" hint="Skill med komma"><input value={f.attachments} onChange={e => up({ attachments: e.target.value })} /></Field>
      <div className="grid2"><Field label={`Serviceintervall (${meterUnit(o.meter)})`}><Num value={f.interval} onChange={v => up({ interval: v })} /></Field><Field label={`Neste service ved (${meterUnit(o.meter)})`}><Num value={f.nextAt} onChange={v => up({ nextAt: v })} /></Field></div>
      <div className="grid2"><Field label="EU-kontroll innen"><input type="date" value={f.euDate} onChange={e => up({ euDate: e.target.value })} /></Field><Field label="Innkjøpspris"><Num value={f.purchasePrice} onChange={v => up({ purchasePrice: v })} /></Field></div>
    </Sheet>
  )
}

// ---------- Rask registrering ----------
export function RegisterObject() {
  const me = useMe()
  const blank = { name: '', type: '' as ObjType | '', make: '', model: '', serial: '', regnr: '', year: new Date().getFullYear(), department: me.company.departments[0] ?? '', place: me.company.place, reading: 0, weightKg: 0 }
  const [f, setF] = useState(blank)
  const [photo, setPhoto] = useState<Photo>()
  const [count, setCount] = useState(0)
  const up = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }))
  const guess = guessType(`${f.name} ${f.model}`)
  const type: ObjType = f.type || guess || 'Gravemaskin'
  const save = (again: boolean) => {
    if (!f.name.trim()) { toast('Gi objektet et navn', 'bad'); return }
    const id = addObject({ ...f, type, name: f.name.trim(), photo })
    if (again) { setF({ ...blank, department: f.department, place: f.place }); setPhoto(undefined); setCount(count + 1); toast('Lagret. Klar for neste.', 'ok'); window.scrollTo(0, 0) }
    else { toast('Objektet er registrert', 'ok'); nav(`/objekt/${id}`, true) }
  }
  return (
    <Page title="Registrer objekt" eyebrow="FleetM8" back="/park" sub="Ta et bilde, skriv navnet og lagre. Resten kan fylles ut senere."
      footer={<><Btn kind="ghost" onClick={() => save(true)}>Lagre og ta neste</Btn><Btn kind="amber" onClick={() => save(false)}>Lagre</Btn></>}>
      {count > 0 && <Notice tone="ok" icon="check">{count} objekter registrert i denne runden.</Notice>}
      <PhotoField photo={photo} onPhoto={setPhoto} type={type} label="Bilde av objektet" hint="Still deg slik at hele objektet er med" place={f.place} />
      <Field label="Navn" hint="For eksempel «Beltegraver 14 t»"><input value={f.name} onChange={e => up({ name: e.target.value })} autoFocus /></Field>
      <Field label="Type" hint={!f.type && guess ? <span className="hstack" style={{ gap: 6 }}><AiTag />foreslår {guess.toLowerCase()} ut fra navnet</span> : undefined}>
        <select value={f.type || guess || ''} onChange={e => up({ type: e.target.value as ObjType })}><option value="" disabled>Velg type</option>{OBJ_TYPES.map(t => <option key={t}>{t}</option>)}</select>
      </Field>
      <Notice tone="plain" icon="spark">I den ferdige appen foreslår AI type, merke og modell fra bildet. Her er AI simulert og foreslår bare type ut fra navnet.</Notice>
      <div className="grid2"><Field label="Merke"><input value={f.make} onChange={e => up({ make: e.target.value })} /></Field><Field label="Modell"><input value={f.model} onChange={e => up({ model: e.target.value })} /></Field></div>
      <div className="grid2"><Field label="Serienummer"><input value={f.serial} onChange={e => up({ serial: e.target.value })} /></Field><Field label="Reg.nr."><input value={f.regnr} onChange={e => up({ regnr: e.target.value })} /></Field></div>
      <div className="grid2"><Field label="Årsmodell"><Num value={f.year} onChange={v => up({ year: Math.round(v) })} /></Field><Field label="Timer eller km"><Num value={f.reading} onChange={v => up({ reading: v })} /></Field></div>
      <div className="grid2">
        <Field label="Sted"><PlaceInput value={f.place} onChange={v => up({ place: v })} /></Field>
        <Field label="Avdeling"><select value={f.department} onChange={e => up({ department: e.target.value })}><option value="">Ingen</option>{me.company.departments.map(d => <option key={d}>{d}</option>)}</select></Field>
      </div>
      <Field label="Vekt i kg" hint="Brukes når objektet skal fraktes"><Num value={f.weightKg} onChange={v => up({ weightKg: v })} /></Field>
    </Page>
  )
}

// ---------- Masseimport ----------
const COLS: [RegExp, keyof NewObj][] = [
  [/intern/, 'internalId'], [/navn|name|objekt|beskriv/, 'name'], [/type|kategori/, 'type'], [/merke|fabrikat|make/, 'make'], [/modell|model/, 'model'], [/serie/, 'serial'],
  [/reg/, 'regnr'], [/år|year/, 'year'], [/avd/, 'department'], [/sted|plass|lokasjon/, 'place'], [/timer|km|teller/, 'reading'], [/vekt|kg/, 'weightKg'],
]
const TEMPLATE = [
  ['Internnr', 'Navn', 'Type', 'Merke', 'Modell', 'Serienr', 'Regnr', 'Årsmodell', 'Avdeling', 'Sted', 'Timer eller km', 'Vekt kg'],
  ['GR-0700', 'Beltegraver 22 t', 'Gravemaskin', '', 'ZX220', 'ZX220-70012', '', 2020, 'Avd. Nord', 'Bodø', 3400, 22000],
  ['LB-0500', 'Krokløftbil', 'Lastebil', '', 'FH 540', 'FH540-50031', 'XX 12345', 2018, 'Avd. Sør', 'Mo i Rana', 310000, 13000],
  ['TH-0910', 'Maskinhenger 3,5 t', 'Tilhenger', '', '', 'MH35-0910', 'XY 5678', 2021, 'Avd. Nord', 'Fauske', 12000, 950],
]

function toRows(text: string): { rows: (NewObj & { unsure?: boolean })[]; cols: string[] } {
  const grid = parseCsv(text)
  if (grid.length < 2) return { rows: [], cols: [] }
  const map = grid[0].map(h => COLS.find(([re]) => re.test(h.toLowerCase()))?.[1])
  const rows = grid.slice(1).map(r => {
    const o: Record<string, string> = {}
    map.forEach((k, i) => { if (k && r[i]) o[k] = r[i] })
    const known = OBJ_TYPES.find(t => t.toLowerCase() === (o.type ?? '').toLowerCase())
    const type = known ?? guessType(`${o.type ?? ''} ${o.name ?? ''}`)
    return {
      name: o.name || o.model || o.type || 'Uten navn', type: type ?? 'Redskap', unsure: !type, make: o.make, model: o.model, serial: o.serial, regnr: o.regnr, internalId: o.internalId,
      year: o.year ? parseNum(o.year) : undefined, department: o.department, place: o.place, reading: o.reading ? parseNum(o.reading) : undefined, weightKg: o.weightKg ? parseNum(o.weightKg) : undefined,
    } as NewObj & { unsure?: boolean }
  })
  return { rows, cols: map.filter(Boolean) as string[] }
}

export function ImportObjects() {
  const [text, setText] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const { rows, cols } = toRows(text)
  const run = () => { const n = importObjects(rows.map(({ unsure: _u, ...r }) => r)); toast(`${n} objekter importert`, 'ok'); nav('/park', true) }
  return (
    <Page title="Importer fra regneark" eyebrow="FleetM8" back="/park" wide sub="Hele parken inn på én gang. Kolonnene kjennes igjen på overskriften."
      footer={rows.length ? <Btn kind="amber" onClick={run}>Importer {rows.length} objekter</Btn> : undefined}>
      <div className="hstack wrap">
        <Btn kind="quiet" small icon="upload" onClick={() => file.current?.click()}>Velg CSV-fil</Btn>
        <Btn kind="quiet" small icon="download" onClick={async () => { const r = await saveFile('planm8-importmal.csv', toCsv(TEMPLATE), 'text/csv'); if (r !== 'lagret') toast('Kunne ikke lagre fila her', 'bad') }}>Last ned mal</Btn>
        <Btn kind="ghost" small onClick={() => setText(toCsv(TEMPLATE).replace(/^﻿/, ''))}>Prøv med eksempel</Btn>
      </div>
      <input ref={file} type="file" accept=".csv,.txt,text/csv" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) setText(await f.text()); e.target.value = '' }} />
      <Field label="Eller lim inn fra regnearket" hint="Merk cellene i Excel eller Google Regneark, kopier og lim inn her. Første rad må være overskrifter.">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder={'Navn;Type;Årsmodell;Sted;Timer eller km'} style={{ fontFamily: 'monospace', fontSize: 13 }} />
      </Field>
      {text.trim() && !rows.length && <Notice tone="warn" icon="warn">Fant ingen rader. Sjekk at første rad har overskrifter som «Navn» og «Type».</Notice>}
      {rows.length > 0 && <>
        <Notice tone="ok" icon="check">Fant {rows.length} rader og kjente igjen kolonnene {cols.length ? cols.length : 0} av {parseCsv(text)[0].length}.{rows.some(r => r.unsure) ? ' Rader merket med spørsmålstegn fikk typen «Redskap» fordi typen ikke ble kjent igjen.' : ''}</Notice>
        <div className="tablewrap card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Navn</th><th>Type</th><th>Årsmodell</th><th>Sted</th><th>Avdeling</th><th>Timer/km</th><th>Serienr.</th></tr></thead>
            <tbody>{rows.slice(0, 50).map((r, i) => <tr key={i}><td>{r.name}</td><td>{r.type}{r.unsure ? ' ?' : ''}</td><td>{r.year ?? ''}</td><td>{r.place ?? ''}</td><td>{r.department ?? ''}</td><td>{r.reading != null ? num(r.reading) : ''}</td><td>{r.serial ?? ''}</td></tr>)}</tbody>
          </table>
        </div>
        {rows.length > 50 && <p className="hint">Viser de 50 første radene.</p>}
      </>}
    </Page>
  )
}

// ---------- Vask parken ----------
export function Vask() {
  const s = useS(), me = useMe()
  const wash = s.washes.find(w => w.companyId === me.company.id && !w.finishedAt)
  const last = s.washes.find(w => w.companyId === me.company.id && w.finishedAt)
  const objs = s.objects.filter(o => o.companyId === me.company.id && !o.archived && o.status !== 'utleid')
  const [skipped, setSkipped] = useState<string[]>([])
  if (!wash) {
    return (
      <Page title="Vask parken" eyebrow="FleetM8" back="/park">
        <Card>
          <p className="lead">Gå gjennom objektene ett for ett og bekreft at registeret stemmer med virkeligheten.</p>
          <p className="muted">For hvert objekt bekrefter du timer eller km, sted og status. Objekter som ikke finnes lenger, tas ut. Utleide objekter hoppes over.</p>
          <KV rows={[['Objekter å gå gjennom', objs.length], ['Sist vasket', last?.finishedAt ? fmtDate(last.finishedAt, true) : 'Aldri']]} />
          <Btn kind="amber" block onClick={() => washStart()}>Start vask</Btn>
        </Card>
      </Page>
    )
  }
  const left = objs.filter(o => !wash.doneIds.includes(o.id))
  const queue = [...left.filter(o => !skipped.includes(o.id)), ...left.filter(o => skipped.includes(o.id))]
  const o = queue[0]
  const done = objs.length - left.length
  return (
    <Page title="Vask parken" eyebrow="FleetM8" back="/park" sub={`${done} av ${objs.length} bekreftet`}>
      <Bar pct={objs.length ? (done / objs.length) * 100 : 100} />
      {!o ? (
        <Empty title="Parken er vasket" text={`${done} objekter er bekreftet. Registeret er oppdatert.`}>
          <Btn kind="amber" onClick={() => { washFinish(wash.id); toast('Vasken er fullført', 'ok'); nav('/park', true) }}>Fullfør</Btn>
        </Empty>
      ) : <WashItem key={o.id} o={o} washId={wash.id} onSkip={() => setSkipped(x => [...x.filter(i => i !== o.id), o.id])} />}
      {o && <Btn kind="ghost" onClick={() => { washFinish(wash.id); toast('Vasken er avsluttet'); nav('/park', true) }}>Avslutt nå</Btn>}
    </Page>
  )
}

function WashItem({ o, washId, onSkip }: { o: Obj; washId: string; onSkip: () => void }) {
  const [reading, setReading] = useState(o.reading)
  const [place, setPlace] = useState(o.place)
  const changed = reading !== o.reading || place !== o.place
  return (
    <Card>
      <div className="hstack"><ObjThumb o={o} className="lg" /><div className="grow"><h3>{o.name}</h3><p className="hint">{o.internalId} · {STATUS_LABEL[o.status]}</p><p className="hint">Sist bekreftet {rel(o.checkedAt ?? o.readingAt)}</p></div></div>
      {o.type !== 'Redskap' && <Field label={o.meter === 'timer' ? 'Timer' : 'Kilometer'} row><Num value={reading} onChange={setReading} /></Field>}
      <Field label="Står i" row><PlaceInput value={place} onChange={setPlace} /></Field>
      <Btn kind="amber" block icon="check" onClick={() => {
        if (reading < o.reading) { toast('Tallet er lavere enn sist. Sjekk telleren.', 'bad'); return }
        washConfirm(washId, o.id, changed ? { ...(reading !== o.reading ? { reading } : {}), ...(place !== o.place ? { place } : {}) } : undefined)
      }}>{changed ? 'Lagre endring og bekreft' : 'Stemmer'}</Btn>
      <div className="hstack">
        <Btn kind="ghost" small onClick={onSkip}>Ta den senere</Btn>
        <Btn kind="ghost" small onClick={async () => { if (await ask(`Ta ${o.name} ut av parken? Objektet legges i arkivet.`, 'Ta ut', true)) washConfirm(washId, o.id, { status: 'utrangert', archived: { at: new Date().toISOString(), reason: 'Fantes ikke ved vask av parken' } }) }}>Finnes ikke lenger</Btn>
      </div>
    </Card>
  )
}

// ---------- QR ----------
export function QrPrint({ id }: { id: string }) {
  const s = useS(), me = useMe()
  const objs = id === 'alle' ? s.objects.filter(o => o.companyId === me.company.id && !o.archived) : s.objects.filter(o => o.id === id && o.companyId === me.company.id)
  if (!objs.length) return <Missing what="objektet" />
  return (
    <Page title={id === 'alle' ? 'QR-koder for parken' : 'QR-kode'} eyebrow="FleetM8" back="/park" wide={id === 'alle'}
      sub="Fest koden på maskinen. Føreren skanner og sender beskjed til verksmester med to trykk.">
      <div className="hstack wrap no-print">
        {canPrint() ? <Btn icon="download" onClick={printPage}>Skriv ut</Btn> : <p className="hint">Utskrift virker når nettsiden åpnes i egen fane.</p>}
        {id !== 'alle' && <Btn kind="quiet" to={`/q/${id}`}>Åpne det føreren ser</Btn>}
      </div>
      <div className={id === 'alle' ? 'cols' : 'stack'}>
        {objs.map(o => (
          <div className="qrcard" key={o.id}>
            <QrSvg text={appUrl(`/q/${o.id}`)} size={id === 'alle' ? 150 : 220} />
            <h3>{o.name}</h3>
            <p className="hint">{o.internalId} · {me.company.name}</p>
            <p className="hint">Skann for å melde feil, flytting eller service</p>
          </div>
        ))}
      </div>
      <p className="hint no-print">Koden peker til denne nettsiden. Fordi demoen lagrer data lokalt, virker skanningen bare i nettleseren der objektet finnes.</p>
    </Page>
  )
}

const REPORT: [TaskType, string, string][] = [
  ['feil', 'Feil eller skade', 'Objektet sperres for utleie til feilen er løst'],
  ['flytt', 'Trenger flytting', 'Si hvor objektet skal'],
  ['service', 'Trenger service', 'Verksmester får en oppgave'],
  ['annet', 'Annet', 'Fri beskjed til verksmester'],
]

/** Det føreren ser etter å ha skannet QR-koden på en maskin. */
export function QuickReport({ id }: { id: string }) {
  const s = useS(), me = useMe(), o = ob(s, id)
  const [type, setType] = useState<TaskType | null>(null)
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<Photo>()
  const [reading, setReading] = useState(o?.reading ?? 0)
  if (!o || !parkOf(s, me.company.id).some(x => x.id === id)) return <Missing what="objektet" />
  const send = () => {
    if (!type) return
    if ((type === 'feil' || type === 'annet') && !text.trim()) { toast('Skriv kort hva det gjelder', 'bad'); return }
    if (reading < o.reading) { toast('Tallet er lavere enn sist. Sjekk telleren.', 'bad'); return }
    reportTask(o.id, type, text.trim(), photo, o.type === 'Redskap' ? undefined : reading)
    toast(type === 'feil' ? 'Feilen er meldt. Objektet er sperret for utleie.' : 'Beskjeden er sendt til verksmester', 'ok')
    back(me.view === 'forer' ? '/forer' : `/objekt/${o.id}`)
  }
  return (
    <Page title={o.name} eyebrow={`${o.internalId} · ${o.place}`} back={me.view === 'forer' ? '/forer' : `/objekt/${o.id}`}
      footer={type ? <><Btn kind="ghost" onClick={() => setType(null)}>Tilbake</Btn><Btn kind="amber" icon="send" onClick={send}>Send til verksmester</Btn></> : undefined}>
      <div className="hstack"><ObjThumb o={o} className="lg" /><div className="grow"><p className="muted">{readingText(o)}</p>{openFault(s, o.id) && <Pill tone="bad">Har åpen feil</Pill>}</div></div>
      {!type && <>
        <h2>Hva vil du melde?</h2>
        <div className="grid2">
          {REPORT.map(([t, l, sub]) => <button key={t} className="bigbtn" onClick={() => setType(t)}><span className={'taskicon ' + t}>{TASK_ICON[t]}</span><b>{l}</b><small>{sub}</small></button>)}
        </div>
        <Btn kind="quiet" icon="camera" to={`/blinkskudd?obj=${o.id}`}>Ta blinkskudd til Topp 100</Btn>
      </>}
      {type && <>
        <h2>{TASK_LABEL[type]}</h2>
        <Field label={type === 'flytt' ? 'Hvor skal den?' : 'Hva gjelder det?'}><textarea value={text} onChange={e => setText(e.target.value)} placeholder={type === 'flytt' ? 'For eksempel: Bodø til Fauske innen mandag' : 'Kort beskrivelse'} autoFocus /></Field>
        {type === 'feil' && <PhotoField photo={photo} onPhoto={setPhoto} type={o.type} label="Bilde av feilen" hint="Gå tett på, så verksmester ser hva det gjelder" place={o.place} />}
        {o.type !== 'Redskap' && <Field label={`Bekreft ${o.meter === 'timer' ? 'timer' : 'km'}`} hint="Sjekkpunkt: du er ved maskinen nå, så tallet blir riktig" row><Num value={reading} onChange={setReading} /></Field>}
      </>}
    </Page>
  )
}

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
export function Skann() {
  const s = useS(), me = useMe()
  const [q, setQ] = useState('')
  const [cam, setCam] = useState<'av' | 'på' | 'nei'>('av')
  const video = useRef<HTMLVideoElement>(null)
  const objs = parkOf(s, me.company.id).filter(o => !q || `${o.name} ${o.internalId}`.toLowerCase().includes(q.toLowerCase()))
  useEffect(() => {
    if (cam !== 'på') return
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
    let stream: MediaStream | undefined, timer: ReturnType<typeof setInterval> | undefined, dead = false
    if (!BD || !navigator.mediaDevices?.getUserMedia) { setCam('nei'); return }
    const det = new BD({ formats: ['qr_code'] })
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(st => {
      if (dead) { st.getTracks().forEach(t => t.stop()); return }
      stream = st
      if (video.current) { video.current.srcObject = st; video.current.play().catch(() => undefined) }
      timer = setInterval(async () => {
        if (!video.current?.videoWidth) return
        try { const hit = (await det.detect(video.current))[0]?.rawValue.match(/#(\/q\/[\w-]+)/)?.[1]; if (hit) nav(hit) } catch { /* prøver igjen */ }
      }, 500)
    }).catch(() => setCam('nei'))
    return () => { dead = true; clearInterval(timer); stream?.getTracks().forEach(t => t.stop()) }
  }, [cam])
  return (
    <Page title="Skann QR" eyebrow="FleetM8" right={<TopActions />} sub="Skann koden på maskinen, eller finn den i listen.">
      {cam === 'av' && <Btn kind="amber" icon="qr" onClick={() => setCam('på')}>Åpne kameraet</Btn>}
      {cam === 'på' && <div className="scanbox"><video ref={video} playsInline muted /></div>}
      {cam === 'nei' && <Notice tone="plain" icon="info">Skanning med kamera virker ikke i denne nettleseren. Velg maskinen i listen under.</Notice>}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Søk på navn eller nummer" aria-label="Søk etter maskin" />
      <div className="list">{objs.map(o => <Row key={o.id} to={`/q/${o.id}`} thumb={<ObjThumb o={o} />} title={o.name} sub={objSub(o)} right={<Icon name="right" size={18} />} />)}</div>
    </Page>
  )
}

export function Forer() {
  const s = useS(), me = useMe()
  const mine = parkOf(s, me.company.id).filter(o => o.responsible === me.user.id)
  const sent = s.tasks.filter(t => t.reportedBy === me.user.id).slice(0, 12)
  const blinks = s.blinks.filter(b => b.takenBy === me.user.id).slice(0, 4)
  return (
    <Page title={`Hei, ${me.user.name.split(' ')[0]}`} eyebrow={me.company.name} right={<TopActions />}>
      <div className="grid2">
        <a className="bigbtn" {...link('/skann')}><span className="taskicon"><Icon name="qr" size={22} /></span><b>Skann QR</b><small>Meld feil, flytting eller service</small></a>
        <a className="bigbtn" {...link('/blinkskudd')}><span className="taskicon"><Icon name="camera" size={22} /></span><b>Blinkskudd</b><small>Ta bilde til Topp 100</small></a>
      </div>
      <Section title="Mine maskiner">
        {!mine.length && <p className="hint">Du står ikke som ansvarlig for noen maskiner. Skann QR-koden på maskinen du bruker.</p>}
        {mine.map(o => <Row key={o.id} to={`/q/${o.id}`} thumb={<ObjThumb o={o} />} title={o.name} sub={objSub(o)} right={openFault(s, o.id) ? <Pill tone="bad">Åpen feil</Pill> : <Icon name="right" size={18} />} />)}
      </Section>
      <Section title="Mine meldinger">
        {!sent.length && <p className="hint">Du har ikke sendt noen meldinger ennå.</p>}
        {sent.map(t => <Row key={t.id} thumb={<span className={'taskicon ' + t.type}>{TASK_ICON[t.type]}</span>} title={t.title} sub={`${ob(s, t.objId)?.name ?? ''} · ${rel(t.at)}`} right={<Pill tone={t.status === 'utfort' ? 'ok' : t.status === 'arbeid' ? 'info' : 'warn'}>{t.status === 'utfort' ? 'Utført' : t.status === 'arbeid' ? 'Under arbeid' : 'Sendt'}</Pill>} />)}
      </Section>
      {blinks.length > 0 && <Section title="Mine blinkskudd">
        {blinks.map(b => <Row key={b.id} to="/blinkskudd" thumb={<Thumb src={b.photo.src} type={b.objType} />} title={b.objName} sub={rel(b.at)} right={<Pill tone={b.status === 'godkjent' ? 'ok' : b.status === 'venter' ? 'warn' : 'mute'}>{{ venter: 'Venter', godkjent: 'Med i Topp 100', underkjent: 'Underkjent', erstattet: 'Erstattet', arkivert: 'Arkivert' }[b.status]}</Pill>} />)}
      </Section>}
    </Page>
  )
}
