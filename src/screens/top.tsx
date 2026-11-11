import { useState } from 'react'
import type { Blink, BlinkCat, Photo } from '../types'
import { Btn, Card, Chips, Empty, Field, KV, Notice, Page, Pill, Row, Section, Sheet, Thumb, Toggle, toast } from '../ui/kit'
import { PhotoField } from '../ui/widgets'
import { Icon } from '../ui/icons'
import { nav, useRoute } from '../router'
import { co, isAdmin, parkOf, useMe, useS, userName } from '../store'
import { decideBlink, signDeclaration, tagBlink, untagBlink, vote } from '../actions'
import { fmtDate, MND_KORT, rel } from '../lib/util'
import { CAT_LABEL, ranking, type Ranked } from '../lib/logic'
import { img, rankCard } from '../lib/images'
import { copyText, saveFile } from '../lib/files'
import { Missing, TopActions, qs } from './common'

const T100 = () => <h1 className="t100">TOPP <span>100</span></h1>
const CATS: [BlinkCat | 'totalt', string][] = [['totalt', 'Totalt'], ['vedlikehold', CAT_LABEL.vedlikehold], ['spektakulaer', CAT_LABEL.spektakulaer], ['arbeid', CAT_LABEL.arbeid]]

export function Topp100() {
  const s = useS(), me = useMe()
  const [cat, setCat] = useState<BlinkCat | 'totalt'>('totalt')
  const [open, setOpen] = useState<Ranked | null>(null)
  const [rules, setRules] = useState(false)
  const all = ranking(s, cat)
  const ranked = all.filter(r => r.qualified).slice(0, 100)
  const waiting = all.filter(r => !r.qualified)
  const best = ranking(s).filter(r => r.qualified && r.blink.companyId === me.company.id)[0]
  const total = ranking(s).filter(r => r.qualified).length
  const pending = s.blinks.filter(b => b.companyId === me.company.id && b.status === 'venter').length
  const who = (b: Blink) => { const c = co(s, b.companyId); return c?.optOutMention ? b.area : `${c?.name} · ${b.area}` }
  const share = async (r: Ranked) => {
    const blob = await rankCard({ rank: r.rank, name: r.blink.objName, company: co(s, r.blink.companyId)?.name ?? '', type: r.blink.objType, src: r.blink.photo.src, total })
    const res = await saveFile(`topp100-nr-${r.rank}.png`, blob, 'image/png')
    toast(res === 'lagret' ? 'Bildet er lagret. Del det der du vil.' : 'Kunne ikke lagre bildet her', res === 'lagret' ? 'ok' : 'bad')
  }
  return (
    <Page tone="night" brand={<T100 />} eyebrow={s.settings.season} right={<TopActions />}>
      <p className="muted">Norges fineste maskiner, stemt frem av dem som kjører dem.</p>
      <div className="hstack wrap">
        <Btn kind="amber" small icon="star" to="/rating">Stem på maskiner</Btn>
        <Btn kind="ghost" small icon="trophy" to="/vinnere">Vinnere</Btn>
        <Btn kind="ghost" small icon="camera" to="/blinkskudd">Ta blinkskudd</Btn>
        {isAdmin(me) && pending > 0 && <Btn kind="ghost" small to="/blinkskudd/godkjenn">Godkjenn {pending}</Btn>}
      </div>
      {best && (
        <Card className="amber">
          <p className="eyebrow" style={{ color: '#3F3212' }}>Din beste plassering</p>
          <div className="hstack"><span className="score" style={{ color: '#13201B', fontSize: 52, minWidth: 0 }}>Nr. {best.rank}</span><div className="grow"><h3>{best.blink.objName}</h3><p>{best.score.toLocaleString('nb-NO')} poeng · {best.votes} stemmer</p></div></div>
          <div className="hstack wrap">
            <Btn kind="primary" small icon="share" onClick={() => share(best)}>Lag delebilde</Btn>
            <Btn kind="quiet" small icon="copy" onClick={async () => toast((await copyText(`Min maskin er nr. ${best.rank} i Norge på Topp 100 i PlanM8.`)) ? 'Teksten er kopiert' : 'Kunne ikke kopiere')}>Kopier tekst</Btn>
          </div>
        </Card>
      )}
      <Chips single value={[cat]} options={CATS} onChange={v => setCat(v[0] ?? 'totalt')} />
      {!ranked.length && <Empty title="Ingen på lista ennå" text="Maskiner kommer på lista når de har fått nok stemmer." />}
      {ranked.length > 0 && (
        <div className="podium">
          {[1, 0, 2].map(i => ranked[i] ? (
            <button key={ranked[i].blink.id} className={'pod' + (i === 0 ? ' first' : '')} onClick={() => setOpen(ranked[i])}>
              <div className="pod-img"><Thumb src={ranked[i].blink.photo.src} type={ranked[i].blink.objType} alt={ranked[i].blink.objName} /><span>{i + 1}</span></div>
              <p>{ranked[i].blink.objName}</p><b>{ranked[i].score.toLocaleString('nb-NO')}</b>
            </button>
          ) : <div key={i} />)}
        </div>
      )}
      <div>
        {ranked.slice(3).map(r => (
          <button key={r.blink.id} className={'rank rankbtn' + (r.blink.companyId === me.company.id ? ' mine' : '')} onClick={() => setOpen(r)}>
            <b>{r.rank}</b><Thumb src={r.blink.photo.src} type={r.blink.objType} alt="" /><div><p>{r.blink.objName}</p><small>{who(r.blink)}</small></div><span className="sc">{r.score.toLocaleString('nb-NO')}</span>
          </button>
        ))}
      </div>
      {waiting.length > 0 && <Section title="Trenger flere stemmer">
        <p className="hint">Maskiner må ha minst {s.settings.minVotes} stemmer for å stå på lista.</p>
        {waiting.map(r => <Row key={r.blink.id} onClick={() => setOpen(r)} thumb={<Thumb src={r.blink.photo.src} type={r.blink.objType} />} title={r.blink.objName} sub={`${r.votes} av ${s.settings.minVotes} stemmer`} />)}
      </Section>}
      <button className="link" onClick={() => setRules(true)}>Slik regnes plasseringen ut</button>
      {open && (
        <Sheet title={open.blink.objName} onClose={() => setOpen(null)} footer={open.blink.companyId !== me.company.id ? <Btn kind="amber" onClick={() => { setOpen(null); nav('/rating') }}>Stem på maskiner</Btn> : open.qualified ? <Btn onClick={() => share(open)} icon="share">Lag delebilde</Btn> : undefined}>
          {img(open.blink.photo.src) ? <img src={img(open.blink.photo.src)} alt={open.blink.objName} style={{ width: '100%', borderRadius: 14 }} /> : <div className="pod-img" style={{ aspectRatio: '4 / 3' }}><Thumb src={undefined} type={open.blink.objType} /></div>}
          <KV rows={[['Plassering', open.qualified ? `Nr. ${open.rank}` : 'Ikke på lista ennå'], ['Poeng', open.score.toLocaleString('nb-NO')], ['Stemmer', open.votes], ['Kategori', CAT_LABEL[open.blink.category]], ['Fra', who(open.blink)]]} />
          <p className="hint">Posisjonen vises bare som område. Skilt og ansikter skal ikke være synlige.</p>
        </Sheet>
      )}
      {rules && (
        <Sheet title="Slik virker Topp 100" onClose={() => setRules(false)}>
          <KV rows={[
            ['Stemmer', 'Du gir 1 til 100 poeng per maskin'], ['Eget firma', 'Du kan ikke stemme på maskiner fra eget firma'], ['Vektet snitt', 'Maskiner med få stemmer trekkes mot snittet for alle'],
            ['Minstekrav', `${s.settings.minVotes} stemmer for å stå på lista`], ['Én per maskin', 'Et nytt blinkskudd erstatter det gamle'], ['Månedens vinner', 'Samme maskin kan vinne én gang per år'],
          ]} />
        </Sheet>
      )}
    </Page>
  )
}

