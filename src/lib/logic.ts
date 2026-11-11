import type { AiFinding, Blink, BlinkCat, FeeModel, HandoverForm, Inspection, InspectionLine, Listing, Obj, ObjType, Rental, State, Terms, Wish } from '../types'
import { clamp, distKm, num, rentalDays, sum, uid } from './util'

// ---------- Verdiestimat ----------
// Demomodell: en enkel avskrivningsformel. Den er ikke bygget på salgsdata,
// og vises derfor alltid som et intervall merket «estimat».
const BASE: Record<ObjType, number> = {
  Gravemaskin: 2_400_000, Hjullaster: 2_200_000, Minigraver: 560_000, Dosor: 3_000_000, Lastebil: 2_100_000,
  Lift: 480_000, Tilhenger: 130_000, Redskap: 85_000, Personbil: 450_000, Varebil: 520_000,
}
/** Timetall eller km der objektet nærmer seg utskifting. */
export const CRITICAL: Record<ObjType, number> = {
  Gravemaskin: 10_000, Hjullaster: 12_000, Minigraver: 6_000, Dosor: 10_000, Lastebil: 450_000,
  Lift: 5_000, Tilhenger: 0, Redskap: 0, Personbil: 250_000, Varebil: 300_000,
}
const round = (n: number) => { const step = n > 300_000 ? 10_000 : n > 50_000 ? 5_000 : 1_000; return Math.round(n / step) * step }

export function estimate(o: Obj): { low: number; high: number; mid: number } {
  const base = o.purchasePrice ?? BASE[o.type]
  const age = Math.max(0, new Date().getFullYear() - o.year)
  const crit = CRITICAL[o.type]
  const wear = crit ? 1 - 0.45 * clamp(o.reading / crit, 0, 1.2) : 1
  const cond = [0.8, 0.9, 1, 1.06, 1.1][o.condition - 1]
  const mid = Math.max(base * 0.05, base * Math.pow(0.9, age) * wear * cond)
  return { low: round(mid * 0.88), high: round(mid * 1.12), mid: round(mid) }
}
export const estimateText = (o: Obj) => { const e = estimate(o); return `${num(e.low)}–${num(e.high)}` }

export function renewalReason(o: Obj): string | null {
  const crit = CRITICAL[o.type]
  if (o.status === 'solgt' || o.status === 'utrangert') return null
  if (crit && o.reading >= crit * 0.85) return `nærmer seg ${num(crit)} ${o.meter === 'timer' ? 'timer' : 'km'}`
  if (new Date().getFullYear() - o.year >= 12) return `er ${new Date().getFullYear() - o.year} år gammel`
  return null
}

// ---------- Match mot ønsker ----------
/** Gir 0–100, eller null når annonsen ikke passer ønskene i det hele tatt. */
export function matchScore(w: Wish, l: Listing, o: Obj): number | null {
  if (w.mode !== 'begge' && (w.mode === 'kjope') !== (l.mode === 'salg')) return null
  if (w.types.length && !w.types.includes(o.type)) return null
  let s = 40
  const d = distKm(w.area, o.place)
  if (w.radiusKm == null || d == null) s += 14
  else if (d <= w.radiusKm) s += 20 - 8 * (d / Math.max(1, w.radiusKm))
  else if (d <= w.radiusKm * 2) s += 4
  else return null
  if (o.meter === 'km' || o.reading <= w.maxReading) s += 15 - 6 * (o.meter === 'km' ? 0.4 : o.reading / Math.max(1, w.maxReading))
  else s -= 10
  s += o.year >= w.yearFrom ? 10 : -6
  if (w.maxPrice == null) s += 10
  else if (l.price <= w.maxPrice) s += 15 - 5 * (l.price / w.maxPrice)
  else s -= 12
  s += o.condition - 3
  return Math.round(clamp(s, 35, 99))
}

// ---------- Leie og gebyr ----------
export function rentAmount(r: { from: string; to: string; price: number; unit: Rental['unit'] }) {
  const d = rentalDays(r.from, r.to)
  if (r.unit === 'dag') return d * r.price
  if (r.unit === 'uke') return Math.ceil(d / 7) * r.price
  if (r.unit === 'mnd') return Math.ceil(d / 30) * r.price
  return r.price
}

