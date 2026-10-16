function soundWallHit() {
  if (!soundEnabled || !audioCtx) return;
  const t0 = audioCtx.currentTime;

  // Мягкий подводный "бум" — низкий тон + короткий шум через фильтр
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, t0);
  osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.25);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(200, t0);
  filter.Q.value = 1;

  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.35);

  // Второй тон — чуть выше для "тела" удара
  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(140, t0);
  osc2.frequency.exponentialRampToValueAtTime(70, t0 + 0.15);
  gain2.gain.setValueAtTime(0, t0);
  gain2.gain.linearRampToValueAtTime(0.08, t0 + 0.01);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);
  osc2.start(t0);
  osc2.stop(t0 + 0.2);
}
