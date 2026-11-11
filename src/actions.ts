// Forretningslogikken: alt som endrer data går gjennom funksjonene her.
import type {
  BlinkCat, Company, FreightJob, HandoverForm, ID, Insurance, JobReq, LeadType, Listing, Obj, ObjType, Photo, Role, Settings,
  ShareParts, State, TaskType, Terms, Trip, View, Wanted, Wish,
} from './types'
import { accepted, activeRental, co, coName, meOf, ob, openFault, store, viewsFor, type Me } from './store'
import { addDays, dateOnly, distKm, fmtDate, kr, LEAD_LABEL, now, num, STATUS_LABEL, TASK_LABEL, today, token, uid } from './lib/util'
import { adText, buildInspection, CAT_LABEL, DEFAULT_TERMS, inspectionTotal, ranking, rentAmount } from './lib/logic'

type D = State
const me = (): Me => meOf(store.get())!
const S = store.set

function note(d: D, companyId: ID, text: string, link: string, area: 'fleet' | 'sale' | 'log' | 'top' | 'lead', userId?: ID) {
  d.notes.unshift({ id: uid('n'), companyId, userId, at: now(), text, link, area })
  if (d.notes.length > 200) d.notes.length = 200
}
const hist = (o: Obj | undefined, type: string, text: string, by?: string) => { o?.history.unshift({ id: uid('h'), at: now(), type, text, by }) }
const dOb = (d: D, id?: ID) => d.objects.find(o => o.id === id)

// ---------- Konto ----------
const HOME: Record<Role, View> = { leder: 'park', admin: 'park', verksmester: 'park', kjoper: 'leietaker', sjafor: 'frakt', forer: 'forer', partner: 'partner' }

export function login(userId: ID, companyId?: ID) {
  S(d => {
    const u = d.users.find(x => x.id === userId)
    const m = u?.memberships.find(x => !companyId || x.companyId === companyId) ?? u?.memberships[0]
    if (!u || !m) return
    d.session = { userId, companyId: m.companyId, view: HOME[m.roles[0]] ?? viewsFor(m.roles)[0] }
  })
  syncAutoTasks()
}
export const logout = () => S(d => { d.session = null })
export const setView = (view: View) => S(d => { if (d.session) d.session.view = view })

export function registerCompany(p: { orgnr: string; name: string; place: string; userName: string; email: string; verified: boolean }) {
  const cid = uid('c'), uidd = uid('u')
  S(d => {
    d.companies.push({ id: cid, orgnr: p.orgnr, name: p.name, place: p.place, verified: p.verified, departments: [], partners: [], insurance: [], partnerKinds: [], joinedAt: now(), alerts: { eu: true, service: true, stale: true } })
    d.users.push({ id: uidd, name: p.userName, email: p.email, memberships: [{ companyId: cid, roles: ['leder', 'admin', 'kjoper'] }] })
    d.session = { userId: uidd, companyId: cid, view: 'park' }
  })
}
export function addUser(name: string, roles: Role[], department?: string) {
  S(d => { d.users.push({ id: uid('u'), name, memberships: [{ companyId: me().company.id, roles, department }] }) })
}
export function setRoles(userId: ID, roles: Role[]) {
  S(d => { const m = d.users.find(u => u.id === userId)?.memberships.find(m => m.companyId === me().company.id); if (m && roles.length) m.roles = roles })
}
export const setConsent = (v: boolean) => S(d => { const u = d.users.find(u => u.id === me().user.id); if (u) u.consentName = v })

const myCo = (d: D) => d.companies.find(c => c.id === me().company.id)!
export const updateCompany = (patch: Partial<Company>) => S(d => { Object.assign(myCo(d), patch) })
export const addInsurance = (i: Omit<Insurance, 'id'>) => S(d => { myCo(d).insurance.push({ ...i, id: uid('i') }) })
export const removeInsurance = (id: ID) => S(d => { const c = myCo(d); c.insurance = c.insurance.filter(i => i.id !== id) })
export const togglePartner = (id: ID) => S(d => { const c = myCo(d); c.partners = c.partners.includes(id) ? c.partners.filter(p => p !== id) : [...c.partners, id] })
export const signDeclaration = () => S(d => { myCo(d).blinkDeclaration = { by: me().user.id, at: now() } })
export const setSettings = (patch: Partial<Settings>) => S(d => { Object.assign(d.settings, patch) })