export const FEE_LABEL: Record<FeeModel, string> = {
  ingen: 'Ikke bestemt (ingen gebyr vises)',
  en_prosent: '1 % fra utleier',
  ti_ti: '10 % fra hver part',
  tjuefem: '25 % fra utleier (konkurrentens modell)',
}
export function fees(model: FeeModel, amount: number) {
  const pct = { ingen: [0, 0], en_prosent: [0.01, 0], ti_ti: [0.1, 0.1], tjuefem: [0.25, 0] }[model]
  const fromLessor = amount * pct[0], fromLessee = amount * pct[1]
  return { lessorGets: amount - fromLessor, lesseePays: amount + fromLessee, platform: fromLessor + fromLessee, fromLessor, fromLessee }
}

export const DEFAULT_TERMS: Terms = { advancePct: 30, freight: 0, serviceAgreement: 0, insurance: 0, wash: 750, misc: 0, fuelPerQuarter: 725, tirePerMm: 450, wearPerHour: 25 }

// ---------- Kameramaler ----------
export type Overlay = 'side' | 'front' | 'rear' | 'cab' | 'wheel' | 'gauge' | 'tool' | 'inside'
export interface Shot { key: string; label: string; hint: string; overlay: Overlay; required: boolean; reads?: 'reading' | 'fuel' }
const shot = (key: string, label: string, hint: string, overlay: Overlay, required = true, reads?: Shot['reads']): Shot => ({ key, label, hint, overlay, required, reads })

export function shotsFor(type: ObjType): Shot[] {
  const teller = (m: string) => shot('teller', m, `Fotografer ${m.toLowerCase()}en. AI leser av tallet.`, 'gauge', true, 'reading')
  const fuel = shot('drivstoff', 'Drivstoff', 'Fotografer drivstoffmåleren.', 'gauge', true, 'fuel')
  switch (type) {
    case 'Hjullaster':
      return [
        shot('front', 'Front', 'Still deg foran skuffa. Hele maskinen i rammen.', 'front'),
        shot('venstre', 'Venstre side', 'Gå til venstre side. Fyll omrisset fra hjul til hjul.', 'side'),
        shot('forerhus', 'Førerhus', 'Ta bilde av førerhuset utenfra, med dør og ruter.', 'cab'),
        shot('hjul', 'Hjul og dekk', 'Fremre hjul. Mønsteret skal synes.', 'wheel'),
        teller('Timeteller'), fuel,
        shot('hoyre', 'Høyre side', 'Høyre side, fra hjul til hjul.', 'side', false),
        shot('bak', 'Bak', 'Bakfra, med motvekt og lys.', 'rear', false),
      ]
    case 'Gravemaskin': case 'Minigraver': case 'Dosor':
      return [
        shot('front', 'Front', 'Still deg foran maskinen. Hele maskinen i rammen.', 'front'),
        shot('venstre', 'Venstre side', 'Venstre side. Fyll omrisset fra belte til belte.', 'side'),
        shot('belter', 'Belter', 'Ett belte på nært hold. Slitasjen skal synes.', 'wheel'),
        shot('redskap', type === 'Dosor' ? 'Skjær' : 'Skuffe og feste', 'Redskap og feste på nært hold.', 'tool'),
        shot('forerhus', 'Førerhus', 'Førerhuset utenfra, med dør og ruter.', 'cab'),
        teller('Timeteller'), fuel,
        shot('hoyre', 'Høyre side', 'Høyre side, hele maskinen.', 'side', false),
      ]
    case 'Lastebil': case 'Varebil':
      return [
        shot('front', 'Front', 'Rett forfra. Hele bilen i rammen.', 'front'),
        shot('venstre', 'Venstre side', 'Venstre side, fra støtfanger til bakkant.', 'side'),
        shot('hoyre', 'Høyre side', 'Høyre side, fra støtfanger til bakkant.', 'side'),
        shot('bak', 'Bak', 'Bakfra, med lem og lys.', 'rear'),
        shot('dekk', 'Dekk', 'Ett drivhjul. Mønsteret skal synes.', 'wheel'),
        teller('Kilometerteller'), fuel,
        shot('plan', 'Plan og påbygg', 'Plan eller kasse ovenfra eller bakfra.', 'tool', false),
      ]
    case 'Personbil':
      return [
        shot('front', 'Front', 'Rett forfra. Hele bilen i rammen.', 'front'),
        shot('venstre', 'Venstre side', 'Venstre side, hele bilen.', 'side'),
        shot('hoyre', 'Høyre side', 'Høyre side, hele bilen.', 'side'),
        shot('bak', 'Bak', 'Rett bakfra.', 'rear'),
        shot('interior', 'Interiør', 'Forsetene og dashbordet.', 'inside'),
        teller('Kilometerteller'), fuel,
      ]
    default:
      return [
        shot('front', 'Front', 'Hele objektet forfra.', 'front'),
        shot('venstre', 'Venstre side', 'Hele objektet fra venstre side.', 'side'),
        shot('hoyre', 'Høyre side', 'Hele objektet fra høyre side.', 'side'),
        shot('bak', 'Bak', 'Hele objektet bakfra.', 'rear', false),
        ...(type === 'Lift' ? [teller('Timeteller')] : []),
      ]
  }
}

