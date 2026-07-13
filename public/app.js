// ==========================================================================
// FRONTEND STATE MANAGEMENT
// ==========================================================================
let state = {
  currentUser: JSON.parse(localStorage.getItem('ghumti_user')) || null,
  currentRole: 'customer',
  products: [],
  categories: [],
  subcategories: [],
  cart: [],
  orders: [],
  logs: [],
  activeCategoryFilter: 'all',
  checkoutOrder: null, 
  selectedReviewStars: 5,
  activeProductForDetail: null,
  carouselSlideIndex: 0,
  carouselTimer: null
};

// ==========================================================================
// ON BOOTSTRAP INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
  startCarouselAutoPlay();
  
  // Poll logs for the audit console
  setInterval(fetchLogs, 2000);
});

async function initApp() {
  await fetchCategories();
  await fetchSubcategories();
  await fetchProducts();
  await fetchOrders();
  fetchLogs();

  // Load cart from session if exists
  const cachedCart = localStorage.getItem('ghumti_cart');
  if (cachedCart) {
    state.cart = JSON.parse(cachedCart);
    updateCartUI();
  }

  // Restore login state
  updateAuthUI();
  
  // Set default view
  switchView(state.currentRole);
}

// ==========================================================================
// PROMOTIONAL BANNER CAROUSEL
// ==========================================================================
function startCarouselAutoPlay() {
  state.carouselTimer = setInterval(() => {
    let nextIndex = state.carouselSlideIndex + 1;
    if (nextIndex >= 3) nextIndex = 0;
    setCarouselSlide(nextIndex);
  }, 4000);
}

function setCarouselSlide(index) {
  state.carouselSlideIndex = index;
  
  // Reset Timer
  clearInterval(state.carouselTimer);
  startCarouselAutoPlay();

  // Update DOM slides
  const slides = document.querySelectorAll('#heroCarousel .carousel-slide');
  const dots = document.querySelectorAll('#heroCarousel .dot');
  
  if (slides.length === 0) return;

  slides.forEach((slide, i) => {
    if (i === index) {
      slide.classList.add('active');
    } else {
      slide.classList.remove('active');
    }
  });

  dots.forEach((dot, i) => {
    if (i === index) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}

// ==========================================================================
// COLLAPSIBLE LOGS AND TOOLBARS
// ==========================================================================
function toggleDevBar() {
  const bar = document.getElementById('devSandboxBar');
  const icon = document.getElementById('devToggleIcon');
  if (bar.classList.contains('collapsed')) {
    bar.classList.remove('collapsed');
    icon.textContent = '▼';
  } else {
    bar.classList.add('collapsed');
    icon.textContent = '▲';
  }
}

function toggleConsole() {
  const consolePanel = document.getElementById('auditConsoleCollapsible');
  const arrow = document.getElementById('consoleToggleArrow');
  if (!consolePanel || !arrow) return;
  if (consolePanel.classList.contains('collapsed')) {
    consolePanel.classList.remove('collapsed');
    arrow.textContent = '▼';
  } else {
    consolePanel.classList.add('collapsed');
    arrow.textContent = '▲';
  }
}

function clearVisualConsole() {
  const body = document.getElementById('auditConsoleBody');
  if (body) body.innerHTML = '';
}

// ==========================================================================
// ONBOARDING MODAL CONTROLS
// ==========================================================================
function openOnboardingModal() {
  document.getElementById('onboardingModalOverlay').classList.add('active');
}

function closeOnboardingModal() {
  document.getElementById('onboardingModalOverlay').classList.remove('active');
}

// ==========================================================================
// AUTHENTICATION FLOW
// ==========================================================================
function updateAuthUI() {
  const nameSpan = document.getElementById('headerUserName');
  const loginHeaderBtn = document.getElementById('loginHeaderBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (state.currentUser) {
    nameSpan.textContent = `${state.currentUser.fullName}`;
    loginHeaderBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
  } else {
    nameSpan.textContent = 'Guest Mode';
    loginHeaderBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
  }
}

// Tab triggers
document.getElementById('tabLoginBtn').addEventListener('click', () => {
  document.getElementById('tabLoginBtn').classList.add('active');
  document.getElementById('tabSignupBtn').classList.remove('active');
  document.getElementById('loginFormContainer').classList.add('active');
  document.getElementById('signupFormContainer').classList.remove('active');
});

document.getElementById('tabSignupBtn').addEventListener('click', () => {
  document.getElementById('tabSignupBtn').classList.add('active');
  document.getElementById('tabLoginBtn').classList.remove('active');
  document.getElementById('signupFormContainer').classList.add('active');
  document.getElementById('loginFormContainer').classList.remove('active');
});

// Login Form Submit
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      state.currentUser = data.user;
      localStorage.setItem('ghumti_user', JSON.stringify(data.user));
      updateAuthUI();
      closeOnboardingModal();
      
      // Sync dropdowns & roles
      const rSel1 = document.getElementById('roleSelector'); if(rSel1) rSel1.value = data.user.role;
      state.currentRole = data.user.role;
      switchView(data.user.role);
    }
  } catch (err) {
    console.error(err);
    alert('Failed connecting to server auth.');
  }
});

// Signup Form Submit
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fullName = document.getElementById('signupName').value;
  const username = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const dob = document.getElementById('signupDob').value;

  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, username, password, dob })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      alert('Account registered! Please sign in.');
      document.getElementById('tabLoginBtn').click();
    }
  } catch (err) {
    console.error(err);
    alert('Failed to register.');
  }
});

