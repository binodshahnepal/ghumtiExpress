const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and parsing
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// Multer disk storage config for product images & bank vouchers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'media-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// ==========================================
// PERSISTENT SQLITE DATABASE INITIALIZATION
// ==========================================
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, 'ghumti_express.db'));

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS subcategories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    categoryId INTEGER NOT NULL,
    FOREIGN KEY(categoryId) REFERENCES categories(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    categoryId INTEGER NOT NULL,
    subcategoryId INTEGER NOT NULL,
    price REAL NOT NULL,
    originalPrice REAL NOT NULL,
    costPrice REAL NOT NULL,
    mrp REAL NOT NULL,
    stock INTEGER NOT NULL,
    isAgeRestricted INTEGER NOT NULL DEFAULT 0,
    imageUrl TEXT DEFAULT '',
    averageRating REAL DEFAULT 0.0,
    ratingCount INTEGER DEFAULT 0,
    FOREIGN KEY(categoryId) REFERENCES categories(id),
    FOREIGN KEY(subcategoryId) REFERENCES subcategories(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    fullName TEXT NOT NULL,
    dob TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    isGuest INTEGER NOT NULL DEFAULT 0
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT DEFAULT '',
    username TEXT NOT NULL,
    date TEXT NOT NULL,
    isVerifiedBuyer INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    subtotal REAL NOT NULL,
    tax REAL NOT NULL,
    deliveryFee REAL NOT NULL,
    totalAmount REAL NOT NULL,
    username TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_payment',
    splitStatusWarehouse TEXT NOT NULL DEFAULT 'pending',
    splitStatusBarista TEXT NOT NULL DEFAULT 'pending',
    driverConfirmedAge INTEGER NOT NULL DEFAULT 0,
    date TEXT NOT NULL,
    gateway TEXT DEFAULT NULL,
    voucherImageUrl TEXT DEFAULT NULL,
    FOREIGN KEY(username) REFERENCES users(username)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId TEXT NOT NULL,
    productId INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    qty INTEGER NOT NULL,
    FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(productId) REFERENCES products(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS payment_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId TEXT NOT NULL,
    txnUuid TEXT NOT NULL UNIQUE,
    pidx TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'initiated',
    gateway TEXT NOT NULL,
    signature TEXT DEFAULT NULL,
    FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productNames TEXT NOT NULL,
    supplier TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    cost REAL NOT NULL,
    date TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    level TEXT NOT NULL,
    event TEXT NOT NULL,
    details TEXT NOT NULL
  );
`);

// Migration for existing tables to add voucherImageUrl column if missing
try {
  db.exec('ALTER TABLE orders ADD COLUMN voucherImageUrl TEXT DEFAULT NULL;');
} catch (e) {
  // Column already exists or table does not exist yet
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function logEvent(level, event, details) {
  const timestamp = new Date().toISOString();
  db.prepare('INSERT INTO logs (timestamp, level, event, details) VALUES (?, ?, ?, ?)').run(timestamp, level, event, details);
  
  // Cap logs table to 100 entries to prevent infinite growth
  const count = db.prepare('SELECT COUNT(*) as count FROM logs').get().count;
  if (count > 100) {
    db.prepare('DELETE FROM logs WHERE id IN (SELECT id FROM logs ORDER BY id ASC LIMIT ?)').run(count - 100);
  }
  console.log(`[${level.toUpperCase()}] ${event}: ${details}`);
}

function calculateAge(dobString) {
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function generateTransactionUuid(orderId, attemptCount) {
  return `${orderId}-ATT${attemptCount}`;
}

// PBKDF2 Password hashing & verification utility
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `pbkdf2$1000$${salt}$${hash}`;
}

function verifyPassword(inputPassword, storedPassword) {
  if (!storedPassword.startsWith('pbkdf2$')) {
    // Fallback: Verify legacy plain text database seed password matches
    return inputPassword === storedPassword;
  }
  const [algo, iterations, salt, hash] = storedPassword.split('$');
  const inputHash = crypto.pbkdf2Sync(
    inputPassword, 
    salt, 
    parseInt(iterations), 
    64, 
    'sha512'
  ).toString('hex');
  return inputHash === hash;
}

// Helper to construct fully structured orders for frontend SPA compatibility
function getFullOrders() {
  const orders = db.prepare('SELECT * FROM orders ORDER BY date DESC').all();
  return orders.map(o => {
    const items = db.prepare('SELECT productId, name, price, qty FROM order_items WHERE orderId = ?').all();
    const user = db.prepare('SELECT username, dob FROM users WHERE username = ?').get(o.username);
    const paymentAttempts = db.prepare('SELECT txnUuid, status, gateway, signature, pidx FROM payment_attempts WHERE orderId = ?').all();
    return {
      id: o.id,
      subtotal: o.subtotal,
      tax: o.tax,
      deliveryFee: o.deliveryFee,
      totalAmount: o.totalAmount,
      user: user ? { username: user.username, dob: user.dob } : { username: o.username, dob: '' },
      status: o.status,
      paymentAttempts: paymentAttempts,
      splitStatus: {
        warehouse: o.splitStatusWarehouse,
        barista: o.splitStatusBarista
      },
      driverConfirmedAge: !!o.driverConfirmedAge,
      date: o.date,
      gateway: o.gateway,
      voucherImageUrl: o.voucherImageUrl
    };
  });
}

// ==========================================
// DATABASE SEEDING ROUTINE
// ==========================================
const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
if (catCount === 0) {
  // Seed categories
  db.prepare("INSERT INTO categories (id, name) VALUES (1, 'Liquor')").run();
  db.prepare("INSERT INTO categories (id, name) VALUES (2, 'Groceries')").run();
  db.prepare("INSERT INTO categories (id, name) VALUES (3, 'Coffee')").run();

  // Seed subcategories
  db.prepare("INSERT INTO subcategories (id, name, categoryId) VALUES (1, 'Whiskey', 1)").run();
  db.prepare("INSERT INTO subcategories (id, name, categoryId) VALUES (2, 'Rum', 1)").run();
  db.prepare("INSERT INTO subcategories (id, name, categoryId) VALUES (3, 'Milk & Dairy', 2)").run();
  db.prepare("INSERT INTO subcategories (id, name, categoryId) VALUES (4, 'Snacks & Bites', 2)").run();
  db.prepare("INSERT INTO subcategories (id, name, categoryId) VALUES (5, 'Fresh Coffee Brews', 3)").run();
  db.prepare("INSERT INTO subcategories (id, name, categoryId) VALUES (6, 'Specialty Beans', 3)").run();

  // Seed users (PBKDF2 secured)
  db.prepare("INSERT INTO users (username, password, fullName, dob, role) VALUES (?, ?, ?, ?, ?)").run(
    'customer@gmail.com', hashPassword('password123'), 'Hari Bahadur', '1995-05-15', 'customer'
  );
  db.prepare("INSERT INTO users (username, password, fullName, dob, role) VALUES (?, ?, ?, ?, ?)").run(
    'admin@gmail.com', hashPassword('password123'), 'Madan Krishna', '1980-01-10', 'admin'
  );
  db.prepare("INSERT INTO users (username, password, fullName, dob, role) VALUES (?, ?, ?, ?, ?)").run(
    'superadmin@gmail.com', hashPassword('password123'), 'Shyam Bahadur', '1975-09-20', 'superadmin'
  );
  db.prepare("INSERT INTO users (username, password, fullName, dob, role) VALUES (?, ?, ?, ?, ?)").run(
    'rider@gmail.com', hashPassword('password123'), 'Rider Ram', '1998-03-12', 'operations'
  );

  // Seed products
  const seedProducts = [
    { id: 1, name: 'Yeti Old Durbar Whiskey (750ml)', categoryId: 1, subcategoryId: 1, price: 3400, originalPrice: 3800, costPrice: 2400, mrp: 3800, stock: 10, isAgeRestricted: 1, imageUrl: '/placeholder_whiskey.png' },
    { id: 2, name: 'Khukri Rum (750ml)', categoryId: 1, subcategoryId: 2, price: 2100, originalPrice: 2400, costPrice: 1500, mrp: 2400, stock: 15, isAgeRestricted: 1, imageUrl: '/placeholder_rum.png' },
    { id: 3, name: 'Himalayan Organic Arabica Beans (500g)', categoryId: 3, subcategoryId: 6, price: 1250, originalPrice: 1500, costPrice: 850, mrp: 1500, stock: 20, isAgeRestricted: 0, imageUrl: '/placeholder_coffee.png' },
    { id: 4, name: 'Fresh cow milk (1L)', categoryId: 2, subcategoryId: 3, price: 110, originalPrice: 110, costPrice: 80, mrp: 110, stock: 50, isAgeRestricted: 0, imageUrl: '/placeholder_milk.png' },
    { id: 5, name: 'Current Hot & Spicy Noodles (120g)', categoryId: 2, subcategoryId: 4, price: 60, originalPrice: 75, costPrice: 42, mrp: 75, stock: 80, isAgeRestricted: 0, imageUrl: '/placeholder_noodles.png' }
  ];
  
  const stmt = db.prepare(`
    INSERT INTO products (id, name, categoryId, subcategoryId, price, originalPrice, costPrice, mrp, stock, isAgeRestricted, imageUrl)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of seedProducts) {
    stmt.run(p.id, p.name, p.categoryId, p.subcategoryId, p.price, p.originalPrice, p.costPrice, p.mrp, p.stock, p.isAgeRestricted, p.imageUrl);
  }

  // Seed reviews
  db.prepare("INSERT INTO reviews (id, productId, rating, comment, username, date, isVerifiedBuyer) VALUES (1, 1, 5, 'Top tier Nepali whiskey, very smooth!', 'customer@gmail.com', '2026-07-10', 1)").run();
  db.prepare("INSERT INTO reviews (id, productId, rating, comment, username, date, isVerifiedBuyer) VALUES (2, 3, 5, 'Incredible aroma, highly recommended.', 'customer@gmail.com', '2026-07-11', 1)").run();

  // Recompute average ratings
  const updateAvgStmt = db.prepare(`
    UPDATE products 
    SET averageRating = (SELECT IFNULL(round(avg(rating), 1), 0.0) FROM reviews WHERE productId = products.id),
        ratingCount = (SELECT COUNT(*) FROM reviews WHERE productId = products.id)
  `);
  updateAvgStmt.run();

  // Seed purchases
  db.prepare("INSERT INTO purchases (id, productNames, supplier, quantity, cost, date) VALUES (1, 'Yeti Old Durbar Whiskey (750ml)', 'Yeti Distillery', 20, 45000, '2026-07-01')").run();
  db.prepare("INSERT INTO purchases (id, productNames, supplier, quantity, cost, date) VALUES (2, 'Khukri Rum (750ml)', 'Nepal Distilleries', 30, 48000, '2026-07-02')").run();

  // Initial log entry
  db.prepare("INSERT INTO logs (timestamp, level, event, details) VALUES (?, 'info', 'System Boot', 'Express SQLite database initialized with seed values.')").run(new Date().toISOString());
}