// ---------- Simulert AI ----------
// Ingen AI-tjeneste er koblet til i denne versjonen. Funksjonene under gir forslag
// etter enkle regler, og appen merker dem som simulert. Et menneske bekrefter alltid.
export const AI_SIM = 'Simulert AI'

export function guessType(text: string): ObjType | null {
  const t = text.toLowerCase()
  const map: [RegExp, ObjType][] = [
    [/mini/, 'Minigraver'], [/grav|excav|belte/, 'Gravemaskin'], [/hjullast|laster|loader/, 'Hjullaster'], [/dos|doz/, 'Dosor'],
    [/lastebil|tipp|truck/, 'Lastebil'], [/lift/, 'Lift'], [/henger|trailer/, 'Tilhenger'], [/klype|skuffe|gaffel|redskap/, 'Redskap'], [/varebil|van/, 'Varebil'], [/bil|car/, 'Personbil'],
  ]
  return map.find(([re]) => re.test(t))?.[1] ?? null
}

export function suggestReading(o: Obj, kind: 'utlevering' | 'retur', r?: Rental) {
  if (kind === 'utlevering' || !r?.handover) return o.reading
  const days = rentalDays(r.from, r.to)
  return r.handover.reading + Math.round(days * (o.meter === 'timer' ? 7.2 : 180))
}

export function compareDamage(out: HandoverForm, ret: HandoverForm): AiFinding[] {
  const fresh = ret.damages.filter(d => d.isNew)
  const fromMarks = fresh.map(d => ({ id: uid('f'), angle: 'Merket på tegningen', text: d.note || 'Ny skade merket ved retur', status: 'mulig' as const }))
  if (fromMarks.length) return fromMarks
  // Uten merkede skader viser demoen ett funn, slik at bekreftelsessteget kan prøves.
  const side = ret.photos.find(p => p.angle === 'Venstre side') ?? ret.photos[0]
  return side ? [{ id: uid('f'), angle: side.angle ?? 'Bilde', text: 'Mulig ny bulk sammenlignet med utleveringsbildet', status: 'mulig' }] : []
}

export function adText(o: Obj, mode: 'leie' | 'salg', withDriver: boolean) {
  const cond = ['Selges som den står', 'Brukbar stand', 'God stand', 'Svært god stand', 'Som ny'][o.condition - 1]
  const bits = [
    `${o.name}, ${o.year} modell med ${num(o.reading)} ${o.meter === 'timer' ? 'timer' : 'km'}.`,
    `${cond}. Står i ${o.place}.`,
    o.attachments.length ? `Leveres med ${o.attachments.join(', ').toLowerCase()}.` : '',
    mode === 'leie' ? (withDriver ? 'Kan leies med erfaren fører.' : 'Leies uten fører.') : 'Servicehistorikk og bilder er dokumentert i PlanM8.',
  ]
  return bits.filter(Boolean).join(' ')
}

// ---------- Mottakskontroll ----------
const FUEL = ['Tom', '¼', '½', '¾', 'Full']
export const fuelLabel = (q: number) => FUEL[clamp(Math.round(q), 0, 4)]

