// Runway API client — singleton wrapping @runwayml/sdk.
//
// We use the official SDK because Runway's skill repo and docs all reference it
// as the canonical client, and it handles polling (`.waitForTaskOutput()`),
// task lifecycle, and error typing for free. For features the SDK doesn't
// expose yet (e.g. some custom_voices flows) we fall back to raw fetch in
// the relevant module.

import RunwayML from "@runwayml/sdk";

let _client: RunwayML | null = null;

/**
 * Get the singleton Runway client. Lazily initialised so importing this file
 * doesn't throw on systems that haven't set the secret yet (build-time, tests).
 */
export function getRunwayClient(): RunwayML {
  if (_client) return _client;

  const secret = process.env.RUNWAYML_API_SECRET;
  if (!secret) {
    throw new Error(
      "RUNWAYML_API_SECRET is not set. Add it to your .env (see .env.example)."
    );
  }

  _client = new RunwayML({ apiKey: secret });
  return _client;
}

/**
 * The Runway API version header we pin to. Bumping this is a deliberate
 * decision — pinning protects us from silent server-side schema drift.
 */
export const RUNWAY_API_VERSION = "2024-11-06";
