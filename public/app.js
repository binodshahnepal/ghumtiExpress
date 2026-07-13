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
  wishlist: JSON.parse(localStorage.getItem('ghumti_wishlist')) || [],
  orders: [],
  logs: [],
  activeCategoryFilter: 'all',
  checkoutOrder: null, 
  selectedReviewStars: 5,
  activeProductForDetail: null,
  carouselSlideIndex: 0,
  carouselTimer: null,
  adminPagination: {
    products: 1,
    categories: 1,
    subcategories: 1
  },
  adminSearch: {
    products: '',
    categories: '',
    subcategories: ''
  }
};

const ADMIN_PAGE_SIZE = 10;

// ==========================================================================
// ON BOOTSTRAP INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
  startCarouselAutoPlay();
  startFlashSaleCountdown();
  setupPwa();
  setupAdminTableSearch();
});

let deferredInstallPrompt = null;

function setupPwa() {
  const installButton = document.getElementById('installAppBtn');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(error => {
        console.warn('Service worker registration failed:', error);
      });
  }

  if (window.matchMedia('(display-mode: standalone)').matches) {
    installButton.hidden = true;
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });
}

async function initApp() {
  await fetchCategories();
  await fetchSubcategories();
  await fetchProducts();
  await fetchOrders();

  // Check URL parameters for payment notifications
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('status')) {
    const status = urlParams.get('status');
    const orderId = urlParams.get('orderId');
    const errorMsg = urlParams.get('error');

    if (status === 'success') {
      state.cart = [];
      localStorage.removeItem('ghumti_cart');
      updateCartUI();
      showAlert('Payment Successful', `Your order ${orderId} has been successfully verified and is now being processed.`, 'success');
    } else if (status === 'failure') {
      showAlert('Payment Failed', `Transaction was cancelled or declined. (Code: ${errorMsg || 'Cancelled'})`, 'error');
    }

    // Clean URL query parameters
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Load cart from session if exists
  const cachedCart = localStorage.getItem('ghumti_cart');
  if (cachedCart) {
    state.cart = JSON.parse(cachedCart);
    updateCartUI();
  }

  // Restore login state
  if (state.currentUser) {
    state.currentRole = state.currentUser.role;
  }

  const shortcutCategory = Number(urlParams.get('category'));
  if ([1, 2, 3].includes(shortcutCategory)) {
    state.activeCategoryFilter = shortcutCategory;
    state.currentRole = 'customer';
    window.history.replaceState({}, document.title, window.location.pathname);
  }
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
  const dashToggleBtn = document.getElementById('dashboardToggleBtn');

  if (state.currentUser) {
    nameSpan.textContent = `${state.currentUser.fullName}`;
    loginHeaderBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';

    // Show dashboard toggle button if user is staff (admin, superadmin, operations)
    if (['admin', 'superadmin', 'operations'].includes(state.currentUser.role)) {
      dashToggleBtn.style.display = 'inline-block';
      if (state.currentRole === 'customer') {
        dashToggleBtn.textContent = '🛠️ Admin Panel';
        dashToggleBtn.className = 'dashboard-toggle-btn staff';
      } else {
        dashToggleBtn.textContent = '🏪 View Storefront';
        dashToggleBtn.className = 'dashboard-toggle-btn store';
      }
    } else {
      dashToggleBtn.style.display = 'none';
    }
  } else {
    nameSpan.textContent = 'Guest Mode';
    loginHeaderBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    dashToggleBtn.style.display = 'none';
  }

  // Refresh customer tracker strip depending on login state
  if (state.currentUser && state.currentRole === 'customer') {
    refreshCustomerOrders();
  } else {
    const area = document.getElementById('customerDashboardArea');
    if (area) area.style.display = 'none';
  }
}

