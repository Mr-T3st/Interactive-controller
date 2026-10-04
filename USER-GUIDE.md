# Interactive-controller — User Guide

This guide is for people who want to use the player without reading the development details in the main README.

Official repository: **https://github.com/Mr-T3st/Interactive-controller**

## 1. Starting the player

### Windows

Extract the Release ZIP first, then open:

```text
Interactive-controller.exe
```

The executable is a small launcher and must stay beside `index.html`, `app.js`, `styles.css` and the other files from the ZIP.

You can also open `index.html` directly.

### Linux / macOS

Open `index.html` in a recent Chromium-based browser, or serve the folder locally if you want PWA/service-worker behavior.

### Android

The easiest Android route is the HTTPS/GitHub Pages version. Open the site, choose the title, then select the media file from device storage. The JavaScript story engine does not need a different programming language for Android.

## 2. Choosing an interactive

The start screen is intentionally split into three levels:

1. **Category**
2. **Title / series**
3. **Episode** — shown only when the selected title is episodic

Examples:

```text
Netflix — Movies & Specials
→ Black Mirror: Bandersnatch
```

and:

```text
Netflix — Series & Episodes
→ Trivia Quest
→ Episode 07
```

This keeps long series such as Trivia Quest, Battle Kitty and You vs. Wild out of a single oversized title list.

## 3. Understanding Story Pack status

Open **Interactive Library** to see every catalog entry and episode.

| Status | What to do |
|---|---|
| **Built-in** | Nothing. Select the movie and play. |
| **Installed** | The matching external Story Pack is already stored locally. |
| **Pack required** | Load the exact Story Pack before choosing media. |
| **Adapter required** | The player knows the title, but the required interaction engine is not implemented yet. |
| **Invalid** | Remove/re-import the pack; it is malformed or mismatched. |

The Library supports search and filtering by category/status.

## 4. Opening media

After a playable title/episode is selected:

- click **Open movie**, or
- drag the movie anywhere onto the page.

Recommended format is MP4 using browser-friendly codecs such as H.264 + AAC.

MKV is attempted through the browser's native media pipeline. MKV is only a container, so compatibility depends on the codecs inside it.

The selected video is kept local to the device and is not uploaded by Interactive-controller.

## 5. The progress bar vs story navigation

The player deliberately separates ordinary timeline movement from story movement.

### Timeline controls

- drag the master progress bar to any point,
- `←` = 10 seconds back,
- `→` = 10 seconds forward.

These actions change video time without adding noisy entries to the Story Route view.

### Story controls

- `↑` = previous recorded story scene,
- `↓` = next recorded story scene,
- the Previous/Next Scene buttons do the same thing.

If the previous scene crosses a decision, the player restores the pre-choice state and reopens that decision. Choosing another option truncates the old future route and continues from the new branch.

## 6. Interactive choices

Two-option decisions use the video frame itself as the interaction surface:

```text
┌─────────────────────────────────────┐
│             │                       │
│  OPTION A   │       OPTION B        │
│             │                       │
└─────────────────────────────────────┘
```

The center separator remains visible. Moving the pointer over the left/right side adds a subtle gray overlay so the intended choice is clear without covering the scene.

Number keys `1–9` can select visible choices.

## 7. Undoing a decision

Use:

```text
U
```

or:

```text
Backspace
```

Undo is state-aware. It restores the snapshot from before the last decision rather than merely seeking the video backward.

## 8. Fullscreen controls

In fullscreen the control panel fades away while watching.

Move the pointer toward the bottom edge to reveal:

- progress bar,
- previous/next story scene,
- ±10 second seek,
- play/pause,
- undo,
- volume/mute,
- fullscreen controls.

On touch devices, tapping near the lower edge reveals the controls.

## 9. Subtitles

Bandersnatch includes built-in English and Persian global subtitles.

Because the project uses the full master timeline, a story jump also moves subtitle time automatically. Separate subtitle files per segment are not needed.

Available subtitle tools:

- primary subtitle,
- optional secondary subtitle,
- Persian RTL rendering,
- dual subtitles,
- load external `.srt` / `.vtt`,
- `−0.1s / +0.1s` sync correction,
- `A− / A+` subtitle size,
- subtitle background opacity slider.

The subtitle background can be made almost invisible or darker depending on the scene.

## 10. Story Path and Saved Routes

**Story Path** shows meaningful decisions instead of every seek/segment transition.

A route can be saved with:

- date,
- path code,
- list of decisions.

Starting a fresh route clears the current playthrough but keeps saved routes. Full Reset clears progress, settings and saved routes.

## 11. Gamepad controls

Standard browser gamepads are supported:

- D-pad left/right = −/+10 seconds, or choice navigation while a decision is open,
- D-pad up/down = previous/next story scene,
- A = play/select,
- B = undo decision,
- Start = fullscreen.

## 12. Developer Inspector

Press `D` or use **Inspector** to see development information such as:

- current segment,
- active moments,
- pending decision,
- changed persistent state.

It is intended for Story Pack work and debugging, not normal viewing.

## 13. Importing a Story Pack

A video file usually does not include the branching graph used by an interactive service/game. Interactive-controller therefore separates media from story metadata.

Use **Load Story Pack** when the selected title says **Pack required**.

A current pack contains these top-level fields:

```json
{
  "catalogId": "example-title-id",
  "story": {},
  "translations": {},
  "subtitles": {}
}
```

The built-in story object uses normalized segment/moment/state data. A pack must match the exact catalog entry and exact media structure.

Developer starter file:

```text
story-packs/STORY-PACK-TEMPLATE.json
```

Do not guess timestamps. A visually plausible but incorrect Story Pack will create incorrect branches and state transitions.

## 14. Interactive Library categories

The catalog is grouped instead of being one long list:

- Netflix — Movies & Specials
- Netflix — Series & Episodes
- External — Interactive Films
- External — Interactive Series
- External — Interactive Experiences

External entries such as The Outbreak, That Moment When, #WarGames and Mosaic are currently integration targets. Their status remains **Adapter required** until their interaction models and verified story/media maps are implemented.

## 15. Checking for updates

At the top of the player there is a **GitHub** icon/button.

Click it to open:

**https://github.com/Mr-T3st/Interactive-controller**

Use the repository's **Releases** section to check for a newer Portable/Windows build.

## 16. Keyboard reference

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `←` | Seek 10 seconds back |
| `→` | Seek 10 seconds forward |
| `↑` | Previous story scene |
| `↓` | Next story scene |
| `U` / `Backspace` | Undo last decision |
| `1–9` | Select visible choice |
| `F` | Fullscreen |
| `R` | Restart |
| `S` | Toggle primary subtitle |
| `M` | Mute / unmute |
| `D` | Developer Inspector |

## 17. Troubleshooting

### The movie opens but does not play

The browser may not support the codec inside the container. Try an MP4/H.264/AAC copy that matches the interactive's expected master/internal video.

### The decisions appear at the wrong time

The media cut does not match the Story Pack. For Bandersnatch the expected master duration is approximately `05:12:14`.

### A title is visible but Open Movie is locked

Check its Library status. It probably needs a Story Pack or an engine adapter.

### The Windows EXE opens nothing

Extract the complete ZIP. The launcher needs the adjacent `index.html` and production files.

### GitHub Pages works but my movie is not uploaded

That is expected. The site hosts only the player. Media is selected from your device and remains local to the browser.
