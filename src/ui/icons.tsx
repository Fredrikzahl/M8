const P: Record<string, string> = {
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  send: 'M4 12l16-8-6 16-3-7z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8a.5.5 0 1 0 0 .01',
  filter: 'M4 6h16M7 12h10M10 18h4',
  truck: 'M2 7h11v9H2zM13 10h4l4 3v3h-8zM6.5 18.5a1.8 1.8 0 1 0 0-.01M17 18.5a1.8 1.8 0 1 0 0-.01',
  wrench: 'M14.5 6a4 4 0 0 0-5 5L4 16.5 7.5 20l5.500-5.5a4 4 0 0 0 5-5L15.500 12 12 8.5z',
  chart: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.200 4.100 1 5.800L12 16.900 6.700 19.600l1-5.800L3.500 9.700l5.900-.9z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20.500c1-3.500 4.200-5 8-5s7 1.500 8 5',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.500 2h-15zM10 20a2 2 0 0 0 4 0',
  chat: 'M4 5h16v11H9l-5 4z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7z',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
  plus: 'M12 5v14M5 12h14',
  map: 'M9 4L3 6.500v13.500L9 17.500l6 2.500 6-2.500V4l-6 2.500zM9 4v13.500M15 6.500V20',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  lock: 'M6 11h12v9H6zM8.500 11V8a3.500 3.500 0 0 1 7 0v3',
  download: 'M12 4v11M7 10.500l5 5 5-5M5 20h14',
  share: 'M12 15V4M7.500 8L12 3.500 16.500 8M5 13v7h14v-7',
  swap: 'M7 7h13l-3.500-3.500M17 17H4l3.500 3.500',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5.500l3.500 2',
  pin: 'M12 21s-6.500-6-6.500-11a6.500 6.500 0 0 1 13 0c0 5-6.500 11-6.500 11zM12 12.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.500v1.500A3.500 3.500 0 0 0 8 11M16 6h3.500v1.500A3.500 3.500 0 0 1 16 11M12 13v4M8.500 20h7M10 17h4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4',
  trash: 'M5 7h14M9.500 7V4.500h5V7M7 7l1 13h8l1-13',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  warn: 'M12 4l9 16H3zM12 10v4.500M12 17.500h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.500h.01',
  shield: 'M12 3l7.500 3v6c0 4.500-3.200 7.500-7.500 9-4.300-1.500-7.500-4.500-7.500-9V6z',
  logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  building: 'M5 21V4h9v17M14 9h5v12M3 21h18M8.500 8h2M8.500 12h2M8.500 16h2',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  upload: 'M12 20V9M7 13.500l5-5 5 5M5 4h14',
  copy: 'M8 8h11v12H8zM5 16V4h10',
  eye: 'M2.500 12s3.500-6.500 9.500-6.500 9.500 6.500 9.500 6.500-3.500 6.500-9.500 6.500S2.500 12 2.500 12zM12 14.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3.500V8M16 3.500V8',
  money: 'M3 7h18v10H3zM12 14.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5zM6 10v4M18 10v4',
  home: 'M4 11l8-7 8 7v9h-5v-6h-6v6H4z',
  right: 'M9 5l7 7-7 7',
  spark: 'M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800zM18.500 16l.700 2 .800.800-2 .700-.700 2-.700-2-2-.700 2-.700z',
  handshake: 'M6 3h8l4 4v14H6zM14 3v4h4M9 14.500l2 2 4-4.500',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z',
  auto: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  down: 'M6 9l6 6 6-6',
  enter: 'M19 5v8H6M10 9l-4 4 4 4',
  phone: 'M8 3h8v18H8zM11 18h2',
}

/** Fylte deler som legges oppå streken. */
const SOLID: Record<string, string> = { auto: 'M12 3a9 9 0 0 1 0 18z' }

export function Icon({ name, size = 22, sw = 1.9, fill = false }: { name: string; size?: number; sw?: number; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? P.info} />
      {SOLID[name] && <path d={SOLID[name]} fill="currentColor" stroke="none" />}
    </svg>
  )
}
