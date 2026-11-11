// Datamodellen følger kjerneentitetene i kompendiet:
// Bedrift, Bruker, Objekt, Bilde, Annonse, Ønske, Favoritt, Forespørsel, Leieforhold,
// Skjema, Mottakskontroll, Oppgave, Fraktoppdrag, Ledig tur, Lead og Vurdering.

export type ID = string

export type Role = 'forer' | 'kjoper' | 'sjafor' | 'verksmester' | 'admin' | 'leder' | 'partner'
export type View = 'park' | 'utleier' | 'leietaker' | 'frakt' | 'forer' | 'partner'
export type PartnerKind = 'forhandler' | 'verksted' | 'takst' | 'redskap' | 'finans' | 'forsikring'

export type Coverage = 'ansvar' | 'innleid' | 'kasko' | 'gods'

export interface Insurance {
  id: ID
  insurer: string
  policyNo: string
  coverage: Coverage
  expires: string
}

export interface Company {
  id: ID
  orgnr: string
  name: string
  place: string
  verified: boolean
  departments: string[]
  partners: ID[]
  insurance: Insurance[]
  partnerKinds: PartnerKind[]
  transport?: { permit: boolean; permitExpires?: string }
  blinkDeclaration?: { by: ID; at: string }
  optOutMention?: boolean
  responseHours?: number
  joinedAt: string
  /** Historikk fra før demoen, slik at profilen har noe å vise. */
  prior?: { rentals: number; deals: number; damages: number }
  alerts: { eu: boolean; service: boolean; stale: boolean }
}

export interface Membership { companyId: ID; roles: Role[]; department?: string }

export interface User {
  id: ID
  name: string
  email?: string
  phone?: string
  memberships: Membership[]
  consentName?: boolean
}

export interface Session { userId: ID; companyId: ID; view: View }

export type ObjType = 'Gravemaskin' | 'Hjullaster' | 'Minigraver' | 'Dosor' | 'Lastebil' | 'Lift' | 'Tilhenger' | 'Redskap' | 'Personbil' | 'Varebil'
export type ObjStatus = 'bestilt' | 'i_drift' | 'ledig' | 'utleid' | 'innleid' | 'til_salgs' | 'solgt' | 'utrangert'

export interface Photo {
  id: ID
  src: string
  angle?: string
  at: string
  place?: string
  pos?: { lat: number; lon: number }
  source: 'app' | 'opplastet' | 'demo'
  findings?: string[]
}

export interface Doc { id: ID; name: string; kind: string; at: string }
export interface HistEvent { id: ID; at: string; type: string; text: string; by?: string }

export interface Obj {
  id: ID
  companyId: ID
  disponentId: ID
  internalId: string
  type: ObjType
  name: string
  make: string
  model: string
  serial: string
  regnr?: string
  year: number
  department: string
  place: string
  meter: 'timer' | 'km'
  reading: number
  readingAt: string
  checkedAt?: string
  weightKg: number
  status: ObjStatus
  condition: 1 | 2 | 3 | 4 | 5
  photos: Photo[]
  docs: Doc[]
  history: HistEvent[]
  specs: Record<string, string>
  attachments: string[]
  responsible?: ID
  service: { interval?: number; nextAt?: number; nextDate?: string; euDate?: string }
  purchasePrice?: number
  usage30: number
  archived?: { at: string; reason: string; soldTo?: string }
  transferNote?: string
}

export type Visibility = 'partnere' | 'utvalgte' | 'alle' | 'lenke'

export interface Terms {
  advancePct: number
  freight: number
  serviceAgreement: number
  insurance: number
  wash: number
  misc: number
  fuelPerQuarter: number
  tirePerMm: number
  wearPerHour: number
}

export interface Listing {
  id: ID
  objId: ID
  companyId: ID
  mode: 'leie' | 'salg'
  price: number
  unit: 'dag' | 'uke' | 'mnd' | 'fast'
  from?: string
  to?: string
  withDriver: boolean
  driverRate?: number
  driverId?: ID
  visibility: Visibility
  invited: ID[]
  linkToken: string
  text: string
  active: boolean
  createdAt: string
  priceHistory: { at: string; price: number }[]
  terms: Terms
  bidDeadline?: string
  reservedFor?: ID
  useBlink?: boolean
}

export interface Wish {
  mode: 'kjope' | 'leie' | 'begge'
  types: ObjType[]
  area: string
  radiusKm: number | null
  maxReading: number
  yearFrom: number
  maxPrice: number | null
  notify: boolean
}