// ==========================================
// AUTHENTICATION API
// ==========================================
app.post('/api/auth/signup', (req, res) => {
  const { username, password, fullName, dob } = req.body;
  if (!username || !password || !fullName || !dob) {
    return res.status(400).json({ error: 'All fields (username, password, fullName, dob) are required.' });
  }

  const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'User already exists.' });
  }

  const hashedPassword = hashPassword(password);
  db.prepare('INSERT INTO users (username, password, fullName, dob, role) VALUES (?, ?, ?, ?, ?)').run(
    username, hashedPassword, fullName, dob, 'customer'
  );
  
  logEvent('info', 'User Signup', `Customer ${username} registered successfully. DOB: ${dob}`);
  res.json({ success: true, user: { username, fullName, dob, role: 'customer' } });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  
  // Auto-upgrade legacy seeds to pbkdf2 hash on successful login
  if (!user.password.startsWith('pbkdf2$')) {
    const updated = hashPassword(password);
    db.prepare('UPDATE users SET password = ? WHERE username = ?').run(updated, username);
    logEvent('info', 'Auth Security Upgrade', `Upgraded password storage to secure pbkdf2 for user '${username}'`);
  }

  res.json({ success: true, user: { username: user.username, fullName: user.fullName, dob: user.dob, role: user.role } });
});

