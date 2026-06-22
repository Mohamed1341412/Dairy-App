/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1787855659")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_material_movements_material` ON `material_movements` (`material_id`)",
      "CREATE INDEX `idx_material_movements_ref` ON `material_movements` (`reference_number`)",
      "CREATE INDEX `idx_material_movements_sync` ON `material_movements` (`sync_id`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1787855659")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_material_movements_material` ON `material_movements` (`material_id`)"
    ]
  }, collection)

  return app.save(collection)
})