export interface Wanted {
  id: ID
  companyId: ID
  userId: ID
  mode: 'kjope' | 'leie'
  type: ObjType
  text: string
  area: string
  at: string
  responses: { id: ID; companyId: ID; listingId?: ID; text: string; at: string }[]
}

export interface Favorite { id: ID; userId: ID; listingId: ID; at: string; seenPrice: number }

export type ReqStatus = 'venter' | 'godkjent' | 'avslatt' | 'trukket'

export interface Request {
  id: ID
  listingId: ID
  objId: ID
  mode: 'leie' | 'salg'
  fromCompanyId: ID
  fromUserId: ID
  toCompanyId: ID
  from?: string
  to?: string
  withDriver?: boolean
  message?: string
  status: ReqStatus
  reason?: string
  createdAt: string
  decidedAt?: string
  rentalId?: ID
}

export interface Message {
  id: ID
  requestId: ID
  fromCompanyId: ID
  fromUserId: ID
  kind: 'melding' | 'visning' | 'system'
  text: string
  at: string
}

export interface Bid {
  id: ID
  listingId: ID
  requestId: ID
  fromCompanyId: ID
  amount: number
  at: string
  status: 'aktivt' | 'akseptert' | 'avslatt' | 'motbud' | 'trukket' | 'utlopt'
  counterOf?: ID
  expires?: string
  note?: string
}

export interface Sale {
  id: ID
  listingId: ID
  objId: ID
  newObjId: ID
  sellerId: ID
  buyerId: ID
  price: number
  at: string
  serial: string
  model: string
}

export interface FormDamage { id: ID; x: number; y: number; note: string; isNew?: boolean }

export interface HandoverForm {
  kind: 'utlevering' | 'retur'
  at: string
  place: string
  pos?: { lat: number; lon: number }
  deliveredBy: string
  receivedBy: string
  reading: number
  fuel: number
  tireMm: number
  tools: string[]
  keys: number
  papers: boolean
  damages: FormDamage[]
  photos: Photo[]
  signLessor?: string
  signLessee?: string
  completedAt?: string
  readingAi?: boolean
}

export interface InspectionLine {
  id: ID
  label: string
  kind: 'avtalt' | 'malt'
  measured: string
  amount: number
  on: boolean
}

export interface AiFinding {
  id: ID
  angle: string
  text: string
  status: 'mulig' | 'bekreftet' | 'avvist'
  amount?: number
}

export interface Inspection {
  lines: InspectionLine[]
  findings: AiFinding[]
  sentAt?: string
  lesseeStatus?: 'godkjent' | 'kommentert'
  lesseeComment?: string
  lockedAt?: string
  lockedBy?: string
}

export interface TimeEntry { id: ID; date: string; hours: number; note?: string; by: ID; approved?: boolean }

export interface Claim {
  id: ID
  byCompanyId: ID
  type: 'skade' | 'kompensasjon'
  text: string
  amount?: number
  status: 'sendt' | 'godtatt' | 'bestridt'
  at: string
}

export type RentalStatus = 'godkjent' | 'forskudd' | 'utlevert' | 'returnert' | 'kontroll' | 'oppgjort' | 'avsluttet' | 'avbrutt'

export interface Rental {
  id: ID
  no: number
  requestId: ID
  listingId: ID
  objId: ID
  lessorId: ID
  lesseeId: ID
  from: string
  to: string
  price: number
  unit: 'dag' | 'uke' | 'mnd' | 'fast'
  withDriver: boolean
  driverRate?: number
  driverId?: ID
  terms: Terms
  status: RentalStatus
  advance: { amount: number; paidAt?: string; releasedAt?: string; refundedAt?: string }
  handover?: HandoverForm
  ret?: HandoverForm
  inspection?: Inspection
  timesheet: TimeEntry[]
  claims: Claim[]
  log: HistEvent[]
  createdAt: string
}

export type TaskType = 'flytt' | 'feil' | 'service' | 'annet' | 'eu'
export type TaskStatus = 'ny' | 'arbeid' | 'utfort'

export interface Task {
  id: ID
  companyId: ID
  objId: ID
  type: TaskType
  title: string
  text?: string
  photo?: Photo
  status: TaskStatus
  reportedBy: ID | 'auto'
  autoReason?: string
  at: string
  doneAt?: string
  reading?: number
}

export type JobReq = 'loyve' | 'tippbil' | 'maskinhenger'
export type JobStatus = 'apent' | 'tildelt' | 'hentet' | 'levert' | 'avlyst'

export interface JobBid { id: ID; companyId: ID; userId: ID; amount: number; at: string; tripId?: ID; note?: string }