// ---------- Objekter ----------
export interface NewObj { type: ObjType; name: string; make?: string; model?: string; serial?: string; regnr?: string; year?: number; department?: string; place?: string; reading?: number; meter?: 'timer' | 'km'; weightKg?: number; internalId?: string; photo?: Photo }
function makeObj(d: D, companyId: ID, p: NewObj): Obj {
  const prefix = p.type.slice(0, 2).toUpperCase()
  const n = d.objects.filter(o => o.companyId === companyId).length + 1
  const meter = p.meter ?? (['Lastebil', 'Personbil', 'Varebil', 'Tilhenger'].includes(p.type) ? 'km' : 'timer')
  return {
    id: uid('o'), companyId, disponentId: companyId, internalId: p.internalId || `${prefix}-${String(1000 + n).slice(1)}${Math.floor(Math.random() * 9)}`,
    type: p.type, name: p.name || p.type, make: p.make ?? '', model: p.model ?? '', serial: p.serial ?? '', regnr: p.regnr, year: p.year ?? new Date().getFullYear(),
    department: p.department ?? '', place: p.place ?? co(d, companyId)?.place ?? '', meter, reading: p.reading ?? 0, readingAt: now(), checkedAt: now(),
    weightKg: p.weightKg ?? 0, status: 'i_drift', condition: 4, photos: p.photo ? [p.photo] : [], docs: [],
    history: [{ id: uid('h'), at: now(), type: 'registrert', text: 'Registrert i parken' }], specs: {}, attachments: [], service: {}, usage30: 0,
  }
}
export function addObject(p: NewObj): ID {
  let id = ''
  S(d => { const o = makeObj(d, me().company.id, p); d.objects.push(o); id = o.id })
  return id
}
export function importObjects(rows: NewObj[]): number {
  S(d => { for (const r of rows) { const o = makeObj(d, me().company.id, r); o.history[0].text = 'Importert fra regneark'; d.objects.push(o) } })
  return rows.length
}
export function updateObject(id: ID, patch: Partial<Obj>, why?: string) {
  S(d => {
    const o = dOb(d, id); if (!o) return
    if (patch.status && patch.status !== o.status) hist(o, 'status', `Status endret til ${STATUS_LABEL[patch.status]}`, me().user.name)
    if (patch.place && patch.place !== o.place) hist(o, 'flytt', `Flyttet ${o.place} → ${patch.place}`, me().user.name)
    if (patch.reading != null && patch.reading !== o.reading) { patch.readingAt = now(); hist(o, 'sjekkpunkt', `${o.meter === 'timer' ? 'Timer' : 'Km'} bekreftet: ${num(patch.reading)}${why ? ` (${why})` : ''}`, me().user.name) }
    Object.assign(o, patch)
  })
  syncAutoTasks()
}
export const addObjPhoto = (id: ID, p: Photo) => S(d => { dOb(d, id)?.photos.unshift(p) })
export const addDoc = (id: ID, name: string) => S(d => { dOb(d, id)?.docs.push({ id: uid('d'), name, kind: name.split('.').pop()?.toUpperCase() ?? 'FIL', at: now() }) })

/** Ett trykk: «I drift», «Leie» eller «Salg». Annonsen bygges fra objektkortet. */
export function setAvailability(objId: ID, mode: 'i_drift' | 'leie' | 'salg'): string | null {
  const s = store.get(), o = ob(s, objId)
  if (!o) return 'Fant ikke objektet'
  if (mode !== 'i_drift' && openFault(s, objId)) return 'Objektet har en åpen feil og er sperret til feilen er løst.'
  if (activeRental(s, objId)?.status === 'utlevert') return 'Objektet er utleid akkurat nå.'
  S(d => {
    const o = dOb(d, objId)!
    const mine = d.listings.filter(l => l.objId === objId)
    for (const l of mine) l.active = false
    if (mode === 'i_drift') { o.status = 'i_drift'; hist(o, 'status', 'Tatt ut av markedet', me().user.name); return }
    const kind = mode === 'leie' ? 'leie' : 'salg'
    let l = mine.find(x => x.mode === kind)
    if (!l) {
      const est = Math.round((o.purchasePrice ?? 0) || 0)
      l = {
        id: uid('L'), objId, companyId: o.companyId, mode: kind, price: kind === 'leie' ? defaultRent(o) : est, unit: kind === 'leie' ? 'dag' : 'fast',
        withDriver: false, visibility: 'partnere', invited: [], linkToken: token(), text: adText(o, kind, false), active: true, createdAt: now(), priceHistory: [], terms: { ...DEFAULT_TERMS },
      }
      l.priceHistory.push({ at: now(), price: l.price })
      d.listings.push(l)
    }
    l.active = true
    o.status = kind === 'leie' ? 'ledig' : 'til_salgs'
    hist(o, 'status', kind === 'leie' ? 'Merket ledig for leie' : 'Lagt ut for salg', me().user.name)
  })
  return null
}
const defaultRent = (o: Obj) => ({ Gravemaskin: 3600, Hjullaster: 2400, Minigraver: 1400, Dosor: 4800, Lastebil: 3900, Lift: 1200, Tilhenger: 450, Redskap: 300, Personbil: 700, Varebil: 900 }[o.type])

export function saveListing(id: ID, patch: Partial<Listing>) {
  S(d => {
    const l = d.listings.find(x => x.id === id); if (!l) return
    if (patch.price != null && patch.price !== l.price) {
      l.priceHistory.push({ at: now(), price: patch.price })
      if (patch.price < l.price) {
        const o = dOb(d, l.objId)
        for (const f of d.favorites.filter(f => f.listingId === id)) {
          const u = d.users.find(u => u.id === f.userId)
          if (u) note(d, u.memberships[0].companyId, `Pris senket: ${o?.name}. Ny pris ${kr(patch.price)}.`, '/favoritter', 'sale', u.id)
        }
      }
    }
    Object.assign(l, patch)
  })
}

export function syncAutoTasks() {
  const s = store.get()
  const add: { o: Obj; type: TaskType; title: string; why: string }[] = []
  for (const o of s.objects) {
    if (o.archived || o.status === 'solgt' || o.status === 'utrangert') continue
    const c = co(s, o.companyId); if (!c) continue
    const open = (t: TaskType) => s.tasks.some(x => x.objId === o.id && x.type === t && x.status !== 'utfort')
    if (c.alerts.service && o.service.nextAt && o.reading >= o.service.nextAt - 50 && !open('service'))
      add.push({ o, type: 'service', title: `Service ${num(o.service.nextAt)} ${o.meter === 'timer' ? 't' : 'km'}`, why: o.meter === 'timer' ? 'Automatisk ut fra timer' : 'Automatisk ut fra km' })
    if (c.alerts.eu && o.service.euDate) {
      const days = Math.round((new Date(o.service.euDate).getTime() - Date.now()) / 86400000)
      if (days <= 30 && !open('eu')) add.push({ o, type: 'eu', title: days >= 0 ? `EU-kontroll om ${Math.max(0, days)} dager` : 'EU-kontroll er forfalt', why: 'Automatisk ut fra dato' })
    }
  }
  if (!add.length) return
  S(d => {
    for (const a of add) {
      d.tasks.unshift({ id: uid('T'), companyId: a.o.companyId, objId: a.o.id, type: a.type, title: a.title, status: 'ny', reportedBy: 'auto', autoReason: a.why, at: now() })
      note(d, a.o.companyId, `${a.title}: ${a.o.name}`, '/verksted', 'fleet')
    }
  })
}

