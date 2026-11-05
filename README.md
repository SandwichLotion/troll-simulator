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

## Settings (⚙️) and your data
- **Difficulty:** Easy, Medium or Hard. Pick it on the start screen or in Settings (between LIVEs).
  It changes join pace, how long sleeper trolls stay nice, how many guests are trolls and how fast
  community health drains. Settings are saved on this device.
- **High scores:** saved in your browser's local storage, a separate top 30 per difficulty. Open the
  🏆 list from the start screen, end screen or footer. **Export save file** writes a
  `troll-simulator-save.json` to your computer (scores, profile, settings, username list) and
  **Import save file** restores it. Clearing site data erases local scores, so export a backup.
- **Usernames:** guests take names from your lists. Add a TikTok `@username` in the footer (or a
  profile link) and it joins the guest list as a friendly guest, with a link to the real profile.
  Upload a `usernames.csv` (`username,type` where type is `good`, `bad` or `any`) in the 👥 Usernames
  sheet and choose how often guests use custom names.
- Toggles for muted guests turning their mic back on, game sound effects, soundbytes and volume.

## Soundbytes (CSV + grid)
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
- `mp3file`: a file name. It is matched against mp3 files you upload, otherwise it is loaded from the
  **MP3 folder or URL** setting (default `sounds/`). Leave blank for silent lines.
- Optional 4th column `type` (`nice`, `eager`, `curse`, `chat`) adds a **new** line to the game's
  pool for that difficulty. Without it, new lines are treated as `nice`.
- `soundbytes.csv` in the site root loads automatically. A CSV loaded in Settings is remembered on
  that device, but uploaded mp3 files must be re-added each visit.

**Grid:** once a CSV is loaded, the 🎚️ Soundbyte grid lists every line with a drop box for its mp3.
Drag mp3 files anywhere on the grid (matched by file name), or drop one on a specific line's box to
link it to that line, or tap a box to choose a file. ▶ previews a clip and ✕ unlinks it. Clips over
the size or length limit are rejected with a message. "Download this sheet as CSV" saves your links.

**Clip limits** come from a text file, `config.txt` in the site root (or load one in Settings):

```
max_clip_kb=1024
max_clip_seconds=10
```

## Accessibility
- Guest boxes and their mic buttons are real buttons: Tab to a box, Enter or Space opens the profile, and the 🎙️ mutes. Focus stays on the box when the game redraws.
- Settings, scores, names and profile are proper dialogs: focus moves in, the page behind is inert, Escape closes, and focus returns to where you were.
- Joins, link shares, yelling and gift banners are announced by screen readers. Ambient chatter is not.
- ❚❚ **Pause** stops the clock. **Relaxed mode** (Settings) slows joins and health loss and stops good guests leaving.
- Reduced-motion is respected, touch targets are 44px, and text colours meet WCAG AA contrast.
- Switch layouts (grid, large, list) with the layout button.

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

## Sign in with TikTok
The game uses TikTok **Login Kit** (OAuth 2.0). The browser sends the player to TikTok, TikTok sends
them back with a one-time code, and a small server in `worker/` swaps the code for the player's
TikTok display name and avatar. The server keeps your client secret and returns only a signed
session token. TikTok's own access and refresh tokens are never sent to the browser or stored.

**Set it up (about 15 minutes):**
1. Host the game over **HTTPS**, for example GitHub Pages (`https://<you>.github.io/troll-simulator/`).
2. In the [TikTok developer portal](https://developers.tiktok.com), create an app and add **Login Kit**.
   Request the `user.info.basic` scope and register the game's exact URL (with the trailing slash) as
   a **Web redirect URI**. Extra scopes need TikTok's approval, and the app must pass TikTok's app
   review before people outside your test accounts can sign in.
3. Deploy the server (free Cloudflare account):
   ```bash
   cd worker
   # edit wrangler.toml: ALLOWED_ORIGIN, REDIRECT_URI, TIKTOK_CLIENT_KEY
   npx wrangler login
   npx wrangler secret put TIKTOK_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET      # any long random string
   npx wrangler deploy
   ```
4. In `index.html`, fill in `AUTH.tiktokClientKey` (public) and `AUTH.apiBase` (the worker URL), commit and push.
5. Check it: `cd worker && npm test` runs the server tests, and `https://<worker>/health` should return `{"ok":true}`.

What the player sees: **More > Account > Continue with TikTok**. After approving on TikTok they come back
signed in, and the host name defaults to their TikTok display name if they hadn't set their own.
Sessions last 30 days, and the game re-checks them when it opens. High scores are still stored on the
device. A shared leaderboard would be the next feature on top of this sign-in.

Google sign-in is still a placeholder (`AUTH.googleClientId` and `AUTH.google()`).

## Roadmap
- Google login, global leaderboard (scores tied to the TikTok sign-in)
- Mic/camera indicators, more troll behaviours, daily challenges

## License
MIT