export interface FreightJob {
  id: ID
  no: number
  title: string
  cargo: 'Maskiner' | 'Masser' | 'Paller' | 'Privat'
  fromPlace: string
  toPlace: string
  weightKg: number
  when: string
  reqs: JobReq[]
  source: 'leie' | 'salg' | 'manuelt'
  rentalId?: ID
  objId?: ID
  ownerId: ID
  ownerUserId: ID
  status: JobStatus
  bids: JobBid[]
  chosenBidId?: ID
  pickup?: { at: string; photos: Photo[]; by: ID }
  delivery?: { at: string; photos: Photo[]; by: ID; receivedBy: string; sign?: string }
  createdAt: string
  tag?: string
}

export interface Trip {
  id: ID
  companyId: ID
  userId: ID
  vehicleId?: ID
  vehicleName: string
  from: string
  to: string
  departAt: string
  freeKg: number
  accepts: ('Masser' | 'Maskiner' | 'Paller' | 'Privat')[]
  /** Pris per km for den som henger seg på turen. */
  pricePerKm: number
  live: boolean
}

export type LeadType = 'redskap' | 'innbytte' | 'service' | 'takst' | 'finans' | 'forsikring'

export interface Lead {
  id: ID
  type: LeadType
  objId?: ID
  fromCompanyId: ID
  fromUserId: ID
  toCompanyId: ID
  text: string
  status: 'sendt' | 'apnet' | 'tilbud' | 'akseptert' | 'avslatt'
  offer?: { amount?: number; text: string; at: string }
  at: string
  sponsored?: boolean
}

export interface Rating {
  id: ID
  fromCompanyId: ID
  toCompanyId: ID
  refType: 'leie' | 'frakt' | 'salg'
  refId: ID
  stars: number
  text?: string
  at: string
}

export type BlinkCat = 'vedlikehold' | 'spektakulaer' | 'arbeid'

export interface Blink {
  id: ID
  objId: ID
  companyId: ID
  objName: string
  objType: ObjType
  photo: Photo
  takenBy: ID
  at: string
  area: string
  category: BlinkCat
  status: 'venter' | 'godkjent' | 'underkjent' | 'erstattet' | 'arkivert'
  checks: { faces: boolean; plates: boolean; position: boolean }
  decidedBy?: ID
  reason?: string
  seedVotes?: { n: number; avg: number }
}

export interface Vote { id: ID; blinkId: ID; userId: ID; companyId: ID; score: number; at: string }

export interface Winner {
  id: ID
  year: number
  month: number
  blinkId?: ID
  objKey: string
  objName: string
  objType: ObjType
  img?: string
  driver?: string
  company?: string
}

export interface ShareParts { bilder: boolean; spes: boolean; timer: boolean; redskap: boolean; sert: boolean; service: boolean }

export interface Share {
  id: ID
  token: string
  objId: ID
  companyId: ID
  byUserId: ID
  parts: ShareParts
  access: 'std' | 'full'
  recipient: string
  channel: 'epost' | 'sms' | 'lenke'
  expiresAt?: string
  createdAt: string
  revoked?: boolean
  smsCode?: string
  cta: 'leie' | 'pris' | 'ingen'
  opens: { at: string; as: string }[]
}

export interface Note {
  id: ID
  companyId: ID
  userId?: ID
  at: string
  text: string
  link?: string
  read?: boolean
  area: 'fleet' | 'sale' | 'log' | 'top' | 'lead'
}

export type FeeModel = 'ingen' | 'en_prosent' | 'ti_ti' | 'tjuefem'

export interface Settings {
  feeModel: FeeModel
  freightCommissionPct: number
  leadPrice: number
  openMarket: boolean
  season: string
  minVotes: number
}

export interface Wash { id: ID; companyId: ID; startedAt: string; doneIds: ID[]; finishedAt?: string }

export interface State {
  v: number
  seededAt: string
  session: Session | null
  companies: Company[]
  users: User[]
  objects: Obj[]
  listings: Listing[]
  wishes: Record<ID, Wish>
  wanted: Wanted[]
  favorites: Favorite[]
  passes: Record<ID, ID[]>
  requests: Request[]
  messages: Message[]
  bids: Bid[]
  sales: Sale[]
  rentals: Rental[]
  tasks: Task[]
  jobs: FreightJob[]
  jobPasses: Record<ID, ID[]>
  trips: Trip[]
  leads: Lead[]
  ratings: Rating[]
  blinks: Blink[]
  votes: Vote[]
  winners: Winner[]
  shares: Share[]
  notes: Note[]
  washes: Wash[]
  settings: Settings
  counters: { rental: number; job: number }
}
