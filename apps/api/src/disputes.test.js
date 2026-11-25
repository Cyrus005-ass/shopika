import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import http from 'http';
const require = createRequire(import.meta.url);
const { validateOpen, validateMessage, roleInDispute, recipientsOf } = require('./lib/disputes');

describe('règles de litige (pures)', () => {
  it("l'ouverture exige un motif connu et une description d'au moins 10 caractères", () => {
    expect(validateOpen({ reason: 'volé', description: 'x'.repeat(20) }).ok).toBe(false);
    expect(validateOpen({ reason: 'non_recu', description: 'court' }).ok).toBe(false);
    expect(validateOpen({ reason: 'non_recu', description: 'x'.repeat(2001) }).ok).toBe(false);
    expect(validateOpen({ reason: 'non_recu', description: '  Le colis n’est jamais arrivé  ' })).toMatchObject({ ok: true, reason: 'non_recu', description: 'Le colis n’est jamais arrivé' });
  });
  it('sans motif (ancien client), repli sur « autre »', () => {
    expect(validateOpen({})).toMatchObject({ ok: true, reason: 'autre' });
    expect(validateOpen(undefined)).toMatchObject({ ok: true, reason: 'autre' });
  });
  it("n'accepte que nos propres images en pièce jointe", () => {
    const prefix = 'https://x.supabase.co/storage/v1/object/public/product-images/disputes/';
    expect(validateMessage({ body: 'ok', attachmentUrl: prefix + 'a.jpg' }, prefix).ok).toBe(true);
    expect(validateMessage({ body: 'ok', attachmentUrl: 'https://evil.test/a.jpg' }, prefix).ok).toBe(false);
    expect(validateMessage({ body: 'ok', attachmentUrl: 'javascript:alert(1)' }, prefix).ok).toBe(false);
    expect(validateMessage({ body: '   ' }, prefix).ok).toBe(false);
    expect(validateMessage({ body: 'x'.repeat(2001) }, prefix).ok).toBe(false);
  });
  const so = { order: { clientId: 10 }, store: { merchantId: 20 } };
  it('seules les parties concernées (et les admins) ont un rôle dans le litige', () => {
    expect(roleInDispute({ id: 10, role: 'client' }, so)).toBe('client');
    expect(roleInDispute({ id: 20, role: 'marchand' }, so)).toBe('marchand');
    expect(roleInDispute({ id: 1, role: 'admin' }, so)).toBe('admin');
    expect(roleInDispute({ id: 11, role: 'client' }, so)).toBeNull();
    expect(roleInDispute({ id: 21, role: 'marchand' }, so)).toBeNull();
  });
  it("on prévient les autres parties, jamais l'auteur", () => {
    expect(recipientsOf('client', so)).toEqual({ userIds: [20], admins: true });
    expect(recipientsOf('marchand', so)).toEqual({ userIds: [10], admins: true });
    expect(recipientsOf('admin', so)).toEqual({ userIds: [10, 20], admins: false });
  });
});

