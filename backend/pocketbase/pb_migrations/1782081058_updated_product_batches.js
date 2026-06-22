/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1341887345")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_product_batches_code` ON `product_batches` (`batch_code`)",
      "CREATE INDEX `idx_product_batches_product` ON `product_batches` (`product_id`)",
      "CREATE INDEX `idx_product_batches_expiry` ON `product_batches` (`expiration_date`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1341887345")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_product_batches_code` ON `product_batches` (`batch_code`)",
      "CREATE INDEX `idx_product_batches_product` ON `product_batches` (`product_id`)",
      "CREATE INDEX `idx_product_batches_expiry` ON `product_batches` (`expiration_date`)"
    ]
  }, collection)

  return app.save(collection)
})
