import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { validateSubdomain, validatePhone, validateStoreName, sniffImageType } = require('./lib/validators');
const { aggregateCustomers, summarizeFinance, buildStats } = require('./modules/stores/stores.service');
const { passwordResetEmailHtml, subscriptionReminderEmailHtml, merchantOrderEmailHtml } = require('./lib/email');

describe('validateSubdomain', () => {
  it('accepte un nom valide et le met en minuscules', () => {
    expect(validateSubdomain('  Ma-Boutique2 ')).toMatchObject({ ok: true, value: 'ma-boutique2' });
  });
  it.each(['ab', 'a'.repeat(31), '-abc', 'abc-', 'a--b', 'a b', 'é-shop', 'admin', 'www', 'api'])('refuse « %s »', (v) => {
    expect(validateSubdomain(v).ok).toBe(false);
  });
});

describe('validatePhone / validateStoreName', () => {
  it('tolère espaces, tirets et indicatif', () => {
    expect(validatePhone('+229 97-00-00-00')).toMatchObject({ ok: true, value: '+22997000000' });
    expect(validatePhone('0711111111').ok).toBe(true);
  });
  it('refuse les numéros trop courts ou contenant des lettres', () => {
    expect(validatePhone('12345').ok).toBe(false);
    expect(validatePhone('07abc11111').ok).toBe(false);
  });
  it('borne la longueur du nom de boutique', () => {
    expect(validateStoreName('A').ok).toBe(false);
    expect(validateStoreName('x'.repeat(61)).ok).toBe(false);
    expect(validateStoreName('  Maré Studio ').value).toBe('Maré Studio');
  });
});

describe('sniffImageType', () => {
  const pad = (b) => Buffer.concat([Buffer.from(b), Buffer.alloc(16)]);
  it('reconnaît JPEG, PNG et WebP réels', () => {
    expect(sniffImageType(pad([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('jpg');
    expect(sniffImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe('png');
    expect(sniffImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]))?.ext).toBe('webp');
  });
  it('refuse du HTML ou du SVG déguisés en image', () => {
    expect(sniffImageType(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="x"/>'))).toBeNull();
    expect(sniffImageType(Buffer.alloc(3))).toBeNull();
  });
});

describe('stores.service', () => {
  const rows = [
    { subtotal: 10000, createdAt: '2026-10-01', status: 'livree', escrowStatus: 'libere', order: { clientId: 1, deliveryPhone: '0700', client: { fullName: 'Awa', email: 'a@x.co', phone: null } } },
    { subtotal: 5000, createdAt: '2026-11-02', status: 'livree', escrowStatus: 'libere', order: { clientId: 1, deliveryPhone: '0700', client: { fullName: 'Awa', email: 'a@x.co', phone: null } } },
    { subtotal: 7000, createdAt: '2026-11-03', status: 'expediee', escrowStatus: 'rembourse', order: { clientId: 2, deliveryPhone: null, client: { fullName: 'Koffi', email: null, phone: '0555' } } },
  ];
  it('regroupe les clients, ignore les remboursés dans le total dépensé', () => {
    const c = aggregateCustomers(rows);
    expect(c[0]).toMatchObject({ clientId: 1, orders: 2, totalSpent: 15000, segment: 'regulier' });
    expect(c[1]).toMatchObject({ clientId: 2, orders: 1, totalSpent: 0, segment: 'nouveau', phone: '0555' });
  });
  it('sépare séquestre, à verser, versé, remboursé', () => {
    const s = summarizeFinance([
      { subtotal: 100, escrowStatus: 'bloque' }, { subtotal: 200, escrowStatus: 'libere', payoutStatus: 'en_attente' },
      { subtotal: 300, escrowStatus: 'libere', payoutStatus: 'effectue' }, { subtotal: 400, escrowStatus: 'rembourse' },
      { subtotal: 50, escrowStatus: 'libere', payoutStatus: 'en_cours' },
    ]);
    expect(s).toEqual({ enSequestre: 100, aVerser: 200, verse: 300, rembourse: 400, enCours: 50 });
  });
  it('construit 6 mois, le panier moyen et le top produits', () => {
    const now = new Date(2026, 10, 15);
    const st = buildStats(
      [{ quantity: 2, unitPrice: 3000, product: { name: 'Parfum' } }, { quantity: 1, unitPrice: 1000, product: { name: 'Sac' } }],
      [{ subtotal: 6000, createdAt: new Date(2026, 10, 2), status: 'livree', escrowStatus: 'libere' }, { subtotal: 2000, createdAt: new Date(2026, 9, 5), status: 'livree', escrowStatus: 'libere' }],
      now
    );
    expect(st.months).toHaveLength(6);
    expect(st.months.at(-1)).toMatchObject({ revenue: 6000, orders: 1 });
    expect(st.averageBasket).toBe(4000);
    expect(st.topProducts[0]).toMatchObject({ name: 'Parfum', revenue: 6000 });
  });
});

describe('e-mails', () => {
  it('le lien de réinitialisation et la durée apparaissent', () => {
    const html = passwordResetEmailHtml({ link: 'https://x.test/r?token=abc', minutes: 30 });
    expect(html).toContain('https://x.test/r?token=abc');
    expect(html).toContain('30 minutes');
  });
  it('échappe les champs saisis par les marchands', () => {
    const html = merchantOrderEmailHtml({ storeName: '<b>Boutique</b>', orderId: 1, items: [{ productName: '<img src=x onerror=1>', quantity: 1, unitPrice: 100 }], subtotal: 100 });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>Boutique</b>');
    expect(subscriptionReminderEmailHtml({ storeName: '<i>x</i>', daysLeft: 1, amount: 3000 })).not.toContain('<i>x</i>');
  });
});

describe('auto-confirmation des colis', () => {
  it('ne libère que les colis assez anciens et notifie les trois parties', async () => {
    vi.resetModules();
    const notify = vi.fn(async () => null);
    const notifyAdmins = vi.fn(async () => null);
    require.cache[require.resolve('./lib/notify')] = { id: 'n', filename: 'n', loaded: true, exports: { notify, notifyAdmins, sendMerchantEmail: vi.fn() } };
    require.cache[require.resolve('./lib/prisma')] = { id: 'p', filename: 'p', loaded: true, exports: {} };
    delete require.cache[require.resolve('./lib/autoConfirm')];
    const { autoConfirmShippedOrders } = require('./lib/autoConfirm');
    const now = new Date('2026-11-21T10:00:00Z');
    const findMany = vi.fn(async ({ where }) => {
      // le filtre doit exclure ce qui a été expédié il y a moins de 7 jours
      expect(where.shippedAt.lte.toISOString()).toBe('2026-11-14T10:00:00.000Z');
      expect(where.status).toBe('expediee');
      expect(where.escrowStatus).toBe('bloque');
      return [
        { id: 1, order: { clientId: 10 }, store: { merchantId: 20, name: 'Boutique A' } },
        { id: 2, order: { clientId: 11 }, store: { merchantId: 21, name: 'Boutique B' } },
      ];
    });
    const release = vi.fn(async (id) => id === 1); // 2 : déjà confirmé entre-temps
    const res = await autoConfirmShippedOrders({ now, db: { storeOrder: { findMany } }, release, days: 7 });
    expect(res).toEqual({ checked: 2, confirmed: 1 });
    expect(notify).toHaveBeenCalledTimes(2); // client + marchand de la commande 1 seulement
    expect(notifyAdmins).toHaveBeenCalledTimes(1);
  });
});
