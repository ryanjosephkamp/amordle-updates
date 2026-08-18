/*
 * The music engine, with named styles.
 *
 * One script produces both the soundboard previews and the final track, so what
 * gets approved is what gets rendered — there is no second implementation to
 * drift. Pick a style and a length:
 *
 *   node scripts/make-music.mjs --style=siege --seconds=25 out.wav
 *
 * Everything is synthesised from scratch. No sample, no loop, no licence.
 *
 * EVERY OSCILLATOR ACCUMULATES PHASE. An early version computed a falling kick
 * as `sin(2*PI*f(t)*t)`, which is not a pitch envelope: the instantaneous
 * frequency of that is `f + t*df/dt`, so the whole track audibly rose in pitch
 * from start to finish. A frequency that changes over time has to be integrated
 * into the phase one sample at a time, which is what every voice below does.
 */
import { writeFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.replace(/^--/, '').split('=')),
);
const outPath = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'out.wav';
const SECONDS = Number(args.seconds ?? 25);
const STYLE = args.style ?? 'siege';

const RATE = 44100;
const TAU = Math.PI * 2;
const semitone = (hz, n) => hz * 2 ** (n / 12);
const A1 = 55;

/*
 * The brief for these is "hard-core, intense multiplayer" — the feeling of a
 * ranked match with a clock running, not a product tour. They differ in tempo,
 * how much low end they carry, and how much space they leave.
 */
