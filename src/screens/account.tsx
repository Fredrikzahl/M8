import { useEffect, useState } from 'react'
import type { Coverage, FeeModel, Role } from '../types'
import { Avatar, Btn, Card, Chips, Empty, Field, KV, Notice, Page, Pill, Row, Section, Seg, Sheet, Stars, Toggle, Wordmark, ask, toast } from '../ui/kit'
import { Icon } from '../ui/icons'
import { back, nav } from '../router'
import { co, coName, isAdmin, meOf, ratingOf, store, useMe, useS, userName, viewsFor } from '../store'
import {
  addInsurance, addUser, login, logout, myNotes, pickWinner, readNotes, registerCompany, removeInsurance, setConsent, setRoles, setSettings,
  togglePartner, updateCompany,
} from '../actions'
import { COVERAGE_LABEL, fmtDate, PARTNER_LABEL, rel, ROLE_LABEL, today, addDays, dateOnly, now } from '../lib/util'
import { FEE_LABEL } from '../lib/logic'
import { saveFile } from '../lib/files'
import { setTheme, useTheme } from '../lib/theme'
import { promptInstall, useInstall } from '../lib/install'
import { CompanyCard, Num, PlaceInput, TopActions } from './common'

const BLURB: Record<string, string> = {
  kari: 'Leder. Ser parken, utleie, rapporter og økonomi.', jonas: 'Administrator. Annonser, forespørsler og mottakskontroll.',
  marte: 'Verksmester. Tar imot feil, flytting og service.', ola: 'Fører. Skanner QR, melder feil og tar blinkskudd.', ingrid: 'Fører i Avd. Sør.',
  nils: 'Kjøper og leietaker. Leier en hjullaster akkurat nå.', tone: 'Leietaker. Forsikringen utløper snart.', mats: 'Ny bedrift uten forsikringsbevis.',
  per: 'Transportør med løyve og ledige turer.', heidi: 'Spesialtransport med løyve.', lars: 'Varetransport uten løyve.', vera: 'Utleier med maskiner i markedet.',
  dag: 'Maskinforhandler. Får forespørsler om innbytte.', bente: 'Verksted. Får serviceforespørsler.', sture: 'Takstmann.', pia: 'Redskapsleverandør med sponset plassering.',
  finn: 'Finanspartner.', hanne: 'Forsikringspartner.', knut: 'Maskinforhandler.',
}
const MAIN = ['kari', 'marte', 'ola', 'nils', 'per', 'dag']

