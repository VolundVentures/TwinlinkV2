"use client";

// AUTEUR — entry page for the Runway-pivoted experience.
//
// Flow:
//   1. Lobby (pick 2 directors).
//   2. StagedLoader while /api/avatar/session creates two parallel Realtime
//      Sessions and polls them to READY (~30-60s in practice).
//   3. StudioShell — split layout with workspace + whiteboard + persistent
//      avatar column. Stays mounted for the whole session.

import { useState } from "react";
import { Lobby, type LobbySelection } from "@/components/auteur/lobby";
import { StudioShell, type StudioParticipant } from "@/components/auteur/studio-shell";
import { StagedLoader } from "@/components/auteur/staged-loader";

type SessionResponse = {
  lead: StudioParticipant;
  co: StudioParticipant | null;
};

export default function AuteurEntry() {
  const [phase, setPhase] = useState<"lobby" | "connecting" | "live" | "error">("lobby");
  const [data, setData] = useState<SessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cache the names entered into the lobby so the loader can render them
  // before we have a session response.
  const [pendingNames, setPendingNames] = useState<{
    leadName: string;
    coName: string | null;
  } | null>(null);

  async function startCasting(selection: LobbySelection, names: { lead: string; co: string }) {
    setPhase("connecting");
    setError(null);
    setPendingNames({ leadName: names.lead, coName: names.co });
    try {
      const res = await fetch("/api/avatar/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Session API ${res.status}: ${body}`);
      }
      const json = (await res.json()) as SessionResponse;
      setData(json);
      setPhase("live");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  if (phase === "lobby") {
    // Lobby's onConfirm gives us the selection IDs; we look up display names
    // by pulling from /api/directors via the lobby cache. Simpler: fetch
    // them again here. For now, derive a fallback from the IDs.
    return (
      <Lobby
        onConfirm={async (sel) => {
          // Fetch names so the loader can show them.
          try {
            const res = await fetch("/api/directors");
            const json = (await res.json()) as {
              directors: { id: string; name: string }[];
            };
            const lead = json.directors.find((d) => d.id === sel.leadDirectorId);
            const co = json.directors.find((d) => d.id === sel.coDirectorId);
            await startCasting(sel, {
              lead: lead?.name ?? sel.leadDirectorId,
              co: co?.name ?? sel.coDirectorId,
            });
          } catch {
            await startCasting(sel, { lead: sel.leadDirectorId, co: sel.coDirectorId });
          }
        }}
      />
    );
  }

  if (phase === "connecting") {
    return (
      <StagedLoader
        leadName={pendingNames?.leadName ?? "the lead director"}
        coName={pendingNames?.coName ?? null}
        done={false}
      />
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-white p-8 text-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-red-700">Session error</p>
          <p className="mt-3 max-w-xl whitespace-pre-wrap font-mono text-sm text-neutral-600">{error}</p>
          <button
            onClick={() => setPhase("lobby")}
            className="mt-6 border border-neutral-900 px-5 py-2 font-mono text-xs uppercase tracking-wider hover:bg-neutral-100"
          >
            Back to lobby
          </button>
        </div>
      </div>
    );
  }

  if (phase === "live" && data) {
    return <StudioShell lead={data.lead} co={data.co} onEnd={() => setPhase("lobby")} />;
  }

  return null;
}