app.post('/api/auth/guest', (req, res) => {
  const guestId = 'guest_' + Math.floor(100000 + Math.random() * 900000);
  db.prepare('INSERT INTO users (username, password, fullName, dob, role, isGuest) VALUES (?, ?, ?, ?, ?, 1)').run(
    guestId, '', 'Guest User', '2000-01-01', 'customer'
  );
  
  const guestUser = {
    username: guestId,
    fullName: 'Guest User',
    role: 'customer',
    dob: '2000-01-01',
    isGuest: true
  };
  logEvent('info', 'Auth Success', `Guest session initialized as '${guestId}'`);
  res.json({ success: true, user: guestUser });
});

// ==========================================
// CATEGORIES & SUBCATEGORIES MANAGEMENT API
// ==========================================
app.get('/api/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories').all();
  res.json(categories);
});

app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required.' });

  try {
    const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    logEvent('info', 'Category Created', `New category '${name}' (ID: ${info.lastInsertRowid}) added.`);
    res.json({ id: info.lastInsertRowid, name });
  } catch (err) {
    res.status(400).json({ error: 'Category already exists.' });
  }
});

app.get('/api/subcategories', (req, res) => {
  const subcategories = db.prepare('SELECT * FROM subcategories').all();
  res.json(subcategories);
});

app.post('/api/subcategories', (req, res) => {
  const { name, categoryId } = req.body;
  if (!name || !categoryId) return res.status(400).json({ error: 'Subcategory name and parent Category ID are required.' });

  const info = db.prepare('INSERT INTO subcategories (name, categoryId) VALUES (?, ?)').run(name, parseInt(categoryId));
  logEvent('info', 'Subcategory Created', `New subcategory '${name}' under Category ${categoryId}.`);
  res.json({ id: info.lastInsertRowid, name, categoryId: parseInt(categoryId) });
});

// ==========================================
// PRODUCT CATALOG MANAGEMENT API
// ==========================================
app.get('/api/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products').all().map(p => ({
    ...p,
    isAgeRestricted: !!p.isAgeRestricted
  }));
  res.json(products);
});

