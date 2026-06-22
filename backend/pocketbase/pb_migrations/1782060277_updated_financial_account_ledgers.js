/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4240353696")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_fa_ledger_account` ON `financial_account_ledgers` (`account_id`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4240353696")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
