/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_444539071")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_activity_logs_collection_record` ON `activity_logs` (\n  `collection_name`,\n  `record_id`\n)",
      "CREATE INDEX `idx_activity_logs_user` ON `activity_logs` (`user_id`)",
      "CREATE INDEX `idx_activity_logs_created` ON `activity_logs` (`created`)",
      "CREATE INDEX `idx_activity_logs_action` ON `activity_logs` (`action`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_444539071")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
