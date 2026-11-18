// ระบบเสียงปืนลูกโม่สมจริง (รองรับทั้งไฟล์เสียง .mp3 จริง และเสียงสังเคราะห์ความละเอียดสูงอัตโนมัติ)

export type RevolverSoundEvent = 'spin' | 'cock' | 'dry' | 'fire' | 'heartbeat';

const SOUND_FILE_PATHS: Record<Exclude<RevolverSoundEvent, 'heartbeat'>, string> = {
  spin: '/sounds/revolver-spin.mp3',
  cock: '/sounds/revolver-cock.mp3',
  dry: '/sounds/revolver-dry.mp3',
  fire: '/sounds/revolver-fire.mp3',
};

export class RevolverSoundEngine {
  private ctx: AudioContext | null = null;
  private fileBuffers: Partial<Record<RevolverSoundEvent, AudioBuffer>> = {};
  private checkedFiles = false;
  private volumeMultiplier = 0.85;
  private muted = false;

  public setOutputConfig(volume: number, muted: boolean) {
    this.volumeMultiplier = Math.max(0, Math.min(1, volume));
    this.muted = muted;
  }

  private getContext(): AudioContext | null {
    if (this.muted || this.volumeMultiplier <= 0.001) return null;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (!this.checkedFiles) {
        this.checkedFiles = true;
        this.preloadOptionalSoundFiles();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private async preloadOptionalSoundFiles() {
    const ctx = this.ctx;
    if (!ctx) return;

    const entries = Object.entries(SOUND_FILE_PATHS) as Array<
      [Exclude<RevolverSoundEvent, 'heartbeat'>, string]
    >;

    for (const [key, url] of entries) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/html')) continue;
        const arrBuf = await res.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrBuf);
        this.fileBuffers[key] = audioBuf;
      } catch {
        // ใช้เสียงสังเคราะห์แทนโดยอัตโนมัติ
      }
    }
  }

  private playBufferIfLoaded(event: RevolverSoundEvent, volume = 0.85): boolean {
    const ctx = this.getContext();
    const buf = this.fileBuffers[event];
    if (!ctx || !buf) return false;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = volume * this.volumeMultiplier;
    src.connect(gain).connect(ctx.destination);
    src.start(ctx.currentTime);
    return true;
  }

  private createRoomReverb(ctx: AudioContext, duration = 0.9, decay = 3.2): ConvolverNode {
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  // 1. เสียงหมุนโม่กระสุนลูกโม่ (แกร๊กๆๆ แล้วล็อกเข้าที่)
  public playSpin() {
    if (this.playBufferIfLoaded('spin', 0.85)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const v = this.volumeMultiplier;
    const now = ctx.currentTime;
    const offsets = [0, 0.045, 0.095, 0.15, 0.215, 0.29, 0.375, 0.475, 0.58];

    offsets.forEach((offset, idx) => {
      const t = now + offset;
      const isFinalLock = idx === offsets.length - 1;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isFinalLock ? 2450 : 1850 + (idx % 3) * 180, t);
      osc.frequency.exponentialRampToValueAtTime(isFinalLock ? 620 : 480, t + 0.025);

      gain.gain.setValueAtTime((isFinalLock ? 0.3 : 0.18) * v, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.032);

      const highOsc = ctx.createOscillator();
      const highGain = ctx.createGain();
      highOsc.type = 'sine';
      highOsc.frequency.setValueAtTime(4200, t);
      highOsc.frequency.exponentialRampToValueAtTime(1600, t + 0.018);
      highGain.gain.setValueAtTime(0.09 * v, t);
      highGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

      osc.connect(gain).connect(ctx.destination);
      highOsc.connect(highGain).connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.035);
      highOsc.start(t);
      highOsc.stop(t + 0.022);
    });
  }

  // 2. เสียงง้างนกสับปืนลูกโม่ 2 จังหวะ (แกร๊ก-กริ๊ก!)
  public playCock() {
    if (this.playBufferIfLoaded('cock', 0.9)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const v = this.volumeMultiplier;
    const now = ctx.currentTime;
    const clicks = [
      { time: now, freqStart: 1650, freqEnd: 520, vol: 0.25 * v },
      { time: now + 0.075, freqStart: 2700, freqEnd: 780, vol: 0.38 * v },
    ];

    clicks.forEach((c) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(c.freqStart, c.time);
      osc.frequency.exponentialRampToValueAtTime(c.freqEnd, c.time + 0.035);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2100;
      filter.Q.value = 2.5;

      gain.gain.setValueAtTime(c.vol, c.time);
      gain.gain.exponentialRampToValueAtTime(0.001, c.time + 0.042);

      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(c.time);
      osc.stop(c.time + 0.045);
    });
  }

  // 3. เสียงยิงไม่ออก (นกสับฟาดเข็มแทงชนวนช่องว่าง: แชะ!)
  public playDryFire() {
    if (this.playBufferIfLoaded('dry', 0.95)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const v = this.volumeMultiplier;
    const now = ctx.currentTime;
    const reverb = this.createRoomReverb(ctx, 0.55, 4.0);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.35 * v;
    reverb.connect(reverbGain).connect(ctx.destination);

    const trigOsc = ctx.createOscillator();
    const trigGain = ctx.createGain();
    trigOsc.type = 'triangle';
    trigOsc.frequency.setValueAtTime(1200, now);
    trigOsc.frequency.exponentialRampToValueAtTime(380, now + 0.02);
    trigGain.gain.setValueAtTime(0.22 * v, now);
    trigGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
    trigOsc.connect(trigGain).connect(ctx.destination);
    trigOsc.start(now);
    trigOsc.stop(now + 0.025);

    const snapTime = now + 0.018;
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'square';
    snapOsc.frequency.setValueAtTime(2950, snapTime);
    snapOsc.frequency.exponentialRampToValueAtTime(420, snapTime + 0.038);

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 800;

    snapGain.gain.setValueAtTime(0.42 * v, snapTime);
    snapGain.gain.exponentialRampToValueAtTime(0.001, snapTime + 0.045);

    snapOsc.connect(hp).connect(snapGain);
    snapGain.connect(ctx.destination);
    snapGain.connect(reverb);

    snapOsc.start(snapTime);
    snapOsc.stop(snapTime + 0.05);
  }

  // 4. เสียงปืนลูกโม่ .357 Magnum ลั่น (ระเบิดดินปืน + แรงอัด + เสียงก้องห้อง + หูอื้อ)
  public playLiveFire() {
    if (this.playBufferIfLoaded('fire', 1.0)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const v = this.volumeMultiplier;
    const now = ctx.currentTime;
    const reverb = this.createRoomReverb(ctx, 1.35, 2.6);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.55 * v;
    reverb.connect(reverbGain).connect(ctx.destination);

    const crackSize = Math.floor(ctx.sampleRate * 0.09);
    const crackBuf = ctx.createBuffer(1, crackSize, ctx.sampleRate);
    const crackData = crackBuf.getChannelData(0);
    for (let i = 0; i < crackSize; i++) {
      crackData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.018));
    }
    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = crackBuf;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.95 * v, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    crackSrc.connect(crackGain);
    crackGain.connect(ctx.destination);
    crackGain.connect(reverb);
    crackSrc.start(now);

    const blastSize = Math.floor(ctx.sampleRate * 0.65);
    const blastBuf = ctx.createBuffer(1, blastSize, ctx.sampleRate);
    const blastData = blastBuf.getChannelData(0);
    for (let i = 0; i < blastSize; i++) {
      blastData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.13));
    }
    const blastSrc = ctx.createBufferSource();
    blastSrc.buffer = blastBuf;

    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(3400, now);
    lpFilter.frequency.exponentialRampToValueAtTime(160, now + 0.6);

    const blastGain = ctx.createGain();
    blastGain.gain.setValueAtTime(0.92 * v, now);
    blastGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    blastSrc.connect(lpFilter).connect(blastGain);
    blastGain.connect(ctx.destination);
    blastGain.connect(reverb);
    blastSrc.start(now);

    const punchOsc = ctx.createOscillator();
    const punchGain = ctx.createGain();
    punchOsc.type = 'sine';
    punchOsc.frequency.setValueAtTime(195, now);
    punchOsc.frequency.exponentialRampToValueAtTime(26, now + 0.34);
    punchGain.gain.setValueAtTime(0.95 * v, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    punchOsc.connect(punchGain).connect(ctx.destination);
    punchOsc.start(now);
    punchOsc.stop(now + 0.38);

    const ringOsc = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(3250, now + 0.08);
    ringGain.gain.setValueAtTime(0.001, now);
    ringGain.gain.linearRampToValueAtTime(0.14 * v, now + 0.25);
    ringGain.gain.exponentialRampToValueAtTime(0.0008, now + 2.2);
    ringOsc.connect(ringGain).connect(ctx.destination);
    ringOsc.start(now + 0.05);
    ringOsc.stop(now + 2.25);
  }

  // 5. เสียงหัวใจเต้นเร่งจังหวะตอนจ่อปืน
  public playHeartbeat(intensity = 0.5) {
    const ctx = this.getContext();
    if (!ctx) return;
    const v = this.volumeMultiplier;
    const now = ctx.currentTime;
    const vol = Math.min(0.65, 0.22 + intensity * 0.42) * v;

    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(76, now);
    osc1.frequency.exponentialRampToValueAtTime(32, now + 0.14);
    g1.gain.setValueAtTime(vol, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc1.connect(g1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.17);

    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(62, now + 0.18);
    osc2.frequency.exponentialRampToValueAtTime(28, now + 0.32);
    g2.gain.setValueAtTime(vol * 0.75, now + 0.18);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc2.connect(g2).connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.35);
  }
}

export const revolverSound = new RevolverSoundEngine();
