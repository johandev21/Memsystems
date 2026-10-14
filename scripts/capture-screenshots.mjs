import { execSync } from "node:child_process";
import { resolve } from "node:path";

const BASE_URL = "http://localhost:3001/notebooks/syws1p3k5wshe0jcgiqeoo51";
const OUT_DIR = "/home/jcarrasco21/.gemini/antigravity/brain/d2a660fe-bbbf-4b0b-add5-0d48f38d69d8/screenshots";

const tasks = [
  // 1. Worst-case Desktop 1920x1080 (Wide)
  {
    name: "01-worst-desktop-1920.png",
    url: `${BASE_URL}?data=worst`,
    width: 1920,
    height: 1080,
    time: 5000,
  },
  // 2. Worst-case Desktop 1440x900 (Standard)
  {
    name: "02-worst-desktop-1440.png",
    url: `${BASE_URL}?data=worst`,
    width: 1440,
    height: 900,
    time: 5000,
  },
  // 3. Worst-case Tablet / Narrow Laptop 1024x768
  {
    name: "03-worst-tablet-1024.png",
    url: `${BASE_URL}?data=worst`,
    width: 1024,
    height: 768,
    time: 5000,
  },
  // 4. Worst-case Mobile 320x640 (Extreme Narrow)
  {
    name: "04a-worst-mobile-320-chat.png",
    url: `${BASE_URL}?data=worst`,
    width: 320,
    height: 640,
    time: 5000,
  },
  {
    name: "04b-worst-mobile-320-sources.png",
    url: `${BASE_URL}?data=worst&tab=sources`,
    width: 320,
    height: 640,
    time: 5000,
  },
  {
    name: "04c-worst-mobile-320-studio.png",
    url: `${BASE_URL}?data=worst&tab=studio`,
    width: 320,
    height: 640,
    time: 5000,
  },
  // 5. Worst-case Mobile 390x844 (Standard Phone)
  {
    name: "05a-worst-mobile-390-chat.png",
    url: `${BASE_URL}?data=worst`,
    width: 390,
    height: 844,
    time: 5000,
  },
  {
    name: "05b-worst-mobile-390-sources.png",
    url: `${BASE_URL}?data=worst&tab=sources`,
    width: 390,
    height: 844,
    time: 5000,
  },
  {
    name: "05c-worst-mobile-390-studio.png",
    url: `${BASE_URL}?data=worst&tab=studio`,
    width: 390,
    height: 844,
    time: 5000,
  },
  // 6. RTL and Zoom tests
  {
    name: "06a-worst-rtl-desktop-1440.png",
    url: `${BASE_URL}?data=worst&dir=rtl`,
    width: 1440,
    height: 900,
    time: 5000,
  },
  {
    name: "06b-worst-rtl-mobile-390.png",
    url: `${BASE_URL}?data=worst&dir=rtl`,
    width: 390,
    height: 844,
    time: 5000,
  },
  {
    name: "06c-worst-zoom-200.png",
    url: `${BASE_URL}?data=worst`,
    width: 1440,
    height: 900,
    scale: 2,
    time: 5000,
  },
  // 7. Empty State Desktop 1440x900
  {
    name: "07-empty-desktop-1440.png",
    url: `${BASE_URL}?data=empty`,
    width: 1440,
    height: 900,
    time: 5000,
  },
  // 8. Empty State Mobile 320x640
  {
    name: "08-empty-mobile-320.png",
    url: `${BASE_URL}?data=empty`,
    width: 320,
    height: 640,
    time: 5000,
  },
  // 9. One State Desktop 1440x900 (Pluralization check: "1 source", "1 material")
  {
    name: "09-one-desktop-1440.png",
    url: `${BASE_URL}?data=one`,
    width: 1440,
    height: 900,
    time: 5000,
  },
  // 10. Huge State Desktop 1440x900 (1,000 items unpaginated performance/scroll)
  {
    name: "10-huge-desktop-1440.png",
    url: `${BASE_URL}?data=huge`,
    width: 1440,
    height: 900,
    time: 6000,
  },
  // 11. Demo State Desktop 1440x900 (Baseline)
  {
    name: "11-demo-desktop-1440.png",
    url: `${BASE_URL}?data=demo`,
    width: 1440,
    height: 900,
    time: 5000,
  },
];

console.log(`📸 Capturing ${tasks.length} screenshots for break-ui analysis...`);

for (const task of tasks) {
  const outPath = resolve(OUT_DIR, task.name);
  const scaleFlag = task.scale ? `--force-device-scale-factor=${task.scale}` : "";
  const cmd = `chromium --headless=new --disable-gpu --virtual-time-budget=${task.time} --window-size=${task.width},${task.height} ${scaleFlag} --screenshot="${outPath}" "${task.url}"`;
  console.log(`Capturing: ${task.name} (${task.width}x${task.height})...`);
  try {
    execSync(cmd, { stdio: "ignore" });
    console.log(`  ✓ Saved ${task.name}`);
  } catch (err) {
    console.error(`  ✗ Failed ${task.name}:`, err.message);
  }
}

console.log("\n✅ All screenshots captured!");
