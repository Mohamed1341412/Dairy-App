/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1359817730")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_production_inputs_batch` ON `production_inputs` (`production_batch_id`)",
      "CREATE UNIQUE INDEX `idx_production_inputs_unique` ON `production_inputs` (`production_batch_id`, `material_id`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1359817730")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_production_inputs_batch` ON `production_inputs` (`production_batch_id`)"
    ]
  }, collection)

  return app.save(collection)
})
