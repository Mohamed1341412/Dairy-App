/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4280990403")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_inventory_product` ON `inventory_movements` (`product_id`)",
      "CREATE INDEX `idx_inventory_batch` ON `inventory_movements` (`batch_id`)",
      "CREATE UNIQUE INDEX `idx_inventory_mov_ref` ON `inventory_movements` (`reference_number`)",
      "CREATE UNIQUE INDEX `idx_inventory_mov_sync` ON `inventory_movements` (`sync_id`)",
      "CREATE UNIQUE INDEX idx_inventory_movements_corrects ON inventory_movements (corrects_movement_id) WHERE corrects_movement_id != ''"
    ]
  }, collection)

  // add field
  collection.fields.addAt(15, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_4280990403",
    "help": "Reference to the original movement being corrected",
    "hidden": false,
    "id": "relation940563710",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "corrects_movement_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
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

  // remove field
  collection.fields.removeById("relation940563710")

  return app.save(collection)
})