// Logout click
document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.stopPropagation(); 
  state.currentUser = null;
  localStorage.removeItem('ghumti_user');
  state.cart = [];
  localStorage.removeItem('ghumti_cart');
  updateCartUI();
  updateAuthUI();
  
  // Return to customer view
  const rSel2 = document.getElementById('roleSelector'); if(rSel2) rSel2.value = 'customer';
  state.currentRole = 'customer';
  switchView('customer');
});

// ==========================================
// ROLE BASED NAVIGATION SWITCH
// ==========================================
const rSelEv = document.getElementById('roleSelector'); if(rSelEv) rSelEv.addEventListener('change', (e) => {
  const roleSelected = e.target.value;
  if (!state.currentUser && roleSelected !== 'customer') {
    alert('Please sign in or register to access administration controls.');
    e.target.value = 'customer';
    openOnboardingModal();
    return;
  }
  
  if (roleSelected === 'admin' && state.currentUser.role === 'customer') {
    alert('Access Denied: Only Admins and Super Admins can access Catalog configuration.');
    e.target.value = 'customer';
    return;
  }

  if (roleSelected === 'superadmin' && state.currentUser.role !== 'superadmin') {
    alert('Access Denied: Super Admin level authorization is required to access analytics.');
    e.target.value = state.currentRole;
    return;
  }

  state.currentRole = roleSelected;
  switchView(roleSelected);
});

function switchView(role) {
  // Hide all panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.style.display = 'none';
  });

  // Customer storefront is always accessible
  if (role === 'customer') {
    document.getElementById('customerViewSection').style.display = 'block';
    renderProducts();
  } else if (role === 'admin') {
    document.getElementById('adminViewSection').style.display = 'block';
    populateAdminDropdowns();
  } else if (role === 'superadmin') {
    document.getElementById('superadminViewSection').style.display = 'block';
    loadSuperAdminDashboard();
  } else if (role === 'operations') {
    document.getElementById('operationsViewSection').style.display = 'block';
    renderOperationsDashboard();
  }
}

// ==========================================
// DATA RETRIEVAL (GET APIS)
// ==========================================
async function fetchCategories() {
  const res = await fetch('/api/categories');
  state.categories = await res.json();
}

async function fetchSubcategories() {
  const res = await fetch('/api/subcategories');
  state.subcategories = await res.json();
}

async function fetchProducts() {
  const res = await fetch('/api/products');
  state.products = await res.json();
}

async function fetchOrders() {
  const res = await fetch('/api/orders');
  state.orders = await res.json();
}

async function fetchLogs() {
  const res = await fetch('/api/logs');
  state.logs = await res.json();
  renderLogsConsole();
}

// ==========================================
// CUSTOMER VIEW CATEGORY DIRECT DELEGATION
// ==========================================
function filterCategory(catId) {
  state.activeCategoryFilter = catId;
  
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  if (catId === 'all') {
    document.getElementById('menuAll').classList.add('active');
    document.getElementById('catalogSectionTitle').textContent = 'Weekly Featured Catalog';
  } else if (catId == 1) {
    document.getElementById('menuLiquor').classList.add('active');
    document.getElementById('catalogSectionTitle').textContent = 'Department: Cellar Spirits & Liquors';
  } else if (catId == 2) {
    document.getElementById('menuGroceries').classList.add('active');
    document.getElementById('catalogSectionTitle').textContent = 'Department: Fresh & Chilled Groceries';
  } else if (catId == 3) {
    document.getElementById('menuCoffee').classList.add('active');
    document.getElementById('catalogSectionTitle').textContent = 'Department: Himalayan Specialty Coffee';
  }

  if (state.currentRole === 'customer') {
    document.getElementById('catalogSectionTitle').scrollIntoView({ behavior: 'smooth' });
    renderProducts();
  } else {
    state.currentRole = 'customer';
    const rSel2 = document.getElementById('roleSelector'); if(rSel2) rSel2.value = 'customer';
    switchView('customer');
  }
}

function filterFlashSales() {
  state.activeCategoryFilter = 'discounted';
  
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  document.getElementById('menuFlash').classList.add('active');
  document.getElementById('catalogSectionTitle').textContent = '⚡ Hot Deals & Discounted Flash Sales';

  if (state.currentRole === 'customer') {
    document.getElementById('catalogSectionTitle').scrollIntoView({ behavior: 'smooth' });
    renderProducts();
  } else {
    state.currentRole = 'customer';
    const rSel2 = document.getElementById('roleSelector'); if(rSel2) rSel2.value = 'customer';
    switchView('customer');
  }
}

