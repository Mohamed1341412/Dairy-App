// pb_hooks/hooks/production/production_hooks.pb.js

const StockService = require(`${__hooks}/services/stock_service.pb.js`);
const MaterialService = require(`${__hooks}/services/material_service.pb.js`);
const ReferenceNumberService = require(
  `${__hooks}/services/reference_number_service.pb.js`,
);
const { AuditActions } = require(`${__hooks}/core/audit_actions.pb.js`);
const { OperationTypes } = require(`${__hooks}/core/operation_types.pb.js`);
const AuditService = require(`${__hooks}/services/audit_service.pb.js`);

/**
 * Production Hooks - Business Orchestrator (V1)
 *
 * ⚠️ ARCHITECTURAL BOUNDARY:
 * - ينسق دورة حياة أمر الإنتاج فقط
 * - لا يقوم بأي حسابات مالية أو تحليلية
 * - لا ينشئ transactions أو ledger entries
 *
 * ⚠️ LIFECYCLE:
 * pending → in_progress (reserve materials)
 * in_progress → completed (consume materials + produce products)
 * pending/in_progress → cancelled (release reservations if needed)
 *
 * ⚠️ ATOMICITY RULE:
 * جميع العمليات الجانبية تتم في BeforeUpdate لضمان الذرية.
 *
 * ⚠️ EXECUTION ORDER (Critical):
 * عند الاستهلاك: releaseReservation() → create movement → applyMovement()
 * هذا يضمن: available = current - reserved دائماً
 */

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
}, "production_batches");

// ==========================================
// 2. BEFORE UPDATE: Status Transition & Side Effects
// ==========================================
onRecordBeforeUpdateRequest((e) => {
  const oldStatus = e.oldRecord.get("status");
  const newStatus = e.record.get("status");

  if (oldStatus === newStatus) return;

  // A. Validate Status Transitions
  const validTransitions = {
    pending: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };

  if (!validTransitions[oldStatus]?.includes(newStatus)) {
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
    const inputs = $app
      .dao()
      .findRecordsByFilter(
        "production_inputs",
        `production_batch_id = "${batchId}"`,
      );

    // Reserve all materials
    for (const input of inputs) {
      const materialId = input.get("material_id");
      const qty = input.getFloat("quantity_used");

      MaterialService.reserve($app.dao(), materialId, qty);
    }

    AuditService.log({
      userId: AuditService.getUserId(e),
      action: AuditActions.PRODUCTION_BATCH_STARTED,
      operationType: OperationTypes.UPDATE,
      collectionName: "production_batches",
      recordId: batchId,
      newData: { status: "in_progress", production_code: productionCode },
    });
  }

  // ==========================================
  // EVENT: In Progress → Completed (Consume Materials + Produce Products)
  // ==========================================
  else if (oldStatus === "in_progress" && newStatus === "completed") {
    const inputs = $app
      .dao()
      .findRecordsByFilter(
        "production_inputs",
        `production_batch_id = "${batchId}"`,
      );
    const outputs = $app
      .dao()
      .findRecordsByFilter(
        "production_outputs",
        `production_batch_id = "${batchId}"`,
      );

    // 1. Consume Materials
    // ⚠️ CRITICAL ORDER: release → create movement → apply
    for (const input of inputs) {
      const materialId = input.get("material_id");
      const qty = input.getFloat("quantity_used");

      // Step 1: Release reservation
      MaterialService.releaseReservation($app.dao(), materialId, qty);

      // Step 2: Create material movement
      const movementCollection = $app
        .dao()
        .findCollectionByNameOrId("material_movements");
      const movement = new $classes.Record(movementCollection);
      movement.set("material_id", materialId);
      movement.set("direction", "out");
      movement.set("quantity", qty);
      movement.set("movement_type", "production_consumption");
      movement.set("business_date", businessDate);
      movement.set("reference_number", productionCode);
      $app.dao().saveRecord(movement);

      // Step 3: Apply material projection
      MaterialService.applyMovement($app.dao(), movement);
    }

    // 2. Produce Products
    for (const output of outputs) {
      const productId = output.get("product_id");
      const qty = output.getFloat("quantity_produced");

      // Create inventory movement
      const movementCollection = $app
        .dao()
        .findCollectionByNameOrId("inventory_movements");
      const movement = new $classes.Record(movementCollection);
      movement.set("product_id", productId);
      movement.set("direction", "in");
      movement.set("quantity", qty);
      movement.set("movement_type", "production");
      movement.set("business_date", businessDate);
      movement.set("reference_number", productionCode);
      $app.dao().saveRecord(movement);

      // Apply stock projection
      StockService.applyMovement($app.dao(), movement);

      // Create product_batch
      const batchCollection = $app
        .dao()
        .findCollectionByNameOrId("product_batches");
      const productBatch = new $classes.Record(batchCollection);
      productBatch.set("product_id", productId);
      productBatch.set("production_batch_id", batchId);
      productBatch.set(
        "batch_code",
        `${productionCode}-${productId.substring(0, 6)}`,
      );
      productBatch.set("production_date", businessDate);

      // expiration_date: use from production_batches if provided, otherwise use production_date as fallback
      const expirationDate = e.record.get("expiration_date");
      if (expirationDate) {
        productBatch.set("expiration_date", expirationDate);
      } else {
        // Fallback: use production_date (user should update it later)
        productBatch.set("expiration_date", businessDate);
      }

      productBatch.set("quantity_produced", qty);
      productBatch.set("quantity_remaining", qty);
      productBatch.set("status", "active");
      $app.dao().saveRecord(productBatch);

      // Link batch to output
      output.set("batch_id", productBatch.id);
      $app.dao().saveRecord(output);
    }

    AuditService.log({
      userId: AuditService.getUserId(e),
      action: AuditActions.PRODUCTION_BATCH_COMPLETED,
      operationType: OperationTypes.UPDATE,
      collectionName: "production_batches",
      recordId: batchId,
      newData: { status: "completed" },
    });
  }

  // ==========================================
  // EVENT: Pending/In Progress → Cancelled (Release Reservations)
  // ==========================================
  else if (newStatus === "cancelled") {
    // If in_progress, release material reservations
    if (oldStatus === "in_progress") {
      const inputs = $app
        .dao()
        .findRecordsByFilter(
          "production_inputs",
          `production_batch_id = "${batchId}"`,
        );

      for (const input of inputs) {
        const materialId = input.get("material_id");
        const qty = input.getFloat("quantity_used");

        MaterialService.releaseReservation($app.dao(), materialId, qty);
      }
    }

    AuditService.log({
      userId: AuditService.getUserId(e),
      action: AuditActions.PRODUCTION_BATCH_CANCELLED,
      operationType: OperationTypes.UPDATE,
      collectionName: "production_batches",
      recordId: batchId,
      newData: { status: "cancelled" },
    });
  }
}, "production_batches");

