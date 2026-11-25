import React, { useEffect, useRef, useState } from 'react';

// Compteur animé (respecte prefers-reduced-motion). `format` : fonction d'affichage (ex. FCFA).
export default function CountUp({ value, duration = 1000, format = (n) => Math.round(n).toLocaleString('fr-FR') }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from.current === target) { setShown(target); from.current = target; return undefined; }
    const start = performance.now();
    const origin = from.current;
    let raf;
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      setShown(origin + (target - origin) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{format(shown)}</>;
}
