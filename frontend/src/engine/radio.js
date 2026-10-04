/* ── Radio — speaks incoming traffic with static, squelch and lost words ── */

const GARBLE = '▒▒▒';
const NATO = {
  A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo',
  F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliet',
};
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'];
const VOICE_PROFILE = {
  OVERLORD: { pitch: 0.85, rate: 1.0 },
  RECON_ASSET: { pitch: 1.15, rate: 1.1 },
};
const MAX_QUEUE = 5;

let ctx = null;
let enabled = true;
let busy = false;
let generation = 0; // bumps on stop() so in-flight transmissions abort
const queue = [];

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    ctx?.resume?.();
  } catch {
    ctx = null;
  }
}

export function setRadioEnabled(on) {
  enabled = on;
  if (!on) stopRadio();
}

export function stopRadio() {
  generation += 1;
  queue.length = 0;
  synth?.cancel();
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Band-limited white noise: radio static. */
function noise(seconds, level = 0.12) {
  if (!ctx) return wait(seconds * 1000);
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.random());
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1700;
  band.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.value = level;
  src.connect(band).connect(gain).connect(ctx.destination);
  src.start();
  return wait(seconds * 1000);
}

/** Press/release of the transmit key: short static burst plus a tone. */
async function squelch(release = false) {
  if (ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = release ? 1250 : 950;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  }
  await noise(0.12, 0.18);
}

function pickVoice(callsign) {
  const voices = (synth?.getVoices() || []).filter((v) => v.lang?.toLowerCase().startsWith('en'));
  if (!voices.length) return null;
  let h = 0;
  for (const ch of callsign) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return voices[h % voices.length];
}

function say(text, callsign, volume) {
  if (!synth || !text.trim()) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const profile = VOICE_PROFILE[callsign] || { pitch: 0.9 + ((callsign.length % 3) * 0.12), rate: 1.08 };
    u.pitch = profile.pitch;
    u.rate = profile.rate;
    u.volume = volume;
    const voice = pickVoice(callsign);
    if (voice) u.voice = voice;
    // Fallback in case the speech engine never fires onend
    const timer = setTimeout(resolve, 900 + text.split(' ').length * 450);
    u.onend = u.onerror = () => { clearTimeout(timer); resolve(); };
    synth.speak(u);
  });
}

/** Turn a written report into radio voice procedure. */
export function toSpeech(report) {
  let text = report.content
    .replace(/\[DELAYED (\d+)s\]\s*/g, 'Delayed traffic. ')
    .replace(/\b([A-J])-(\d)\b/g, (_, l, d) => `${NATO[l]} ${DIGITS[+d]}`)
    .replace(/est\./g, 'estimated')
    .replace(/(\d+)-(\d+)/g, '$1 to $2');
  const from = report.source_unit === 'RECON_ASSET' ? 'Hawkeye' : report.source_unit;
  const to = report.source_unit === 'OVERLORD' ? 'all stations' : 'Overlord';
  return `${to}, this is ${from}. ${text} Over.`;
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const gen = generation;
    const { report, degraded } = queue.shift();
    const segments = toSpeech(report).split(GARBLE);
    const volume = degraded ? 0.75 : 1;
    await squelch();
    for (let i = 0; i < segments.length && gen === generation; i++) {
      if (degraded) await noise(0.08, 0.06);
      await say(segments[i], report.source_unit, volume);
      // A dropped word: the voice is replaced by a burst of static
      if (i < segments.length - 1 && gen === generation) await noise(0.5, 0.3);
    }
    if (gen !== generation) continue;
    await squelch(true);
    await wait(350);
  }
  busy = false;
}

export function transmit(report, degraded = false) {
  if (!enabled || !synth) return;
  if (queue.length >= MAX_QUEUE) queue.shift(); // stale traffic gets stepped on
  queue.push({ report, degraded });
  pump();
}
