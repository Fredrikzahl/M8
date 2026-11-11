import { useState } from 'react'
import type { LeadType, TaskStatus } from '../types'
import { AiTag, Bar, Btn, Card, Empty, Notice, ObjThumb, Page, Pill, Row, Section, Seg, Stat, Thumb, toast } from '../ui/kit'
import { nav } from '../router'
import { has, isAdmin, ob, useMe, useS, userName } from '../store'
import { advanceTask, setAvailability } from '../actions'
import { daysBetween, fmtDate, kr, krShort, meterUnit, num, rel, STATUS_LABEL, sum, TASK_ICON, toCsv, today } from '../lib/util'
import { estimate, inspectionTotal, renewalReason } from '../lib/logic'
import { saveFile } from '../lib/files'
import { Missing, TopActions, readingText } from './common'
import { LeadSheet } from './share'

export function Verksted() {
  const s = useS(), me = useMe()
  const [tab, setTab] = useState<TaskStatus>('ny')
  const [lead, setLead] = useState<{ type: LeadType; objId: string; text: string } | null>(null)
  const tasks = s.tasks.filter(t => t.companyId === me.company.id)
  const list = tasks.filter(t => t.status === tab)
  const can = has(me, 'verksmester', 'admin', 'leder')
  const n = (st: TaskStatus) => tasks.filter(t => t.status === st).length
  const blocked = [...new Set(tasks.filter(t => t.type === 'feil' && t.status !== 'utfort').map(t => t.objId))]
  return (
    <Page title="Verksted" eyebrow="FleetM8" right={<TopActions />} wide sub="Beskjeder fra førere og automatiske oppgaver for service og EU-kontroll.">
      {blocked.length > 0 && <Notice tone="bad" icon="lock">Sperret for utleie til feilen er løst: {blocked.map(id => ob(s, id)?.name).join(', ')}.</Notice>}
      <Seg value={tab} onChange={setTab} options={[['ny', `Nye (${n('ny')})`], ['arbeid', `Under arbeid (${n('arbeid')})`], ['utfort', `Utført (${n('utfort')})`]]} />
      {!list.length && <Empty title={tab === 'ny' ? 'Ingen nye oppgaver' : tab === 'arbeid' ? 'Ingenting under arbeid' : 'Ingen utførte oppgaver'} text="Førere melder fra ved å skanne QR-koden på maskinen." />}
      <div className="cols">
        {list.map(t => {
          const o = ob(s, t.objId)
          return (
            <Card key={t.id}>
              <div className="hstack">
                <span className={'taskicon ' + t.type}>{TASK_ICON[t.type]}</span>
                <div className="grow"><h3>{t.title}</h3><p className="hint">{userName(s, t.reportedBy)} · {rel(t.at)}</p></div>
                {t.type === 'feil' && t.status !== 'utfort' && <Pill tone="bad">Sperrer utleie</Pill>}
              </div>
              {o && <Row to={`/objekt/${o.id}`} thumb={<ObjThumb o={o} className="sm" />} title={o.name} sub={`${o.internalId} · ${o.place}${t.reading != null ? ` · ${num(t.reading)} ${meterUnit(o.meter)}` : ''}`} />}
              {t.text && <p>{t.text}</p>}
              {t.autoReason && <p className="hint">{t.autoReason}</p>}
              {t.photo && o && <Thumb src={t.photo.src} type={o.type} alt="Bilde fra føreren" className="wide" />}
              {t.doneAt && <p className="hint">Utført {fmtDate(t.doneAt)}</p>}
              {can && t.status !== 'utfort' && (
                <div className="hstack wrap">
                  <Btn kind={t.status === 'ny' ? 'primary' : 'amber'} small onClick={() => { advanceTask(t.id); toast(t.status === 'ny' ? 'Flyttet til under arbeid' : t.type === 'feil' ? 'Utført. Sperren er opphevet.' : 'Markert som utført', 'ok') }}>{t.status === 'ny' ? 'Start arbeid' : 'Marker utført'}</Btn>
                  {(t.type === 'service' || t.type === 'feil' || t.type === 'eu') && o && <Btn kind="ghost" small onClick={() => setLead({ type: 'service', objId: o.id, text: `${t.title} på ${o.name}. ${t.text ?? ''}`.trim() })}>Bestill hos verksted</Btn>}
                  {t.type === 'flytt' && <Btn kind="ghost" small to="/frakt/send">Bestill frakt</Btn>}
                </div>
              )}
            </Card>
          )
        })}
      </div>
      {lead && <LeadSheet type={lead.type} objId={lead.objId} text={lead.text} onClose={() => setLead(null)} />}
    </Page>
  )
}

