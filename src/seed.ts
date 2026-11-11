// Demodata. Alle bedrifter, personer, organisasjonsnumre og tall er oppdiktet.
import type { Blink, BlinkCat, Company, HandoverForm, Listing, Obj, ObjType, PartnerKind, Photo, Rating, Role, State, Terms, User, Winner } from './types'
import { addDays, dateOnly, now, token, uid } from './lib/util'
import { buildInspection, DEFAULT_TERMS, shotsFor } from './lib/logic'
import { genSrc } from './lib/images'
import { overlayShape } from './lib/shapes'

const d = (n: number, h = 9, m = 0) => { const x = new Date(Date.now() + n * 86400000); x.setHours(h, m, 0, 0); return x.toISOString() }
const day = (n: number) => dateOnly(addDays(now(), n))
/** Neste forekomst av en ukedag (0 = søndag), minst to dager frem. */
const nextDow = (dow: number, h: number, m = 0) => { for (let i = 2; i < 10; i++) if (new Date(d(i)).getDay() === dow) return d(i, h, m); return d(3, h, m) }

const company = (id: string, name: string, place: string, orgnr: string, extra: Partial<Company> = {}): Company => ({
  id, name, place, orgnr, verified: true, departments: [], partners: [], insurance: [], partnerKinds: [], joinedAt: d(-400),
  alerts: { eu: true, service: true, stale: true }, ...extra,
})
const ins = (insurer: string, coverage: 'ansvar' | 'innleid' | 'kasko' | 'gods', days: number) => ({ id: uid('i'), insurer, policyNo: 'P-' + Math.floor(100000 + Math.random() * 899999), coverage, expires: day(days) })
const partner = (id: string, name: string, place: string, orgnr: string, kind: PartnerKind) => company(id, name, place, orgnr, { partnerKinds: [kind], responseHours: 4 })

const user = (id: string, name: string, companyId: string, roles: Role[], department?: string, consentName = false): User =>
  ({ id, name, email: `${name.split(' ')[0].toLowerCase()}@${companyId}.example`, memberships: [{ companyId, roles, department }], consentName })

const photo = (src: string, n = -30, angle?: string, place?: string): Photo => ({ id: uid('ph'), src, at: d(n), source: src.startsWith('demo:') ? 'app' : 'demo', angle, place })

interface O { id: string; co: string; iid: string; type: ObjType; name: string; make?: string; model?: string; year: number; dept?: string; place: string; reading: number; km?: boolean; kg: number; status?: Obj['status']; cond?: Obj['condition']; img?: string; att?: string[]; service?: Obj['service']; usage?: number; resp?: string; hist?: [number, string, string][]; specs?: Record<string, string>; price?: number }
const obj = (o: O): Obj => ({
  id: o.id, companyId: o.co, disponentId: o.co, internalId: o.iid, type: o.type, name: o.name, make: o.make ?? '', model: o.model ?? '', year: o.year,
  serial: `${(o.model || o.type).replace(/\W/g, '').slice(0, 5).toUpperCase()}-${o.iid.replace(/\D/g, '')}-${1000 + (o.reading % 8999)}`,
  department: o.dept ?? '', place: o.place, meter: o.km ? 'km' : 'timer', reading: o.reading, readingAt: d(-12), checkedAt: d(-12), weightKg: o.kg,
  status: o.status ?? 'i_drift', condition: o.cond ?? 4,
  photos: [photo(o.img ?? genSrc(o.type, '', o.name), -60, 'Venstre side', o.place)],
  docs: [{ id: uid('d'), name: 'Samsvarserklæring', kind: 'PDF', at: d(-300) }, { id: uid('d'), name: o.km ? 'EU-kontroll' : 'Sertifisert sikkerhetskontroll', kind: 'PDF', at: d(-120) }],
  history: (o.hist ?? [[-200, 'registrert', 'Registrert i parken']]).map(([n, type, text]) => ({ id: uid('h'), at: d(n), type, text })),
  specs: { Driftsvekt: `${(o.kg / 1000).toLocaleString('nb-NO')} t`, ...(o.specs ?? {}) },
  attachments: o.att ?? [], responsible: o.resp, service: o.service ?? {}, usage30: o.usage ?? 12, purchasePrice: o.price,
})

const listing = (id: string, objId: string, co: string, mode: 'leie' | 'salg', price: number, extra: Partial<Listing> = {}): Listing => ({
  id, objId, companyId: co, mode, price, unit: mode === 'salg' ? 'fast' : 'dag', withDriver: false, visibility: 'alle', invited: [], linkToken: token(),
  text: '', active: true, createdAt: d(-14), priceHistory: [{ at: d(-14), price }], terms: { ...DEFAULT_TERMS }, ...extra,
})

const rate = (to: string, from: string, stars: number[], refType: Rating['refType'] = 'leie'): Rating[] =>
  stars.map((s, i) => ({ id: uid('r'), fromCompanyId: from, toCompanyId: to, refType, refId: 'tidligere', stars: s, at: d(-30 - i * 21) }))