export function buildInspection(r: Rental, o: Obj, prev?: Inspection): Inspection {
  const t = r.terms, out = r.handover!, ret = r.ret!
  const days = rentalDays(r.from, r.to)
  const line = (id: string, label: string, kind: InspectionLine['kind'], measured: string, amount: number): InspectionLine =>
    ({ id, label, kind, measured, amount: Math.round(amount), on: prev?.lines.find(l => l.id === id)?.on ?? true })
  const lines: InspectionLine[] = [line('leie', `Leie ${days} ${days === 1 ? 'dag' : 'dager'}`, 'avtalt', 'Avtalt', rentAmount(r))]
  const hrs = sum(r.timesheet.filter(e => e.approved).map(e => e.hours))
  if (r.withDriver && r.driverRate) lines.push(line('forer', 'Fører', 'avtalt', `${num(hrs)} t godkjent`, hrs * r.driverRate))
  if (t.freight) lines.push(line('frakt', 'Frakt t/r', 'avtalt', 'Avtalt', t.freight))
  if (t.serviceAgreement) lines.push(line('service', 'Serviceavtale', 'avtalt', 'Avtalt', t.serviceAgreement))
  if (t.insurance) lines.push(line('forsikring', 'Forsikring', 'avtalt', 'Avtalt', t.insurance))
  if (t.wash) lines.push(line('vask', 'Vask', 'avtalt', 'Tillegg', t.wash))
  if (t.misc) lines.push(line('diverse', 'Diverse tillegg', 'avtalt', 'Tillegg', t.misc))
  const fuelDiff = out.fuel - ret.fuel
  if (fuelDiff > 0) lines.push(line('fuel', 'Drivstoff', 'malt', `${fuelLabel(out.fuel)} → ${fuelLabel(ret.fuel)}`, fuelDiff * t.fuelPerQuarter))
  const tire = out.tireMm - ret.tireMm
  if (tire > 0) lines.push(line('dekk', o.type === 'Gravemaskin' || o.type === 'Minigraver' || o.type === 'Dosor' ? 'Belteslitasje' : 'Dekkslitasje', 'malt', `${tire} mm`, tire * t.tirePerMm))
  const used = ret.reading - out.reading
  if (used > 0 && o.meter === 'timer') lines.push(line('time', 'Slitasje per time', 'malt', `${num(used)} t`, used * t.wearPerHour))
  const findings = prev?.findings ?? compareDamage(out, ret)
  for (const f of findings.filter(f => f.status === 'bekreftet')) lines.push(line('skade-' + f.id, 'Utbedring skade', 'malt', 'Bekreftet funn', f.amount ?? 0))
  return { ...prev, lines, findings }
}
export const inspectionTotal = (i?: Inspection) => sum((i?.lines ?? []).filter(l => l.on).map(l => l.amount))

// ---------- Topp 100 ----------
export const CAT_LABEL: Record<BlinkCat, string> = { vedlikehold: 'Best vedlikeholdt', spektakulaer: 'Mest spektakulære plass', arbeid: 'I arbeid' }

export interface Ranked { blink: Blink; score: number; votes: number; rank: number; qualified: boolean }
/** Vektet snitt: en maskin med få stemmer trekkes mot snittet for alle, og må ha et minste antall stemmer for å stå på lista. */
export function ranking(s: State, cat: BlinkCat | 'totalt' = 'totalt'): Ranked[] {
  const pool = s.blinks.filter(b => b.status === 'godkjent' && (cat === 'totalt' || b.category === cat))
  const stats = pool.map(b => {
    const mine = s.votes.filter(v => v.blinkId === b.id)
    const n = (b.seedVotes?.n ?? 0) + mine.length
    const total = (b.seedVotes ? b.seedVotes.n * b.seedVotes.avg : 0) + sum(mine.map(v => v.score))
    return { b, n, avg: n ? total / n : 0 }
  })
  const allN = sum(stats.map(x => x.n))
  const C = allN ? sum(stats.map(x => x.avg * x.n)) / allN : 70
  const m = s.settings.minVotes
  return stats
    .map(x => ({ blink: x.b, votes: x.n, score: Math.round(((x.n / (x.n + m)) * x.avg + (m / (x.n + m)) * C) * 10) / 10, qualified: x.n >= m, rank: 0 }))
    .sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.score - a.score)
    .map((x, i) => ({ ...x, rank: i + 1 }))
}
