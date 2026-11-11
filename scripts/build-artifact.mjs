// Bygger hele appen som én selvstendig HTML-fil der skript, stiler og bilder ligger inne i fila.
// Brukes til forhåndsvisning der bare én fil kan lastes. Vanlig bygg: npm run build.
import { build } from 'vite'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = 'dist-artifact'
await build({ mode: 'artifact', logLevel: 'warn' })

const assets = join(out, 'assets')
const files = readdirSync(assets)
const js = files.filter(f => f.endsWith('.js'))
const css = files.filter(f => f.endsWith('.css'))
const other = files.filter(f => !f.endsWith('.js') && !f.endsWith('.css'))
if (js.length !== 1) throw new Error(`Ventet én skriptfil, fant ${js.length}`)
if (other.length) throw new Error(`Disse filene ble ikke bygget inn: ${other.join(', ')}`)

// Tekst som ville avsluttet skript- eller stilblokken for tidlig, må brytes opp.
const script = readFileSync(join(assets, js[0]), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')
const style = css.map(f => readFileSync(join(assets, f), 'utf8')).join('\n').replace(/<\/style/gi, '<\\/style')

const html = `<title>PlanM8 nettapp</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&family=Oswald:wght@500;600&display=swap">
<style>
${style}
</style>
<div id="root"></div>
<script type="module">
${script}
</script>
`
const target = join(out, 'planm8.html')
writeFileSync(target, html)
console.log(`${target}: ${(html.length / 1024).toFixed(0)} kB`)
