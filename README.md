# Scientific Research in the Age of Gen AI

An interactive reveal.js talk for Columbia Research (Office of Research Compliance and Training), with live audience voting.

- **Deck:** https://tiroger.github.io/genai-research-integrity/
- **Audience page:** https://tiroger.github.io/genai-research-integrity/v/#SESSION (the QR code on the slides points here)

## Presenting

| Key | What it does |
| --- | --- |
| → / Space | Next slide or build |
| S | Speaker view with notes and timer |
| F | Full screen |
| Esc | Slide overview |
| N | Start a fresh live-voting session (new QR code, empty votes) |

Each game slide also has **Reveal** and **Reset** buttons. Pressing → on a game slide reveals the answers too.

## Live voting

Voting uses a free Firebase Realtime Database. If `js/config.js` has no Firebase config, or the connection fails, the deck runs in **click mode**: everything still works on the presenter's screen, and the QR codes are hidden.

How it works:

1. The deck makes a short session code (kept in the browser, so reloading keeps it) and claims it as presenter.
2. People scan the QR code, or open the link from chat. Their page follows the deck: it shows the current game and goes back to "Watch the screen" between games.
3. Votes are anonymous (Firebase anonymous sign-in). Each person gets one vote per round and can change it until the reveal.
4. On reveal, each phone shows the answer and that person's score.

Rounds: warm-up poll (slide 2), spot the AI fake (slide 26), plates/tumors/blots (slide 28), real vs generated blot (slide 32).

### Setup (one time)

1. Create a project in the [Firebase console](https://console.firebase.google.com) (Analytics can be off).
2. **Build → Realtime Database → Create database** (US location, locked mode).
3. **Build → Authentication → Sign-in method → Anonymous → Enable.**
4. **Realtime Database → Rules**: paste the contents of `database.rules.json` and publish.
5. **Project settings → Your apps → Web app**: copy the `firebaseConfig` object into `js/config.js`.

The Firebase web config is designed to be public. The rules only let each person write their own vote, and only the presenter's browser can change the round.

**Before the talk:** open the deck once on the computer you'll present from, so it claims its session. Press **N** after rehearsing to start clean.

## Offline backup

```bash
python3 tools/build_offline.py   # -> dist/deck-offline.html
```

That writes one self-contained file (no internet needed, click mode only).

## Files

```
index.html            the deck
v/index.html          audience voting page
css/deck.css          styles (Columbia palette, shared with the workshop deck)
js/deck.js            charts, games, live wiring, magnifier, slider
js/rounds.js          round definitions shared by deck and audience page
js/live.js            Firebase wrapper
js/config.js          Firebase config + site URL
database.rules.json   Realtime Database security rules
assets/               images (from the Integrity Week deck)
lib/                  reveal.js 5.2.1, notes plugin, qrcode-generator
```
