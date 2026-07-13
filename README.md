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


1. Toggle workspace view to **Admin Catalog**.
2. Create a new subcategory and upload a product with a custom image file.
3. Toggle workspace to **Super Admin Analytics**.
4. Restock items via B2B Procurement and verify B2B purchases are recorded, stock counts increase, and KPIs update.
