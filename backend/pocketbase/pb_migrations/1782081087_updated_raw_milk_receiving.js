/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2018888458")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_raw_milk_batch` ON `raw_milk_receiving` (`batch_code`)",
      "CREATE INDEX `idx_raw_milk_date` ON `raw_milk_receiving` (`receipt_date`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2018888458")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_raw_milk_batch` ON `raw_milk_receiving` (`batch_code`)",
      "CREATE INDEX `idx_raw_milk_date` ON `raw_milk_receiving` (`receipt_date`)"
    ]
  }, collection)

  return app.save(collection)
})
