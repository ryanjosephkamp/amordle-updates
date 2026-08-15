# Amordle updates

The changelog for [Amordle](https://amordle.vercel.app), published with GitHub
Pages at <https://ryanjosephkamp.github.io/amordle-updates/>.

This repository is public. The game's own repository is not, which is the reason
the changelog lives here rather than there.

## What goes in

One post per **significant** update. Not every commit, and not every fix. If a
change is invisible to a player and does not alter how anything is calculated,
it probably does not warrant a post — use judgment, and prefer fewer, fuller
posts to a running log.

A post says what changed and why, in plain words, and is black and white about
it. If something was broken, it says so and says for how long. It is written in
first person in the sense that the project is one person's, while avoiding "I"
and "my".

## What goes in a post

- A date and, if there is a video, the `Video` tag.
- A one-line intro under the title.
- A section per change, most significant first.
- Anything uncomfortable, stated rather than omitted. A changelog that only
  reports wins is an advertisement.

## Videos

When an update changes something you can see, the post embeds a **15–30 second**
video. It is offered as an alternative to reading the post, so it has to stand
on its own: every claim it makes is on screen as text, and it works muted.

Constraints, which are not negotiable:

- Any music must be light and never overwhelming.
- No loud, jarring, or startling sound effects.
- Nothing that flashes or snaps. Everything eases.

The current videos carry **no audio track at all**. That is deliberate rather
than unfinished: the captions carry the entire message, so silence costs the
viewer nothing, and it is more honest than dropping in a stock loop chosen at
random. Adding a score later is a props change, not a rewrite.

### Making one

The composition is generic — the props are the script. A new video means a new
props object in `remotion/Root.tsx`, not a new composition.

```bash
npm install
npm run studio
```

To render the video and its poster frame:

```bash
npx remotion render remotion/index.ts update media/<slug>.mp4
```

```bash
npx remotion still remotion/index.ts update media/<slug>-poster.png --frame=40
```

Figures are **drawn, not screen-recorded**. A recording of a page that will
change next month dates the video the moment it ships; a diagram of what the
change actually was stays true.

## Publishing

`.github/workflows/pages.yml` publishes the repository root on every push to
`main`. There is no build step for the pages themselves — they are hand-written
HTML and one stylesheet, because a changelog that needs a toolchain to publish a
paragraph is a changelog that stops getting written.

The stylesheet's tokens are lifted from the game's own shell rather than
approximated, so this site and the game are the same object seen from two
places.