const STYLES = {
  // Relentless four-on-the-floor. Driving, minor, forward-leaning.
  siege: {
    bpm: 140,
    chords: [
      [0, 3, 7],
      [0, 3, 7],
      [-2, 1, 5],
      [-4, 0, 3],
    ],
    kick: { every: 1, level: 0.62, from: 120, to: 46, drop: 0.024, decay: 0.1 },
    bass: { level: 0.5, retrigger: 0.5, decay: 0.34, saw: 0.55, cutoff: 1 },
    lead: { level: 0.13, division: 4, pattern: [0, 0, 1, 2, 0, 2, 1, 0], octave: 3, decay: 0.05 },
    hat: { level: 0.05, division: 2, decay: 0.016 },
    snare: { level: 0.3, on: [1, 3], decay: 0.11 },
    pad: 0.03,
    cutoff: 0.55,
  },

  /*
   * Four ways of dealing with Siege's bass buzz, from gentlest to most drastic.
   * Everything else — tempo, chords, kick, lead, hats, snare — is Siege exactly.
   */

  // The saw is gone. Pure sine bass, same everything else.
  'siege-pure': {
    bpm: 140,
    chords: [[0, 3, 7], [0, 3, 7], [-2, 1, 5], [-4, 0, 3]],
    kick: { every: 1, level: 0.62, from: 120, to: 46, drop: 0.024, decay: 0.1 },
    // 0.11, not 0.22: at 140bpm a note lands every 0.214s, so a longer decay
    // never finishes and a sustained sine is a hum rather than a bassline.
    bass: { level: 0.55, retrigger: 0.5, decay: 0.11, saw: 0, cutoff: 1 },
    lead: { level: 0.13, division: 4, pattern: [0, 0, 1, 2, 0, 2, 1, 0], octave: 3, decay: 0.05 },
    hat: { level: 0.05, division: 2, decay: 0.016 },
    snare: { level: 0.3, on: [1, 3], decay: 0.11 },
    pad: 0.03,
    cutoff: 0.55,
  },

  // Keeps a little saw for bite, but the note actually decays, so it plucks
  // rather than drones — and the bass gets its own dark filter.
  'siege-pluck': {
    bpm: 140,
    chords: [[0, 3, 7], [0, 3, 7], [-2, 1, 5], [-4, 0, 3]],
    kick: { every: 1, level: 0.62, from: 120, to: 46, drop: 0.024, decay: 0.1 },
    bass: { level: 0.5, retrigger: 0.5, decay: 0.075, saw: 0.35, cutoff: 0.12 },
    lead: { level: 0.13, division: 4, pattern: [0, 0, 1, 2, 0, 2, 1, 0], octave: 3, decay: 0.05 },
    hat: { level: 0.05, division: 2, decay: 0.016 },
    snare: { level: 0.3, on: [1, 3], decay: 0.11 },
    pad: 0.03,
    cutoff: 0.55,
  },

  // Sine bass on the downbeats only. Most space, kick carries the weight.
  'siege-sub': {
    bpm: 140,
    chords: [[0, 3, 7], [0, 3, 7], [-2, 1, 5], [-4, 0, 3]],
    kick: { every: 1, level: 0.68, from: 120, to: 46, drop: 0.024, decay: 0.12 },
    bass: { level: 0.55, retrigger: 2, decay: 0.3, saw: 0, cutoff: 1 },
    lead: { level: 0.14, division: 4, pattern: [0, 0, 1, 2, 0, 2, 1, 0], octave: 3, decay: 0.05 },
    hat: { level: 0.055, division: 2, decay: 0.016 },
    snare: { level: 0.32, on: [1, 3], decay: 0.11 },
    pad: 0.03,
    cutoff: 0.55,
  },

  // Saw kept at full, but filtered hard and pulled down. Darker, still gritty.
  'siege-dark': {
    bpm: 140,
    chords: [[0, 3, 7], [0, 3, 7], [-2, 1, 5], [-4, 0, 3]],
    kick: { every: 1, level: 0.62, from: 120, to: 46, drop: 0.024, decay: 0.1 },
    bass: { level: 0.42, retrigger: 0.5, decay: 0.16, saw: 0.55, cutoff: 0.06 },
    lead: { level: 0.12, division: 4, pattern: [0, 0, 1, 2, 0, 2, 1, 0], octave: 3, decay: 0.05 },
    hat: { level: 0.05, division: 2, decay: 0.016 },
    snare: { level: 0.3, on: [1, 3], decay: 0.11 },
    pad: 0.03,
    cutoff: 0.42,
  },
  /*
   * Second-half styles, for use with `--switch`.
   *
   * All four are 140bpm — the same tempo as siege-dark — on purpose. A switch
   * into a different tempo makes the crossfade sound like two songs colliding,
   * because for the length of the fade there are two kicks disagreeing about
   * where the beat is. Matching the tempo means the transition reads as the
   * arrangement changing rather than the track changing.
   */

  // Escalation. Same DNA, brighter chords, lead an octave up, busier hats.
  'siege-lift': {
    bpm: 140,
    chords: [[3, 7, 10], [0, 3, 7], [5, 8, 12], [3, 7, 10]],
    kick: { every: 1, level: 0.62, from: 120, to: 46, drop: 0.024, decay: 0.1 },
    bass: { level: 0.44, retrigger: 0.5, decay: 0.16, saw: 0.5, cutoff: 0.07 },
    lead: { level: 0.15, division: 4, pattern: [0, 2, 1, 2, 0, 1, 2, 1], octave: 4, decay: 0.045 },
    hat: { level: 0.06, division: 4, decay: 0.014 },
    snare: { level: 0.32, on: [1, 3], decay: 0.11 },
    pad: 0.035,
    cutoff: 0.5,
  },

  // The drop. Half-time drums, heavier kick, lots of space.
  'siege-break': {
    bpm: 140,
    chords: [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-4, 0, 3]],
    kick: { every: 2, level: 0.8, from: 130, to: 42, drop: 0.04, decay: 0.2 },
    bass: { level: 0.5, retrigger: 1, decay: 0.22, saw: 0.55, cutoff: 0.05 },
    lead: { level: 0.07, division: 1, pattern: [0, 2, 1, 2], octave: 3, decay: 0.24 },
    hat: { level: 0.03, division: 1, decay: 0.03 },
    snare: { level: 0.4, on: [2], decay: 0.18 },
    pad: 0.05,
    cutoff: 0.38,
  },

  // Busier. Sixteenth-note lead over the same floor — esports without the
  // tempo jump.
  'siege-rush': {
    bpm: 140,
    chords: [[0, 3, 7], [-2, 1, 5], [-4, 0, 3], [-5, -1, 2]],
    kick: { every: 1, level: 0.6, from: 118, to: 47, drop: 0.022, decay: 0.09 },
    bass: { level: 0.42, retrigger: 0.25, decay: 0.1, saw: 0.5, cutoff: 0.08 },
    lead: { level: 0.17, division: 4, pattern: [0, 1, 2, 1, 2, 1, 0, 1], octave: 4, decay: 0.032 },
    hat: { level: 0.06, division: 4, decay: 0.013 },
    snare: { level: 0.34, on: [1, 3], decay: 0.1 },
    pad: 0.022,
    cutoff: 0.55,
  },

  // Drums forward. Tones pulled right back, percussion carries it.
  'siege-drums': {
    bpm: 140,
    chords: [[0, 3, 7], [-4, 0, 3], [0, 3, 7], [-2, 1, 5]],
    kick: { every: 1, level: 0.75, from: 150, to: 44, drop: 0.03, decay: 0.13 },
    bass: { level: 0.4, retrigger: 0.5, decay: 0.12, saw: 0.5, cutoff: 0.06 },
    lead: { level: 0.05, division: 1, pattern: [0, 0, 2, 0], octave: 3, decay: 0.28 },
    hat: { level: 0.08, division: 4, decay: 0.012 },
    snare: { level: 0.46, on: [1, 3], decay: 0.13 },
    pad: 0.018,
    cutoff: 0.6,
  },

  /*
   * Four ways of making the drums section's keys less repetitive. The kit,
   * tempo, bass and mix are siege-drums exactly; only the lead and the chord
   * loop move. `-1` in a pattern is a rest, and indices past the third tone
   * climb into the octave above.
   */

  // A seven-step figure against a four-beat bar. Because 7 and 4 share no
  // factor, the phrase lands in a different place every bar and only returns to
  // where it started after seven of them.
  'drums-odd': {
    bpm: 140,
    chords: [[0, 3, 7], [-4, 0, 3], [0, 3, 7], [-2, 1, 5]],
    kick: { every: 1, level: 0.75, from: 150, to: 44, drop: 0.03, decay: 0.13 },
    bass: { level: 0.4, retrigger: 0.5, decay: 0.12, saw: 0.5, cutoff: 0.06 },
    lead: { level: 0.075, division: 2, pattern: [0, -1, 2, 3, -1, 1, 4], octave: 3, decay: 0.16 },
    hat: { level: 0.08, division: 4, decay: 0.012 },
    snare: { level: 0.46, on: [1, 3], decay: 0.13 },
    pad: 0.018,
    cutoff: 0.6,
  },

  // Sixteen steps with rests, spanning two octaves, over an eight-bar chord
  // loop — so both the figure and the harmony take longer to come around.
  'drums-long': {
    bpm: 140,
    chords: [
      [0, 3, 7], [-4, 0, 3], [0, 3, 7], [-2, 1, 5],
      [0, 3, 7], [-5, -1, 2], [-4, 0, 3], [-2, 1, 5],
    ],
    kick: { every: 1, level: 0.75, from: 150, to: 44, drop: 0.03, decay: 0.13 },
    bass: { level: 0.4, retrigger: 0.5, decay: 0.12, saw: 0.5, cutoff: 0.06 },
    lead: {
      level: 0.075,
      division: 2,
      pattern: [0, -1, 2, -1, 3, 2, -1, 4, 0, -1, 1, 2, -1, 3, -1, 2],
      octave: 3,
      decay: 0.15,
    },
    hat: { level: 0.08, division: 4, decay: 0.012 },
    snare: { level: 0.46, on: [1, 3], decay: 0.13 },
    pad: 0.018,
    cutoff: 0.6,
  },

  // Mostly rests. Occasional stabs high up, left to ring — atmosphere rather
  // than a riff, so there is much less to get tired of.
  'drums-sparse': {
    bpm: 140,
    chords: [[0, 3, 7], [-4, 0, 3], [0, 3, 7], [-2, 1, 5]],
    kick: { every: 1, level: 0.78, from: 150, to: 44, drop: 0.03, decay: 0.13 },
    bass: { level: 0.42, retrigger: 0.5, decay: 0.12, saw: 0.5, cutoff: 0.06 },
    lead: {
      level: 0.085,
      division: 1,
      pattern: [4, -1, -1, -1, -1, 2, -1, -1, 3, -1, -1],
      octave: 3,
      decay: 0.5,
    },
    hat: { level: 0.085, division: 4, decay: 0.012 },
    snare: { level: 0.48, on: [1, 3], decay: 0.13 },
    pad: 0.022,
    cutoff: 0.6,
  },

  // A climbing run that keeps going up through two octaves before dropping
  // back, on an eleven-step loop so it never sits still against the bar.
  'drums-climb': {
    bpm: 140,
    chords: [[0, 3, 7], [-4, 0, 3], [-2, 1, 5], [-5, -1, 2]],
    kick: { every: 1, level: 0.75, from: 150, to: 44, drop: 0.03, decay: 0.13 },
    bass: { level: 0.4, retrigger: 0.5, decay: 0.12, saw: 0.5, cutoff: 0.06 },
    lead: {
      level: 0.07,
      division: 4,
      pattern: [0, 1, 2, 3, 4, 5, 4, 3, -1, 2, 1],
      octave: 3,
      decay: 0.08,
    },
    hat: { level: 0.08, division: 4, decay: 0.012 },
    snare: { level: 0.46, on: [1, 3], decay: 0.13 },
    pad: 0.018,
    cutoff: 0.6,
  },

  // Heavy and sparse. A clock ticking down rather than a chase.
  clock: {
    bpm: 92,
    chords: [
      [0, 3, 7],
      [0, 3, 7],
      [-1, 2, 6],
      [-1, 2, 6],
    ],
    kick: { every: 2, level: 0.72, from: 105, to: 40, drop: 0.05, decay: 0.24 },
    bass: { level: 0.55, retrigger: 1, decay: 0.4, saw: 0.35, cutoff: 1 },
    lead: { level: 0.07, division: 1, pattern: [0, 2, 1, 2], octave: 3, decay: 0.22 },
    hat: { level: 0.03, division: 1, decay: 0.03 },
    snare: { level: 0.22, on: [2], decay: 0.16 },
    pad: 0.055,
    cutoff: 0.35,
  },
  // Drums first. Toms and a hard backbeat, few tones — closest to "combat".
  combat: {
    bpm: 128,
    chords: [
      [0, 3, 7],
      [-4, 0, 3],
      [0, 3, 7],
      [-2, 1, 5],
    ],
    kick: { every: 1, level: 0.7, from: 150, to: 44, drop: 0.03, decay: 0.14 },
    bass: { level: 0.46, retrigger: 0.5, decay: 0.3, saw: 0.7, cutoff: 1 },
    lead: { level: 0.06, division: 1, pattern: [0, 0, 2, 0], octave: 2, decay: 0.3 },
    hat: { level: 0.075, division: 4, decay: 0.012 },
    snare: { level: 0.42, on: [1, 3], decay: 0.13 },
    pad: 0.02,
    cutoff: 0.62,
  },
  // Fast sixteenth arpeggio over a hard floor. Esports broadcast.
  arena: {
    bpm: 150,
    chords: [
      [0, 3, 7],
      [-2, 1, 5],
      [-4, 0, 3],
      [-5, -1, 2],
    ],
    kick: { every: 1, level: 0.58, from: 115, to: 48, drop: 0.022, decay: 0.09 },
    bass: { level: 0.42, retrigger: 0.25, decay: 0.18, saw: 0.6, cutoff: 1 },
    lead: { level: 0.16, division: 4, pattern: [0, 1, 2, 1, 2, 1, 0, 1], octave: 4, decay: 0.035 },
    hat: { level: 0.055, division: 4, decay: 0.014 },
    snare: { level: 0.32, on: [1, 3], decay: 0.1 },
    pad: 0.025,
    cutoff: 0.6,
  },
};

