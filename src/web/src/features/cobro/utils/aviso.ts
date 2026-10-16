// Confirmación que no depende de mirar la pantalla: vibración y un tono corto
// (agudo = válido, grave y doble = rechazado). Si el navegador no lo permite,
// no pasa nada.
export const avisar = (ok: boolean) => {
  navigator.vibrate?.(ok ? 80 : [60, 60, 60]);
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const tono = (freq: number, inicio: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, ctx.currentTime + inicio);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + inicio + 0.16,
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + 0.17);
    };
    if (ok) tono(880, 0);
    else {
      tono(220, 0);
      tono(220, 0.2);
    }
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // sin audio
  }
};
