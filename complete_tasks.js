const fs = require('fs');
const path = require('path');

const PORT = 5005;
const BASE_URL = `http://localhost:${PORT}`;

async function run() {
  console.log('=== GHUMTI EXPRESS TASK AUTOMATION ===');

  try {
    // 1. Fetch categories to verify server connection and select parent category
    console.log('\nStep 1: Fetching categories...');
    const catRes = await fetch(`${BASE_URL}/api/categories`);
    if (!catRes.ok) throw new Error(`Failed to fetch categories: ${catRes.statusText}`);
    const categories = await catRes.json();
    console.log('Categories found:', categories);

    const groceryCategory = categories.find(c => c.name === 'Groceries');
    if (!groceryCategory) throw new Error('Groceries category not found');
    console.log(`Using 'Groceries' category with ID: ${groceryCategory.id}`);

    // 2. Create a new subcategory
    const subcategoryName = 'Imported Chocolates ' + Date.now();
    console.log(`\nStep 2: Creating subcategory '${subcategoryName}' under Category ID ${groceryCategory.id}...`);
    const subcatRes = await fetch(`${BASE_URL}/api/subcategories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: subcategoryName, categoryId: groceryCategory.id })
    });
    if (!subcatRes.ok) {
      const errText = await subcatRes.text();
      throw new Error(`Failed to create subcategory: ${errText}`);
    }
    const newSubcategory = await subcatRes.json();
    console.log('Subcategory created successfully:', newSubcategory);

    // 3. Upload a new product with a custom image
    console.log('\nStep 3: Uploading a new product with custom image...');
    const productName = 'Premium Swiss Dark Chocolate (100g)';
    const imagePath = path.join(__dirname, 'public', 'logo.png');
    
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found at ${imagePath}`);
    }
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

    const formData = new FormData();
    formData.append('name', productName);
    formData.append('categoryId', groceryCategory.id.toString());
    formData.append('subcategoryId', newSubcategory.id.toString());
    formData.append('price', '350');
    formData.append('costPrice', '200');
    formData.append('mrp', '400');
    formData.append('stock', '10'); // Initial stock is 10
    formData.append('isAgeRestricted', 'false');
    formData.append('image', imageBlob, 'swiss_chocolate.png');

    const prodRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      body: formData
    });
    if (!prodRes.ok) {
      const errText = await prodRes.text();
      throw new Error(`Failed to upload product: ${errText}`);
    }
    const newProduct = await prodRes.json();
    console.log('Product uploaded successfully:', newProduct);

    // 4. Verify initial KPIs
    console.log('\nStep 4: Fetching initial sales and procurement summary...');
    const initialKpiRes = await fetch(`${BASE_URL}/api/admin/sales-summary`);
    const initialKpi = await initialKpiRes.json();
    console.log('Initial KPIs:', initialKpi);

    // 5. Restock the item via B2B Procurement
    const restockQty = 50;
    const restockCost = 10000;
    console.log(`\nStep 5: Restocking '${productName}' with ${restockQty} units from Switzerland Imports via B2B Procurement...`);
    const procurementRes = await fetch(`${BASE_URL}/api/admin/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productNames: productName,
        supplier: 'Switzerland Imports',
        quantity: restockQty,
        cost: restockCost
      })
    });
    if (!procurementRes.ok) {
      const errText = await procurementRes.text();
      throw new Error(`B2B procurement failed: ${errText}`);
    }
    const purchaseRecord = await procurementRes.json();
    console.log('B2B procurement purchase recorded:', purchaseRecord);

    // 6. Verify that stock count increased
    console.log('\nStep 6: Verifying product stock update...');
    const productsRes = await fetch(`${BASE_URL}/api/products`);
    const products = await productsRes.json();
    const updatedProduct = products.find(p => p.id === newProduct.id);
    if (!updatedProduct) throw new Error('Updated product not found in catalog');
    console.log(`Initial Stock: 10, Restocked: ${restockQty}`);
    console.log('Updated product details from server:', updatedProduct);
    if (updatedProduct.stock === 60) {
      console.log('SUCCESS: Stock count correctly updated to 60!');
    } else {
      console.error(`FAILURE: Expected stock to be 60, but got ${updatedProduct.stock}`);
    }

    // 7. Verify KPIs update
    console.log('\nStep 7: Verifying KPI updates...');
    const updatedKpiRes = await fetch(`${BASE_URL}/api/admin/sales-summary`);
    const updatedKpi = await updatedKpiRes.json();
    console.log('Updated KPIs:', updatedKpi);
    
    const kpiDiff = updatedKpi.totalPurchases - initialKpi.totalPurchases;
    console.log(`Purchase cost difference: NPR ${kpiDiff} (Expected: NPR ${restockCost})`);
    if (kpiDiff === restockCost) {
      console.log('SUCCESS: B2B purchases recorded and total purchases updated in KPIs!');
    } else {
      console.error('FAILURE: KPI purchases did not update as expected.');
    }

    // 8. View system logs
    console.log('\nStep 8: Fetching latest system logs from server...');
    const logsRes = await fetch(`${BASE_URL}/api/logs`);
    const logs = await logsRes.json();
    console.log('Latest 5 logs:');
    logs.slice(0, 5).forEach(l => {
      console.log(`[${l.level.toUpperCase()}] ${l.timestamp} - ${l.event}: ${l.details}`);
    });

  } catch (error) {
    console.error('An error occurred during task automation:', error);
  }
}

run();