export function RatingMode() {
  const s = useS(), me = useMe()
  const [skipped, setSkipped] = useState<string[]>([])
  const [score, setScore] = useState(75)
  const pool = s.blinks.filter(b => b.status === 'godkjent' && b.companyId !== me.company.id && !s.votes.some(v => v.blinkId === b.id && v.userId === me.user.id) && !skipped.includes(b.id))
  const b = pool[0]
  const mine = s.votes.filter(v => v.userId === me.user.id).length
  const next = () => setScore(75)
  return (
    <Page tone="night" brand={<T100 />} eyebrow="Ratingmodus" back="/topp100" right={<Pill tone="ink-inv">{mine} stemmer gitt</Pill>}>
      {!b ? (
        <Empty title="Du har stemt på alle" text="Kom tilbake når nye blinkskudd er godkjent.">
          {skipped.length > 0 && <Btn kind="amber" onClick={() => setSkipped([])}>Vis de du hoppet over</Btn>}
          <Btn kind="ghost" to="/topp100">Til lista</Btn>
        </Empty>
      ) : (
        <div className="deck">
          <div className="mcard">
            <div className="mcard-img"><Thumb src={b.photo.src} type={b.objType} alt={b.objName} /><span className="tl"><Pill tone="glass">{CAT_LABEL[b.category]}</Pill></span><span className="bl">{b.area}</span></div>
            <div className="mcard-b">
              <h1>{b.objName}</h1>
              <div className="hstack"><span className="score">{score}</span><div className="grow"><input type="range" min={1} max={100} value={score} onChange={e => setScore(Number(e.target.value))} aria-label="Poeng fra 1 til 100" /><div className="hstack between"><small>1</small><small>100</small></div></div></div>
            </div>
          </div>
          <div className="hstack">
            <Btn kind="ghost" onClick={() => { setSkipped(x => [...x, b.id]); next() }}>Hopp over</Btn>
            <span className="grow" />
            <Btn kind="amber" icon="star" onClick={() => { vote(b.id, score); next() }}>Gi {score} poeng</Btn>
          </div>
          <p className="hint center">{pool.length} maskiner igjen. Du kan ikke stemme på maskiner fra eget firma.</p>
        </div>
      )}
    </Page>
  )
}

