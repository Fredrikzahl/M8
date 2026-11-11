import { useEffect, useState } from 'react'
import type { HistEvent, ID, Listing, Obj, ObjType, Photo, State } from '../types'
import { Avatar, Btn, Card, Empty, KV, Page, Pill, Sheet, Stars, Stat, Thumb } from '../ui/kit'
import { Icon } from '../ui/icons'
import { nav } from '../router'
import { co, insuranceStatus, profileStats, ratingOf, useMe, useS } from '../store'
import { COVERAGE_LABEL, fmtDate, fmtDT, kr, meterUnit, num, parseNum, UNIT_LABEL, VIEW_LABEL } from '../lib/util'
import { img } from '../lib/images'
import { myNotes } from '../actions'

export const qs = (path: string) => new URLSearchParams(path.split('?')[1] ?? '')
export const priceText = (l: Pick<Listing, 'mode' | 'price' | 'unit'>) => (l.mode === 'salg' ? kr(l.price) : `${kr(l.price)} ${UNIT_LABEL[l.unit]}`)
export const readingText = (o: Pick<Obj, 'reading' | 'meter' | 'type'>) => (o.type === 'Redskap' ? '' : `${num(o.reading)} ${meterUnit(o.meter)}`)
export const objSub = (o: Obj) => [o.internalId, o.place, readingText(o)].filter(Boolean).join(' · ')
/** Annonsebildet: blinkskuddet når selgeren har valgt det, ellers første bilde på objektkortet. */
export const listingSrc = (s: State, l: Listing, o: Obj) =>
  (l.useBlink ? s.blinks.find(b => b.objId === o.id && b.status === 'godkjent')?.photo.src : undefined) ?? o.photos[0]?.src
export const VIS_LABEL = { partnere: 'Partnere', utvalgte: 'Utvalgte', alle: 'Alle', lenke: 'Bare med lenke' } as const

export function Missing({ what = 'siden' }: { what?: string }) {
  return (
    <Page title="Ikke funnet" back>
      <Empty title={`Fant ikke ${what}`} text="Den kan være fjernet, eller du har ikke tilgang med denne brukeren.">
        <Btn to="/">Til forsiden</Btn>
      </Empty>
    </Page>
  )
}

// Skallet (App) eier arket for visningsbytte. Skjermene åpner det herfra.
let opener: () => void = () => undefined
export const shell = { setOpener(f: () => void) { opener = f }, openViews() { opener() } }

/** Varselbjelle og visningsbytte øverst på hovedskjermene. */
export function TopActions() {
  const s = useS(), me = useMe()
  const unread = myNotes(s, me).filter(n => !n.read).length
  return (
    <>
      <button className="iconbtn" style={{ position: 'relative' }} aria-label={unread ? `Varsler, ${unread} uleste` : 'Varsler'} onClick={() => nav('/varsler')}>
        <Icon name="bell" size={20} />{unread > 0 && <span className="dot">{unread}</span>}
      </button>
      <button className="viewbtn" onClick={() => shell.openViews()} aria-label={`Bytt visning. Nå: ${VIEW_LABEL[me.view]}`}><Icon name="swap" size={14} />{VIEW_LABEL[me.view].split(' ')[0]}</button>
    </>
  )
}

export function Num({ value, onChange, placeholder, label }: { value: number | null | undefined; onChange: (n: number) => void; placeholder?: string; label?: string }) {
  const [t, setT] = useState(value == null ? '' : String(value))
  useEffect(() => { if (parseNum(t) !== (value ?? 0)) setT(value == null ? '' : String(value)) }, [value]) // eslint-disable-line
  return <input inputMode="decimal" value={t} placeholder={placeholder} aria-label={label} onChange={e => { setT(e.target.value); onChange(parseNum(e.target.value)) }} />
}
export const PlaceInput = ({ value, onChange, label = 'Sted' }: { value: string; onChange: (v: string) => void; label?: string }) =>
  <input list="steder" value={value} aria-label={label} placeholder="Sted" onChange={e => onChange(e.target.value)} />