function styleOf(name) {
  const found = STYLES[name];
  if (!found) throw new Error(`unknown style ${name}; try ${Object.keys(STYLES).join(', ')}`);
  return found;
}

let seed = 0x2f6e2b1;
function noise() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff - 0.5;
}

function envelope(t, attack, decay) {
  if (t < 0) return 0;
  if (t < attack) return t / attack;
  return Math.exp(-(t - attack) / decay);
}

/** A saw, built from the phase directly so it stays band-limited enough here. */
const saw = (phase) => ((phase / TAU) % 1) * 2 - 1;
const softClip = (x) => Math.tanh(x * 1.25) / 1.25;

/*
 * Renders one style into a fresh buffer pair.
 *
 * A function rather than top-level code because a track can now be two styles
 * joined by a crossfade, and each section has to start from silence with its own
 * phase accumulators — sharing them across a switch would carry the first
 * section's phase into the second and smear the join.
 */
function synth(
  styleName,
  seconds,
  { fadeIn = 1.2, fadeOut = 1.5, leadEnvelope = null, timeOffset = 0 } = {},
) {
  const style = styleOf(styleName);
  const beat = 60 / style.bpm;
  const bar = beat * 4;
  const frames = Math.floor(RATE * seconds);
  const left = new Float64Array(frames);
  const right = new Float64Array(frames);

  let kickPhase = 0;
  let bassPhase = 0;
  let leadPhase = 0;
  let snarePhase = 0;
  let bassLow = 0;
  const padPhases = [0, 0, 0];
  const padWide = [0, 0, 0];

  for (let i = 0; i < frames; i += 1) {
  const t = i / RATE;
  const chord = style.chords[Math.floor(t / bar) % style.chords.length];
  const root = semitone(A1, chord[0]);
  const beatIndex = Math.floor(t / beat);
  const intoBeat = t % beat;

  const intro = fadeIn > 0 ? Math.min(1, t / fadeIn) : 1;
  const outro = fadeOut > 0 ? Math.min(1, Math.max(0, seconds - t) / fadeOut) : 1;
  const master = intro * outro * 0.52;

  // Kick, with its pitch envelope integrated properly.
  const kickPeriod = beat * style.kick.every;
  const intoKick = t % kickPeriod;
  const kickHz =
    style.kick.to + (style.kick.from - style.kick.to) * Math.exp(-intoKick / style.kick.drop);
  kickPhase += (TAU * kickHz) / RATE;
  const kick =
    Math.sin(kickPhase) * envelope(intoKick, 0.002, style.kick.decay) * style.kick.level;

  /*
   * Bass: chord root, retriggered on a subdivision, part sine part saw.
   *
   * `retrigger` and `decay` are separate on purpose. The first version derived
   * the retrigger from `beat * per / 0.5 / 2` and hardcoded a 0.34s decay, which
   * at 140bpm meant a note every 0.107s decaying over 0.34s — it never decayed,
   * so the "bass" was a continuous 55Hz saw drone. A naive saw held constantly
   * at that pitch is a low buzz, and it was the loudest thing in the mix.
   */
  bassPhase += (TAU * root) / RATE;
  const bassEnv = envelope(t % (beat * style.bass.retrigger), 0.008, style.bass.decay);
  bassLow += (
    (Math.sin(bassPhase) * (1 - style.bass.saw) + saw(bassPhase) * style.bass.saw) - bassLow
  ) * style.bass.cutoff;
  const bass = bassLow * bassEnv * style.bass.level;

  /*
   * Lead: a figure over the chord, so it repeats rather than climbs.
   *
   * A pattern entry is an index into the chord's tones. An index at or above the
   * chord length wraps to the octave above, so [0, 1, 2, 3, 4] keeps climbing
   * through the triad instead of resetting — and a NEGATIVE entry is a rest.
   * Both exist because the first drums variant used a four-step pattern at
   * quarter notes over a four-beat bar: the same four notes, in the same places,
   * in every single bar.
   *
   * A pattern whose length is coprime with the bar also rotates against the
   * chords and takes several bars to come back around, which is variation for
   * free rather than more material.
   */
  const division = beat / style.lead.division;
  const step = Math.floor(t / division);
  const slot = style.lead.pattern[step % style.lead.pattern.length];
  const resting = slot < 0;
  const degree = resting ? 0 : slot;
  const tone = chord[degree % chord.length] + 12 * Math.floor(degree / chord.length);
  leadPhase += (TAU * semitone(A1 * 2 ** style.lead.octave, tone - chord[0])) / RATE;
  /*
   * The lead's level can be shaped across the finished piece. `timeOffset` puts
   * the envelope in composed-track time rather than section-local time, so a
   * treatment that fades the keys out by 38s means 38s of the VIDEO, not 38s
   * into whichever section happens to be playing.
   *
   * Only the keys are touched. Kick, snare, hats, bass and pad are untouched by
   * design — the brief was to keep the drums exactly as they are.
   */
  const keyGain = leadEnvelope ? leadEnvelope(timeOffset + t) : 1;
  const lead =
    resting || keyGain <= 0
      ? 0
      : saw(leadPhase) *
        envelope(t % division, 0.004, style.lead.decay) *
        style.lead.level *
        keyGain;

  // Pad: the chord, quiet, detuned across channels for width.
  let padL = 0;
  let padR = 0;
  chord.forEach((interval, index) => {
    const hz = semitone(A1 * 4, interval - chord[0]);
    padPhases[index] += (TAU * hz) / RATE;
    padWide[index] += (TAU * hz * 1.004) / RATE;
    padL += Math.sin(padPhases[index]) * style.pad;
    padR += Math.sin(padWide[index]) * style.pad;
  });

  // Hat and snare.
  const hatDivision = beat / style.hat.division;
  const hat = noise() * envelope(t % hatDivision, 0.001, style.hat.decay) * style.hat.level;
  /*
   * The snare's body is a tone at a fixed pitch with its own accumulator. It
   * used to be `sin(kickPhase * 3.1)` — a function of the kick's running,
   * ever-increasing phase, so it was not a pitch at all and drifted as the kick
   * accumulated. That was the metallic edge sitting on every backbeat.
   */
  snarePhase += (TAU * 185) / RATE;
  const onSnare = style.snare.on.includes(beatIndex % 4);
  const snare = onSnare
    ? (noise() * 0.82 + Math.sin(snarePhase) * 0.18) *
      envelope(intoBeat, 0.001, style.snare.decay) *
      style.snare.level
    : 0;

    const mono = kick + bass + lead + hat + snare;
    left[i] = softClip(mono + padL) * master;
    right[i] = softClip(mono + padR) * master;
  }

  // One-pole low pass. Lower cutoff values are darker.
  for (const channel of [left, right]) {
    for (let pass = 0; pass < 2; pass += 1) {
      let previous = 0;
      for (let i = 0; i < channel.length; i += 1) {
        previous += (channel[i] - previous) * style.cutoff;
        channel[i] = previous;
      }
    }
  }
  return { left, right, bar };
}