// ==========================================
// 3. PROTECT INPUTS/OUTPUTS: Update & Delete After Pending
// ==========================================

// Prevent modifying inputs after production starts
onRecordBeforeUpdateRequest((e) => {
  if (e.collection.name === "production_inputs") {
    const batchId = e.record.get("production_batch_id");
    try {
      const batch = $app.dao().findRecordById("production_batches", batchId);
      const status = batch.get("status");

      if (status !== "pending") {
        throw new Error(
          `Cannot modify inputs of a ${status} production batch. Only pending batches can have inputs modified.`,
        );
      }
    } catch (err) {
      if (err.message.includes("Cannot modify inputs")) throw err;
      throw new Error(`Production batch not found: ${batchId}`);
    }
  }
}, "production_inputs");

// Prevent deleting inputs after production starts
onRecordBeforeDeleteRequest((e) => {
  if (e.collection.name === "production_inputs") {
    const batchId = e.record.get("production_batch_id");
    try {
      const batch = $app.dao().findRecordById("production_batches", batchId);
      const status = batch.get("status");

      if (status !== "pending") {
        throw new Error(
          `Cannot delete inputs from a ${status} production batch. Only pending batches can have inputs deleted.`,
        );
      }
    } catch (err) {
      if (err.message.includes("Cannot delete inputs")) throw err;
      throw new Error(`Production batch not found: ${batchId}`);
    }
  }
}, "production_inputs");

// Prevent modifying outputs after production starts
onRecordBeforeUpdateRequest((e) => {
  if (e.collection.name === "production_outputs") {
    const batchId = e.record.get("production_batch_id");
    try {
      const batch = $app.dao().findRecordById("production_batches", batchId);
      const status = batch.get("status");

      if (status !== "pending") {
        throw new Error(
          `Cannot modify outputs of a ${status} production batch. Only pending batches can have outputs modified.`,
        );
      }
    } catch (err) {
      if (err.message.includes("Cannot modify outputs")) throw err;
      throw new Error(`Production batch not found: ${batchId}`);
    }
  }
}, "production_outputs");

// Prevent deleting outputs after production starts
onRecordBeforeDeleteRequest((e) => {
  if (e.collection.name === "production_outputs") {
    const batchId = e.record.get("production_batch_id");
    try {
      const batch = $app.dao().findRecordById("production_batches", batchId);
      const status = batch.get("status");

      if (status !== "pending") {
        throw new Error(
          `Cannot delete outputs from a ${status} production batch. Only pending batches can have outputs deleted.`,
        );
      }
    } catch (err) {
      if (err.message.includes("Cannot delete outputs")) throw err;
      throw new Error(`Production batch not found: ${batchId}`);
    }
  }
}, "production_outputs");

// ==========================================
// 4. PROTECT PRODUCTION BATCHES: Delete Protection
// ==========================================

// Prevent deleting production batches that are not pending
onRecordBeforeDeleteRequest((e) => {
  if (e.collection.name === "production_batches") {
    const status = e.record.get("status");

    if (status !== "pending") {
      throw new Error(
        `Cannot delete a ${status} production batch. Only pending batches can be deleted.`,
      );
    }
  }
}, "production_batches");
