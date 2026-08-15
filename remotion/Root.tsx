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
        title: 'Showing the working',
        beats: [
          {
            heading: 'Methodology',
            lines: [
              'Every scoring formula the game uses,',
              'published and named to its source.',
            ],
            figure: 'equation' as const,
          },
          {
            heading: 'Forty rating pools',
            lines: ['Ten clocks, two modes, hard mode.', 'A rating only compares like with like.'],
            figure: 'pools' as const,
          },
          {
            heading: 'About',
            lines: ['Where the words come from,', 'and where to report a problem.'],
            figure: 'links' as const,
          },
          {
            heading: 'Share a profile',
            lines: ['Copy your own link at last —', 'and anybody else’s.'],
            figure: 'share' as const,
          },
        ],
        closing: 'amordle.vercel.app/methodology',
      }}
    />
  );
};