function form(kind: 'utlevering' | 'retur', o: Obj, n: number, reading: number, fuel: number, tireMm: number, by: string, to: string): HandoverForm {
  return {
    kind, at: d(n, 8, 30), place: o.place, deliveredBy: by, receivedBy: to, reading, fuel, tireMm, tools: o.attachments.slice(0, 1), keys: 2, papers: true,
    damages: kind === 'retur' ? [{ id: uid('s'), x: 0.34, y: 0.52, note: 'Ripe i dør', isNew: true }] : [],
    photos: shotsFor(o.type).filter(s => s.required).map(s => photo(genSrc(o.type, overlayShape(o.type, s.overlay), s.label), n, s.label, o.place)),
    signLessor: SIGN, signLessee: SIGN, completedAt: d(n, 8, 50), readingAi: true,
  }
}
// En liten strek som står for signaturene i demodataene.
const SIGN = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><path d="M12 42c18-30 26-30 30-8s10 12 18-6 14 22 26 6 20-22 30-4 26 8 70-10" fill="none" stroke="#13201B" stroke-width="2.5" stroke-linecap="round"/></svg>')

export function seed(): State {
  const companies: Company[] = [
    company('fj', 'Fjellvik Maskin AS', 'Bodø', '900 100 001', { departments: ['Avd. Nord', 'Avd. Sør'], partners: ['sa', 'ra'], insurance: [ins('Havblikk Forsikring', 'ansvar', 210), ins('Havblikk Forsikring', 'innleid', 210)], blinkDeclaration: { by: 'kari', at: d(-45) }, responseHours: 2, prior: { rentals: 31, deals: 23, damages: 1 } }),
    company('sa', 'Saltnes Bygg AS', 'Fauske', '900 100 002', { partners: ['fj'], insurance: [ins('Havblikk Forsikring', 'ansvar', 180), ins('Havblikk Forsikring', 'innleid', 180)], responseHours: 3, prior: { rentals: 14, deals: 6, damages: 0 } }),
    company('tv', 'Tverrå Anlegg AS', 'Mo i Rana', '900 100 003', { insurance: [ins('Nordkyst Skade', 'ansvar', 12)], responseHours: 8, prior: { rentals: 5, deals: 2, damages: 1 } }),
    company('sk', 'Skjerstad Maskin', 'Bodø', '900 100 004', { joinedAt: d(-3), responseHours: 24 }),
    company('ra', 'Ranfjord Transport AS', 'Mo i Rana', '900 100 005', { partners: ['fj'], transport: { permit: true, permitExpires: day(400) }, insurance: [ins('Nordkyst Skade', 'gods', 150), ins('Nordkyst Skade', 'ansvar', 150)], blinkDeclaration: { by: 'per', at: d(-80) }, responseHours: 1, prior: { rentals: 0, deals: 48, damages: 0 } }),
    company('he', 'Helgeland Spesialtransport AS', 'Mosjøen', '900 100 006', { transport: { permit: true, permitExpires: day(250) }, insurance: [ins('Nordkyst Skade', 'gods', 90)], blinkDeclaration: { by: 'heidi', at: d(-60) }, responseHours: 2, prior: { rentals: 0, deals: 112, damages: 1 } }),
    company('la', 'Lars Varetransport', 'Bodø', '900 100 007', { transport: { permit: false }, responseHours: 5, prior: { rentals: 0, deals: 9, damages: 0 } }),
    company('ve', 'Vesterål Utleie AS', 'Sortland', '900 100 008', { insurance: [ins('Havblikk Forsikring', 'ansvar', 300)], blinkDeclaration: { by: 'vera', at: d(-100) }, responseHours: 3, prior: { rentals: 64, deals: 12, damages: 2 } }),
    { ...partner('no', 'Nordtind Maskinsalg AS', 'Bodø', '900 100 009', 'forhandler'), blinkDeclaration: { by: 'dag', at: d(-90) }, prior: { rentals: 0, deals: 87, damages: 0 } },
    partner('bl', 'Blåfjell Verksted AS', 'Fauske', '900 100 010', 'verksted'),
    partner('st', 'Saltfjord Takst AS', 'Bodø', '900 100 011', 'takst'),
    partner('po', 'Polarkant Redskap AS', 'Mo i Rana', '900 100 012', 'redskap'),
    partner('nf', 'Nordlys Finans AS', 'Tromsø', '900 100 013', 'finans'),
    partner('hb', 'Havblikk Forsikring AS', 'Trondheim', '900 100 014', 'forsikring'),
    partner('kv', 'Kvitberg Maskin AS', 'Narvik', '900 100 015', 'forhandler'),
  ]

  const users: User[] = [
    user('kari', 'Kari Fjellvik', 'fj', ['leder', 'admin']),
    user('jonas', 'Jonas Berg', 'fj', ['admin']),
    user('marte', 'Marte Lind', 'fj', ['verksmester']),
    user('ola', 'Ola Nygård', 'fj', ['forer'], 'Avd. Nord', true),
    user('ingrid', 'Ingrid Sand', 'fj', ['forer'], 'Avd. Sør'),
    user('nils', 'Nils Brekke', 'sa', ['kjoper', 'admin']),
    user('tone', 'Tone Aas', 'tv', ['kjoper', 'admin']),
    user('mats', 'Mats Solli', 'sk', ['kjoper', 'admin']),
    user('per', 'Per Hauge', 'ra', ['sjafor', 'admin'], undefined, true),
    user('heidi', 'Heidi Strand', 'he', ['sjafor', 'admin']),
    user('lars', 'Lars Moen', 'la', ['sjafor', 'admin']),
    user('vera', 'Vera Holm', 've', ['leder', 'admin']),
    user('dag', 'Dag Nordtind', 'no', ['partner', 'admin']),
    user('bente', 'Bente Blåfjell', 'bl', ['partner']),
    user('sture', 'Sture Saltfjord', 'st', ['partner']),
    user('pia', 'Pia Polarkant', 'po', ['partner']),
    user('finn', 'Finn Lysvik', 'nf', ['partner']),
    user('hanne', 'Hanne Havblikk', 'hb', ['partner']),
    user('knut', 'Knut Kvitberg', 'kv', ['partner']),
  ]

  const N = 'Avd. Nord', S = 'Avd. Sør'
  const objects: Obj[] = [
    obj({ id: 'o_hl70', co: 'fj', iid: 'HL-0412', type: 'Hjullaster', name: 'Hjullaster L70H', model: 'L70H', year: 2019, dept: N, place: 'Fauske', reading: 3100, kg: 14000, status: 'til_salgs', cond: 5, img: 'demo:hjullaster', att: ['Riveklype', 'Pallegafler', 'Skuffe'], usage: 19, resp: 'ola', service: { interval: 500, nextAt: 3250 }, specs: { Motor: 'Steg V diesel', Redskapsfeste: 'Hydraulisk hurtigfeste' }, hist: [[-900, 'registrert', 'Registrert i parken'], [-84, 'flytt', 'Flyttet Bodø → Fauske'], [-69, 'service', 'Service 3 000 t'], [-29, 'leie', 'Retur fra leie, mottakskontroll godkjent']] }),
    obj({ id: 'o_dosor', co: 'fj', iid: 'DO-0207', type: 'Dosor', name: 'Dosor med maskinstyring', model: 'D5K', year: 2018, dept: N, place: 'Bodø', reading: 4200, kg: 13000, status: 'ledig', img: 'demo:dosor', usage: 13, resp: 'ola', service: { interval: 500, nextAt: 4500 }, specs: { Maskinstyring: '3D GPS', Skjær: '6-veis' } }),
    obj({ id: 'o_komp', co: 'fj', iid: 'HL-0518', type: 'Hjullaster', name: 'Kompakt hjullaster', model: 'H528', year: 2021, dept: N, place: 'Bodø', reading: 1800, kg: 5200, status: 'utleid', img: 'demo:kompakt', att: ['Skuffe'], usage: 24, service: { interval: 500, nextAt: 2000 } }),
    obj({ id: 'o_tipp', co: 'fj', iid: 'TB-0301', type: 'Lastebil', name: 'Tippbil 6x4', model: 'TGX 26.580', year: 2016, dept: S, place: 'Mo i Rana', reading: 412000, km: true, kg: 12000, cond: 3, img: 'demo:tippbil-plog', usage: 7, resp: 'ingrid', service: { euDate: day(160) }, specs: { Påbygg: 'Tippkasse', Plogfeste: 'Ja' } }),
    obj({ id: 'o_lift', co: 'fj', iid: 'LI-0109', type: 'Lift', name: 'Lift 12 m', year: 2017, dept: S, place: 'Mo i Rana', reading: 1400, kg: 3200, cond: 3, usage: 9, service: { interval: 250, nextAt: 1500 }, specs: { Arbeidshøyde: '12 m' } }),
    obj({ id: 'o_grav', co: 'fj', iid: 'GR-0611', type: 'Gravemaskin', name: 'Beltegraver 14 t', year: 2015, dept: N, place: 'Bodø', reading: 6900, kg: 14500, cond: 3, usage: 21, resp: 'ola', service: { interval: 500, nextAt: 7000 }, att: ['Graveskuffe', 'Pusseskuffe'] }),
    obj({ id: 'o_hl9', co: 'fj', iid: 'HL-0320', type: 'Hjullaster', name: 'Hjullaster 9 t', year: 2020, dept: N, place: 'Fauske', reading: 2950, kg: 9000, status: 'ledig', usage: 15, service: { interval: 500, nextAt: 3000 }, att: ['Skuffe', 'Pallegafler'] }),
    obj({ id: 'o_lb', co: 'fj', iid: 'LB-0402', type: 'Lastebil', name: 'Lastebil 4-akslet', year: 2019, dept: S, place: 'Mo i Rana', reading: 288000, km: true, kg: 15000, usage: 22, resp: 'ingrid', service: { euDate: day(30) } }),
    obj({ id: 'o_mini', co: 'fj', iid: 'MG-0715', type: 'Minigraver', name: 'Minigraver 3 t', year: 2022, dept: N, place: 'Bodø', reading: 900, kg: 3000, status: 'ledig', cond: 4, usage: 11, service: { interval: 250, nextAt: 1000 }, att: ['Graveskuffe'], hist: [[-500, 'registrert', 'Registrert i parken'], [-33, 'leie', 'Retur fra leie, mottakskontroll låst']] }),
    obj({ id: 'o_hen', co: 'fj', iid: 'TH-0904', type: 'Tilhenger', name: 'Maskinhenger 3,5 t', year: 2020, dept: N, place: 'Bodø', reading: 21000, km: true, kg: 900, usage: 6, service: { euDate: day(240) } }),
    obj({ id: 'o_klype', co: 'fj', iid: 'RS-0801', type: 'Redskap', name: 'Riveklype', year: 2019, dept: N, place: 'Fauske', reading: 0, kg: 650, usage: 4 }),
    obj({ id: 'o_gaffel', co: 'fj', iid: 'RS-0802', type: 'Redskap', name: 'Pallegafler', year: 2019, dept: N, place: 'Fauske', reading: 0, kg: 320, usage: 8 }),

    obj({ id: 'r_tipp', co: 'ra', iid: 'RT-01', type: 'Lastebil', name: 'Tippbil 6x4', model: 'TGX 26.580', year: 2018, place: 'Mo i Rana', reading: 356000, km: true, kg: 12500, status: 'til_salgs', img: 'demo:tippbil', usage: 24, specs: { Påbygg: 'Tippkasse' } }),
    obj({ id: 'r_hen', co: 'ra', iid: 'RT-02', type: 'Lastebil', name: 'Lastebil med maskinhenger', year: 2020, place: 'Mo i Rana', reading: 240000, km: true, kg: 14000, usage: 25 }),
    obj({ id: 'h_semi', co: 'he', iid: 'HS-11', type: 'Lastebil', name: 'Trekkvogn med maskinhenger', year: 2021, place: 'Mosjøen', reading: 198000, km: true, kg: 16000, usage: 26 }),
    obj({ id: 'l_vare', co: 'la', iid: 'LV-1', type: 'Varebil', name: 'Varebil med tilhenger', year: 2019, place: 'Bodø', reading: 142000, km: true, kg: 2200, usage: 20 }),

    obj({ id: 'v_grav', co: 've', iid: 'VU-21', type: 'Gravemaskin', name: 'Beltegraver 20 t', year: 2020, place: 'Sortland', reading: 4100, kg: 20500, status: 'ledig', usage: 14, att: ['Graveskuffe', 'Tiltrotator'] }),
    obj({ id: 'v_lift', co: 've', iid: 'VU-34', type: 'Lift', name: 'Lift 16 m', year: 2021, place: 'Sortland', reading: 800, kg: 6800, status: 'ledig', cond: 5, usage: 10 }),
    obj({ id: 'v_mini', co: 've', iid: 'VU-40', type: 'Minigraver', name: 'Minigraver 2 t', year: 2023, place: 'Bodø', reading: 400, kg: 1900, status: 'ledig', cond: 5, usage: 16 }),
    obj({ id: 'n_grav', co: 'no', iid: 'NM-102', type: 'Gravemaskin', name: 'Hjulgraver 8 t', year: 2017, place: 'Bodø', reading: 5200, kg: 8400, status: 'til_salgs', cond: 3, usage: 0 }),
    obj({ id: 'n_hl', co: 'no', iid: 'NM-117', type: 'Hjullaster', name: 'Hjullaster 12 t', year: 2016, place: 'Narvik', reading: 7800, kg: 12000, status: 'til_salgs', cond: 3, usage: 0 }),
    obj({ id: 'n_mini', co: 'no', iid: 'NM-125', type: 'Minigraver', name: 'Minigraver 1,8 t', year: 2021, place: 'Bodø', reading: 1100, kg: 1800, status: 'til_salgs', usage: 0 }),
    obj({ id: 'n_sold', co: 'no', iid: 'NM-098', type: 'Lastebil', name: 'Tippbil 8x4', year: 2015, place: 'Bodø', reading: 498000, km: true, kg: 14000, status: 'solgt', cond: 2, usage: 0 }),
    obj({ id: 's_vare', co: 'sa', iid: 'SB-3', type: 'Varebil', name: 'Varebil', year: 2021, place: 'Fauske', reading: 64000, km: true, kg: 2100, usage: 22 }),
    obj({ id: 's_mini', co: 'sa', iid: 'SB-7', type: 'Minigraver', name: 'Minigraver 1,5 t', year: 2020, place: 'Fauske', reading: 1600, kg: 1500, usage: 9 }),
    obj({ id: 't_hen', co: 'tv', iid: 'TA-2', type: 'Tilhenger', name: 'Tilhenger 2 t', year: 2018, place: 'Mo i Rana', reading: 30000, km: true, kg: 500, usage: 5 }),
  ]
  const O = (id: string) => objects.find(o => o.id === id)!

  const komTerms: Terms = { ...DEFAULT_TERMS, freight: 3800 }
  const listings: Listing[] = [
    listing('L1', 'o_hl70', 'fj', 'salg', 1_290_000, { priceHistory: [{ at: d(-20), price: 1_350_000 }, { at: d(-3), price: 1_290_000 }], createdAt: d(-20), useBlink: true }),
    listing('L2', 'o_dosor', 'fj', 'leie', 4800, { withDriver: true, driverRate: 890, driverId: 'ola', visibility: 'partnere', from: day(3), to: day(30), priceHistory: [{ at: d(-10), price: 5200 }, { at: d(-2), price: 4800 }] }),
    listing('L3', 'o_komp', 'fj', 'leie', 1050, { active: false, terms: komTerms }),
    listing('L4', 'o_hl9', 'fj', 'leie', 2400, { from: day(5), to: day(23) }),
    listing('L5', 'o_mini', 'fj', 'leie', 1450),
    listing('L6', 'r_tipp', 'ra', 'salg', 780_000),
    listing('L7', 'v_grav', 've', 'leie', 3900),
    listing('L8', 'v_lift', 've', 'leie', 1300),
    listing('L9', 'v_mini', 've', 'leie', 1200),
    listing('L10', 'n_grav', 'no', 'salg', 690_000),
    listing('L11', 'n_hl', 'no', 'salg', 540_000),
    listing('L12', 'n_mini', 'no', 'salg', 265_000),
    listing('L13', 'n_sold', 'no', 'salg', 310_000, { active: false }),
  ]
  for (const l of listings) if (!l.text) { const o = O(l.objId); l.text = `${o.name}, ${o.year} modell. Står i ${o.place}.` }

  // Leieforhold #8154: Kompakt hjullaster er utlevert til Saltnes Bygg og skal snart tilbake.
  const komp = O('o_komp')
  const r1 = {
    id: 'RN1', no: 8154, requestId: 'RQ5', listingId: 'L3', objId: 'o_komp', lessorId: 'fj', lesseeId: 'sa', from: day(-10), to: day(1), price: 1050, unit: 'dag' as const,
    withDriver: false, terms: komTerms, status: 'utlevert' as const, advance: { amount: 3780, paidAt: d(-11), releasedAt: d(-10) },
    handover: form('utlevering', komp, -10, 1714, 3, 14, 'Jonas Berg', 'Nils Brekke'), timesheet: [], claims: [], createdAt: d(-12),
    log: [{ id: uid('h'), at: d(-12), type: 'godkjent', text: 'Utleier godkjente leietaker' }, { id: uid('h'), at: d(-11), type: 'forskudd', text: 'Forskudd betalt' }, { id: uid('h'), at: d(-10), type: 'utlevering', text: 'Utlevert med bilder og signatur' }],
  }
  r1.handover.damages = []
  // Leieforhold #8121: Minigraver, ferdig oppgjort, med låst mottakskontroll.
  const mini = O('o_mini')
  const r0base = {
    id: 'RN0', no: 8121, requestId: 'RQ6', listingId: 'L5', objId: 'o_mini', lessorId: 'fj', lesseeId: 'tv', from: day(-40), to: day(-33), price: 1450, unit: 'dag' as const,
    withDriver: false, terms: { ...DEFAULT_TERMS, freight: 2600 }, status: 'avsluttet' as const, advance: { amount: 3480, paidAt: d(-41), releasedAt: d(-40) },
    handover: form('utlevering', mini, -40, 842, 4, 22, 'Jonas Berg', 'Tone Aas'), ret: form('retur', mini, -33, 896, 2, 21, 'Tone Aas', 'Jonas Berg'), timesheet: [], createdAt: d(-43),
    claims: [{ id: uid('c'), byCompanyId: 'fj', type: 'kompensasjon' as const, text: 'Ripe i dør, utbedret på verksted', amount: 2500, status: 'godtatt' as const, at: d(-32) }],
    log: [{ id: uid('h'), at: d(-43), type: 'godkjent', text: 'Utleier godkjente leietaker' }, { id: uid('h'), at: d(-40), type: 'utlevering', text: 'Utlevert med bilder og signatur' }, { id: uid('h'), at: d(-33), type: 'retur', text: 'Returnert med bilder og signatur' }, { id: uid('h'), at: d(-32), type: 'kontroll', text: 'Mottakskontroll låst' }],
  }
  r0base.handover.damages = []
  const insp0 = buildInspection(r0base, mini)
  insp0.findings = insp0.findings.map(f => ({ ...f, status: 'bekreftet' as const, amount: 2500 }))
  const insp0b = { ...buildInspection({ ...r0base, inspection: insp0 }, mini, insp0), sentAt: d(-33, 14), lesseeStatus: 'godkjent' as const, lockedAt: d(-32), lockedBy: 'Jonas Berg' }
  const r0 = { ...r0base, inspection: insp0b }

  const cat = (c: BlinkCat) => c
  const blink = (id: string, objId: string, by: string, category: BlinkCat, n: number, avg: number, src?: string, status: Blink['status'] = 'godkjent', faces = true): Blink => {
    const o = O(objId)
    return { id, objId, companyId: o.companyId, objName: o.name, objType: o.type, photo: photo(src ?? genSrc(o.type, '', o.name), -20, undefined, o.place), takenBy: by, at: d(status === 'venter' ? -1 : -20), area: o.place === 'Fauske' || o.place === 'Bodø' ? 'Salten' : o.place, category, status, checks: { faces, plates: true, position: true }, seedVotes: n ? { n, avg } : undefined }
  }
  const blinks: Blink[] = [
    blink('b1', 'o_hl70', 'ola', cat('vedlikehold'), 412, 96, 'demo:hjullaster'),
    blink('b2', 'r_tipp', 'per', cat('arbeid'), 380, 94, 'demo:tippbil'),
    blink('b3', 'o_dosor', 'ola', cat('spektakulaer'), 301, 93, 'demo:dosor'),
    blink('b4', 'o_komp', 'ola', cat('vedlikehold'), 150, 91, 'demo:kompakt'),
    blink('b5', 'o_tipp', 'ingrid', cat('arbeid'), 220, 89, 'demo:tippbil-plog'),
    blink('b6', 'v_grav', 'vera', cat('spektakulaer'), 190, 88),
    blink('b7', 'h_semi', 'heidi', cat('arbeid'), 260, 87),
    blink('b8', 'v_lift', 'vera', cat('vedlikehold'), 96, 85),
    blink('b9', 'n_mini', 'dag', cat('vedlikehold'), 71, 84),
    blink('b10', 'r_hen', 'per', cat('spektakulaer'), 133, 82),
    blink('b11', 'v_mini', 'vera', cat('arbeid'), 58, 80),
    blink('b12', 'n_grav', 'dag', cat('arbeid'), 44, 77),
    blink('b13', 'n_hl', 'dag', cat('spektakulaer'), 3, 95),
    blink('bp1', 'o_grav', 'ola', cat('arbeid'), 0, 0, undefined, 'venter'),
    blink('bp2', 'o_tipp', 'ingrid', cat('arbeid'), 0, 0, genSrc('Lastebil', '', 'Tippbil 6x4, nytt bilde'), 'venter'),
    blink('bp3', 'o_hl9', 'ola', cat('vedlikehold'), 0, 0, undefined, 'venter', false),
  ]

  const nowD = new Date()
  const winnerSeeds: [string, string, ObjType, string, string, string][] = [
    ['o_hl70', 'Hjullaster L70H', 'Hjullaster', 'demo:hjullaster', 'Ola Nygård', 'Fjellvik Maskin AS'],
    ['o_tipp', 'Tippbil med plogfeste', 'Lastebil', 'demo:tippbil-plog', '', 'Fjellvik Maskin AS'],
    ['v_komp', 'Kompakt hjullaster', 'Hjullaster', 'demo:kompakt', 'Vera Holm', 'Vesterål Utleie AS'],
    ['r_tipp', 'Tippbil 6x4', 'Lastebil', 'demo:tippbil', 'Per Hauge', 'Ranfjord Transport AS'],
    ['o_dosor', 'Dosor med maskinstyring', 'Dosor', 'demo:dosor', 'Ola Nygård', 'Fjellvik Maskin AS'],
  ]
  // De to eldste seirene ligger mer enn tolv måneder tilbake, så regelen om én seier per år holder.
  const monthsBack = [1, 2, 3, 4, 14]
  const winners: Winner[] = winnerSeeds.map(([objKey, objName, objType, img, driver, comp], i) => {
    const m = new Date(nowD.getFullYear(), nowD.getMonth() - monthsBack[i], 1)
    return { id: uid('w'), year: m.getFullYear(), month: m.getMonth(), objKey, objName, objType, img, driver: driver || undefined, company: comp }
  })

  return {
    v: 1, seededAt: now(), session: { userId: 'kari', companyId: 'fj', view: 'park' },
    companies, users, objects, listings,
    wishes: {
      nils: { mode: 'begge', types: ['Gravemaskin', 'Hjullaster', 'Lastebil', 'Dosor'], area: 'Fauske', radiusKm: 100, maxReading: 8000, yearFrom: 2015, maxPrice: null, notify: true },
    },
    wanted: [{ id: 'W1', companyId: 'tv', userId: 'tone', mode: 'leie', type: 'Gravemaskin', text: 'Ønsker å leie beltegraver 14–20 t i Mo i Rana i tre uker fra neste måned.', area: 'Mo i Rana', at: d(-2), responses: [] }],
    favorites: [
      { id: 'F1', userId: 'nils', listingId: 'L1', at: d(-6), seenPrice: 1_290_000 },
      { id: 'F2', userId: 'nils', listingId: 'L2', at: d(-5), seenPrice: 5200 },
      { id: 'F3', userId: 'nils', listingId: 'L4', at: d(-1), seenPrice: 2400 },
      { id: 'F4', userId: 'nils', listingId: 'L13', at: d(-15), seenPrice: 310_000 },
    ],
    passes: {},
    requests: [
      { id: 'RQ1', listingId: 'L1', objId: 'o_hl70', mode: 'salg', fromCompanyId: 'sa', fromUserId: 'nils', toCompanyId: 'fj', status: 'godkjent', createdAt: d(-2), decidedAt: d(-1), message: 'Vi ser etter en hjullaster til nytt anlegg på Fauske.' },
      { id: 'RQ2', listingId: 'L4', objId: 'o_hl9', mode: 'leie', fromCompanyId: 'sa', fromUserId: 'nils', toCompanyId: 'fj', from: day(5), to: day(23), withDriver: true, status: 'venter', createdAt: d(-1, 10) },
      { id: 'RQ3', listingId: 'L4', objId: 'o_hl9', mode: 'leie', fromCompanyId: 'tv', fromUserId: 'tone', toCompanyId: 'fj', from: day(5), to: day(23), status: 'venter', createdAt: d(-1, 13) },
      { id: 'RQ4', listingId: 'L4', objId: 'o_hl9', mode: 'leie', fromCompanyId: 'sk', fromUserId: 'mats', toCompanyId: 'fj', from: day(8), to: day(20), status: 'venter', createdAt: d(0, 7) },
      { id: 'RQ5', listingId: 'L3', objId: 'o_komp', mode: 'leie', fromCompanyId: 'sa', fromUserId: 'nils', toCompanyId: 'fj', from: day(-10), to: day(1), status: 'godkjent', createdAt: d(-13), decidedAt: d(-12), rentalId: 'RN1' },
      { id: 'RQ6', listingId: 'L5', objId: 'o_mini', mode: 'leie', fromCompanyId: 'tv', fromUserId: 'tone', toCompanyId: 'fj', from: day(-40), to: day(-33), status: 'godkjent', createdAt: d(-44), decidedAt: d(-43), rentalId: 'RN0' },
    ],
    messages: [
      { id: uid('m'), requestId: 'RQ1', fromCompanyId: 'fj', fromUserId: 'kari', kind: 'system', text: 'Selger har akseptert deg. Dere kan nå se hverandres firma.', at: d(-1) },
      { id: uid('m'), requestId: 'RQ1', fromCompanyId: 'fj', fromUserId: 'kari', kind: 'melding', text: 'Hei Nils. Maskinen står på Fauske. Si fra om dere vil se den.', at: d(-1, 11) },
    ],
    bids: [], sales: [],
    rentals: [r1, r0],
    tasks: [
      { id: 'T1', companyId: 'fj', objId: 'o_lift', type: 'feil', title: 'Hydraulikklekkasje', text: 'Lekker fra sylinderen ved bommen.', photo: photo(genSrc('Lift', '', 'Lekkasje ved bom'), 0), status: 'ny', reportedBy: 'ingrid', at: d(0, 7, 42) },
      { id: 'T2', companyId: 'fj', objId: 'o_grav', type: 'flytt', title: 'Trenger flytting', text: 'Bodø → Fauske, til nytt anlegg på mandag.', status: 'ny', reportedBy: 'ola', at: d(0, 9, 10) },
      { id: 'T3', companyId: 'fj', objId: 'o_hl9', type: 'service', title: 'Service 3 000 t', status: 'arbeid', reportedBy: 'auto', autoReason: 'Automatisk ut fra timer', at: d(-2) },
    ],
    jobs: [
      { id: 'J1', no: 2301, title: 'Hjullaster 12 t', cargo: 'Maskiner', fromPlace: 'Mo i Rana', toPlace: 'Fauske', weightKg: 12000, when: d(1, 10), reqs: ['loyve'], source: 'manuelt', ownerId: 'no', ownerUserId: 'dag', status: 'apent', createdAt: d(-1), bids: [{ id: uid('jb'), companyId: 'he', userId: 'heidi', amount: 9800, at: d(-1, 15) }] },
      { id: 'J2', no: 2302, title: 'Dosor til ny byggeplass', cargo: 'Maskiner', fromPlace: 'Bodø', toPlace: 'Saltstraumen', weightKg: 13000, when: nextDow(1, 7), reqs: ['loyve'], source: 'leie', objId: 'o_dosor', ownerId: 'fj', ownerUserId: 'kari', status: 'apent', createdAt: d(-1), bids: [], tag: 'Fra leieforhold' },
      { id: 'J3', no: 2303, title: 'Tipplass grus, 2 turer', cargo: 'Masser', fromPlace: 'Rognan', toPlace: 'Mosjøen', weightKg: 30000, when: nextDow(5, 9), reqs: ['tippbil'], source: 'manuelt', ownerId: 'sa', ownerUserId: 'nils', status: 'apent', createdAt: d(-2), bids: [{ id: uid('jb'), companyId: 'he', userId: 'heidi', amount: 14500, at: d(-1, 9) }] },
      { id: 'J4', no: 2304, title: 'Paller med forskaling', cargo: 'Paller', fromPlace: 'Bodø', toPlace: 'Mo i Rana', weightKg: 1200, when: nextDow(6, 9), reqs: [], source: 'manuelt', ownerId: 'tv', ownerUserId: 'tone', status: 'apent', createdAt: d(-1), bids: [] },
      { id: 'J0', no: 2290, title: 'Minigraver 3 t', cargo: 'Maskiner', fromPlace: 'Bodø', toPlace: 'Mo i Rana', weightKg: 3000, when: d(-40, 7), reqs: ['loyve'], source: 'leie', rentalId: 'RN0', objId: 'o_mini', ownerId: 'fj', ownerUserId: 'jonas', status: 'levert', createdAt: d(-42), chosenBidId: 'JB0', bids: [{ id: 'JB0', companyId: 'ra', userId: 'per', amount: 2600, at: d(-42, 12) }], pickup: { at: d(-40, 7), photos: [], by: 'per' }, delivery: { at: d(-40, 11), photos: [], by: 'per', receivedBy: 'Tone Aas', sign: SIGN }, tag: 'Fra leieforhold' },
    ],
    jobPasses: {},
    trips: [
      { id: 'TR1', companyId: 'ra', userId: 'per', vehicleId: 'r_tipp', vehicleName: 'Tippbil 6x4', from: 'Bodø', to: 'Mo i Rana', departAt: nextDow(5, 7), freeKg: 14000, accepts: ['Masser', 'Maskiner'], pricePerKm: 24, live: true },
      { id: 'TR2', companyId: 'ra', userId: 'per', vehicleId: 'r_hen', vehicleName: 'Lastebil med maskinhenger', from: 'Fauske', to: 'Mosjøen', departAt: nextDow(5, 14), freeKg: 5000, accepts: ['Maskiner', 'Paller'], pricePerKm: 21, live: true },
      { id: 'TR3', companyId: 'la', userId: 'lars', vehicleId: 'l_vare', vehicleName: 'Varebil med tilhenger', from: 'Bodø', to: 'Mo i Rana', departAt: nextDow(6, 8), freeKg: 1500, accepts: ['Paller', 'Privat'], pricePerKm: 9, live: true },
      { id: 'TR4', companyId: 'he', userId: 'heidi', vehicleId: 'h_semi', vehicleName: 'Trekkvogn med maskinhenger', from: 'Mosjøen', to: 'Bodø', departAt: nextDow(4, 8), freeKg: 18000, accepts: ['Maskiner'], pricePerKm: 26, live: true },
    ],
    leads: [
      { id: 'LD1', type: 'redskap', objId: 'o_hl70', fromCompanyId: 'fj', fromUserId: 'kari', toCompanyId: 'po', text: 'Ønsker pris på snøskjær med hydraulisk sving til Hjullaster L70H.', status: 'tilbud', at: d(-4), sponsored: true, offer: { amount: 78000, text: 'Snøskjær 3,2 m med hurtigfeste, levert Fauske innen to uker.', at: d(-3) } },
      { id: 'LD2', type: 'service', objId: 'o_hl9', fromCompanyId: 'fj', fromUserId: 'marte', toCompanyId: 'bl', text: 'Service 3 000 t på Hjullaster 9 t. Kan dere ta den neste uke?', status: 'sendt', at: d(-1) },
    ],
    ratings: [
      ...rate('sa', 'fj', [5, 5, 5, 5, 5, 4, 5]), ...rate('sa', 've', [5, 5, 5]),
      ...rate('tv', 've', [5, 4, 5, 5]), { id: uid('r'), fromCompanyId: 'fj', toCompanyId: 'tv', refType: 'leie', refId: 'RN0', stars: 4, text: 'Ryddig leietaker. En ripe ble gjort opp uten diskusjon.', at: d(-31) },
      ...rate('fj', 'sa', [5, 5, 5, 4, 5, 5]), { id: uid('r'), fromCompanyId: 'tv', toCompanyId: 'fj', refType: 'leie', refId: 'RN0', stars: 5, text: 'Maskinen var som beskrevet.', at: d(-31) },
      ...rate('ra', 'fj', [5, 5, 4, 5, 5], 'frakt'), ...rate('he', 'sa', [5, 5, 5, 5, 4, 5, 5, 5], 'frakt'), ...rate('la', 'tv', [5, 5, 4, 5], 'frakt'),
      ...rate('ve', 'sa', [5, 4, 5, 5]), ...rate('no', 'fj', [5, 4, 5], 'salg'),
    ],
    blinks, votes: [], winners,
    shares: [{ id: 'SH1', token: token(), objId: 'o_hl70', companyId: 'fj', byUserId: 'kari', parts: { bilder: true, spes: true, timer: true, redskap: true, sert: true, service: false }, access: 'std', recipient: 'innkjop@saltnesbygg.example', channel: 'epost', expiresAt: d(24), createdAt: d(-6), cta: 'pris', opens: [{ at: d(-5, 14), as: 'Uten konto' }] }],
    notes: [
      { id: uid('n'), companyId: 'fj', at: d(0, 7, 42), text: 'Ny feil meldt: Lift 12 m er sperret for utleie.', link: '/verksted', area: 'fleet' },
      { id: uid('n'), companyId: 'fj', at: d(0, 7), text: '3 forespørsler venter på svar for Hjullaster 9 t.', link: '/foresporsler', area: 'sale' },
      { id: uid('n'), companyId: 'fj', at: d(-3), text: 'Polarkant Redskap har sendt tilbud på snøskjær.', link: '/leads', area: 'lead' },
      { id: uid('n'), companyId: 'sa', userId: 'nils', at: d(-1), text: 'Selger av Hjullaster L70H har akseptert deg.', link: '/match/RQ1', area: 'sale' },
      { id: uid('n'), companyId: 'sa', userId: 'nils', at: d(-2), text: 'Pris senket: Dosor med maskinstyring.', link: '/favoritter', area: 'sale' },
    ],
    washes: [],
    settings: { feeModel: 'ingen', freightCommissionPct: 0, leadPrice: 0, openMarket: true, season: seasonName(nowD), minVotes: 5 },
    counters: { rental: 8154, job: 2304 },
  }
}

export function seasonName(dt: Date) {
  const m = dt.getMonth()
  const s = m < 2 || m === 11 ? 'Vintersesongen' : m < 5 ? 'Vårsesongen' : m < 8 ? 'Sommersesongen' : 'Høstsesongen'
  return `${s} ${dt.getFullYear()}`
}