/*
 * Key treatments: how the melodic line behaves across the finished video.
 *
 * These exist because a figure that is fine for twenty seconds becomes wearing
 * for forty. Rather than write a less repetitive figure, these decide WHEN the
 * figure plays at all — which turned out to be the better question.
 *
 * The scene times are read off remotion/ExplainerVideo.tsx:
 *   Title   0.00 - 4.33      Any length  18.33 - 25.33
 *   OG      4.33 - 11.33     COMBAT      25.33 - 32.33
 *   GO     11.33 - 18.33     Ranked      32.33 - 39.33
 *                            Closing     39.33 - 43.00
 */
const SCENES = {
  title: [0, 4.33],
  og: [4.33, 11.33],
  go: [11.33, 18.33],
  length: [18.33, 25.33],
  combat: [25.33, 32.33],
  ranked: [32.33, 39.33],
  closing: [39.33, 43],
};

/** Smooth 0..1 ramp, so a treatment never switches the keys on with a click. */
const ramp = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Keys on during the listed scenes, with a short ramp at each edge. */
function windows(names, edge = 0.6) {
  const spans = names.map((name) => SCENES[name]);
  return (t) => {
    let gain = 0;
    for (const [from, to] of spans) {
      const up = ramp((t - from) / edge);
      const down = ramp((to - t) / edge);
      gain = Math.max(gain, Math.min(up, down));
    }
    return gain;
  };
}

