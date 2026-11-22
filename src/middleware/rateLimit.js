// Limiteur de débit en mémoire, sans dépendance. Complément des verrouillages
// stockés en base (voir auth.routes.js) : en serverless chaque instance a son
// propre compteur, donc il freine les rafales mais ne remplace pas le
// verrouillage par compte.
function rateLimit({ windowMs, max, message, key }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const id = key ? key(req) : req.ip;
    const entry = hits.get(id);
    if (!entry || entry.reset <= now) {
      hits.set(id, { count: 1, reset: now + windowMs });
    } else {
      entry.count += 1;
      if (entry.count > max) {
        const retryAfter = Math.ceil((entry.reset - now) / 1000);
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({
          error: message || 'Trop de requêtes, réessayez plus tard',
          message: message || 'Trop de requêtes, réessayez plus tard',
          secondsRemaining: retryAfter
        });
      }
    }
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    }
    next();
  };
}

module.exports = rateLimit;