async function initiateGuestSession() {
  try {
    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.error) {
      showAlert('Authentication Error', data.error, 'error');
    } else {
      state.currentUser = data.user;
      localStorage.setItem('ghumti_user', JSON.stringify(data.user));
      updateAuthUI();
      closeOnboardingModal();
      
      const rSel1 = document.getElementById('roleSelector'); 
      if (rSel1) rSel1.value = data.user.role;
      state.currentRole = data.user.role;
      switchView(data.user.role);
    }
  } catch (err) {
    console.error(err);
    showAlert('Error', 'Failed to initialize guest session.', 'error');
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
      showAlert('Sign In Failed', data.error, 'error');
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
    showAlert('Connection Error', 'Failed connecting to server auth.', 'error');
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
      showAlert('Registration Failed', data.error, 'error');
    } else {
      showAlert('Registration Successful', 'Account registered! Please sign in.', 'success');
      document.getElementById('tabLoginBtn').click();
    }
  } catch (err) {
    console.error(err);
    showAlert('Error', 'Failed to register.', 'error');
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
    showAlert('Access Restricted', 'Please sign in or register to access administration controls.', 'warning');
    e.target.value = 'customer';
    openOnboardingModal();
    return;
  }
  
  if (roleSelected === 'admin' && state.currentUser.role === 'customer') {
    showAlert('Access Denied', 'Only Admins and Super Admins can access Catalog configuration.', 'error');
    e.target.value = 'customer';
    return;
  }

  if (roleSelected === 'superadmin' && state.currentUser.role !== 'superadmin') {
    showAlert('Access Denied', 'Super Admin level authorization is required to access analytics.', 'error');
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
    refreshCustomerOrders();
  } else if (role === 'admin') {
    document.getElementById('adminViewSection').style.display = 'block';
    populateAdminDropdowns();
    renderAdminProducts();
    renderAdminCategories();
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
function getCategoryName(categoryId) {
  return state.categories.find(category => category.id === categoryId)?.name || 'Ghumti Select';
}

function buildProductCardMarkup(prod, compact = false) {
  const hasImage = prod.imageUrl && prod.imageUrl !== '';
  let imageHtml = '';

  if (hasImage) {
    imageHtml = `<img src="${prod.imageUrl}" class="product-image" alt="${prod.name}" loading="lazy">`;
  } else {
    let icon = '📦';
    let gradientClass = 'gradient-fallback-default';
    if (prod.categoryId === 1) { icon = '🥃'; gradientClass = 'gradient-fallback-liquor'; }
    else if (prod.categoryId === 2) { icon = '🍎'; gradientClass = 'gradient-fallback-groceries'; }
    else if (prod.categoryId === 3) { icon = '☕'; gradientClass = 'gradient-fallback-coffee'; }
    imageHtml = `<div class="${gradientClass}">${icon}</div>`;
  }

  const ageRestrictedBadge = prod.isAgeRestricted ? '<span class="restricted-pill">18+ verified delivery</span>' : '';
  const stockClass = prod.stock === 0 ? 'out' : (prod.stock < 5 ? 'low' : '');
  const stockText = prod.stock === 0 ? 'Out of stock' : (prod.stock < 5 ? `Only ${prod.stock} left` : 'Ready to deliver');
  const ratingText = prod.averageRating > 0 ? `${prod.averageRating.toFixed(1)} (${prod.ratingCount || 0})` : 'New';
  const isDiscounted = prod.originalPrice && prod.originalPrice > prod.price;
  const discountPct = isDiscounted ? Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100) : 0;
  const savings = isDiscounted ? prod.originalPrice - prod.price : 0;

  const pricingHtml = isDiscounted ? `
    <div class="product-price-row">
      <span class="price-pill">NPR ${prod.price.toLocaleString()}</span>
      <div class="old-price-container">
        <span class="old-price">NPR ${prod.originalPrice.toLocaleString()}</span>
        <span class="percent-off">-${discountPct}%</span>
      </div>
    </div>
    <span class="save-tag">You save NPR ${savings.toLocaleString()}</span>
  ` : `<div class="product-price-row"><span class="price-pill">NPR ${prod.price.toLocaleString()}</span></div>`;

  return `
    <article class="product-card ${compact ? 'compact-product-card' : ''}">
      ${ageRestrictedBadge}
      ${isDiscounted ? `<span class="deal-corner-badge">-${discountPct}%</span>` : ''}
      <button class="wishlist-btn ${state.wishlist.includes(prod.id) ? 'active' : ''}" type="button" onclick="toggleWishlist(event, ${prod.id})" aria-label="${state.wishlist.includes(prod.id) ? 'Remove' : 'Save'} ${prod.name} ${state.wishlist.includes(prod.id) ? 'from' : 'to'} wishlist">${state.wishlist.includes(prod.id) ? '♥' : '♡'}</button>
      <div class="product-image-container" onclick="openProductDetail(${prod.id})" role="button" tabindex="0">
        ${imageHtml}
      </div>
      <div class="product-info-block">
        <span class="product-brand">${getCategoryName(prod.categoryId)}</span>
        <h3 class="product-title" onclick="openProductDetail(${prod.id})">${prod.name}</h3>
        <div class="product-meta-row">
          <span class="rating-pill">★ ${ratingText}</span>
          <span class="stock-status ${stockClass}">${stockText}</span>
        </div>
        ${pricingHtml}
        <div class="delivery-promise"><strong>Express</strong> delivery in 30–60 min</div>
        <button class="btn-primary add-cart-btn" onclick="addToCart(${prod.id})" ${prod.stock === 0 ? 'disabled' : ''}>
          ${prod.stock === 0 ? 'Sold out' : 'Add to cart'}
        </button>
      </div>
    </article>
  `;
}

function renderCategoryShortcuts() {
  const rail = document.getElementById('categoryShortcutRail');
  if (!rail) return;

  const categoryArt = {
    1: { image: '/dept_liquor.png', tone: 'shortcut-liquor' },
    2: { image: '/dept_grocery.png', tone: 'shortcut-grocery' },
    3: { image: '/dept_coffee.png', tone: 'shortcut-coffee' }
  };

  const shortcuts = state.subcategories.map(subcategory => ({
    label: subcategory.name,
    categoryId: subcategory.categoryId,
    ...(categoryArt[subcategory.categoryId] || categoryArt[2])
  }));

  shortcuts.push({ label: 'Flash Deals', categoryId: 'discounted', image: '/dept_deal.png', tone: 'shortcut-deals' });
  rail.innerHTML = shortcuts.map(item => `
    <button class="category-shortcut ${item.tone}" onclick="${item.categoryId === 'discounted' ? 'filterFlashSales()' : `filterCategory(${item.categoryId})`}">
      <span class="shortcut-image-wrap"><img src="${item.image}" alt="" loading="lazy"></span>
      <strong>${item.label}</strong>
      <span>Shop now</span>
    </button>
  `).join('');
}

function renderProductRail(containerId, products) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = products.length
    ? products.map(product => buildProductCardMarkup(product, true)).join('')
    : '<p class="empty-msg">More products are arriving soon.</p>';
}

function renderLandingCollections() {
  renderCategoryShortcuts();
  const discounted = state.products.filter(product => product.originalPrice && product.originalPrice > product.price);
  const essentials = state.products.filter(product => product.categoryId === 2);
  renderProductRail('flashSaleRail', discounted);
  renderProductRail('essentialsRail', essentials);
}

function toggleWishlist(event, productId) {
  event.stopPropagation();
  const index = state.wishlist.indexOf(productId);
  if (index >= 0) state.wishlist.splice(index, 1);
  else state.wishlist.push(productId);
  localStorage.setItem('ghumti_wishlist', JSON.stringify(state.wishlist));
  renderProducts();
}