export function Vinnere() {
  const s = useS()
  const nowD = new Date()
  const months = Array.from({ length: 36 }, (_, i) => new Date(nowD.getFullYear(), nowD.getMonth() - i, 1))
  return (
    <Page tone="night" brand={<T100 />} eyebrow="Vinnerveggen" back="/topp100" wide sub="Månedens vinner de siste 36 månedene. Samme maskin kan vinne én gang per år.">
      <div className="wall">
        {months.map((m, i) => {
          const w = s.winners.find(x => x.year === m.getFullYear() && x.month === m.getMonth())
          const label = `${MND_KORT[m.getMonth()]} ${m.getFullYear()}`
          if (!w) return <div key={i} className="win none"><div className="win-img">{i === 0 ? 'Kåres ved månedsskiftet' : 'Ingen vinner'}</div><small>{label}</small></div>
          return (
            <div key={i} className="win">
              <div className="win-img"><Thumb src={w.img} type={w.objType} alt={w.objName} /><span><Pill tone="amber">{label}</Pill></span></div>
              <p>{w.objName}</p><small>{[w.driver, w.company].filter(Boolean).join(' · ') || 'Navn vises ikke'}</small>
            </div>
          )
        })}
      </div>
      <p className="hint">Førerens navn vises bare når føreren har samtykket. Bedriften kan reservere seg mot omtale.</p>
    </Page>
  )
}