// ---------- Vask parken ----------
export function washStart(): ID {
  const id = uid('V')
  S(d => { d.washes.unshift({ id, companyId: me().company.id, startedAt: now(), doneIds: [] }) })
  return id
}
export function washConfirm(washId: ID, objId: ID, patch?: Partial<Obj>) {
  if (patch && Object.keys(patch).length) updateObject(objId, patch, 'Vask parken')
  S(d => {
    const w = d.washes.find(x => x.id === washId); if (w && !w.doneIds.includes(objId)) w.doneIds.push(objId)
    const o = dOb(d, objId); if (o) { o.checkedAt = now(); if (!patch?.reading) o.readingAt = now() }
  })
}
export const washFinish = (washId: ID) => S(d => { const w = d.washes.find(x => x.id === washId); if (w) w.finishedAt = now() })

// ---------- Oppgaver ----------
export function reportTask(objId: ID, type: TaskType, text: string, photo?: Photo, reading?: number) {
  S(d => {
    const o = dOb(d, objId); if (!o) return
    const title = type === 'annet' ? (text.slice(0, 40) || 'Beskjed') : type === 'feil' ? (text.slice(0, 40) || 'Feil eller skade') : TASK_LABEL[type]
    d.tasks.unshift({ id: uid('T'), companyId: o.companyId, objId, type, title, text, photo, status: 'ny', reportedBy: me().user.id, at: now(), reading })
    hist(o, 'oppgave', `${TASK_LABEL[type]} meldt`, me().user.name)
    note(d, o.companyId, type === 'feil' ? `Ny feil meldt: ${o.name} er sperret for utleie.` : `${TASK_LABEL[type]}: ${o.name}`, '/verksted', 'fleet')
    if (type === 'feil') for (const l of d.listings.filter(l => l.objId === objId && l.mode === 'leie')) l.active = false
    if (reading != null && reading !== o.reading) { o.reading = reading; o.readingAt = now(); hist(o, 'sjekkpunkt', `${o.meter === 'timer' ? 'Timer' : 'Km'} bekreftet: ${num(reading)} (melding fra fører)`, me().user.name) }
  })
  syncAutoTasks()
}
export function advanceTask(id: ID) {
  S(d => {
    const t = d.tasks.find(x => x.id === id); if (!t || t.status === 'utfort') return
    t.status = t.status === 'ny' ? 'arbeid' : 'utfort'
    const o = dOb(d, t.objId)
    if (t.status === 'utfort') {
      t.doneAt = now()
      hist(o, 'oppgave', `${t.title}: utført`, me().user.name)
      if (o && t.type === 'service' && o.service.interval) o.service.nextAt = (o.service.nextAt ?? o.reading) + o.service.interval
      if (o && t.type === 'eu') o.service.euDate = dateOnly(addDays(o.service.euDate ?? now(), 365))
      if (o && t.type === 'feil' && o.status === 'ledig') for (const l of d.listings.filter(l => l.objId === o.id && l.mode === 'leie')) l.active = true
      if (t.reportedBy !== 'auto') note(d, t.companyId, `Utført: ${t.title} på ${o?.name}`, '/forer', 'fleet', t.reportedBy)
    }
  })
}

// ---------- Marked ----------
export const saveWish = (w: Wish) => S(d => { d.wishes[me().user.id] = w; d.passes[me().user.id] = [] })
export const passListing = (id: ID) => S(d => { (d.passes[me().user.id] ??= []).push(id) })
export const resetPasses = () => S(d => { d.passes[me().user.id] = [] })
export function toggleFav(listingId: ID) {
  S(d => {
    const i = d.favorites.findIndex(f => f.userId === me().user.id && f.listingId === listingId)
    if (i >= 0) d.favorites.splice(i, 1)
    else d.favorites.unshift({ id: uid('F'), userId: me().user.id, listingId, at: now(), seenPrice: d.listings.find(l => l.id === listingId)?.price ?? 0 })
  })
}
export function requestContact(listingId: ID, p: { from?: string; to?: string; withDriver?: boolean; message?: string }): ID {
  const id = uid('RQ')
  S(d => {
    const l = d.listings.find(x => x.id === listingId); if (!l) return
    const o = dOb(d, l.objId)
    d.requests.unshift({ id, listingId, objId: l.objId, mode: l.mode, fromCompanyId: me().company.id, fromUserId: me().user.id, toCompanyId: l.companyId, status: 'venter', createdAt: now(), ...p })
    note(d, l.companyId, `Ny forespørsel om ${l.mode === 'leie' ? 'leie av' : 'kontakt om'} ${o?.name}.`, '/foresporsler', 'sale')
  })
  return id
}
export const withdrawRequest = (id: ID) => S(d => { const r = d.requests.find(x => x.id === id); if (r && r.status === 'venter') r.status = 'trukket' })