function startFlashSaleCountdown() {
  let remainingSeconds = 6 * 60 * 60;
  setInterval(() => {
    const timer = document.getElementById('saleTimer');
    if (!timer) return;
    remainingSeconds = Math.max(0, remainingSeconds - 1);
    const hours = String(Math.floor(remainingSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(remainingSeconds % 60).padStart(2, '0');
    timer.textContent = `Ends in ${hours}:${minutes}:${seconds}`;
  }, 1000);
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const filtersContainer = document.getElementById('categoryFilters');
  grid.innerHTML = '';

  renderLandingCollections();

  filtersContainer.innerHTML = '<button class="filter-pill ' + (state.activeCategoryFilter === 'all' ? 'active' : '') + '" onclick="filterCategory(\'all\')">All Categories</button>';
  state.categories.forEach(cat => {
    const activeClass = state.activeCategoryFilter == cat.id ? 'active' : '';
    filtersContainer.innerHTML += `<button class="filter-pill ${activeClass}" onclick="filterCategory(${cat.id})">${cat.name}</button>`;
  });
  const discountActive = state.activeCategoryFilter === 'discounted' ? 'active' : '';
  filtersContainer.innerHTML += `<button class="filter-pill ${discountActive}" onclick="filterFlashSales()">⚡ Discounts</button>`;

  const query = document.getElementById('searchInput').value.toLowerCase();
  const homeMerchandising = document.querySelector('.home-merchandising');
  if (homeMerchandising) {
    homeMerchandising.style.display = state.activeCategoryFilter === 'all' && query === '' ? 'block' : 'none';
  }

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

  grid.innerHTML = filteredProducts.map(product => buildProductCardMarkup(product)).join('');
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
  const headerCartTotal = document.getElementById('headerCartTotal');
  if (headerCartTotal) headerCartTotal.textContent = `NPR ${subtotal.toLocaleString()}`;
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
document.getElementById('payFonepayBtn').addEventListener('click', () => initiatePayment('fonepay'));
document.getElementById('payBankBtn').addEventListener('click', () => initiatePayment('bank'));

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
const fonepaySimCard = document.getElementById('fonepaySimulator');
const bankSimCard = document.getElementById('bankSimulator');

let activeSimPayload = null;
let activeSimGateway = null;

function launchSimulator(gateway, payload) {
  activeSimGateway = gateway;
  activeSimPayload = payload;
  
  simOverlay.classList.add('active');
  
  // Hide all simulator panels first
  esewaSimCard.style.display = 'none';
  khaltiSimCard.style.display = 'none';
  fonepaySimCard.style.display = 'none';
  bankSimCard.style.display = 'none';

  if (gateway === 'esewa') {
    esewaSimCard.style.display = 'block';
    document.getElementById('esewaSimUuid').textContent = payload.transaction_uuid;
    document.getElementById('esewaSimAmount').textContent = `NPR ${payload.total_amount.toLocaleString()}`;
    document.getElementById('tamperEsewaPrice').checked = false;
  } else if (gateway === 'khalti') {
    khaltiSimCard.style.display = 'block';
    document.getElementById('khaltiSimPidx').textContent = payload.pidx;
    document.getElementById('khaltiSimAmount').textContent = `NPR ${(payload.amount / 100).toLocaleString()}`;
    document.getElementById('khaltiStatusOverride').value = 'Completed';
  } else if (gateway === 'fonepay') {
    fonepaySimCard.style.display = 'block';
    document.getElementById('fonepaySimUuid').textContent = payload.transaction_uuid;
    document.getElementById('fonepaySimAmount').textContent = `NPR ${payload.total_amount.toLocaleString()}`;
  } else if (gateway === 'bank') {
    bankSimCard.style.display = 'block';
    document.getElementById('bankVoucherOrderId').value = payload.orderId;
    document.getElementById('bankSimAmount').textContent = `NPR ${payload.totalAmount.toLocaleString()}`;
    document.getElementById('bankVoucherLabel').textContent = 'Click to select receipt screenshot...';
    document.getElementById('bankVoucherFile').value = '';
  } else if (gateway === 'connectips') {
    showAlert('connectIPS Redirect', 'Redirecting to simulated ConnectIPS interbank portal. Authorizing secure transfer...', 'info');
    setTimeout(() => {
      window.location.href = `/api/payment/callback/connectips?txnId=${payload.txnId}&status=SUCCESS`;
    }, 1500);
  }
}

document.getElementById('simEsewaCancelBtn').addEventListener('click', dismissSimulator);
document.getElementById('simKhaltiCancelBtn').addEventListener('click', dismissSimulator);
document.getElementById('simFonepayCancelBtn').addEventListener('click', dismissSimulator);
document.getElementById('simBankCancelBtn').addEventListener('click', dismissSimulator);

function dismissSimulator() {
  simOverlay.classList.remove('active');
  showAlert('Cancelled', 'Transaction has been cancelled by the user.', 'warning');
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

// Fonepay Submit Payment
document.getElementById('simFonepayPayBtn').addEventListener('click', () => {
  state.cart = [];
  localStorage.removeItem('ghumti_cart');
  updateCartUI();
  window.location.href = `/api/payment/callback/fonepay?txnId=${activeSimPayload.transaction_uuid}`;
});

// Bank Voucher File Input Change
document.getElementById('bankVoucherFile').addEventListener('change', (e) => {
  const label = document.getElementById('bankVoucherLabel');
  if (e.target.files.length > 0) {
    label.textContent = e.target.files[0].name;
  } else {
    label.textContent = 'Click to select receipt screenshot...';
  }
});

// Bank Voucher Form Submit
document.getElementById('bankVoucherForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const orderId = document.getElementById('bankVoucherOrderId').value;
  const fileInput = document.getElementById('bankVoucherFile');
  if (fileInput.files.length === 0) {
    showAlert('Receipt Required', 'Please choose a photo screenshot of your deposit voucher or transaction record.', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('orderId', orderId);
  formData.append('voucher', fileInput.files[0]);

  try {
    const res = await fetch('/api/payment/bank-upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.error) {
      showAlert('Voucher Failed', data.error, 'error');
    } else {
      state.cart = [];
      localStorage.removeItem('ghumti_cart');
      updateCartUI();
      simOverlay.classList.remove('active');
      showAlert(
        'Voucher Submitted',
        'Your bank deposit voucher has been uploaded successfully! An administrator will audit the transaction and approve your order packing shortly.',
        'success'
      );
    }
  } catch (err) {
    console.error(err);
    showAlert('Upload Error', 'Failed to upload bank deposit voucher.', 'error');
  }
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
      showAlert('Creation Failed', data.error, 'error');
    } else {
      showAlert('Category Created', `Category '${data.name}' has been created successfully!`, 'success');
      document.getElementById('categoryName').value = '';
      await fetchCategories();
      populateAdminDropdowns();
      renderAdminProducts();
    }
  } catch (err) {
    console.error(err);
    showAlert('Error', 'Failed to create category.', 'error');
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
      showAlert('Creation Failed', data.error, 'error');
    } else {
      showAlert('Subcategory Created', `Subcategory '${data.name}' has been created successfully!`, 'success');
      document.getElementById('subcategoryName').value = '';
      await fetchSubcategories();
      populateAdminDropdowns();
      renderAdminProducts();
    }
  } catch (err) {
    console.error(err);
    showAlert('Error', 'Failed to create subcategory.', 'error');
  }
});

document.getElementById('addProductForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = document.getElementById('addProductForm');
  const formData = new FormData();

  formData.append('name', document.getElementById('productName').value);
  formData.append('categoryId', document.getElementById('productCategory').value);
  formData.append('subcategoryId', document.getElementById('productSubcategory').value);
  formData.append('costPrice', document.getElementById('productCostPrice').value);
  formData.append('mrp', document.getElementById('productMrp').value);
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
      showAlert('Upload Failed', data.error, 'error');
    } else {
      showAlert('Product Uploaded', `Product '${data.name}' has been successfully added to the catalog!`, 'success');
      form.reset();
      await fetchProducts();
      renderAdminProducts();
    }
  } catch (err) {
    console.error(err);
    showAlert('Upload Error', 'Failed uploading product to server.', 'error');
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
  const marginBar = document.getElementById('kpiMarginBar');
  const marginPct = summary.totalSales > 0 ? Math.min(100, Math.max(0, (summary.netMargin / summary.totalSales) * 100)) : 0;
  
  if (marginBar) {
    marginBar.style.width = `${marginPct}%`;
  }

  if (summary.netMargin >= 0) {
    marginPill.textContent = `Net Profit (${marginPct.toFixed(1)}%)`;
    marginPill.className = 'pill text-green';
  } else {
    marginPill.textContent = `Net Loss (${marginPct.toFixed(1)}%)`;
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
        <td>${t.gateway ? t.gateway.toUpperCase() : 'UNKNOWN'}</td>
        <td>${t.txnUuid}</td>
        <td class="${statusClass}"><strong>${t.status.toUpperCase()}</strong></td>
        <td>${new Date(t.date).toLocaleDateString()}</td>
      </tr>
    `;
  });

  // Render bank verification approvals
  const bankApprovalsCard = document.getElementById('bankApprovalsCard');
  const bankApprovalsTableBody = document.getElementById('bankApprovalsTableBody');
  const resOrders = await fetch('/api/orders');
  const ordersList = await resOrders.json();
  const pendingBankOrders = ordersList.filter(o => o.status === 'pending_bank_verification');
  
  if (pendingBankOrders.length > 0) {
    bankApprovalsCard.style.display = 'block';
    bankApprovalsTableBody.innerHTML = '';
    pendingBankOrders.forEach(o => {
      bankApprovalsTableBody.innerHTML += `
        <tr>
          <td>${o.id}</td>
          <td>${o.user.username}</td>
          <td><strong>NPR ${o.totalAmount.toLocaleString()}</strong></td>
          <td>
            <a href="${o.voucherImageUrl}" target="_blank" style="color: #60a5fa; text-decoration: underline;">
              View Deposit Slip 🔍
            </a>
          </td>
          <td>${new Date(o.date).toLocaleDateString()}</td>
          <td>
            <div style="display: flex; gap: 8px;">
              <button class="btn-primary" style="background: #10b981; padding: 6px 12px; font-size: 12px; border-radius: 6px;" onclick="approveBankVoucher('${o.id}')">Approve</button>
              <button class="btn-cancel" style="background: #f43f5e; padding: 6px 12px; font-size: 12px; border-radius: 6px; border: none; color: white;" onclick="rejectBankVoucher('${o.id}')">Reject</button>
            </div>
          </td>
        </tr>
      `;
    });
  } else {
    bankApprovalsCard.style.display = 'none';
  }
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
      showAlert('Procurement Failed', data.error, 'error');
    } else {
      showAlert('Restocked Successfully', `Procured ${quantity} units of ${productNames} from ${supplier}. Stock updated!`, 'success');
      document.getElementById('restockSupplier').value = '';
      document.getElementById('restockQty').value = '';
      document.getElementById('restockCost').value = '';
      await fetchProducts(); 
      loadSuperAdminDashboard();
    }
  } catch (err) {
    console.error(err);
    showAlert('Procurement Error', 'Failed to submit procurement logs.', 'error');
  }
});

// Bank Verification Actions
async function approveBankVoucher(orderId) {
  const confirmed = await showAlert(
    'Confirm Approval',
    `Are you sure you want to approve payment for order ${orderId}? This will deduct inventory and release split fulfillment tickets.`,
    'info',
    true
  );
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/admin/bank-approvals/${orderId}/approve`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.error) {
      showAlert('Approval Failed', data.error, 'error');
    } else {
      showAlert('Payment Approved', `Order ${orderId} has been approved successfully! Logistics splits are generated.`, 'success');
      await loadSuperAdminDashboard();
    }
  } catch (err) {
    console.error(err);
    showAlert('Error', 'Failed to approve bank deposit.', 'error');
  }
}

