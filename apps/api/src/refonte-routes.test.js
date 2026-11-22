import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createRequire } from 'module';
import http from 'http';
const require = createRequire(import.meta.url);

// Prisma simulé en mémoire : on teste les VRAIES routes Express sans base de données.
const db = {
  users: [{ id: 7, email: 'awa@example.com', isActive: true, passwordHash: 'old-hash', tokenVersion: 0, role: 'client' }],
  stores: [{ id: 1, subdomain: 'deja-pris' }],
  updates: [],
};
const fakePrisma = {
  user: {
    findUnique: async ({ where }) => db.users.find((u) => (where.email ? u.email === where.email : u.id === where.id)) || null,
    update: async ({ where, data }) => {
      const u = db.users.find((x) => x.id === where.id);
      db.updates.push(data);
      if (data.passwordHash) u.passwordHash = data.passwordHash;
      return u;
    },
  },
  store: { findUnique: async ({ where }) => db.stores.find((s) => s.subdomain === where.subdomain) || null },
};
let server, base;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_KEY = 'test-key';
  delete process.env.SMTP_HOST;
  require.cache[require.resolve('@prisma/client')] = { id: 'x', filename: 'x', loaded: true, exports: { PrismaClient: class { constructor() { return fakePrisma; } }, Prisma: {} } };
  const app = require('./app');
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => server && server.close());

const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('routes publiques de la boutique', () => {
  it('GET /stores/pricing expose les tarifs', async () => {
    const j = await (await fetch(base + '/stores/pricing')).json();
    expect(j.creationFee).toBeGreaterThan(0);
    expect(j.monthlyFee).toBeGreaterThan(0);
    expect(j.currency).toBe('XOF');
  });
  it('GET /stores/check-subdomain : réservé, pris, libre', async () => {
    expect((await (await fetch(base + '/stores/check-subdomain?name=admin')).json()).available).toBe(false);
    expect((await (await fetch(base + '/stores/check-subdomain?name=deja-pris')).json()).available).toBe(false);
    expect(await (await fetch(base + '/stores/check-subdomain?name=Ma-Boutique')).json()).toEqual({ available: true, value: 'ma-boutique' });
  });
});

describe('sécurité', () => {
  it('les routes de test ont disparu', async () => {
    expect((await fetch(base + '/auth/test-error')).status).toBe(404);
  });
  it("l'upload d'image exige une connexion", async () => {
    expect((await post('/products/upload-image', {})).status).toBe(401);
  });
  it('les crons sont fermés sans secret', async () => {
    delete process.env.CRON_SECRET;
    for (const p of ['expire-orders', 'auto-confirm', 'subscription-reminders']) {
      expect((await fetch(base + '/cron/' + p)).status).toBe(401);
    }
    process.env.CRON_SECRET = 'abc';
    expect((await fetch(base + '/cron/auto-confirm', { headers: { authorization: 'Bearer faux' } })).status).toBe(401);
  });
  it('les routes marchand refusent un visiteur', async () => {
    for (const p of ['customers', 'finance', 'stats']) expect((await fetch(base + '/stores/me/' + p)).status).toBe(401);
  });
});

describe('mot de passe oublié', () => {
  it('répond pareil que le compte existe ou non', async () => {
    const a = await (await post('/auth/forgot-password', { email: 'inconnu@example.com' })).json();
    const b = await (await post('/auth/forgot-password', { email: 'awa@example.com' })).json();
    expect(a).toEqual(b);
    expect(a.ok).toBe(true);
  });

  it('le lien reçu permet UN changement, puis devient invalide', async () => {
    const logs = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...a) => logs.push(a));
    await post('/auth/forgot-password', { email: 'awa@example.com' });
    spy.mockRestore();
    const link = logs.find((l) => String(l[0]).includes('Lien de réinitialisation'))?.[1]?.link;
    expect(link).toContain('/reinitialiser.html?token=');
    const token = decodeURIComponent(link.split('token=')[1]);

    expect((await post('/auth/reset-password', { token, password: '123' })).status).toBe(400); // trop court
    expect((await post('/auth/reset-password', { token: 'n-importe-quoi', password: 'nouveau-mdp' })).status).toBe(400);

    const ok = await post('/auth/reset-password', { token, password: 'nouveau-mdp' });
    expect(ok.status).toBe(200);
    expect(db.updates.at(-1)).toMatchObject({ tokenVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null });
    expect(db.updates.at(-1).passwordHash).not.toBe('old-hash');

    // Le même lien une seconde fois : refusé (le mot de passe a changé).
    expect((await post('/auth/reset-password', { token, password: 'encore-un-autre' })).status).toBe(400);
  });

  it("un jeton de connexion ordinaire ne peut pas servir à réinitialiser", async () => {
    const jwt = require('jsonwebtoken');
    const login = jwt.sign({ id: 7, role: 'client', tokenVersion: 0 }, 'test-secret', { expiresIn: '7d' });
    expect((await post('/auth/reset-password', { token: login, password: 'pirate-mdp' })).status).toBe(400);
  });
});