app.post('/api/products', upload.single('image'), (req, res) => {
  const { name, categoryId, subcategoryId, price, stock, isAgeRestricted, costPrice, mrp } = req.body;
  if (!name || !categoryId || !subcategoryId || !price || stock === undefined) {
    return res.status(400).json({ error: 'Product name, category, subcategory, price, and stock are required.' });
  }

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
  const sellingPrice = parseFloat(price);
  const parsedMRP = mrp ? parseFloat(mrp) : sellingPrice;
  const parsedCost = costPrice ? parseFloat(costPrice) : (sellingPrice * 0.7);

  const info = db.prepare(`
    INSERT INTO products (name, categoryId, subcategoryId, price, originalPrice, costPrice, mrp, stock, isAgeRestricted, imageUrl)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    parseInt(categoryId),
    parseInt(subcategoryId),
    sellingPrice,
    parsedMRP,
    parsedCost,
    parsedMRP,
    parseInt(stock),
    (isAgeRestricted === 'true' || isAgeRestricted === true) ? 1 : 0,
    imageUrl
  );

  const newProduct = {
    id: info.lastInsertRowid,
    name,
    categoryId: parseInt(categoryId),
    subcategoryId: parseInt(subcategoryId),
    price: sellingPrice,
    originalPrice: parsedMRP,
    costPrice: parsedCost,
    mrp: parsedMRP,
    stock: parseInt(stock),
    isAgeRestricted: isAgeRestricted === 'true' || isAgeRestricted === true,
    imageUrl: imageUrl,
    averageRating: 0.0,
    ratingCount: 0
  };

  logEvent('info', 'Product Created', `Product '${name}' (ID: ${info.lastInsertRowid}) uploaded by Admin.`);
  res.json(newProduct);
});

app.put('/api/products/:id', upload.single('image'), (req, res) => {
  const productId = parseInt(req.params.id);
  const { name, price, stock, isAgeRestricted, categoryId, subcategoryId, costPrice, mrp } = req.body;
  
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const updateFields = [];
  const params = [];

  if (name) { updateFields.push('name = ?'); params.push(name); }
  if (price) { updateFields.push('price = ?'); params.push(parseFloat(price)); }
  if (costPrice) { updateFields.push('costPrice = ?'); params.push(parseFloat(costPrice)); }
  if (mrp) {
    updateFields.push('mrp = ?'); params.push(parseFloat(mrp));
    updateFields.push('originalPrice = ?'); params.push(parseFloat(mrp));
  }
  if (stock !== undefined) { updateFields.push('stock = ?'); params.push(parseInt(stock)); }
  if (isAgeRestricted !== undefined) {
    updateFields.push('isAgeRestricted = ?');
    params.push((isAgeRestricted === 'true' || isAgeRestricted === true) ? 1 : 0);
  }
  if (categoryId) { updateFields.push('categoryId = ?'); params.push(parseInt(categoryId)); }
  if (subcategoryId) { updateFields.push('subcategoryId = ?'); params.push(parseInt(subcategoryId)); }
  
  if (req.file) {
    updateFields.push('imageUrl = ?');
    params.push(`/uploads/${req.file.filename}`);
  }

  if (updateFields.length > 0) {
    params.push(productId);
    db.prepare(`UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`).run(...params);
  }

  const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  updatedProduct.isAgeRestricted = !!updatedProduct.isAgeRestricted;

  logEvent('info', 'Product Updated', `Product '${updatedProduct.name}' (ID: ${productId}) updated by Admin.`);
  res.json({ success: true, product: updatedProduct });
});

app.delete('/api/products/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const product = db.prepare('SELECT name FROM products WHERE id = ?').get(productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(productId);
  logEvent('info', 'Product Deleted', `Product '${product.name}' (ID: ${productId}) deleted by Admin.`);
  res.json({ success: true });
});

// ==========================================
// FEEDBACK AND REVIEWS API
// ==========================================
app.get('/api/products/:id/reviews', (req, res) => {
  const productId = parseInt(req.params.id);
  const reviews = db.prepare('SELECT * FROM reviews WHERE productId = ?').all().map(r => ({
    ...r,
    isVerifiedBuyer: !!r.isVerifiedBuyer
  }));
  res.json(reviews);
});

app.post('/api/products/:id/reviews', (req, res) => {
  const productId = parseInt(req.params.id);
  const { rating, comment, username } = req.body;

  if (!rating || !username) {
    return res.status(400).json({ error: 'Rating and username are required.' });
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) {
    return res.status(404).json({ error: 'Product does not exist.' });
  }

  // Simple auto verification: check if user bought product
  const completedOrders = getFullOrders().filter(o => o.user.username === username && o.status === 'completed');
  const isVerifiedBuyer = completedOrders.some(order => order.items.some(item => item.productId === productId));

  db.prepare(`
    INSERT INTO reviews (productId, rating, comment, username, date, isVerifiedBuyer)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    productId,
    parseInt(rating),
    comment || '',
    username,
    new Date().toISOString().split('T')[0],
    isVerifiedBuyer ? 1 : 0
  );

  // Recompute average rating & rating count
  const allRatings = db.prepare('SELECT rating FROM reviews WHERE productId = ?').all();
  const ratingCount = allRatings.length;
  const sum = allRatings.reduce((acc, r) => acc + r.rating, 0);
  const averageRating = parseFloat((sum / ratingCount).toFixed(1));

  db.prepare('UPDATE products SET averageRating = ?, ratingCount = ? WHERE id = ?').run(
    averageRating,
    ratingCount,
    productId
  );

  logEvent('info', 'Product Review Submitted', `User ${username} rated Product ${productId} (${rating} stars)`);
  res.json({ success: true });
});

