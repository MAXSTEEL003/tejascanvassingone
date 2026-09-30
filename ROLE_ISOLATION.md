# Role Isolation Architecture & Security Specification

**Application:** Tejas Canvassing Platform  
**Status:** Implemented & Verified  
**Scope:** Strict separation between authenticated application roles.

---

## 1. Supported Authenticated Roles

The Tejas Canvassing platform strictly supports **three** authenticated application roles:

| Role | Identifier | Description | Default Landing |
| :--- | :--- | :--- | :--- |
| **Administrator** | `'admin'` | Global executive access, financial ledgers, patti calculation, payments aging, user accounts, placed contracts | `/admin` |
| **Operations Staff** | `'employee'` | Field operations, grain warehouse catalog, work schedule/tasks, arrival records | `/inventory` |
| **Merchant / Buyer** | `'merchant'` | Wholesale grain browsing, shopping bag, order tracking, brokerage receipts, company KYC | `/store` |

### Explicit Non-Role: Suppliers & Millers
> **CRITICAL ARCHITECTURAL GUARANTEE:**  
> **There is NO supplier/miller login, UI, role, or dashboard.**  
> Suppliers and millers are commercial business entities managed by Admin and Staff in database records. They are **never** granted authenticated application accounts or login access.

---

## 2. Route Access Control Matrix

Route protection is enforced at both the router layer (`RouteGuards.tsx` in `App.tsx`) and the layout containment layer (`MainLayoutContent` in `MainLayout.tsx`).

| Route Path | View / Component | Admin (`'admin'`) | Staff (`'employee'`) | Merchant (`'merchant'`) | Unauthenticated |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `/` or `/about` | `AboutView` | Allowed | Allowed | Allowed | Allowed |
| `/login` | `LoginView` | Allowed | Allowed | Allowed | Allowed |
| `/employee-login` | `LoginView (employee)` | Allowed | Allowed | Allowed | Allowed |
| `/admin` & `/dashboard` | `OrdersDashboard` | **Allowed** | Redirect -> `/inventory` | Redirect -> `/store` | Redirect -> `/login?portal=admin` |
| `/placed-orders` | `PlacedOrders (Admin)` | **Allowed** | Redirect -> `/inventory` | Redirect -> `/store` | Redirect -> `/login?portal=admin` |
| `/order/:id` | `OrderDetails` | **Allowed** | Redirect -> `/inventory` | Redirect -> `/store` | Redirect -> `/login?portal=admin` |
| `/payments` | `PaymentTracking` | **Allowed** | Redirect -> `/inventory` | Redirect -> `/store` | Redirect -> `/login?portal=admin` |
| `/ledger` | `LedgerManagement` | **Allowed** | Redirect -> `/inventory` | Redirect -> `/store` | Redirect -> `/login?portal=admin` |
| `/pending-loadings` | `PendingLoadings` | **Allowed** | Redirect -> `/inventory` | Redirect -> `/store` | Redirect -> `/login?portal=admin` |
| `/patti` | `PattiView` | **Allowed** | Redirect -> `/inventory` | Redirect -> `/store` | Redirect -> `/login?portal=admin` |
| `/users` | `UsersManagement` | **Allowed** | Redirect -> `/inventory` | Redirect -> `/store` | Redirect -> `/login?portal=admin` |
| `/analytics` | `AnalyticsDashboard` | **Allowed** | Redirect -> `/inventory` | Redirect -> `/store` | Redirect -> `/login?portal=admin` |
| `/settings` | `NotificationSettings` | **Allowed** | Redirect -> `/inventory` | Redirect -> `/store` | Redirect -> `/login?portal=admin` |
| `/inventory` | `ProductInventory` | **Allowed** | **Allowed** | Redirect -> `/store` | Redirect -> `/login?portal=employee` |
| `/schedule` & `/tasks` | `TasksManagement` | **Allowed** | **Allowed** | Redirect -> `/store` | Redirect -> `/login?portal=employee` |
| `/arrival-entry` | `ArrivalEntry` | **Allowed** | **Allowed** | Redirect -> `/store` | Redirect -> `/login?portal=employee` |
| `/store` & `/shop` | `StoreManagement` | Redirect -> `/admin` | Redirect -> `/inventory` | **Allowed** | **Allowed (Public Catalog)** |
| `/bag` & `/cart` | `BagView` | Redirect -> `/admin` | Redirect -> `/inventory` | **Allowed** | Redirect -> `/login?portal=merchant` |
| `/checkout` | `CheckoutView` | Redirect -> `/admin` | Redirect -> `/inventory` | **Allowed** | Redirect -> `/login?portal=merchant` |
| `/my-orders` | `PlacedOrders (Merchant)` | Redirect -> `/admin` | Redirect -> `/inventory` | **Allowed** | Redirect -> `/login?portal=merchant` |
| `/brokerage` | `BrokerageView` | Redirect -> `/admin` | Redirect -> `/inventory` | **Allowed** | Redirect -> `/login?portal=merchant` |
| `/profile` | `ProfileView` | Redirect -> `/admin` | Redirect -> `/inventory` | **Allowed** | Redirect -> `/login?portal=merchant` |

---

## 3. Direct URL Access Handling

1. **If an Admin tries to open a Merchant URL (e.g. `/store`, `/bag`, `/my-orders`):**  
   - `MerchantRoute` intercepts the navigation.  
   - Admin is immediately redirected to `/admin`. Admin never sees consumer shopping carts, bags, or merchant headers.