// ==========================================
// STOREFRONT CATALOG RENDER
// ==========================================
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const filtersContainer = document.getElementById('categoryFilters');
  grid.innerHTML = '';

  filtersContainer.innerHTML = '<button class="filter-pill ' + (state.activeCategoryFilter === 'all' ? 'active' : '') + '" onclick="filterCategory(\'all\')">All Categories</button>';
  state.categories.forEach(cat => {
    const activeClass = state.activeCategoryFilter == cat.id ? 'active' : '';
    filtersContainer.innerHTML += `<button class="filter-pill ${activeClass}" onclick="filterCategory(${cat.id})">${cat.name}</button>`;
  });
  const discountActive = state.activeCategoryFilter === 'discounted' ? 'active' : '';
  filtersContainer.innerHTML += `<button class="filter-pill ${discountActive}" onclick="filterFlashSales()">⚡ Discounts</button>`;

  const query = document.getElementById('searchInput').value.toLowerCase();

  const filteredProducts = state.products.filter(prod => {
    let matchesCategory = false;
    if (state.activeCategoryFilter === 'all') {
      matchesCategory = true;
    } else if (state.activeCategoryFilter === 'discounted') {
      matchesCategory = prod.originalPrice && prod.originalPrice > prod.price;
    } else {
      matchesCategory = prod.categoryId == state.activeCategoryFilter;
    }

    const matchesSearch = prod.name.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  if (filteredProducts.length === 0) {
    grid.innerHTML = '<p class="empty-msg">No products found matching the criteria.</p>';
    return;
  }

  filteredProducts.forEach(prod => {
    const hasImage = prod.imageUrl && prod.imageUrl !== '';
    let imageHtml = '';
    
    if (hasImage) {
      imageHtml = `<img src="${prod.imageUrl}" class="product-image" alt="${prod.name}">`;
    } else {
      let icon = '📦';
      let gradientClass = 'gradient-fallback-default';
      if (prod.categoryId === 1) { icon = '🥃'; gradientClass = 'gradient-fallback-liquor'; }
      else if (prod.categoryId === 2) { icon = '🍎'; gradientClass = 'gradient-fallback-groceries'; }
      else if (prod.categoryId === 3) { icon = '☕'; gradientClass = 'gradient-fallback-coffee'; }
      
      imageHtml = `<div class="${gradientClass}">${icon}</div>`;
    }

    const ageRestrictedBadge = prod.isAgeRestricted ? '<span class="restricted-pill">⚠️ Age 18+</span>' : '';
    const stockClass = prod.stock === 0 ? 'out' : (prod.stock < 5 ? 'low' : '');
    const stockText = prod.stock === 0 ? 'Out of Stock' : (prod.stock < 5 ? `Only ${prod.stock} left!` : `In Stock: ${prod.stock}`);
    
    let pricingHtml = '';
    if (prod.originalPrice && prod.originalPrice > prod.price) {
      const discountPct = Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100);
      const savings = prod.originalPrice - prod.price;
      pricingHtml = `
        <div class="product-price-row">
          <span class="price-pill">NPR ${prod.price.toLocaleString()}</span>
          <div class="old-price-container">
            <span class="old-price">NPR ${prod.originalPrice.toLocaleString()}</span>
            <span class="percent-off">-${discountPct}%</span>
            <span class="save-tag">Save NPR ${savings}</span>
          </div>
        </div>
      `;
    } else {
      pricingHtml = `
        <div class="product-price-row">
          <span class="price-pill">NPR ${prod.price.toLocaleString()}</span>
        </div>
      `;
    }

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      ${ageRestrictedBadge}
      <div class="product-image-container" onclick="openProductDetail(${prod.id})">
        ${imageHtml}
      </div>
      <div class="product-info-block">
        <h3 class="product-title" onclick="openProductDetail(${prod.id})">${prod.name}</h3>
        <div class="product-meta-row">
          <span class="rating-pill">⭐ ${prod.averageRating > 0 ? prod.averageRating.toFixed(1) : 'N/A'}</span>
          <span class="stock-status ${stockClass}">${stockText}</span>
        </div>
        ${pricingHtml}
        <button class="btn-primary w-full mt-large" onclick="addToCart(${prod.id})" ${prod.stock === 0 ? 'disabled' : ''}>
          ${prod.stock === 0 ? 'Sold Out' : '🛒 Add to Cart'}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Search field triggers
document.getElementById('searchInput').addEventListener('input', renderProducts);

// ==========================================
// CART & DRAWER LOGIC
// ==========================================
const cartDrawer = document.getElementById('cartDrawer');
const cartOverlay = document.getElementById('cartOverlay');

document.getElementById('cartToggleBtn').addEventListener('click', () => {
  cartDrawer.classList.add('active');
  cartOverlay.classList.add('active');
});

document.getElementById('closeCartBtn').addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);

function closeCart() {
  cartDrawer.classList.remove('active');
  cartOverlay.classList.remove('active');
}

function addToCart(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  const existing = state.cart.find(item => item.id === productId);
  if (existing) {
    if (existing.qty < prod.stock) {
      existing.qty++;
    } else {
      alert(`Cannot add more. Only ${prod.stock} units available.`);
    }
  } else {
    state.cart.push({
      id: prod.id,
      name: prod.name,
      price: prod.price,
      qty: 1,
      isAgeRestricted: prod.isAgeRestricted
    });
  }

  localStorage.setItem('ghumti_cart', JSON.stringify(state.cart));
  updateCartUI();
  
  cartDrawer.classList.add('active');
  cartOverlay.classList.add('active');
}

function updateCartUI() {
  const list = document.getElementById('cartItemsList');
  const countBadge = document.getElementById('cartCountBadge');
  const checkoutBtn = document.getElementById('checkoutBtn');
  list.innerHTML = '';

  let subtotal = 0;
  let totalQty = 0;

  if (state.cart.length === 0) {
    list.innerHTML = '<p class="empty-cart-msg">Your shopping cart is empty.</p>';
    checkoutBtn.disabled = true;
  } else {
    checkoutBtn.disabled = false;
    state.cart.forEach(item => {
      subtotal += item.price * item.qty;
      totalQty += item.qty;

      const itemRow = document.createElement('div');
      itemRow.className = 'cart-item';
      itemRow.innerHTML = `
        <div class="cart-item-details">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">NPR ${item.price.toLocaleString()} each</div>
          <div class="qty-control">
            <button class="qty-btn" onclick="adjustQty(${item.id}, -1)">-</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" onclick="adjustQty(${item.id}, 1)">+</button>
          </div>
        </div>
        <button class="remove-item-btn" onclick="removeFromCart(${item.id})">🗑️</button>
      `;
      list.appendChild(itemRow);
    });
  }

  const tax = parseFloat((subtotal * 0.13).toFixed(2));
  const delivery = subtotal > 0 ? 150 : 0;
  const total = subtotal + tax + delivery;

  countBadge.textContent = totalQty;
  document.getElementById('cartSubtotal').textContent = `NPR ${subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
  document.getElementById('cartTax').textContent = `NPR ${tax.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
  document.getElementById('cartDelivery').textContent = `NPR ${delivery.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
  document.getElementById('cartTotal').textContent = `NPR ${total.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
}

function adjustQty(productId, change) {
  const item = state.cart.find(i => i.id === productId);
  const prod = state.products.find(p => p.id === productId);
  if (!item || !prod) return;

  if (change === 1) {
    if (item.qty < prod.stock) {
      item.qty++;
    } else {
      alert(`Only ${prod.stock} units available in stock.`);
    }
  } else if (change === -1) {
    item.qty--;
    if (item.qty <= 0) {
      return removeFromCart(productId);
    }
  }

  localStorage.setItem('ghumti_cart', JSON.stringify(state.cart));
  updateCartUI();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(item => item.id !== productId);
  localStorage.setItem('ghumti_cart', JSON.stringify(state.cart));
  updateCartUI();
}

// ==========================================
// CHECKOUT & PAYMENT INTEGRATIONS
// ==========================================
const checkoutOverlay = document.getElementById('checkoutModalOverlay');
document.getElementById('checkoutBtn').addEventListener('click', triggerCheckout);
document.getElementById('closeCheckoutModalBtn').addEventListener('click', () => {
  checkoutOverlay.classList.remove('active');
});

async function triggerCheckout() {
  if (!state.currentUser) {
    closeCart();
    alert('Please sign in or register an account to proceed with checkout.');
    openOnboardingModal();
    return;
  }

  closeCart();

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: state.cart.map(item => ({ id: item.id, qty: item.qty })),
        user: { username: state.currentUser.username }
      })
    });
    const data = await res.json();
    
    if (data.error) {
      alert(data.error);
    } else {
      state.checkoutOrder = data.order;
      document.getElementById('checkoutTotalText').textContent = `NPR ${data.order.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
      
      const ageWarning = document.getElementById('checkoutAgeWarning');
      if (data.containsAgeRestricted) {
        ageWarning.style.display = 'block';
      } else {
        ageWarning.style.display = 'none';
      }

      checkoutOverlay.classList.add('active');
    }
  } catch (err) {
    console.error(err);
    alert('Checkout request failed.');
  }
}

document.getElementById('payEsewaBtn').addEventListener('click', () => initiatePayment('esewa'));
document.getElementById('payKhaltiBtn').addEventListener('click', () => initiatePayment('khalti'));
document.getElementById('payConnectIpsBtn').addEventListener('click', () => initiatePayment('connectips'));

async function initiatePayment(gateway) {
  checkoutOverlay.classList.remove('active');
  const orderId = state.checkoutOrder.id;

  try {
    const res = await fetch('/api/payment/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, gateway })
    });
    const data = await res.json();

    if (data.error) {
      alert(data.error);
    } else {
      launchSimulator(gateway, data.payload);
    }
  } catch (err) {
    console.error(err);
    alert('Payment initiation failed.');
  }
}

// ==========================================
// PAYMENT GATEWAYS SIMULATOR INTERFACES
// ==========================================
const simOverlay = document.getElementById('gatewaySimulatorOverlay');
const esewaSimCard = document.getElementById('esewaSimulator');
const khaltiSimCard = document.getElementById('khaltiSimulator');

let activeSimPayload = null;
let activeSimGateway = null;

function launchSimulator(gateway, payload) {
  activeSimGateway = gateway;
  activeSimPayload = payload;
  
  simOverlay.classList.add('active');
  esewaSimCard.classList.remove('active');
  khaltiSimCard.classList.remove('active');

  if (gateway === 'esewa') {
    esewaSimCard.classList.add('active');
    document.getElementById('esewaSimUuid').textContent = payload.transaction_uuid;
    document.getElementById('esewaSimAmount').textContent = `NPR ${payload.total_amount.toLocaleString()}`;
    document.getElementById('tamperEsewaPrice').checked = false;
  } else if (gateway === 'khalti') {
    khaltiSimCard.classList.add('active');
    document.getElementById('khaltiSimPidx').textContent = payload.pidx;
    document.getElementById('khaltiSimAmount').textContent = `NPR ${(payload.amount / 100).toLocaleString()}`;
    document.getElementById('khaltiStatusOverride').value = 'Completed';
  } else if (gateway === 'connectips') {
    alert('Redirecting to simulated ConnectIPS interbank portal. Authorizing secure transfer...');
    setTimeout(() => {
      window.location.href = `/api/payment/callback/connectips?txnId=${payload.txnId}&status=SUCCESS`;
    }, 1500);
  }
}

document.getElementById('simEsewaCancelBtn').addEventListener('click', dismissSimulator);
document.getElementById('simKhaltiCancelBtn').addEventListener('click', dismissSimulator);

function dismissSimulator() {
  simOverlay.classList.remove('active');
  alert('Transaction cancelled by user.');
}

// eSewa Submit Payment
document.getElementById('simEsewaPayBtn').addEventListener('click', () => {
  const tamper = document.getElementById('tamperEsewaPrice').checked;
  let finalAmount = activeSimPayload.total_amount;
  let finalUuid = activeSimPayload.transaction_uuid;
  let finalCode = activeSimPayload.product_code;
  let finalSignature = activeSimPayload.signature;

  if (tamper) {
    finalAmount = 1; 
  }

  const jsonResponse = {
    status: 'COMPLETE',
    transaction_code: 'TXN-' + Math.floor(Math.random() * 1e9),
    total_amount: finalAmount.toString(),
    transaction_uuid: finalUuid,
    product_code: finalCode,
    signature: finalSignature
  };

  const encodedData = btoa(JSON.stringify(jsonResponse));
  
  if (!tamper) {
    state.cart = [];
    localStorage.removeItem('ghumti_cart');
    updateCartUI();
  }

  window.location.href = `/api/payment/callback/esewa?data=${encodedData}`;
});

// Khalti Submit Payment
document.getElementById('simKhaltiPayBtn').addEventListener('click', () => {
  const status = document.getElementById('khaltiStatusOverride').value;

  if (status === 'Completed') {
    state.cart = [];
    localStorage.removeItem('ghumti_cart');
    updateCartUI();
  }

  window.location.href = `/api/payment/callback/khalti?pidx=${activeSimPayload.pidx}&status=${status}&purchase_order_id=${activeSimPayload.purchase_order_id}`;
});

// ==========================================
// PRODUCT DETAIL & RATINGS FLOW
// ==========================================
const detailModalOverlay = document.getElementById('productDetailModalOverlay');
document.getElementById('closeDetailModalBtn').addEventListener('click', () => {
  detailModalOverlay.classList.remove('active');
});

async function openProductDetail(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  state.activeProductForDetail = productId;
  detailModalOverlay.classList.add('active');

  document.getElementById('detailModalTitle').textContent = prod.name;
  document.getElementById('detailModalName').textContent = prod.name;
  
  const cat = state.categories.find(c => c.id === prod.categoryId);
  document.getElementById('detailModalCategory').textContent = cat ? cat.name : 'Product';
  document.getElementById('detailModalStock').textContent = `Remaining Stock: ${prod.stock}`;
  document.getElementById('detailModalPrice').textContent = `NPR ${prod.price.toLocaleString()}`;
  document.getElementById('detailModalRatingText').textContent = `${prod.averageRating > 0 ? prod.averageRating.toFixed(1) : '0.0'} (${prod.ratingCount} reviews)`;
  
  let starStr = '';
  const avg = Math.round(prod.averageRating || 0);
  for (let i = 1; i <= 5; i++) {
    starStr += i <= avg ? '⭐' : '☆';
  }
  document.getElementById('detailModalRatingStars').textContent = starStr;

  const imgBox = document.getElementById('detailModalImage');
  imgBox.innerHTML = '';
  if (prod.imageUrl) {
    imgBox.innerHTML = `<img src="${prod.imageUrl}" class="product-image">`;
  } else {
    let icon = '📦';
    let gradientClass = 'gradient-fallback-default';
    if (prod.categoryId === 1) { icon = '🥃'; gradientClass = 'gradient-fallback-liquor'; }
    else if (prod.categoryId === 2) { icon = '🍎'; gradientClass = 'gradient-fallback-groceries'; }
    else if (prod.categoryId === 3) { icon = '☕'; gradientClass = 'gradient-fallback-coffee'; }
    imgBox.innerHTML = `<div class="${gradientClass}" style="height: 100%; border-radius: 0;">${icon}</div>`;
  }

  await loadReviews(productId);
}

async function loadReviews(productId) {
  const list = document.getElementById('detailReviewsList');
  list.innerHTML = '';

  try {
    const res = await fetch(`/api/products/${productId}/reviews`);
    const reviews = await res.json();

    if (reviews.length === 0) {
      list.innerHTML = '<p class="empty-msg">No customer reviews yet. Be the first to leave feedback!</p>';
      return;
    }

    reviews.forEach(rev => {
      const verified = rev.isVerifiedBuyer ? '<span class="verified-badge">Verified Buyer</span>' : '';
      let stars = '';
      for (let i = 1; i <= 5; i++) {
        stars += i <= rev.rating ? '★' : '☆';
      }

      const revRow = document.createElement('div');
      revRow.className = 'review-item';
      revRow.innerHTML = `
        <div class="review-header">
          <strong>${rev.username}</strong>
          <div>
            <span class="stars">${stars}</span>
            <span>(${rev.date})</span>
            ${verified}
          </div>
        </div>
        <div class="review-comment">${rev.comment}</div>
      `;
      list.appendChild(revRow);
    });
  } catch (err) {
    console.error(err);
  }
}

// Star rating selection
const starSpans = document.querySelectorAll('#starSelector span');
starSpans.forEach(span => {
  span.addEventListener('click', (e) => {
    const rating = e.target.getAttribute('data-star');
    document.getElementById('selectedStars').value = rating;
    
    starSpans.forEach(s => {
      const sVal = s.getAttribute('data-star');
      if (parseInt(sVal) <= parseInt(rating)) {
        s.classList.add('selected');
      } else {
        s.classList.remove('selected');
      }
    });
  });
});

// Submit review
document.getElementById('submitReviewForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentUser) {
    alert('Please sign in or register to submit feedback.');
    openOnboardingModal();
    return;
  }

  const rating = document.getElementById('selectedStars').value;
  const comment = document.getElementById('reviewComment').value;
  const productId = state.activeProductForDetail;

  try {
    const res = await fetch(`/api/products/${productId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating,
        comment,
        username: state.currentUser.username
      })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      document.getElementById('reviewComment').value = '';
      await fetchProducts(); 
      await openProductDetail(productId); 
      renderProducts(); 
    }
  } catch (err) {
    console.error(err);
    alert('Failed submitting review.');
  }
});