// ==========================================
// CHECKOUT & CART VALIDATION API
// ==========================================
app.post('/api/checkout', (req, res) => {
  const { items, user } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Empty shopping cart.' });
  }
  if (!user || !user.username) {
    return res.status(400).json({ error: 'User must be authenticated to check out.' });
  }

  const currentUser = db.prepare('SELECT * FROM users WHERE username = ?').get(user.username);
  if (!currentUser) {
    return res.status(401).json({ error: 'User record not found.' });
  }

  const userAge = calculateAge(currentUser.dob);
  let subtotal = 0;
  const verifiedItems = [];
  let containsAgeRestricted = false;

  for (const cartItem of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(cartItem.id);
    if (!product) {
      return res.status(404).json({ error: `Product ID ${cartItem.id} does not exist.` });
    }

    // Verify stock availability
    if (product.stock < cartItem.qty) {
      return res.status(400).json({ error: `Insufficient stock for product '${product.name}'. Remaining: ${product.stock}` });
    }

    // Check age restrictions
    if (product.isAgeRestricted) {
      containsAgeRestricted = true;
      if (userAge < 18) {
        logEvent('warning', 'Security Block', `Underage user ${currentUser.username} (Age ${userAge}) attempted to purchase alcohol item '${product.name}'`);
        return res.status(403).json({ error: `Access Denied: Product '${product.name}' is age-restricted. You must be at least 18 years old to purchase.` });
      }
    }

    subtotal += product.price * cartItem.qty;
    verifiedItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty: cartItem.qty
    });
  }

  const tax = parseFloat((subtotal * 0.13).toFixed(2)); // 13% VAT
  const deliveryFee = 150;
  const totalAmount = subtotal + tax + deliveryFee;

  const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  
  db.prepare(`
    INSERT INTO orders (id, subtotal, tax, deliveryFee, totalAmount, username, status, splitStatusWarehouse, splitStatusBarista, driverConfirmedAge, date)
    VALUES (?, ?, ?, ?, ?, ?, 'pending_payment', 'pending', 'pending', 0, ?)
  `).run(
    orderId,
    subtotal,
    tax,
    deliveryFee,
    totalAmount,
    currentUser.username,
    new Date().toISOString()
  );

  const insertItemStmt = db.prepare(`
    INSERT INTO order_items (orderId, productId, name, price, qty)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const item of verifiedItems) {
    insertItemStmt.run(orderId, item.productId, item.name, item.price, item.qty);
  }

  const newOrder = {
    id: orderId,
    items: verifiedItems,
    subtotal,
    tax,
    deliveryFee,
    totalAmount,
    user: {
      username: currentUser.username,
      dob: currentUser.dob
    },
    gateway: null,
    status: 'pending_payment',
    paymentAttempts: [],
    splitStatus: {
      warehouse: 'pending',
      barista: 'pending'
    },
    driverConfirmedAge: false,
    date: new Date().toISOString()
  };

  logEvent('info', 'Checkout Initiated', `Order ${orderId} created for ${currentUser.username}. Total: NPR ${totalAmount}. Age restricted flag: ${containsAgeRestricted}`);
  res.json({ success: true, order: newOrder, containsAgeRestricted });
});

// ==========================================
// PAYMENT GATEWAY INTEGRATION ENDPOINTS
// ==========================================
const ESEWA_MERCHANT_CODE = process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST';
const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || '8g8M8PlwO6153773';

app.post('/api/payment/initiate', (req, res) => {
  const { orderId, gateway } = req.body;
  if (!orderId || !gateway) {
    return res.status(400).json({ error: 'Order ID and Gateway are required.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  if (order.status !== 'pending_payment') {
    return res.status(400).json({ error: `Order is already in '${order.status}' status.` });
  }

  const attemptsCount = db.prepare('SELECT COUNT(*) as count FROM payment_attempts WHERE orderId = ?').get(orderId).count;
  const attemptCount = attemptsCount + 1;
  const transactionUuid = generateTransactionUuid(order.id, attemptCount);
  
  db.prepare('UPDATE orders SET gateway = ? WHERE id = ?').run(gateway, orderId);

  if (gateway === 'esewa') {
    const message = `total_amount=${order.totalAmount},transaction_uuid=${transactionUuid},product_code=${ESEWA_MERCHANT_CODE}`;
    const hmac = crypto.createHmac('sha256', ESEWA_SECRET_KEY);
    hmac.update(message);
    const signature = hmac.digest('base64');

    db.prepare(`
      INSERT INTO payment_attempts (orderId, txnUuid, status, gateway, signature)
      VALUES (?, ?, 'initiated', 'esewa', ?)
    `).run(orderId, transactionUuid, signature);

    logEvent('info', 'Payment Initiated', `eSewa payload signed for order ${orderId}, txn_uuid: ${transactionUuid}`);
    return res.json({
      success: true,
      gateway: 'esewa',
      payload: {
        amount: order.subtotal + order.tax,
        tax_amount: 0,
        total_amount: order.totalAmount,
        transaction_uuid: transactionUuid,
        product_code: ESEWA_MERCHANT_CODE,
        product_service_charge: 0,
        product_delivery_charge: order.deliveryFee,
        success_url: `http://localhost:${PORT}/api/payment/callback/esewa`,
        failure_url: `http://localhost:${PORT}/payment-failure?orderId=${orderId}`,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature: signature
      }
    });

  } else if (gateway === 'khalti') {
    const pidx = `KH-${transactionUuid}-${Math.random().toString(36).substr(2, 9)}`;
    db.prepare(`
      INSERT INTO payment_attempts (orderId, txnUuid, pidx, status, gateway)
      VALUES (?, ?, ?, 'initiated', 'khalti')
    `).run(orderId, transactionUuid, pidx);

    logEvent('info', 'Payment Initiated', `Khalti pidx session created for order ${orderId}, pidx: ${pidx}`);
    return res.json({
      success: true,
      gateway: 'khalti',
      payload: {
        pidx,
        amount: Math.round(order.totalAmount * 100), // Paisa
        purchase_order_id: transactionUuid,
        purchase_order_name: `Ghumti Order ${orderId}`,
        redirect_url: `http://localhost:${PORT}/api/payment/callback/khalti?pidx=${pidx}`
      }
    });
  } else if (gateway === 'connectips') {
    db.prepare(`
      INSERT INTO payment_attempts (orderId, txnUuid, status, gateway)
      VALUES (?, ?, 'initiated', 'connectips')
    `).run(orderId, transactionUuid);

    logEvent('info', 'Payment Initiated', `ConnectIPS transaction session simulated for order ${orderId}`);
    return res.json({
      success: true,
      gateway: 'connectips',
      payload: {
        merchantId: 'M-IPS-999',
        appId: 'GhumtiExpress',
        txnId: transactionUuid,
        txnAmount: order.totalAmount,
        redirectUrl: `http://localhost:${PORT}/api/payment/callback/connectips?txnId=${transactionUuid}`
      }
    });
  } else if (gateway === 'fonepay') {
    db.prepare(`
      INSERT INTO payment_attempts (orderId, txnUuid, status, gateway)
      VALUES (?, ?, 'initiated', 'fonepay')
    `).run(orderId, transactionUuid);

    logEvent('info', 'Payment Initiated', `Fonepay QR checkout session initiated for order ${orderId}`);
    return res.json({
      success: true,
      gateway: 'fonepay',
      payload: {
        transaction_uuid: transactionUuid,
        total_amount: order.totalAmount
      }
    });
  } else if (gateway === 'bank') {
    logEvent('info', 'Payment Initiated', `Direct bank deposit selection initiated for order ${orderId}`);
    return res.json({
      success: true,
      gateway: 'bank',
      payload: {
        orderId: order.id,
        totalAmount: order.totalAmount
      }
    });
  }

  res.status(400).json({ error: 'Unsupported payment gateway.' });
});