const KEY_TREATMENTS = {
  // The owner's idea: full through the first half, then dissipating to nothing.
  fade: (t) => 1 - ramp((t - 22.3) / (38 - 22.3)),
  // No keys anywhere. Drums, bass and pad only.
  none: () => 0,
  // Only where the video is at its most competitive.
  combat: windows(['combat', 'ranked']),
  // Opening hook and closing sign-off; silent through the explaining middle.
  bookends: windows(['title', 'closing']),
  // Absent at first, arriving for COMBAT and gone before the end.
  swell: windows(['combat', 'ranked'], 2.2),
  // Every scene except the two that carry the most on-screen reading.
  breathe: windows(['title', 'length', 'combat', 'ranked', 'closing']),
};

/*
 * Compose the track.
 *
 * With `--switch`, the piece runs as style A, crossfades on a BAR LINE into
 * style B, and finishes there. Bar alignment matters: landing the switch
 * mid-bar puts the new kick a fraction of a beat away from where the ear
 * expects it, which reads as a mistake rather than a transition. The requested
 * switch time is therefore rounded to the nearest bar of A.
 *
 * Section B is rendered from its own bar one and then placed, rather than being
 * a slice out of a longer render, so it always enters on a downbeat.
 */
const SWITCH_TO = args.switch ?? null;
const CROSSFADE = Number(args.crossfade ?? 3);