// ==========================================
// ADMIN DASHBOARD CATALOG CONTROLS
// ==========================================
function populateAdminDropdowns() {
  const catSelect1 = document.getElementById('subcategoryParent');
  const catSelect2 = document.getElementById('productCategory');
  const subSelect = document.getElementById('productSubcategory');

  if (!catSelect1) return; 

  catSelect1.innerHTML = '';
  catSelect2.innerHTML = '';
  
  state.categories.forEach(c => {
    catSelect1.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    catSelect2.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });

  catSelect2.addEventListener('change', (e) => {
    const catId = e.target.value;
    populateSubcategoriesDropdown(catId, subSelect);
  });

  if (state.categories.length > 0) {
    populateSubcategoriesDropdown(state.categories[0].id, subSelect);
  }
}

function populateSubcategoriesDropdown(categoryId, dropdownElement) {
  dropdownElement.innerHTML = '';
  const filtered = state.subcategories.filter(s => s.categoryId == categoryId);
  filtered.forEach(s => {
    dropdownElement.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
}

document.getElementById('addCategoryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('categoryName').value;

  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      alert(`Category '${data.name}' created!`);
      document.getElementById('categoryName').value = '';
      await fetchCategories();
      populateAdminDropdowns();
    }
  } catch (err) {
    console.error(err);
  }
});

