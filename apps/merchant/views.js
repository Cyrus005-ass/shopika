// Checklist de mise en route : disparaît quand tout est fait.
function onboardingCard(m) {
    const steps = [
        { done: m.subscriptionActive === true, label: 'Abonnement actif', go: 'abonnement' },
        { done: (m.productsOnlineCount || 0) > 0, label: 'Publier un premier produit', go: 'produits' },
        { done: !!m.payoutPhone, label: 'Renseigner votre numéro Mobile Money de versement', go: 'parametres' },
        { done: m.isPublished !== false, label: 'Rendre la boutique visible', go: 'marketplace' },
        { done: (m.ordersCount || 0) > 0, label: 'Recevoir une première commande', go: 'commandes' },
    ];
    const done = steps.filter(s => s.done).length;
    if (done === steps.length) return '';
    const pct = Math.round((done / steps.length) * 100);
    return `
    <div class="card onboarding">
        <div class="onb-head"><div><div class="table-title">Votre boutique est prête à ${pct} %</div><p class="onb-sub">${steps.length - done} étape(s) pour bien démarrer</p></div><div class="onb-pct">${pct}%</div></div>
        <div class="onb-track"><span style="width:${pct}%"></span></div>
        <ul class="onb-list">${steps.map(s => `<li class="${s.done ? 'done' : ''}"><span class="onb-check">${s.done ? '✓' : ''}</span><span>${s.label}</span>${s.done ? '' : `<button class="btn btn-ghost" style="padding:4px 12px;" onclick="location.hash='${s.go}'">Faire</button>`}</li>`).join('')}</ul>
    </div>`;
}

// Carte « vide / erreur » partagée par les vues chargées depuis l'API.
const emptyCard = (title, text) => `
    <div class="card" style="text-align:center; padding:60px 24px;">
        <h2 style="margin-bottom:10px;">${title}</h2>
        <p style="color:var(--text-secondary); max-width:480px; margin:0 auto;">${text}</p>
    </div>`;