2. **If a Merchant tries to open an Admin URL (e.g. `/admin`, `/ledger`, `/patti`, `/payments`, `/placed-orders`):**  
   - `AdminRoute` intercepts the request.  
   - Merchant is immediately redirected to `/store`.  
   - Even if the route layer were bypassed, `MainLayoutContent` validates allowed paths and kicks the merchant back to `/store`.

3. **If a Staff member tries to open an Admin URL (e.g. `/admin`, `/ledger`, `/users`):**  
   - `AdminRoute` intercepts the navigation.  
   - Staff is immediately redirected to `/inventory`.

4. **If an Unauthenticated user tries to open a protected URL:**  
   - Admin routes redirect to `/login?portal=admin`.  
   - Staff routes redirect to `/login?portal=employee`.  
   - Merchant consumer routes (`/bag`, `/checkout`, `/profile`) redirect to `/login?portal=merchant`.

---

## 4. Component-Level Barriers

- **`AdminRoute`:** Guards all corporate administration views. Validates cryptographic JWT claims and verified role.
- **`StaffRoute`:** Guards operations views (`/inventory`, `/schedule`, `/tasks`, `/arrival-entry`). Permits Staff and Admin supervisory access.
- **`MerchantRoute`:** Guards merchant views. Protects customer shopping state and personal procurement orders.
- **`MainLayoutContent`:** Enforces distinct headers and bottom navigation:
  - **Admin:** Renders `Sidebar` + executive `Navbar`. Never renders `MerchantHeader`, `MerchantBottomBar`, or `EmployeeHeader`.
  - **Staff:** Renders `EmployeeHeader` + `EmployeeBottomBar`. Never renders executive sidebar or merchant carts.
  - **Merchant:** Renders `MerchantHeader` + `MerchantBottomBar`. Never renders internal operations or executive tooling.
- **`CommandPalette` (`Ctrl+K`):**
  - Navigation shortcuts dynamically filter based on active verified role.
  - Indexed data partitions strictly: Merchants only search products and their own personal orders. Staff only search products and arrival entries. Only Admin searches corporate contracts and global ledgers.

---

## 5. Data Access Barriers (Firestore & Fallback)

Inside `src/lib/firebase.ts`, `getCollectionDocs`, `getSingleDoc`, `setCollectionDoc`, `addCollectionDoc`, and `deleteCollectionDoc` enforce client-side query and write firewalls:

| Collection | Merchant Access | Staff Access | Admin Access |
| :--- | :---: | :---: | :---: |
| `ledgers` | **FORBIDDEN (Returns `[]`)** | **FORBIDDEN (Returns `[]`)** | Full Access |
| `patti` / `patti_history` | **FORBIDDEN (Returns `[]`)** | **FORBIDDEN (Returns `[]`)** | Full Access |
| `pending_loadings` | **FORBIDDEN (Returns `[]`)** | **FORBIDDEN (Returns `[]`)** | Full Access |
| `users` | **FORBIDDEN (Returns `[]`)** | **FORBIDDEN (Returns `[]`)** | Full Access |
| `arrival_entries` | **FORBIDDEN (Returns `[]`)** | Read / Write | Full Access |
| `placed_orders` | **FORBIDDEN (Direct queries blocked)** | Read / Update dispatch | Full Access |
| `procurement_requests` | Read / Create Own Orders | Read / Update | Full Access |
| `product_inventory` | Read-Only Catalog | Read / Write | Full Access |
| `stakeholders` | **Own Profile Only (`getSingleDoc`)** | Read Directory | Full Access |

---

## 6. Secure Logout & State Wipe Strategy

To eliminate cross-role state leakage when switching users on the same machine, `performSecureLogout()` in `src/lib/auth.ts`:

1. Signs out of Firebase Auth (`signOut(auth)`).
2. Deletes signed authentication tokens: `tejas_auth_token_v1`, `tejas_auth_user_v1`.
3. Purges all Admin & Staff operational cache:
   - `placed_orders`, `procurement_requests`, `ledgers`, `patti_history`
   - `arrival_entry_data_v4`, `arrival_entry_sheets_v4`, `lifting_entries_v1`
   - `stakeholders_v2`, `stakeholders`, `users_stakeholders`
4. Purges all Merchant consumer cache:
   - `cart`, `store_cart`, `cart_items`
   - `merchant_delivery_locations`, `selected_delivery_location_id`
   - `user_wishlist`, `local_orders`
5. Clears `sessionStorage`.
6. Dispatches `role-changed` and `storage` global events to force immediate unmounting of protected layouts across open components.

---

## 7. Multi-Tab Dynamics

- Firebase Authentication stores authentication state in browser-level IndexedDB shared across all tabs of the origin.
- When an account logs out or signs in with a different role on Tab 2:
  1. The `storage` and `role-changed` window listeners trigger on Tab 1.
  2. `RouteGuards` on Tab 1 re-evaluate `getVerifiedUserRole()`.
  3. If the role changed or became null, Tab 1 instantly navigates away from the forbidden route to the newly appropriate portal or login screen.
  4. Local cache of the previous role is completely erased, preventing Tab 1 from reading stale sensitive state.

---

## 8. Verification Results

All role isolation mechanisms were tested via automated test runner (`scratch/test_role_isolation.mjs`):

- **Token Validation & Anti-Spoofing:** Tested. Setting raw `localStorage.userRole="admin"` without valid signed token returns `null`.
- **Route Guard Access Control Matrix:** Tested. All redirect rules verified for Admin, Staff, Merchant, and Anonymous callers.
- **Data Query Boundary Enforcement:** Tested. Blocked collections return empty arrays with zero data exposure.
- **Secure Logout State Wipe:** Tested. All 27 sensitive keys completely removed.
- **Supplier/Miller Role Check:** Verified non-existence of supplier login/roles.
