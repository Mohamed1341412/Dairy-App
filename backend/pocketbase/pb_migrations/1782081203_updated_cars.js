/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2999614116")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_cars_plate` ON `cars` (`plate_number`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2999614116")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_cars_plate` ON `cars` (`plate_number`)"
    ]
  }, collection)

  return app.save(collection)
})
