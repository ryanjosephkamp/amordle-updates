import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { z } from 'zod';

/*
 * The product video for a changelog post.
 *
 * Two constraints shaped this more than anything aesthetic:
 *
 * 1. It has to stand on its own. It is offered as an alternative to reading the
 *    post, so every claim it makes is on screen as text. Nothing is carried by
 *    voiceover, and nothing needs sound to be understood — which also means it
 *    works muted, which is how most of them will be watched.
 *
 * 2. It has to be quiet. No sound effects, no stings, no motion that snaps.
 *    Everything eases, nothing flashes, and the palette is the game's own.
 *
 * There is deliberately no audio track. A "light and not overwhelming" score is
 * a real constraint and the honest way to meet it is silence rather than a
 * stock loop chosen at random — the captions carry the whole message, so an
 * absent track costs the viewer nothing. Adding one later is a props change.
 */

const beatSchema = z.object({
  heading: z.string(),
  lines: z.array(z.string()),
  figure: z.enum(['equation', 'pools', 'links', 'share']),
});

export const updateVideoSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  beats: z.array(beatSchema),
  closing: z.string(),
});

type Beat = z.infer<typeof beatSchema>;

// The game's dark scheme, converted from its oklch tokens.
const INK = '#E4E9EA';
const MUTED = '#9DA8AB';
const BACKGROUND = '#0A0E12';
const SURFACE = '#141A1F';
const BORDER = '#4C575C';
const ACCENT = '#5FD9B4';

const FONT =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace";

const TITLE_FRAMES = 100;
const BEAT_FRAMES = 130;
const CLOSING_FRAMES = 100;

