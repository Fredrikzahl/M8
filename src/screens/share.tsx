import { useEffect, useRef, useState } from 'react'
import type { ID, Lead, LeadType, Obj, ShareParts } from '../types'
import { Avatar, Btn, Card, Chips, Empty, Field, KV, Notice, Page, Pill, Row, Section, Seg, Sheet, Thumb, Toggle, Wordmark, ask, toast } from '../ui/kit'
import { QrSvg } from '../ui/widgets'
import { Icon } from '../ui/icons'
import { nav } from '../router'
import { co, coName, meOf, ob, ratingOf, useMe, useS, userName } from '../store'
import { answerLead, createLead, createShare, offerLead, openLead, openShare, revokeShare } from '../actions'
import { fmtDate, fmtDT, kr, LEAD_LABEL, LEAD_PARTNER, meterUnit, num, PARTNER_LABEL, rel, tonn } from '../lib/util'
import { appUrl, copyText, inArtifact } from '../lib/files'
import { Gallery, Missing, Num, TopActions, priceText, readingText } from './common'

// ---------- Leads til leverandører ----------
const leadText = (type: LeadType, o?: Obj) => !o ? { redskap: 'Ønsker pris på redskap.', innbytte: 'Ønsker tilbud på innbytte.', service: 'Trenger service.', takst: 'Ønsker takst.', finans: 'Ønsker tilbud på finansiering.', forsikring: 'Ønsker tilbud på forsikring.' }[type] : {
  redskap: `Ønsker pris på redskap til ${o.name}.`,
  innbytte: `Vurderer å bytte ut ${o.name} (${o.year}, ${readingText(o)}). Hva kan dere tilby i innbytte?`,
  service: `Trenger service på ${o.name}.`, takst: `Ønsker takst av ${o.name} (${o.year}).`,
  finans: `Ønsker tilbud på finansiering knyttet til ${o.name}.`, forsikring: `Ønsker tilbud på forsikring av ${o.name}.`,
}[type]

export function LeadSheet({ type, objId, text: initial, onClose }: { type: LeadType; objId?: ID; text?: string; onClose: () => void }) {
  const s = useS(), me = useMe(), o = ob(s, objId)
  const suppliers = s.companies.filter(c => c.partnerKinds.includes(LEAD_PARTNER[type]) && c.id !== me.company.id).sort((a, b) => Number(b.id === 'po') - Number(a.id === 'po'))
  const [to, setTo] = useState<string[]>(suppliers.slice(0, 1).map(c => c.id))
  const [text, setText] = useState(initial ?? leadText(type, o))
  const [consent, setConsent] = useState(false)
  const send = () => {
    if (!to.length) { toast('Velg minst én leverandør', 'bad'); return }
    if (!consent) { toast('Du må samtykke til at opplysningene deles', 'bad'); return }
    createLead(type, text.trim(), to, objId); toast(`Forespørselen er sendt til ${to.length} ${to.length === 1 ? 'leverandør' : 'leverandører'}`, 'ok'); onClose()
  }
  return (
    <Sheet title={LEAD_LABEL[type]} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>Avbryt</Btn><Btn kind="amber" icon="send" onClick={send}>Send forespørsel</Btn></>}>
      {o && <Row thumb={<Thumb src={o.photos[0]?.src} type={o.type} />} title={o.name} sub={`${o.year} · ${readingText(o)} · ${o.place}`} />}
      <Field label="Hva trenger du?"><textarea value={text} onChange={e => setText(e.target.value)} /></Field>
      <h2>Velg leverandører</h2>
      {!suppliers.length && <p className="hint">Ingen leverandører av denne typen er registrert ennå.</p>}
      {suppliers.map(c => { const r = ratingOf(s, c.id), on = to.includes(c.id); return (
        <label key={c.id} className="checkline card tight">
          <input type="checkbox" checked={on} onChange={() => setTo(on ? to.filter(x => x !== c.id) : [...to, c.id])} />
          <span className="grow"><b>{c.name}</b><br /><small>{PARTNER_LABEL[LEAD_PARTNER[type]]} · {c.place}{r.avg != null ? ` · ${r.avg.toLocaleString('nb-NO')} av 5` : ''}{c.responseHours ? ` · svarer innen ${c.responseHours} t` : ''}</small></span>
          {c.id === 'po' && <Pill tone="warn">Sponset</Pill>}
        </label>
      ) })}
      <label className="checkline"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Jeg samtykker til at {o ? 'type, modell, årsmodell, timer og sted for objektet, og ' : ''}kontaktopplysningene mine deles med leverandørene jeg har valgt.</span></label>
      <p className="hint">Leverandørene får ikke tilgang til parken din. Sponset plassering er alltid merket.</p>
    </Sheet>
  )
}