export function Login() {
  const s = useS(), me = meOf(s)
  const [all, setAll] = useState(false)
  const [reg, setReg] = useState(false)
  const [f, setF] = useState({ orgnr: '', name: '', place: '', userName: '', email: '', verified: false })
  const [look, setLook] = useState<'' | 'søker' | 'funnet' | 'feil'>('')
  const users = s.users.filter(u => all || MAIN.includes(u.id) || !BLURB[u.id])
  const pick = (id: string) => { login(id); nav('/', true) }
  const lookup = async () => {
    const nr = f.orgnr.replace(/\D/g, '')
    if (nr.length !== 9) { toast('Organisasjonsnummeret skal ha ni siffer', 'bad'); return }
    setLook('søker')
    try {
      const res = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${nr}`)
      if (!res.ok) throw new Error('ikke funnet')
      const e = await res.json() as { navn?: string; forretningsadresse?: { poststed?: string } }
      const place = (e.forretningsadresse?.poststed ?? '').toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase())
      setF(x => ({ ...x, name: e.navn ?? x.name, place: place || x.place, verified: true })); setLook('funnet')
    } catch { setLook('feil'); setF(x => ({ ...x, verified: false })) }
  }
  const submit = () => {
    if (f.orgnr.replace(/\D/g, '').length !== 9 || !f.name.trim() || !f.userName.trim()) { toast('Fyll inn organisasjonsnummer, bedriftsnavn og ditt navn', 'bad'); return }
    registerCompany({ ...f, orgnr: f.orgnr.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3'), place: f.place || 'Oslo' })
    nav('/', true); toast('Bedriften er registrert. Parken er tom, så start med å registrere et objekt.')
  }
  return (
    <div className="login">
      <div className="login-hero">
        <div className="hstack between"><Wordmark a="Plan" tone="plain" size={34} />{me && <Btn kind="ghost" small onClick={() => back('/')}>Tilbake</Btn>}</div>
        <div className="stack">
          <h1>Parken, markedet og frakten i samme app</h1>
          <p className="lead">Én plass for maskinene dine, fra daglig drift til utleie, salg og transport.</p>
        </div>
        <div className="login-pillars">
          <div><i className="g"><Icon name="grid" size={18} /></i><span><b>FleetM8</b>Holder orden på maskinene, service og verksted.</span></div>
          <div><i className="a"><Icon name="tag" size={18} /></i><span><b>SaleM8</b>Leier ut og selger, med trygg utlevering og retur.</span></div>
          <div><i className="b"><Icon name="truck" size={18} /></i><span><b>LogM8</b>Frakter maskinene, med bud fra transportører.</span></div>
        </div>
      </div>
      <div className="login-body">
      <div className="stack">
        <div className="stack s">
          <h2>Velg demobruker</h2>
          <p className="hint">Dette er en demo som lagrer alt i denne nettleseren. Bedrifter, personer og tall er oppdiktet. Velg en bruker for å se appen fra den siden.</p>
        </div>
        {users.map(u => {
          const c = co(s, u.memberships[0].companyId)
          return (
            <button key={u.id} className="persona" onClick={() => pick(u.id)}>
              <Avatar name={u.name} />
              <span className="grow"><b>{u.name}</b><span className="persona-co">{c?.name}</span><small>{BLURB[u.id] ?? u.memberships[0].roles.map(r => ROLE_LABEL[r]).join(', ')}</small></span>
              {me?.user.id === u.id ? <Pill tone="amber">Aktiv</Pill> : <Icon name="right" size={18} />}
            </button>
          )
        })}
        {!all && <Btn kind="ghost" block onClick={() => setAll(true)}>Vis alle {s.users.length} brukere</Btn>}
      </div>
      <div className="stack">
        <h2>Ny bedrift</h2>
        {!reg ? <Btn kind="amber" block icon="plus" onClick={() => setReg(true)}>Registrer bedriften din</Btn> : (
          <Card>
            <Field label="Organisasjonsnummer" hint="Ni siffer">
              <div className="hstack"><input inputMode="numeric" value={f.orgnr} onChange={e => { setF({ ...f, orgnr: e.target.value, verified: false }); setLook('') }} placeholder="000 000 000" /><Btn kind="quiet" small onClick={lookup} disabled={look === 'søker'}>Slå opp</Btn></div>
            </Field>
            {look === 'funnet' && <Notice tone="ok" icon="check">Funnet i Enhetsregisteret. Bedriften blir merket som verifisert.</Notice>}
            {look === 'feil' && <Notice tone="warn" icon="warn">Oppslaget virket ikke her. Skriv inn navnet selv. Bedriften blir stående som ikke verifisert.</Notice>}
            <Field label="Bedriftsnavn"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Sted"><PlaceInput value={f.place} onChange={v => setF({ ...f, place: v })} /></Field>
            <Field label="Ditt navn"><input value={f.userName} onChange={e => setF({ ...f, userName: e.target.value })} autoComplete="name" /></Field>
            <Field label="E-post"><input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} autoComplete="email" /></Field>
            <p className="hint">Innlogging med Vipps, BankID eller engangskode er ikke koblet til i denne versjonen. Brukeren opprettes bare i denne nettleseren.</p>
            <Btn kind="amber" block onClick={submit}>Opprett bedrift og logg inn</Btn>
          </Card>
        )}
      </div>
      </div>
    </div>
  )
}

export function Mer() {
  const s = useS(), me = useMe()
  const unread = myNotes(s, me).filter(n => !n.read).length
  const threads = s.requests.filter(r => r.status === 'godkjent' && (r.fromCompanyId === me.company.id || r.toCompanyId === me.company.id)).length
  const theme = useTheme(), install = useInstall()
  const [how, setHow] = useState(false)
  const doInstall = async () => {
    if (install !== 'ready') return setHow(true)
    if (await promptInstall()) toast('PlanM8 er installert', 'ok')
  }
  const link = (to: string, icon: string, title: string, sub: string, right?: React.ReactNode) =>
    <Row key={to} to={to} thumb={<span className="taskicon"><Icon name={icon} size={20} /></span>} title={title} sub={sub} right={right ?? <Icon name="right" size={18} />} />
  return (
    <Page title="Mer" eyebrow="PlanM8" right={<TopActions />}>
      <Card>
        <div className="hstack"><Avatar name={me.user.name} /><div className="grow"><h3>{me.user.name}</h3><p className="hint">{me.company.name} · {me.roles.map(r => ROLE_LABEL[r]).join(', ')}</p></div></div>
        <div className="hstack"><Btn kind="quiet" small icon="swap" onClick={() => nav('/login')}>Bytt demobruker</Btn><Btn kind="ghost" small icon="logout" onClick={() => { logout(); nav('/login', true) }}>Logg ut</Btn></div>
      </Card>
      <div className="list">
        {link('/varsler', 'bell', 'Varsler', 'Det som har skjedd siden sist', unread ? <Pill tone="amber">{unread} nye</Pill> : undefined)}
        {link('/meldinger', 'chat', 'Meldinger', `${threads} samtaler med motparter`)}
        {link('/bedrift', 'building', 'Bedrift og brukere', 'Profil, forsikringsbevis, roller og partnere')}
        {viewsFor(me.roles).some(v => v !== 'forer' && v !== 'partner') && link('/leads', 'handshake', 'Forespørsler til leverandører', 'Redskap, innbytte, service, takst, finans og forsikring')}
        {viewsFor(me.roles).some(v => v === 'leietaker' || v === 'utleier') && link('/onskes', 'filter', 'Ønskes kjøpt eller leid', 'Etterlysninger fra bedrifter som leter')}
        {link('/topp100', 'trophy', 'Topp 100', 'Norges fineste maskiner, stemt frem av bransjen')}
        {link('/blinkskudd', 'camera', 'Blinkskudd', 'Ta bilde av maskinen og bli med i kåringen')}
        {link('/demo', 'spark', 'Demo-innstillinger', 'Gebyrmodell, nullstilling og eksport')}
        {link('/om', 'info', 'Om denne versjonen', 'Hva som virker, og hva som er simulert')}
      </div>
      <Section title="Appen">
        <Card>
          <Field label="Utseende"><Seg value={theme} onChange={setTheme} options={[['auto', 'Automatisk'], ['light', 'Lys'], ['dark', 'Mørk']]} /></Field>
          {install === 'installed' && <p className="hint">PlanM8 er installert som app på denne enheten.</p>}
          {(install === 'ready' || install === 'ios' || install === 'manual') && (
            <div className="hstack between">
              <div className="grow"><b>Installer som app</b><p className="hint">Få PlanM8 på hjemskjermen, uten adresselinje.</p></div>
              <Btn kind="quiet" small icon="phone" onClick={doInstall}>Installer</Btn>
            </div>
          )}
        </Card>
      </Section>
      {how && (
        <Sheet title="Installer PlanM8" onClose={() => setHow(false)} footer={<Btn kind="primary" onClick={() => setHow(false)}>Ok</Btn>}>
          {install === 'ios'
            ? <ol className="steps"><li>Trykk på Del nederst i Safari.</li><li>Velg «Legg til på Hjem-skjerm».</li><li>Trykk Legg til. PlanM8 ligger nå som en app på hjemskjermen.</li></ol>
            : <ol className="steps"><li>Åpne menyen i nettleseren, eller se etter installer-ikonet i adresselinja.</li><li>Velg «Installer PlanM8» eller «Legg til på startskjermen».</li><li>Bekreft. PlanM8 åpnes nå i sitt eget vindu.</li></ol>}
          <p className="hint">Dataene dine følger med, fordi de ligger i denne nettleseren.</p>
        </Sheet>
      )}
    </Page>
  )
}

export function Varsler() {
  const s = useS(), me = useMe()
  const notes = myNotes(s, me)
  useEffect(() => () => readNotes(), [])
  return (
    <Page title="Varsler" back="/mer">
      {!notes.length && <Empty title="Ingen varsler" text="Her kommer beskjeder om forespørsler, feil, bud og oppdrag." />}
      <div className="list">
        {notes.map(n => (
          <Row key={n.id} to={n.link} title={n.text} sub={rel(n.at)}
            thumb={<span className={'taskicon ' + (n.area === 'fleet' ? 'feil' : n.area === 'log' ? 'flytt' : 'service')}><Icon name={{ fleet: 'wrench', sale: 'tag', log: 'truck', top: 'trophy', lead: 'handshake' }[n.area]} size={20} /></span>}
            right={!n.read ? <Pill tone="amber">Ny</Pill> : undefined} />
        ))}
      </div>
    </Page>
  )
}

export function Meldinger() {
  const s = useS(), me = useMe()
  const threads = s.requests.filter(r => r.status === 'godkjent' && (r.fromCompanyId === me.company.id || r.toCompanyId === me.company.id))
  return (
    <Page title="Meldinger" back="/mer" sub="Samtaler åpnes når en forespørsel er godkjent.">
      {!threads.length && <Empty title="Ingen samtaler ennå" text="Når en forespørsel blir godkjent, kan dere skrive til hverandre her." />}
      <div className="list">
        {threads.map(r => {
          const other = r.fromCompanyId === me.company.id ? r.toCompanyId : r.fromCompanyId
          const last = s.messages.filter(m => m.requestId === r.id).slice(-1)[0]
          const o = s.objects.find(x => x.id === r.objId)
          return <Row key={r.id} to={`/match/${r.id}`} thumb={<Avatar name={coName(s, other)} />} title={coName(s, other)} sub={`${o?.name ?? 'Objekt'} · ${last ? last.text.slice(0, 60) : 'Ingen meldinger ennå'}`} right={<small>{last ? rel(last.at) : ''}</small>} />
        })}
      </div>
    </Page>
  )
}

const ROLES: Role[] = ['leder', 'admin', 'verksmester', 'forer', 'kjoper', 'sjafor', 'partner']

export function Bedrift() {
  const s = useS(), me = useMe(), c = me.company, admin = isAdmin(me)
  const [insOpen, setInsOpen] = useState(false)
  const [ins, setIns] = useState({ insurer: '', policyNo: '', coverage: 'ansvar' as Coverage, expires: dateOnly(addDays(now(), 365)) })
  const [dept, setDept] = useState('')
  const [nu, setNu] = useState({ name: '', role: 'forer' as Role })
  const people = s.users.filter(u => u.memberships.some(m => m.companyId === c.id))
  const others = s.companies.filter(x => x.id !== c.id && !x.partnerKinds.length)
  const reviews = s.ratings.filter(r => r.toCompanyId === c.id).slice(0, 6)
  return (
    <Page title="Bedrift og brukere" back="/mer">
      <CompanyCard id={c.id} />
      {!admin && <Notice tone="plain" icon="lock">Bare administrator og leder kan endre bedriftsopplysningene.</Notice>}

      <Section title="Forsikringsbevis" right={admin && <Btn kind="quiet" small icon="plus" onClick={() => setInsOpen(!insOpen)}>Legg til</Btn>}>
        <p className="hint">Utleier ser status på forsikringen din før de godkjenner en forespørsel. Du får varsel før et bevis utløper.</p>
        {c.insurance.map(i => (
          <Row key={i.id} title={COVERAGE_LABEL[i.coverage]} sub={`${i.insurer} · polise ${i.policyNo} · gyldig til ${fmtDate(i.expires, true)}`}
            right={admin ? <button className="iconbtn small" aria-label="Fjern forsikringsbevis" onClick={async () => { if (await ask(`Fjerne forsikringsbeviset for ${COVERAGE_LABEL[i.coverage].toLowerCase()}? Utleiere ser da at dekningen mangler.`, 'Fjern beviset', true)) { removeInsurance(i.id); toast('Forsikringsbeviset er fjernet') } }}><Icon name="trash" size={16} /></button> : undefined} />
        ))}
        {!c.insurance.length && <Notice tone="bad" icon="warn">Ingen forsikringsbevis er lastet opp.</Notice>}
        {insOpen && (
          <Card>
            <Field label="Forsikringsselskap"><input value={ins.insurer} onChange={e => setIns({ ...ins, insurer: e.target.value })} /></Field>
            <Field label="Polisenummer"><input value={ins.policyNo} onChange={e => setIns({ ...ins, policyNo: e.target.value })} /></Field>
            <Field label="Dekning"><select value={ins.coverage} onChange={e => setIns({ ...ins, coverage: e.target.value as Coverage })}>{(Object.keys(COVERAGE_LABEL) as Coverage[]).map(k => <option key={k} value={k}>{COVERAGE_LABEL[k]}</option>)}</select></Field>
            <Field label="Gyldig til"><input type="date" value={ins.expires} onChange={e => setIns({ ...ins, expires: e.target.value })} /></Field>
            <Btn onClick={() => { if (!ins.insurer.trim()) { toast('Skriv inn forsikringsselskap', 'bad'); return } addInsurance(ins); setInsOpen(false); toast('Forsikringsbevis lagt til') }}>Lagre bevis</Btn>
          </Card>
        )}
      </Section>

      <Section title="Transport">
        <Card>
          <Toggle on={!!c.transport?.permit} onChange={v => admin && updateCompany({ transport: { permit: v, permitExpires: v ? dateOnly(addDays(now(), 365)) : undefined } })} label="Bedriften har løyve" sub="Kreves for å gi bud på fraktoppdrag som er løyvepliktige" />
        </Card>
      </Section>

      <Section title="Avdelinger">
        <div className="tags">{c.departments.map(d => <span key={d} className="tagbox">{d}</span>)}{!c.departments.length && <p className="hint">Ingen avdelinger.</p>}</div>
        {admin && <div className="hstack"><input value={dept} onChange={e => setDept(e.target.value)} placeholder="Ny avdeling" aria-label="Ny avdeling" /><Btn kind="quiet" small onClick={() => { if (dept.trim()) { updateCompany({ departments: [...c.departments, dept.trim()] }); setDept('') } }}>Legg til</Btn></div>}
      </Section>

      <Section title="Brukere og roller">
        {people.map(u => {
          const m = u.memberships.find(x => x.companyId === c.id)!
          return (
            <Card key={u.id} className="tight">
              <div className="hstack"><Avatar name={u.name} size={36} /><div className="grow"><h3>{u.name}</h3>{m.department && <p className="hint">{m.department}</p>}</div></div>
              {admin ? <Chips value={m.roles} options={ROLES.map(r => [r, ROLE_LABEL[r]] as [Role, string])} onChange={v => v.length && setRoles(u.id, v)} /> : <p className="hint">{m.roles.map(r => ROLE_LABEL[r]).join(', ')}</p>}
            </Card>
          )
        })}
        {admin && (
          <Card className="tight">
            <h3>Ny bruker</h3>
            <div className="grid2"><input value={nu.name} onChange={e => setNu({ ...nu, name: e.target.value })} placeholder="Navn" aria-label="Navn" /><select value={nu.role} aria-label="Rolle" onChange={e => setNu({ ...nu, role: e.target.value as Role })}>{ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
            <Btn kind="quiet" small onClick={() => { if (nu.name.trim()) { addUser(nu.name.trim(), [nu.role]); setNu({ name: '', role: 'forer' }); toast('Bruker lagt til. Du finner den i listen over demobrukere.') } }}>Legg til bruker</Btn>
          </Card>
        )}
      </Section>

      <Section title="Partnere">
        <p className="hint">Partnere ser annonser som deles med «Partnere». Deling styres per objekt.</p>
        <Chips value={c.partners} options={others.map(x => [x.id, x.name] as [string, string])} onChange={v => { if (!admin) return; const changed = [...v.filter(x => !c.partners.includes(x)), ...c.partners.filter(x => !v.includes(x))]; changed.forEach(togglePartner) }} />
      </Section>

      <Section title="Automatiske varsler">
        <Card>
          <Toggle on={c.alerts.service} onChange={v => admin && updateCompany({ alerts: { ...c.alerts, service: v } })} label="Service ut fra timer og km" sub="Oppretter oppgave til verksmester 50 timer før" />
          <Toggle on={c.alerts.eu} onChange={v => admin && updateCompany({ alerts: { ...c.alerts, eu: v } })} label="EU-kontroll" sub="Oppretter oppgave 30 dager før fristen" />
          <Toggle on={c.alerts.stale} onChange={v => admin && updateCompany({ alerts: { ...c.alerts, stale: v } })} label="Påminnelse om å vaske parken" sub="Når objekter ikke er bekreftet på 90 dager" />
        </Card>
      </Section>

      <Section title="Topp 100 og omtale">
        <Card>
          <Toggle on={!!me.user.consentName} onChange={setConsent} label="Vis navnet mitt på vinnerveggen" sub="Gjelder bare deg. Uten samtykke vises bare maskinen." />
          <Toggle on={!c.optOutMention} onChange={v => admin && updateCompany({ optOutMention: !v })} label="Bedriften kan omtales som vinner" sub="Slå av hvis firmanavnet ikke skal vises" />
        </Card>
      </Section>

      <Section title="Vurderinger dere har fått">
        <Stars value={ratingOf(s, c.id).avg} n={ratingOf(s, c.id).n} />
        {reviews.map(r => <Row key={r.id} title={`${r.stars} av 5 fra ${coName(s, r.fromCompanyId)}`} sub={r.text ?? { leie: 'Leieforhold', frakt: 'Fraktoppdrag', salg: 'Salg' }[r.refType]} right={<small>{fmtDate(r.at)}</small>} />)}
      </Section>
      {c.partnerKinds.length > 0 && <Notice tone="plain" icon="handshake">Bedriften er registrert som {c.partnerKinds.map(k => PARTNER_LABEL[k].toLowerCase()).join(', ')} og får forespørsler fra andre bedrifter.</Notice>}
    </Page>
  )
}

export function Demo() {
  const s = useS(), me = useMe(), st = s.settings
  return (
    <Page title="Demo-innstillinger" back="/mer" sub="Brukes til å prøve det som ikke er bestemt ennå.">
      <Section title="Gebyrmodell for utleie">
        <p className="hint">Kompendiet peker på tre modeller, og valget er ikke tatt. Velg en for å se hvordan beløpene slår ut i leieforhold og inntekter.</p>
        <div className="list">
          {(Object.keys(FEE_LABEL) as FeeModel[]).map(k => (
            <Row key={k} title={FEE_LABEL[k]} onClick={() => setSettings({ feeModel: k })} right={st.feeModel === k ? <Pill tone="amber">Valgt</Pill> : undefined} />
          ))}
        </div>
      </Section>
      <Section title="Andre satser">
        <Card>
          <Field label="Kommisjon på frakt" hint="Prosent av budet" row><Num value={st.freightCommissionPct} onChange={v => setSettings({ freightCommissionPct: Math.min(50, Math.max(0, v)) })} /></Field>
          <Field label="Pris per lead" hint="Kroner leverandøren betaler" row><Num value={st.leadPrice} onChange={v => setSettings({ leadPrice: Math.max(0, v) })} /></Field>
          <Field label="Minste antall stemmer" hint="For å stå på Topp 100" row><Num value={st.minVotes} onChange={v => setSettings({ minVotes: Math.max(1, Math.round(v)) })} /></Field>
          <Toggle on={st.openMarket} onChange={v => setSettings({ openMarket: v })} label="Åpent marked" sub="Annonser delt med «Alle» vises også for bedrifter som ikke er verifisert" />
        </Card>
      </Section>
      <Section title="Topp 100">
        <Btn kind="quiet" icon="trophy" onClick={() => toast(pickWinner())}>Kår månedens vinner nå</Btn>
        <p className="hint">I den ferdige appen skjer kåringen automatisk ved månedsskiftet.</p>
      </Section>
      <Section title="Data">
        <p className="hint">Alt du gjør lagres i denne nettleseren. Ingenting sendes til en server.</p>
        <Btn kind="quiet" icon="download" onClick={async () => { const r = await saveFile(`planm8-data-${today()}.json`, JSON.stringify(store.get(), null, 2), 'application/json'); toast(r === 'lagret' ? 'Data eksportert' : 'Kunne ikke lagre fila her', r === 'lagret' ? 'ok' : 'bad') }}>Eksporter alle data</Btn>
        <Btn kind="danger" icon="trash" onClick={async () => { if (await ask('Nullstille alt og starte med demodataene på nytt? Alt du har lagt inn forsvinner.', 'Nullstill', true)) { store.reset(); nav('/login', true); toast('Demodataene er nullstilt') } }}>Nullstill demodata</Btn>
      </Section>
      <p className="hint">Innlogget som {me.user.name}. Sist nullstilt {fmtDate(s.seededAt, true)}.</p>
    </Page>
  )
}

export function Om() {
  const works = [
    'Objektregister med objektkort, kart, avdelinger, filtre, masseimport og «Vask parken»',
    'QR-kode per objekt og beskjeder til verksmester, med sperre for utleie ved åpen feil',
    'Automatiske oppgaver for service og EU-kontroll, og rapporter med forslag til fornyelse',
    'Sveip-marked med ønsker, match, favoritter, prisvarsel og «ønskes kjøpt eller leid»',
    'Godkjenning av leietaker, hele leieflyten i sju steg, skjema med bilder og signatur, og mottakskontroll',
    'Salg med bud, motbud og eierskifte der bare serienummer og modell følger med',
    'Frakt med bud, heng på bil, ledig på tur, løyvekontroll og dokumentasjon ved henting og levering',
    'Blinkskudd, Topp 100 med ratingmodus, kategorier, delebilde og vinnervegg',
    '«Send maskin» med tilgangsnivå, utløp og sporing, og leads til leverandører',
    'Søk og hurtigkommandoer, lys og mørk modus, og installering som egen app',
  ]
  const sim = [
    ['Innlogging', 'Du velger en demobruker. Vipps, BankID og engangskode er ikke koblet til.'],
    ['Lagring', 'Alt ligger i denne nettleseren. Andre enheter ser ikke det du gjør, så motparten spilles ved å bytte demobruker.'],
    ['Betaling', 'Forskudd og oppgjør bokføres i appen uten betalingspartner. Ingen penger flyttes.'],
    ['AI', 'Avlesning av teller, skadesammenligning, annonsetekst og typeforslag følger enkle regler og er merket «Simulert AI».'],
    ['Verdiestimat', 'En enkel avskrivningsformel, vist som intervall. Den bygger ikke på salgsdata.'],
    ['Varsler', 'Vises i appen. E-post, SMS og push sendes ikke.'],
    ['Kart', 'En forenklet tegning uten veier. Avstand er luftlinje ganget med 1,3.'],
    ['Bonuspool for førere', 'Ikke bygget. Kompendiet sier dette krever avklaring først.'],
  ]
  return (
    <Page title="Om denne versjonen" back="/mer">
      <Card>
        <Wordmark a="Plan" size={30} />
        <p>Nettsiden dekker funksjonene i PlanM8-kompendiet og appskjermene: FleetM8, SaleM8, LogM8 og Topp 100.</p>
      </Card>
      <Section title="Dette virker"><Card>{works.map(w => <div key={w} className="hstack" style={{ alignItems: 'flex-start' }}><Icon name="check" size={18} /><span className="grow">{w}</span></div>)}</Card></Section>
      <Section title="Dette er simulert eller ikke koblet til"><Card><KV rows={sim.map(([k, v]) => [k, v])} /></Card></Section>
      <Notice tone="plain" icon="info">Alle bedrifter, personer, organisasjonsnumre og priser i demodataene er oppdiktet.</Notice>
    </Page>
  )
}