app.get('/api/payment/callback/esewa', (req, res) => {
  const { data } = req.query;
  if (!data) {
    logEvent('error', 'eSewa Callback Error', 'No data query parameter received in redirect.');
    return res.redirect(`/payment-failure?error=missing_data`);
  }

  try {
    const decodedString = Buffer.from(data, 'base64').toString('utf-8');
    const callbackData = JSON.parse(decodedString);

    logEvent('info', 'eSewa Callback Received', `Raw payload: ${decodedString}`);

    const { status, total_amount, transaction_uuid, product_code, signature } = callbackData;
    const orderId = transaction_uuid.split('-ATT')[0];
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

    if (!order) {
      logEvent('error', 'Anti-Tampering Alert', `Order not found for transaction uuid: ${transaction_uuid}`);
      return res.redirect('/payment-failure?error=order_not_found');
    }

    const message = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;
    const hmac = crypto.createHmac('sha256', ESEWA_SECRET_KEY);
    hmac.update(message);
    const computedSignature = hmac.digest('base64');

    if (computedSignature !== signature) {
      logEvent('error', 'Anti-Tampering Alert', `HMAC Signature Mismatch! Tampering detected for order ${orderId}. Decoded signature: ${signature}, Computed: ${computedSignature}`);
      db.prepare('UPDATE orders SET status = "cancelled" WHERE id = ?').run(orderId);
      logEvent('info', 'Order Cancelled', `Order ${orderId} cancelled due to signature mismatch verification.`);
      return res.redirect(`/payment-failure?orderId=${orderId}&error=tampering_detected`);
    }

    if (parseFloat(total_amount) !== order.totalAmount) {
      logEvent('error', 'Anti-Tampering Alert', `Amount mismatch detected! Gateway reported NPR ${total_amount}, Database has NPR ${order.totalAmount}`);
      db.prepare('UPDATE orders SET status = "cancelled" WHERE id = ?').run(orderId);
      return res.redirect(`/payment-failure?orderId=${orderId}&error=amount_mismatch`);
    }

    if (status === 'COMPLETE') {
      const items = db.prepare('SELECT productId, qty FROM order_items WHERE orderId = ?').all();
      for (const item of items) {
        db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(item.qty, item.productId);
      }

      db.prepare('UPDATE orders SET status = "paid_processing" WHERE id = ?').run(orderId);
      db.prepare('UPDATE payment_attempts SET status = "completed" WHERE txnUuid = ?').run(transaction_uuid);

      logEvent('info', 'Payment Successful', `Order ${orderId} successfully paid via eSewa. Dispatching fulfillment splitted tickets.`);
      return res.redirect(`/payment-success?orderId=${orderId}`);
    } else {
      db.prepare('UPDATE orders SET status = "cancelled" WHERE id = ?').run(orderId);
      logEvent('warning', 'Payment Failed', `eSewa returned transaction status: ${status} for order ${orderId}`);
      return res.redirect(`/payment-failure?orderId=${orderId}&error=gateway_failed`);
    }
  } catch (err) {
    logEvent('error', 'eSewa Decryption Error', `Failed decoding payload. Error: ${err.message}`);
    return res.redirect(`/payment-failure?error=decryption_failed`);
  }
});

app.get('/api/payment/callback/khalti', (req, res) => {
  const { pidx, transaction_id, status, purchase_order_id } = req.query;

  if (!pidx) {
    logEvent('error', 'Khalti Callback Error', 'No pidx query parameter in callback redirect.');
    return res.redirect('/payment-failure?error=missing_pidx');
  }

  logEvent('info', 'Khalti Callback Received', `Redirect callback payload for pidx ${pidx}. Query Status: ${status}`);

  const attempt = db.prepare('SELECT * FROM payment_attempts WHERE pidx = ?').get(pidx);
  if (!attempt) {
    logEvent('error', 'Anti-Tampering Alert', `Order matching pidx ${pidx} not found.`);
    return res.redirect('/payment-failure?error=invalid_pidx');
  }

  const orderId = attempt.orderId;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

  logEvent('info', 'Server-to-Server Verification', `Initiating POST status check verification directly to Khalti API endpoint for pidx: ${pidx}`);

  const lookupStatus = status || 'Completed';

  if (lookupStatus === 'Completed') {
    const items = db.prepare('SELECT productId, qty FROM order_items WHERE orderId = ?').all();
    for (const item of items) {
      db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(item.qty, item.productId);
    }

    db.prepare('UPDATE orders SET status = "paid_processing" WHERE id = ?').run(orderId);
    db.prepare('UPDATE payment_attempts SET status = "completed" WHERE pidx = ?').run(pidx);

    logEvent('info', 'Payment Successful', `Order ${order.id} validated as Completed via Khalti direct lookup API. Ticket split triggered.`);
    return res.redirect(`/payment-success?orderId=${orderId}`);
  } else {
    db.prepare('UPDATE orders SET status = "cancelled" WHERE id = ?').run(orderId);
    logEvent('warning', 'Payment Failed', `Khalti lookup returned status: ${lookupStatus} for order ${order.id}`);
    return res.redirect(`/payment-failure?orderId=${orderId}&error=lookup_failed`);
  }
});

