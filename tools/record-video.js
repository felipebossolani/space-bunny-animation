/* Capture the reel to a silent .mp4 for social.
 *
 * Two things make this fast:
 *   1. hardware GL. Earlier runs passed --enable-unsafe-swiftshader, which
 *      forces CPU rasterisation and cost ~2.7s per 1080p frame. On the real
 *      GPU the same frame is a couple of milliseconds.
 *   2. JPEG over PNG. Page.captureScreenshot encodes every frame, and PNG at
 *      1080p is slow both to encode and to ship over the debugger socket.
 *
 * Timing is still pinned (t = n/60) so the result is exactly 15.000s at a
 * true 60fps with no dropped frames, whatever the machine does.
 *
 * usage: node record-video.js [out.mp4]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9760;
const REEL = '/Users/felipebossolani/dev/study/space-bunny-animation/index.html';
const OUT = process.argv[2] || path.join(process.cwd(), 'reel.mp4');

const W = 1280, H = 720, DSF = 1.5;              // 1280 * 1.5 = 1920 out
const FPS = 60, DUR = 15.0;
const FRAMES = Number(process.env.FRAMES) || Math.round(DUR * FPS);
const QUALITY = Number(process.env.QUALITY) || 96;

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // no swiftshader flags: let Chrome use the real GPU
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
    '--hide-scrollbars', '--mute-audio',
    `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
  let ws, url;
  try {
    for (let i = 0; i < 80; i++) {
      try { url = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; if (url) break; } catch (e) {}
      await sleep(250);
    }
    ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pending = new Map(); const errors = [];
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception?.description || '').split('\n')[0]);
    };
    const send = (method, params = {}, sessionId) => new Promise(res => {
      const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    });
    const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
    const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
    const S = (method, params) => send(method, params, sessionId);
    const evaluate = async expr => {
      const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed');
      return r.result.result.value;
    };

    await S('Runtime.enable'); await S('Page.enable');
    await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DSF, mobile: false });
    await S('Page.navigate', { url: 'file://' + REEL });
    await sleep(3500);

    const gpu = await evaluate(`(()=>{ const d=gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; })()`);
    console.log('renderer: ' + gpu);

    // pin the clock and hide the DOM chrome that would otherwise be recorded
    await evaluate(`(()=>{
      window.__hold = 0;
      const orig = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = function(cb){
        return orig(function(ts){
          if(window.__hold !== null) t0 = performance.now() - window.__hold*1000;
          return cb(ts);
        });
      };
      for(const id of ['hudTL','hudTR']) document.getElementById(id).style.display='none';
      play();
      return 'armed';
    })()`);
    await sleep(2500);

    // silent video only: social feeds autoplay muted anyway
    const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS),
      '-c:v', 'mjpeg', '-i', 'pipe:0',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
      '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-an', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = '';
    ff.stderr.on('data', d => { ffErr += d.toString(); });

    console.log('rendering ' + FRAMES + ' frames -> ' + W + '*' + DSF + ' @' + FPS + 'fps');
    const started = Date.now();
    for (let n = 0; n < FRAMES; n++) {
      await evaluate(`(async()=>{ window.__hold = ${n / FPS};
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); return 1; })()`);
      const shot = await S('Page.captureScreenshot', { format: 'jpeg', quality: QUALITY, captureBeyondViewport: false });
      if (!ff.stdin.write(Buffer.from(shot.result.data, 'base64')))
        await new Promise(r => ff.stdin.once('drain', r));
      if (n % 120 === 0 || n === FRAMES - 1) {
        const el = (Date.now() - started) / 1000;
        process.stdout.write('\r  ' + (n / FRAMES * 100).toFixed(0) + '%  frame ' + n + '/' + FRAMES +
          '  ' + (n / el).toFixed(1) + ' fps  eta ' + ((FRAMES - n) / (n / el)).toFixed(0) + 's     ');
      }
    }
    console.log('\n  frames written');
    await new Promise(r => ff.stdin.end(r));
    await new Promise(r => ff.on('close', r));
    if (errors.length) console.log('  page exceptions:\n   ' + errors.slice(0, 5).join('\n   '));
    console.log('\nwrote ' + OUT + '  (' + (fs.statSync(OUT).size / 1024 / 1024).toFixed(1) + ' MB, silent)');
  } catch (e) {
    console.log('ERROR ' + e.message);
  } finally {
    try { ws && ws.close(); } catch (e) {}
    proc.kill();
    setTimeout(() => process.exit(0), 300);
  }
})();