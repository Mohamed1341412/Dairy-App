/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4092854851")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_products_sku` ON `products` (`sku`)",
      "CREATE UNIQUE INDEX `idx_products_barcode` ON `products` (`barcode`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4092854851")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_products_sku` ON `products` (`sku`)",
      "CREATE INDEX `idx_products_barcode` ON `products` (`barcode`)"
    ]
  }, collection)

  return app.save(collection)
})