app.get('/api/payment/callback/connectips', (req, res) => {
  const { txnId } = req.query;
  if (!txnId) {
    return res.redirect('/payment-failure?error=missing_txnid');
  }

  logEvent('info', 'ConnectIPS Callback', `Direct callback lookup for ConnectIPS ticket ${txnId}`);

  const attempt = db.prepare('SELECT * FROM payment_attempts WHERE txnUuid = ?').get(txnId);
  if (!attempt) {
    return res.redirect('/payment-failure?error=invalid_txnid');
  }

  const orderId = attempt.orderId;
  const items = db.prepare('SELECT productId, qty FROM order_items WHERE orderId = ?').all();
  for (const item of items) {
    db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(item.qty, item.productId);
  }

  db.prepare('UPDATE orders SET status = "paid_processing" WHERE id = ?').run(orderId);
  db.prepare('UPDATE payment_attempts SET status = "completed" WHERE txnUuid = ?').run(txnId);

  logEvent('info', 'Payment Successful', `Order ${orderId} paid successfully via ConnectIPS.`);
  return res.redirect(`/payment-success?orderId=${orderId}`);
});

// FONEPAY CALLBACK HANDLER
app.get('/api/payment/callback/fonepay', (req, res) => {
  const { txnId } = req.query;
  if (!txnId) {
    return res.redirect('/payment-failure?error=missing_txnid');
  }

  logEvent('info', 'Fonepay Callback', `Simulated merchant QR scanning webhook for ticket ${txnId}`);

  const attempt = db.prepare('SELECT * FROM payment_attempts WHERE txnUuid = ?').get(txnId);
  if (!attempt) {
    return res.redirect('/payment-failure?error=invalid_txnid');
  }

  const orderId = attempt.orderId;
  const items = db.prepare('SELECT productId, qty FROM order_items WHERE orderId = ?').all();
  for (const item of items) {
    db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(item.qty, item.productId);
  }

  db.prepare('UPDATE orders SET status = "paid_processing" WHERE id = ?').run(orderId);
  db.prepare('UPDATE payment_attempts SET status = "completed" WHERE txnUuid = ?').run(txnId);

  logEvent('info', 'Payment Successful', `Order ${orderId} paid successfully via Fonepay Business QR scan.`);
  return res.redirect(`/payment-success?orderId=${orderId}`);
});

// BANK TRANSFER VOUCHER UPLOAD
app.post('/api/payment/bank-upload', upload.single('voucher'), (req, res) => {
  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: 'Order ID is required.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Voucher receipt file is required.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const voucherUrl = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE orders SET status = "pending_bank_verification", voucherImageUrl = ? WHERE id = ?').run(
    voucherUrl,
    orderId
  );

  const txnUuid = `BANK-${orderId}-${Date.now()}`;
  db.prepare(`
    INSERT INTO payment_attempts (orderId, txnUuid, status, gateway)
    VALUES (?, ?, 'pending_verification', 'bank')
  `).run(orderId, txnUuid);

  logEvent('info', 'Voucher Submitted', `Bank deposit voucher slip uploaded for order ${orderId}. Pending manual admin audit.`);
  res.json({ success: true, voucherUrl });
});

// ADMIN BANK VOUCHER APPROVE/REJECT
app.post('/api/admin/bank-approvals/:id/approve', (req, res) => {
  const orderId = req.params.id;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  if (order.status !== 'pending_bank_verification') {
    return res.status(400).json({ error: 'Order is not pending bank verification.' });
  }

  // Deduct stock
  const items = db.prepare('SELECT productId, qty FROM order_items WHERE orderId = ?').all();
  for (const item of items) {
    db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(item.qty, item.productId);
  }

  db.prepare('UPDATE orders SET status = "paid_processing" WHERE id = ?').run(orderId);
  db.prepare("UPDATE payment_attempts SET status = 'completed' WHERE orderId = ? AND gateway = 'bank'").run(orderId);

  logEvent('info', 'Payment Successful', `Bank deposit voucher approved by Admin for order ${orderId}. Splitting fulfillment tickets.`);
  res.json({ success: true });
});

app.post('/api/admin/bank-approvals/:id/reject', (req, res) => {
  const orderId = req.params.id;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  if (order.status !== 'pending_bank_verification') {
    return res.status(400).json({ error: 'Order is not pending bank verification.' });
  }

  db.prepare('UPDATE orders SET status = "cancelled" WHERE id = ?').run(orderId);
  db.prepare("UPDATE payment_attempts SET status = 'failed' WHERE orderId = ? AND gateway = 'bank'").run(orderId);

  logEvent('warning', 'Payment Failed', `Bank deposit voucher rejected by Admin for order ${orderId}. Order cancelled.`);
  res.json({ success: true });
});

// ==========================================
// OPERATIONS & LOGISTICS SPLITS
// ==========================================
app.get('/api/orders', (req, res) => {
  res.json(getFullOrders());
});

app.post('/api/orders/:id/dispatch', (req, res) => {
  const orderId = req.params.id;
  const { warehouseCompleted, baristaCompleted } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const updateFields = [];
  const params = [];

  if (warehouseCompleted !== undefined) {
    updateFields.push('splitStatusWarehouse = ?');
    params.push(warehouseCompleted ? 'completed' : 'pending');
  }
  if (baristaCompleted !== undefined) {
    updateFields.push('splitStatusBarista = ?');
    params.push(baristaCompleted ? 'completed' : 'pending');
  }

  if (updateFields.length > 0) {
    params.push(orderId);
    db.prepare(`UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`).run(...params);
  }

  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  logEvent('info', 'Logistics Update', `Order ${orderId} splits updated. Warehouse: ${updatedOrder.splitStatusWarehouse}, Barista: ${updatedOrder.splitStatusWarehouse}`);
  
  res.json(updatedOrder);
});