document.getElementById('addSubcategoryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const categoryId = document.getElementById('subcategoryParent').value;
  const name = document.getElementById('subcategoryName').value;

  try {
    const res = await fetch('/api/subcategories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, categoryId })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      alert(`Subcategory '${data.name}' created!`);
      document.getElementById('subcategoryName').value = '';
      await fetchSubcategories();
      populateAdminDropdowns();
    }
  } catch (err) {
    console.error(err);
  }
});

document.getElementById('addProductForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = document.getElementById('addProductForm');
  const formData = new FormData();

  formData.append('name', document.getElementById('productName').value);
  formData.append('categoryId', document.getElementById('productCategory').value);
  formData.append('subcategoryId', document.getElementById('productSubcategory').value);
  formData.append('price', document.getElementById('productPrice').value);
  formData.append('stock', document.getElementById('productStock').value);
  formData.append('isAgeRestricted', document.getElementById('productAgeRestricted').checked);
  
  const fileInput = document.getElementById('productImage');
  if (fileInput.files.length > 0) {
    formData.append('image', fileInput.files[0]);
  }

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      alert(`Product '${data.name}' uploaded successfully!`);
      form.reset();
      await fetchProducts();
    }
  } catch (err) {
    console.error(err);
    alert('Failed uploading product.');
  }
});

