import { produce } from 'immer'
import { useSyncExternalStore } from 'react'
import { seed } from './seed'
import type { Company, ID, Listing, Obj, Rental, Role, State, Task, User, View, Wish } from './types'
import { clearImages } from './lib/images'
import { sum } from './lib/util'

// All data ligger i nettleseren (localStorage). Det finnes ingen server i denne versjonen,
// så rettighetene under håndheves i grensesnittet og ikke på serversiden.
const KEY = 'm8-tilstand-v1'
const listeners = new Set<() => void>()

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { const s = JSON.parse(raw) as State; if (s?.v === 1 && Array.isArray(s.objects)) return s }
  } catch { /* starter med demodata */ }
  return seed()
}

let state: State = load()
let timer: ReturnType<typeof setTimeout> | undefined
function persist() {
  clearTimeout(timer)
  timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* lagring er ikke tilgjengelig her */ } }, 150)
}

export const store = {
  get: () => state,
  set(fn: (d: State) => void) {
    state = produce(state, fn)
    persist()
    listeners.forEach(l => l())
  },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
  reset() {
    clearImages()
    state = seed()
    persist()
    listeners.forEach(l => l())
  },
}

export const useS = () => useSyncExternalStore(store.subscribe, store.get)

// ---------- Hvem er jeg ----------
export interface Me { user: User; company: Company; roles: Role[]; view: View; department?: string }
export function meOf(s: State): Me | null {
  if (!s.session) return null
  const user = s.users.find(u => u.id === s.session!.userId)
  const company = s.companies.find(c => c.id === s.session!.companyId)
  const m = user?.memberships.find(m => m.companyId === company?.id)
  if (!user || !company || !m) return null
  return { user, company, roles: m.roles, view: s.session.view, department: m.department }
}
export function useMe(): Me {
  const me = meOf(useS())
  if (!me) throw new Error('Ikke innlogget')
  return me
}

const VIEW_ROLES: Record<View, Role[]> = {
  park: ['admin', 'leder', 'verksmester'],
  utleier: ['admin', 'leder'],
  leietaker: ['kjoper', 'admin', 'leder'],
  frakt: ['sjafor', 'admin', 'leder', 'kjoper'],
  forer: ['forer'],
  partner: ['partner'],
}
export const viewsFor = (roles: Role[]): View[] => (Object.keys(VIEW_ROLES) as View[]).filter(v => VIEW_ROLES[v].some(r => roles.includes(r)))
export const has = (me: Me, ...roles: Role[]) => roles.some(r => me.roles.includes(r))
/** Admin og leder styrer park, utleie og økonomi. */
export const isAdmin = (me: Me) => has(me, 'admin', 'leder')

// ---------- Oppslag ----------
export const co = (s: State, id?: ID) => s.companies.find(c => c.id === id)
export const coName = (s: State, id?: ID) => co(s, id)?.name ?? 'Ukjent bedrift'
export const usr = (s: State, id?: ID) => s.users.find(u => u.id === id)
export const userName = (s: State, id?: ID | 'auto') => (id === 'auto' ? 'Automatisk' : usr(s, id)?.name ?? 'Ukjent')
export const ob = (s: State, id?: ID) => s.objects.find(o => o.id === id)
export const lst = (s: State, id?: ID) => s.listings.find(l => l.id === id)

export const openFault = (s: State, objId: ID): Task | undefined => s.tasks.find(t => t.objId === objId && t.type === 'feil' && t.status !== 'utfort')
export const activeRental = (s: State, objId: ID): Rental | undefined => s.rentals.find(r => r.objId === objId && ['godkjent', 'forskudd', 'utlevert', 'returnert', 'kontroll'].includes(r.status))

/** Parken: egne objekter som ikke er arkivert, pluss objekter bedriften leier inn akkurat nå. */
export function parkOf(s: State, companyId: ID): (Obj & { hired?: boolean })[] {
  const own = s.objects.filter(o => o.companyId === companyId && !o.archived)
  const hired = s.rentals.filter(r => r.lesseeId === companyId && r.status === 'utlevert').map(r => ob(s, r.objId)).filter(Boolean) as Obj[]
  return [...own, ...hired.map(o => ({ ...o, hired: true, status: 'innleid' as const }))]
}

