import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Runway RPC handler depends on @livekit/rtc-node, which loads native
  // OS-specific .node bindings. Next.js's bundler can't trace those, and when
  // it tries it fails to compile the WHOLE app — even routes that don't
  // import the RPC handler get 404'd. Marking these as external keeps them
  // out of the bundle; Next loads them at runtime from node_modules.
  serverExternalPackages: [
    "@runwayml/avatars-node-rpc",
    "@livekit/rtc-node",
    "@livekit/rtc-ffi-bindings",
  ],
};

export default nextConfig;
