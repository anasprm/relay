'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import type { Attachment, StoryGroup } from '@/lib/types';

interface CreateStoryInput {
  kind: 'text' | 'image';
  text?: string;
  background?: string;
  attachment?: Attachment | null;
  closeFriendsOnly?: boolean;
}

interface UseStoriesOptions {
  socket: Socket | null;
  enabled?: boolean;
}

/**
 * Stories live for 24 hours. The client never filters privacy itself: the API
 * returns only the stories this account may see, and `stories:changed` simply
 * tells every tab to refetch that filtered view.
 */
export function useStories({ socket, enabled = true }: UseStoriesOptions) {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [closeFriends, setCloseFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      const response = await api.get<{ groups: StoryGroup[]; closeFriends: string[] }>(
        '/api/stories',
      );
      setGroups(response.groups || []);
      setCloseFriends(response.closeFriends || []);
    } catch {
      /* transient — the next socket event retries */
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket) return;
    const onChange = () => void refresh();
    socket.on('stories:changed', onChange);
    return () => {
      socket.off('stories:changed', onChange);
    };
  }, [refresh, socket]);

  const create = useCallback(
    async (input: CreateStoryInput) => {
      await api.post('/api/stories', input);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (storyId: string) => {
      await api.delete(`/api/stories/${storyId}`);
      await refresh();
    },
    [refresh],
  );

  const markViewed = useCallback(async (storyId: string) => {
    try {
      await api.post(`/api/stories/${storyId}/view`);
      setGroups((previous) =>
        previous.map((group) => {
          const target = group.stories.find((story) => story.id === storyId);
          if (!target) return group;
          const wasUnseen = !target.viewed;
          return {
            ...group,
            unseenCount: wasUnseen
              ? Math.max(0, group.unseenCount - 1)
              : group.unseenCount,
            stories: group.stories.map((story) =>
              story.id === storyId
                ? {
                    ...story,
                    viewed: true,
                    viewerCount: story.viewed ? story.viewerCount : story.viewerCount + 1,
                  }
                : story,
            ),
          };
        }),
      );
    } catch {
      /* viewing is best-effort */
    }
  }, []);

  const saveCloseFriends = useCallback(async (userIds: string[]) => {
    const response = await api.put<{ closeFriends: string[] }>('/api/users/me/close-friends', {
      userIds,
    });
    setCloseFriends(response.closeFriends || []);
    return response.closeFriends || [];
  }, []);

  return {
    groups,
    closeFriends,
    loading,
    refresh,
    create,
    remove,
    markViewed,
    saveCloseFriends,
  };
}
