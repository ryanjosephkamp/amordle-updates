import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import figures from "./figures.json";
import { figureCss } from "./figures-css";

/*
 * Plays the game's own Help-page figures inside the video.
 *
 * None of this is re-drawn or re-timed by hand. The frames come from
 * `figures.json`, exported by scripts/export-help-figures.mjs in the game
 * repository, where every tile colour and keyboard state is computed by the
 * game's real `scoreGuess` and `deriveKeyboardEvidence`. The styling comes from
 * `figures.css`, exported by scripts/export-help-figure-css.mjs from the game's
 * own board-surface.css and help-figures.css with its design tokens resolved.
 *
 * That matters for a marketing video more than anywhere else: the thing on
 * screen is the product, not an artist's impression of it. Re-run either
 * exporter and this follows.
 *
 * The frames carry per-frame `hold` values in milliseconds, so a frame is
 * chosen by walking those holds rather than by dividing evenly — the pacing is
 * the pacing the Help page uses.
 */

type Tile = { letter: string; state: string; revealed?: boolean };
type Row = { tiles: Tile[]; meta?: string; seed?: boolean; draft?: boolean };
type Frame = {
  rows?: Row[];
  note?: string;
  hold?: number;
  seat?: 0 | 1;
  evidence?: Record<string, string>;
  pressed?: string;
};

const EVIDENCE_CLASS: Record<string, string> = {
  correct: "is-correct",
  present: "is-present",
  absent: "is-absent",
  removed: "is-removed",
  unknown: "is-unknown",
  draft: "",
};
const EVIDENCE_MARK: Record<string, string> = {
  correct: "✓",
  present: "~",
  absent: "×",
  removed: "−",
};
const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const COMBAT_NAMES = ["Nova", "Rook"];

/*
 * The exported stylesheet, plus one override that exists only in the video.
 *
 * The game marks a pressed key with an accent border and a 2px inset ring. That
 * is right on the Help page, where a key is ~44px and the reader is a foot from
 * a laptop screen — and it is invisible in a 1280x720 video where the same key
 * is ~30px and may be watched on a phone. Since the whole point of the COMBAT
 * scene is showing two people typing, the press has to survive being zoomed out.
 *
 * So the video fills the key with the accent, inverts its ink, adds a glow, and
 * lifts it slightly. Deliberately NOT changed in figures.css itself: the Help
 * page and the copy of this figure embedded in the blog post both keep the
 * game's own restrained treatment, because there they are correct.
 */
const PRESSED_KEY_OVERRIDE = `
.amordle-figure :is(button, span).key.is-pressed {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--surface);
  box-shadow:
    0 0 0 3px color-mix(in oklch, var(--accent) 55%, transparent),
    0 0 22px color-mix(in oklch, var(--accent) 65%, transparent);
  transform: scale(1.14);
  z-index: 1;
}
.amordle-figure :is(button, span).key.is-pressed .key-evidence {
  color: var(--surface);
}
`;

/** The stylesheet, injected once so the exported rules apply inside the video. */
export const FigureStyles: React.FC = () => (
  <style dangerouslySetInnerHTML={{ __html: figureCss + PRESSED_KEY_OVERRIDE }} />
);

