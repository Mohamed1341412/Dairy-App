/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3174063690")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_transactions_number` ON `transactions` (`transaction_number`)",
      "CREATE INDEX `idx_transactions_date` ON `transactions` (`transaction_date`)",
      "CREATE INDEX `idx_transactions_type` ON `transactions` (`type`)",
      "CREATE INDEX `idx_transactions_party` ON `transactions` (`party_type`)",
      "CREATE UNIQUE INDEX `transactions_sync` ON `transactions` (`sync_id`)",
      "CREATE UNIQUE INDEX `transactions_ref` ON `transactions` (`reference_number`)",
      "CREATE UNIQUE INDEX `idx_transactions_reversal_unique` ON `transactions` (`reversal_of`) WHERE `reversal_of` != ''"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3174063690")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_transactions_number` ON `transactions` (`transaction_number`)",
      "CREATE INDEX `idx_transactions_date` ON `transactions` (`transaction_date`)",
      "CREATE INDEX `idx_transactions_type` ON `transactions` (`type`)",
      "CREATE INDEX `idx_transactions_party` ON `transactions` (`party_type`)",
      "CREATE UNIQUE INDEX `transactions_sync` ON `transactions` (`sync_id`)",
      "CREATE UNIQUE INDEX `transactions_ref` ON `transactions` (`reference_number`)"
    ]
  }, collection)

  return app.save(collection)
})