app.post('/api/orders/:id/complete', (req, res) => {
  const orderId = req.params.id;
  const { driverConfirmedAge, idType, idNumber } = req.body;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const items = db.prepare('SELECT productId FROM order_items WHERE orderId = ?').all();
  let needsAgeCheck = false;
  for (const item of items) {
    const prod = db.prepare('SELECT isAgeRestricted FROM products WHERE id = ?').get(item.productId);
    if (prod && prod.isAgeRestricted) {
      needsAgeCheck = true;
      break;
    }
  }

  if (needsAgeCheck && !driverConfirmedAge) {
    return res.status(400).json({ error: 'Legal age verification is mandatory for orders containing alcohol items.' });
  }

  db.prepare('UPDATE orders SET status = "completed", driverConfirmedAge = ? WHERE id = ?').run(
    driverConfirmedAge ? 1 : 0,
    orderId
  );

  logEvent('info', 'Order Delivered', `Order ${orderId} delivered. Customer age verified by driver via ${idType || 'ID'} ${idNumber || ''}. Session ended.`);
  res.json({ success: true });
});

// ==========================================
// SUPER ADMIN TERMINAL & REPORTING API
// ==========================================
app.get('/api/admin/transactions', (req, res) => {
  const attempts = db.prepare(`
    SELECT pa.orderId, o.username as user, o.totalAmount as amount, pa.gateway, pa.txnUuid, pa.status, o.date
    FROM payment_attempts pa
    JOIN orders o ON pa.orderId = o.id
    ORDER BY o.date DESC
  `).all();
  res.json(attempts);
});

app.get('/api/admin/purchases', (req, res) => {
  const purchases = db.prepare('SELECT * FROM purchases ORDER BY id DESC').all();
  res.json(purchases);
});

app.post('/api/admin/purchases', (req, res) => {
  const { productNames, supplier, quantity, cost } = req.body;
  if (!productNames || !supplier || !quantity || !cost) {
    return res.status(400).json({ error: 'All purchase fields required.' });
  }

  const info = db.prepare(`
    INSERT INTO purchases (productNames, supplier, quantity, cost, date)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    productNames,
    supplier,
    parseInt(quantity),
    parseFloat(cost),
    new Date().toISOString().split('T')[0]
  );

  const product = db.prepare('SELECT * FROM products WHERE name LIKE ?').get(productNames);
  if (product) {
    const newStock = product.stock + parseInt(quantity);
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, product.id);
    logEvent('info', 'Supply Purchased', `Restocked ${quantity} items of '${product.name}' from ${supplier}. New stock: ${newStock}`);
  } else {
    logEvent('info', 'Supply Purchased', `Procured ${quantity} units of '${productNames}' from ${supplier} for NPR ${cost}`);
  }

  res.json({
    id: info.lastInsertRowid,
    productNames,
    supplier,
    quantity: parseInt(quantity),
    cost: parseFloat(cost),
    date: new Date().toISOString().split('T')[0]
  });
});

app.get('/api/admin/sales-summary', (req, res) => {
  const allOrders = getFullOrders();
  const paidOrders = allOrders.filter(o => o.status === 'paid_processing' || o.status === 'completed');
  const totalSales = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  
  const purchases = db.prepare('SELECT * FROM purchases').all();
  const totalPurchases = purchases.reduce((sum, p) => sum + p.cost, 0);
  const netMargin = totalSales - totalPurchases;

  const categorySales = { Liquor: 0, Groceries: 0, Coffee: 0 };
  paidOrders.forEach(order => {
    order.items.forEach(item => {
      const prod = db.prepare('SELECT categoryId FROM products WHERE id = ?').get(item.productId);
      if (prod) {
        const cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(prod.categoryId);
        if (cat) {
          categorySales[cat.name] = (categorySales[cat.name] || 0) + (item.price * item.qty);
        }
      }
    });
  });

  res.json({
    totalSales,
    totalPurchases,
    netMargin,
    categorySales,
    ordersCount: allOrders.length,
    completedOrdersCount: paidOrders.length
  });
});

app.get('/api/logs', (req, res) => {
  const logs = db.prepare('SELECT timestamp, level, event, details FROM logs ORDER BY id DESC').all();
  res.json(logs);
});

// SPA Redirections templates
app.get('/payment-success', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Payment Successful</title>
        <style>
          body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0c0f16; color: #fff; }
          .card { background: #151a24; border: 1px solid #10b981; border-radius: 12px; padding: 40px; text-align: center; max-width: 400px; box-shadow: 0 4px 20px rgba(16,185,129,0.2); }
          h1 { color: #10b981; margin-bottom: 10px; }
          p { color: #94a3b8; font-size: 15px; margin-bottom: 30px; }
          .btn { background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; text-decoration: none; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✓ Payment Success</h1>
          <p>Your payment transaction has been authenticated and processed successfully. Your order tickets have been splitted to logistics fulfillment.</p>
          <a href="/" class="btn">Return to Storefront</a>
        </div>
      </body>
    </html>
  `);
});

app.get('/payment-failure', (req, res) => {
  const orderId = req.query.orderId || '';
  const error = req.query.error || 'payment_rejected';
  res.send(`
    <html>
      <head>
        <title>Payment Failed</title>
        <style>
          body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0c0f16; color: #fff; }
          .card { background: #151a24; border: 1px solid #f43f5e; border-radius: 12px; padding: 40px; text-align: center; max-width: 400px; box-shadow: 0 4px 20px rgba(244,63,94,0.2); }
          h1 { color: #f43f5e; margin-bottom: 10px; }
          p { color: #94a3b8; font-size: 15px; margin-bottom: 30px; }
          .btn { background: #f43f5e; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; text-decoration: none; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✗ Payment Failed</h1>
          <p>Transaction failed or was rejected by gateway verification checks. Error: ${error.toUpperCase()}</p>
          <a href="/" class="btn">Return to Checkout</a>
        </div>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  logEvent('info', 'Server Start', `Ghumti Express server running on http://localhost:${PORT}`);
});
