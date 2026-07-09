/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1934478955")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_production_outputs_unique` ON `production_outputs` (`production_batch_id`, `product_id`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1934478955")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
