/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2471705857")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_worker_date_shift` ON `attendance` (\n  `worker_id`,\n  `date`,\n  `shift`\n)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2471705857")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_worker_date_shift` ON `attendance` (\n  `worker_id`,\n  `date`,\n  `shift`\n)"
    ]
  }, collection)

  return app.save(collection)
})