export function decideRequest(id: ID, ok: boolean, reason?: string): string | null {
  const s = store.get(), rq = s.requests.find(x => x.id === id)
  if (!rq) return 'Fant ikke forespørselen'
  if (ok && rq.mode === 'leie') {
    if (openFault(s, rq.objId)) return 'Objektet har en åpen feil og er sperret for utleie.'
    if (activeRental(s, rq.objId)) return 'Objektet har allerede et aktivt leieforhold.'
  }
  S(d => {
    const r = d.requests.find(x => x.id === id)!
    const l = d.listings.find(x => x.id === r.listingId)!
    const o = dOb(d, r.objId)
    r.status = ok ? 'godkjent' : 'avslatt'; r.decidedAt = now(); r.reason = reason
    if (!ok) { note(d, r.fromCompanyId, `Forespørselen om ${o?.name} ble avslått.${reason ? ' ' + reason : ''}`, '/mine', 'sale', r.fromUserId); return }
    d.messages.push({ id: uid('m'), requestId: id, fromCompanyId: r.toCompanyId, fromUserId: me().user.id, kind: 'system', text: 'Selger har akseptert deg. Dere kan nå se hverandres firma.', at: now() })
    if (r.mode === 'salg') { note(d, r.fromCompanyId, `Selger av ${o?.name} har akseptert deg.`, `/match/${id}`, 'sale', r.fromUserId); return }
    const from = r.from ?? today(), to = r.to ?? dateOnly(addDays(now(), 7))
    const rent = rentAmount({ from, to, price: l.price, unit: l.unit })
    const rid = uid('RN')
    d.counters.rental += 1
    d.rentals.unshift({
      id: rid, no: d.counters.rental, requestId: id, listingId: l.id, objId: r.objId, lessorId: r.toCompanyId, lesseeId: r.fromCompanyId, from, to, price: l.price, unit: l.unit,
      withDriver: !!r.withDriver && l.withDriver, driverRate: l.driverRate, driverId: l.driverId, terms: { ...l.terms }, status: 'godkjent',
      advance: { amount: Math.round((rent * l.terms.advancePct) / 100) }, timesheet: [], claims: [], createdAt: now(),
      log: [{ id: uid('h'), at: now(), type: 'godkjent', text: 'Utleier godkjente leietaker' }],
    })
    r.rentalId = rid
    for (const other of d.requests.filter(x => x.listingId === l.id && x.id !== id && x.status === 'venter')) {
      other.status = 'avslatt'; other.decidedAt = now(); other.reason = 'Objektet ble leid ut til en annen i perioden.'
      note(d, other.fromCompanyId, `Forespørselen om ${o?.name} ble avslått. Objektet ble leid ut til en annen.`, '/mine', 'sale', other.fromUserId)
    }
    note(d, r.fromCompanyId, `Godkjent: du kan leie ${o?.name}. Betal forskudd for å bekrefte.`, `/leie/${rid}`, 'sale', r.fromUserId)
  })
  return null
}

export function sendMessage(requestId: ID, text: string, kind: 'melding' | 'visning' = 'melding') {
  S(d => {
    const r = d.requests.find(x => x.id === requestId); if (!r) return
    d.messages.push({ id: uid('m'), requestId, fromCompanyId: me().company.id, fromUserId: me().user.id, kind, text, at: now() })
    const other = me().company.id === r.fromCompanyId ? r.toCompanyId : r.fromCompanyId
    note(d, other, `${kind === 'visning' ? 'Ønske om visning' : 'Ny melding'} fra ${me().company.name}.`, `/match/${requestId}`, 'sale')
  })
}

export function placeBid(requestId: ID, amount: number, counterOf?: ID) {
  S(d => {
    const r = d.requests.find(x => x.id === requestId); if (!r) return
    if (counterOf) { const b = d.bids.find(x => x.id === counterOf); if (b) b.status = 'motbud' }
    for (const b of d.bids.filter(x => x.requestId === requestId && x.fromCompanyId === me().company.id && x.status === 'aktivt')) b.status = 'trukket'
    d.bids.push({ id: uid('B'), listingId: r.listingId, requestId, fromCompanyId: me().company.id, amount, at: now(), status: 'aktivt', counterOf, expires: addDays(now(), 7) })
    const other = me().company.id === r.fromCompanyId ? r.toCompanyId : r.fromCompanyId
    note(d, other, `${counterOf ? 'Motbud' : 'Nytt bud'} på ${dOb(d, r.objId)?.name}: ${kr(amount)}.`, `/match/${requestId}`, 'sale')
  })
}
export function answerBid(bidId: ID, accept: boolean) {
  S(d => {
    const b = d.bids.find(x => x.id === bidId); if (!b) return
    b.status = accept ? 'akseptert' : 'avslatt'
    const r = d.requests.find(x => x.id === b.requestId)!, l = d.listings.find(x => x.id === b.listingId)!
    if (accept) l.reservedFor = r.fromCompanyId
    note(d, b.fromCompanyId, `Budet på ${dOb(d, r.objId)?.name} ble ${accept ? 'akseptert' : 'avslått'}.`, `/match/${r.id}`, 'sale')
  })
}

/** Eierskifte: objektet går til selgers arkiv. Bare serienummer og modell følger med til ny eier. */
export function completeSale(requestId: ID, price: number) {
  S(d => {
    const r = d.requests.find(x => x.id === requestId); if (!r) return
    const l = d.listings.find(x => x.id === r.listingId)!, o = dOb(d, r.objId)!
    const buyer = co(d, r.fromCompanyId)!
    const fresh = makeObj(d, buyer.id, { type: o.type, name: o.model ? `${o.type} ${o.model}` : o.name, make: o.make, model: o.model, serial: o.serial, year: o.year, place: buyer.place, meter: o.meter })
    fresh.history[0].text = `Kjøpt gjennom SaleM8 fra ${coName(d, o.companyId)}`
    fresh.transferNote = 'Nytt objektkort. Selgers bilder, skader og historikk følger ikke med.'
    d.objects.push(fresh)
    d.sales.unshift({ id: uid('SL'), listingId: l.id, objId: o.id, newObjId: fresh.id, sellerId: o.companyId, buyerId: buyer.id, price, at: now(), serial: o.serial, model: o.model })
    o.status = 'solgt'; o.archived = { at: now(), reason: 'Solgt', soldTo: buyer.name }
    hist(o, 'salg', `Solgt til ${buyer.name} for ${kr(price)}`, me().user.name)
    for (const x of d.listings.filter(x => x.objId === o.id)) x.active = false
    for (const b of d.blinks.filter(b => b.objId === o.id && b.status === 'godkjent')) b.status = 'arkivert'
    for (const f of d.favorites.filter(f => f.listingId === l.id)) {
      const u = d.users.find(u => u.id === f.userId)
      if (u && u.memberships[0].companyId !== buyer.id) note(d, u.memberships[0].companyId, `${o.name} er solgt til en annen kjøper.`, '/favoritter', 'sale', u.id)
    }
    d.messages.push({ id: uid('m'), requestId, fromCompanyId: o.companyId, fromUserId: me().user.id, kind: 'system', text: `Salget er gjennomført for ${kr(price)}. Kontraktshjelpen har overført serienummer og modell til ny eier.`, at: now() })
    note(d, buyer.id, `Kjøpet av ${o.name} er gjennomført. Objektet ligger i parken din.`, `/objekt/${fresh.id}`, 'sale')
  })
}

