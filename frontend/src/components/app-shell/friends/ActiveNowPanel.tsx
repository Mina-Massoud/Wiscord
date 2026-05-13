import {
  fakeFeatureSpotlight,
  fakeFocusingRooms,
  fakeSuggestedRooms,
} from '@/data/fake-active-now';
import { FeatureSpotlightCard } from './active-now/FeatureSpotlightCard';
import { FocusingNowList } from './active-now/FocusingNowList';
import { SuggestedRoomsList } from './active-now/SuggestedRoomsList';

/**
 * Right rail of the friends view. Hybrid showcase that anchors Wiscord's
 * core loop (sync timer + body-doubling + room discovery) even when no
 * friends are active, instead of mirroring Discord's empty "Active Now"
 * card. Pure static — no realtime wiring in v1 (see docs/overview.md).
 */
export function ActiveNowPanel(): React.JSX.Element {
  return (
    <>
      <div className="flex h-12 shrink-0 items-center px-4">
        <h2 className="text-ink text-subhead font-semibold">Active Now</h2>
      </div>

      <div className="flex flex-col gap-1 overflow-y-auto pb-4">
        <div className="px-3">
          <FeatureSpotlightCard spotlight={fakeFeatureSpotlight} />
        </div>

        <FocusingNowList rooms={fakeFocusingRooms} />
        <SuggestedRoomsList rooms={fakeSuggestedRooms} />
      </div>
    </>
  );
}
