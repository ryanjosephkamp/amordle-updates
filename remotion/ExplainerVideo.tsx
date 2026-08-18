import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { BoardFigure, CombatFigure, FigureStyles, figureSeconds } from "./FigurePlayer";

/*
 * "How Amordle plays" — the explainer that sits at the top of the blog post.
 *
 * Different job from UpdateVideo, which narrates what changed in a release.
 * This one has to teach the rules to somebody who has never opened the game, so
 * it shows real boards being marked rather than captions describing marking.
 *
 * The tile colours are the game's own oklch tokens copied verbatim from
 * src/app/tui-shell.css (the dark-scheme block), not approximations. A teaching
 * video whose greens are a different green than the product's is teaching the
 * wrong thing.
 *
 * Scored, unlike the update videos — this one is a product film. Every claim
 * is still on screen as text, so the music carries none of the meaning and
 * the video reads correctly with the sound off.
 */

export const explainerSchema = z.object({
  title: z.string(),
  closing: z.string(),
});

const INK = "#E4E9EA";
const MUTED = "#9DA8AB";
const BACKGROUND = "#0A0E12";
const SURFACE = "#141A1F";
const BORDER = "#4C575C";
const ACCENT = "#5FD9B4";

// Verbatim from tui-shell.css, dark scheme.
const CORRECT = "oklch(0.7 0.15 145)";
const PRESENT = "oklch(0.78 0.14 85)";
const ABSENT = "oklch(0.47 0.018 220)";

const FONT =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace";

type State = "correct" | "present" | "absent" | "empty";

const FILL: Record<State, string> = {
  correct: CORRECT,
  present: PRESENT,
  absent: ABSENT,
  empty: "transparent",
};

/** Ease in, hold, ease out — the app's surface-rise, slowed down. */
function useRise(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, mass: 0.6 },
  });
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [10, 0])}px)`,
  };
}

function Tile({
  letter,
  state,
  delay,
}: {
  letter: string;
  state: State;
  delay: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Tiles resolve one after another, the way they do when a guess is accepted.
  const turn = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, mass: 0.5 },
  });
  const resolved = state !== "empty" && turn > 0.5;
  return (
    <div
      style={{
        width: 74,
        height: 74,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${resolved ? FILL[state] : BORDER}`,
        background: resolved ? FILL[state] : "transparent",
        color: resolved ? "#0A0E12" : INK,
        fontSize: 36,
        fontWeight: 650,
        transform: `scaleY(${
          state === "empty"
            ? 1
            : Math.abs(Math.cos(Math.PI * Math.min(turn, 1))).toFixed(3)
        })`,
      }}
    >
      {letter.toUpperCase()}
    </div>
  );
}

function Row({
  word,
  states,
  delay = 0,
}: {
  word: string;
  states: State[];
  delay?: number;
}) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {word.split("").map((letter, index) => (
        <Tile
          key={`${index}:${letter}`}
          letter={letter}
          state={states[index] ?? "empty"}
          delay={delay + index * 6}
        />
      ))}
    </div>
  );
}

function Scene({
  heading,
  lines,
  children,
}: {
  heading: string;
  lines: string[];
  children?: React.ReactNode;
}) {
  const head = useRise(0);
  return (
    <AbsoluteFill style={{ padding: "56px 96px 64px", gap: 18 }}>
      <div style={{ ...head, display: "flex", gap: 18, alignItems: "baseline" }}>
        <span style={{ color: ACCENT, fontSize: 34 }}>&#10095;</span>
        <span style={{ fontSize: 42, fontWeight: 650, color: INK }}>{heading}</span>
      </div>
      <div style={{ ...head, height: 1, background: BORDER }} />
      {/*
        Fixed height, so the figure below always begins at the same y no matter
        how many caption lines a scene has. Left to size itself, a three-line
        caption let a tall figure centre itself into the text and overlap it.
      */}
      <div style={{ height: 168, flexShrink: 0 }}>
        {lines.map((line, index) => (
          <Caption key={line} text={line} delay={10 + index * 8} />
        ))}
      </div>
      {/*
        The figure takes the rest of the frame and centres itself in it. The
        text block sits above at a fixed height, so a scene with a nine-row
        COMBAT board and a scene with two tiles both look deliberate.
      */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}

function Caption({ text, delay }: { text: string; delay: number }) {
  const style = useRise(delay);
  return (
    <div style={{ ...style, color: MUTED, fontSize: 25, lineHeight: 1.7 }}>
      {text}
    </div>
  );
}

function Title({ title }: { title: string }) {
  const style = useRise(6);
  const sub = useRise(18);
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", padding: "0 96px", gap: 22 }}
    >
      <div
        style={{ ...style, display: "flex", gap: 20, alignItems: "baseline" }}
      >
        <span style={{ color: ACCENT, fontSize: 40 }}>&#10095;</span>
        <span style={{ fontSize: 68, fontWeight: 700, color: INK }}>
          {title}
        </span>
      </div>
      <div style={{ ...sub, height: 1, background: BORDER }} />
      <div style={{ ...sub, color: MUTED, fontSize: 28 }}>
        the Wordle&ndash;Hurdle hybrid that plays like online chess
      </div>
      <div style={{ ...sub, color: MUTED, fontSize: 22 }}>
        no ads &middot; no paywalls &middot; free forever
      </div>
    </AbsoluteFill>
  );
}

function Closing({ closing }: { closing: string }) {
  const style = useRise(6);
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", gap: 18 }}
    >
      <div style={{ ...style, color: INK, fontSize: 46, fontWeight: 650 }}>
        {closing}
      </div>
      <div style={{ ...style, color: MUTED, fontSize: 22 }}>
        amordle &middot; free forever
      </div>
    </AbsoluteFill>
  );
}