export function addWanted(p: Pick<Wanted, 'mode' | 'type' | 'text' | 'area'>) {
  S(d => { d.wanted.unshift({ id: uid('W'), companyId: me().company.id, userId: me().user.id, at: now(), responses: [], ...p }) })
}
export function respondWanted(id: ID, text: string, listingId?: ID) {
  S(d => {
    const w = d.wanted.find(x => x.id === id); if (!w) return
    w.responses.push({ id: uid('wr'), companyId: me().company.id, listingId, text, at: now() })
    note(d, w.companyId, `${me().company.name} har svart på «${w.type} ønskes».`, '/onskes', 'sale', w.userId)
  })
}

// ---------- Leieforhold ----------
const dRent = (d: D, id: ID) => d.rentals.find(r => r.id === id)
const rlog = (d: D, id: ID, type: string, text: string) => { dRent(d, id)?.log.push({ id: uid('h'), at: now(), type, text, by: me().user.name }) }

export function payAdvance(id: ID) {
  S(d => {
    const r = dRent(d, id); if (!r || r.status !== 'godkjent') return
    r.status = 'forskudd'; r.advance.paidAt = now()
    rlog(d, id, 'forskudd', `Forskudd ${kr(r.advance.amount)} betalt. Beløpet holdes til utlevering er bekreftet.`)
    note(d, r.lessorId, `Forskudd betalt for leieforhold #${r.no}. Klar for utlevering.`, `/leie/${id}`, 'sale')
  })
}
export function cancelRental(id: ID) {
  S(d => {
    const r = dRent(d, id); if (!r || !['godkjent', 'forskudd'].includes(r.status)) return
    if (r.advance.paidAt) r.advance.refundedAt = now()
    r.status = 'avbrutt'
    rlog(d, id, 'avbrutt', r.advance.refundedAt ? 'Leieforholdet ble avbrutt. Forskuddet er tilbakebetalt.' : 'Leieforholdet ble avbrutt.')
    note(d, me().company.id === r.lessorId ? r.lesseeId : r.lessorId, `Leieforhold #${r.no} ble avbrutt.`, `/leie/${id}`, 'sale')
  })
}

export function saveForm(id: ID, f: HandoverForm) {
  S(d => {
    const r = dRent(d, id); if (!r) return
    const o = dOb(d, r.objId)!
    f.completedAt = now()
    if (f.kind === 'utlevering') {
      r.handover = f; r.status = 'utlevert'; r.advance.releasedAt = now()
      o.status = 'utleid'; o.reading = f.reading; o.readingAt = now()
      for (const l of d.listings.filter(l => l.objId === o.id)) l.active = false
      hist(o, 'leie', `Utlevert til ${coName(d, r.lesseeId)}, leieforhold #${r.no}`, me().user.name)
      rlog(d, id, 'utlevering', 'Utlevert med bilder og signatur. Forskuddet er utbetalt til utleier.')
      note(d, r.lesseeId, `Utlevering bekreftet for leieforhold #${r.no}.`, `/leie/${id}`, 'sale')
    } else {
      r.ret = f; r.status = 'returnert'
      o.reading = f.reading; o.readingAt = now(); o.status = 'ledig'
      r.inspection = buildInspection(r, o)
      if (!d.tasks.some(t => t.objId === o.id && t.type === 'feil' && t.status !== 'utfort')) for (const l of d.listings.filter(l => l.id === r.listingId)) l.active = true
      hist(o, 'leie', `Retur fra ${coName(d, r.lesseeId)}, leieforhold #${r.no}`, me().user.name)
      rlog(d, id, 'retur', 'Returnert med bilder og signatur. Mottakskontroll er opprettet.')
      note(d, r.lessorId, `Retur registrert for leieforhold #${r.no}. Mottakskontrollen er klar.`, `/leie/${id}/kontroll`, 'sale')
    }
  })
  syncAutoTasks()
}