// ==========================================
// SUPER ADMIN DASHBOARD
// ==========================================
async function loadSuperAdminDashboard() {
  const resSummary = await fetch('/api/admin/sales-summary');
  const summary = await resSummary.json();

  document.getElementById('kpiSales').textContent = `NPR ${summary.totalSales.toLocaleString(undefined, {minimumFractionDigits:2})}`;
  document.getElementById('kpiPurchases').textContent = `NPR ${summary.totalPurchases.toLocaleString(undefined, {minimumFractionDigits:2})}`;
  document.getElementById('kpiMargin').textContent = `NPR ${summary.netMargin.toLocaleString(undefined, {minimumFractionDigits:2})}`;
  document.getElementById('kpiOrders').textContent = summary.ordersCount;

  const marginPill = document.getElementById('kpiMarginPill');
  if (summary.netMargin >= 0) {
    marginPill.textContent = 'Net Profit';
    marginPill.className = 'pill text-green';
  } else {
    marginPill.textContent = 'Net Loss';
    marginPill.className = 'pill text-red';
  }

  const restockSelect = document.getElementById('restockProduct');
  restockSelect.innerHTML = '';
  state.products.forEach(p => {
    restockSelect.innerHTML += `<option value="${p.name}">${p.name} (Stock: ${p.stock})</option>`;
  });

  const resPurchases = await fetch('/api/admin/purchases');
  const purchases = await resPurchases.json();
  const purTableBody = document.querySelector('#purchasesTable tbody');
  purTableBody.innerHTML = '';
  purchases.forEach(p => {
    purTableBody.innerHTML += `
      <tr>
        <td>${p.id}</td>
        <td>${p.productNames}</td>
        <td>${p.supplier}</td>
        <td>${p.quantity}</td>
        <td>${p.cost.toLocaleString()}</td>
        <td>${p.date}</td>
      </tr>
    `;
  });

  const resTxns = await fetch('/api/admin/transactions');
  const txns = await resTxns.json();
  const txTableBody = document.querySelector('#transactionsTable tbody');
  txTableBody.innerHTML = '';
  txns.forEach(t => {
    const statusClass = t.status === 'completed' ? 'text-green' : (t.status === 'initiated' ? 'text-purple' : 'text-red');
    txTableBody.innerHTML += `
      <tr>
        <td>${t.orderId}</td>
        <td>${t.user}</td>
        <td>NPR ${t.amount.toLocaleString()}</td>
        <td>${t.gateway.toUpperCase()}</td>
        <td>${t.txnUuid}</td>
        <td class="${statusClass}"><strong>${t.status.toUpperCase()}</strong></td>
        <td>${new Date(t.date).toLocaleDateString()}</td>
      </tr>
    `;
  });
}

