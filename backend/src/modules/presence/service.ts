import { Friendship } from '../../db/models/index.js';
import { presence, type PresenceStatus } from './presence-store.js';

/** Current presence for the requested users (defaults to `offline`). */
export function getPresenceFor(userIds: string[]): Record<string, PresenceStatus> {
  return presence.snapshot(userIds);
}

/**
 * The user ids on the other end of every friendship edge for `userId`. Used by
 * the gateway to fan a presence change out to exactly that user's friends — so
 * presence never leaks to strangers. Same canonical-edge read as
 * `friends/service.ts#listFriends`.
 */
export async function friendIdsOf(userId: string): Promise<string[]> {
  const edges = await Friendship.find({
    $or: [{ userAId: userId }, { userBId: userId }],
  })
    .select('userAId userBId')
    .lean();

  return edges.map((e) => {
    const a = e.userAId.toString();
    const b = e.userBId.toString();
    return a === userId ? b : a;
  });
}