export function toggleLine(id: ID, lineId: ID) {
  S(d => { const l = dRent(d, id)?.inspection?.lines.find(x => x.id === lineId); if (l) l.on = !l.on })
}
export function decideFinding(id: ID, findingId: ID, confirm: boolean, amount = 0) {
  S(d => {
    const r = dRent(d, id); if (!r?.inspection) return
    const f = r.inspection.findings.find(x => x.id === findingId); if (!f) return
    f.status = confirm ? 'bekreftet' : 'avvist'; f.amount = confirm ? amount : undefined
    r.inspection = buildInspection(r, dOb(d, r.objId)!, r.inspection)
    rlog(d, id, 'kontroll', confirm ? `Funn bekreftet av et menneske: ${f.text}` : `Funn avvist: ${f.text}`)
  })
}
export function sendInspection(id: ID) {
  S(d => {
    const r = dRent(d, id); if (!r?.inspection) return
    r.inspection.sentAt = now(); r.inspection.lesseeStatus = undefined; r.status = 'kontroll'
    rlog(d, id, 'kontroll', 'Mottakskontrollen er sendt til leietaker')
    note(d, r.lesseeId, `Mottakskontroll for leieforhold #${r.no} venter på deg.`, `/leie/${id}/kontroll`, 'sale')
  })
}
export function answerInspection(id: ID, ok: boolean, comment?: string) {
  S(d => {
    const r = dRent(d, id); if (!r?.inspection) return
    r.inspection.lesseeStatus = ok ? 'godkjent' : 'kommentert'; r.inspection.lesseeComment = comment
    rlog(d, id, 'kontroll', ok ? 'Leietaker godkjente mottakskontrollen' : `Leietaker kommenterte: ${comment}`)
    note(d, r.lessorId, `Leietaker har ${ok ? 'godkjent' : 'kommentert'} mottakskontrollen for #${r.no}.`, `/leie/${id}/kontroll`, 'sale')
  })
}
export function lockInspection(id: ID) {
  S(d => {
    const r = dRent(d, id); if (!r?.inspection) return
    r.inspection.lockedAt = now(); r.inspection.lockedBy = me().user.name; r.status = 'oppgjort'
    rlog(d, id, 'kontroll', `Mottakskontrollen er låst. Til fakturering: ${kr(inspectionTotal(r.inspection) - r.advance.amount)}`)
    hist(dOb(d, r.objId), 'leie', `Mottakskontroll låst, leieforhold #${r.no}`, me().user.name)
    note(d, r.lesseeId, `Mottakskontrollen for #${r.no} er låst. Gi en vurdering av utleier.`, `/leie/${id}`, 'sale')
  })
}
export function addClaim(id: ID, type: 'skade' | 'kompensasjon', text: string, amount?: number) {
  S(d => {
    const r = dRent(d, id); if (!r) return
    r.claims.push({ id: uid('c'), byCompanyId: me().company.id, type, text, amount, status: 'sendt', at: now() })
    rlog(d, id, 'krav', `${type === 'skade' ? 'Skade rapportert' : 'Kompensasjon bedt om'}: ${text}`)
    note(d, me().company.id === r.lessorId ? r.lesseeId : r.lessorId, `${type === 'skade' ? 'Skade rapportert' : 'Krav om kompensasjon'} i leieforhold #${r.no}.`, `/leie/${id}`, 'sale')
  })
}
export function answerClaim(id: ID, claimId: ID, accept: boolean) {
  S(d => { const c = dRent(d, id)?.claims.find(x => x.id === claimId); if (c) { c.status = accept ? 'godtatt' : 'bestridt'; rlog(d, id, 'krav', accept ? 'Kravet ble godtatt' : 'Kravet ble bestridt') } })
}
export function addTime(id: ID, date: string, hours: number, noteText?: string) {
  S(d => { dRent(d, id)?.timesheet.push({ id: uid('t'), date, hours, note: noteText, by: me().user.id }) })
}
export function approveTime(id: ID, entryId: ID) {
  S(d => { const e = dRent(d, id)?.timesheet.find(x => x.id === entryId); if (e) e.approved = true })
}
export function rateCompany(refType: 'leie' | 'frakt' | 'salg', refId: ID, toCompanyId: ID, stars: number, text?: string) {
  S(d => {
    d.ratings.unshift({ id: uid('r'), fromCompanyId: me().company.id, toCompanyId, refType, refId, stars, text, at: now() })
    if (refType === 'leie') {
      const r = dRent(d, refId)
      if (r && r.status === 'oppgjort' && d.ratings.filter(x => x.refId === refId).length >= 2) { r.status = 'avsluttet'; r.log.push({ id: uid('h'), at: now(), type: 'avsluttet', text: 'Begge parter har gitt vurdering' }) }
    }
    note(d, toCompanyId, `${me().company.name} har gitt dere ${stars} av 5 stjerner.`, '/bedrift', 'sale')
  })
}