const FPS = 30;
const TITLE_FRAMES = 130;
const CLOSING_FRAMES = 110;
const LEAD_IN = 55; // heading and captions land before the board starts moving

/*
 * The gameplay scenes are as long as the gameplay takes.
 *
 * These used to be a flat 210 frames each, which was fine when a scene was one
 * static row of tiles. Now that OG, GO and COMBAT play the game's own figures,
 * a fixed length would either cut a solve off mid-word or sit on a finished
 * board. The figure data carries per-frame holds, so the run time is a fact to
 * read rather than a number to pick.
 *
 * OG is the GO sequence's first puzzle — one board, solved from nothing. GO
 * picks up where that leaves off, so the seeded rows carrying forward are the
 * whole point of the scene.
 */
const OG_FROM = 0;
const OG_TO = 19;
const GO_FROM = 19;
const GO_TO = 45;

const ogPlay = Math.ceil(figureSeconds("go", OG_FROM, OG_TO) * FPS);
const goPlay = Math.ceil(figureSeconds("go", GO_FROM, GO_TO) * FPS);
const combatPlay = Math.ceil(figureSeconds("combat") * FPS);

const OG_FRAMES = LEAD_IN + ogPlay;
const GO_FRAMES = LEAD_IN + goPlay;
const LENGTH_FRAMES = 170;
const COMBAT_FRAMES = LEAD_IN + combatPlay;
const RANKED_FRAMES = 200;

export const EXPLAINER_FRAMES =
  TITLE_FRAMES + OG_FRAMES + GO_FRAMES + LENGTH_FRAMES + COMBAT_FRAMES + RANKED_FRAMES + CLOSING_FRAMES;

