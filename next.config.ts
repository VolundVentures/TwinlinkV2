import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Runway RPC handler depends on @livekit/rtc-node, which loads native
  // OS-specific .node bindings. Next.js's bundler can't trace those, and when
  // it tries it fails to compile the WHOLE app — even routes that don't
  // import the RPC handler get 404'd. Marking these as external keeps them
  // out of the bundle; Next loads them at runtime from node_modules.
  //
  // Remotion packages are also external: only `@remotion/lambda/client` is
  // needed at runtime (to trigger remote Lambda renders). The other Remotion
  // packages ship a headless Chromium and native compositor binaries that
  // blow past Vercel's 250 MB serverless function limit when bundled.
  serverExternalPackages: [
    "@runwayml/avatars-node-rpc",
    "@livekit/rtc-node",
    "@livekit/rtc-ffi-bindings",
    "@remotion/lambda",
    "@remotion/renderer",
    "@remotion/bundler",
    "@remotion/cli",
  ],
  // Belt-and-suspenders: even with serverExternalPackages, Next's file tracer
  // can still copy heavy native binaries into the function's node_modules.
  // Exclude them explicitly so they never reach the deployed function.
  //
  // We also exclude the heavy parts of `public/`. The avatar/session route
  // does fs.readFileSync(process.cwd() + "/public/" + dynamicPath) to upload
  // director portraits to Runway; the tracer can't prove which file is read
  // and pulls the WHOLE public dir into every function (~255 MB). The route
  // only needs `public/directors/avatars/**` at runtime — everything else
  // (videos, gallery portraits, method screenshots) is loaded by the
  // browser via Vercel's static CDN and doesn't need to live inside the
  // function bundle.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@remotion/renderer/**",
      "node_modules/@remotion/bundler/**",
      "node_modules/@remotion/cli/**",
      "node_modules/@remotion/compositor-*/**",
      "node_modules/@remotion/lambda/dist/admin/**",
      "node_modules/@remotion/lambda/remotionlambda-*.zip",
      "public/videos/**",
      "public/method/**",
      "public/posters/**",
      // Drop the 5–7 MB gallery portraits. The avatar/session route prefers
      // the smaller `public/directors/avatars/<id>.png` files; gallery
      // portraits are only displayed in the browser. Pattern matches files
      // directly under public/directors but NOT under public/directors/avatars.
      "public/directors/*.png",
    ],
  },
};

export default nextConfig;
