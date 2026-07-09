// pb_hooks/hooks/production/production_hooks.pb.js

const StockService = require(`${__hooks}/services/stock_service.pb.js`);
const MaterialService = require(`${__hooks}/services/material_service.pb.js`);
const ReferenceNumberService = require(
  `${__hooks}/services/reference_number_service.pb.js`,
);
const { AuditActions } = require(`${__hooks}/core/audit_actions.pb.js`);
const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`);
const { MovementTypes, MovementDirections } = require(
  `${__hooks}/core/collections.pb.js`,
);
const AuditService = require(`${__hooks}/services/audit_service.pb.js`);

/**
 * Production Hooks - Business Orchestrator (V2 - Final Production-Ready)
 *
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - Orchestrates production batch lifecycle only
 * - No financial calculations or ledger projections
 * - No transaction creation
 * - Cost calculation belongs to a future Cost Engine service
 *
 * ⚠️ LIFECYCLE:
 * pending → in_progress (reserve materials)
 * in_progress → completed (consume materials + produce products)
 * pending/in_progress → cancelled (release reservations if needed)
 *
 * ⚠️ ATOMICITY RULE:
 * All side effects happen in BeforeUpdate using e.dao to ensure atomicity.
 * All operations use the same transaction-scoped DAO.
 *
 * ⚠️ EXECUTION ORDER (Critical):
 * Consume: releaseReservation() → create movement → applyMovement()
 * This ensures: available = current - reserved always
 *
 * ⚠️ INVARIANT PROTECTION:
 * - Schema enforces uniqueness via Unique Indexes (production_inputs, production_outputs)
 * - Hook validates batch structure before execution
 * - Stock availability is validated during reserve() inside the same transaction
 * - output.batch_id is protected from double-linking
 */

// ==========================================
// CONSTANTS (Single Source of Truth)
// ==========================================

const PRODUCTION_BATCHES = "production_batches";
const PRODUCTION_INPUTS = "production_inputs";
const PRODUCTION_OUTPUTS = "production_outputs";
const PRODUCT_BATCHES = "product_batches";
const MATERIAL_MOVEMENTS = "material_movements";
const INVENTORY_MOVEMENTS = "inventory_movements";

const VALID_TRANSITIONS = Object.freeze({
  pending: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
});

// ==========================================
// LOCAL HELPERS (Reduce Duplication)
// ==========================================

/**
 * Helper: Log Audit Entry
 */
function logAudit(e, action, recordId, data) {
  AuditService.log({
    userId: AuditService.getUserId(e),
    action: action,
    operationType: OperationTypes.UPDATE,
    collectionName: PRODUCTION_BATCHES,
    recordId: recordId,
    newData: data,
  });
}

/**
 * Helper: Create and save Material Movement
 */
function createMaterialMovement(dao, options) {
  const movement = new $classes.Record(
    dao.findCollectionByNameOrId(MATERIAL_MOVEMENTS),
  );

  movement.set("material_id", options.materialId);
  movement.set("direction", options.direction);
  movement.set("quantity", options.qty);
  movement.set("movement_type", options.movementType);
  movement.set("business_date", options.businessDate);
  movement.set("reference_number", options.referenceNumber);

  dao.saveRecord(movement);
  return movement;
}

/**
 * Helper: Create and save Inventory Movement
 */
function createInventoryMovement(dao, options) {
  const movement = new $classes.Record(
    dao.findCollectionByNameOrId(INVENTORY_MOVEMENTS),
  );

  movement.set("product_id", options.productId);
  movement.set("direction", options.direction);
  movement.set("quantity", options.qty);
  movement.set("movement_type", options.movementType);
  movement.set("business_date", options.businessDate);
  movement.set("reference_number", options.referenceNumber);

  dao.saveRecord(movement);
  return movement;
}

/**
 * Helper: Create initial product batch with operational state
 * ⚠️ Note: unit_cost and total_cost are NOT set here.
 * They belong to a future Cost Engine service.
 */
function createInitialProductBatch(dao, options) {
  if (options.quantityProduced <= 0) {
    throw new Error(
      `Quantity produced must be positive. Got: ${options.quantityProduced}`,
    );
  }

  const batch = new $classes.Record(
    dao.findCollectionByNameOrId(PRODUCT_BATCHES),
  );

  batch.set("product_id", options.productId);
  batch.set("production_batch_id", options.productionBatchId);
  batch.set("batch_code", options.batchCode);
  batch.set("production_date", options.productionDate);
  batch.set("expiration_date", options.expirationDate);
  batch.set("quantity_produced", options.quantityProduced);
  batch.set("quantity_remaining", options.quantityProduced);
  batch.set("status", "active");

  dao.saveRecord(batch);
  return batch;
}

/**
 * Helper: Assert batch can start production
 * ⚠️ Validates batch structure only.
 * Stock availability is validated during MaterialService.reserve()
 * inside the same transaction (atomic rollback if any fails).
 */
function assertBatchCanStart(dao, batchId) {
  const inputs = dao.findRecordsByFilter(
    PRODUCTION_INPUTS,
    `production_batch_id = "${batchId}"`,
  );

  if (inputs.length === 0) {
    throw new Error(
      `Cannot start batch ${batchId}: No materials defined. Add production_inputs first.`,
    );
  }

  for (const input of inputs) {
    const qty = input.getFloat("quantity_used");
    if (qty <= 0) {
      throw new Error(
        `Cannot start batch ${batchId}: Input quantity must be positive. Got: ${qty} for material ${input.get("material_id")}`,
      );
    }
  }
}

/**
 * Helper: Load and validate batch data for completion
 * ⚠️ This is NOT a pure Assert - it loads data, validates, and returns it.
 * ⚠️ Business Invariants:
 * - At least one input exists
 * - At least one output exists
 * - All quantities are positive
 */
function loadBatchCompletionData(dao, batchId) {
  const inputs = dao.findRecordsByFilter(
    PRODUCTION_INPUTS,
    `production_batch_id = "${batchId}"`,
  );
  const outputs = dao.findRecordsByFilter(
    PRODUCTION_OUTPUTS,
    `production_batch_id = "${batchId}"`,
  );

  if (inputs.length === 0) {
    throw new Error(
      `Cannot complete batch ${batchId}: No materials consumed. Add production_inputs first.`,
    );
  }

  if (outputs.length === 0) {
    throw new Error(
      `Cannot complete batch ${batchId}: No products produced. Add production_outputs first.`,
    );
  }

  for (const input of inputs) {
    const qty = input.getFloat("quantity_used");
    if (qty <= 0) {
      throw new Error(
        `Cannot complete batch ${batchId}: Input quantity must be positive.`,
      );
    }
  }

  for (const output of outputs) {
    const qty = output.getFloat("quantity_produced");
    if (qty <= 0) {
      throw new Error(
        `Cannot complete batch ${batchId}: Output quantity must be positive.`,
      );
    }
  }

  return { inputs, outputs };
}

/**
 * Helper: Assert batch is in pending status (for inputs/outputs protection)
 */
function assertPendingBatch(dao, batchId, action) {
  const batch = dao.findRecordById(PRODUCTION_BATCHES, batchId);
  const status = batch.get("status");

  if (status !== "pending") {
    const actionWord = action === "modify" ? "modified" : "deleted";
    throw new Error(
      `Cannot ${action} inputs/outputs of a ${status} production batch. Only pending batches can have inputs/outputs ${actionWord}.`,
    );
  }
}

// ==========================================
// 1. BEFORE CREATE: Production Code Generation
// ==========================================

onRecordBeforeCreateRequest((e) => {
  if (!e.record.get("production_code")) {
    e.record.set("production_code", ReferenceNumberService.generate("PROD"));
  }
  if (!e.record.get("status")) {
    e.record.set("status", "pending");
  }
}, PRODUCTION_BATCHES);

// ==========================================
// 2. BEFORE UPDATE: Status Transition & Side Effects
// ==========================================

onRecordBeforeUpdateRequest((e) => {
  const dao = e.dao;
  const oldStatus = e.oldRecord.get("status");
  const newStatus = e.record.get("status");

  if (oldStatus === newStatus) return;

  // A. Validate Status Transitions
  if (!VALID_TRANSITIONS[oldStatus]?.includes(newStatus)) {
    throw new Error(
      `Invalid status transition from '${oldStatus}' to '${newStatus}'.`,
    );
  }

  // B. Execute Side Effects Based on Transition
  const batchId = e.record.id;
  const productionCode = e.record.get("production_code");
  const businessDate = e.record.get("production_date");

  // ==========================================
  // EVENT: Pending → In Progress (Reserve Materials)
  // ==========================================
  if (oldStatus === "pending" && newStatus === "in_progress") {
    // ✅ Validate batch structure only
    assertBatchCanStart(dao, batchId);

    const inputs = dao.findRecordsByFilter(
      PRODUCTION_INPUTS,
      `production_batch_id = "${batchId}"`,
    );

    // Reserve all materials (stock availability validated here, atomic rollback if any fails)
    for (const input of inputs) {
      const materialId = input.get("material_id");
      const qty = input.getFloat("quantity_used");
      MaterialService.reserve(dao, materialId, qty);
    }

    logAudit(e, AuditActions.PRODUCTION_BATCH_STARTED, batchId, {
      status: "in_progress",
      production_code: productionCode,
    });
  }

  // ==========================================
  // EVENT: In Progress → Completed (Consume Materials + Produce Products)
  // ==========================================
  else if (oldStatus === "in_progress" && newStatus === "completed") {
    // ✅ Load + Validate + Return data
    const { inputs, outputs } = loadBatchCompletionData(dao, batchId);

    // 1. Consume Materials
    // ⚠️ CRITICAL ORDER: release → create movement → apply
    for (const input of inputs) {
      const materialId = input.get("material_id");
      const qty = input.getFloat("quantity_used");

      // Step 1: Release reservation
      MaterialService.releaseReservation(dao, materialId, qty);

      // Step 2: Create material movement
      const movement = createMaterialMovement(dao, {
        materialId: materialId,
        direction: MovementDirections.OUT,
        qty: qty,
        movementType: MovementTypes.PRODUCTION_CONSUMPTION,
        businessDate: businessDate,
        referenceNumber: productionCode,
      });

      // Step 3: Apply material projection
      MaterialService.applyMovement(dao, movement);
    }

    // 2. Produce Products
    for (const output of outputs) {
      const productId = output.get("product_id");
      const qty = output.getFloat("quantity_produced");

      // ✅ Invariant Protection: Prevent double-linking
      if (output.get("batch_id")) {
        throw new Error(
          `Production output ${output.id} is already linked to a product batch.`,
        );
      }

      // Create inventory movement
      const movement = createInventoryMovement(dao, {
        productId: productId,
        direction: MovementDirections.IN,
        qty: qty,
        movementType: MovementTypes.PRODUCTION,
        businessDate: businessDate,
        referenceNumber: productionCode,
      });

      // Apply stock projection
      StockService.applyMovement(dao, movement);

      // Create product_batch
      const expirationDate = e.record.get("expiration_date") || businessDate;
      const productBatch = createInitialProductBatch(dao, {
        productId: productId,
        productionBatchId: batchId,
        batchCode: `${productionCode}-${productId.substring(0, 6)}`,
        productionDate: businessDate,
        expirationDate: expirationDate,
        quantityProduced: qty,
      });

      // Link batch to output (Atomicity: same dao)
      output.set("batch_id", productBatch.id);
      dao.saveRecord(output);
    }

    logAudit(e, AuditActions.PRODUCTION_BATCH_COMPLETED, batchId, {
      status: "completed",
    });
  }

  // ==========================================
  // EVENT: Pending/In Progress → Cancelled (Release Reservations)
  // ==========================================
  else if (newStatus === "cancelled") {
    if (oldStatus === "in_progress") {
      const inputs = dao.findRecordsByFilter(
        PRODUCTION_INPUTS,
        `production_batch_id = "${batchId}"`,
      );

      for (const input of inputs) {
        const materialId = input.get("material_id");
        const qty = input.getFloat("quantity_used");
        MaterialService.releaseReservation(dao, materialId, qty);
      }
    }

    logAudit(e, AuditActions.PRODUCTION_BATCH_CANCELLED, batchId, {
      status: "cancelled",
    });
  }
}, PRODUCTION_BATCHES);

// ==========================================
// 3. PROTECT INPUTS/OUTPUTS: Update & Delete After Pending
// ==========================================

onRecordBeforeUpdateRequest(
  (e) => {
    if (
      e.collection.name === PRODUCTION_INPUTS ||
      e.collection.name === PRODUCTION_OUTPUTS
    ) {
      const batchId = e.record.get("production_batch_id");
      assertPendingBatch(e.dao, batchId, "modify");
    }
  },
  PRODUCTION_INPUTS,
  PRODUCTION_OUTPUTS,
);

onRecordBeforeDeleteRequest(
  (e) => {
    if (
      e.collection.name === PRODUCTION_INPUTS ||
      e.collection.name === PRODUCTION_OUTPUTS
    ) {
      const batchId = e.record.get("production_batch_id");
      assertPendingBatch(e.dao, batchId, "delete");
    }
  },
  PRODUCTION_INPUTS,
  PRODUCTION_OUTPUTS,
);

// ==========================================
// 4. PROTECT PRODUCTION BATCHES: Delete Protection
// ==========================================

onRecordBeforeDeleteRequest((e) => {
  if (e.collection.name === PRODUCTION_BATCHES) {
    const status = e.record.get("status");
    if (status !== "pending") {
      throw new Error(
        `Cannot delete a ${status} production batch. Only pending batches can be deleted.`,
      );
    }
  }
}, PRODUCTION_BATCHES);

// ==========================================
// 5. PROTECT PRODUCTION BATCHES: Immutability Guard
// ==========================================

/**
 * Hook منفصل لحماية الحقول الأساسية بعد الإكمال أو الإلغاء.
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - هذا Hook مستقل عن Status Transition Hook (القسم 2)
 * - دوره الوحيد: منع تعديل الحقول الأساسية بعد اكتمال الدورة
 * - لا ينفذ أي Side Effects
 */
onRecordBeforeUpdateRequest((e) => {
  if (e.collection.name !== "production_batches") return;

  const oldStatus = e.oldRecord.get("status");

  // ✅ إذا كان batch مكتمل أو ملغي، لا يُسمح بتعديل الحقول الأساسية
  if (oldStatus === "completed" || oldStatus === "cancelled") {
    const immutableFields = [
      "production_date",
      "expiration_date",
      "production_code",
    ];

    for (const field of immutableFields) {
      if (e.oldRecord.get(field) !== e.record.get(field)) {
        throw new Error(
          `Field '${field}' is immutable on ${oldStatus} production batches.`,
        );
      }
    }
  }
}, "production_batches");
