import type { ObjStatus, ObjType, Role, View, Coverage, TaskType, RentalStatus, PartnerKind, LeadType } from '../types'

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 10)
export const token = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8)

// ---------- Datoer ----------
const DAY = 86400000
export const now = () => new Date().toISOString()
export const today = () => new Date().toISOString().slice(0, 10)
export const addDays = (d: string | Date, n: number) => new Date(new Date(d).getTime() + n * DAY).toISOString()
export const dateOnly = (d: string) => d.slice(0, 10)
export const daysBetween = (a: string, b: string) => Math.round((new Date(dateOnly(b)).getTime() - new Date(dateOnly(a)).getTime()) / DAY)
export const rentalDays = (from: string, to: string) => Math.max(1, daysBetween(from, to) + 1)

const MND = ['jan.', 'feb.', 'mars', 'apr.', 'mai', 'juni', 'juli', 'aug.', 'sep.', 'okt.', 'nov.', 'des.']
export const MND_KORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']
export const MND_LANG = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']
const UKEDAG = ['søn.', 'man.', 'tir.', 'ons.', 'tor.', 'fre.', 'lør.']

export function fmtDate(d?: string, withYear = false) {
  if (!d) return '–'
  const x = new Date(d)
  if (isNaN(x.getTime())) return d
  const y = x.getFullYear() !== new Date().getFullYear() || withYear ? ' ' + x.getFullYear() : ''
  return `${x.getDate()}. ${MND[x.getMonth()]}${y}`
}
export function fmtTime(d: string) {
  const x = new Date(d)
  return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`
}
export const fmtDT = (d?: string) => (d ? `${fmtDate(d)} kl. ${fmtTime(d)}` : '–')
export function fmtWhen(d: string) {
  const x = new Date(d)
  if (isNaN(x.getTime())) return d
  const diff = daysBetween(today(), d)
  const day = diff === 0 ? 'I dag' : diff === 1 ? 'I morgen' : diff > 1 && diff < 7 ? UKEDAG[x.getDay()] : fmtDate(d)
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${fmtTime(d)}`
}
export const fmtPeriod = (a?: string, b?: string) => (a && b ? `${fmtDate(a)} – ${fmtDate(b)}` : 'Etter avtale')
export function rel(d: string) {
  const diff = daysBetween(d, today())
  if (diff <= 0) {
    const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000)
    if (mins < 1) return 'nå'
    if (mins < 60) return `${mins} min siden`
    return `i dag ${fmtTime(d)}`
  }
  if (diff === 1) return 'i går'
  if (diff < 30) return `${diff} d siden`
  return fmtDate(d)
}

