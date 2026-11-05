# 🧌 The Troll Simulator

A single-page browser game styled like a TikTok LIVE. **You are the creator.** Guests auto-join and
fill the guest boxes, most are lovely, some act nice for a while and then team up and start yelling
censored obscenities (`#@$%&!`). Spot them, mute their mic, remove or block them, and keep your
community health up.

## How to play
- Tap **Go LIVE**. Guests join and take the boxes over your camera.
- Tap a box or name to open the profile card: account age, followers, reports, who they joined
  through, and whether they shared the LIVE link. Actions: **Mute mic, Remove, Block, Thank**.
- Tap the 🎙️ in a box to mute that guest instantly.
  Muted guests can switch their mic back on at random and start talking again, so remove or block repeat offenders.
- Watch for 🔗 **link sharers**. Friends join "via @sharer". Bad groups wait until everyone is
  seated, then all yell at once. **Block** the sharer to cancel pending invites (raid prevented).
- Yelling drains 🛡️ community health. At 0, your LIVE is ended.
- Levels last 50 seconds: more boxes, faster joins, bigger raids, trojan links.

## Settings (⚙️)
- **Difficulty:** Easy, Medium or Hard (join pace, how long sleeper trolls stay nice, health drain).
- Toggle muted guests turning their mic back on, game sound effects, soundbytes and volume.
- Upload a soundbytes CSV and mp3 files, download a CSV template, or clear them.

## Soundbytes (CSV)
Link recordings to what guests say. One row per line, three columns:

```csv
difficulty,Text They Say,mp3file
all,hi everyone! 👋,hi-everyone.mp3
easy,love this live,love-this-live-soft.mp3
hard,#@$%&!,bleep-1.mp3
hard,#@$%&!,bleep-2.mp3
```

- `difficulty`: `easy`, `medium`, `hard` or `all`.
- `Text They Say`: the exact line a guest says (case-insensitive). Repeat a line with several mp3
  files and one is picked at random. Yelling guests say the censored text such as `#@$%&!`.
- `mp3file`: a file name. It is matched against mp3 files you upload in Settings, otherwise it is
  loaded from the **MP3 folder or URL** setting (default `sounds/`). Leave blank for silent lines.
- Optional 4th column `type` (`nice`, `eager`, `curse`, `chat`) adds a **new** line to the game's
  pool for that difficulty. Without it, new lines are treated as `nice`.
- `soundbytes.csv` in the site root loads automatically. A CSV uploaded in Settings is remembered
  on that device, but uploaded mp3 files must be re-added each visit.

`soundbytes.csv` in this repo lists every built-in line with an empty mp3 column. Fill it in and
drop the mp3 files into `sounds/`.

## Features
- TikTok-LIVE style UI with host pill, viewer count, ambient chat, gift banners and floating hearts
- Editable profile: name, username, emoji photo, photo background or your own upload
- High score saved on the device, share sheet and a downloadable 1080x1920 score card for TikTok
- No build step, no dependencies: one `index.html`

## Run locally
```bash
git clone https://github.com/<you>/troll-simulator.git
cd troll-simulator
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy
Push to `main`. The included GitHub Actions workflow publishes to **GitHub Pages**
(Settings > Pages > Source: GitHub Actions).

## Accounts and login (not wired yet)
`index.html` has an `AUTH` object with `googleClientId` and `tiktokClientKey` hooks. Real sign-in
needs a small backend to verify Google credentials and to exchange TikTok Login Kit codes. A shared
leaderboard needs the same backend (for example Supabase or Firebase).

## Roadmap
- Real Google and TikTok login, global leaderboard
- Mic/camera indicators, more troll behaviours, daily challenges

## License
MIT
