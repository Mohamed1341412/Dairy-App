/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3766814448")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_vendor_ledgers_vendor` ON `vendor_ledgers` (`vendor_id`)",
      "CREATE UNIQUE INDEX `idx_vendor_ledgers_tx_entry` ON `vendor_ledgers` (\n  `transaction_id`,\n  `entry_type`\n)",
      "CREATE INDEX `idx_vendor_ledgers_replay_order` ON `vendor_ledgers` (`posting_sequence`)"
    ]
  }, collection)

  // add field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text687615802",
    "max": 0,
    "min": 0,
    "name": "entry_type",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "help": "",
    "hidden": false,
    "id": "number3607465205",
    "max": null,
    "min": null,
    "name": "posting_sequence",
    "onlyInt": true,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text728423354",
    "max": 0,
    "min": 0,
    "name": "document_type",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3275716663",
    "max": 0,
    "min": 0,
    "name": "document_id",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2347871824",
    "max": 0,
    "min": 0,
    "name": "reference_number",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "help": "",
    "hidden": false,
    "id": "bool3837428648",
    "name": "is_reversal",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3766814448")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_vendor_ledgers_vendor` ON `vendor_ledgers` (`vendor_id`)"
    ]
  }, collection)

  // remove field
  collection.fields.removeById("text687615802")

  // remove field
  collection.fields.removeById("number3607465205")

  // remove field
  collection.fields.removeById("text728423354")

  // remove field
  collection.fields.removeById("text3275716663")

  // remove field
  collection.fields.removeById("text2347871824")

  // remove field
  collection.fields.removeById("bool3837428648")

  return app.save(collection)
})
