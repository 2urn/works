# works

Published artworks by Dimitry Saïd Chamy. `https://works.chamy.xyz/`

A custom domain makes this a project site served at the DOMAIN ROOT, so a work
sits at `works.chamy.xyz/<slug>/` and not under a `/works/` path.

**Nothing is developed here.** This repo holds built artefacts only — one
self-contained file per work, emitted by a release script in the private repo where
that work is actually made. There are no sources here, no pools, no notes, no
research, and no history of how anything was decided.

That split is the point, and it is the same line the work itself draws: **the
instrument is held, the work is given.** How a piece is made stays private; what it
is, is public.

## Structure

```
index.html                 the index of works
_____American_____/        a work; the slug is its title, underscores and all
  index.html               the work, as a viewer meets it
  release.json             where it came from, and when
.publish/manifest.json     every release, appended
```

## Getting something in

Never by hand. Each source repo carries its own `Modules/release.py`, which:

1. runs that repo's checks and stops if they fail,
2. builds the single self-contained file,
3. **refuses** if the built file contains anything on that work's denylist —
   material that is deliberately not public, and which could otherwise ride out
   inside a build without anyone noticing,
4. writes provenance: source repo, commit, date, and the work's own fingerprint,
5. commits here.

A release that cannot state where it came from does not happen. A release that
trips the denylist does not happen either, and says which line stopped it.

## What is here

Nothing yet.

## `.nojekyll` is load-bearing

GitHub Pages runs Jekyll by default, and Jekyll **silently drops every file and folder
whose name begins with an underscore** — `_posts`, `_layouts` and so on are its own.
A work slugged `_____American_____` is exactly that shape, so the first release built
without error and served a 404. `.nojekyll` turns the processing off and the files are
served as they are. Do not delete it.