export function ratingOf(s: State, companyId: ID) {
  const rs = s.ratings.filter(r => r.toCompanyId === companyId)
  return { avg: rs.length ? Math.round((sum(rs.map(r => r.stars)) / rs.length) * 10) / 10 : null, n: rs.length }
}

export function profileStats(s: State, companyId: ID) {
  const c = co(s, companyId)
  const rentals = s.rentals.filter(r => r.lesseeId === companyId || r.lessorId === companyId)
  const damages = sum(s.rentals.filter(r => r.lesseeId === companyId).map(r => (r.inspection?.findings ?? []).filter(f => f.status === 'bekreftet').length))
  const open = s.rentals.some(r => r.lesseeId === companyId && r.claims.some(cl => cl.status === 'bestridt'))
  return {
    rentals: (c?.prior?.rentals ?? 0) + rentals.length,
    deals: (c?.prior?.deals ?? 0) + s.sales.filter(x => x.sellerId === companyId || x.buyerId === companyId).length + s.jobs.filter(j => j.status === 'levert' && j.bids.find(b => b.id === j.chosenBidId)?.companyId === companyId).length,
    damages: (c?.prior?.damages ?? 0) + damages,
    damagesSettled: !open,
  }
}

export const DEFAULT_WISH: Wish = { mode: 'begge', types: [], area: 'Bodø', radiusKm: null, maxReading: 10000, yearFrom: 2012, maxPrice: null, notify: true }
export const wishOf = (s: State, me: Me): Wish => s.wishes[me.user.id] ?? { ...DEFAULT_WISH, area: me.company.place }

/** Hvem får se en annonse. Deling styres per objekt. */
export function canSee(s: State, l: Listing, companyId: ID): boolean {
  if (l.companyId === companyId) return true
  if (!l.active) return false
  const owner = co(s, l.companyId)
  if (l.visibility === 'alle') return s.settings.openMarket || !!co(s, companyId)?.verified
  if (l.visibility === 'partnere') return !!owner?.partners.includes(companyId)
  if (l.visibility === 'utvalgte') return l.invited.includes(companyId)
  return false
}

/** Selgeren vises som «verifisert bedrift» til kjøperen er akseptert. */
export function accepted(s: State, listingId: ID, companyId: ID) {
  return s.requests.some(r => r.listingId === listingId && r.fromCompanyId === companyId && r.status === 'godkjent')
}
export const sellerLabel = (s: State, l: Listing, viewerCompanyId: ID) =>
  l.companyId === viewerCompanyId || accepted(s, l.id, viewerCompanyId) ? coName(s, l.companyId) : 'Verifisert bedrift'

export function insuranceStatus(c: Company): { tone: 'ok' | 'warn' | 'bad'; text: string }[] {
  if (!c.insurance.length) return [{ tone: 'bad', text: 'Forsikringsbevis mangler' }]
  const out: { tone: 'ok' | 'warn' | 'bad'; text: string }[] = []
  const today = new Date().toISOString().slice(0, 10)
  for (const i of c.insurance) {
    const days = Math.round((new Date(i.expires).getTime() - new Date(today).getTime()) / 86400000)
    const name = i.coverage === 'innleid' ? 'Forsikring for innleid utstyr' : i.coverage === 'kasko' ? 'Kasko på innleid' : i.coverage === 'gods' ? 'Godsansvar' : 'Ansvarsforsikring'
    if (days < 0) out.push({ tone: 'bad', text: `${name} er utløpt` })
    else if (days <= 30) out.push({ tone: 'warn', text: `${name} utløper om ${days} d` })
    else out.push({ tone: 'ok', text: name })
  }
  if (!c.insurance.some(i => i.coverage === 'innleid' || i.coverage === 'kasko')) out.push({ tone: 'warn', text: 'Mangler dekning for innleid utstyr' })
  return out
}
