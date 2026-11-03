"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { useBlocks } from "@/hooks/useBlocks";
import { GlassCard } from "@/components/ui/GlassCard";
import { Ban } from "lucide-react";

type BlockedProfile = {
  id: string;
  full_name: string | null;
  agency_name: string | null;
  avatar_url: string | null;
};

/**
 * Lists the brokers the user has blocked, with Unblock. Lives on the profile
 * page so a block can be undone even when no conversation is open.
 */
export function BlockedBrokersPanel({ userId }: { userId: string | null }) {
  const { blockedIds, isLoaded, loadError, pendingIds, unblock } = useBlocks(userId);
  const [profiles, setProfiles] = useState<Record<string, BlockedProfile>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  // Ids whose profiles were already requested, so each is fetched once.
  const requestedRef = useRef(new Set<string>());

  useEffect(() => {
    const missing = [...blockedIds].filter((id) => !requestedRef.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requestedRef.current.add(id));

    const loadProfiles = async () => {
      const { data } = await supabase
        .from("profiles_public")
        .select("id, full_name, agency_name, avatar_url")
        .in("id", missing);
      if (!data) return;
      setProfiles((prev) => {
        const next = { ...prev };
        (data as BlockedProfile[]).forEach((row) => {
          next[row.id] = row;
        });
        return next;
      });
    };

    loadProfiles();
  }, [blockedIds]);

  const handleUnblock = async (id: string) => {
    setActionError(null);
    const result = await unblock(id);
    if (!result.ok) setActionError(result.error);
  };

  return (
    <GlassCard className="p-6" aria-labelledby="blocked-brokers-heading">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <Ban className="h-4 w-4 text-gray-400" />
        </div>
        <div>
          <h3 id="blocked-brokers-heading" className="text-sm font-semibold text-white">
            Blocked brokers
          </h3>
          <p className="mt-1 text-xs text-white/50">
            Blocked brokers can&apos;t start a conversation with you or message you, and you can&apos;t message
            them. They aren&apos;t told.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {!isLoaded ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-red-300">
            {loadError}
          </p>
        ) : blockedIds.size === 0 ? (
          <p className="text-sm text-white/40">You haven&apos;t blocked anyone.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {[...blockedIds].map((id) => {
              const person = profiles[id];
              const name = person?.full_name || "Unknown broker";
              return (
                <li key={id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800">
                      {person?.avatar_url ? (
                        <Image src={person.avatar_url} alt="" fill className="object-cover" unoptimized />
                      ) : (
                        <span className="text-white/50">{name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{name}</p>
                      {person?.agency_name && <p className="truncate text-xs text-white/50">{person.agency_name}</p>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblock(id)}
                    disabled={pendingIds.has(id)}
                    aria-label={`Unblock ${name}`}
                    className="shrink-0 rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/5 disabled:opacity-50"
                  >
                    {pendingIds.has(id) ? "Unblocking…" : "Unblock"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {actionError && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {actionError}
          </p>
        )}
      </div>
    </GlassCard>
  );
}
