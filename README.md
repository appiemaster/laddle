# Laddle

A daily word-ladder game for the browser, based on the Roblox game "Change a Letter":
change one letter at a time to get from the start word to the target. Every step must be a
real 4-letter word, and the goal is the shortest path.

- **Daily**: one puzzle per calendar day in your own timezone (changes at local midnight),
  the same for everyone on that date. Played once.
- **Practice**: unlimited random puzzles (Easy / Normal / Hard), with Undo and Hint.
- Streak, stats and a spoiler-free share result. Everything is stored in the browser.
- Installable on phones (PWA) and playable offline.

## Commands

```bash
npm install
npm run dev        # local dev server
npm test           # logic tests
npm run build      # static site in dist/ (host it anywhere)
```

Data scripts (only needed when something changes):

```bash
npm run words      # copy the screened list from ../word-ladder (Roblox repo) into src/game/words4.ts
npm run daily      # extend the daily schedule; already scheduled days are kept
npm run icons      # redraw the app icons in public/
```

After a word-list change, run `npm run words` then `npm run daily`. Days that are already
scheduled stay the same unless a word on them was removed.

## Where things are

- `src/game/`: rules, word graph, puzzle picking, rounds, streak, hints, daily, share
  (ported from the Roblox Luau code).
- `src/app.ts`, `src/ui/`, `src/style.css`: the screen.
- `scripts/`: word-list import, daily schedule, icons.

## Credits

Words: the ENABLE word list (public domain) and 12dicts by Alan Beale (public domain;
acknowledgment requested). Screened with LDNOOBW (CC BY 4.0), none of which ships.