async function rejectBankVoucher(orderId) {
  const confirmed = await showAlert(
    'Confirm Rejection',
    `Are you sure you want to REJECT the deposit slip for order ${orderId}? This will cancel the order.`,
    'warning',
    true
  );
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/admin/bank-approvals/${orderId}/reject`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.error) {
      showAlert('Rejection Failed', data.error, 'error');
    } else {
      showAlert('Payment Rejected', `Order ${orderId} payment has been rejected and order cancelled.`, 'success');
      await loadSuperAdminDashboard();
    }
  } catch (err) {
    console.error(err);
    showAlert('Error', 'Failed to reject bank deposit.', 'error');
  }
}

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

  const editOverlay = document.getElementById('editProductModalOverlay');
  if (editOverlay) {
    document.getElementById('closeEditProductBtn').addEventListener('click', () => {
      editOverlay.classList.remove('active');
    });
    editOverlay.addEventListener('click', (e) => {
      if (e.target === editOverlay) {
        editOverlay.classList.remove('active');
      }
    });
  }

  const dashBtn = document.getElementById('dashboardToggleBtn');
  if (dashBtn) {
    dashBtn.addEventListener('click', () => {
      if (state.currentRole === 'customer') {
        state.currentRole = state.currentUser.role;
        switchView(state.currentUser.role);
      } else {
        state.currentRole = 'customer';
        switchView('customer');
      }
      updateAuthUI();
    });
  }

  const dBar = document.getElementById('devSandboxBar'); if(dBar) dBar.classList.add('collapsed'); 
}

// ==========================================================================
// ADMIN CATALOG MANAGEMENT CONTROLLERS
// ==========================================================================

function setupAdminTableSearch() {
  const searchFields = {
    products: document.getElementById('adminProductSearch'),
    categories: document.getElementById('adminCategorySearch'),
    subcategories: document.getElementById('adminSubcategorySearch')
  };

  Object.entries(searchFields).forEach(([type, input]) => {
    if (!input) return;
    input.addEventListener('input', event => {
      state.adminSearch[type] = event.target.value.trim().toLowerCase();
      state.adminPagination[type] = 1;
      if (type === 'products') renderAdminProducts();
      else renderAdminCategories();
    });
  });
}

function getFilteredAdminItems(type) {
  const query = state.adminSearch[type];
  if (type === 'products') {
    if (!query) return state.products;
    return state.products.filter(product => {
      const category = state.categories.find(item => item.id === product.categoryId)?.name || '';
      const subcategory = state.subcategories.find(item => item.id === product.subcategoryId)?.name || '';
      return `${product.name} ${category} ${subcategory}`.toLowerCase().includes(query);
    });
  }

  if (type === 'categories') {
    return query ? state.categories.filter(category => category.name.toLowerCase().includes(query)) : state.categories;
  }

  if (!query) return state.subcategories;
  return state.subcategories.filter(subcategory => {
    const parent = state.categories.find(item => item.id === subcategory.categoryId)?.name || '';
    return `${subcategory.name} ${parent}`.toLowerCase().includes(query);
  });
}

function getAdminPage(items, type) {
  const totalPages = Math.max(1, Math.ceil(items.length / ADMIN_PAGE_SIZE));
  const requestedPage = Number(state.adminPagination[type]) || 1;
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
  state.adminPagination[type] = currentPage;
  const startIndex = (currentPage - 1) * ADMIN_PAGE_SIZE;

  return {
    items: items.slice(startIndex, startIndex + ADMIN_PAGE_SIZE),
    currentPage,
    totalPages,
    startIndex
  };
}

function renderAdminPagination(containerId, type, totalItems) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / ADMIN_PAGE_SIZE));
  const currentPage = Math.min(state.adminPagination[type], totalPages);
  const firstItem = totalItems === 0 ? 0 : ((currentPage - 1) * ADMIN_PAGE_SIZE) + 1;
  const lastItem = Math.min(currentPage * ADMIN_PAGE_SIZE, totalItems);
  const pageButtons = [];
  let previousVisiblePage = 0;

  for (let page = 1; page <= totalPages; page++) {
    const isVisible = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
    if (!isVisible) continue;
    if (previousVisiblePage && page - previousVisiblePage > 1) {
      pageButtons.push('<span class="pagination-ellipsis" aria-hidden="true">…</span>');
    }
    pageButtons.push(`<button class="pagination-page-btn ${page === currentPage ? 'active' : ''}" onclick="changeAdminPage('${type}', ${page})" ${page === currentPage ? 'aria-current="page"' : ''}>${page}</button>`);
    previousVisiblePage = page;
  }

  container.innerHTML = `
    <span class="pagination-summary">Showing ${firstItem}–${lastItem} of ${totalItems}${state.adminSearch[type] ? ' matches' : ''}</span>
    <div class="pagination-controls">
      <button class="pagination-nav-btn" onclick="changeAdminPage('${type}', ${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
      ${pageButtons.join('')}
      <button class="pagination-nav-btn" onclick="changeAdminPage('${type}', ${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    </div>
  `;
}

function changeAdminPage(type, page) {
  const source = getFilteredAdminItems(type);
  const totalPages = Math.max(1, Math.ceil(source.length / ADMIN_PAGE_SIZE));
  state.adminPagination[type] = Math.min(Math.max(1, page), totalPages);

  if (type === 'products') renderAdminProducts();
  else renderAdminCategories();
}

// RENDER ADMIN PRODUCT CATALOG TABLE
function renderAdminProducts() {
  const tableBody = document.getElementById('adminProductsTableBody');
  if (!tableBody) {
    renderAdminCategories();
    return;
  }
  tableBody.innerHTML = '';

  const filteredProducts = getFilteredAdminItems('products');
  const productPage = getAdminPage(filteredProducts, 'products');

  if (filteredProducts.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="admin-empty-row">${state.adminSearch.products ? 'No products match your search.' : 'No products have been created yet.'}</td></tr>`;
  }

  productPage.items.forEach(prod => {
    const category = state.categories.find(c => c.id === prod.categoryId);
    const categoryName = category ? category.name : 'Unknown';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="admin-prod-img-box">
          ${prod.imageUrl ? `<img src="${prod.imageUrl}" class="admin-prod-thumb">` : `<span style="font-size:20px;">📦</span>`}
        </div>
      </td>
      <td><strong>${prod.name}</strong></td>
      <td><span class="admin-cat-badge">${categoryName}</span></td>
      <td><strong>NPR ${prod.price.toLocaleString()}</strong></td>
      <td><span class="admin-stock-num ${prod.stock === 0 ? 'out' : (prod.stock < 5 ? 'low' : '')}">${prod.stock}</span></td>
      <td>${prod.isAgeRestricted ? '<span class="status-badge alert">Yes (18+)</span>' : '<span class="status-badge success">No</span>'}</td>
      <td>
        <div class="admin-actions-cell">
          <button class="btn-table-edit" onclick="openEditProductModal(${prod.id})">✏️ Edit</button>
          <button class="btn-table-delete" onclick="deleteProduct(${prod.id})">🗑️ Delete</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  renderAdminPagination('adminProductsPagination', 'products', filteredProducts.length);

  renderAdminCategories();
}

// RENDER ADMIN CATEGORY & SUBCATEGORY TABLES
function renderAdminCategories() {
  const catTableBody = document.getElementById('adminCategoriesTableBody');
  const subTableBody = document.getElementById('adminSubcategoriesTableBody');
  
  if (catTableBody) {
    catTableBody.innerHTML = '';
    const filteredCategories = getFilteredAdminItems('categories');
    const categoryPage = getAdminPage(filteredCategories, 'categories');
    if (filteredCategories.length === 0) {
      catTableBody.innerHTML = `<tr><td colspan="3" class="admin-empty-row">${state.adminSearch.categories ? 'No categories match your search.' : 'No categories have been created yet.'}</td></tr>`;
    }
    categoryPage.items.forEach(c => {
      catTableBody.innerHTML += `
        <tr>
          <td>${c.id}</td>
          <td><strong>${c.name}</strong></td>
          <td>
            <div class="admin-actions-cell">
              <button class="btn-table-edit btn-table-compact" onclick="openEditCategoryModal(${c.id})">✏️ Edit</button>
              <button class="btn-table-delete btn-table-compact" onclick="deleteCategory(${c.id})">🗑️ Delete</button>
            </div>
          </td>
        </tr>
      `;
    });
    renderAdminPagination('adminCategoriesPagination', 'categories', filteredCategories.length);
  }

  if (subTableBody) {
    subTableBody.innerHTML = '';
    const filteredSubcategories = getFilteredAdminItems('subcategories');
    const subcategoryPage = getAdminPage(filteredSubcategories, 'subcategories');
    if (filteredSubcategories.length === 0) {
      subTableBody.innerHTML = `<tr><td colspan="4" class="admin-empty-row">${state.adminSearch.subcategories ? 'No subcategories match your search.' : 'No subcategories have been created yet.'}</td></tr>`;
    }
    subcategoryPage.items.forEach(s => {
      const parent = state.categories.find(c => c.id === s.categoryId);
      const parentName = parent ? parent.name : 'Unknown';
      subTableBody.innerHTML += `
        <tr>
          <td>${s.id}</td>
          <td><strong>${s.name}</strong></td>
          <td><span class="admin-cat-badge">${parentName}</span></td>
          <td>
            <div class="admin-actions-cell">
              <button class="btn-table-edit btn-table-compact" onclick="openEditSubcategoryModal(${s.id})">✏️ Edit</button>
              <button class="btn-table-delete btn-table-compact" onclick="deleteSubcategory(${s.id})">🗑️ Delete</button>
            </div>
          </td>
        </tr>
      `;
    });
    renderAdminPagination('adminSubcategoriesPagination', 'subcategories', filteredSubcategories.length);
  }
}

// EDIT CATEGORY MODAL CONTROLS
function openEditCategoryModal(id) {
  const cat = state.categories.find(c => c.id === id);
  if (!cat) return;
  document.getElementById('editCategoryId').value = cat.id;
  document.getElementById('editCategoryName').value = cat.name;
  document.getElementById('editCategoryModalOverlay').classList.add('active');
}

document.getElementById('closeEditCategoryBtn').addEventListener('click', () => {
  document.getElementById('editCategoryModalOverlay').classList.remove('active');
});

document.getElementById('editCategoryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editCategoryId').value;
  const name = document.getElementById('editCategoryName').value;
  try {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.error) {
      showAlert('Update Failed', data.error, 'error');
    } else {
      showAlert('Category Updated', 'Category name has been updated successfully.', 'success');
      document.getElementById('editCategoryModalOverlay').classList.remove('active');
      await fetchCategories();
      populateAdminDropdowns();
      renderAdminProducts();
      renderProducts();
    }
  } catch (err) {
    console.error(err);
    showAlert('Error', 'Failed to update category.', 'error');
  }
});

