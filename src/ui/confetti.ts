const COLORS = ['#C8402A', '#1F6F6B', '#FFFDF6', '#23201C', '#E9B33B'];

/** Falling outlined paper confetti. Returns a stop function. No-op under reduced motion. */
export function startConfetti(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext?.('2d');
  if (!ctx || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};
  const dpr = window.devicePixelRatio || 1;
  let w = 0;
  let hgt = 0;
  const resize = () => {
    w = canvas.clientWidth;
    hgt = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = hgt * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const bits = Array.from({ length: 90 }, (_, i) => ({
    x: Math.random() * w,
    y: Math.random() * -hgt,
    size: 10 + (i % 3) * 6,
    speed: 1.2 + Math.random() * 2.2,
    spin: (Math.random() - 0.5) * 0.2,
    angle: Math.random() * Math.PI,
    sway: Math.random() * Math.PI * 2,
    color: COLORS[i % COLORS.length]!,
  }));
  let raf = 0;
  const frame = () => {
    ctx.clearRect(0, 0, w, hgt);
    for (const b of bits) {
      b.y += b.speed;
      b.sway += 0.03;
      b.x += Math.sin(b.sway) * 0.6;
      b.angle += b.spin;
      if (b.y > hgt + 20) { b.y = -20; b.x = Math.random() * w; }
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillStyle = b.color;
      ctx.strokeStyle = '#23201C';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-b.size / 2, -b.size / 4, b.size, b.size / 2, 3);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  window.addEventListener('resize', resize);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}
