# Authorization Matrix

**Purpose:** Defines which user roles are allowed to trigger each state transition.

---

## Roles (from `users.role`)
- `super_admin`
- `admin`
- `employee`

---

| Transition | Allowed Roles |
|------------|---------------|
| **Sales** | |
| `draft` → `confirmed` | `admin`, `employee` (sales staff) |
| `confirmed` → `processing` | `admin`, `employee` |
| `processing` → `delivered` | `admin`, `employee` |
| `delivered` → `completed` | `admin` (or `employee` if payment confirmed) |
| `draft` → `cancelled` | `admin`, `employee` |
| `confirmed` → `cancelled` | `admin`, `employee` |
| `delivered` → `cancelled` | `admin` only |
| **Purchase** | |
| `draft` → `confirmed` | `purchase.confirm_order` |
| `confirmed` → `processing` | `purchase.confirm_order` |
| `processing` → `delivered` | `purchase.receive_order` |
| `delivered` → `cancelled` | `admin.override` only |
| **Production** | |
| `pending` → `in_progress` | `admin`, `employee` (production) |
| `in_progress` → `completed` | `admin`, `employee` |
| `completed` → `cancelled` | `admin` only |
| **Payroll** | |
| `draft` → `approved` | `admin` only |
| `approved` → `paid` | `admin` only |
| **Payments** | |
| `pending` → `confirmed` | `admin` (or cashier with `employee` role) |
| `confirmed` → `cancelled` | `admin` only |
| **Raw Milk** | |
| `pending` → `approved` | `admin`, `employee` (quality) |
| `pending` → `rejected` | `admin`, `employee` |

**Implementation Rule:**  
Each hook must check `e.auth.role` before allowing the transition. If the role is not authorized, throw a `ForbiddenError`.