// DELETE CATEGORY CALL
async function deleteCategory(id) {
  const cat = state.categories.find(c => c.id === id);
  if (!cat) return;
  const confirmed = await showAlert(
    'Confirm Delete',
    `Are you sure you want to remove Category '${cat.name}'? This will also delete any empty subcategories under it.`,
    'warning',
    true
  );
  if (!confirmed) return;
  try {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.error) {
      showAlert('Delete Failed', data.error, 'error');
    } else {
      showAlert('Category Deleted', `Category '${cat.name}' has been deleted successfully.`, 'success');
      await fetchCategories();
      await fetchSubcategories();
      populateAdminDropdowns();
      renderAdminProducts();
      renderProducts();
    }
  } catch (err) {
    console.error(err);
    showAlert('Error', 'Failed to delete category.', 'error');
  }
}

// EDIT SUBCATEGORY MODAL CONTROLS
function openEditSubcategoryModal(id) {
  const sub = state.subcategories.find(s => s.id === id);
  if (!sub) return;
  document.getElementById('editSubcategoryId').value = sub.id;
  document.getElementById('editSubcategoryName').value = sub.name;

  const parentSelect = document.getElementById('editSubcategoryParent');
  parentSelect.innerHTML = '';
  state.categories.forEach(c => {
    const selected = c.id === sub.categoryId ? 'selected' : '';
    parentSelect.innerHTML += `<option value="${c.id}" ${selected}>${c.name}</option>`;
  });

  document.getElementById('editSubcategoryModalOverlay').classList.add('active');
}

