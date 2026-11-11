import type { ObjType } from '../types'

// Enkle tegninger av maskintypene, tegnet i et rutenett på 200 × 120.
// De brukes som bilde når et objekt mangler foto, og som omriss over kameraet.
export interface Part { d: string; role: 'body' | 'dark' | 'glass' }
const c = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
const wheel = (cx: number, cy: number, r: number): Part[] => [{ d: c(cx, cy, r), role: 'dark' }, { d: c(cx, cy, r * 0.42), role: 'body' }]
const track = (x1: number, x2: number, y: number, h: number): Part[] => [
  { d: `M${x1} ${y}H${x2}a${h / 2} ${h / 2} 0 0 1 0 ${h}H${x1}a${h / 2} ${h / 2} 0 0 1 0 ${-h}Z`, role: 'dark' },
  { d: c(x1 + 2, y + h / 2, h * 0.28), role: 'body' }, { d: c(x2 - 2, y + h / 2, h * 0.28), role: 'body' }, { d: c((x1 + x2) / 2, y + h / 2, h * 0.2), role: 'body' },
]

export const SHAPES: Record<string, Part[]> = {
  hjullaster: [
    { d: 'M22 60L48 55L53 85L31 91Q19 84 22 60Z', role: 'dark' },
    { d: 'M50 64L98 50L102 60L58 76Z', role: 'body' },
    { d: 'M88 68H172Q178 68 178 74V90H88Z', role: 'body' },
    { d: 'M104 28H140L147 68H100Z', role: 'body' },
    { d: 'M109 34H136L141 60H106Z', role: 'glass' },
    { d: 'M147 48H170Q178 48 178 56V68H147Z', role: 'body' },
    ...wheel(78, 90, 17), ...wheel(152, 90, 17),
  ],
  gravemaskin: [
    ...track(72, 168, 88, 20),
    { d: 'M96 56H168Q176 56 176 64V86H96Z', role: 'body' },
    { d: 'M100 32H130V86H96V44Z', role: 'body' },
    { d: 'M104 38H126V60H101Z', role: 'glass' },
    { d: 'M112 62L62 20L54 27L98 72Z', role: 'body' },
    { d: 'M62 20L30 62L38 67L68 30Z', role: 'body' },
    { d: 'M30 62L17 78Q22 92 39 86L41 68Z', role: 'dark' },
  ],
  dosor: [
    ...track(64, 168, 84, 24),
    { d: 'M84 56H174V84H84Z', role: 'body' },
    { d: 'M110 26H150V56H105Z', role: 'body' },
    { d: 'M114 31H146V51H111Z', role: 'glass' },
    { d: 'M92 38H97V56H92Z', role: 'dark' },
    { d: 'M44 78H88V87H44Z', role: 'dark' },
    { d: 'M30 48Q20 78 33 106H46Q37 78 45 48Z', role: 'dark' },
  ],
  lastebil: [
    { d: 'M24 84H180V95H24Z', role: 'dark' },
    { d: 'M22 44Q22 34 32 34H62V90H22Z', role: 'body' },
    { d: 'M28 40H56V60H28Z', role: 'glass' },
    { d: 'M68 38H180L172 82H68Z', role: 'body' },
    ...wheel(44, 97, 12), ...wheel(124, 97, 12), ...wheel(153, 97, 12),
  ],
  lift: [
    { d: 'M58 82H152V98H58Z', role: 'body' },
    ...wheel(74, 100, 9), ...wheel(136, 100, 9),
    { d: 'M72 82L142 30L148 37L84 82Z', role: 'dark' },
    { d: 'M130 10H170V36H130Z', role: 'body' },
    { d: 'M135 15H165V24H135Z', role: 'glass' },
  ],
  tilhenger: [
    { d: 'M48 46H178V70H48Z', role: 'body' },
    { d: 'M48 70H178V80H48Z', role: 'dark' },
    { d: 'M18 74H48V79H18Z', role: 'dark' },
    { d: 'M18 70H24V96H18Z', role: 'dark' },
    ...wheel(116, 92, 12), ...wheel(144, 92, 12),
  ],
  redskap: [
    { d: 'M58 34H142L152 66Q152 94 110 96H72Q50 78 58 34Z', role: 'body' },
    { d: 'M72 96L68 108H80L84 96ZM96 96L94 108H106L108 96ZM120 95L120 107H132L132 92Z', role: 'dark' },
    { d: 'M86 22H114V34H86Z', role: 'dark' },
  ],
  personbil: [
    { d: 'M24 82Q24 66 44 63L62 44Q66 40 74 40H124Q132 40 138 46L154 63Q178 66 178 82V92H24Z', role: 'body' },
    { d: 'M70 46H98V62H56ZM104 46H124L140 62H104Z', role: 'glass' },
    ...wheel(60, 92, 13), ...wheel(144, 92, 13),
  ],
  varebil: [
    { d: 'M22 44Q22 36 30 36H140L170 62Q180 64 180 74V94H22Z', role: 'body' },
    { d: 'M144 44L164 62H144Z', role: 'glass' },
    ...wheel(58, 94, 13), ...wheel(148, 94, 13),
  ],
  // Omriss til kameraveiledningen
  front: [
    { d: 'M52 34H148V84H52Z', role: 'body' }, { d: 'M62 40H138V62H62Z', role: 'glass' },
    { d: 'M40 70H60V104H40ZM140 70H160V104H140Z', role: 'dark' }, { d: 'M46 84H154V94H46Z', role: 'dark' },
  ],
  cab: [{ d: 'M60 14H140L150 106H52Z', role: 'body' }, { d: 'M68 22H132L138 70H62Z', role: 'glass' }],
  wheel: [{ d: c(100, 60, 46), role: 'dark' }, { d: c(100, 60, 20), role: 'body' }],
  gauge: [{ d: c(100, 60, 44), role: 'body' }, { d: 'M100 60L128 34L131 37Z', role: 'dark' }, { d: c(100, 60, 5), role: 'dark' }],
  inside: [{ d: 'M24 70Q100 44 176 70V100H24Z', role: 'body' }, { d: c(66, 76, 18), role: 'dark' }, { d: 'M100 66H150V86H100Z', role: 'glass' }],
}

