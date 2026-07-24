import { useCallback, useMemo } from 'react';

import { useAuth } from '@/lib/context/AuthContext';

import { listFriendships, removeFriend, respondFriendRequest, sendFriendRequest } from '../api';
import { useAsyncResource } from './useAsyncResource';

import type { FriendshipState, UserSummary } from '../api';

/**
 * The caller's friends and pending requests, split the way the UI shows them.
 *
 * Mutations apply optimistically and reload afterwards: a friend request that
 * appears to do nothing for a second reads as broken, and the server is the
 * authority on the resulting state anyway (crossing requests, for instance,
 * come back as `friends` rather than `request_sent`).
 */
export function useFriends() {
  const { session } = useAuth();
  const enabled = Boolean(session);

  const resource = useAsyncResource<UserSummary[]>(listFriendships, {
    enabled,
    deps: [session?.user.id],
  });

  const { data, reload, setData } = resource;

  const groups = useMemo(() => {
    const all = data ?? [];
    return {
      friends: all.filter((u) => u.state === 'friends'),
      incoming: all.filter((u) => u.state === 'request_received'),
      outgoing: all.filter((u) => u.state === 'request_sent'),
    };
  }, [data]);

  /** Applies a new state locally, then confirms against the server. */
  const apply = useCallback(
    async (userId: string, next: FriendshipState, action: () => Promise<FriendshipState>) => {
      const previous = data ?? [];
      setData(
        next === 'none'
          ? previous.filter((u) => u.userId !== userId)
          : previous.map((u) => (u.userId === userId ? { ...u, state: next } : u)),
      );
      try {
        await action();
      } finally {
        // Reload either way: on success to pick up the real state, on failure
        // to undo the optimistic change.
        await reload();
      }
    },
    [data, setData, reload],
  );

  const accept = useCallback(
    (userId: string) => apply(userId, 'friends', () => respondFriendRequest(userId, true)),
    [apply],
  );

  const decline = useCallback(
    (userId: string) => apply(userId, 'none', () => respondFriendRequest(userId, false)),
    [apply],
  );

  const remove = useCallback(
    (userId: string) => apply(userId, 'none', () => removeFriend(userId)),
    [apply],
  );

  const add = useCallback(
    (userId: string) => apply(userId, 'request_sent', () => sendFriendRequest(userId)),
    [apply],
  );

  return { ...resource, ...groups, enabled, accept, decline, remove, add };
}