export function Blinkskudd() {
  const s = useS(), me = useMe(), q = qs(useRoute())
  const park = parkOf(s, me.company.id).filter(o => !o.hired && o.type !== 'Redskap')
  const [objId, setObjId] = useState(q.get('obj') ?? '')
  const [photo, setPhoto] = useState<Photo>()
  const [cat, setCat] = useState<BlinkCat>('arbeid')
  const [faces, setFaces] = useState(false)
  const admin = isAdmin(me)
  const mine = s.blinks.filter(b => b.companyId === me.company.id && (admin || b.takenBy === me.user.id) && b.status !== 'erstattet')
  const o = park.find(x => x.id === objId)
  const has = o && s.blinks.some(b => b.objId === o.id && b.status === 'godkjent')
  const send = () => {
    if (!o) { toast('Velg maskin', 'bad'); return }
    if (!photo) { toast('Ta et bilde først', 'bad'); return }
    if (!faces) { toast('Bekreft at ingen ansikter er synlige', 'bad'); return }
    tagBlink(o.id, photo, cat, faces); setPhoto(undefined); setFaces(false); toast('Sendt til administrator for godkjenning', 'ok')
  }
  const LABEL = { venter: 'Venter på godkjenning', godkjent: 'Med i Topp 100', underkjent: 'Underkjent', erstattet: 'Erstattet', arkivert: 'Arkivert' }
  return (
    <Page title="Blinkskudd" eyebrow="Topp 100" right={<TopActions />} sub="Ta et bilde du er stolt av. Administrator godkjenner før det blir med i kåringen.">
      {!park.length ? <Notice tone="plain" icon="info">Bedriften har ingen maskiner i parken ennå.</Notice> : (
        <Card>
          <Field label="Maskin"><select value={objId} onChange={e => setObjId(e.target.value)}><option value="">Velg maskin</option>{park.map(x => <option key={x.id} value={x.id}>{x.name} · {x.internalId}</option>)}</select></Field>
          <PhotoField photo={photo} onPhoto={setPhoto} type={o?.type ?? 'Hjullaster'} label="Ta blinkskuddet" hint="Hele maskinen, i godt lys" place={o?.place} />
          <Field label="Kategori"><Chips single value={[cat]} options={(Object.keys(CAT_LABEL) as BlinkCat[]).map(k => [k, CAT_LABEL[k]] as [BlinkCat, string])} onChange={v => v[0] && setCat(v[0])} /></Field>
          <label className="checkline"><input type="checkbox" checked={faces} onChange={e => setFaces(e.target.checked)} /><span>Ingen ansikter er synlige på bildet</span></label>
          <p className="hint">Skilt skal sladdes og posisjon vises bare som område. Sladdingen er ikke automatisk i denne versjonen, så sjekk bildet selv.</p>
          {has && <Notice tone="info" icon="info">Maskinen har et blinkskudd fra før. Det nye erstatter det gamle når det godkjennes, og stemmene starter på nytt.</Notice>}
          <Btn kind="amber" icon="send" onClick={send}>Send til godkjenning</Btn>
        </Card>
      )}
      {admin && <Btn kind="quiet" to="/blinkskudd/godkjenn" icon="check">Godkjenn blinkskudd ({s.blinks.filter(b => b.companyId === me.company.id && b.status === 'venter').length})</Btn>}
      <Section title={admin ? 'Bedriftens blinkskudd' : 'Mine blinkskudd'}>
        {!mine.length && <p className="hint">Ingen blinkskudd ennå.</p>}
        {mine.map(b => (
          <Row key={b.id} thumb={<Thumb src={b.photo.src} type={b.objType} alt={b.objName} />} title={b.objName} sub={`${CAT_LABEL[b.category]} · ${userName(s, b.takenBy)} · ${rel(b.at)}${b.reason ? ` · ${b.reason}` : ''}`}
            right={<><Pill tone={b.status === 'godkjent' ? 'ok' : b.status === 'venter' ? 'warn' : 'mute'}>{LABEL[b.status]}</Pill>{b.status === 'venter' && b.takenBy === me.user.id && <button className="link" onClick={() => untagBlink(b.id)}>Trekk</button>}</>} />
        ))}
      </Section>
    </Page>
  )
}