// ---------- Frakt ----------
export interface NewJob { title: string; cargo: FreightJob['cargo']; fromPlace: string; toPlace: string; weightKg: number; when: string; reqs: JobReq[]; source?: FreightJob['source']; rentalId?: ID; objId?: ID; tag?: string }
function makeJob(d: D, p: NewJob): FreightJob {
  d.counters.job += 1
  return { id: uid('J'), no: d.counters.job, ownerId: me().company.id, ownerUserId: me().user.id, status: 'apent', bids: [], createdAt: now(), source: 'manuelt', ...p }
}
export function createJob(p: NewJob): ID {
  let id = ''
  S(d => { const j = makeJob(d, p); d.jobs.unshift(j); id = j.id })
  return id
}
/** Pris for å henge seg på en bil som allerede kjører ruten. */
export function hitchPrice(t: Trip, fromPlace: string, toPlace: string) {
  const km = distKm(fromPlace, toPlace) ?? distKm(t.from, t.to) ?? 100
  return Math.max(500, Math.round((km * t.pricePerKm) / 50) * 50)
}
export function bookTrip(p: NewJob, tripId: ID): ID {
  let id = ''
  S(d => {
    const t = d.trips.find(x => x.id === tripId); if (!t) return
    const j = makeJob(d, p)
    const bid = { id: uid('jb'), companyId: t.companyId, userId: t.userId, amount: hitchPrice(t, p.fromPlace, p.toPlace), at: now(), tripId, note: 'Plass på bil som allerede kjører ruten' }
    j.bids.push(bid); j.chosenBidId = bid.id; j.status = 'tildelt'; j.when = t.departAt
    t.freeKg = Math.max(0, t.freeKg - p.weightKg)
    d.jobs.unshift(j); id = j.id
    note(d, t.companyId, `${me().company.name} har hengt seg på turen ${t.from} → ${t.to}: ${p.title}.`, `/frakt/jobb/${j.id}`, 'log', t.userId)
  })
  return id
}
/** Løyve og forsikring kontrolleres før et bud slipper gjennom. */
export function bidBlock(s: State, j: FreightJob, companyId: ID): string | null {
  const c = co(s, companyId)
  if (j.ownerId === companyId) return 'Dette er ditt eget oppdrag.'
  if (j.reqs.includes('loyve') && !c?.transport?.permit) return 'Oppdraget krever løyve. Bedriften din har ikke registrert løyve.'
  if (j.reqs.includes('loyve') && !c?.insurance.some(i => i.coverage === 'gods')) return 'Du må ha godsansvarsforsikring for dette oppdraget.'
  return null
}
export function bidJob(jobId: ID, amount: number, tripId?: ID): string | null {
  const s = store.get(), j = s.jobs.find(x => x.id === jobId)
  if (!j) return 'Fant ikke oppdraget'
  const block = bidBlock(s, j, me().company.id)
  if (block) return block
  S(d => {
    const j = d.jobs.find(x => x.id === jobId)!
    j.bids = j.bids.filter(b => b.companyId !== me().company.id)
    j.bids.push({ id: uid('jb'), companyId: me().company.id, userId: me().user.id, amount, at: now(), tripId })
    ;(d.jobPasses[me().user.id] ??= []).push(jobId)
    note(d, j.ownerId, `Nytt bud på «${j.title}»: ${kr(amount)} fra ${me().company.name}.`, `/frakt/jobb/${jobId}`, 'log', j.ownerUserId)
  })
  return null
}
export const passJob = (jobId: ID) => S(d => { (d.jobPasses[me().user.id] ??= []).push(jobId) })
export const resetJobPasses = () => S(d => { d.jobPasses[me().user.id] = [] })
export function chooseBid(jobId: ID, bidId: ID) {
  S(d => {
    const j = d.jobs.find(x => x.id === jobId); const b = j?.bids.find(x => x.id === bidId); if (!j || !b) return
    j.chosenBidId = bidId; j.status = 'tildelt'
    note(d, b.companyId, `Du fikk oppdraget «${j.title}» ${j.fromPlace} → ${j.toPlace}.`, `/frakt/jobb/${jobId}`, 'log', b.userId)
    for (const o of j.bids.filter(x => x.id !== bidId)) note(d, o.companyId, `Kunden valgte en annen transportør for «${j.title}».`, '/frakt/mine', 'log', o.userId)
  })
}
export const cancelJob = (jobId: ID) => S(d => { const j = d.jobs.find(x => x.id === jobId); if (j && ['apent', 'tildelt'].includes(j.status)) j.status = 'avlyst' })
export function jobPickup(jobId: ID, photos: Photo[]) {
  S(d => {
    const j = d.jobs.find(x => x.id === jobId); if (!j) return
    j.pickup = { at: now(), photos, by: me().user.id }; j.status = 'hentet'
    hist(dOb(d, j.objId), 'frakt', `Hentet av ${me().company.name}, fraktoppdrag #${j.no}`)
    note(d, j.ownerId, `«${j.title}» er hentet i ${j.fromPlace}.`, `/frakt/jobb/${jobId}`, 'log', j.ownerUserId)
  })
}
export function jobDeliver(jobId: ID, photos: Photo[], receivedBy: string, sign?: string) {
  S(d => {
    const j = d.jobs.find(x => x.id === jobId); if (!j) return
    j.delivery = { at: now(), photos, by: me().user.id, receivedBy, sign }; j.status = 'levert'
    const o = dOb(d, j.objId)
    if (o) { hist(o, 'frakt', `Levert i ${j.toPlace}, fraktoppdrag #${j.no}`); if (!o.archived) o.place = j.toPlace }
    note(d, j.ownerId, `«${j.title}» er levert i ${j.toPlace}. Gi transportøren en vurdering.`, `/frakt/jobb/${jobId}`, 'log', j.ownerUserId)
  })
}
export function saveTrip(t: Omit<Trip, 'id' | 'companyId' | 'userId'> & { id?: ID }): ID {
  const id = t.id ?? uid('TR')
  S(d => {
    const i = d.trips.findIndex(x => x.id === id)
    const full = { ...t, id, companyId: me().company.id, userId: me().user.id }
    if (i >= 0) d.trips[i] = full; else d.trips.unshift(full)
  })
  return id
}
export function jobFromRental(rentalId: ID, leg: 'utlevering' | 'retur'): ID {
  const s = store.get(), r = s.rentals.find(x => x.id === rentalId)!, o = ob(s, r.objId)!
  const lessee = co(s, r.lesseeId)!
  return createJob({
    title: o.name, cargo: 'Maskiner', weightKg: o.weightKg, reqs: o.weightKg > 3500 ? ['loyve'] : [], source: 'leie', rentalId, objId: o.id, tag: 'Fra leieforhold',
    fromPlace: leg === 'utlevering' ? o.place : lessee.place, toPlace: leg === 'utlevering' ? lessee.place : co(s, r.lessorId)!.place,
    when: new Date(`${leg === 'utlevering' ? r.from : r.to}T07:00:00`).toISOString(),
  })
}

// ---------- Leads ----------
export function createLead(type: LeadType, text: string, toCompanyIds: ID[], objId?: ID) {
  S(d => {
    for (const to of toCompanyIds) {
      d.leads.unshift({ id: uid('LD'), type, objId, fromCompanyId: me().company.id, fromUserId: me().user.id, toCompanyId: to, text, status: 'sendt', at: now(), sponsored: to === 'po' })
      note(d, to, `Ny forespørsel: ${LEAD_LABEL[type]} fra ${me().company.name}.`, '/partner', 'lead')
    }
    if (objId) hist(dOb(d, objId), 'lead', `${LEAD_LABEL[type]}: forespørsel sendt til ${toCompanyIds.length} ${toCompanyIds.length === 1 ? 'leverandør' : 'leverandører'}`, me().user.name)
  })
}
export const openLead = (id: ID) => S(d => { const l = d.leads.find(x => x.id === id); if (l && l.status === 'sendt') l.status = 'apnet' })
export function offerLead(id: ID, text: string, amount?: number) {
  S(d => {
    const l = d.leads.find(x => x.id === id); if (!l) return
    l.status = 'tilbud'; l.offer = { amount, text, at: now() }
    note(d, l.fromCompanyId, `${me().company.name} har sendt tilbud: ${LEAD_LABEL[l.type]}.`, '/leads', 'lead', l.fromUserId)
  })
}
export function answerLead(id: ID, accept: boolean) {
  S(d => {
    const l = d.leads.find(x => x.id === id); if (!l) return
    l.status = accept ? 'akseptert' : 'avslatt'
    note(d, l.toCompanyId, `${me().company.name} har ${accept ? 'takket ja til' : 'takket nei til'} tilbudet.`, '/partner', 'lead')
  })
}

