import React from 'react';

// Courbe SVG sans dépendance. `data` : [{ date: 'YYYY-MM-DD', amount, orders }]
export default function AreaChart({ data, height = 220 }) {
  const W = 720, H = height, padL = 46, padR = 14, padT = 14, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(...data.map((d) => d.amount), 1);
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;
  const pts = data.map((d, i) => ({ x: padL + step * i, y: padT + innerH - (d.amount / max) * innerH, ...d }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${padT + innerH} L${pts[0].x.toFixed(1)} ${padT + innerH} Z`;
  const ticks = [0, 0.5, 1];
  const label = (d) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const every = Math.ceil(data.length / 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Volume des ventes sur 30 jours">
      <defs>
        <linearGradient id="admLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#FA1757" /><stop offset="100%" stopColor="#FC7914" /></linearGradient>
        <linearGradient id="admArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FA1757" stopOpacity="0.2" /><stop offset="100%" stopColor="#FC7914" stopOpacity="0" /></linearGradient>
      </defs>
      {ticks.map((f) => {
        const y = padT + innerH * f;
        return (
          <g key={f}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#eceef3" />
            <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#9aa0b4">{Math.round((max * (1 - f)) / 1000)}k</text>
          </g>
        );
      })}
      <path d={area} fill="url(#admArea)" className="chart-fade" />
      <path d={line} fill="none" stroke="url(#admLine)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="chart-draw" />
      {pts.map((p, i) => (
        <g key={p.date}>
          {p.orders > 0 && <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#FA1757" strokeWidth="2.5"><title>{`${label(p.date)} : ${Math.round(p.amount).toLocaleString('fr-FR')} FCFA · ${p.orders} commande(s)`}</title></circle>}
          {i % every === 0 && <text x={p.x} y={H - 8} textAnchor="middle" fontSize="11" fill="#9aa0b4">{label(p.date)}</text>}
        </g>
      ))}
    </svg>
  );
}