export function BlinkGodkjenn() {
  const s = useS(), me = useMe()
  const [agree, setAgree] = useState(false)
  const [no, setNo] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  if (!isAdmin(me)) return <Missing />
  const decl = me.company.blinkDeclaration
  const pending = s.blinks.filter(b => b.companyId === me.company.id && b.status === 'venter')
  return (
    <Page title="Godkjenn blinkskudd" eyebrow="Topp 100" back="/blinkskudd" wide sub="Bare bilder du godkjenner blir med i kåringen og kan brukes i annonser.">
      {decl ? <Notice tone="ok" icon="check">Egenerklæringen er signert {fmtDate(decl.at, true)} av {userName(s, decl.by)}.</Notice> : (
        <Card>
          <h2>Egenerklæring fra bedriften</h2>
          <p>Bedriften bekrefter at den eier eller disponerer maskinene på bildene, at bildene er tatt av egne ansatte, og at ingen personer kan kjennes igjen uten samtykke.</p>
          <label className="checkline"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /><span>Jeg bekrefter dette på vegne av {me.company.name}</span></label>
          <Btn disabled={!agree} onClick={() => { signDeclaration(); toast('Egenerklæringen er signert', 'ok') }}>Signer egenerklæringen</Btn>
        </Card>
      )}
      {!pending.length && <Empty title="Ingen venter" text="Når en fører sender inn et blinkskudd, dukker det opp her." />}
      <div className="cols">
        {pending.map(b => (
          <Card key={b.id}>
            <div className="pod-img" style={{ aspectRatio: '4 / 3', borderRadius: 14 }}><Thumb src={b.photo.src} type={b.objType} alt={b.objName} /></div>
            <h3>{b.objName}</h3>
            <p className="hint">{CAT_LABEL[b.category]} · tatt av {userName(s, b.takenBy)} {rel(b.at)}</p>
            <div className="stack s">
              <div className="hstack"><Icon name={b.checks.faces ? 'check' : 'warn'} size={16} /><span>{b.checks.faces ? 'Føreren har bekreftet at ingen ansikter er synlige' : 'Føreren har ikke bekreftet at ingen ansikter er synlige'}</span></div>
              <div className="hstack"><Icon name="eye" size={16} /><span>Sjekk selv at skilt ikke kan leses</span></div>
              <div className="hstack"><Icon name="pin" size={16} /><span>Posisjon vises bare som «{b.area}»</span></div>
            </div>
            {s.blinks.some(x => x.objId === b.objId && x.status === 'godkjent') && <p className="hint">Erstatter maskinens nåværende blinkskudd.</p>}
            <div className="hstack">
              <Btn kind="amber" small disabled={!decl} onClick={() => { decideBlink(b.id, true); toast('Godkjent. Bildet er med i Topp 100.', 'ok') }}>Godkjenn</Btn>
              <Btn kind="ghost" small onClick={() => { setReason(''); setNo(b.id) }}>Underkjenn</Btn>
            </div>
            {!decl && <p className="hint">Signer egenerklæringen før du godkjenner.</p>}
          </Card>
        ))}
      </div>
      {no && (
        <Sheet title="Underkjenn blinkskuddet" onClose={() => setNo(null)} footer={<><Btn kind="ghost" onClick={() => setNo(null)}>Avbryt</Btn><Btn kind="danger" onClick={() => { decideBlink(no, false, reason.trim() || undefined); setNo(null); toast('Blinkskuddet er underkjent') }}>Underkjenn</Btn></>}>
          <Chips single value={[reason]} options={['Ansikt er synlig', 'Skilt kan leses', 'Bildet er uskarpt', 'Feil maskin']} onChange={v => setReason(v[0] ?? '')} />
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Begrunnelse til føreren (valgfritt)" aria-label="Begrunnelse" />
        </Sheet>
      )}
    </Page>
  )
}