// ---------- Blinkskudd og Topp 100 ----------
export function tagBlink(objId: ID, photo: Photo, category: BlinkCat, facesOk: boolean) {
  S(d => {
    const o = dOb(d, objId); if (!o) return
    d.blinks.unshift({ id: uid('b'), objId, companyId: o.companyId, objName: o.name, objType: o.type, photo, takenBy: me().user.id, at: now(), area: o.place, category, status: 'venter', checks: { faces: facesOk, plates: true, position: true } })
    note(d, o.companyId, `Nytt blinkskudd til godkjenning: ${o.name}.`, '/blinkskudd/godkjenn', 'top')
  })
}
export const untagBlink = (id: ID) => S(d => { d.blinks = d.blinks.filter(b => !(b.id === id && b.status === 'venter')) })
export function decideBlink(id: ID, ok: boolean, reason?: string) {
  S(d => {
    const b = d.blinks.find(x => x.id === id); if (!b) return
    if (ok) for (const old of d.blinks.filter(x => x.objId === b.objId && x.status === 'godkjent')) old.status = 'erstattet'
    b.status = ok ? 'godkjent' : 'underkjent'; b.decidedBy = me().user.id; b.reason = reason
    if (ok) { const o = dOb(d, b.objId); if (o && !o.photos.some(p => p.id === b.photo.id)) o.photos.unshift(b.photo) }
    note(d, b.companyId, ok ? `Blinkskuddet av ${b.objName} er godkjent og med i Topp 100.` : `Blinkskuddet av ${b.objName} ble underkjent.${reason ? ' ' + reason : ''}`, '/topp100', 'top', b.takenBy)
  })
}
export function vote(blinkId: ID, score: number) {
  S(d => {
    d.votes = d.votes.filter(v => !(v.blinkId === blinkId && v.userId === me().user.id))
    d.votes.push({ id: uid('v'), blinkId, userId: me().user.id, companyId: me().company.id, score, at: now() })
  })
}
/** Kårer månedens vinner. Samme maskin kan ikke vinne mer enn én gang per år. */
export function pickWinner(): string {
  const s = store.get(), nowD = new Date()
  if (s.winners.some(w => w.year === nowD.getFullYear() && w.month === nowD.getMonth())) return 'Månedens vinner er allerede kåret.'
  const yearAgo = new Date(nowD.getFullYear() - 1, nowD.getMonth(), 1).getTime()
  const recent = new Set(s.winners.filter(w => new Date(w.year, w.month, 1).getTime() > yearAgo).map(w => w.objKey))
  const win = ranking(s).find(r => r.qualified && !recent.has(r.blink.objId))
  if (!win) return 'Ingen maskiner kan kåres akkurat nå.'
  const b = win.blink, c = co(s, b.companyId), u = s.users.find(x => x.id === b.takenBy)
  S(d => {
    d.winners.unshift({ id: uid('w'), year: nowD.getFullYear(), month: nowD.getMonth(), blinkId: b.id, objKey: b.objId, objName: b.objName, objType: b.objType, img: b.photo.src, driver: u?.consentName ? u.name : undefined, company: c?.optOutMention ? undefined : c?.name })
    note(d, b.companyId, `${b.objName} er månedens vinner i Topp 100 (${CAT_LABEL[b.category]}).`, '/vinnere', 'top')
  })
  return `${b.objName} er kåret til månedens vinner.`
}

// ---------- Send maskin ----------
export function createShare(p: { objId: ID; parts: ShareParts; access: 'std' | 'full'; recipient: string; channel: 'epost' | 'sms' | 'lenke'; days: number | null; cta: 'leie' | 'pris' | 'ingen' }): ID {
  const id = uid('SH')
  S(d => {
    d.shares.unshift({
      id, token: token(), objId: p.objId, companyId: me().company.id, byUserId: me().user.id, parts: p.parts, access: p.access, recipient: p.recipient, channel: p.channel,
      expiresAt: p.days ? addDays(now(), p.days) : undefined, createdAt: now(), cta: p.cta, opens: [],
      smsCode: p.access === 'full' ? String(Math.floor(1000 + Math.random() * 9000)) : undefined,
    })
    hist(dOb(d, p.objId), 'deling', `Sendt som presentasjon til ${p.recipient || 'delingslenke'}`, me().user.name)
  })
  return id
}
export const revokeShare = (id: ID) => S(d => { const s = d.shares.find(x => x.id === id); if (s) s.revoked = true })
export function openShare(tok: string, as: string) {
  S(d => {
    const s = d.shares.find(x => x.token === tok); if (!s) return
    s.opens.push({ at: now(), as })
    if (s.opens.length === 1) note(d, s.companyId, `Presentasjonen av ${dOb(d, s.objId)?.name} er åpnet av mottakeren.`, `/send/${s.objId}`, 'sale', s.byUserId)
  })
}

// ---------- Varsler ----------
export const readNotes = () => S(d => { const m = me(); for (const n of d.notes) if (n.companyId === m.company.id && (!n.userId || n.userId === m.user.id)) n.read = true })
export const myNotes = (s: State, m: Me) => s.notes.filter(n => n.companyId === m.company.id && (!n.userId || n.userId === m.user.id))

export { accepted, fmtDate }
export type { Terms }
