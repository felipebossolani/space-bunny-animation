/* Capture the reel to an .mp4, frame by frame, with the timeline pinned.
 *
 * Why not just screen-record? Because the reel is realtime-driven: if the
 * browser drops a frame, a screen recording keeps that gap forever. Here
 * each frame is rendered at an exact time (t = n/60) and only then grabbed,
 * so the output is exactly 15.000s at a true 60fps no matter how slowly
 * the machine renders. A slow machine costs time, not smoothness.
 *
 * Audio is rendered separately through an OfflineAudioContext and muxed in.
 *
 * usage: node record.js [outfile]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9750;
const REEL = '/Users/felipebossolani/dev/study/space-bunny-animation/index.html';
const OUT = process.argv[2] || path.join(process.cwd(), 'reel.mp4');
const TMP = '/private/var/folders/3n/2knmpdd92p3gjl1ntsj64r4h0000gn/T/opencode/rec';

const W = 1280, H = 720, DSF = 1.5;   // 1280*1.5 = 1920 native
const FPS = 60, DUR = 15.0;
const FRAMES = Number(process.env.FRAMES) || Math.round(DUR * FPS);  // 900

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function chrome() {
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
    `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
  let url;
  for (let i = 0; i < 80; i++) {
    try { url = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; if (url) break; } catch (e) {}
    await sleep(250);
  }
  const ws = new WebSocket(url);
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
  await S('Runtime.enable'); await S('Page.enable');
  return { proc, ws, S, errors };
}

const evaluate = async (S, expr) => {
  const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed');
  return r.result.result.value;
};

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const { proc, ws, S, errors } = await chrome();
  let ff = null;
  try {
    await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DSF, mobile: false });
    await S('Page.navigate', { url: 'file://' + REEL });
    await sleep(3500);

    /* ---- 1. audio, rendered offline through the reel's own composer ---- */
    console.log('rendering audio offline...');
    const wav = path.join(TMP, 'score.wav');
    const b64 = await evaluate(S, `(async()=>{
      const RATE = 48000, LEN = Math.ceil(RATE * ${DUR + 0.6});
      const off = new OfflineAudioContext(2, LEN, RATE);
      // hand the page's Score an offline context instead of a realtime one
      const RealAC = window.AudioContext;
      window.AudioContext = function(){ return off; };
      window.AudioContext.prototype = off.constructor.prototype;
      const s = new Score();
      try{
        s.init();
        s.compose();                       // same 15s score the reel plays
        // start() normally applies this envelope. We call compose() directly
        // so the context can be offline, which means we must raise the
        // master ourselves or the whole mix renders at -80dB.
        const t0env = off.currentTime, m = s.master.gain;
        m.setValueAtTime(.0001, t0env);
        m.exponentialRampToValueAtTime(.85, t0env + .7);
        m.setValueAtTime(.85, t0env + 15.0 - 1.3);
        m.exponentialRampToValueAtTime(.0001, t0env + 15.0 + .12);
        const b = s.bed.gain, a = s.air.gain;
        b.setValueAtTime(.02,t0env); b.linearRampToValueAtTime(.11,t0env+7.5); b.linearRampToValueAtTime(.02,t0env+15.0);
        a.setValueAtTime(.004,t0env); a.linearRampToValueAtTime(.022,t0env+3); a.linearRampToValueAtTime(.006,t0env+15.0);
        const buf = await off.startRendering();
        const L = buf.getChannelData(0), R = buf.numberOfChannels>1 ? buf.getChannelData(1) : L;
        window.AudioContext = RealAC;
        // base64 the int16 stereo PCM: returning 1.5M numbers as JSON is
        // orders of magnitude slower to serialise
        const n = L.length, bytes = new Uint8Array(n*4), dv = new DataView(bytes.buffer);
        for(let i=0;i<n;i++){
          dv.setInt16(i*4,   Math.max(-32768, Math.min(32767, Math.round(L[i]*32767))), true);
          dv.setInt16(i*4+2, Math.max(-32768, Math.min(32767, Math.round(R[i]*32767))), true);
        }
        let bin = '';
        for(let i=0;i<bytes.length;i+=0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i,i+0x8000));
        return btoa(bin);
      } finally { window.AudioContext = RealAC; }
    })()`);
    const pcm = Buffer.from(b64, 'base64');
    // wrap the raw int16 stereo PCM in a WAV header, here in Node
    const SR = 48000, nch = 2;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
    header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
    header.writeUInt16LE(nch, 22); header.writeUInt32LE(SR, 24);
    header.writeUInt32LE(SR * nch * 2, 28); header.writeUInt16LE(nch * 2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
    await fs.promises.writeFile(wav, Buffer.concat([header, pcm]));
    console.log('  score.wav  ' + (fs.statSync(wav).size / 1024 / 1024).toFixed(2) + ' MB');

    /* ---- 2. video, one exact frame at a time ---- */
    // Pin the clock: re-aim t0 on every rAF so the frame drawn is always
    // the time we asked for, then grab it before anything can advance.
    await evaluate(S, `(()=>{
      window.__hold = 0;
      const orig = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = function(cb){
        return orig(function(ts){
          if(window.__hold !== null) t0 = performance.now() - window.__hold*1000;
          return cb(ts);
        });
      };
      play();            // builds the WebGL programs and the grain pattern
      return 'armed';
    })()`);
    await sleep(2500);

    // fullscreen-ish: hide the DOM chrome that would otherwise be recorded
    await evaluate(S, `(()=>{ document.getElementById('hudTL').style.display='none';
      document.getElementById('hudTR').style.display='none'; return 'hud off'; })()`);

    console.log('rendering ' + FRAMES + ' frames at ' + W + '*' + DSF + '...');
    ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS),
      '-c:v', 'png', '-i', 'pipe:0',
      '-i', wav,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k',
      '-movflags', '+faststart', '-shortest', OUT],
      { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = '';
    ff.stderr.on('data', d => { ffErr += d.toString(); });

    const started = Date.now();
    for (let n = 0; n < FRAMES; n++) {
      const t = n / FPS;
      const b64 = await evaluate(S, `(async()=>{
        window.__hold = ${t};
        // let exactly one rAF render at the held time before we read pixels
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        return null;
      })()`);
      const shot = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const buf = Buffer.from(shot.result.data, 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (n % 90 === 0) {
        const pct = (n / FRAMES * 100).toFixed(0);
        const rate = n / ((Date.now() - started) / 1000);
        const eta = ((FRAMES - n) / rate).toFixed(0);
        process.stdout.write('\r  ' + pct + '%  frame ' + n + '/' + FRAMES + '  ' + rate.toFixed(1) + ' fps  eta ' + eta + 's   ');
      }
    }
    console.log('\n  frames written');

    await new Promise(r => ff.stdin.end(r));
    await new Promise(r => ff.on('close', r));
    ff = null;
    if (/Error|Invalid|failed/i.test(ffErr)) {
      const lines = ffErr.split('\n').filter(l => /Error|Invalid|failed/i.test(l));
      console.log('  fmpeg warnings:\n   ' + lines.slice(0, 5).join('\n   '));
    }
    if (errors.length) console.log('  page exceptions:\n   ' + errors.slice(0, 5).join('\n   '));
    const sz = fs.statSync(OUT).size / 1024 / 1024;
    console.log('\nwrote ' + OUT + '  (' + sz.toFixed(2) + ' MB)');
  } catch (e) {
    console.log('ERROR ' + e.message);
  } finally {
    if (ff) try { ff.stdin.end(); ff.kill(); } catch (e) {}
    try { ws.close(); } catch (e) {}
    proc.kill();
    setTimeout(() => process.exit(0), 300);
  }
})();