function Board({ rows }: { rows: Row[] }) {
  return (
    <div className="help-board">
      {rows.map((row, index) => (
        <div className="help-board-entry" key={index}>
          <span className={row.seed ? "help-row-meta is-seed" : "help-row-meta"}>
            {row.meta ?? ""}
          </span>
          <div className={row.draft ? "board-row is-draft" : "board-row"}>
            {row.tiles.map((tile, position) => {
              const classes = ["tile", EVIDENCE_CLASS[tile.state] ?? "", tile.revealed ? "is-revealed" : ""]
                .filter(Boolean)
                .join(" ");
              const mark = EVIDENCE_MARK[tile.state];
              return (
                <div className={classes} key={position}>
                  {tile.letter ? (
                    <span className="tile-letter">{tile.letter.toUpperCase()}</span>
                  ) : null}
                  {tile.letter && mark ? <span className="tile-evidence">{mark}</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Keyboard({
  evidence,
  pressed,
}: {
  evidence: Record<string, string>;
  pressed?: string | undefined;
}) {
  return (
    <div className="keyboard">
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div className="keyboard-row" key={row}>
          {rowIndex === 2 ? (
            <span
              className={
                pressed === "submit" ? "key is-wide is-unknown is-pressed" : "key is-wide is-unknown"
              }
            >
              SUBMIT
            </span>
          ) : null}
          {[...row].map((letter) => {
            const state = evidence[letter] ?? "unknown";
            const classes = ["key", EVIDENCE_CLASS[state] || "is-unknown"];
            if (pressed === letter) classes.push("is-pressed");
            const mark = state === "absent" || state === "removed" ? EVIDENCE_MARK[state] : null;
            return (
              <span className={classes.join(" ")} key={letter}>
                {letter.toUpperCase()}
                {mark ? <span className="key-evidence">{mark}</span> : null}
              </span>
            );
          })}
          {rowIndex === 2 ? <span className="key is-wide is-unknown">DELETE</span> : null}
        </div>
      ))}
    </div>
  );
}

/** Total run time of a frame list, in seconds. */
export function figureSeconds(name: keyof typeof figures.figures, from = 0, to?: number): number {
  const all = figures.figures[name] as Frame[];
  const slice = all.slice(from, to);
  return slice.reduce((sum, frame) => sum + (frame.hold ?? 700), 0) / 1000;
}

/** Picks the frame whose hold window contains the current time. */
function frameAt(list: Frame[], seconds: number): Frame {
  let elapsed = 0;
  for (const frame of list) {
    elapsed += (frame.hold ?? 700) / 1000;
    if (seconds < elapsed) return frame;
  }
  return list[list.length - 1]!;
}

export const BoardFigure: React.FC<{
  name: "go" | "combat";
  from?: number;
  to?: number;
  scale?: number;
}> = ({ name, from = 0, to, scale = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const list = (figures.figures[name] as Frame[]).slice(from, to);
  const current = frameAt(list, frame / fps);

  return (
    <div
      /*
       * All three classes, exactly as the Help page uses them. `help-figure`
       * is not decoration: it carries --tile-size, and it declares the
       * container that the wide-versus-stacked COMBAT layout queries. Without
       * it the tiles fall back to base sizing and the container query never
       * matches, so the figure renders in a layout the game never shows.
       */
      className="amordle-figure help-example help-figure"
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        overflow: "visible",
        width: 832,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      <Board rows={current.rows ?? []} />
    </div>
  );
};

/** The COMBAT figure: a keyboard each side, one shared board between them. */
export const CombatFigure: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const list = figures.figures.combat as Frame[];
  const current = frameAt(list, frame / fps);
  const evidence = current.evidence ?? {};

  return (
    <div
      /*
       * All three classes, exactly as the Help page uses them. `help-figure`
       * is not decoration: it carries --tile-size, and it declares the
       * container that the wide-versus-stacked COMBAT layout queries. Without
       * it the tiles fall back to base sizing and the container query never
       * matches, so the figure renders in a layout the game never shows.
       */
      className="amordle-figure help-example help-figure"
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        overflow: "visible",
        width: 832,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      <div className="help-combat">
        {[0, 1].map((seat) => {
          const active = current.seat === seat;
          const side = (
            <div
              className={active ? "help-combat-side is-active" : "help-combat-side"}
              key={seat}
              {...(seat === 1 ? { "data-accent": "violet" } : {})}
            >
              <div className="help-combat-name">{COMBAT_NAMES[seat]}</div>
              {/* `pressed` only to the side on move: the opponent's keyboard has
                  to stay still while you type, or neither belongs to anyone. */}
              <Keyboard evidence={evidence} pressed={active ? current.pressed : undefined} />
            </div>
          );
          if (seat === 1) return side;
          return (
            <React.Fragment key="left">
              {side}
              <div
                className="help-combat-board"
                {...(current.seat === 1 ? { "data-accent": "violet" } : {})}
              >
                <Board rows={current.rows ?? []} />
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/** The caption the figure itself is showing, so the video can echo it. */
export function figureNote(name: "go" | "combat", seconds: number, from = 0, to?: number): string {
  const list = (figures.figures[name] as Frame[]).slice(from, to);
  return frameAt(list, seconds).note ?? "";
}
