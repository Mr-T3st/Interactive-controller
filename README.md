<div align="center">
  <img src=".github/assets/interactive-controller-logo.png" width="132" alt="Interactive-controller logo">

# Interactive-controller

**A lightweight, offline-first player and Story Pack engine for interactive films, specials, and episodic experiences.**


![Version](https://img.shields.io/badge/version-2.8.1-2f81f7)
![Offline](https://img.shields.io/badge/runtime-offline--first-238636)
![Portable](https://img.shields.io/badge/build-portable-8250df)
![Node](https://img.shields.io/badge/Node.js-18%2B%20build%20only-339933?logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-f1e05a)


[User guide](USER-GUIDE.md) · [Latest releases](https://github.com/Mr-T3st/Interactive-controller/releases) · [Open repository](https://github.com/Mr-T3st/Interactive-controller)
</div>

---

## What this project is

Interactive-controller began as a modern rebuild of the old browser-based **Black Mirror: Bandersnatch** player. The useful part of the original idea is still here: keep the complete media file on the user's device and move through a branching story by using verified segment and decision metadata.

The project has since become a small universal interactive-video engine. It separates the **player** from each title's **Story Pack**, so the same UI can represent movies, specials, series, and episodes without pretending that a plain MP4/MKV file contains the branching graph.

The selected movie stays on the user's device. The player does not upload it.

## Current compatibility model

Interactive Library uses five explicit states:

| Status | Meaning |
|---|---|
| ✅ **Built-in** | Verified Story Pack ships with the project and is ready immediately. |
| 📦 **Installed** | A matching external Story Pack was imported and stored locally in this browser. |
| 🧩 **Pack required** | The current engine supports the media model, but the verified branching metadata is not bundled. |
| 🛠 **Adapter required** | The title is catalogued, but its interaction model still needs a dedicated engine adapter. |
| ⚠️ **Invalid** | The imported pack is malformed or belongs to another catalog entry. |

At the moment **Black Mirror: Bandersnatch** is the bundled, fully playable Story Pack. Other entries are kept honest: they are not marked ready until their exact metadata and, where needed, engine adapter exist.

## Catalog

### Netflix — built-in / Story Pack targets

#### Ready now

- ✅ **Black Mirror: Bandersnatch** — built-in master-timeline Story Pack.

#### Movies and specials in the catalog

- Cat Burglar
- Buddy Thunderstruck: The Maybe Pile
- Headspace: Unwind Your Mind
- Escape the Undertaker
- Carmen Sandiego: To Steal or Not to Steal
- Barbie: Epic Road Trip
- Puss in Book: Trapped in an Epic Tale
- Stretch Armstrong: The Breakout
- Johnny Test's Ultimate Meatloaf Quest
- Spirit Riding Free: Ride Along Adventure
- The Last Kids on Earth: Happy Apocalypse to You
- Unbreakable Kimmy Schmidt: Kimmy vs. the Reverend
- Captain Underpants: Epic Choice-O-Rama
- The Boss Baby: Get That Baby
- Triviaverse
- Jurassic World Camp Cretaceous: Hidden Adventure
- Animals on the Loose: A You vs. Wild Movie
- You vs. Wild: Out Cold
- Ranveer vs. Wild with Bear Grylls
- We Lost Our Human
- Choose Love

#### Series and episodes in the catalog

- **Minecraft: Story Mode** — Episodes 1–5
- **Trivia Quest** — Episodes 1–30
- **You vs. Wild** — Episodes 1–8
- **Battle Kitty** — Episodes 1–9

### Outside Netflix — catalogued integration targets

These are deliberately separated from the Netflix list because their media layout and interaction model can differ. They are catalogued so adapters/Story Packs can be added without redesigning the player.

#### Interactive films

- 🛠 **The Outbreak** — `clipGraph`
- 🛠 **I'm Your Man** — `clipGraph`
- 🛠 **Kinoautomat** — `clipGraph`
- 🛠 **Mr. Payback: An Interactive Movie** — `clipGraph`
- 🛠 **Tender Loving Care** — `clipGraph`

#### Interactive series

- 🛠 **That Moment When** — Episodes 1–7
- 🛠 **#WarGames** — Episodes 1–6

#### Interactive experiences

- 🛠 **Mosaic — Interactive Experience** — `povChapters`

These entries are **catalogued, not falsely presented as playable**. Exact branching/media maps are required before they can become Ready.

## Main features

- Offline-first, dependency-free production bundle
- Local MP4/MKV/M4V/WebM selection and whole-window drag & drop
- Category → Title/Series → Episode selection
- Searchable Interactive Library with per-episode Story Pack state
- Fullscreen controls that reappear when the pointer reaches the bottom edge
- Master progress bar and ±10 second timeline seeking
- Story-aware previous/next scene navigation
- Full-frame two-choice overlay with center separator and subtle left/right highlighting
- Timed/default choices, persistent state and preconditions
- State-aware undo that restores the pre-choice snapshot before reopening a decision
- Saved story routes and compact path codes
- Built-in Bandersnatch English + Persian global subtitles
- Persian RTL, dual subtitle mode, SRT/VTT import, sync offset, font sizing and background opacity
- Gamepad navigation through the browser Gamepad API
- Story Pack validation, import, local persistence and removal
- Developer Story Inspector
- Direct `file://` portable build and GitHub Pages/PWA build from the same source
- Tiny Windows x64 launcher; no Electron runtime
- No required runtime CDN, analytics, account, API, or movie upload
- In-app GitHub button for checking updates and new releases

## Quick start for users

The easiest route is the GitHub **Releases** page:

1. Download the latest Portable ZIP.
2. Extract it.
3. On Windows, open `Interactive-controller.exe`; on other desktop systems, open `index.html` in a recent Chromium-based browser.
4. Choose a category, title/series, and episode when applicable.
5. If the Library says **Pack required**, import the exact matching Story Pack.
6. Open or drag the matching local media file.

No Node.js, npm, terminal, account, or installation is needed for normal playback.

For the complete UI walkthrough, shortcuts and troubleshooting, see **[USER-GUIDE.md](USER-GUIDE.md)**.

## Clone and run without a Release

This repository keeps generated `dist/` and `docs/` output. A user who clones the repository can therefore run the prebuilt player without rebuilding:

```bash
git clone https://github.com/Mr-T3st/Interactive-controller.git
cd Interactive-controller
```

Then open:

```text
dist/index.html
```

or on Windows:

```text
dist/Interactive-controller.exe
```

Node.js is only necessary when you want to regenerate the build from source.

## Development and Node.js build

Requirement: **Node.js 18+**.

There are no npm package dependencies for the production runtime.

```bash
npm run build
npm test
```

Generated output:

```text
dist/   -> portable/offline production build
docs/   -> GitHub Pages production build
```

For local development and PWA testing:

```bash
npm run serve
```

Then open:

```text
http://127.0.0.1:4173
```

Windows developers may also use `start.cmd`; Linux/macOS developers may use `./start.sh`.

### Source layout

```text
.
├── .github/
│   ├── assets/
│   └── workflows/
├── src/                 # player UI, engine, catalog, normalized built-in data
├── story-packs/         # Story Pack JSON template
├── tools/               # build, server and validation scripts
├── extras/              # optional subtitle material
├── dist/                # generated portable output
├── docs/                # generated GitHub Pages output
├── README.md
├── USER-GUIDE.md
├── LICENSE
└── package.json
```

## Story Packs

The video container normally does **not** carry the interactive branching map. Interactive-controller keeps that data separate.

A Story Pack can describe:

- segment/media destinations
- timed choices and defaults
- persistent states
- preconditions
- title/episode identity
- translations
- subtitle metadata
- required interaction model

Bandersnatch is built in. For other titles, do not invent timestamps or routes. Use verified metadata for the exact cut/media structure.

The current JSON starter is:

```text
story-packs/STORY-PACK-TEMPLATE.json
```

The format and import process are documented in **USER-GUIDE.md**.

## GitHub Pages

The online version of Interactive-controller is available here:

[Open Interactive-controller Online](https://mr-t3st.github.io/Interactive-controller/)

The hosted site serves the player only. A movie selected by the user remains local to the browser.


## Releases

This repository includes `.github/workflows/release.yml`. Tags matching `v*` trigger the GitHub Actions workflow, which builds, validates, packages, checksums, and publishes the end-user assets automatically.

Typical Release assets:

```text
Interactive-controller-Portable-v2.8.1.zip
Interactive-controller-Windows-x64-v2.8.1.zip
Interactive-controller-v2.8.1-SHA256.txt
```

GitHub also provides its own source archive for each release. The manually published assets therefore stay focused on ready-to-run builds.

## Portable vs executable

`Interactive-controller.exe` is intentionally a tiny **Windows x64 launcher**, not an Electron application. It opens the adjacent generated `index.html` in the user's default browser. This keeps the Release small and lets the same HTML/CSS/JavaScript engine remain usable on Windows, Linux, Android/PWA and other browser-capable systems.

The executable is therefore **not a single self-contained player file** yet; keep it next to the other files from the Windows ZIP.

## Privacy and offline behavior

- Media stays on the user's device.
- Playback uses local browser file access and Blob URLs.
- No media upload is required.
- The portable build has no required runtime HTTP/API/CDN dependency.
- GitHub Pages hosts the application shell, not the user's movie.
- Saved routes/settings/installed packs use browser-local storage.

## Attribution

The built-in Bandersnatch support includes work derived from the MIT-licensed [mohetios/BandersnatchInteractive](https://github.com/mohetios/BandersnatchInteractive) project. The required upstream copyright and license notice is preserved in [`LICENSE`](LICENSE).

## Related / similar open-source projects

Interactive video has been explored in several different ways. The projects below are useful references for comparison, research, interoperability ideas, or historical context. Listing a project here does **not** mean its source code is included in Interactive-controller unless explicitly stated as an upstream/derived source. Each project keeps its own copyright and license.

| Project | Main focus | How it relates to Interactive-controller |
|---|---|---|
| [mohetios/BandersnatchInteractive](https://github.com/mohetios/BandersnatchInteractive) | Browser-based Bandersnatch player using the long master video and interactive metadata | **Direct upstream / lineage** for the original Bandersnatch-compatible foundation |
| `joric/bandersnatch` | Early Bandersnatch interactive work and data research | Historical source credited by the upstream project; repository is currently unavailable |
| [Eveep23/Interactive-Player](https://github.com/Eveep23/Interactive-Player) | Desktop emulator for Netflix interactive movies/shows using LibVLCSharp and controller input | Broad Netflix-title coverage; useful comparison for catalog and controller behavior |
| [mosquito-byte/mpv-interactive-video](https://github.com/mosquito-byte/mpv-interactive-video) | mpv Lua script using separate segment and interactive-moment JSON files | Very small data-driven playback model; close conceptually to Story Packs |
| [deathrjj/BandersnatchInteractive-Jellyfin](https://github.com/deathrjj/BandersnatchInteractive-Jellyfin) | Jellyfin plugin derived from BandersnatchInteractive | Server/library integration of the same Bandersnatch-style idea |
| [ividjs/ivid](https://github.com/ividjs/ivid) | Generic browser/Web Component CYOA video player | Generic scene/choice engine rather than title-specific emulation |
| [nathanlemos/bander-it-up](https://github.com/nathanlemos/bander-it-up) | Ionic/JSON interactive-video framework with mobile focus | Similar configurable scene graph and mobile-oriented approach |
| [victorrica/Bandersnatch](https://github.com/victorrica/Bandersnatch) | Script-driven interactive video player with desktop packaging | Similar idea of describing decisions and destinations in a script |
| [leandroslc/interactive-video-player](https://github.com/leandroslc/interactive-video-player) | Educational Bandersnatch-style player and video-processing example | Useful reference for browser playback/build concepts; archived project |
| [lucasbecker/bandersnatch](https://github.com/lucasbecker/bandersnatch) | Reproduction of Netflix-like Bandersnatch playback using Video.js and video chunks | Focuses more on streaming/chunk delivery than local single-master playback |
| [TheAhmadOsman/Bandersnatch](https://github.com/TheAhmadOsman/Bandersnatch) | Visual exploration of Bandersnatch paths | Story-graph visualization rather than a full movie player |
| [iann0036/bandersnatch-graph](https://github.com/iann0036/bandersnatch-graph) | Generates a graph of Bandersnatch possibilities | Useful reference for route/graph analysis |
| [heypoom/bandersnatch](https://github.com/heypoom/bandersnatch) | Programmatic analysis of Bandersnatch interactive data | Research/reference for understanding the underlying branching model |
| [xesf/late-shift](https://github.com/xesf/late-shift) | Web reimplementation of the interactive film *Late Shift* | Strong reference for non-Netflix FMV/web Story Pack support |
| [Rinnegatamante/OpenFMV](https://github.com/Rinnegatamante/OpenFMV) | Open-source FMV engine/reimplementations, including Late Shift | Reference for multi-clip FMV engines and future `clipGraph` adapters |
| [joebain/VCE](https://github.com/joebain/VCE) | Small JavaScript library for interactive video adventures | Generic node/choice model useful for comparing Story Pack design |
| [mbondyra/interactive-video](https://github.com/mbondyra/interactive-video) | React-based interactive-video experiment inspired by Bandersnatch | Another browser implementation of branching video UI |
| [ErickWendel/semana-javascript-expert01](https://github.com/ErickWendel/semana-javascript-expert01) | JavaScript Expert Bandersnatch player clone | Educational implementation and browser-video engineering reference |

This list is intended to cover the **most directly relevant public projects found during this project's review**, not every repository that has ever used the words “interactive video” or “Bandersnatch.” If a relevant project is missing, opening an issue or pull request with a link is welcome.

## How Interactive-controller is different

Interactive-controller overlaps with several projects above, but its current design combines a set of goals that are not usually present together:

- **One browser-first engine for multiple interaction models.** The catalog separates `singleMaster`, future `clipGraph`, `multiFeed`, `povChapters`, and episodic models instead of hard-wiring the UI to one title.
- **Story Packs are separate from media.** A movie file is not treated as if it magically contains the branch graph; verified metadata is imported or bundled independently.
- **Honest compatibility states.** Titles are marked `Built-in`, `Installed`, `Pack required`, `Adapter required`, or `Invalid` instead of appearing playable before their graph/adapter exists.
- **Offline/local-media first.** The production player can run from `file://`, keeps the user's movie local, and does not require VLC, Electron, a server, an account, or a runtime CDN.
- **Bandersnatch-specific depth without locking the whole project to Bandersnatch.** The built-in pack retains persistent state, preconditions, timed/default choices, decision rollback, story-aware navigation and global subtitles, while the engine/catalog are being generalized for other titles.
- **Global subtitle tooling.** English/Persian built-ins, RTL, dual subtitles, SRT/VTT import, sync offset, font size and background opacity are handled by the player itself.
- **Route management rather than raw seek history.** The user can save meaningful decision paths without filling the Story view with every manual seek.
- **Portable distribution from the same source.** The same core produces the direct browser build, GitHub Pages/PWA output, and a tiny Windows launcher package.

It is therefore **not unique because no other interactive-video player exists**—many good projects do. Its distinction is the combination of lightweight local playback, explicit Story Packs, a universal catalog, conservative compatibility reporting, advanced Bandersnatch state handling, and a path toward additional interactive-film models without adopting a large media runtime.

## License and media notice

Interactive-controller is distributed under the **MIT License**. Upstream notices required by derived code/data are preserved in [`LICENSE`](LICENSE).

Commercial films, series episodes and other copyrighted media are **not included**. Users are responsible for using media they are legally entitled to access. Netflix, GitHub, HBO and other product/title names are trademarks of their respective owners; this project is not affiliated with or endorsed by them.

Upstream Bandersnatch project: [mohetios/BandersnatchInteractive](https://github.com/mohetios/BandersnatchInteractive).

## v2.8.1 highlights

- Repository: `Mr-T3st/Interactive-controller`.
- Clickable GitHub/update button inside the running player.
- GitHub-style README with project logo, badges and Related Projects table.
- Documentation consolidated into `README.md` and `USER-GUIDE.md`.
- Build, Pages, Release and Story Pack documentation kept in the main README.
- Softer rounded corners across project buttons while preserving the full-frame split-choice interaction.
- All existing playback, subtitle, route, Story Pack and Interactive Library behavior is preserved.

---

<div align="center">
  <sub>Keep the media local. Keep the story data explicit. Keep the player small.</sub>
</div>