const LEAD_STATUS: Record<Lead['status'], [string, string]> = { sendt: ['Sendt', 'info'], apnet: ['Åpnet', 'info'], tilbud: ['Tilbud mottatt', 'amber'], akseptert: ['Akseptert', 'ok'], avslatt: ['Avslått', 'mute'] }

export function Leads() {
  const s = useS(), me = useMe()
  const [type, setType] = useState<LeadType | null>(null)
  const [objId, setObjId] = useState('')
  const [open, setOpen] = useState(false)
  const mine = s.leads.filter(l => l.fromCompanyId === me.company.id)
  const objs = s.objects.filter(o => o.companyId === me.company.id && !o.archived)
  return (
    <Page title="Forespørsler til leverandører" eyebrow="PlanM8" back="/mer" wide sub="Be om pris på redskap, innbytte, service, takst, finansiering eller forsikring.">
      <Card>
        <h2>Ny forespørsel</h2>
        <Chips single value={type ? [type] : []} options={(Object.keys(LEAD_LABEL) as LeadType[]).map(k => [k, LEAD_LABEL[k]] as [LeadType, string])} onChange={v => setType(v[0] ?? null)} />
        {type && <>
          <Field label="Gjelder objekt" hint="Valgfritt"><select value={objId} onChange={e => setObjId(e.target.value)}><option value="">Ikke et bestemt objekt</option>{objs.map(o => <option key={o.id} value={o.id}>{o.name} · {o.internalId}</option>)}</select></Field>
          <Btn kind="amber" onClick={() => setOpen(true)}>Velg leverandører</Btn>
        </>}
      </Card>
      {!mine.length && <Empty title="Ingen forespørsler ennå" text="Svar og tilbud fra leverandørene samles her." />}
      <div className="cols">
        {mine.map(l => { const o = ob(s, l.objId), [label, tone] = LEAD_STATUS[l.status]; return (
          <Card key={l.id}>
            <div className="hstack between"><p className="eyebrow">{LEAD_LABEL[l.type]}</p><Pill tone={tone}>{label}</Pill></div>
            <div className="hstack between"><h3>{coName(s, l.toCompanyId)}</h3>{l.sponsored && <Pill tone="warn">Sponset</Pill>}</div>
            {o && <p className="hint">Gjelder {o.name}</p>}
            <p className="muted">{l.text}</p>
            {l.offer && <div className="msg" style={{ maxWidth: '100%' }}><b>Tilbud{l.offer.amount ? `: ${kr(l.offer.amount)}` : ''}</b><br />{l.offer.text}<small>{rel(l.offer.at)}</small></div>}
            {l.status === 'tilbud' && <div className="hstack"><Btn kind="amber" small onClick={() => { answerLead(l.id, true); toast('Du har takket ja. Leverandøren tar kontakt.', 'ok') }}>Takk ja</Btn><Btn kind="ghost" small onClick={() => answerLead(l.id, false)}>Takk nei</Btn></div>}
            <small>Sendt {rel(l.at)} av {userName(s, l.fromUserId)}</small>
          </Card>
        ) })}
      </div>
      {open && type && <LeadSheet type={type} objId={objId || undefined} onClose={() => { setOpen(false); setType(null) }} />}
    </Page>
  )
}

