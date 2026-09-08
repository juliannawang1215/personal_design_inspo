/**
 * Web Audio Synthesizer & Acoustic Feedback Engine for Inspo
 * Generates zero-asset, lightweight, delightful UI sound effects programmatically
 */

export interface SoundEnvelope {
  attack?: number;
  decay: number;
  sustain?: number;
  release?: number;
  curve?: 'exponential' | 'ramp' | 'linear';
}

export interface SoundFilter {
  type: BiquadFilterType;
  frequency: number;
  Q?: number;
  resonance?: number;
  envelope?: {
    attack?: number;
    decay: number;
    peak: number;
  };
}

export interface SoundSource {
  type: OscillatorType | 'noise';
  color?: 'pink' | 'brown' | 'white';
  frequency?: number | { start: number; end: number; time?: number };
  detune?: number;
  fm?: {
    ratio: number;
    depth: number;
  };
}

export interface SoundEffect {
  type: 'reverb' | 'delay';
  decay?: number;
  mix?: number;
  damping?: number;
  roomSize?: number;
  preDelay?: number;
  delay?: number;
  lowpass?: number;
  feedback?: number;
  wet?: number;
}

export interface SoundLayer {
  delay?: number;
  gain?: number;
  source: SoundSource;
  envelope?: SoundEnvelope;
  filter?: SoundFilter | SoundFilter[];
  effects?: SoundEffect[];
}

export interface SoundPatch {
  layers?: SoundLayer[];
  delay?: number;
  gain?: number;
  source?: SoundSource;
  envelope?: SoundEnvelope;
  filter?: SoundFilter | SoundFilter[];
  effects?: SoundEffect[];
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioContext) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioContext = new AudioCtx();
      }
    }
    if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