export const ExplainerVideo: React.FC<z.infer<typeof explainerSchema>> = ({
  title,
  closing,
}) => {
  let at = TITLE_FRAMES;
  const next = (length: number) => {
    const from = at;
    at += length;
    return from;
  };
  return (
    <AbsoluteFill style={{ background: BACKGROUND, fontFamily: FONT }}>
      <FigureStyles />
      {/*
        Synthesised by scripts/make-music.mjs, at this composition's length (the video runs 62.5s):

          node scripts/make-music.mjs --style=siege-dark --switch=siege-drums \
            --keys=none --seconds=63 --at=31 --level=0.35 \
            public/explainer-music.wav

        Written rather than sourced: a stock loop would carry a licence to honour
        on a public page and would not know where these scenes fall. It sits
        under captions the viewer is reading, so it is mixed low.

        Two styles joined by a bar-aligned crossfade at 22.3s, with the melodic
        line switched off entirely — `--keys=none`. The owner auditioned that
        against five other key placements and chose silence: a figure that is
        fine for twenty seconds wears thin over forty, and the drums carry it.
        Every option came from this same script, so what was auditioned is what
        renders here, with no second implementation to drift.

        The update videos stay silent — there the captions are the whole message.
        This one is a product film, which is a different job.
      */}
      <Audio src={staticFile("explainer-music.wav")} volume={0.55} />

      <Sequence durationInFrames={TITLE_FRAMES}>
        <Title title={title} />
      </Sequence>

      {/*
        OG: an actual puzzle being solved, not a single marked row.

        This scene used to be one static CRANE row with a legend beside it,
        which described the marking rule without ever showing the game. It now
        plays the game's own figure — guesses landing one after another until
        the board is solved — because a marketing video should show the product.
      */}
      <Sequence from={next(OG_FRAMES)} durationInFrames={OG_FRAMES}>
        <Scene
          heading="OG"
          lines={[
            "Wordle, upgraded. Green is the right letter",
            "in the right place; amber is the right letter",
            "somewhere else.",
          ]}
        >
          <Sequence from={LEAD_IN} layout="none">
            <BoardFigure name="go" from={OG_FROM} to={OG_TO} scale={1.25} />
          </Sequence>
        </Scene>
      </Sequence>

      {/*
        GO: the chain, picking up from the puzzle OG just solved, so the seeded
        rows carrying forward are visible rather than described.
      */}
      <Sequence from={next(GO_FRAMES)} durationInFrames={GO_FRAMES}>
        <Scene
          heading="GO"
          lines={[
            "Hurdle, upgraded. A chain of puzzles where",
            "every answer you solve carries forward as",
            "evidence in the next one.",
          ]}
        >
          <Sequence from={LEAD_IN} layout="none">
            <BoardFigure name="go" from={GO_FROM} to={GO_TO} scale={1.15} />
          </Sequence>
        </Scene>
      </Sequence>

      {/* The customization nobody else offers. */}
      <Sequence from={next(LENGTH_FRAMES)} durationInFrames={LENGTH_FRAMES}>
        <Scene
          heading="Any word, any length"
          lines={[
            "2 to 35 letters, three difficulties,",
            "optional Hard Mode. Nothing is off-limits.",
          ]}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <Row word="at" states={["correct", "correct"]} delay={36} />
            <div style={{ color: MUTED, fontSize: 24, padding: "0 14px 22px" }}>
              &hellip;
            </div>
            <Row
              word="quiz"
              states={["correct", "present", "absent", "correct"]}
              delay={56}
            />
          </div>
        </Scene>
      </Sequence>

      {/*
        COMBAT: the figure from the Help page, which is the only thing here that
        actually shows two people playing — a keyboard each side, one board
        between them, turns alternating, and each player's own keys lighting as
        they type. The previous version was two labelled rows of tiles, which
        demonstrated none of that.
      */}
      <Sequence from={next(COMBAT_FRAMES)} durationInFrames={COMBAT_FRAMES}>
        <Scene
          heading="COMBAT"
          lines={[
            "Play other people. You share one board and",
            "take turns, and you both read the same",
            "evidence as it appears.",
          ]}
        >
          <Sequence from={LEAD_IN} layout="none">
            <CombatFigure scale={1.05} />
          </Sequence>
        </Scene>
      </Sequence>

      {/* Ranked, which is the Lichess part. */}
      <Sequence from={next(RANKED_FRAMES)} durationInFrames={RANKED_FRAMES}>
        <Scene
          heading="Ranked"
          lines={[
            "Win rated matches and your Elo moves.",
            "Forty separate pools, so like plays like.",
          ]}
        >
          <RatingStrip />
        </Scene>
      </Sequence>

      <Sequence from={at} durationInFrames={CLOSING_FRAMES}>
        <Closing closing={closing} />
      </Sequence>
    </AbsoluteFill>
  );
};

function Turn({
  label,
  word,
  states,
  delay,
}: {
  label: string;
  word: string;
  states: State[];
  delay: number;
}) {
  const style = useRise(delay - 8);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <span style={{ ...style, color: MUTED, fontSize: 21, width: 66 }}>
        {label}
      </span>
      <Row word={word} states={states} delay={delay} />
    </div>
  );
}

function RatingStrip() {
  const style = useRise(40);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const climb = spring({
    frame: frame - 60,
    fps,
    config: { damping: 200, mass: 0.8 },
  });
  const rating = Math.round(interpolate(climb, [0, 1], [1200, 1284]));
  return (
    <div
      style={{
        ...style,
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        padding: 26,
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}
    >
      <span style={{ color: MUTED, fontSize: 22 }}>your rating</span>
      <span style={{ color: INK, fontSize: 40, fontWeight: 650 }}>
        {rating}
      </span>
      <span style={{ color: ACCENT, fontSize: 24 }}>
        {climb > 0.05 ? `+${rating - 1200}` : ""}
      </span>
      <span style={{ color: MUTED, fontSize: 20, marginLeft: "auto" }}>
        ranked practice &middot; OG &middot; 5 letters
      </span>
    </div>
  );
}

function Legend() {
  const style = useRise(80);
  const item = (fill: string, glyph: string, text: string) => (
    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 18,
          height: 18,
          background: fill,
          display: "inline-block",
        }}
      />
      <span style={{ color: MUTED, fontSize: 20 }}>
        {glyph} {text}
      </span>
    </span>
  );
  return (
    <div
      style={{
        ...style,
        display: "flex",
        gap: 26,
        paddingTop: 6,
        flexWrap: "wrap",
      }}
    >
      {item(CORRECT, "✓", "right letter, right place")}
      {item(PRESENT, "~", "right letter, wrong place")}
      {item(ABSENT, "×", "not in the word")}
    </div>
  );
}
