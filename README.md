# Ghumti Express - Nepal Digital Payments & Fulfillment Integration

Ghumti Express is a B2C quick-commerce demonstration platform for liquor, groceries, and coffee. It incorporates localized payment validation rules (Nepal Rastra Bank NPR compliance) alongside a localized warehouse/barista picking split and age verification delivery handoff.

---

## Technical Features

1. **Anti-Tampering Payment Verifications (eSewa & Khalti V2):**
   - **eSewa (ePay v2):** Backend generates an `HMAC-SHA256` signature based on the concatenation string `total_amount,transaction_uuid,product_code` using a sandbox secret key. The callback base64 `data` parameter is decoded and signature checks are re-evaluated server-to-server.
   - **Khalti:** Backend initializes checkout to get a `pidx` token and redirects. Callback query parameters trigger a direct server-to-server POST verification query (`/api/v2/epayment/lookup/`) using auth headers to confirm transaction completion status.
2. **Dynamic Logistical splits:**
   - Orders containing groceries and liquor split directly to the Warehouse Picking Queue.
   - Orders containing coffee items split directly to the Barista Coffee Station.
3. **Legal Age Validation & Delivery lock:**
   - Restricts underage users (under 18) from adding alcohol items to their cart.
   - Enforces a driver lock prompt on doorstep handoffs for alcohol, requiring identification details (License, Citizenship, or Passport) and checkbox confirmation.
4. **Role-Based Workspaces (Admin & Super Admin):**
   - **Admin:** Manages catalog by creating categories, subcategories, and uploading products with multipart file uploads (image files).
   - **Super Admin:** Monitors financial analytics (margins, sales, purchases), supply restocking procurement orders, transaction entries, and real-time security warnings.

---

## Quick Start

### 1. Installation
Install project dependencies:
```bash
npm install
```

### 2. Start the Server
Run the local Express server (defaults to port 5000):
```bash
npm start
```
Open your browser and navigate to:
```
http://localhost:5000
```

---

## Interactive Walkthrough Scenarios

To demonstrate the full capability of the system, toggle your workspace role in the upper-right corner:

### Scenario A: Clean Customer Checkout & eSewa Payment
1. Register a new user account with a valid date of birth (greater than 18 years old).
2. Login and add items to your cart (e.g. Whiskey, Coffee beans).
3. Click "Proceed to Pay" in the cart drawer.
4. Select **eSewa** gateway. This redirects you to a simulated eSewa payment page.
5. Review the transaction UUID and amount. Click **Authenticate & Complete Payment**.
6. The gateway redirects you back. The backend decodes the response base64 parameter, re-computes the HMAC-SHA256 signature, validates the amount matches the database, and flags success.

### Scenario B: eSewa Price Tampering Protection
1. Place another order and choose **eSewa**.
2. Inside the eSewa simulator, check the **"Modify amount to NPR 1.00"** tampering simulation box.
3. Click **Authenticate & Complete Payment**.
4. The callback endpoint intercepts the request, computes the signature against the altered amount, triggers a **HMAC Signature Mismatch Alert** in the Security Audit Console at the bottom of the screen, cancels the order, and redirects to a failure screen.

### Scenario C: Khalti Lookup Status Verification
1. Add items and choose **Khalti**.
2. Select **User canceled** inside the callback status selector.
3. Verify the server-to-server check flags the canceled lookup, prevents stock deduction, and logs the canceled transaction in the audit console.

### Scenario D: Logistics splitting & Delivery Verification
1. Log in and buy a bundle of Whiskey (Liquor) and Fresh Coffee (Coffee).
2. Complete a valid payment.
3. Toggle workspace view to **Rider & In-Store Operations**.
4. Observe the order has been split:
   - Whiskey is in the **Grocery/Liquor Warehouse Picking queue**. Click "Mark Packed & Dispatched".
   - Coffee is in the **Barista Queue**. Click "Mark Brewed & Ready".
5. Once both queues are packed, the order enters the **Rider Delivery Handoff screen**.
6. Because the order contains Whiskey (Age Restricted), the rider screen blocks delivery, requiring input of a photo ID type, document number, and a legal age confirmation check before finalizing delivery.

### Scenario E: Admin Catalog & Super Admin Margins
1. Toggle workspace view to **Admin Catalog**.
2. Create a new subcategory and upload a product with a custom image file.
3. Toggle workspace to **Super Admin Analytics**.
4. Restock items via B2B Procurement and verify B2B purchases are recorded, stock counts increase, and KPIs update.