document.getElementById('restockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const productNames = document.getElementById('restockProduct').value;
  const supplier = document.getElementById('restockSupplier').value;
  const quantity = document.getElementById('restockQty').value;
  const cost = document.getElementById('restockCost').value;

  try {
    const res = await fetch('/api/admin/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productNames, supplier, quantity, cost })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      alert('Procurement logged & stock updated.');
      document.getElementById('restockSupplier').value = '';
      document.getElementById('restockQty').value = '';
      document.getElementById('restockCost').value = '';
      await fetchProducts(); 
      loadSuperAdminDashboard();
    }
  } catch (err) {
    console.error(err);
  }
});

// ==========================================
// LOGISTICS SPLIT & OPERATIONS PANEL
// ==========================================
async function renderOperationsDashboard() {
  await fetchOrders();

  const wQueueList = document.getElementById('warehouseQueueList');
  const bQueueList = document.getElementById('baristaQueueList');
  const rDeliveryList = document.getElementById('riderDeliveryArea');

  wQueueList.innerHTML = '';
  bQueueList.innerHTML = '';
  rDeliveryList.innerHTML = '';

  const paidOrders = state.orders.filter(o => o.status === 'paid_processing');

  let warehouseCount = 0;
  let baristaCount = 0;

  paidOrders.forEach(order => {
    const groceryItems = order.items.filter(item => {
      const prod = state.products.find(p => p.id === item.productId);
      return prod && (prod.categoryId === 1 || prod.categoryId === 2);
    });

    if (groceryItems.length > 0 && order.splitStatus.warehouse === 'pending') {
      warehouseCount++;
      const itemsList = groceryItems.map(i => `${i.name} (x${i.qty})`).join(', ');
      
      wQueueList.innerHTML += `
        <div class="queue-item">
          <div class="queue-item-header">
            <strong>Order ID: ${order.id}</strong>
            <span>${new Date(order.date).toLocaleTimeString()}</span>
          </div>
          <div class="queue-item-products">${itemsList}</div>
          <button class="btn-primary w-full" onclick="completeOperationsSplit('${order.id}', 'warehouse')">Mark Packed & Dispatched</button>
        </div>
      `;
    }

    const coffeeItems = order.items.filter(item => {
      const prod = state.products.find(p => p.id === item.productId);
      return prod && prod.categoryId === 3;
    });

    if (coffeeItems.length > 0 && order.splitStatus.barista === 'pending') {
      baristaCount++;
      const itemsList = coffeeItems.map(i => `${i.name} (x${i.qty})`).join(', ');

      bQueueList.innerHTML += `
        <div class="queue-item">
          <div class="queue-item-header">
            <strong>Order ID: ${order.id}</strong>
            <span>${new Date(order.date).toLocaleTimeString()}</span>
          </div>
          <div class="queue-item-products">${itemsList}</div>
          <button class="btn-primary w-full" style="background:#d97706;" onclick="completeOperationsSplit('${order.id}', 'barista')">Mark Brewed & Ready</button>
        </div>
      `;
    }
  });

  if (warehouseCount === 0) {
    wQueueList.innerHTML = '<p class="queue-empty">No pending grocery/liquor items to pick.</p>';
  }
  if (baristaCount === 0) {
    bQueueList.innerHTML = '<p class="queue-empty">No coffee items brewing.</p>';
  }

  const dispatchableOrders = paidOrders.filter(order => {
    const hasGrocery = order.items.some(item => {
      const prod = state.products.find(p => p.id === item.productId);
      return prod && (prod.categoryId === 1 || prod.categoryId === 2);
    });
    const hasCoffee = order.items.some(item => {
      const prod = state.products.find(p => p.id === item.productId);
      return prod && prod.categoryId === 3;
    });

    const groceryOk = !hasGrocery || order.splitStatus.warehouse === 'completed';
    const coffeeOk = !hasCoffee || order.splitStatus.barista === 'completed';

    return groceryOk && coffeeOk;
  });

  if (dispatchableOrders.length === 0) {
    rDeliveryList.innerHTML = '<p class="empty-msg">No active delivery assignments. Complete warehouse and barista packing queues to dispatch orders to riders.</p>';
    return;
  }

  const delivery = dispatchableOrders[0];
  const needsAgeCheck = delivery.items.some(item => {
    const prod = state.products.find(p => p.id === item.productId);
    return prod && prod.isAgeRestricted;
  });

  const productsList = delivery.items.map(i => `${i.name} (x${i.qty})`).join(', ');

  let ageVerificationForm = '';
  if (needsAgeCheck) {
    ageVerificationForm = `
      <div class="driver-verification-block">
        <h4>⚠️ Age Restricted Alcohol: Verify DOB and Identity</h4>
        <p>You MUST inspect official government photo ID (Citizenship, License, Passport) before handing over this order.</p>
        
        <div class="grid-2-cols mt-large">
          <div class="form-group">
            <label>ID Type:</label>
            <select id="riderIdType">
              <option value="Citizenship Card">Citizenship Card</option>
              <option value="Driver's License">Driver's License</option>
              <option value="Passport">Passport</option>
            </select>
          </div>
          <div class="form-group">
            <label>Document Number:</label>
            <input type="text" id="riderIdNumber" placeholder="e.g. 52-01-72-034" required>
          </div>
        </div>

        <div class="form-group check-inline mt-large">
          <input type="checkbox" id="riderConfirmAge">
          <label for="riderConfirmAge"><strong>I confirm the customer is over 18 years old and document matches.</strong></label>
        </div>
      </div>
    `;
  } else {
    ageVerificationForm = `
      <div class="driver-verification-block" style="background: rgba(16, 185, 129, 0.05); border-color: rgba(16,185,129,0.2);">
        <h4 style="color:#10b981;">✅ Ambient groceries / Coffee (No Age Check Needed)</h4>
        <p>No restricted items. Safe doorstep handoff.</p>
      </div>
    `;
  }

  rDeliveryList.innerHTML = `
    <div class="rider-card">
      <h3>Deliver to: ${delivery.user.username}</h3>
      <div class="sim-detail-row">
        <span>Order Reference:</span>
        <strong>${delivery.id}</strong>
      </div>
      <div class="sim-detail-row">
        <span>Delivery Items:</span>
        <span>${productsList}</span>
      </div>
      <div class="sim-detail-row">
        <span>Total Paid:</span>
        <strong style="color: #10b981;">NPR ${delivery.totalAmount.toLocaleString()}</strong>
      </div>

      ${ageVerificationForm}

      <button class="btn-primary w-full mt-large" onclick="completeDelivery('${delivery.id}', ${needsAgeCheck})">Confirm Delivery & Handoff Order</button>
    </div>
  `;
}

