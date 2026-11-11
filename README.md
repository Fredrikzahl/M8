# PlanM8 nettapp

En nettside som dekker det PlanM8-kompendiet og appskjermene beskriver: FleetM8
(maskinparken), SaleM8 (leie og salg), LogM8 (frakt) og Topp 100. Den er laget
for mobil først og fungerer også på PC.

Appen har ingen server. Alt lagres i nettleseren, og demodata følger med, slik
at hele flyten kan prøves med en gang. Motparten i en handel spilles ved å bytte
demobruker.

## Kom i gang

```bash
npm install
npm run dev        # utvikling på http://localhost:5173
npm run build      # typesjekk og bygg til dist/
npm run preview    # se det ferdige bygget
```

`dist/` er vanlige statiske filer og kan legges på en hvilken som helst
nettjener.

`npm run build:artifact` lager i tillegg `dist-artifact/planm8.html`, én fil der
skript, stiler og bilder ligger inne i fila.

## Dette virker

- Objektregister med objektkort, kart, avdelinger, filtre, masseimport fra CSV og «Vask parken»
- QR-kode per objekt og beskjeder til verksmester, med sperre for utleie ved åpen feil
- Automatiske oppgaver for service og EU-kontroll, og rapporter med forslag til fornyelse
- Sveip-marked med ønsker, match, favoritter og «ønskes kjøpt eller leid»
- Godkjenning av leietaker, leieflyten i sju steg, skjema med bilder og signatur, og mottakskontroll
- Salg med bud, motbud og eierskifte der bare serienummer og modell følger med
- Frakt med bud, heng på bil, ledig på tur, løyvekontroll og dokumentasjon ved henting og levering
- Blinkskudd, Topp 100 med ratingmodus, kategorier, delebilde og vinnervegg
- «Send maskin» med tilgangsnivå, utløp og sporing, og leads til leverandører
- Roller og visninger: administrator, leder, verksmester, fører, sjåfør og partner

## Dette er simulert eller ikke koblet til

| Område | Status |
| --- | --- |
| Innlogging | Du velger en demobruker. Vipps, BankID og engangskode er ikke koblet til. |
| Lagring | Alt ligger i én nettleser. Andre enheter ser ikke det du gjør. |
| Betaling | Forskudd og oppgjør bokføres i appen uten betalingspartner. Ingen penger flyttes. |
| AI | Avlesning av teller, skadesammenligning, annonsetekst og typeforslag følger enkle regler og er merket «Simulert AI». |
| Verdiestimat | En enkel avskrivningsformel, vist som intervall. Den bygger ikke på salgsdata. |
| Varsler | Vises i appen. E-post, SMS og push sendes ikke. |
| Kart | En forenklet tegning uten veier. Avstand er luftlinje ganget med 1,3. |
| Rettigheter | Håndheves bare i grensesnittet, siden det ikke finnes noen server. |
| Bonuspool for førere | Ikke bygget. Kompendiet sier dette krever avklaring først. |

Alle bedrifter, personer, organisasjonsnumre og priser i demodataene er oppdiktet.
Siden «Om denne versjonen» i appen viser den samme oversikten.

## Slik er koden lagt opp

| Sti | Innhold |
| --- | --- |
| `src/types.ts` | Datamodellen |
| `src/seed.ts` | Demodata |
| `src/store.ts` | Tilstand, lagring i nettleseren og oppslag |
| `src/actions.ts` | Alt som endrer data: leieflyt, bud, frakt, stemmer og leads |
| `src/lib/logic.ts` | Forretningsregler, gebyrer, estimat og de simulerte AI-forslagene |
| `src/ui/` | Felles byggeklosser: knapper, kort, kamera, sveipekort, signatur og kart |
| `src/screens/` | Skjermene, én fil per del av appen |
| `src/App.tsx` | Ruter, meny og tilgang per rolle |

Vite, React og TypeScript. Ingen andre rammeverk.

## Demobilder

Bildene i `src/assets/demo-photos/` er ikke sjekket inn, fordi repoet er
offentlig og bilder kan vise firmanavn og skilt. Uten bilder viser appen
tegninger av maskintypene. Se `src/assets/demo-photos/README.md` for filnavnene
som plukkes opp ved bygging.

## Veien videre

For å brukes av flere bedrifter på ekte trengs en server med felles database,
ekte innlogging og tilgangsstyring, og avtaler med betalingspartner og
leverandør av SMS og e-post. Datamodellen og handlingene i `src/actions.ts` er
skrevet slik at de kan flyttes bak et API.