const Views = {
    dashboard: (merchant) => {
        const rev = merchant.revenue;
        const maxVal = Math.max(...rev.series.map(p => p.value), 1);

        const chartW = 640, chartH = 200, padL = 40, padR = 16, padT = 16, padB = 30;
        const innerW = chartW - padL - padR, innerH = chartH - padT - padB;
        const stepX = innerW / (rev.series.length - 1);
        const points = rev.series.map((p, i) => {
            const x = padL + stepX * i;
            const y = padT + innerH - (p.value / maxVal) * innerH;
            return { x, y, ...p };
        });
        const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
        const areaPath = linePath + ` L${points[points.length - 1].x.toFixed(1)} ${padT + innerH} L${points[0].x.toFixed(1)} ${padT + innerH} Z`;
        const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => {
            const y = padT + innerH * f;
            const val = Math.round((maxVal * (1 - f)) / 1000);
            return `<line x1="${padL}" y1="${y}" x2="${chartW - padR}" y2="${y}" stroke="var(--border-color)" stroke-width="1"></line>
                     <text x="${padL - 10}" y="${y + 4}" text-anchor="end" class="chart-axis-label">${val}k</text>`;
        }).join('');
        const xLabels = points.map(p => `<text x="${p.x}" y="${chartH - 6}" text-anchor="middle" class="chart-axis-label">${p.label}</text>`).join('');
        const dots = points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--bg-card)" stroke="url(#lineGrad)" stroke-width="2.5"></circle>`).join('');

        // --- Activité récente : construite à partir des vraies commandes/stocks déjà chargés ---
        const recentOrders = (merchant.rawOrders || []).slice(0, 3);
        const lowStock = (merchant.rawProducts || []).filter(p => p.stock > 0 && p.stock < 5).slice(0, 3);
        const activityItems = [
            ...recentOrders.map(o => `<div style="display:flex; gap:10px; align-items:center;"><div style="width:8px;height:8px;background:#10B981;border-radius:50%;flex-shrink:0;"></div><div>Commande #${o.id} — ${o.status.replace('_', ' ')}</div></div>`),
            ...lowStock.map(p => `<div style="display:flex; gap:10px; align-items:center;"><div style="width:8px;height:8px;background:#F59E0B;border-radius:50%;flex-shrink:0;"></div><div>Stock faible : ${p.name} (${p.stock} restant${p.stock > 1 ? 's' : ''})</div></div>`)
        ];
        const activityHtml = activityItems.length
            ? activityItems.join('')
            : `<p style="color: var(--text-muted); text-align: center; padding: 20px 0;">Aucune activité récente pour l'instant.</p>`;

        return `
        <div class="welcome-card">
            <div class="welcome-text">
                <div class="welcome-eyebrow">${getGreeting()}, ${escAttr(merchant.name)} 👋</div>
                <div class="welcome-date">${getTodayLabel()}</div>
                <div class="welcome-revenue">
                    <span class="welcome-revenue-label">Revenus (fonds libérés)</span>
                    <div class="welcome-revenue-value">${formatCurrency(rev.total)}</div>
                </div>
            </div>
            <div class="welcome-actions">
                <button class="btn btn-primary" onclick="router('produits')">+ Ajouter un produit</button>
                <button class="btn btn-ghost-light" onclick="router('commandes')">Voir les commandes</button>
            </div>
        </div>

        ${onboardingCard(merchant)}

        <div class="kpi-grid">
            <div class="card kpi-card">
                <div class="kpi-label">Commandes</div>
                <div class="kpi-value">${merchant.ordersCount ?? 0}</div>
            </div>
            <div class="card kpi-card">
                <div class="kpi-label">Produits en ligne</div>
                <div class="kpi-value">${merchant.productsOnlineCount ?? 0}</div>
            </div>
            <div class="card kpi-card">
                <div class="kpi-label">En attente d'expédition</div>
                <div class="kpi-value">${merchant.pendingOrdersCount ?? 0}</div>
            </div>
            <div class="card kpi-card">
                <div class="kpi-label">Abonnement</div>
                <div class="kpi-value" style="font-size: 20px;">Plan ${merchant.plan}</div>
            </div>
        </div>

        <div class="card">
            <div class="table-header">
                <div class="table-title">Performance des ventes</div>
            </div>
                <div class="chart-highlights">
                    <div>
                        <div class="chart-highlight-label">Mois le plus élevé (${rev.highestLabel})</div>
                        <div class="chart-highlight-value">${formatCurrency(rev.highest)}</div>
                    </div>
                    <div>
                        <div class="chart-highlight-label">Mois le plus bas (${rev.lowestLabel})</div>
                        <div class="chart-highlight-value">${formatCurrency(rev.lowest)}</div>
                    </div>
                </div>
                <svg viewBox="0 0 ${chartW} ${chartH}" class="line-chart">
                    <defs>
                        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stop-color="#FA1757"></stop>
                            <stop offset="100%" stop-color="#FC7914"></stop>
                        </linearGradient>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#FA1757" stop-opacity="0.18"></stop>
                            <stop offset="100%" stop-color="#FC7914" stop-opacity="0"></stop>
                        </linearGradient>
                    </defs>
                    ${gridLines}
                    <path d="${areaPath}" fill="url(#areaGrad)" stroke="none"></path>
                    <path d="${linePath}" fill="none" stroke="url(#lineGrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
                    ${dots}
                    ${xLabels}
                </svg>
            </div>

        <div class="card">
            <div class="table-header"><div class="table-title">Activité récente</div></div>
            <div style="display: flex; flex-direction: column; gap: 15px;">${activityHtml}</div>
        </div>
    `;
    },

    
    produits: (merchant) => {
    const allProducts = merchant.rawProducts || [];
    const perPage = 10;
    const page = window.productsPage || 1;
    const totalPages = Math.max(1, Math.ceil(allProducts.length / perPage));
    const startIdx = (page - 1) * perPage;
    const products = allProducts.slice(startIdx, startIdx + perPage);
    const opts = (list) => list.map(c => `<option value="${c.id}">${escAttr(c.name)}</option>`).join('');
    const allCats = window.categoriesCache || [];
    const categoryOptions = (allCats.some(c => c.mine) ? `<optgroup label="Mes catégories">${opts(allCats.filter(c => c.mine))}</optgroup>` : '') + `<optgroup label="Plateforme">${opts(allCats.filter(c => !c.mine))}</optgroup>`;
    const placeholderImg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><rect width="44" height="44" fill="%23222"/></svg>';

    const rows = products.length ? products.map(p => `
        <tr>
            <td><img class="product-thumb" src="${(p.images && p.images[0]) || placeholderImg}" alt="${escAttr(p.name)}"></td>
            <td>${escAttr(p.name)}</td>
            <td>${p.category ? `<span class="category-pill">${p.category.name}</span>` : '<span class="category-pill category-pill-empty">—</span>'}</td>
            <td>${formatCurrency(Number(p.price))}</td>
            <td>
                <button class="icon-action-btn" title="Éditer" onclick="openProductForm(${p.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </button>
                <button class="icon-action-btn icon-action-danger" title="Supprimer" onclick="deleteProduct(${p.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                </button>
            </td>
        </tr>
    `).join('') : `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">Aucun produit pour l'instant — clique sur "+ Ajouter un produit" pour commencer.</td></tr>`;

    const rangeStart = allProducts.length ? startIdx + 1 : 0;
    const rangeEnd = Math.min(startIdx + perPage, allProducts.length);

    return `
    <div class="products-header">
        <div>
            <h2 class="products-title">Gestion des Produits</h2>
            <p class="products-subtitle">Ajoutez, modifiez ou retirez des articles.</p>
        </div>
        <button class="btn btn-primary" onclick="openProductForm()">+ Ajouter un produit</button>
    </div>

    <div class="card">
        <div class="table-scroll"><table>
            <thead><tr><th>Image</th><th>Nom du produit</th><th>Catégorie</th><th>Prix</th><th>Actions</th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>
        <div class="pagination-bar">
            <span>Affichage ${rangeStart}-${rangeEnd} sur ${allProducts.length}</span>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-ghost" ${page <= 1 ? 'disabled' : ''} onclick="setProductsPage(${page - 1})">Précédent</button>
                <button class="btn btn-ghost" ${page >= totalPages ? 'disabled' : ''} onclick="setProductsPage(${page + 1})">Suivant</button>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="productFormOverlay">
        <div class="modal-card">
            <div class="modal-header">
                <h3 id="productFormTitle">Ajouter un produit</h3>
                <button class="close-btn" onclick="closeProductForm()">✕</button>
            </div>
            <form id="productForm" onsubmit="submitProductForm(event)">
                <input type="hidden" id="productId">
                <div class="form-group"><label class="form-label">Nom</label><input type="text" class="form-input" id="productName" required></div>
                <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" id="productDescription"></textarea></div>
                <div class="grid-2-eq">
                    <div class="form-group"><label class="form-label">Prix (F)</label><input type="number" class="form-input" id="productPrice" required min="0" step="1"></div>
                    <div class="form-group"><label class="form-label">Stock</label><input type="number" class="form-input" id="productStock" required min="0" step="1"></div>
                </div>
                <div class="form-group"><label class="form-label">Catégorie</label><select class="form-input" id="productCategory"><option value="">— Aucune —</option>${categoryOptions}</select></div>
                <div class="form-group"><label class="form-label">Image</label><input type="file" class="form-input" id="productImage" accept="image/*"></div>
                <div class="form-group">
                    <label class="form-label">Couleurs disponibles <span style="font-weight:400; color:var(--text-muted);">(optionnel)</span></label>
                    <p style="color:var(--text-secondary); font-size:12.5px; margin:0 0 8px;">Vos clients choisiront une couleur sur la boutique. Une photo par couleur est facultative : elle remplace l'image du produit quand la couleur est choisie.</p>
                    <div id="productColorsList" class="color-rows"></div>
                    <button type="button" class="btn btn-ghost" id="addColorBtn" onclick="addProductColor()">+ Ajouter une couleur</button>
                </div>
                <div class="form-group" style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="productPublished" style="width:auto;">
                    <label class="form-label" style="margin:0;" for="productPublished">Publier immédiatement</label>
                </div>
                <p class="auth-error" id="productFormError"></p>
                <button type="submit" class="btn btn-primary" style="width:100%;">Enregistrer</button>
            </form>
        </div>
    </div>
    `;
    },

    categories: (merchant) => {
        // Catégories de la plateforme (gérées par Shopika, non modifiables) + catégories
        // créées par le marchand pour SA boutique. Chargées par router.js (window.categoriesCache).
        const cats = window.categoriesCache || [];
        const platform = cats.filter(c => !c.mine);
        const mine = cats.filter(c => c.mine);
        const chip = (c) => `<span class="badge badge-info" style="padding: 10px 15px; font-size: 14px;">${escAttr(c.name)}</span>`;
        const myRows = mine.length ? mine.map(c => `
            <div class="cat-row">
                <span>${escAttr(c.name)}</span>
                <span>
                    <button class="icon-action-btn" title="Renommer" onclick="renameCategory(${c.id}, ${escAttr(JSON.stringify(c.name))})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </button>
                    <button class="icon-action-btn icon-action-danger" title="Supprimer" onclick="deleteCategory(${c.id}, ${escAttr(JSON.stringify(c.name))})">✕</button>
                </span>
            </div>`).join('') : '<p style="color:var(--text-muted); font-size:14px;">Vous n\'avez pas encore créé de catégorie.</p>';
        return `
        <div class="card">
            <div class="table-header"><div class="table-title">Mes catégories</div></div>
            <p style="color:var(--text-secondary); font-size:14px; margin-bottom:16px;">Créez vos propres catégories (ex : « Parfums femme »). Vos clients les voient sur votre boutique, classées en rubriques.</p>
            <form onsubmit="addCategory(event)" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px;">
                <input type="text" class="form-input" id="newCategoryName" placeholder="Nom de la catégorie" minlength="2" maxlength="40" required style="flex:1; min-width:200px;">
                <button type="submit" class="btn btn-primary">+ Ajouter</button>
            </form>
            <p class="auth-error" id="categoryError"></p>
            ${myRows}
        </div>
        <div class="card" style="margin-top:20px;">
            <div class="table-header"><div class="table-title">Catégories de la plateforme</div></div>
            <p style="color:var(--text-secondary); font-size:14px; margin-bottom:16px;">Disponibles pour tous les marchands lors de l'ajout d'un produit. Elles sont gérées par Shopika.</p>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">${platform.length ? platform.map(chip).join('') : '<p style="color:var(--text-muted);">Aucune.</p>'}</div>
        </div>
        `;
    },
    commandes: (merchant) => {
        const filter = window.currentOrderFilter || 'toutes';
        let orders = merchant.rawOrders || [];
        if (filter === 'attente') orders = orders.filter(o => ['en_attente', 'confirmee'].includes(o.status));
        if (filter === 'expediees') orders = orders.filter(o => o.status === 'expediee');

        const statusLabels = { en_attente: ['En attente', 'badge-warning'], confirmee: ['Confirmée', 'badge-info'], expediee: ['Expédiée', 'badge-info'], livree: ['Livrée', 'badge-success'], terminee: ['Terminée', 'badge-success'], litige: ['Litige', 'badge-danger'], annulee: ['Annulée', 'badge-danger'] };
        const escrowLabels = { bloque: ['Escrow', 'badge-warning'], libere: ['Libéré', 'badge-success'], rembourse: ['Remboursé', 'badge-danger'] };

        const rows = orders.length ? orders.map(o => {
            const [statusText, statusClass] = statusLabels[o.status] || [o.status, 'badge-info'];
            const [escrowText, escrowClass] = escrowLabels[o.escrowStatus] || [o.escrowStatus, 'badge-info'];
            const canShip = o.status === 'en_attente' || o.status === 'confirmee';
            return `
            <tr>
                <td>#${o.id}</td>
                <td>${escAttr(o.order?.client?.fullName || '—')}</td>
                <td>${(o.items || []).map(it => `${it.quantity} × ${escAttr(it.product?.name || 'Produit')}${it.variant ? ` <span class="badge badge-info">${escAttr(it.variant)}</span>` : ''}`).join('<br>') || '—'}</td>
                <td>${formatCurrency(Number(o.subtotal))}</td>
                <td><span class="badge ${escrowClass}">${escrowText}</span></td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>${canShip ? `<button class="btn btn-ghost" style="padding: 5px 10px;" onclick="shipOrderNow(${o.id})">Expédier</button>` : '—'}</td>
            </tr>`;
        }).join('') : `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">Aucune commande pour l'instant.</td></tr>`;

        return `
        <div class="card">
            <div class="table-header">
                <div class="table-title">Gestion des Commandes</div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn ${filter === 'toutes' ? 'btn-primary' : 'btn-ghost'}" onclick="setOrderFilter('toutes')">Toutes</button>
                    <button class="btn ${filter === 'attente' ? 'btn-primary' : 'btn-ghost'}" onclick="setOrderFilter('attente')">En attente</button>
                    <button class="btn ${filter === 'expediees' ? 'btn-primary' : 'btn-ghost'}" onclick="setOrderFilter('expediees')">Expédiées</button>
                </div>
            </div>
            <div class="table-scroll"><table>
                <thead><tr><th>N° Commande</th><th>Client</th><th>Articles</th><th>Montant</th><th>Paiement</th><th>Statut</th><th>Action</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>
        </div>
    `;
    },

    // ===== Vues alimentées par l'API (aucune donnée fictive) =====
    clients: async () => {
        const res = await fetch(`${API_BASE}/stores/me/customers`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (!res.ok) return emptyCard('Clients', 'Impossible de charger vos clients pour le moment.');
        const customers = await res.json();
        if (!customers.length) return emptyCard('Clients', 'Vos clients apparaîtront ici dès votre première commande payée.');
        const seg = { fidele: ['Fidèle', 'badge-success'], regulier: ['Régulier', 'badge-info'], nouveau: ['Nouveau', 'badge-warning'] };
        const rows = customers.map(c => {
            const [label, cls] = seg[c.segment] || seg.nouveau;
            const digits = String(c.phone || '').replace(/\D/g, '');
            const wa = digits ? `<a class="btn btn-ghost" style="padding:3px 9px; margin-left:8px;" href="https://wa.me/${digits}" target="_blank" rel="noopener">WhatsApp</a>` : '';
            return `<tr><td>${escAttr(c.name)}</td><td>${escAttr(c.phone || c.email || '—')}${wa}</td><td>${c.orders}</td><td>${formatCurrency(c.totalSpent)}</td><td><span class="badge ${cls}">${label}</span></td></tr>`;
        }).join('');
        return `
        <div class="card">
            <div class="table-header"><div class="table-title">Base de clients (${customers.length})</div></div>
            <div class="table-scroll"><table>
                <thead><tr><th>Client</th><th>Contact</th><th>Commandes</th><th>Total dépensé</th><th>Statut</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>
        </div>`;
    },

    finances: async () => {
        const res = await fetch(`${API_BASE}/stores/me/finance`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (!res.ok) return emptyCard('Finances', 'Impossible de charger vos finances pour le moment.');
        const { summary: s, recent } = await res.json();
        const escrowL = { bloque: ['En séquestre', 'badge-warning'], libere: ['Libéré', 'badge-success'], rembourse: ['Remboursé', 'badge-danger'] };
        const payoutL = { en_attente: ['À verser', 'badge-warning'], en_cours: ['En cours', 'badge-info'], effectue: ['Versé', 'badge-success'], echoue: ['Échec — relancé par Shopika', 'badge-danger'] };
        const rows = recent.length ? recent.map(r => {
            const [eT, eC] = escrowL[r.escrowStatus] || [r.escrowStatus, 'badge-info'];
            const [pT, pC] = r.escrowStatus === 'libere' ? (payoutL[r.payoutStatus] || ['À verser', 'badge-warning']) : ['—', ''];
            return `<tr><td>#${r.id}</td><td>${formatCurrency(Number(r.subtotal))}</td><td><span class="badge ${eC}">${eT}</span></td><td>${pC ? `<span class="badge ${pC}">${pT}</span>` : '—'}</td><td>${new Date(r.createdAt).toLocaleDateString('fr-FR')}</td></tr>`;
        }).join('') : `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">Aucune commande payée pour l'instant.</td></tr>`;
        return `
        <div class="kpi-grid">
            <div class="card kpi-card"><div class="kpi-label">En séquestre</div><div class="kpi-value">${formatCurrency(s.enSequestre)}</div><p class="kpi-note">Bloqué jusqu'à confirmation de livraison</p></div>
            <div class="card kpi-card"><div class="kpi-label">À verser</div><div class="kpi-value">${formatCurrency(s.aVerser + s.enCours)}</div><p class="kpi-note">Libéré, en attente de versement Shopika</p></div>
            <div class="card kpi-card"><div class="kpi-label">Déjà versé</div><div class="kpi-value">${formatCurrency(s.verse)}</div><p class="kpi-note">Reçu sur votre Mobile Money</p></div>
            <div class="card kpi-card"><div class="kpi-label">Remboursé</div><div class="kpi-value">${formatCurrency(s.rembourse)}</div><p class="kpi-note">Litiges tranchés en faveur du client</p></div>
        </div>
        <div class="card">
            <div class="table-header"><div class="table-title">Dernières commandes payées</div></div>
            <p style="color:var(--text-secondary); font-size:13.5px; margin-bottom:14px;">Le client paie, l'argent reste en séquestre, puis il est libéré à la confirmation de livraison (par le client, par code, ou automatiquement après quelques jours sans réponse) et versé sur votre Mobile Money par l'équipe Shopika.</p>
            <div class="table-scroll"><table>
                <thead><tr><th>Commande</th><th>Montant</th><th>Séquestre</th><th>Versement</th><th>Date</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>
        </div>`;
    },

    stats: async () => {
        const res = await fetch(`${API_BASE}/stores/me/stats`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (!res.ok) return emptyCard('Statistiques', 'Impossible de charger vos statistiques pour le moment.');
        const st = await res.json();
        if (!st.ordersCount) return emptyCard('Statistiques', 'Vos statistiques apparaîtront dès votre première commande payée.');
        const max = Math.max(...st.months.map(m => m.revenue), 1);
        const bars = st.months.map((m, i) => {
            const h = Math.max(2, Math.round((m.revenue / max) * 150));
            return `<g><rect class="bar" style="animation-delay:${i * 70}ms" x="${24 + i * 56}" y="${170 - h}" width="34" height="${h}" rx="6" fill="url(#barGrad)"><title>${escAttr(m.label)} : ${formatCurrency(m.revenue)} — ${m.orders} commande(s)</title></rect>
                <text x="${41 + i * 56}" y="190" text-anchor="middle" class="chart-axis-label">${escAttr(m.label)}</text></g>`;
        }).join('');
        const topMax = Math.max(...st.topProducts.map(p => p.revenue), 1);
        const top = st.topProducts.map(p => `
            <div class="top-row"><div class="top-name">${escAttr(p.name)}</div>
            <div class="top-bar"><span style="width:${Math.max(4, Math.round((p.revenue / topMax) * 100))}%"></span></div>
            <div class="top-val">${formatCurrency(p.revenue)} <small>· ${p.quantity} vendu(s)</small></div></div>`).join('');
        return `
        <div class="kpi-grid">
            <div class="card kpi-card"><div class="kpi-label">Chiffre d'affaires</div><div class="kpi-value">${formatCurrency(st.totalRevenue)}</div></div>
            <div class="card kpi-card"><div class="kpi-label">Commandes payées</div><div class="kpi-value">${st.ordersCount}</div></div>
            <div class="card kpi-card"><div class="kpi-label">Panier moyen</div><div class="kpi-value">${formatCurrency(st.averageBasket)}</div></div>
        </div>
        <div class="card">
            <div class="table-header"><div class="table-title">Ventes des 6 derniers mois</div></div>
            <svg viewBox="0 0 360 200" class="bar-chart" role="img" aria-label="Ventes par mois">
                <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FA1757"></stop><stop offset="100%" stop-color="#FC7914"></stop></linearGradient></defs>
                ${bars}
            </svg>
        </div>
        <div class="card">
            <div class="table-header"><div class="table-title">Produits les plus rentables</div></div>
            ${top || '<p style="color:var(--text-muted);">Pas encore de données.</p>'}
        </div>`;
    },

    // ===== Litiges : le marchand répond au client et fournit ses preuves (photos) =====
    litiges: async () => {
        const res = await fetch(`${API_BASE}/disputes`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (!res.ok) return emptyCard('Litiges', 'Impossible de charger vos litiges pour le moment.');
        const list = await res.json();
        if (!list.length) return emptyCard('Litiges', "Aucun litige. Quand un client signale un problème sur une commande, vous le verrez ici et pourrez répondre avec vos preuves.");
        const open = list.filter(d => d.status === 'ouvert').length;
        const auth = { Authorization: `Bearer ${authToken}` };
        window.postRender = () => {
            list.forEach((d) => {
                const el = document.querySelector(`[data-dsp="${d.storeOrderId}"]`);
                if (!el || !window.DisputeThread) return;
                const api = {
                    send: async (body, url) => {
                        const r = await fetch(`${API_BASE}/disputes/${d.storeOrderId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ body, attachmentUrl: url || undefined }) });
                        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Envoi impossible');
                    },
                    upload: async (file) => {
                        const form = new FormData(); form.append('image', file);
                        const r = await fetch(`${API_BASE}/disputes/upload`, { method: 'POST', headers: auth, body: form });
                        const j = await r.json().catch(() => ({}));
                        if (!r.ok) throw new Error(j.error || 'Envoi de la photo impossible');
                        return j.url;
                    },
                    reload: async () => {
                        const r = await fetch(`${API_BASE}/disputes/${d.storeOrderId}`, { headers: auth });
                        if (r.ok) DisputeThread.render(el, await r.json(), api);
                    },
                };
                DisputeThread.render(el, d, api);
            });
        };
        return `
        <div class="card" style="margin-bottom:18px;">
            <div class="table-title">${open ? `${open} litige(s) à traiter` : 'Tous vos litiges sont clos'}</div>
            <p style="color:var(--text-secondary); font-size:13.5px; margin-top:6px;">Pendant un litige, l'argent de la commande reste bloqué. Répondez vite et joignez des preuves (photo du colis, preuve d'envoi) : l'équipe Shopika tranche en tenant compte des échanges.</p>
        </div>
        ${list.map(d => `<div class="card" style="margin-bottom:18px;"><div data-dsp="${d.storeOrderId}"></div></div>`).join('')}`;
    },

    // Visibilité réelle : bascule is_published de la boutique (avant, l'interrupteur n'était qu'un dessin).
    marketplace: (merchant) => {
        const on = merchant.isPublished !== false;
        return `
        <div class="card" style="text-align:center; padding:50px 24px;">
            <h2 style="margin-bottom:12px;">Visibilité sur la marketplace</h2>
            <p style="color:var(--text-secondary); margin:0 auto 28px; max-width:520px;">Quand votre boutique est visible, elle apparaît dans la marketplace Shopika et dans les recherches. Masquée, elle reste accessible par son lien direct. Elle n'est visible que si votre abonnement est actif${merchant.subscriptionActive === false ? ' — <strong>il ne l\'est pas actuellement</strong>' : ''}.</p>
            <label class="switch-real"><input type="checkbox" id="publishToggle" ${on ? 'checked' : ''} onchange="togglePublish(this)"><span class="slider"></span></label>
            <p id="publishState" style="margin-top:14px; font-weight:600; color:${on ? 'var(--color-success)' : 'var(--text-secondary)'};">${on ? 'Boutique visible' : 'Boutique masquée'}</p>
        </div>`;
    },

    messages: `
        <div class="card" style="text-align: center; padding: 60px;">
            <h2 style="margin-bottom: 15px;">Messagerie via WhatsApp</h2>
            <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto;">
                Shopika ne gère pas de messagerie interne : chaque message client vous est directement redirigé vers votre WhatsApp Business. Aucune configuration à faire ici.
            </p>
        </div>
    `,
    abonnement: async () => {
        // Statut réel depuis le backend : subscriptionExpiresAt
        // est la seule source de vérité (la boutique est active
        // si et seulement si cette date est dans le futur).
        let sub = null, error = null;
        try {
            const res = await fetch(`${API_BASE}/stores/me/subscription`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (res.ok) sub = await res.json();
            else error = (await res.json()).error || 'Erreur de chargement';
        } catch (e) { error = 'Impossible de joindre le serveur'; }

        if (error) {
            return `<div class="card plan-card">
                <h2 style="font-size: 24px; margin-bottom: 10px;">Abonnement boutique</h2>
                <p style="color:#EF4444;">${error}</p>
            </div>`;
        }

        const active = sub.active;
        const expires = sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString('fr-FR') : '—';
        const amount = sub.amountDue ? `${Number(sub.amountDue).toLocaleString('fr-FR')} FCFA` : '—';
        const label = sub.isFirstPayment ? 'Frais de création (une fois)' : 'Réabonnement mensuel';

        return `
        <div class="card plan-card">
            <div class="plan-icon">
                <svg width="30" height="30" viewBox="0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </div>
            <h2 style="font-size: 28px; margin-bottom: 10px;">Abonnement boutique</h2>
            <p style="color:var(--text-secondary); margin-bottom: 6px;">Statut : <strong style="color:${active ? '#10B981' : '#F59E0B'};">${active ? 'Actif' : 'Expiré — à renouveler'}</strong></p>
            <p style="color:var(--text-secondary); margin-bottom: 6px;">Expiration : <strong>${expires}</strong></p>
            <p style="color:var(--text-secondary); margin-bottom: 20px;">Prochain paiement : <strong>${label}</strong> — <strong>${amount}</strong></p>
            ${active
                ? `<p style="color:var(--text-secondary); max-width: 420px;">Votre boutique est visible sur la marketplace. Sans renouvellement, elle disparaît automatiquement à l'expiration (jour pour jour).</p>`
                : `<button class="btn btn-primary" id="paySubscriptionBtn" onclick="paySubscription()">Payer ${amount}</button>
                   <p style="color:var(--text-secondary); font-size:13px; max-width: 420px; margin-top:12px;">Vous serez redirigé vers FedaPay (Mobile Money ou carte). La boutique redevient visible dès la confirmation du paiement — aucune action supplémentaire.</p>`}
        </div>`;
    },
    personnalisation: (merchant) => `
        <div class="grid-2-eq">
            <div class="card">
                <h3 style="margin-bottom: 20px;">Identité Visuelle</h3>
                <div class="form-group"><label class="form-label">Nom de la boutique</label><input type="text" class="form-input" id="appearanceName" value="${merchant.name}"></div>
                <div class="form-group"><label class="form-label">Couleur principale</label><input type="color" id="appearancePrimary" value="${merchant.colorPrimary || '#FA1757'}" style="width: 100%; height: 40px; background: none; border: 1px solid var(--border-color); border-radius: 10px;"></div>
                <div class="form-group"><label class="form-label">Couleur secondaire</label><input type="color" id="appearanceSecondary" value="${merchant.colorSecondary || '#FC7914'}" style="width: 100%; height: 40px; background: none; border: 1px solid var(--border-color); border-radius: 10px;"></div>
                <button class="btn btn-primary" onclick="saveAppearance()">Enregistrer les modifications</button>
                <p id="appearanceStatus" style="margin-top:8px; font-size:13px;"></p>
            </div>
            <div class="card">
                <h3 style="margin-bottom: 20px;">Adresse de la boutique</h3>
                <div class="form-group"><label class="form-label">Sous-domaine Shopika</label><input type="text" class="form-input" value="${merchant.subdomain || ''}.shopika.com" disabled></div>
                <p style="color:var(--text-secondary); font-size:13px;">Le sous-domaine est unique et ne peut pas être modifié après la création. Les domaines personnalisés (votre-propre-domaine.com) arrivent prochainement.</p>
            </div>
        </div>
        <div class="card" style="margin-top:20px;">
            <h3 style="margin-bottom: 6px;">Thème de la boutique</h3>
            <p style="color:var(--text-secondary); font-size:13px; margin-bottom:18px;">Le thème change toute la présentation de votre boutique pour vos clients (pas seulement les couleurs). Vous pouvez en changer à tout moment.</p>
            <div class="theme-picker" id="themePicker">
                ${[
                    { id: 1, name: 'Basique', desc: 'Grille de produits classique avec filtres par catégorie.' },
                    { id: 2, name: 'Carrousel', desc: 'Vitrine sombre, carrousels animés et aperçu rapide des produits.' },
                    { id: 3, name: 'Catalogue', desc: 'Produits par catégorie, fiche détaillée avec galerie et choix de couleur.' }
                ].map(t => `
                <button type="button" class="theme-option ${(merchant.themeId || 1) === t.id ? 'selected' : ''}" data-theme="${t.id}" onclick="selectTheme(${t.id})">
                    <div class="theme-preview theme-preview-${t.id}"><i></i><i></i><i></i><i></i></div>
                    <div class="theme-option-name">${t.name}</div>
                    <div class="theme-option-desc">${t.desc}</div>
                </button>`).join('')}
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:18px;">
                <button class="btn btn-primary" onclick="saveTheme()">Appliquer ce thème</button>
                <a class="btn" id="themePreviewLink" target="_blank" rel="noopener" href="${shopUrl(merchant.themeId || 1)}" style="text-decoration:none;">Voir ma boutique</a>
            </div>
            <p id="themeStatus" style="margin-top:8px; font-size:13px;"></p>
        </div>
    `,
    parametres: (merchant) => `
        <div class="card">
            <h3 style="margin-bottom: 20px;">Notifications par e-mail (Gmail)</h3>
            <p style="color:var(--text-secondary); font-size:13px; margin-bottom:16px;">Un e-mail vous est envoyé à chaque commande payée (détail des articles) et quand le stock d'un produit passe sous 5 exemplaires. Renseignez l'adresse de votre boutique pour les recevoir.</p>
            <div class="form-group"><label class="form-label">E-mail de notification</label>
                <input type="email" class="form-input" id="settingsEmail" value="${merchant.email || ''}" placeholder="maboutique@gmail.com">
            </div>
            <div class="form-group"><label class="form-label">Notifications e-mail</label>
                <select class="form-input" id="settingsEmailNotif">
                    <option value="true" ${merchant.emailNotifications !== false ? 'selected' : ''}>Activées</option>
                    <option value="false" ${merchant.emailNotifications === false ? 'selected' : ''}>Désactivées</option>
                </select>
            </div>
            <button class="btn btn-primary" onclick="saveNotificationSettings()">Enregistrer les notifications</button>
            <p id="notifStatus" style="margin-top:8px; font-size:13px;"></p>
        </div>
        <div class="card" style="margin-top:20px;">
            <h3 style="margin-bottom: 20px;">Compte</h3>
            <div class="form-group"><label class="form-label">Téléphone (identifiant de connexion)</label><input type="text" class="form-input" value="${merchant.phone || ''}" disabled></div>
            <p style="color:var(--text-secondary); font-size:13px;">Le téléphone sert d'identifiant : pour le modifier, contactez le support Shopika.</p>
        </div>
        <div class="card" style="margin-top:20px;">
            <h3 style="margin-bottom: 20px;">Livraison & versements</h3>
            <div class="form-group"><label class="form-label">Frais de livraison (FCFA, ajoutés à chaque commande de cette boutique)</label>
                <input type="number" class="form-input" id="settingsShippingFee" min="0" step="1" value="${merchant.shippingFee || 0}">
            </div>
            <div class="form-group"><label class="form-label">Numéro Mobile Money pour recevoir les versements</label>
                <input type="tel" class="form-input" id="settingsPayoutPhone" value="${merchant.payoutPhone || ''}" placeholder="+225 07 00 00 00">
            </div>
            <div class="form-group"><label class="form-label">Pays du versement (code ISO, ex: CI)</label>
                <input type="text" class="form-input" id="settingsPayoutCountry" value="${merchant.payoutCountry || ''}" placeholder="CI" maxlength="2">
            </div>
            <button class="btn btn-primary" onclick="saveStoreSettings()">Enregistrer</button>
            <p id="storeStatus" style="margin-top:8px; font-size:13px;"></p>
        </div>
    `,
    support: async () => {
        // Historique réel des échanges marchand ↔ support Shopika.
        let messages = [], error = null;
        try {
            const res = await fetch(`${API_BASE}/support/my`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (res.ok) messages = await res.json();
            else error = 'Erreur de chargement de l\'historique';
        } catch (e) { error = 'Impossible de joindre le serveur'; }

        const list = messages.length === 0
            ? '<p style="color:var(--text-secondary); text-align:center; padding:20px 0;">Aucun échange pour l\'instant.</p>'
            : messages.map(m => `
                <div class="card" style="margin-bottom:12px; padding:16px;">
                    <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:6px;">
                        <strong>${m.subject}</strong>
                        <span style="font-size:12px; color:var(--text-secondary); white-space:nowrap;">${new Date(m.createdAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <p style="margin:6px 0; color:var(--text-secondary);">${m.message}</p>
                    ${m.adminReply
                        ? `<div style="background:var(--bg-card, rgba(0,0,0,0.2)); border-left:3px solid #FA1757; padding:10px 12px; margin-top:8px; font-size:13px;"><strong>Support Shopika :</strong> ${m.adminReply}</div>`
                        : '<p style="font-size:12px; color:var(--text-secondary); margin-top:8px;">En attente de réponse du support…</p>'}
                </div>`).join('');

        return `
        <div class="card" style="max-width: 600px; margin: 0 auto;">
            <h3 style="margin-bottom: 20px; text-align: center;">Contacter le Support Shopika</h3>
            <div class="form-group"><label class="form-label">Sujet</label><input type="text" class="form-input" id="supportSubject" placeholder="Problème de paiement..."></div>
            <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" id="supportMessage" style="min-height: 150px;"></textarea></div>
            <button class="btn btn-primary" style="width:100%;" onclick="sendSupportMessage()">Envoyer le ticket</button>
            <p id="supportStatus" style="margin-top:8px; font-size:13px; text-align:center;"></p>
        </div>
        <h3 style="margin:24px 0 12px;">Échanges précédents</h3>
        ${error ? `<p style="color:#EF4444;">${error}</p>` : list}`;
    }
};

// ===================================================================
// Actions des vues (appelées via onclick="...").
// API_BASE, authToken, merchant et router viennent de
// router.js (chargé après views.js, mais ces fonctions ne
// s'exécutent que sur interaction, quand tout est chargé).
// ===================================================================

// Abonnement : paiement FedaPay (frais de création ou réabonnement)
window.paySubscription = async () => {
    const btn = document.getElementById('paySubscriptionBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Redirection…'; }
    try {
        const res = await fetch(`${API_BASE}/stores/me/subscription/pay`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Impossible d'initier le paiement");
        window.location.href = data.paymentUrl; // FedaPay (Mobile Money / carte)
    } catch (e) {
        alert(e.message);
        if (btn) { btn.disabled = false; btn.textContent = 'Payer'; }
    }
};

// Personnalisation : choix du thème de la boutique (1 Basique, 2 Carrousel, 3 Catalogue)
let pendingTheme = null;
function shopUrl(themeId) {
    const base = (window.SHOPIKA_MERCHANT_CONFIG.FRONT_URL || '').replace(/\/$/, '');
    return `${base}/boutique.html?slug=${encodeURIComponent(merchant.subdomain || '')}` + (themeId ? `&theme=${themeId}` : '');
}
window.selectTheme = (id) => {
    pendingTheme = id;
    document.querySelectorAll('.theme-option').forEach(el => el.classList.toggle('selected', Number(el.dataset.theme) === id));
    // « Voir ma boutique » ouvre le thème sélectionné, même s'il n'est pas encore appliqué (aperçu).
    const link = document.getElementById('themePreviewLink');
    if (link) link.href = shopUrl(id);
};
window.saveTheme = async () => {
    const status = document.getElementById('themeStatus');
    const id = pendingTheme || merchant.themeId || 1;
    try {
        const res = await fetch(`${API_BASE}/stores`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ theme_id: id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        merchant.themeId = id;
        status.textContent = 'Thème appliqué : vos clients le voient dès maintenant.';
        status.style.color = '#10B981';
    } catch (e) {
        status.textContent = e.message;
        status.style.color = '#EF4444';
    }
};

// Personnalisation : identité visuelle de la boutique
window.saveAppearance = async () => {
    const status = document.getElementById('appearanceStatus');
    const name = document.getElementById('appearanceName').value.trim();
    if (!name) { status.textContent = 'Le nom de la boutique est requis.'; status.style.color = '#EF4444'; return; }
    const body = {
        name,
        color_primary: document.getElementById('appearancePrimary').value,
        color_secondary: document.getElementById('appearanceSecondary').value
    };
    try {
        const res = await fetch(`${API_BASE}/stores`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        merchant.name = body.name;
        merchant.colorPrimary = body.color_primary;
        merchant.colorSecondary = body.color_secondary;
        applyMerchantIdentity();
        status.textContent = 'Modifications enregistrées.';
        status.style.color = '#10B981';
    } catch (e) {
        status.textContent = e.message;
        status.style.color = '#EF4444';
    }
};

// Paramètres : e-mail de notification + opt-out (PATCH /auth/me)
window.saveNotificationSettings = async () => {
    const status = document.getElementById('notifStatus');
    const email = document.getElementById('settingsEmail').value.trim();
    const emailNotifications = document.getElementById('settingsEmailNotif').value === 'true';
    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ email: email || null, emailNotifications })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        const stored = JSON.parse(localStorage.getItem('shopika_user') || '{}');
        stored.email = data.user.email;
        stored.emailNotifications = data.user.emailNotifications;
        localStorage.setItem('shopika_user', JSON.stringify(stored));
        merchant.email = data.user.email;
        merchant.emailNotifications = data.user.emailNotifications;
        status.textContent = 'Préférences enregistrées.';
        status.style.color = '#10B981';
    } catch (e) {
        status.textContent = e.message;
        status.style.color = '#EF4444';
    }
};

// Paramètres : livraison & coordonnées de versement (PATCH /stores)
window.saveStoreSettings = async () => {
    const status = document.getElementById('storeStatus');
    const body = {
        shipping_fee: Number(document.getElementById('settingsShippingFee').value) || 0,
        payout_phone: document.getElementById('settingsPayoutPhone').value.trim() || null,
        payout_country: document.getElementById('settingsPayoutCountry').value.trim().toUpperCase() || null
    };
    try {
        const res = await fetch(`${API_BASE}/stores`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        merchant.shippingFee = body.shipping_fee;
        merchant.payoutPhone = body.payout_phone;
        merchant.payoutCountry = body.payout_country;
        status.textContent = 'Enregistré.';
        status.style.color = '#10B981';
    } catch (e) {
        status.textContent = e.message;
        status.style.color = '#EF4444';
    }
};

// Support : envoi d'un ticket (POST /support)
window.sendSupportMessage = async () => {
    const status = document.getElementById('supportStatus');
    const subject = document.getElementById('supportSubject').value.trim();
    const message = document.getElementById('supportMessage').value.trim();
    if (!subject || !message) {
        status.textContent = 'Sujet et message requis.';
        status.style.color = '#EF4444';
        return;
    }
    status.textContent = 'Envoi…';
    status.style.color = 'var(--text-secondary)';
    try {
        const res = await fetch(`${API_BASE}/support`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ subject, message })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        router('support'); // réaffiche avec le ticket envoyé
    } catch (e) {
        status.textContent = e.message;
        status.style.color = '#EF4444';
    }
};

// Bascule la visibilité de la boutique (PATCH /stores { is_published }).
window.togglePublish = async (el) => {
    const wanted = el.checked;
    el.disabled = true;
    try {
        const res = await fetch(`${API_BASE}/stores`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ is_published: wanted })
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur');
        merchant.isPublished = wanted;
        const label = document.getElementById('publishState');
        if (label) { label.textContent = wanted ? 'Boutique visible' : 'Boutique masquée'; label.style.color = wanted ? 'var(--color-success)' : 'var(--text-secondary)'; }
        if (window.Motion) Motion.toast(wanted ? 'Votre boutique est visible sur la marketplace' : 'Votre boutique est masquée', 'success');
    } catch (err) {
        el.checked = !wanted;
        if (window.Motion) Motion.toast(err.message || 'Impossible de modifier la visibilité', 'error'); else alert(err.message);
    } finally {
        el.disabled = false;
    }
};