export function PartnerInbox() {
  const s = useS(), me = useMe()
  const [offer, setOffer] = useState<string | null>(null)
  const [f, setF] = useState({ text: '', amount: 0 })
  const leads = s.leads.filter(l => l.toCompanyId === me.company.id)
  const price = s.settings.leadPrice
  return (
    <Page title="Forespørsler" eyebrow={me.company.partnerKinds.map(k => PARTNER_LABEL[k]).join(', ') || 'Partner'} right={<TopActions />} wide sub="Du ser bare det kunden har valgt å dele med deg.">
      {price > 0 && <Notice tone="plain" icon="money">Pris per forespørsel i demoen: {kr(price)}.</Notice>}
      {!leads.length && <Empty title="Ingen forespørsler ennå" text="Når en bedrift ber om tilbud fra deg, kommer forespørselen hit." />}
      <div className="cols">
        {leads.map(l => { const o = ob(s, l.objId), c = co(s, l.fromCompanyId), [label, tone] = LEAD_STATUS[l.status]; return (
          <Card key={l.id}>
            <div className="hstack between"><p className="eyebrow">{LEAD_LABEL[l.type]}</p><Pill tone={l.status === 'sendt' ? 'amber' : tone}>{l.status === 'sendt' ? 'Ny' : l.status === 'tilbud' ? 'Tilbud sendt' : label}</Pill></div>
            <div className="hstack"><Avatar name={c?.name ?? '?'} size={36} /><div className="grow"><h3>{c?.name}</h3><p className="hint">{c?.place} · {userName(s, l.fromUserId)}</p></div></div>
            <p>{l.text}</p>
            {o && <KV rows={[['Objekt', `${o.type}${o.model ? ' ' + o.model : ''}`], ['Årsmodell', o.year], [o.meter === 'timer' ? 'Timer' : 'Kilometer', `${num(o.reading)} ${meterUnit(o.meter)}`], ['Sted', o.place], ['Vekt', tonn(o.weightKg)]]} />}
            {l.sponsored && <p className="hint">Du vises med sponset plassering hos kunden.</p>}
            {l.offer && <div className="msg me" style={{ maxWidth: '100%' }}><b>Ditt tilbud{l.offer.amount ? `: ${kr(l.offer.amount)}` : ''}</b><br />{l.offer.text}</div>}
            {l.status === 'sendt' && <Btn kind="quiet" small onClick={() => openLead(l.id)}>Marker som åpnet</Btn>}
            {(l.status === 'sendt' || l.status === 'apnet') && <Btn kind="amber" small onClick={() => { openLead(l.id); setF({ text: '', amount: 0 }); setOffer(l.id) }}>Send tilbud</Btn>}
            <small>Mottatt {rel(l.at)}</small>
          </Card>
        ) })}
      </div>
      {offer && (
        <Sheet title="Send tilbud" onClose={() => setOffer(null)} footer={<><Btn kind="ghost" onClick={() => setOffer(null)}>Avbryt</Btn><Btn kind="amber" onClick={() => { if (!f.text.trim()) { toast('Beskriv tilbudet', 'bad'); return } offerLead(offer, f.text.trim(), f.amount || undefined); setOffer(null); toast('Tilbudet er sendt', 'ok') }}>Send</Btn></>}>
          <Field label="Tilbud"><textarea value={f.text} onChange={e => setF({ ...f, text: e.target.value })} placeholder="Hva tilbyr du, og når kan det leveres?" /></Field>
          <Field label="Pris i kroner" hint="Valgfritt"><Num value={f.amount || null} onChange={v => setF({ ...f, amount: v })} /></Field>
        </Sheet>
      )}
    </Page>
  )
}

// ---------- Send maskin ----------
const PARTS: [keyof ShareParts, string, boolean][] = [
  ['bilder', 'Bilder', false], ['spes', 'Spesifikasjoner', false], ['redskap', 'Redskap', false],
  ['timer', 'Timer og bruk', true], ['sert', 'Sertifikater og dokumenter', true], ['service', 'Servicehistorikk', true],
]