export function playSound(patch: SoundPatch, context?: AudioContext): void {
  const ctx = context || getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const S = 0.0001;
    const t0 = ctx.currentTime;

    function noiseBuffer(seconds: number, color?: string): AudioBuffer {
      const len = Math.max(1, Math.floor(ctx!.sampleRate * seconds));
      const buf = ctx!.createBuffer(1, len, ctx!.sampleRate);
      const d = buf.getChannelData(0);
      if (color === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        }
      } else if (color === 'brown') {
        let last = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        }
      } else {
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      return buf;
    }

    function reverb(o: SoundEffect) {
      const decay = o.decay == null ? 0.5 : o.decay;
      const mix = o.mix == null ? 0.3 : o.mix;
      const damping = o.damping == null ? 0 : o.damping;
      const input = ctx!.createGain(), output = ctx!.createGain();
      const dry = ctx!.createGain(); dry.gain.value = 1 - mix;
      input.connect(dry); dry.connect(output);
      const wet = ctx!.createGain(); wet.gain.value = mix; input.connect(wet);
      const wetOut = ctx!.createGain(); wetOut.connect(output);
      const len = Math.ceil(ctx!.sampleRate * decay * (o.roomSize == null ? 1 : o.roomSize));
      const buf = ctx!.createBuffer(2, len, ctx!.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.28));
        if (damping > 0) {
          const c = Math.min(damping, 0.99);
          let prev = 0;
          for (let i = 0; i < len; i++) { prev = d[i] * (1 - c) + prev * c; d[i] = prev; }
        }
      }
      const conv = ctx!.createConvolver(); conv.buffer = buf;
      const pre = o.preDelay == null ? 0 : o.preDelay;
      if (pre > 0) {
        const pd = ctx!.createDelay(Math.max(pre + 0.01, 1));
        pd.delayTime.value = pre;
        wet.connect(pd); pd.connect(conv);
      } else {
        wet.connect(conv);
      }
      conv.connect(wetOut);
      return { input, output };
    }

    function shimmer(o: SoundEffect) {
      const input = ctx!.createGain(), output = ctx!.createGain();
      input.connect(output);
      const delay = ctx!.createDelay(1); delay.delayTime.value = o.delay || 0.1;
      const lp = ctx!.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lowpass == null ? 4000 : o.lowpass;
      const fb = ctx!.createGain(); fb.gain.value = o.feedback || 0.2;
      const wet = ctx!.createGain(); wet.gain.value = o.wet || 0.2;
      input.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay);
      lp.connect(wet); wet.connect(output);
      return { input, output };
    }

    const layers: SoundLayer[] = patch.layers || [patch as SoundLayer];

    for (const layer of layers) {
      if (!layer.source) continue;
      const t = t0 + (layer.delay || 0);
      const gain = layer.gain == null ? 0.5 : layer.gain;
      const env = layer.envelope;
      const a = env ? env.attack || 0 : 0;
      const d = env ? env.decay : 0;
      const sus = env ? env.sustain || 0 : 0;
      const rel = env ? env.release || 0 : 0;
      const dur = env ? a + d + rel : 0.5;

      const g = ctx.createGain();
      if (!env) {
        g.gain.setValueAtTime(gain, t);
        g.gain.setTargetAtTime(S, t, 0.15);
      } else if (env.curve === 'ramp') {
        const peak = Math.max(gain, S);
        g.gain.setValueAtTime(S, t);
        if (a > 0) g.gain.exponentialRampToValueAtTime(peak, t + a);
        else g.gain.setValueAtTime(peak, t);
        g.gain.exponentialRampToValueAtTime(S, t + a + d);
      } else {
        g.gain.setValueAtTime(S, t);
        if (a > 0) g.gain.linearRampToValueAtTime(gain, t + a);
        else g.gain.setValueAtTime(gain, t);
        if (sus > 0) {
          g.gain.setTargetAtTime(Math.max(sus * gain, S), t + a, d / 3);
          if (rel > 0) g.gain.setTargetAtTime(S, t + a + d, rel / 3);
        } else {
          g.gain.setTargetAtTime(S, t + a, d / 3);
        }
      }

      let src: AudioBufferSourceNode | OscillatorNode;
      const s = layer.source;
      if (s.type === 'noise') {
        const nsrc = ctx.createBufferSource();
        nsrc.buffer = noiseBuffer(dur + 0.1, s.color);
        src = nsrc;
      } else {
        const osc = ctx.createOscillator();
        osc.type = s.type;
        const f = s.frequency;
        if (typeof f === 'number') {
          osc.frequency.setValueAtTime(f, t);
        } else if (f) {
          osc.frequency.setValueAtTime(f.start, t);
          osc.frequency.exponentialRampToValueAtTime(Math.max(f.end, 1), t + Math.min(f.time == null ? dur : f.time, dur));
        }
        if (s.detune) osc.detune.value = s.detune;
        if (s.fm) {
          const carrier = typeof f === 'number' ? f : (f?.start || 440);
          const mod = ctx.createOscillator();
          mod.type = 'sine';
          mod.frequency.value = carrier * s.fm.ratio;
          const mg = ctx.createGain();
          mg.gain.value = s.fm.depth;
          mod.connect(mg); mg.connect(osc.frequency);
          mod.start(t); mod.stop(t + dur + 0.1);
        }
        src = osc;
      }
      src.start(t); src.stop(t + dur + 0.1);

      let node: AudioNode = src;
      const filters = !layer.filter ? [] : (Array.isArray(layer.filter) ? layer.filter : [layer.filter]);
      for (const f of filters) {
        const bq = ctx.createBiquadFilter();
        bq.type = f.type;
        bq.frequency.setValueAtTime(f.frequency, t);
        bq.Q.value = f.Q == null ? (f.resonance == null ? 1 : f.resonance) : f.Q;
        if (f.envelope) {
          const peakAt = t + (f.envelope.attack || 0);
          bq.frequency.linearRampToValueAtTime(f.envelope.peak, peakAt);
          bq.frequency.exponentialRampToValueAtTime(Math.max(f.frequency, 1), peakAt + f.envelope.decay);
        }
        node.connect(bq); node = bq;
      }
      node.connect(g);

      let out: AudioNode = g;
      for (const fx of (layer.effects || [])) {
        const built = fx.type === 'reverb' ? reverb(fx) : fx.type === 'delay' ? shimmer(fx) : null;
        if (!built) continue;
        out.connect(built.input); out = built.output;
      }
      out.connect(ctx.destination);
    }
  } catch (err) {
    console.warn('[Inspo Sound] Play error:', err);
  }
}

