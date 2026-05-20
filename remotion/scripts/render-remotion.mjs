import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser, renderStill } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, "../../src/assets");
fs.mkdirSync(ASSETS, { recursive: true });

const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (config) => config,
  publicDir: path.resolve(__dirname, "../public"),
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: {
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({
  serveUrl: bundled,
  id: "main",
  puppeteerInstance: browser,
});

const videoOut = path.join(ASSETS, "landing-demo.mp4");
await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  outputLocation: videoOut,
  puppeteerInstance: browser,
  muted: true,
  concurrency: 1,
  jpegQuality: 80,
  crf: 26,
});

// Poster frame
const posterOut = path.join(ASSETS, "landing-demo-poster.jpg");
await renderStill({
  composition,
  serveUrl: bundled,
  output: posterOut,
  frame: 240,
  puppeteerInstance: browser,
  imageFormat: "jpeg",
  jpegQuality: 85,
  overwrite: true,
});

await browser.close({ silent: false });
console.log(`✅ Video: ${videoOut}`);
console.log(`✅ Poster: ${posterOut}`);