async function completeOperationsSplit(orderId, splitType) {
  const payload = {};
  if (splitType === 'warehouse') payload.warehouseCompleted = true;
  if (splitType === 'barista') payload.baristaCompleted = true;

  try {
    const res = await fetch(`/api/orders/${orderId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      renderOperationsDashboard();
    }
  } catch (err) {
    console.error(err);
  }
}

async function completeDelivery(orderId, needsAgeCheck) {
  let payload = { driverConfirmedAge: true };

  if (needsAgeCheck) {
    const checked = document.getElementById('riderConfirmAge').checked;
    const idType = document.getElementById('riderIdType').value;
    const idNumber = document.getElementById('riderIdNumber').value;

    if (!checked) {
      alert('You must confirm photo identification matches.');
      return;
    }
    if (!idNumber) {
      alert('Please fill document number.');
      return;
    }

    payload = {
      driverConfirmedAge: true,
      idType,
      idNumber
    };
  }

  try {
    const res = await fetch(`/api/orders/${orderId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    
    if (data.error) {
      alert(data.error);
    } else {
      alert(`Order ${orderId} successfully completed! Delivery logged.`);
      renderOperationsDashboard();
    }
  } catch (err) {
    console.error(err);
  }
}

// ==========================================
// REAL-TIME SECURITY AUDIT CONSOLE DISPLAY
// ==========================================
function renderLogsConsole() {
  const body = document.getElementById('auditConsoleBody');
  if (!body) return;
  body.innerHTML = '';

  state.logs.forEach(log => {
    const timeStr = new Date(log.timestamp).toLocaleTimeString();
    
    const line = document.createElement('div');
    line.className = `console-log-line ${log.level}`;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'console-time';
    timeSpan.textContent = `[${timeStr}]`;
    
    const textSpan = document.createElement('span');
    textSpan.innerHTML = `<strong>${log.event}:</strong> ${log.details}`;
    
    line.appendChild(timeSpan);
    line.appendChild(textSpan);
    body.appendChild(line);
  });
}

// ==========================================
// BIND ALL OTHER DOM TRIGGERS
// ==========================================
function setupEventListeners() {
  detailModalOverlay.addEventListener('click', (e) => {
    if (e.target === detailModalOverlay) {
      detailModalOverlay.classList.remove('active');
    }
  });
  
  checkoutOverlay.addEventListener('click', (e) => {
    if (e.target === checkoutOverlay) {
      checkoutOverlay.classList.remove('active');
    }
  });

  document.getElementById('closeCheckoutModalBtn').addEventListener('click', () => {
    checkoutOverlay.classList.remove('active');
  });

  // Onboarding overlay triggers
  const onboardingOverlay = document.getElementById('onboardingModalOverlay');
  document.getElementById('closeOnboardingBtn').addEventListener('click', closeOnboardingModal);
  onboardingOverlay.addEventListener('click', (e) => {
    if (e.target === onboardingOverlay) {
      closeOnboardingModal();
    }
  });

  const dBar = document.getElementById('devSandboxBar'); if(dBar) dBar.classList.add('collapsed'); 
}
