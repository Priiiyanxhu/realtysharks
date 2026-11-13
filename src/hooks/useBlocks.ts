import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { describeBlockError } from '@/utils/chatErrors';

export type BlockResult = { ok: true } | { ok: false; error: string };

/**
 * The signed-in user's own block list (public.user_blocks).
 *
 * RLS lets a user read only the blocks THEY created, so this can never reveal
 * who has blocked them, and the UI must not imply that it can. A block stops
 * new messages in BOTH directions between the pair; history stays readable.
 */
export function useBlocks(userId: string | null) {
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  // Guards double-clicks: state updates are async, a ref is immediate.
  const inFlightRef = useRef(new Set<string>());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', userId);

      if (cancelled) return;
      if (error) {
        console.error('Failed to load block list.', { code: error.code });
        setLoadError("We couldn't load your blocked brokers.");
      } else {
        setBlockedIds(new Set((data ?? []).map((row) => row.blocked_id as string)));
        setLoadError(null);
      }
      setIsLoaded(true);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const run = useCallback(
    async (targetId: string, action: 'block' | 'unblock'): Promise<BlockResult> => {
      if (!userId) return { ok: false, error: 'Your session has expired. Please sign in again.' };
      if (inFlightRef.current.has(targetId)) return { ok: false, error: 'Please wait a moment.' };

      inFlightRef.current.add(targetId);
      setPendingIds((prev) => new Set(prev).add(targetId));

      try {
        const { error } =
          action === 'block'
            ? await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: targetId })
            : await supabase
                .from('user_blocks')
                .delete()
                .eq('blocker_id', userId)
                .eq('blocked_id', targetId);

        if (error) {
          const described = describeBlockError(error, action);
          if (!described.alreadyDone) {
            console.error(`Failed to ${action} broker.`, { code: error.code });
            return { ok: false, error: described.message };
          }
        }

        setBlockedIds((prev) => {
          const next = new Set(prev);
          if (action === 'block') next.add(targetId);
          else next.delete(targetId);
          return next;
        });
        return { ok: true };
      } catch {
        return { ok: false, error: describeBlockError(null, action).message };
      } finally {
        inFlightRef.current.delete(targetId);
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      }
    },
    [userId]
  );

  const block = useCallback((targetId: string) => run(targetId, 'block'), [run]);
  const unblock = useCallback((targetId: string) => run(targetId, 'unblock'), [run]);

  return { blockedIds, isLoaded, loadError, pendingIds, block, unblock };
}