/**
 * Curated Minimalist Sound Patches (Linear Acoustic Design)
 */
export const SoundPresets = {
  // Tactile save pop (Linear Acid-Lime Save feedback)
  savePop: {
    layers: [
      // Transient click
      {
        gain: 0.22,
        source: { type: 'sine', frequency: { start: 1200, end: 420, time: 0.04 } },
        envelope: { attack: 0.001, decay: 0.05 },
      },
      // Warm resonant chime body
      {
        delay: 0.02,
        gain: 0.18,
        source: { type: 'sine', frequency: 880 },
        envelope: { attack: 0.005, decay: 0.18, sustain: 0 },
        filter: { type: 'lowpass', frequency: 2400 },
        effects: [{ type: 'reverb', decay: 0.35, mix: 0.25 }],
      },
    ],
  } as SoundPatch,

  // Note saved confirmation (Two-tone upward gentle chime)
  noteSaved: {
    layers: [
      {
        gain: 0.15,
        source: { type: 'sine', frequency: 784 }, // G5
        envelope: { attack: 0.002, decay: 0.12 },
        effects: [{ type: 'reverb', decay: 0.3, mix: 0.2 }],
      },
      {
        delay: 0.06,
        gain: 0.18,
        source: { type: 'sine', frequency: 1046.5 }, // C6
        envelope: { attack: 0.002, decay: 0.2 },
        effects: [{ type: 'reverb', decay: 0.4, mix: 0.25 }],
      },
    ],
  } as SoundPatch,

  // Subtle tap / switch click
  clickTap: {
    gain: 0.12,
    source: { type: 'noise', color: 'pink' },
    envelope: { attack: 0.001, decay: 0.03 },
    filter: { type: 'bandpass', frequency: 1800, Q: 3 },
  } as SoundPatch,

  // Subtle delete / discard mute click
  deletePop: {
    layers: [
      {
        gain: 0.18,
        source: { type: 'sine', frequency: { start: 400, end: 120, time: 0.06 } },
        envelope: { attack: 0.001, decay: 0.08 },
      },
      {
        gain: 0.08,
        source: { type: 'noise', color: 'brown' },
        envelope: { attack: 0.001, decay: 0.04 },
      },
    ],
  } as SoundPatch,

  // Export completion celebration chime (Soft triad)
  exportSuccess: {
    layers: [
      {
        gain: 0.14,
        source: { type: 'sine', frequency: 523.25 }, // C5
        envelope: { attack: 0.005, decay: 0.25 },
        effects: [{ type: 'reverb', decay: 0.6, mix: 0.3 }],
      },
      {
        delay: 0.08,
        gain: 0.15,
        source: { type: 'sine', frequency: 659.25 }, // E5
        envelope: { attack: 0.005, decay: 0.28 },
        effects: [{ type: 'reverb', decay: 0.6, mix: 0.3 }],
      },
      {
        delay: 0.16,
        gain: 0.18,
        source: { type: 'sine', frequency: 1046.5 }, // C6
        envelope: { attack: 0.005, decay: 0.45 },
        effects: [{ type: 'reverb', decay: 0.8, mix: 0.35 }],
      },
    ],
  } as SoundPatch,
};

/**
 * Convenience helper that checks user settings before playing
 */
export function playHapticSound(patch: SoundPatch): void {
  try {
    playSound(patch);
  } catch {
    // ignore
  }
}