export const TYPE_SHAPE: Record<ObjType, { shape: string; scale: number }> = {
  Gravemaskin: { shape: 'gravemaskin', scale: 1 }, Hjullaster: { shape: 'hjullaster', scale: 1 }, Minigraver: { shape: 'gravemaskin', scale: 0.72 },
  Dosor: { shape: 'dosor', scale: 1 }, Lastebil: { shape: 'lastebil', scale: 1 }, Lift: { shape: 'lift', scale: 1 }, Tilhenger: { shape: 'tilhenger', scale: 1 },
  Redskap: { shape: 'redskap', scale: 0.9 }, Personbil: { shape: 'personbil', scale: 0.9 }, Varebil: { shape: 'varebil', scale: 0.95 },
}

export function overlayShape(type: ObjType, overlay: string): string {
  if (overlay === 'side') return TYPE_SHAPE[type].shape
  if (overlay === 'rear') return 'front'
  if (overlay === 'tool') return 'redskap'
  return SHAPES[overlay] ? overlay : 'front'
}

// Grovt omriss av Fastlands-Norge (lengdegrad, breddegrad) til det forenklede kartet.
export const NORWAY: [number, number][] = [
  [7.05, 57.98], [8.0, 58.1], [8.8, 58.45], [10.0, 59.0], [11.4, 59.1], [11.8, 59.9], [12.5, 60.2], [12.3, 61.0], [12.9, 61.4], [12.2, 62.3],
  [12.1, 63.0], [11.9, 63.6], [12.7, 64.0], [13.7, 64.6], [14.3, 65.1], [14.5, 66.1], [15.5, 66.3], [16.4, 67.2], [16.1, 67.5], [17.3, 68.1],
  [18.1, 68.5], [20.0, 68.4], [20.3, 69.06], [21.6, 69.3], [23.7, 68.8], [25.0, 68.6], [25.7, 69.2], [26.0, 69.7], [28.0, 70.0], [29.0, 69.1],
  [30.9, 69.8], [30.0, 70.1], [31.0, 70.4], [29.0, 70.9], [27.0, 71.1], [25.7, 71.0], [23.5, 70.9], [21.5, 70.3], [19.0, 70.1], [18.0, 69.6],
  [16.0, 69.0], [15.0, 68.9], [14.6, 68.4], [13.0, 68.1], [14.0, 67.6], [13.0, 66.9], [12.3, 66.0], [11.2, 65.1], [10.5, 64.4], [9.0, 63.6],
  [7.5, 63.1], [6.0, 62.5], [5.0, 62.0], [4.9, 61.0], [5.0, 60.4], [5.2, 59.5], [5.6, 58.9], [6.5, 58.2],
]
