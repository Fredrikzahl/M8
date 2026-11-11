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
nettjener. Når siden ligger på en adresse med https, kan den installeres som
egen app på mobil og PC.

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
- Søk og hurtigkommandoer med Ctrl K eller ⌘K: sider, objekter, annonser, leieforhold og fraktoppdrag
- Lys og mørk modus som følger systemet eller velges under «Mer»
- Installering som egen app, med ikon på hjemskjermen og åpning uten nett

## Design

Alt utseende ligger i `src/styles.css` og styres av variabler øverst i fila.
Lys og mørk modus bruker de samme reglene med hvert sitt sett farger.

- Merkefargene er mørk grønn-svart, rav for SaleM8, blå for LogM8 og grønn for FleetM8. Menyen tar farge etter delen du står i.
- Inter brukes til all tekst. Oswald brukes bare i logoen og i poengene på Topp 100.
- På mobil er menyen nederst, sidene har stor tittel som krymper inn i toppfeltet når du ruller, og dialoger kommer opp som ark nedenfra som kan dras ned.
- På PC er menyen til venstre, lister ligger i flere kolonner, og dialoger vises midt på skjermen.
- Hver side har en vanlig tittel, med merket for delen den hører til (FleetM8, SaleM8, LogM8 eller Topp 100) som en liten linje over.
- Alt som bare tar deg til en annen side er ekte lenker, så de kan åpnes i ny fane. Hele raden er trykkbar, og små knapper har et trykkfelt på minst 40 punkter.
- Bevegelse er kort og brukes bare når du går inn i eller ut av noe: sider du blar til, ark og meldinger. Bytte mellom fanene i menyen er uten animasjon. Alt kan slås av med systemvalget for redusert bevegelse.
- Appen kan brukes med tastatur: «Hopp til innholdet» ligger først, fokus flyttes til siden du åpner, og ark og søk holder på fokus til de lukkes.

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
| `src/lib/theme.ts` | Lys, mørk og automatisk modus |
| `src/lib/install.ts` | Installering som egen app |
| `src/styles.css` | Designsystemet: farger, typografi og alle komponenter |
| `src/ui/` | Felles byggeklosser: sideramme, knapper, kort, ark, kamera, sveipekort, signatur og kart |
| `src/screens/` | Skjermene, én fil per del av appen. `search.tsx` er søket |
| `src/App.tsx` | Ruter, meny og tilgang per rolle |
| `public/` | Ikoner, manifest og tjenestearbeideren som gjør appen installerbar |

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
