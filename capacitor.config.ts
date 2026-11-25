import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hasansaimon.framefusionstudio",
  appName: "Frame Fusion Studio",
  webDir: ".vercel/output/static",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: "native",
    },
  },
};

export default config;
