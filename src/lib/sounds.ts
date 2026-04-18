// Sons curtos via Web Audio API — sem arquivos externos, funciona offline.
// Sons disponíveis:
//  - success: "cha-ching" suave (salvar transação)
//  - delete:  "swoosh" descendente (excluir)
//  - partner: "ping-ping" duplo distinto (transação inserida pelo parceiro)

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Klass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Klass) return null;
    ctx = new Klass();
  }
  // ressuscita se suspenso (Safari/Chrome após autoplay block)
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(opts: {
  freq: number;
  duration: number;
  type?: OscillatorType;
  attack?: number;
  release?: number;
  gain?: number;
  delay?: number;
  freqEnd?: number;
}) {
  const c = getCtx();
  if (!c || muted) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), t0 + opts.duration);
  }
  const peak = opts.gain ?? 0.18;
  const attack = opts.attack ?? 0.005;
  const release = opts.release ?? 0.08;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + opts.duration + release);
}

export function setMuted(m: boolean) {
  muted = m;
}

export function isMuted() {
  return muted;
}

/** "Cha-ching" curto: 2 notas ascendentes brilhantes. */
export function playSuccess() {
  tone({ freq: 880, duration: 0.09, type: "triangle", gain: 0.16 });
  tone({ freq: 1318, duration: 0.18, type: "triangle", gain: 0.18, delay: 0.07 });
}

/** "Swoosh" descendente para exclusão (papel amassado abstrato). */
export function playDelete() {
  tone({ freq: 600, freqEnd: 180, duration: 0.22, type: "sawtooth", gain: 0.14 });
  tone({ freq: 240, freqEnd: 90, duration: 0.16, type: "sine", gain: 0.10, delay: 0.05 });
}

/** Alerta de parceiro: "ping-ping" duplo, agudo e curto, distinto do success. */
export function playPartner() {
  tone({ freq: 1568, duration: 0.08, type: "sine", gain: 0.16 });
  tone({ freq: 1568, duration: 0.08, type: "sine", gain: 0.16, delay: 0.14 });
}

/** Garante que o contexto foi inicializado por gesto do usuário (alguns navegadores exigem). */
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}
