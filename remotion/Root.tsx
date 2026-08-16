import { Composition } from 'remotion';
import { UpdateVideo, updateVideoSchema } from './UpdateVideo';

/*
 * One composition, reused for every post.
 *
 * The props are the script: a title, and a list of beats. Making the next video
 * means writing a new props object, not a new composition — which is the only
 * way a per-post video stays cheap enough to actually keep making.
 *
 * 30fps x 720 frames = 24 seconds, inside the 15-30s the changelog asks for.
 */
export const Root: React.FC = () => {
  return (
    <Composition
      id="update"
      component={UpdateVideo}
      durationInFrames={720}
      fps={30}
      width={1280}
      height={720}
      schema={updateVideoSchema}
      defaultProps={{
        eyebrow: '15 AUGUST 2026',
        title: 'The daily streak',
        beats: [
          {
            heading: 'It counts now',
            lines: ['The number was on your stats panel', 'and nothing ever moved it.'],
            figure: 'streak' as const,
          },
          {
            heading: 'Either Daily keeps it',
            lines: ['OG or GO, and finishing counts —', 'a Daily you lose still keeps the streak.'],
            figure: 'either' as const,
          },
          {
            heading: 'Your local day',
            lines: ['The streak turns over at your midnight,', 'not at a server’s.'],
            figure: 'day' as const,
          },
          {
            heading: 'Miss a day',
            lines: ['It lapses, and the next one starts again', 'at one. It cannot be bought back.'],
            figure: 'lapse' as const,
          },
        ],
        closing: 'amordle.vercel.app/methodology',
      }}
    />
  );
};
