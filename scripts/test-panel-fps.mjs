import { spawn } from "node:child_process";

const chrome = spawn("chromium", [
  "--headless=new",
  "--disable-gpu",
  "--remote-debugging-port=9223",
  "--window-size=1440,900",
  "about:blank",
]);

setTimeout(async () => {
  try {
    const res = await fetch("http://127.0.0.1:9223/json");
    const targets = await res.json();
    const page = targets.find((t) => t.type === "page");
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: "Page.enable" }));
      ws.send(JSON.stringify({ id: 2, method: "Runtime.enable" }));
      ws.send(JSON.stringify({
        id: 3,
        method: "Page.navigate",
        params: { url: "http://localhost:3001/notebooks/syws1p3k5wshe0jcgiqeoo51?data=huge" }
      }));
    };

    ws.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id === 3) {
        // Navigation started, wait for load and DOM to mount
        await new Promise(r => setTimeout(r, 3500));

        const benchmarkScript = `
          (async () => {
            const errors = [];
            window.addEventListener('error', e => errors.push(e.message));
            window.addEventListener('unhandledrejection', e => errors.push('Unhandled: ' + e.reason));

            // Wait until panel buttons exist
            const waitFor = async (fn, timeout = 5000) => {
              const start = performance.now();
              while (performance.now() - start < timeout) {
                const el = fn();
                if (el) return el;
                await new Promise(r => setTimeout(r, 50));
              }
              return null;
            };

            const getSourcesBtn = () => {
              const allButtons = Array.from(document.querySelectorAll('button'));
              return allButtons.find(b => {
                const label = (b.getAttribute('aria-label') || '').toLowerCase();
                return label.includes('source') || b.querySelector('svg.lucide-panel-left, svg.lucide-panel-left-close, svg.lucide-panel-left-open');
              });
            };

            const getStudioBtn = () => {
              const allButtons = Array.from(document.querySelectorAll('button'));
              return allButtons.find(b => {
                const label = (b.getAttribute('aria-label') || '').toLowerCase();
                return label.includes('studio') || b.querySelector('svg.lucide-panel-right, svg.lucide-panel-right-close, svg.lucide-panel-right-open');
              });
            };

            const sBtnInitial = await waitFor(getSourcesBtn);
            const stBtnInitial = await waitFor(getStudioBtn);

            const frameTimes = [];
            let lastTime = null;
            let running = true;

            function onFrame(time) {
              if (lastTime !== null) {
                frameTimes.push(time - lastTime);
              }
              lastTime = time;
              if (running) requestAnimationFrame(onFrame);
            }
            requestAnimationFrame(onFrame);

            const toggles = [];
            for (let i = 0; i < 10; i++) {
              const t0 = performance.now();
              const sBtn = getSourcesBtn();
              if (sBtn) sBtn.click();
              await new Promise(r => setTimeout(r, 260));
              const stBtn = getStudioBtn();
              if (stBtn) stBtn.click();
              await new Promise(r => setTimeout(r, 260));
              toggles.push(performance.now() - t0);
            }

            running = false;
            await new Promise(r => setTimeout(r, 50));

            const avgFrame = frameTimes.reduce((a, b) => a + b, 0) / (frameTimes.length || 1);
            const maxFrame = Math.max(...frameTimes);
            const framesOver16ms = frameTimes.filter(t => t > 16.7).length;
            const framesOver33ms = frameTimes.filter(t => t > 33.3).length;

            const sorted = [...frameTimes].sort((a, b) => a - b);
            const p95Frame = sorted[Math.floor(sorted.length * 0.95)] || 0;
            const top5Frames = [...frameTimes].sort((a, b) => b - a).slice(0, 5).map(t => Math.round(t * 10) / 10);

            return {
              sourcesFound: Boolean(sBtnInitial),
              studioFound: Boolean(stBtnInitial),
              totalFrames: frameTimes.length,
              avgFrame: Math.round(avgFrame * 10) / 10,
              p95Frame: Math.round(p95Frame * 10) / 10,
              maxFrame: Math.round(maxFrame * 10) / 10,
              fps: Math.round(1000 / avgFrame),
              framesOver16ms,
              framesOver33ms,
              top5Frames,
              toggleDurationAvg: Math.round(toggles.reduce((a, b) => a + b, 0) / toggles.length),
              errors,
            };
          })()
        `;

        ws.send(JSON.stringify({
          id: 4,
          method: "Runtime.evaluate",
          params: {
            expression: benchmarkScript,
            awaitPromise: true,
            returnByValue: true,
          }
        }));
      } else if (data.id === 4) {
        const val = data.result.result?.value ?? data.result.value ?? data.result;
        console.log("BENCHMARK_RESULT:", JSON.stringify(val, null, 2));
        ws.close();
        chrome.kill();
        process.exit(0);
      }
    };
  } catch (e) {
    console.error("Test error:", e);
    chrome.kill();
    process.exit(1);
  }
}, 1000);
