/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3390916050")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_worker_ledgers_tx_entry` ON `worker_ledgers` (\n  `transaction_id`,\n  `entry_type`\n)",
      "CREATE INDEX `idx_4worker_ledgers_replay_order` ON `worker_ledgers` (`posting_sequence`)",
      "CREATE INDEX `idx_worker_ledgers_id` ON `worker_ledgers` (`worker_id`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3390916050")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_worker_ledgers_tx_entry` ON `worker_ledgers` (\n  `transaction_id`,\n  `entry_type`\n)",
      "CREATE INDEX `idx_4worker_ledgers_replay_order` ON `worker_ledgers` (`posting_sequence`)"
    ]
  }, collection)

  return app.save(collection)
})