export function SendMaskin({ id }: { id: string }) {
  const s = useS(), me = useMe(), o = ob(s, id)
  const [parts, setParts] = useState<ShareParts>({ bilder: true, spes: true, timer: true, redskap: true, sert: false, service: false })
  const [access, setAccess] = useState<'std' | 'full'>('std')
  const [recipient, setRecipient] = useState('')
  const [channel, setChannel] = useState<'epost' | 'sms' | 'lenke'>('lenke')
  const [days, setDays] = useState('30')
  const [cta, setCta] = useState<'leie' | 'pris' | 'ingen'>(o?.status === 'til_salgs' ? 'pris' : 'leie')
  const [made, setMade] = useState<string | null>(null)
  if (!o || o.companyId !== me.company.id) return <Missing what="objektet" />
  const shares = s.shares.filter(x => x.objId === o.id)
  const fresh = shares.find(x => x.id === made)
  const url = (t: string) => appUrl(`/p/${t}`)
  const create = () => {
    if (channel !== 'lenke' && !recipient.trim()) { toast(channel === 'epost' ? 'Skriv inn e-postadressen til mottakeren' : 'Skriv inn mobilnummeret til mottakeren', 'bad'); return }
    setMade(createShare({ objId: o.id, parts, access, recipient: recipient.trim(), channel, days: Number(days) || null, cta })); toast('Presentasjonen er laget', 'ok')
  }
  const copy = async (t: string) => toast((await copyText(url(t))) ? 'Lenken er kopiert' : 'Kunne ikke kopiere lenken', 'ok')
  return (
    <Page title="Send maskin" eyebrow={o.name} back={`/objekt/${o.id}`} sub="Lag en presentasjon av maskinen og del den med en kunde, uten at mottakeren trenger konto.">
      {fresh ? (
        <Card>
          <Notice tone="ok" icon="check">Presentasjonen er klar.</Notice>
          <div className="qrcard" style={{ border: 'none', padding: 0 }}><QrSvg text={url(fresh.token)} size={170} /></div>
          <p className="hint center" style={{ overflowWrap: 'anywhere' }}>{url(fresh.token)}</p>
          {fresh.smsCode && <Notice tone="plain" icon="lock">Engangskode til mottakeren: <b>{fresh.smsCode}</b><small>I den ferdige appen sendes koden på SMS.</small></Notice>}
          <div className="hstack wrap"><Btn kind="amber" icon="copy" onClick={() => copy(fresh.token)}>Kopier lenke</Btn><Btn kind="quiet" icon="eye" to={`/p/${fresh.token}`}>Åpne som mottaker</Btn></div>
          <p className="hint">{inArtifact() ? 'I forhåndsvisningen virker lenken bare inne i denne visningen. ' : ''}Sending på e-post og SMS er ikke koblet til, så kopier lenken og send den selv. Fordi demoen lagrer data lokalt, kan lenken bare åpnes i denne nettleseren.</p>
          <Btn kind="ghost" onClick={() => setMade(null)}>Lag en ny</Btn>
        </Card>
      ) : <>
        <Section title="Hva skal med?">
          <Card>{PARTS.map(([k, label, sens]) => <Toggle key={k} on={parts[k]} onChange={v => setParts({ ...parts, [k]: v })} label={label} sub={sens ? 'Vises bare for dem som har tilgang' : 'Åpent for alle med lenken'} />)}</Card>
        </Section>
        <Section title="Tilgang">
          <Seg value={access} onChange={setAccess} options={[['std', 'Standard'], ['full', 'Full med kode']]} />
          <p className="hint">{access === 'std' ? 'Bilder og hoveddata er åpne. Timer, sertifikater og service vises bare for innloggede bedrifter.' : 'Hele presentasjonen låses med en engangskode som mottakeren får på SMS. Da vises alt du har valgt.'}</p>
        </Section>
        <Section title="Mottaker">
          <Seg value={channel} onChange={setChannel} options={[['lenke', 'Bare lenke'], ['epost', 'E-post'], ['sms', 'SMS']]} />
          {channel !== 'lenke' && <input value={recipient} onChange={e => setRecipient(e.target.value)} type={channel === 'epost' ? 'email' : 'tel'} placeholder={channel === 'epost' ? 'navn@firma.no' : 'Mobilnummer'} aria-label="Mottaker" />}
          <div className="grid2">
            <Field label="Gyldig i"><select value={days} onChange={e => setDays(e.target.value)}><option value="7">7 dager</option><option value="30">30 dager</option><option value="0">Uten utløp</option></select></Field>
            <Field label="Knapp nederst"><select value={cta} onChange={e => setCta(e.target.value as typeof cta)}><option value="leie">Spør om leie</option><option value="pris">Be om pris</option><option value="ingen">Ingen knapp</option></select></Field>
          </div>
        </Section>
        <Btn kind="amber" icon="send" onClick={create}>Lag presentasjon</Btn>
      </>}

      <Section title="Tidligere delinger">
        {!shares.length && <p className="hint">Maskinen er ikke delt ennå.</p>}
        {shares.map(x => {
          const expired = !!x.expiresAt && new Date(x.expiresAt).getTime() < Date.now()
          return (
            <Card key={x.id} className="tight">
              <div className="hstack between"><b>{x.recipient || 'Delingslenke'}</b><Pill tone={x.revoked ? 'mute' : expired ? 'mute' : x.opens.length ? 'ok' : 'info'}>{x.revoked ? 'Trukket tilbake' : expired ? 'Utløpt' : x.opens.length ? `Åpnet ${x.opens.length} ${x.opens.length === 1 ? 'gang' : 'ganger'}` : 'Ikke åpnet'}</Pill></div>
              <small>Laget {fmtDate(x.createdAt)} · {x.access === 'full' ? 'full tilgang med kode' : 'standard tilgang'} · {x.expiresAt ? `gyldig til ${fmtDate(x.expiresAt)}` : 'uten utløp'}</small>
              {x.opens.length > 0 && <small>Sist åpnet {fmtDT(x.opens[x.opens.length - 1].at)} ({x.opens[x.opens.length - 1].as})</small>}
              {!x.revoked && !expired && <div className="hstack wrap">
                <Btn kind="quiet" small icon="copy" onClick={() => copy(x.token)}>Kopier lenke</Btn>
                <Btn kind="quiet" small icon="eye" to={`/p/${x.token}`}>Åpne</Btn>
                <Btn kind="ghost" small onClick={async () => { if (await ask('Trekke tilbake presentasjonen? Lenken slutter å virke med en gang.', 'Trekk tilbake', true)) { revokeShare(x.id); toast('Presentasjonen er trukket tilbake') } }}>Trekk tilbake</Btn>
              </div>}
            </Card>
          )
        })}
      </Section>
    </Page>
  )
}

