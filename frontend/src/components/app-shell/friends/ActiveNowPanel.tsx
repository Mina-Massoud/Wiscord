import { useCopy } from '@/lib/copy/useCopy';
import { FeatureSpotlightCard } from './active-now/FeatureSpotlightCard';
import { FocusingNowList } from './active-now/FocusingNowList';
import { SuggestedRoomsList } from './active-now/SuggestedRoomsList';

/**
 * Right rail of the friends view. Anchors Wiscord's core loop (sync timer +
 * body-doubling + room discovery): a static feature spotlight, the live
 * "Focusing now" surface, and real public-server suggestions from discovery.
 */
export function ActiveNowPanel(): React.JSX.Element {
  const t = useCopy();

  return (
    <>
      <div className="flex h-12 shrink-0 items-center px-4">
        <h2 className="text-ink text-subhead font-semibold">Active Now</h2>
      </div>

      <div className="flex flex-col gap-1 overflow-y-auto pb-4">
        <div className="px-3">
          <FeatureSpotlightCard
            title={t('home.spotlight.title')}
            blurb={t('home.spotlight.blurb')}
          />
        </div>

        <FocusingNowList />
        <SuggestedRoomsList />
      </div>
    </>
  );
}
