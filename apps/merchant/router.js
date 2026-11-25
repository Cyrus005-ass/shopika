const API_BASE = (window.SHOPIKA_MERCHANT_CONFIG && window.SHOPIKA_MERCHANT_CONFIG.API_BASE_URL) || 'http://localhost:4000/api';

// Garde d'accÃ¨s : sans token valide, retour direct Ã  la connexion
const authToken = localStorage.getItem('shopika_token');
if (!authToken) {
    window.location.href = 'login.html';
}

function logout() {
    localStorage.removeItem('shopika_token');
    localStorage.removeItem('shopika_user');
    window.location.href = 'login.html';
}

// L'identitÃ© (nom, plan) sera remplacÃ©e par les vraies donnÃ©es de l'API
// (les stats du dashboard sont calculÃ©es depuis les vraies
// commandes/stocks â€” voir loadDashboardData).
const merchant = {
    name: 'Chargement...',
    plan: 'Premium',
    currency: 'F',
    revenue: {
        total: 0, trend: 0, highestLabel: 'â€”', highest: 0, highestTrend: 0,
        lowestLabel: 'â€”', lowest: 0, lowestTrend: 0,
        series: []
    }
};

async function loadRealStoreData() {
    try {
        const res = await fetch(`${API_BASE}/stores/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.status === 401) return logout(); // token expirÃ©/invalide

        const store = await res.json();
        if (res.ok) {
            merchant.name = store.name;
            merchant.plan = store.plan.charAt(0).toUpperCase() + store.plan.slice(1);
            // IdentitÃ© du compte (e-mail de notification, tÃ©lÃ©phone,
            // opt-out e-mail) â€” le token login a dÃ©jÃ  mis le user
            // en localStorage, /stores/me complÃ¨te avec la boutique.
            const storedUser = JSON.parse(localStorage.getItem('shopika_user') || '{}');
            merchant.email = storedUser.email || null;
            merchant.emailNotifications = storedUser.emailNotifications !== false;
            merchant.phone = (store.merchant && store.merchant.phone) || storedUser.phone || '';
            merchant.payoutPhone = store.payoutPhone || '';
            merchant.payoutCountry = store.payoutCountry || '';
            merchant.shippingFee = store.shippingFee || 0;
            merchant.subdomain = store.subdomain || '';
            merchant.colorPrimary = store.colorPrimary || '#FA1757';
            merchant.colorSecondary = store.colorSecondary || '#FC7914';
            merchant.themeId = [1, 2, 3].includes(store.themeId) ? store.themeId : 1;
            merchant.isPublished = store.isPublished !== false;
            merchant.subscriptionActive = store.subscriptionActive === true;
        }
        await Promise.all([loadDashboardData(), loadCategories()]);
    } catch (err) {
        console.error('Impossible de charger la boutique', err);
    } 
    
    finally {
        applyMerchantIdentity();
        router(location.hash.replace('#', '') || 'dashboard');
    }
};

window.categoriesCache = [];

// --- CATÃ‰GORIES DU MARCHAND ---
async function addCategory(event) {
    event.preventDefault();
    const input = document.getElementById('newCategoryName');
    const errorEl = document.getElementById('categoryError');
    errorEl.textContent = '';
    const res = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ name: input.value })
    });
    const data = await res.json();
    if (!res.ok) { errorEl.textContent = data.error || 'Erreur'; return; }
    await loadCategories();
    router('categories');
}
async function renameCategory(id, current) {
    const name = prompt('Nouveau nom de la catÃ©gorie :', current);
    if (!name || name.trim() === current) return;
    const res = await fetch(`${API_BASE}/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Erreur'); return; }
    await loadCategories();
    await refreshProducts();
    router('categories');
}
async function deleteCategory(id, name) {
    if (!confirm(`Supprimer la catÃ©gorie Â« ${name} Â» ? Ses produits resteront dans votre boutique, sans catÃ©gorie.`)) return;
    const res = await fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Erreur'); return; }
    await loadCategories();
    await refreshProducts();
    router('categories');
}

async function loadCategories() {
    try {
        const res = await fetch(`${API_BASE}/categories/mine`, { headers: { 'Authorization': `Bearer ${authToken}` } });
        if (res.ok) window.categoriesCache = await res.json();
    } catch (err) {
        console.error('Erreur chargement catÃ©gories', err);
    }
}

// --- Couleurs d'un produit (choisies par le client sur la boutique) ---
const MAX_PRODUCT_COLORS = 12;
let productColors = []; // [{ name, hex, image (URL dÃ©jÃ  envoyÃ©e), file (nouvelle photo Ã  envoyer) }]

function escAttr(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderProductColors() {
    const list = document.getElementById('productColorsList');
    if (!list) return;
    list.innerHTML = productColors.map((c, i) => `
        <div class="color-row">
            <input type="color" value="${escAttr(c.hex)}" oninput="productColors[${i}].hex = this.value" aria-label="Couleur">
            <input type="text" class="form-input" placeholder="Nom (ex : Rouge)" maxlength="40" value="${escAttr(c.name)}" oninput="productColors[${i}].name = this.value">
            <label class="color-photo" title="Photo de cette couleur (facultatif)">
                ${c.file ? 'ðŸ“· ' + escAttr(c.file.name.slice(0, 14)) : (c.image ? `<img src="${escAttr(c.image)}" alt="">` : 'ðŸ“· Photo')}
                <input type="file" accept="image/*" hidden onchange="productColors[${i}].file = this.files[0] || null; renderProductColors()">
            </label>
            <button type="button" class="icon-action-btn icon-action-danger" title="Retirer" onclick="removeProductColor(${i})">âœ•</button>
        </div>`).join('');
    const add = document.getElementById('addColorBtn');
    if (add) add.style.display = productColors.length >= MAX_PRODUCT_COLORS ? 'none' : '';
}
function addProductColor() {
    if (productColors.length >= MAX_PRODUCT_COLORS) return;
    productColors.push({ name: '', hex: '#000000', image: null, file: null });
    renderProductColors();
}
function removeProductColor(i) {
    productColors.splice(i, 1);
    renderProductColors();
}
async function uploadProductImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_BASE}/products/upload-image`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` }, body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ã‰chec de l'upload de l'image");
    return data.url;
}