const frames = Math.floor(RATE * SECONDS);
const left = new Float64Array(frames);
const right = new Float64Array(frames);

const KEYS = args.keys ?? null;
const leadEnvelope = KEYS ? KEY_TREATMENTS[KEYS] : null;
if (KEYS && !leadEnvelope) {
  throw new Error(`unknown keys treatment ${KEYS}; try ${Object.keys(KEY_TREATMENTS).join(', ')}`);
}

if (!SWITCH_TO) {
  const only = synth(STYLE, SECONDS, { leadEnvelope });
  left.set(only.left);
  right.set(only.right);
} else {
  const first = synth(STYLE, SECONDS, { fadeOut: 0, leadEnvelope });
  const requested = Number(args.at ?? SECONDS / 2);
  const switchAt = Math.max(first.bar, Math.round(requested / first.bar) * first.bar);
  const secondSeconds = SECONDS - switchAt + CROSSFADE;
  // timeOffset so the treatment is evaluated in video time, not section time.
  const second = synth(SWITCH_TO, secondSeconds, {
    fadeIn: 0,
    leadEnvelope,
    timeOffset: switchAt,
  });

  const start = Math.floor(switchAt * RATE);
  const fadeFrames = Math.floor(CROSSFADE * RATE);

  for (let i = 0; i < frames; i += 1) {
    // Equal-power crossfade: a linear one dips in the middle, because two
    // uncorrelated signals at half amplitude sum to less than either alone.
    let mix = 0;
    if (i >= start) mix = Math.min(1, (i - start) / fadeFrames);
    const gainA = Math.cos((mix * Math.PI) / 2);
    const gainB = Math.sin((mix * Math.PI) / 2);
    const j = i - start;
    const bL = j >= 0 && j < second.left.length ? second.left[j] : 0;
    const bR = j >= 0 && j < second.right.length ? second.right[j] : 0;
    left[i] = first.left[i] * gainA + bL * gainB;
    right[i] = first.right[i] * gainA + bR * gainB;
  }

  // The composed track needs its own tail fade; section A's was suppressed and
  // section B's runs past the end of the piece.
  const tail = Math.floor(1.5 * RATE);
  for (let i = frames - tail; i < frames; i += 1) {
    const g = (frames - i) / tail;
    left[i] *= g;
    right[i] *= g;
  }
  process.stdout.write(`switch at ${switchAt.toFixed(2)}s (bar-aligned)\n`);
}