document.getElementById('closeEditSubcategoryBtn').addEventListener('click', () => {
  document.getElementById('editSubcategoryModalOverlay').classList.remove('active');
});

document.getElementById('editSubcategoryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editSubcategoryId').value;
  const name = document.getElementById('editSubcategoryName').value;
  const categoryId = document.getElementById('editSubcategoryParent').value;
  try {
    const res = await fetch(`/api/subcategories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, categoryId })
    });
    const data = await res.json();
    if (data.error) {
      showAlert('Update Failed', data.error, 'error');
    } else {
      showAlert('Subcategory Updated', 'Subcategory details have been successfully updated.', 'success');
      document.getElementById('editSubcategoryModalOverlay').classList.remove('active');
      await fetchSubcategories();
      populateAdminDropdowns();
      renderAdminProducts();
      renderProducts();
    }
  } catch (err) {
    console.error(err);
    showAlert('Error', 'Failed to update subcategory.', 'error');
  }
});

// DELETE SUBCATEGORY CALL
async function deleteSubcategory(id) {
  const sub = state.subcategories.find(s => s.id === id);
  if (!sub) return;
  const confirmed = await showAlert(
    'Confirm Delete',
    `Are you sure you want to remove Subcategory '${sub.name}'?`,
    'warning',
    true
  );
  if (!confirmed) return;
  try {
    const res = await fetch(`/api/subcategories/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.error) {
      showAlert('Delete Failed', data.error, 'error');
    } else {
      showAlert('Subcategory Deleted', `Subcategory '${sub.name}' has been deleted successfully.`, 'success');
      await fetchSubcategories();
      populateAdminDropdowns();
      renderAdminProducts();
      renderProducts();
    }
  } catch (err) {
    console.error(err);
    showAlert('Error', 'Failed to delete subcategory.', 'error');
  }
}