export function Rapporter() {
  const s = useS(), me = useMe()
  const [lead, setLead] = useState<string | null>(null)
  const objs = s.objects.filter(o => o.companyId === me.company.id && !o.archived)
  if (!isAdmin(me)) return <Missing what="rapportene" />
  const est = objs.map(o => estimate(o))
  const use = objs.length ? Math.round((sum(objs.map(o => o.usage30)) / (objs.length * 30)) * 100) : 0
  const rentals = s.rentals.filter(r => r.lessorId === me.company.id)
  const income = sum(rentals.filter(r => r.inspection?.lockedAt).map(r => inspectionTotal(r.inspection)))
  const perObj = (id: string) => sum(rentals.filter(r => r.objId === id && r.inspection?.lockedAt).map(r => inspectionTotal(r.inspection)))
  const depts = [...new Set(objs.map(o => o.department || 'Uten avdeling'))].sort()
  const renew = objs.map(o => ({ o, why: renewalReason(o) })).filter(x => x.why)
  const idle = objs.filter(o => o.status === 'i_drift' && o.usage30 < 9 && o.type !== 'Redskap')
  const due = objs.flatMap(o => {
    const out: { o: typeof o; text: string; tone: string }[] = []
    if (o.service.nextAt != null && o.service.nextAt - o.reading <= 150) out.push({ o, text: `Service ved ${num(o.service.nextAt)} ${meterUnit(o.meter)}, ${num(Math.max(0, o.service.nextAt - o.reading))} igjen`, tone: o.service.nextAt - o.reading <= 50 ? 'warn' : 'info' })
    if (o.service.euDate) { const d = daysBetween(today(), o.service.euDate); if (d <= 60) out.push({ o, text: `EU-kontroll ${fmtDate(o.service.euDate)}`, tone: d <= 30 ? 'warn' : 'info' }) }
    return out
  })
  const exportCsv = async () => {
    const rows: (string | number)[][] = [['Internnr', 'Navn', 'Type', 'Årsmodell', 'Avdeling', 'Sted', 'Status', 'Timer eller km', 'Brukt dager av 30', 'Estimat lav', 'Estimat høy', 'Leieinntekt']]
    for (const o of objs) { const e = estimate(o); rows.push([o.internalId, o.name, o.type, o.year, o.department, o.place, STATUS_LABEL[o.status], o.reading, o.usage30, e.low, e.high, perObj(o.id)]) }
    const r = await saveFile(`parkrapport-${today()}.csv`, toCsv(rows), 'text/csv')
    toast(r === 'lagret' ? 'Rapporten er lagret' : 'Kunne ikke lagre fila her', r === 'lagret' ? 'ok' : 'bad')
  }
  return (
    <Page title="Rapporter" eyebrow="FleetM8 · for ledelsen" right={<TopActions />} wide>
      <div className="stats">
        <Stat label="Objekter" value={objs.length} />
        <Stat label="Utnyttelse 30 d" value={`${use} %`} tone="amber" />
        <Stat label="Estimert verdi" value={`${krShort(sum(est.map(e => e.low)))}–${krShort(sum(est.map(e => e.high)))}`} />
        <Stat label="Leieinntekt oppgjort" value={kr(income)} tone="ink" />
      </div>
      <p className="hint hstack" style={{ gap: 6 }}><AiTag text="Estimat" />Verdien er et intervall fra en enkel avskrivningsformel. Den bygger ikke på salgsdata.</p>

      <div className="cols">
        <Card>
          <h2>Utnyttelse per avdeling</h2>
          {depts.map(d => {
            const g = objs.filter(o => (o.department || 'Uten avdeling') === d)
            const u = Math.round((sum(g.map(o => o.usage30)) / (g.length * 30)) * 100)
            return <div key={d} className="stack s"><div className="hstack between"><span>{d} <small>{g.length} objekter</small></span><b>{u} %</b></div><Bar pct={u} tone={u < 30 ? 'low' : undefined} /></div>
          })}
        </Card>
        <Card>
          <h2>Frister de neste ukene</h2>
          {!due.length && <p className="hint">Ingen service eller EU-kontroll forfaller snart.</p>}
          {due.map((d, i) => <div key={i} className="hstack between"><span><b>{d.o.name}</b><br /><small>{d.text}</small></span><Pill tone={d.tone}>{d.tone === 'warn' ? 'Snart' : 'Kommer'}</Pill></div>)}
        </Card>
      </div>

      <Section title="Forslag til fornyelse">
        {!renew.length && <p className="hint">Ingen objekter nærmer seg utskifting.</p>}
        <div className="cols">
          {renew.map(({ o, why }) => {
            const e = estimate(o)
            return (
              <Card key={o.id}>
                <Row to={`/objekt/${o.id}`} thumb={<ObjThumb o={o} />} title={o.name} sub={`${o.year} · ${readingText(o)}`} />
                <p>{o.name} {why}. Estimert verdi nå er kr {num(e.low)}–{num(e.high)}.</p>
                <div className="hstack wrap">
                  <Btn kind="amber" small onClick={() => setLead(o.id)}>Be om innbyttetilbud</Btn>
                  {o.status === 'i_drift' && <Btn kind="ghost" small onClick={() => { const err = setAvailability(o.id, 'salg'); toast(err ?? 'Lagt ut for salg', err ? 'bad' : 'ok') }}>Legg ut for salg</Btn>}
                </div>
              </Card>
            )
          })}
        </div>
      </Section>

      <Section title="Lite brukt">
        {!idle.length && <p className="hint">Alle objekter i drift har vært brukt minst ni dager siste måned.</p>}
        <div className="cols">
          {idle.map(o => (
            <Row key={o.id} thumb={<ObjThumb o={o} />} title={o.name} sub={`Brukt ${o.usage30} av 30 dager`}
              right={<Btn kind="quiet" small onClick={() => { const err = setAvailability(o.id, 'leie'); toast(err ?? 'Merket ledig for leie', err ? 'bad' : 'ok') }}>Lei ut</Btn>} />
          ))}
        </div>
      </Section>

      <Section title="Per objekt" right={<Btn kind="quiet" small icon="download" onClick={exportCsv}>Eksporter CSV</Btn>}>
        <div className="tablewrap card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Objekt</th><th>Status</th><th>Brukt 30 d</th><th>Leieinntekt</th><th>Estimert verdi</th></tr></thead>
            <tbody>{objs.map(o => { const e = estimate(o); return <tr key={o.id} onClick={() => nav(`/objekt/${o.id}`)} style={{ cursor: 'pointer' }}><td><b>{o.name}</b></td><td>{STATUS_LABEL[o.status]}</td><td className="num">{Math.round((o.usage30 / 30) * 100)} %</td><td className="num">{perObj(o.id) ? kr(perObj(o.id)) : '–'}</td><td className="num">{num(e.low)}–{num(e.high)}</td></tr> })}</tbody>
          </table>
        </div>
      </Section>

      <Notice tone="plain" icon="info"><b>Bonuspool for førere er ikke bygget.</b><small>Kompendiet sier at ordningen krever avklaring med lønn, skatt og tariff før den kan lages.</small></Notice>
      {lead && <LeadSheet type="innbytte" objId={lead} onClose={() => setLead(null)} />}
    </Page>
  )
}