/** Det mottakeren ser når de åpner lenken fra «Send maskin». Krever ikke konto. */
export function Presentation({ token }: { token: string }) {
  const s = useS(), me = meOf(s)
  const sh = s.shares.find(x => x.token === token)
  const [code, setCode] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const logged = useRef(false)
  const expired = !!sh?.expiresAt && new Date(sh.expiresAt).getTime() < Date.now()
  const own = !!sh && me?.company.id === sh.companyId
  useEffect(() => {
    if (sh && !sh.revoked && !expired && !own && !logged.current) { logged.current = true; openShare(token, me ? me.company.name : 'Uten konto') }
  }, [token]) // eslint-disable-line
  const o = ob(s, sh?.objId)
  const dead = !sh || !o ? 'Lenken finnes ikke i denne nettleseren. Demoen lagrer data lokalt, så en presentasjon kan bare åpnes der den ble laget.'
    : sh.revoked ? 'Avsenderen har trukket tilbake presentasjonen.' : expired ? 'Lenken er utløpt. Be avsenderen om en ny.' : null
  if (dead || !sh || !o) {
    return <div className="login-pres"><Wordmark a="Plan" tone="plain" size={32} /><Empty icon="lock" title="Presentasjonen er ikke tilgjengelig" text={dead ?? ''}><Btn kind="amber" onClick={() => nav('/', true)}>Til PlanM8</Btn></Empty></div>
  }
  const c = co(s, sh.companyId)!
  const needCode = sh.access === 'full' && !unlocked && !own
  const seeAll = own || (sh.access === 'full' ? unlocked : !!me)
  const listing = s.listings.find(l => l.objId === o.id && l.active)
  const hidden = PARTS.filter(([k, , sens]) => sens && sh.parts[k]).map(([, l]) => l.toLowerCase())
  const cta = () => {
    if (!me) { toast('Logg inn eller registrer bedriften for å ta kontakt'); nav('/login'); return }
    if (listing) nav(`/maskin/${listing.id}?t=${listing.linkToken}`); else toast(`Ta kontakt med ${c.name} for ${sh.cta === 'leie' ? 'leie' : 'pris'}`)
  }
  return (
    <div className="login-pres">
      <div className="hstack between"><Wordmark a="Plan" tone="plain" size={30} />{me && <Btn kind="ghost" small onClick={() => nav(own ? `/send/${o.id}` : '/', true)}>Tilbake til appen</Btn>}</div>
      {own && <Notice tone="plain" icon="eye">Slik ser mottakeren presentasjonen. Åpninger fra deg selv telles ikke.</Notice>}
      {needCode ? (
        <div className="pres"><div className="pres-b">
          <h1>Presentasjon fra {c.name}</h1>
          <p className="muted">Skriv inn engangskoden du har fått på SMS for å åpne presentasjonen.</p>
          <input inputMode="numeric" value={code} onChange={e => setCode(e.target.value)} placeholder="Firesifret kode" aria-label="Engangskode" maxLength={4} />
          <Btn kind="amber" onClick={() => { if (code.trim() === sh.smsCode) setUnlocked(true); else toast('Koden stemmer ikke', 'bad') }}>Åpne</Btn>
          <p className="hint">Demo: SMS sendes ikke. Koden står hos avsenderen under «Send maskin».</p>
        </div></div>
      ) : (
        <div className="pres">
          <div className="hero" style={{ maxHeight: 300 }}><Thumb src={o.photos[0]?.src} type={o.type} alt={o.name} /><div className="hero-grad"><h1>{o.name}</h1><p>{[o.make, o.model, o.year].filter(Boolean).join(' · ')} · {o.place}</p></div></div>
          <div className="pres-b">
            <div className="hstack"><Avatar name={c.name} size={36} /><div className="grow"><b>{c.name}</b><br /><small>{c.verified ? 'Verifisert bedrift' : 'Bedrift'} · {c.place}</small></div>{listing && <b>{priceText(listing)}</b>}</div>
            {sh.parts.bilder && <Section title="Bilder"><Gallery photos={o.photos} type={o.type} /></Section>}
            {sh.parts.spes && <Section title="Spesifikasjoner"><KV rows={[['Type', o.type], ['Årsmodell', o.year], ['Vekt', tonn(o.weightKg)], ...Object.entries(o.specs)]} /></Section>}
            {sh.parts.redskap && <Section title="Redskap">{o.attachments.length ? <div className="tags">{o.attachments.map(a => <span key={a} className="tagbox">{a}</span>)}</div> : <p className="hint">Ingen redskap følger med.</p>}</Section>}
            {seeAll ? <>
              {sh.parts.timer && <Section title="Timer og bruk"><KV rows={[[o.meter === 'timer' ? 'Timer' : 'Kilometer', readingText(o)], ['Sist bekreftet', fmtDate(o.readingAt, true)], ['Tilstand', `${o.condition} av 5`]]} /></Section>}
              {sh.parts.sert && <Section title="Sertifikater og dokumenter"><KV rows={o.docs.map(d => [d.name, fmtDate(d.at, true)])} />{!o.docs.length && <p className="hint">Ingen dokumenter.</p>}</Section>}
              {sh.parts.service && <Section title="Servicehistorikk"><KV rows={o.history.filter(h => h.type === 'service' || h.type === 'oppgave').slice(0, 8).map(h => [fmtDate(h.at, true), h.text])} />{!o.history.some(h => h.type === 'service' || h.type === 'oppgave') && <p className="hint">Ingen service er registrert.</p>}</Section>}
            </> : hidden.length > 0 && (
              <div className="blurbox">
                <div aria-hidden="true"><b>Timer og bruk</b><span>0 000 timer · sist bekreftet 00.00</span><b>Dokumenter</b><span>Samsvarserklæring · sikkerhetskontroll</span></div>
                <div><Icon name="lock" size={22} /><b>Logg inn for å se {hidden.join(', ')}</b><Btn kind="primary" small onClick={() => nav('/login')}>Logg inn eller registrer bedrift</Btn></div>
              </div>
            )}
            {sh.cta !== 'ingen' && !own && <Btn kind="amber" block onClick={cta}>{sh.cta === 'leie' ? 'Spør om leie' : 'Be om pris'}</Btn>}
            <p className="hint center">Delt med PlanM8{sh.expiresAt ? ` · gyldig til ${fmtDate(sh.expiresAt, true)}` : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}