/** Fade and rise in, hold, fade out — the app's own surface-rise, slowed down. */
function useEnter(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, mass: 0.6 },
  });
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [12, 0])}px)`,
  };
}

function Rule({ width = '100%' }: { width?: string | number }) {
  return <div style={{ width, height: 1, background: BORDER }} />;
}

function Prompt() {
  return <span style={{ color: ACCENT }}>❯</span>;
}

function TitleCard({ eyebrow, title }: { eyebrow: string; title: string }) {
  const eyebrowStyle = useEnter(0);
  const titleStyle = useEnter(10);
  const ruleStyle = useEnter(18);
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        padding: '0 96px',
        gap: 20,
      }}
    >
      <div
        style={{
          ...eyebrowStyle,
          color: MUTED,
          fontSize: 20,
          letterSpacing: '0.14em',
        }}
      >
        {eyebrow}
      </div>
      <div style={{ ...titleStyle, display: 'flex', gap: 24, alignItems: 'baseline' }}>
        <Prompt />
        <span style={{ fontSize: 62, fontWeight: 650, color: INK }}>{title}</span>
      </div>
      <div style={ruleStyle}>
        <Rule />
      </div>
      <div style={{ ...ruleStyle, color: MUTED, fontSize: 22 }}>amordle · updates</div>
    </AbsoluteFill>
  );
}

/*
 * The figures are drawn, not screen-recorded. A recording of a page that will
 * change next month dates the video the moment it ships; a diagram of what the
 * change *was* stays true.
 */
function Figure({ kind }: { kind: Beat['figure'] }) {
  const style = useEnter(24);
  const box: React.CSSProperties = {
    ...style,
    border: `1px solid ${BORDER}`,
    background: SURFACE,
    padding: 28,
    color: MUTED,
    fontSize: 22,
    lineHeight: 1.9,
  };

  if (kind === 'equation') {
    return (
      <div style={box}>
        <div>
          <span style={{ color: MUTED }}>expected </span>
          <span style={{ color: INK }}>E = 1 / (1 + 10 ^ ((opponent − you) / 400))</span>
        </div>
        <div>
          <span style={{ color: MUTED }}>change&nbsp;&nbsp; </span>
          <span style={{ color: INK }}>Δ = round(K × (S − E))</span>
        </div>
        <div style={{ color: ACCENT, fontSize: 19 }}>K = 40 provisional · 24 after ten games</div>
      </div>
    );
  }

  if (kind === 'pools') {
    const clocks = ['untimed', '1m', '3m', '5m', '10m', '20m', '45m', '1d', '3d', '7d'];
    return (
      <div style={{ ...box, padding: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {clocks.map((clock) => (
            <span
              key={clock}
              style={{
                border: `1px solid ${BORDER}`,
                padding: '4px 12px',
                fontSize: 19,
                color: INK,
              }}
            >
              {clock}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 14, color: ACCENT, fontSize: 19 }}>
          × OG / GO × standard / hard = 40 pools
        </div>
      </div>
    );
  }

  if (kind === 'links') {
    return (
      <div style={{ ...box, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {['REPORT A BUG', 'SECURITY', 'FEATURE', 'REPOSITORY', 'THE OPENLIST'].map((label) => (
          <span
            key={label}
            style={{
              border: `1px solid ${BORDER}`,
              padding: '8px 16px',
              fontSize: 19,
              color: INK,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ color: INK, fontSize: 20 }}>amordle.vercel.app/players/f08161d7…</span>
      <span
        style={{
          border: `1px solid ${ACCENT}`,
          color: ACCENT,
          padding: '8px 16px',
          fontSize: 19,
        }}
      >
        COPY LINK
      </span>
    </div>
  );
}

function BeatCard({ beat, index, total }: { beat: Beat; index: number; total: number }) {
  const headingStyle = useEnter(0);
  const lineDelay = 12;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: '0 96px', gap: 22 }}>
      <div style={{ ...headingStyle, display: 'flex', gap: 20, alignItems: 'baseline' }}>
        <Prompt />
        <span style={{ fontSize: 44, fontWeight: 650, color: INK }}>{beat.heading}</span>
      </div>
      <Rule />
      <div>
        {beat.lines.map((line, lineIndex) => (
          <Line key={line} text={line} delay={lineDelay + lineIndex * 8} />
        ))}
      </div>
      <Figure kind={beat.figure} />
      <div
        style={{
          position: 'absolute',
          bottom: 48,
          left: 96,
          right: 96,
          display: 'flex',
          gap: 10,
        }}
      >
        {Array.from({ length: total }, (_unused, dot) => (
          <div
            key={dot}
            style={{
              height: 2,
              flex: 1,
              background: dot === index ? ACCENT : BORDER,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}

function Line({ text, delay }: { text: string; delay: number }) {
  const style = useEnter(delay);
  return (
    <div style={{ ...style, color: MUTED, fontSize: 27, lineHeight: 1.7 }}>{text}</div>
  );
}

function ClosingCard({ closing }: { closing: string }) {
  const style = useEnter(0);
  const urlStyle = useEnter(12);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 22 }}>
      <div style={{ ...style, color: MUTED, fontSize: 24, letterSpacing: '0.14em' }}>
        READ THE WHOLE THING
      </div>
      <div style={{ ...urlStyle, color: ACCENT, fontSize: 40, fontWeight: 650 }}>{closing}</div>
    </AbsoluteFill>
  );
}

export const UpdateVideo: React.FC<z.infer<typeof updateVideoSchema>> = ({
  eyebrow,
  title,
  beats,
  closing,
}) => {
  return (
    <AbsoluteFill style={{ background: BACKGROUND, fontFamily: FONT }}>
      <Sequence durationInFrames={TITLE_FRAMES}>
        <TitleCard eyebrow={eyebrow} title={title} />
      </Sequence>
      {beats.map((beat, index) => (
        <Sequence
          key={beat.heading}
          from={TITLE_FRAMES + index * BEAT_FRAMES}
          durationInFrames={BEAT_FRAMES}
        >
          <BeatCard beat={beat} index={index} total={beats.length} />
        </Sequence>
      ))}
      <Sequence
        from={TITLE_FRAMES + beats.length * BEAT_FRAMES}
        durationInFrames={CLOSING_FRAMES}
      >
        <ClosingCard closing={closing} />
      </Sequence>
    </AbsoluteFill>
  );
};
