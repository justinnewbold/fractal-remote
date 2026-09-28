# Pass 2 — Internet Archive + remaining open-access

**Date:** 2026-09-27 (America/Denver)  
**Scope:** `pass2-missing-{amp,cab,pedal}.csv` (76+27+31). Skip slugs already in `licensed/sources.csv` or `licensed/{slug}.jpg`. Sources: archive.org (PD/CC0/CC BY/CC BY-SA only), Europeana `reusability=open`, Wikimedia Commons nickname/JP/DE/IT pass, Flickr Commons via IA `collection:flickrcommons`.

## Slugs added (4)

| slug | kind | model | source | licence |
|---|---|---|---|---|
| `5f1-tweed` | amp | Fender Champ 5F1 (narrow-panel tweed) | [IA Fender Guitar Catalog 1957–58](https://archive.org/details/fender-guitar-catalog-1957-58) page 22 Champ product photo (cropped) | Public Domain Mark 1.0 |
| `1x8-5f1-tweed` | cab | Champ 5F1 1×8 (same combo) | same Champ crop | Public Domain Mark 1.0 |
| `supremo-trem` | amp | Supro Dual-Tone Tremolo (S6424T / 1964 Dual-Tone) | [IA Oahu/Supro Guitar+Amplifier Catalog 1964](https://archive.org/details/oahu-supro-guitar-amplifier-catalog-1964) page 6 | Public Domain Mark 1.0 |
| `t808-mod` | pedal | Ibanez TS808 Tube Screamer (true-bypass + tone mod) | [Commons](https://commons.wikimedia.org/wiki/File:Ibanez_TS-808_Tube_Screamer_Overdrive_Pro_(True_bypass_Mod_and_Tone_Mod).jpg) (Andrés Galeotti / Flickr) | CC BY 2.0 |

All four written as 1200×900 JPEG q80 <200KB under `licensed/{slug}.jpg`. Rows flock-appended to `sources.csv` with `date_obtained=2026-09-27`.

## Internet Archive

### Accepted
- Item pages explicitly show **Public Domain Mark 1.0** (`licenseurl` + UI “Public Domain Mark 1.0”).
- Prefer photos of real gear; these are **catalog product photos** (halftone scans) of the exact models, allowed when the item is PD and the crop is clear enough for a product plate.
- **Champ:** 1957–58 catalog Champ Amp — tubes 12AX7 / 6V6GT / 5Y3GT, narrow-panel tweed, “Fender Champ” badge → exact `5F1` era. Used for both amp and 1×8 cab slugs.
- **Dual-Tone:** 1964 Supro catalog “DUAL-TONE TREMOLO” — 12″ Jensen, 2×6973, Trinidad Blue, Supro script badge → Fractal `1964T Dual-Tone` / `supremo-trem`.

### Searched but rejected
- Many keyword hits were audio/movies/texts (Friedman/King-of-Tone/Bad-Cat noise). Tightened to catalogs + `mediatype:image`.
- **Fender Twin** (1957–58 catalog): narrow-panel Twin-Amp photo, but tube list is 2×6L6 (not high-powered **5F8** 4×6L6) → not `5f8-tweed`.
- **Fender Bassman** (same catalog): Bassman badge + 4×10, but rectifier listed as **83** (pre-**5F6-A** / GZ34) → not `59-bassguy`.
- **Tremolux / Vibrolux / Deluxe** tweed pages → wrong era vs AA763 / 6G11 / 6G3.
- **1962–63** blonde piggy-back Bassman/Tremolux → not AB165 combo / AA763 blackface.
- **1962–63 Vibrolux** text lists 12″ + 6L6GC → not **6G11** (10″ / 6V6).
- **Marshall 1974** catalog: Model **1987** plexi shared with 1959/1989 — not **1987X** reissue; **1960/1960B** stack — not **1960TV**.
- **bassmanold**, **1-s-fender-amplifier_***: no licenceurl → reject.
- **2006 Marshall** etc. also carry PDM tags from the same uploader; skipped modern catalogs where a PD claim is implausible even when the UI badge is present.

Working files under `pass2-archive/ia/` (PDFs, page JPEGs, OCR, crops).

## Wikimedia Commons (nickname / JP / DE / IT pass)

~670 unique File: hits; gear-filtered set inspected.

### Accepted
- **t808-mod:** `Ibanez TS-808 Tube Screamer Overdrive Pro (True bypass Mod and Tone Mod).jpg` — readable TS808 faceplate + non-stock toggle (mod). CC BY 2.0.

### Rejected (notable)
| Candidate | Why |
|---|---|
| `JTM 45 MK II Reissue 1997.jpg` | **GFDL-only** |
| `1957 Fender Twin … 5E8A …` | **5E8-A**, not 5F8 |
| `1953 Fender Champ model 5C1.jpg` | **5C1** wide-panel, not 5F1 |
| `1976 Fender Champ` | silverface-era, not 5F1 |
| `Bassman15.JPG` | silverface piggy-back, not AB165 / 5F6-A |
| `1955 5D6A Bassman 410` | **5D6-A** rear gut-shot, not 5F6-A product front |
| `Bad Cat (4715121713).jpg` | photo of a **cat** |
| `Tech 21 SansAmp Bass Driver DI.jpg` | classic **V1** layout (no Mid/Character) — Fractal wants **V2** |
| `Nobels ODR-mini.jpg` | mini, not **ODR-1 BC** |
| ProCo RAT / Rat2 / Turbo | not **Fat RAT** |
| Marshall 1960A cab shots | **1960A**, not **1960TV** |
| Colorsound Supa Tonebender | not **Overdriver** |
| Octavia category | audio / Hendrix only — no Tycobrahe product still |
| Univox Super-Fuzz, SD-9, MT10, M77, Zendrive, King of Tone, Morning Glory, B7K, Hot Cake, Jan Ray, etc. | no exact-model open stills |

## Europeana (`reusability=open`, `TYPE:IMAGE`, `wskey=apidemo`)

Queries for Fender/Marshall/Champ/Bassman/pedals/Gitarrenverstärker/amplificatore → **0** open image hits this pass (same dead-end pattern as museum pass: wrong objects or empty under open filter).

## Flickr Commons

IA `collection:flickrcommons` + guitar/amp terms → 2 unrelated institutional photos (school demolition; 1901 manoeuvres). No gear.

## Still missing (high level)

Vintage Fenders still open: **5F8 Twin, 5F6-A Bassman, AB165, AA763 Tremolux, 6G11 Vibrolux, 6G3 Deluxe, Vibro-King**. Boutique/modern heads (Diezel VH4, Friedman BE/HBE, Mesa Mark V/JP-2C/TriAxis/IIC+, Bogner, Suhr Badger, Revv, PRS Archon, Trainwreck, 1987X, JVM410HJS, …). Pedals: Darkglass B7K, Blues Breaker, Fat RAT, Zendrive, King of Tone, Morning Glory, SansAmp Bass Driver **V2**, Nobels ODR-1, Univox Super-Fuzz, Colorsound Overdriver, etc. Cabs: 1960TV, Recto straight, Friedman/Stealth/Soldano 4×12s, etc.

## Processing note

Catalog Champ crop cleaned of a thin layout rule; padded to 1200×900 white canvas at q80. No git, no email outreach.