// ---- Routes réelles avec Prisma simulé ----
const db = {
  users: { 10: { tokenVersion: 0 }, 11: { tokenVersion: 0 }, 20: { tokenVersion: 0 }, 21: { tokenVersion: 0 }, 1: { tokenVersion: 0 } },
  storeOrder: { id: 5, orderId: 3, subtotal: 15000, order: { id: 3, clientId: 10 }, store: { id: 1, name: 'Maré', merchantId: 20 },
    dispute: { id: 9, reason: 'non_recu', description: 'Colis jamais arrivé', status: 'ouvert', adminNote: null, createdAt: new Date(), resolvedAt: null, messages: [] } },
  created: [], notifications: [],
};
const fakePrisma = {
  user: { findUnique: async ({ where }) => db.users[where.id] ? { ...db.users[where.id], isActive: true } : null, findMany: async () => [{ id: 1 }] },
  storeOrder: {
    findUnique: async ({ where }) => (where.id === 5 ? db.storeOrder : null),
    findMany: async ({ where }) => {
      const so = db.storeOrder;
      const ok = (where.order && where.order.clientId === so.order.clientId) || (where.store && where.store.merchantId === so.store.merchantId);
      return ok ? [so] : [];
    },
  },
  disputeMessage: { create: async ({ data }) => { const m = { id: db.created.length + 1, ...data, createdAt: new Date(), author: { fullName: 'Quelqu’un' } }; db.created.push(m); db.storeOrder.dispute.messages.push(m); return m; } },
  notification: { create: async ({ data }) => { db.notifications.push(data); return data; } },
};
let server, base, jwt;
const tokenFor = (id, role) => jwt.sign({ id, role, tokenVersion: 0 }, 'test-secret');
const call = (path, { token, method = 'GET', body } = {}) => fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret'; process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL = 'http://localhost:54321'; process.env.SUPABASE_SERVICE_KEY = 'k';
  require.cache[require.resolve('@prisma/client')] = { id: 'x', filename: 'x', loaded: true, exports: { PrismaClient: class { constructor() { return fakePrisma; } }, Prisma: {} } };
  jwt = require('jsonwebtoken');
  const app = require('./app');
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}/api/disputes`;
});
afterAll(() => server && server.close());

describe('routes /api/disputes', () => {
  it('exigent une connexion', async () => {
    expect((await call('/5')).status).toBe(401);
    expect((await call('/5/messages', { method: 'POST', body: { body: 'salut' } })).status).toBe(401);
  });
  it('un tiers ne voit même pas que le litige existe (404)', async () => {
    expect((await call('/5', { token: tokenFor(11, 'client') })).status).toBe(404);
    expect((await call('/5', { token: tokenFor(21, 'marchand') })).status).toBe(404);
    expect((await call('/5/messages', { token: tokenFor(11, 'client'), method: 'POST', body: { body: 'intrus' } })).status).toBe(404);
  });
  it('le client, le marchand et l’admin lisent le litige', async () => {
    for (const [id, role] of [[10, 'client'], [20, 'marchand'], [1, 'admin']]) {
      const r = await call('/5', { token: tokenFor(id, role) });
      expect(r.status).toBe(200);
      const j = await r.json();
      expect(j).toMatchObject({ viewerRole: role, reasonLabel: 'Colis non reçu', amount: 15000 });
    }
  });
  it('un message est enregistré avec le bon rôle et prévient les autres parties', async () => {
    const r = await call('/5/messages', { token: tokenFor(20, 'marchand'), method: 'POST', body: { body: 'Voici ma preuve d’envoi' } });
    expect(r.status).toBe(201);
    expect(db.created.at(-1)).toMatchObject({ authorId: 20, authorRole: 'marchand', disputeId: 9 });
    const targets = db.notifications.map((n) => n.userId).sort();
    expect(targets).toContain(10); // le client est prévenu
    expect(targets).toContain(1);  // l'admin aussi
    expect(targets).not.toContain(20); // pas l'auteur
  });
  it('refuse une pièce jointe venant d’ailleurs et un message vide', async () => {
    expect((await call('/5/messages', { token: tokenFor(10, 'client'), method: 'POST', body: { body: 'x', attachmentUrl: 'https://evil.test/a.jpg' } })).status).toBe(400);
    expect((await call('/5/messages', { token: tokenFor(10, 'client'), method: 'POST', body: { body: '  ' } })).status).toBe(400);
  });
  it('un litige résolu n’accepte plus de messages', async () => {
    db.storeOrder.dispute.status = 'resolu_client';
    expect((await call('/5/messages', { token: tokenFor(10, 'client'), method: 'POST', body: { body: 'encore' } })).status).toBe(400);
    db.storeOrder.dispute.status = 'ouvert';
  });
  it('la liste est limitée à mes propres litiges', async () => {
    expect((await (await call('/', { token: tokenFor(10, 'client') })).json())).toHaveLength(1);
    expect((await (await call('/', { token: tokenFor(11, 'client') })).json())).toHaveLength(0);
    expect((await (await call('/', { token: tokenFor(20, 'marchand') })).json())).toHaveLength(1);
    expect((await call('/', { token: tokenFor(1, 'admin') })).status).toBe(403);
  });
});