// DELETE PRODUCT CALL
async function deleteProduct(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;
  
  const confirmed = await showAlert(
    'Confirm Delete',
    `Are you sure you want to remove '${prod.name}' from the product catalog?`,
    'warning',
    true
  );

  if (!confirmed) return;

  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.error) {
      showAlert('Delete Failed', data.error, 'error');
    } else {
      showAlert('Product Deleted', `Product '${prod.name}' has been successfully removed.`, 'success');
      await fetchProducts();
      renderAdminProducts();
      renderProducts(); // refresh customer storefront as well
    }
  } catch (err) {
    console.error(err);
    showAlert('Delete Error', 'Failed to remove product from catalog.', 'error');
  }
}

// EDIT PRODUCT MODAL CONTROLS
function openEditProductModal(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  document.getElementById('editProductId').value = prod.id;
  document.getElementById('editProductName').value = prod.name;
  document.getElementById('editProductCostPrice').value = prod.costPrice || Math.round(prod.price * 0.7);
  document.getElementById('editProductMrp').value = prod.mrp || prod.price;
  document.getElementById('editProductPrice').value = prod.price;
  document.getElementById('editProductStock').value = prod.stock;
  document.getElementById('editProductAgeRestricted').checked = prod.isAgeRestricted;

  // Populate current image preview in edit modal
  const previewImg = document.getElementById('editProductImagePreview');
  const labelEl = document.getElementById('editProductImageLabel');
  if (prod.imageUrl && prod.imageUrl !== '') {
    previewImg.src = prod.imageUrl;
  } else {
    let icon = '📦';
    if (prod.categoryId === 1) icon = '🥃';
    else if (prod.categoryId === 2) icon = '🍎';
    else if (prod.categoryId === 3) icon = '☕';
    previewImg.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><rect width="100%" height="100%" fill="%23f1f5f9"/><text x="50%" y="60%" font-size="28" text-anchor="middle">${icon}</text></svg>`;
  }
  labelEl.textContent = 'Upload New Photo...';
  document.getElementById('editProductImage').value = '';

  // Populate category list in edit dropdown
  const editCatSelect = document.getElementById('editProductCategory');
  const editSubSelect = document.getElementById('editProductSubcategory');
  
  editCatSelect.innerHTML = '';
  state.categories.forEach(c => {
    const selected = c.id === prod.categoryId ? 'selected' : '';
    editCatSelect.innerHTML += `<option value="${c.id}" ${selected}>${c.name}</option>`;
  });

  // Handle category change
  editCatSelect.onchange = (e) => {
    populateSubcategoriesDropdown(e.target.value, editSubSelect);
  };

  // Populate subcategories for active category
  populateSubcategoriesDropdown(prod.categoryId, editSubSelect);
  editSubSelect.value = prod.subcategoryId;

  document.getElementById('editProductModalOverlay').classList.add('active');
}

// SUBMIT EDIT PRODUCT FORM
document.getElementById('editProductForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const productId = document.getElementById('editProductId').value;
  const formData = new FormData();

  formData.append('name', document.getElementById('editProductName').value);
  formData.append('categoryId', document.getElementById('editProductCategory').value);
  formData.append('subcategoryId', document.getElementById('editProductSubcategory').value);
  formData.append('costPrice', document.getElementById('editProductCostPrice').value);
  formData.append('mrp', document.getElementById('editProductMrp').value);
  formData.append('price', document.getElementById('editProductPrice').value);
  formData.append('stock', document.getElementById('editProductStock').value);
  formData.append('isAgeRestricted', document.getElementById('editProductAgeRestricted').checked);
  
  const fileInput = document.getElementById('editProductImage');
  if (fileInput.files.length > 0) {
    formData.append('image', fileInput.files[0]);
  }

  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'PUT',
      body: formData
    });
    const data = await res.json();
    if (data.error) {
      showAlert('Update Failed', data.error, 'error');
    } else {
      showAlert('Product Updated', 'Product details have been successfully modified in the catalog!', 'success');
      document.getElementById('editProductModalOverlay').classList.remove('active');
      document.getElementById('editProductImage').value = ''; // clear input
      await fetchProducts();
      renderAdminProducts();
      renderProducts(); // refresh storefront
    }
  } catch (err) {
    console.error(err);
    showAlert('Update Error', 'Failed to update product details on server.', 'error');
  }
});

// Edit Product Image selection change listener for dynamic preview
document.getElementById('editProductImage').addEventListener('change', (e) => {
  const label = document.getElementById('editProductImageLabel');
  if (e.target.files.length > 0) {
    label.textContent = e.target.files[0].name;
    
    // Update image preview dynamically
    const reader = new FileReader();
    reader.onload = (event) => {
      document.getElementById('editProductImagePreview').src = event.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
  } else {
    label.textContent = 'Upload New Photo...';
  }
});

// REFRESH CUSTOMER ACTIVE ORDERS (TRACKER)
async function refreshCustomerOrders() {
  const container = document.getElementById('customerDashboardArea');
  const list = document.getElementById('customerActiveOrdersList');
  if (!container || !list) return;

  if (!state.currentUser) {
    container.style.display = 'none';
    return;
  }

  try {
    const res = await fetch('/api/orders');
    const orders = await res.json();
    
    // Filter for current logged-in customer's orders
    const myOrders = orders.filter(o => o.user && o.user.username === state.currentUser.username);
    
    // Filter for active orders (pending_payment, paid, or preparing). Completed orders can be listed or hidden. Let's show active ones!
    const activeOrders = myOrders.filter(o => o.status !== 'completed');

    if (activeOrders.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    list.innerHTML = '';

    activeOrders.forEach(order => {
      // Calculate active step index:
      const isPaid = order.status === 'paid_processing' || order.status === 'paid' || order.status === 'completed';
      
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
      const isPacked = groceryOk && coffeeOk;

      const itemsStr = order.items.map(i => `${i.name} (x${i.qty})`).join(', ');

      // Stage description
      let stageText = 'Order Placed';
      if (order.status === 'pending_payment') {
        stageText = 'Awaiting Gateway Payment...';
      } else if (isPaid && !isPacked) {
        stageText = 'Fulfillment center: picking & packaging items';
      } else if (isPacked && order.status !== 'completed') {
        stageText = 'Fulfillment complete! Dispatched to Rider';
      }

      const card = document.createElement('div');
      card.className = 'active-order-track-card';
      card.innerHTML = `
        <div class="track-card-header">
          <div>
            <strong>Order ID: <span style="font-family: monospace; color: #f57224;">${order.id}</span></strong>
            <span class="track-time">${new Date(order.date).toLocaleTimeString()}</span>
          </div>
          <span class="track-total">NPR ${order.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </div>
        <div class="track-items-list">📦 <strong>Items:</strong> ${itemsStr}</div>
        <div class="track-status-alert">🔔 <strong>Current State:</strong> ${stageText}</div>
        
        <div class="timeline-stepper">
          <div class="step done">
            <div class="circle">✓</div>
            <div class="label">Ordered</div>
          </div>
          <div class="step-line ${isPaid ? 'done' : ''}"></div>
          <div class="step ${isPaid ? 'done' : (order.status === 'pending_payment' ? 'active' : '')}">
            <div class="circle">${isPaid ? '✓' : '💳'}</div>
            <div class="label">Paid</div>
          </div>
          <div class="step-line ${isPacked ? 'done' : ''}"></div>
          <div class="step ${isPacked ? 'done' : (isPaid ? 'active' : '')}">
            <div class="circle">${isPacked ? '✓' : '📦'}</div>
            <div class="label">Packed</div>
          </div>
          <div class="step-line ${order.status === 'completed' ? 'done' : ''}"></div>
          <div class="step ${order.status === 'completed' ? 'done' : (isPacked ? 'active' : '')}">
            <div class="circle">🏍️</div>
            <div class="label">With Rider</div>
          </div>
        </div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load active orders tracker:', err);
  }
}

// ==========================================
// SWEET ALERT MODAL HELPER DEFINITION
// ==========================================
function showAlert(title, message, iconType = 'info', showCancel = false) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('sweetAlertOverlay');
    const iconEl = document.getElementById('sweetAlertIcon');
    const titleEl = document.getElementById('sweetAlertTitle');
    const msgEl = document.getElementById('sweetAlertMessage');
    const btnEl = document.getElementById('sweetAlertBtn');
    const cancelBtnEl = document.getElementById('sweetAlertCancelBtn');

    if (!overlay) {
      if (showCancel) {
        resolve(confirm(`${title}\n${message}`));
      } else {
        alert(`${title}\n${message}`);
        resolve(true);
      }
      return;
    }

    // Set classes and visual styles
    iconEl.className = `sweet-alert-icon ${iconType}`;
    if (iconType === 'success') {
      iconEl.textContent = '✓';
    } else if (iconType === 'error') {
      iconEl.textContent = '✕';
    } else if (iconType === 'warning') {
      iconEl.textContent = '⚠️';
    } else {
      iconEl.textContent = 'ℹ️';
    }

    titleEl.textContent = title;
    msgEl.textContent = message;

    if (showCancel) {
      cancelBtnEl.style.display = 'block';
      btnEl.textContent = 'Yes';
    } else {
      cancelBtnEl.style.display = 'none';
      btnEl.textContent = 'OK';
    }

    // Open SweetAlert panel
    overlay.classList.add('active');

    // Click handler for confirmation
    const handleConfirm = () => {
      overlay.classList.remove('active');
      btnEl.removeEventListener('click', handleConfirm);
      cancelBtnEl.removeEventListener('click', handleCancel);
      resolve(true);
    };

    const handleCancel = () => {
      overlay.classList.remove('active');
      btnEl.removeEventListener('click', handleConfirm);
      cancelBtnEl.removeEventListener('click', handleCancel);
      resolve(false);
    };

    btnEl.addEventListener('click', handleConfirm);
    cancelBtnEl.addEventListener('click', handleCancel);
  });
}