// A loop, not Math.max(...channel): spreading ~1.9M samples overflows the stack.
let peak = 0;
for (let i = 0; i < frames; i += 1) {
  const magnitude = Math.max(Math.abs(left[i]), Math.abs(right[i]));
  if (magnitude > peak) peak = magnitude;
}
/*
 * The soundboard is auditioned on its own, so previews are normalised louder
 * than the final bed. `--level` lets the render ask for the quieter mix that
 * belongs under captions.
 */
const target = Number(args.level ?? 0.6);
const gain = peak > 0 ? target / peak : 1;

const bytes = Buffer.alloc(44 + frames * 4);
bytes.write('RIFF', 0);
bytes.writeUInt32LE(36 + frames * 4, 4);
bytes.write('WAVE', 8);
bytes.write('fmt ', 12);
bytes.writeUInt32LE(16, 16);
bytes.writeUInt16LE(1, 20);
bytes.writeUInt16LE(2, 22);
bytes.writeUInt32LE(RATE, 24);
bytes.writeUInt32LE(RATE * 4, 28);
bytes.writeUInt16LE(4, 32);
bytes.writeUInt16LE(16, 34);
bytes.write('data', 36);
bytes.writeUInt32LE(frames * 4, 40);

for (let i = 0; i < frames; i += 1) {
  const l = Math.max(-1, Math.min(1, left[i] * gain));
  const r = Math.max(-1, Math.min(1, right[i] * gain));
  bytes.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  bytes.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}

writeFileSync(outPath, bytes);
const description = SWITCH_TO ? `${STYLE} -> ${SWITCH_TO}` : STYLE;
process.stdout.write(
  `WROTE ${outPath} — ${description}, ${SECONDS}s at ${styleOf(STYLE).bpm}bpm\n`,
);