// ---------- Tall ----------
const nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 })
export const num = (n: number) => nf.format(Math.round(n)).replace(/[\u202F ]/g, '\u00A0')
export const kr = (n: number) => 'kr\u00A0' + num(n)
export const krShort = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2).replace('.', ',')} mill.` : n >= 10_000 ? `${Math.round(n / 1000)} 000` : num(n))
export const tonn = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(kg % 1000 === 0 ? 0 : 1).replace('.', ',')} t` : `${kg} kg`)
export const parseNum = (s: string) => {
  const n = Number(String(s).replace(/\s/g, '').replace(',', '.'))
  return isFinite(n) ? n : 0
}
export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
export const initials = (name: string) => name.split(/\s+/).filter(w => /^[A-ZÆØÅa-zæøå]/.test(w) && !/^(AS|ASA|ENK)$/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'

// ---------- Tekster ----------
export const STATUS_LABEL: Record<ObjStatus, string> = {
  bestilt: 'Bestilt', i_drift: 'I drift', ledig: 'Ledig for leie', utleid: 'Utleid', innleid: 'Innleid', til_salgs: 'Til salgs', solgt: 'Solgt', utrangert: 'Utrangert',
}
export const STATUS_TONE: Record<ObjStatus, string> = {
  bestilt: 'info', i_drift: 'plain', ledig: 'amber', utleid: 'ok', innleid: 'info', til_salgs: 'amber', solgt: 'mute', utrangert: 'mute',
}
export const OBJ_TYPES: ObjType[] = ['Gravemaskin', 'Hjullaster', 'Minigraver', 'Dosor', 'Lastebil', 'Lift', 'Tilhenger', 'Redskap', 'Personbil', 'Varebil']
export const ROLE_LABEL: Record<Role, string> = {
  forer: 'Fører', kjoper: 'Kjøper / leietaker', sjafor: 'Sjåfør / transportør', verksmester: 'Verksmester', admin: 'Administrator', leder: 'Leder / eier', partner: 'Partner',
}
export const VIEW_LABEL: Record<View, string> = { park: 'Park', utleier: 'Utleier', leietaker: 'Leietaker / kjøper', frakt: 'Frakt', forer: 'Fører', partner: 'Partner' }
export const VIEW_SUB: Record<View, string> = {
  park: 'Hele parken med status, verksted og rapporter',
  utleier: 'Annonser, forespørsler, leieforhold og inntekter',
  leietaker: 'Sveip-markedet, favoritter og egne leieforhold',
  frakt: 'Send noe, gi bud og kjør oppdrag',
  forer: 'Skann QR, meld feil og ta blinkskudd',
  partner: 'Forespørsler som er tildelt deg',
}
export const COVERAGE_LABEL: Record<Coverage, string> = { ansvar: 'Ansvarsforsikring', innleid: 'Forsikring for innleid utstyr', kasko: 'Kasko på innleide objekter', gods: 'Godsansvar under frakt' }
export const TASK_LABEL: Record<TaskType, string> = { flytt: 'Trenger flytting', feil: 'Feil eller skade', service: 'Trenger service', annet: 'Annet', eu: 'EU-kontroll' }
export const TASK_ICON: Record<TaskType, string> = { flytt: 'FLYT', feil: 'FEIL', service: 'SERV', annet: 'ANN', eu: 'EU' }
export const RENTAL_LABEL: Record<RentalStatus, string> = {
  godkjent: 'Venter på forskudd', forskudd: 'Klar for utlevering', utlevert: 'Utlevert', returnert: 'Returnert', kontroll: 'Mottakskontroll sendt', oppgjort: 'Oppgjort', avsluttet: 'Avsluttet', avbrutt: 'Avbrutt',
}
export const PARTNER_LABEL: Record<PartnerKind, string> = { forhandler: 'Maskinforhandler', verksted: 'Verksted', takst: 'Takstmann', redskap: 'Redskapsleverandør', finans: 'Finanspartner', forsikring: 'Forsikringspartner' }
export const LEAD_LABEL: Record<LeadType, string> = { redskap: 'Pris på redskap', innbytte: 'Utskifting eller innbytte', service: 'Service', takst: 'Takst', finans: 'Finansiering', forsikring: 'Forsikring' }
export const LEAD_PARTNER: Record<LeadType, PartnerKind> = { redskap: 'redskap', innbytte: 'forhandler', service: 'verksted', takst: 'takst', finans: 'finans', forsikring: 'forsikring' }
export const UNIT_LABEL = { dag: '/dag', uke: '/uke', mnd: '/mnd', fast: '' } as const
export const meterUnit = (m: 'timer' | 'km') => (m === 'timer' ? 't' : 'km')

// ---------- Steder og avstand ----------
export const PLACES: Record<string, [number, number]> = {
  'Bodø': [67.28, 14.4], 'Fauske': [67.26, 15.39], 'Mo i Rana': [66.31, 14.14], 'Saltstraumen': [67.23, 14.62], 'Rognan': [67.1, 15.39],
  'Mosjøen': [65.84, 13.19], 'Narvik': [68.44, 17.43], 'Sortland': [68.69, 15.41], 'Svolvær': [68.23, 14.57], 'Leknes': [68.15, 13.61],
  'Sandnessjøen': [66.02, 12.63], 'Brønnøysund': [65.47, 12.21], 'Harstad': [68.8, 16.54], 'Tromsø': [69.65, 18.96], 'Finnsnes': [69.23, 17.98],
  'Alta': [69.97, 23.27], 'Hammerfest': [70.66, 23.68], 'Kirkenes': [69.73, 30.05], 'Namsos': [64.47, 11.5], 'Steinkjer': [64.01, 11.5],
  'Trondheim': [63.43, 10.39], 'Kristiansund': [63.11, 7.73], 'Molde': [62.74, 7.16], 'Ålesund': [62.47, 6.15], 'Førde': [61.45, 5.86],
  'Bergen': [60.39, 5.32], 'Haugesund': [59.41, 5.27], 'Stavanger': [58.97, 5.73], 'Kristiansand': [58.15, 8.0], 'Arendal': [58.46, 8.77],
  'Skien': [59.21, 9.61], 'Tønsberg': [59.27, 10.41], 'Drammen': [59.74, 10.2], 'Oslo': [59.91, 10.75], 'Fredrikstad': [59.22, 10.93],
  'Hamar': [60.79, 11.07], 'Lillehammer': [61.12, 10.47], 'Røros': [62.57, 11.38], 'Nordland': [67.0, 14.6], 'Troms': [69.2, 18.5], 'Trøndelag': [63.8, 11.0],
}
export const PLACE_NAMES = Object.keys(PLACES).filter(p => !['Nordland', 'Troms', 'Trøndelag'].includes(p))
export const coords = (place: string): [number, number] | null => PLACES[place] ?? PLACES[Object.keys(PLACES).find(p => p.toLowerCase() === place.trim().toLowerCase()) ?? ''] ?? null

function hav(a: [number, number], b: [number, number]) {
  const R = 6371, rad = Math.PI / 180
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
/** Omtrentlig kjøreavstand i km (luftlinje × 1,3). Null når stedet er ukjent. */
export function distKm(a: string, b: string): number | null {
  const ca = coords(a), cb = coords(b)
  if (!ca || !cb) return null
  return Math.round(hav(ca, cb) * 1.3)
}
/** Ekstra km for en bil på ruten from → to som tar med et oppdrag pFrom → pTo. */
export function detourKm(from: string, to: string, pFrom: string, pTo: string): number | null {
  const base = distKm(from, to), a = distKm(from, pFrom), b = distKm(pFrom, pTo), c = distKm(pTo, to)
  if (base == null || a == null || b == null || c == null) return null
  return Math.max(0, a + b + c - base)
}

// ---------- CSV ----------
export function parseCsv(text: string): string[][] {
  const first = text.split(/\r?\n/)[0] ?? ''
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? (first.includes('\t') && !first.includes(';') ? '\t' : ';') : ','
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === sep) { row.push(cell.trim()); cell = '' }
    else if (ch === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row) }
  return rows.filter(r => r.some(c => c !== ''))
}
export const toCsv = (rows: (string | number)[][]) =>
  '﻿' + rows.map(r => r.map(c => { const s = String(c ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }).join(';')).join('\n')
