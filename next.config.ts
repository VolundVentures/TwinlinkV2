import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remotion packages are external: only `@remotion/lambda/client` is needed
  // at runtime (to trigger remote Lambda renders). The other Remotion
  // packages ship a headless Chromium and native compositor binaries that
  // blow past Vercel's 250 MB serverless function limit when bundled.
  serverExternalPackages: [
    "@remotion/lambda",
    "@remotion/renderer",
    "@remotion/bundler",
    "@remotion/cli",
  ],
  // Belt-and-suspenders: even with serverExternalPackages, Next's file tracer
  // can still copy heavy native binaries into the function's node_modules.
  // Heavy `public/` media is served by the static CDN and never needs to live
  // inside a function bundle.
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
      "public/directors/*.png",
    ],
  },
};

export default nextConfig;
