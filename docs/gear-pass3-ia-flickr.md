# Pass 3 — Internet Archive catalogs + Flickr CC

**Date:** 2026-09-27 (America/Denver)  
**Scope:** `pass3-missing-{amp,cab,pedal}.csv`. Skip existing `licensed/{slug}.jpg`. Sources: archive.org item pages with explicit **Public Domain Mark 1.0** / CC BY / CC BY-SA / CC0 only; Flickr via Openverse (`license=cc0,pdm,by,by-sa`). Skip Unsplash/Pexels, retailers, NC/ND, GFDL-only, email.

## Slugs added (8)

| slug | kind | model | source | licence |
|---|---|---|---|---|
| `5f8-tweed` | amp | Fender Twin-Amp, narrow-panel tweed (1959 catalog = **5F8** high-power era) | [IA Fender Guitar Catalog 1959](https://archive.org/details/fender-guitar-catalog-1959) Twin product photo | Public Domain Mark 1.0 |
| `59-bassguy` | amp | Fender Bassman 4×10 narrow-panel tweed (**5F6-A** / GZ34 era) | same 1959 catalog Bassman photo | Public Domain Mark 1.0 |
| `65-bassguy` | amp | Blackface Bassman piggyback (**AB165**) + 2×12 cab | [IA Fender Guitar Catalog 1965–66](https://archive.org/details/fender-guitar-catalog-1965-66) page labeled BASSMAN | Public Domain Mark 1.0 |
| `dweezils-b-man` | amp | same AB165 stock catalog plate (Fractal “modded ’65” stand-in) | same 1965–66 Bassman plate | Public Domain Mark 1.0 |
| `tremolo-lux` | amp | Blackface Tremolux piggyback (**AA763**) | same 1965–66 catalog Tremolux plate | Public Domain Mark 1.0 |
| `deluxe-6g3` | amp | Brownface/blonde Deluxe 1×12 (**6G3**) | [IA Fender Guitar Catalog 1961](https://archive.org/details/fender-guitar-catalog-1961) “New!” Deluxe | Public Domain Mark 1.0 |
| `vibrato-lux` | amp | Brownface/blonde Vibrolux 1×10 (**6G11**) | same 1961 catalog Vibrolux (OCR: **10″** speaker) | Public Domain Mark 1.0 |
| `2x12-65-bassguy` | cab | AB165 Bassman 2×12 cab (from same piggyback plate) | 1965–66 Bassman cab crop | Public Domain Mark 1.0 |

All eight written as 1200×900 JPEG q80 <200KB under `licensed/{slug}.jpg`. Rows flock-appended to `sources.csv` with `date_obtained=2026-09-27`. No overwrites. No git.

## Internet Archive

### Accepted (circuit notes)
- **1959 Twin (`5f8-tweed`):** Catalog year is during exclusive high-power Twin production (**5F8** / 4×6L6). Badge reads “Fender Twin-Amp”; narrow-panel tweed; dual-12 cabinet. Page has no tube chart (unlike 1957–58 which listed **2×6L6** and was rejected in Pass 2 as 5E8-A). Accept on catalog year + badge + cabinet.
- **1959 Bassman (`59-bassguy`):** Four 10″ Jensens, mid-range + presence, narrow-panel tweed — **5F6-A** era (GZ34). Pass 2 rejected 1957–58 Bassman for **83** rectifier.
- **1965–66 Bassman (`65-bassguy` / `dweezils-b-man`):** Page caption **BASSMAN**; blackface piggyback head + 2×12 cab → **AB165** (matches Fractal + cab `2x12-65-bassguy`).
- **1965–66 Tremolux (`tremolo-lux`):** Piggyback blackface on Tremolux page → **AA763**.
- **1961 Deluxe (`deluxe-6g3`):** OCR “12″ heavy-duty speaker”, 6-knob front panel (2 vol / 2 tone / speed / intensity) → **6G3**.
- **1961 Vibrolux (`vibrato-lux`):** OCR “**10″** heavy-duty speaker” → **6G11** (explicitly not 1962–63 12″/6L6GC Vibrolux rejected in Pass 2).

### Searched / rejected
- **1957–58 Twin / Bassman:** already rejected Pass 2 (2×6L6 / 83 rectifier).
- **1962–63 Vibrolux:** 12″ + 6L6GC — not 6G11.
- **1962–63 Tremolux / Bassman:** blonde piggyback — wrong vs AA763 / AB165 blackface.
- **1965–66 Vibrolux/Reverb:** blackface 2×10 with reverb — not 6G11.
- **Gibson 1966 amp catalog (PDM):** GSS-50 / Titan / Mercury / Medalist — **no Scout**.
- **Marshall 1974 (PDM):** Model 1987 plexi / 1960 stack — not **1987X** reissue / not **1960TV**.
- **Supro Black Magick:** no PD/CC catalog item with exact modern 1695T plate.
- **Vibro-King:** no PD catalog match.
- IA advanced search API returned backend errors this run; used known `instrumentcatalogs` identifiers + prior Pass 2 meta (`licenseurl` = PDM 1.0 confirmed via `/metadata/`).

Working files: `pass3-ia-flickr/ia/{pdfs,pages,crops,meta,ocr}/`.

## Flickr / Openverse (`by` / `by-sa` / `cc0` / `pdm`)

Queried Openverse (Flickr source filter) for B7K, Bluesbreaker Mk1, Fat RAT, Zendrive, King of Tone, Morning Glory, Hot Cake, Jan Ray, ODR-1 full-size, SansAmp Bass Driver **V2**, Univox Super-Fuzz, Colorsound Overdriver, Tube Driver, Crunch Box, etc.

### Near-misses (rejected)
| Candidate | Why |
|---|---|
| Commons / Openverse **Marshall BB-2** (CC BY-SA 3.0) | Bluesbreaker **II** / BB-2 — not **Mk1** |
| Flickr/Commons **SansAmp Bass Driver DI** (CC BY / BY-SA) | **V1** layout (no Mid / Character) — Fractal wants **V2** |
| Flickr pedalboard with Nobels | **ODR-mini** only — not full-size ODR-1 BC |
| ProCo RAT Flickr set (Roadside Guitars) | **RAT 2** — not **Fat RAT** |
| germanium “Colorsound” / “Pedal collection” | No clear **Overdriver** faceplate; busy floor scatter |
| ArtBrom pedalboards | OCD / BB Preamp / Keeley etc. — none of the missing boutique list |
| “Hot Cake”, “Morning Glory”, “King of Tone”, “Jan Ray”, “B7K”, “Zendrive”, “Super Fuzz”, “Crunch Box”, “Tube Driver” keyword hits | Food / flowers / trains / London Tube / boy scouts / albums — no exact pedal stills |
| Flickr 1966 Vibrolux (John W. Tuggle, CC BY) | Blackface Vibrolux — not **6G11** |

Many Flickr `staticflickr.com` originals returned **403** from this host; Openverse `_b.jpg` derivatives used where available. No pedal slug accepted this pass.

## Still missing (high level)

Boutique/modern heads (Diezel VH4, Friedman BE/HBE, Mesa Mark V/JP-2C/TriAxis/IIC+, Bogner, Suhr Badger, Revv, PRS Archon, Trainwreck, 1987X, JVM410HJS, Supro Black Magick, Gibson Scout, Vibro-King, …). Pedals: Darkglass B7K, Blues Breaker **Mk1**, Fat RAT, Zendrive, King of Tone, Morning Glory, Hot Cake, Jan Ray, SansAmp Bass Driver **V2**, Nobels ODR-1 full-size, Univox Super-Fuzz, Colorsound Overdriver, Tube Driver, Crunch Box, etc. Most remaining cabs (1960TV, Recto straight, Friedman/Stealth/Soldano 4×12s, …).

## Processing note

Catalog crops padded to 1200×900 white canvas at JPEG q80; mild autocontrast/sharpen for halftone scans. `dweezils-b-man` shares the same AB165 catalog plate as `65-bassguy` (identical bytes). No git, no email outreach.