// --- PRODUITS ---
function openProductForm(id) {
    document.getElementById('productForm').reset();
    document.getElementById('productFormError').textContent = '';
    document.getElementById('productId').value = id || '';
    document.getElementById('productFormTitle').textContent = id ? 'Modifier le produit' : 'Ajouter un produit';
    productColors = [];

    if (id) {
        const p = (merchant.rawProducts || []).find(x => x.id === id);
        if (p) {
            document.getElementById('productName').value = p.name;
            document.getElementById('productDescription').value = p.description || '';
            document.getElementById('productPrice').value = Number(p.price);
            document.getElementById('productStock').value = p.stock;
            document.getElementById('productCategory').value = p.categoryId || '';
            document.getElementById('productPublished').checked = p.isPublished;
            productColors = (Array.isArray(p.colors) ? p.colors : []).map(c => ({ name: c.name, hex: c.hex, image: c.image || null, file: null }));
        }
    }
    renderProductColors();
    document.getElementById('productFormOverlay').classList.add('active');
}

function closeProductForm() {
    document.getElementById('productFormOverlay').classList.remove('active');
}

async function submitProductForm(event) {
    event.preventDefault();
    const errorEl = document.getElementById('productFormError');
    errorEl.textContent = '';
    const id = document.getElementById('productId').value;
    const imageFile = document.getElementById('productImage').files[0];

    try {
        let imageUrl = null;
        if (imageFile) {
            const formData = new FormData();
            formData.append('image', imageFile);
            const uploadRes = await fetch(`${API_BASE}/products/upload-image`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
                body: formData
            });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(uploadData.error || "Ã‰chec de l'upload de l'image");
            imageUrl = uploadData.url;
        }

        const payload = {
            name: document.getElementById('productName').value,
            description: document.getElementById('productDescription').value,
            price: Number(document.getElementById('productPrice').value),
            stock: Number(document.getElementById('productStock').value),
            category_id: document.getElementById('productCategory').value ? Number(document.getElementById('productCategory').value) : null,
            is_published: document.getElementById('productPublished').checked
        };
        if (imageUrl) payload.images = [imageUrl];

        // Couleurs : on renvoie toujours la liste complÃ¨te (liste vide = plus de choix de couleur).
        const colors = [];
        const seen = new Set();
        for (const c of productColors) {
            const name = c.name.trim();
            if (!name) continue;
            if (seen.has(name.toLowerCase())) throw new Error(`La couleur Â« ${name} Â» est en double.`);
            seen.add(name.toLowerCase());
            const image = c.file ? await uploadProductImage(c.file) : (c.image || null);
            colors.push({ name, hex: c.hex, image });
        }
        payload.colors = colors;

        const res = await fetch(`${API_BASE}/products${id ? '/' + id : ''}`, {
            method: id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur lors de l'enregistrement");

        closeProductForm();
        await refreshProducts();
    } catch (err) {
        errorEl.textContent = err.message;
    }
}

async function deleteProduct(id) {
    if (!confirm('Supprimer ce produit ?')) return;
    const res = await fetch(`${API_BASE}/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) refreshProducts();
}

async function refreshProducts() {
    const res = await fetch(`${API_BASE}/products`, { headers: { 'Authorization': `Bearer ${authToken}` } });
    if (res.ok) merchant.rawProducts = await res.json();
    window.productsPage = 1;
    router('produits');
}

window.productsPage = 1;
function setProductsPage(page) {
    window.productsPage = page;
    router('produits');
}

// --- COMMANDES ---
window.currentOrderFilter = 'toutes';

function setOrderFilter(filter) {
    window.currentOrderFilter = filter;
    router('commandes');
}

async function shipOrderNow(id) {
    const res = await fetch(`${API_BASE}/orders/${id}/ship`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (res.ok) {
        alert(`Commande expÃ©diÃ©e avec succÃ¨s.\nCode de livraison Ã  communiquer : ${data.deliveryCode}`);
        refreshOrders();
    } else {
        alert(data.error || "Erreur lors de l'expÃ©dition");
    }
}

async function refreshOrders() {
    const res = await fetch(`${API_BASE}/orders`, { headers: { 'Authorization': `Bearer ${authToken}` } });
    if (res.ok) merchant.rawOrders = await res.json();
    router('commandes');
}

function buildMonthlySeries(storeOrders) {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('fr-FR', { month: 'short' }), value: 0 });
    }
    storeOrders.forEach(so => {
        if (so.escrowStatus !== 'libere') return;
        const d = new Date(so.confirmedAt || so.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const bucket = months.find(m => m.key === key);
        if (bucket) bucket.value += Number(so.subtotal);
    });
    return months;
}

async function loadDashboardData() {
    try {
        const [productsRes, ordersRes] = await Promise.all([
            fetch(`${API_BASE}/products`, { headers: { Authorization: `Bearer ${authToken}` } }),
            fetch(`${API_BASE}/orders`, { headers: { Authorization: `Bearer ${authToken}` } })
        ]);
        const products = productsRes.ok ? await productsRes.json() : [];
        const storeOrders = ordersRes.ok ? await ordersRes.json() : [];

        const series = buildMonthlySeries(storeOrders);
        const values = series.map(s => s.value);
        const highestBucket = series.reduce((a, b) => (b.value > a.value ? b : a), series[0]);
        const lowestBucket = series.reduce((a, b) => (b.value < a.value ? b : a), series[0]);

        merchant.revenue.total = values.reduce((sum, v) => sum + v, 0);
        merchant.revenue.series = series;
        merchant.revenue.highestLabel = highestBucket.label;
        merchant.revenue.highest = highestBucket.value;
        merchant.revenue.lowestLabel = lowestBucket.label;
        merchant.revenue.lowest = lowestBucket.value;

        merchant.ordersCount = storeOrders.length;
        merchant.productsOnlineCount = products.filter(p => p.isPublished).length;
        merchant.pendingOrdersCount = storeOrders.filter(so => ['en_attente', 'confirmee'].includes(so.status)).length;

        merchant.rawOrders = storeOrders;   // servira Ã  la page Commandes ensuite
        merchant.rawProducts = products;    // servira Ã  la page Produits ensuite
    } catch (err) {
        console.error('Erreur chargement dashboard', err);
    }
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon aprÃ¨s-midi';
    return 'Bonsoir';
}

function getTodayLabel() {
    const today = new Date();
    const formatted = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(today);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('fr-FR').format(value) + ' ' + merchant.currency;
}

function applyMerchantIdentity() {
    document.querySelectorAll('[data-merchant-name]').forEach(el => el.textContent = merchant.name);
    document.querySelectorAll('[data-merchant-plan]').forEach(el => el.textContent = 'Plan ' + merchant.plan);
    document.querySelectorAll('[data-merchant-initial]').forEach(el => el.textContent = merchant.name.trim().charAt(0).toUpperCase());
}

// Configuration des liens avec icÃ´nes SVG
const menuLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>' },
    { id: 'produits', label: 'Produits', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>' },
    { id: 'categories', label: 'CatÃ©gories', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>' },
    { id: 'commandes', label: 'Commandes', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>' },
    { id: 'litiges', label: 'Litiges', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z\"></path><line x1=\"12\" y1=\"9\" x2=\"12\" y2=\"13\"></line><line x1=\"12\" y1=\"17\" x2=\"12.01\" y2=\"17\"></line></svg>' },
    { id: 'clients', label: 'Clients', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>' },
    { id: 'finances', label: 'Finances', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>' },
    { id: 'marketplace', label: 'Marketplace', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>' },
    { id: 'messages', label: 'Messages', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' },
    { id: 'abonnement', label: 'Abonnement', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path></svg>' },
    { id: 'stats', label: 'Statistiques', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>' },
    { id: 'personnalisation', label: 'Personnalisation', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>' },
    { id: 'parametres', label: 'ParamÃ¨tres', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>' },
    { id: 'support', label: 'Support', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' }
];

function buildMenu() {
    const navMenu = document.getElementById('navMenu');
    navMenu.innerHTML = menuLinks.map(link => 
        `<a href="#${link.id}" class="nav-item" data-section="${link.id}" title="${link.label}">${link.icon}<span class="nav-label">${link.label}</span></a>`
    ).join('');
}

// Route courante : les vues asynchrones (paramÃ¨tres,
// abonnement, support...) ne doivent plus Ã©crire dans la
// page si l'utilisateur a dÃ©jÃ  naviguÃ© ailleurs.
let currentRoute = null;

// Anciennes routes (favoris, liens enregistrÃ©s) â†’ pages qui existent encore.
const ROUTE_ALIASES = { paiements: 'finances', escrow: 'finances', livraisons: 'finances', collections: 'dashboard', marketing: 'dashboard', avis: 'dashboard' };

function router(pageId) {
    pageId = ROUTE_ALIASES[pageId] || pageId;
    if (!Views[pageId]) pageId = 'dashboard';
    currentRoute = pageId;
    // L'URL suit la page (lien partageable, rechargement, bouton retour) sans relancer le routeur.
    if (location.hash !== '#' + pageId) history.replaceState(null, '', '#' + pageId);
    const appContent = document.getElementById('app-content');
    const pageTitle = document.getElementById('page-title');

    const viewSource = Views[pageId];
    const render = (html) => {
        if (currentRoute !== pageId) return; // vue pÃ©rimÃ©e
        appContent.innerHTML = html;
        // Une vue peut demander du code Ã  lancer une fois son HTML affichÃ© (ex. fil de litige).
        if (typeof window.postRender === 'function') { const fn = window.postRender; window.postRender = null; fn(); }
        appContent.style.animation = 'none';
        appContent.offsetHeight; 
        appContent.style.animation = 'fadeIn 0.4s ease';
        if (window.Motion) { Motion.animateNumbers(appContent); appContent.querySelectorAll('.kpi-grid').forEach(g => { g.classList.add('mt-stagger'); }); Motion.reveal(appContent); }
        
        const activeLink = menuLinks.find(link => link.id === pageId);
        pageTitle.textContent = activeLink ? activeLink.label : 'Dashboard';

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === pageId) {
                item.classList.add('active');
            }
        });
    };

    // Une vue peut Ãªtre synchrone (chaÃ®ne HTML) ou
    // asynchrone (Promise<string>) â€” elle charge alors
    // ses donnÃ©es depuis l'API (abonnement, support...).
    const out = typeof viewSource === 'function' ? viewSource(merchant) : viewSource;
    if (out && typeof out.then === 'function') {
        appContent.innerHTML = window.Motion ? Motion.skeletonRows(5) : '<p style="color:var(--text-secondary); text-align:center; padding:60px 0;">Chargementâ€¦</p>';
        out.then(render).catch(err => {
            console.error(err);
            render('<p style="color:var(--text-secondary); text-align:center; padding:60px 0;">Impossible de charger cette page.</p>');
        });
    } else {
        render(out);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    buildMenu();
    applyMerchantIdentity();
    
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const closeSidebar = document.getElementById('closeSidebar');
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;

    function openSidebar() { sidebar.classList.add('active'); overlay.classList.add('active'); }
    function closeSidebarFunc() { sidebar.classList.remove('active'); overlay.classList.remove('active'); }

    hamburgerBtn.addEventListener('click', openSidebar);
    closeSidebar.addEventListener('click', closeSidebarFunc);
    overlay.addEventListener('click', closeSidebarFunc);

   // Sur desktop/tablette : la sidebar reste ouverte tant que la souris est
   // dessus, et se referme immÃ©diatement dÃ¨s que le curseur la quitte.
   // (Sur mobile, la sidebar redevient un tiroir classique dÃ©clenchÃ© par le hamburger.)
    sidebar.addEventListener('mouseleave', () => {
      if (window.innerWidth > 768 && sidebar.classList.contains('active')) {
         closeSidebarFunc();
        }
    });

    // ThÃ¨me : mÃ©morisÃ© d'une visite Ã  l'autre.
    const savedTheme = localStorage.getItem('shopika_merchant_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') body.setAttribute('data-theme', savedTheme);
    themeToggle.addEventListener('click', () => {
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        body.setAttribute('data-theme', newTheme);
        try { localStorage.setItem('shopika_merchant_theme', newTheme); } catch (e) { /* mode privÃ© */ }
    });

    document.getElementById('navMenu').addEventListener('click', (e) => {
        e.preventDefault();
        if (e.target.closest('.nav-item')) {
            const section = e.target.closest('.nav-item').dataset.section;
            if (location.hash === '#' + section) router(section); else location.hash = section; // hashchange appelle router()
            if (window.innerWidth <= 768) { closeSidebarFunc(); }
        }
    });

    // Bouton retour / lien direct : le routeur suit l'URL.
    window.addEventListener('hashchange', () => { if (merchant.name !== 'Chargement...') router(location.hash.replace('#', '') || 'dashboard'); });
    initNotifications();
    loadRealStoreData();
});

// ===== Cloche de notifications (GET /notifications) =====
async function initNotifications() {
    const btn = document.getElementById('notifBtn');
    const dot = btn && btn.querySelector('.dot');
    if (!btn) return;
    const panel = document.createElement('div');
    panel.className = 'notif-panel';
    panel.hidden = true;
    btn.parentNode.style.position = 'relative';
    btn.parentNode.appendChild(panel);
    const auth = { Authorization: `Bearer ${authToken}` };
    let items = [], unread = 0;

    async function refresh() {
        try {
            const res = await fetch(`${API_BASE}/notifications`, { headers: auth });
            if (!res.ok) return;
            const data = await res.json();
            items = data.notifications || []; unread = data.unreadCount || 0;
            if (dot) dot.style.display = unread ? '' : 'none';
            paint();
        } catch (e) { /* hors ligne : on rÃ©essaiera */ }
    }
    function paint() {
        panel.innerHTML = `<div class="notif-head"><strong>Notifications</strong>${unread ? '<button type="button" id="notifReadAll">Tout marquer lu</button>' : ''}</div>` +
            (items.length ? items.slice(0, 12).map(n => `<div class="notif-item ${n.isRead ? '' : 'unread'}"><div class="notif-title">${escAttr(n.title)}</div><div class="notif-body">${escAttr(n.body || '')}</div><div class="notif-time">${new Date(n.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div>`).join('') : '<p class="notif-empty">Rien de nouveau pour l\'instant.</p>');
        const all = document.getElementById('notifReadAll');
        if (all) all.onclick = async () => { await fetch(`${API_BASE}/notifications/read-all`, { method: 'PATCH', headers: auth }); refresh(); };
    }
    btn.addEventListener('click', (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; });
    document.addEventListener('click', (e) => { if (!panel.contains(e.target)) panel.hidden = true; });
    await refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, 60000);
}
