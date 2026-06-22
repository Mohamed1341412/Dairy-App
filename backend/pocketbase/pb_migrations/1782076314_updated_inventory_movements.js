/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4280990403")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_inventory_product` ON `inventory_movements` (`product_id`)",
      "CREATE INDEX `idx_inventory_batch` ON `inventory_movements` (`batch_id`)",
      "CREATE UNIQUE INDEX `idx_inventory_mov_ref` ON `inventory_movements` (`reference_number`)",
      "CREATE UNIQUE INDEX `idx_inventory_mov_sync` ON `inventory_movements` (`sync_id`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4280990403")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_inventory_product` ON `inventory_movements` (`product_id`)",
      "CREATE INDEX `idx_inventory_batch` ON `inventory_movements` (`batch_id`)",
      "CREATE INDEX `idx_inventory_mov_ref` ON `inventory_movements` (`reference_number`)",
      "CREATE INDEX `idx_inventory_mov_sync` ON `inventory_movements` (`sync_id`)"
    ]
  }, collection)

  return app.save(collection)
})
