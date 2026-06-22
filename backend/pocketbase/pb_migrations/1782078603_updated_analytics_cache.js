/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2289417688")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_analytics_period` ON `analytics_cache` (\n  `date`,\n  `period_type`\n)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2289417688")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_analytics_period` ON `analytics_cache` (\n  `date`,\n  `period_type`\n)"
    ]
  }, collection)

  return app.save(collection)
})