/** Bedriftsprofil slik motparten ser den: verifisering, vurderinger, historikk og forsikring. */
export function CompanyCard({ id, full, title }: { id: ID; full?: boolean; title?: string }) {
  const s = useS(), c = co(s, id)
  if (!c) return null
  const r = ratingOf(s, id), st = profileStats(s, id)
  const reviews = s.ratings.filter(x => x.toCompanyId === id && x.text).slice(0, 4)
  return (
    <Card>
      {title && <p className="eyebrow">{title}</p>}
      <div className="hstack">
        <Avatar name={c.name} />
        <div className="grow"><h3>{c.name}</h3><p className="hint">Org.nr. {c.orgnr} · {c.place}</p></div>
        {c.verified ? <Pill tone="ok"><Icon name="shield" size={13} />Verifisert</Pill> : <Pill tone="warn">Ikke verifisert</Pill>}
      </div>
      <div className="hstack wrap"><Stars value={r.avg} n={r.n} />{c.responseHours != null && <small>Svarer vanligvis innen {c.responseHours} t</small>}</div>
      <div className="stats">
        <Stat label="Leieforhold" value={st.rentals} />
        <Stat label="Handler" value={st.deals} />
        <Stat label="Skader" value={st.damages} />
      </div>
      {st.damages > 0 && <p className="hint">{st.damagesSettled ? 'Alle skader er gjort opp.' : 'Har et krav som er bestridt.'}</p>}
      <div className="hstack wrap">{insuranceStatus(c).map(i => <Pill key={i.text} tone={i.tone}>{i.text}</Pill>)}{c.transport?.permit && <Pill tone="ok">Løyve</Pill>}</div>
      {full && c.insurance.length > 0 && (
        <KV rows={c.insurance.map(i => [COVERAGE_LABEL[i.coverage], `${i.insurer}, polise ${i.policyNo}, til ${fmtDate(i.expires, true)}`])} />
      )}
      {full && reviews.map(x => <p key={x.id} className="hint">«{x.text}» <b>{x.stars}/5</b> fra {co(s, x.fromCompanyId)?.name}</p>)}
    </Card>
  )
}

export function Gallery({ photos, type }: { photos: Photo[]; type: ObjType }) {
  const [open, setOpen] = useState<Photo | null>(null)
  if (!photos.length) return <p className="hint">Ingen bilder ennå.</p>
  return (
    <>
      <div className="shots">
        {photos.map(p => <button key={p.id} className="shotbox" onClick={() => setOpen(p)} aria-label={`Vis bilde${p.angle ? ': ' + p.angle : ''}`}><Thumb src={p.src} type={type} alt={p.angle ?? ''} />{p.angle && <span>{p.angle}</span>}</button>)}
      </div>
      {open && (
        <Sheet title={open.angle ?? 'Bilde'} onClose={() => setOpen(null)}>
          {img(open.src) ? <img src={img(open.src)} alt={open.angle ?? 'Bilde'} style={{ width: '100%', borderRadius: 12 }} /> : <div style={{ aspectRatio: '4 / 3' }}><Thumb src={undefined} type={type} className="fill" /></div>}
          <KV rows={[
            ['Tatt', fmtDT(open.at)], ['Sted', open.place ?? 'Ikke lagret'],
            ['Posisjon', open.pos ? `${open.pos.lat}, ${open.pos.lon}` : 'Ikke lagret'],
            ['Kilde', open.source === 'app' ? 'Tatt i appen' : open.source === 'opplastet' ? 'Lastet opp' : 'Demobilde'],
          ]} />
        </Sheet>
      )}
    </>
  )
}

export const History = ({ events, max = 30 }: { events: HistEvent[]; max?: number }) => (
  <div className="hist">
    {events.slice(0, max).map(h => <div key={h.id}><span>{h.text}{h.by && <small> · {h.by}</small>}</span><small>{fmtDate(h.at)}</small></div>)}
    {!events.length && <p className="hint">Ingen hendelser ennå.</p>}
  </div>
)

/** Sammendrag av gebyrmodellen som er valgt i demoinnstillingene. */
export function FeeNote({ amount, side }: { amount: number; side: 'utleier' | 'leietaker' }) {
  const s = useS(), m = s.settings.feeModel
  if (m === 'ingen') return <p className="hint">Gebyrmodellen er ikke bestemt, så ingen gebyr er lagt til. Den kan prøves under Demo-innstillinger.</p>
  const pct = { en_prosent: [1, 0], ti_ti: [10, 10], tjuefem: [25, 0] }[m]
  const p = side === 'utleier' ? pct[0] : pct[1]
  if (!p) return <p className="hint">Ingen gebyr for {side} i valgt modell.</p>
  return <p className="hint">Plattformgebyr for {side}: {p} % = {kr((amount * p) / 100)} (valgt modell i demoen).</p>
}
