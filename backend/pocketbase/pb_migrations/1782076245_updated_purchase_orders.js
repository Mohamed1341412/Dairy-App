/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1342968361")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_purchase_orders_vendor` ON `purchase_orders` (`vendor_id`)",
      "CREATE UNIQUE INDEX `idx_purchase_orders_ref` ON `purchase_orders` (`reference_number`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1342968361")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_purchase_orders_vendor` ON `purchase_orders` (`vendor_id`)",
      "CREATE INDEX `idx_purchase_orders_ref` ON `purchase_orders` (`reference_number`)"
    ]
  }, collection)

  return app.save(collection)
})
