// pb_hooks/core/collections.pb.js

const Collections = {
  // Financial & Ledger (Immutable)
  TRANSACTIONS: 'transactions',
  PAYMENTS: 'payments',
  CLIENT_LEDGERS: 'client_ledgers',
  VENDOR_LEDGERS: 'vendor_ledgers',
  FINANCIAL_ACCOUNT_LEDGERS: 'financial_account_ledgers',

  // Inventory & Movements (Immutable/Strict)
  INVENTORY_MOVEMENTS: 'inventory_movements',
  MATERIAL_MOVEMENTS: 'material_movements',
  PRODUCT_BATCHES: 'product_batches',

  // Operational (Lockable)
  SALES_ORDERS: 'sales_orders',
  PURCHASE_ORDERS: 'purchase_orders',
  PAYROLL_RECORDS: 'payroll_records',

  // Assets & Entities (Stock Enforcement)
  PRODUCTS: 'products',
  MATERIALS: 'materials',
  WORKERS: 'workers',
  VENDORS: 'vendors',
  CLIENTS: 'clients',
  CARS: 'cars',
  EQUIPMENT: 'equipment',

  // Settings
  SYSTEM_SETTINGS: 'system_settings'
};

const MovementTypes = {
  PRODUCTION: 'production',
  SALE: 'sale',
  RETURN: 'return',
  ADJUSTMENT: 'adjustment',
  WASTE: 'waste'
};

const MovementDirections = {
  IN: 'in',
  OUT: 'out'
};

const TransactionDirections = {
  IN: 'in',
  OUT: 'out'
};

const TransactionStatus = {
  PENDING: 'pending',
  POSTED: 'posted',
  REVERSED: 'reversed',
  CANCELLED: 'cancelled'
};

const OrderStatus = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

module.exports = {
  Collections,
  MovementTypes,
  MovementDirections,
  TransactionDirections,
  TransactionStatus,
  OrderStatus
};
