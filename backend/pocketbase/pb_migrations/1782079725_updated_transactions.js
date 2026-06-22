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
      "CREATE UNIQUE INDEX `transactions_ref` ON `transactions` (`reference_number`)"
    ]
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3773656340",
    "max": 0,
    "min": 0,
    "name": "transaction_number",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(2, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_231749954",
    "help": "",
    "hidden": false,
    "id": "relation2607505338",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "account_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "help": "",
    "hidden": false,
    "id": "select2363381545",
    "maxSelect": 0,
    "name": "type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "sale",
      "purchase",
      "salary",
      "expense",
      "maintenance",
      "fuel",
      "repair",
      "other"
    ]
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "help": "",
    "hidden": false,
    "id": "select1212035241",
    "maxSelect": 0,
    "name": "transaction_category",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "operational",
      "payroll",
      "capital",
      "adjustment",
      "owner_withdrawal"
    ]
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "help": "",
    "hidden": false,
    "id": "select2474481402",
    "maxSelect": 0,
    "name": "party_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "client",
      "vendor",
      "worker",
      "asset",
      "other"
    ]
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_2442875294",
    "help": "",
    "hidden": false,
    "id": "relation434858273",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "client_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3732325883",
    "help": "",
    "hidden": false,
    "id": "relation4127452787",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "vendor_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_696123946",
    "help": "",
    "hidden": false,
    "id": "relation1797306934",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "worker_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_2999614116",
    "help": "",
    "hidden": false,
    "id": "relation3284596383",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "car_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3071488795",
    "help": "",
    "hidden": false,
    "id": "relation1367337470",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "equipment_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "number2392944706",
    "max": null,
    "min": null,
    "name": "amount",
    "onlyInt": false,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "help": "",
    "hidden": false,
    "id": "date1222445531",
    "max": "",
    "min": "",
    "name": "transaction_date",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "date"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "help": "",
    "hidden": false,
    "id": "date4194645367",
    "max": "",
    "min": "",
    "name": "business_date",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "date"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "help": "",
    "hidden": false,
    "id": "select2063623452",
    "maxSelect": 0,
    "name": "status",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "posted",
      "reversed"
    ]
  }))

  // add field
  collection.fields.addAt(15, new Field({
    "help": "",
    "hidden": false,
    "id": "select704056627",
    "maxSelect": 0,
    "name": "transaction_source",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "sales_order",
      "purchase_order",
      "payroll",
      "expense",
      "manual",
      "adjustment",
      "system"
    ]
  }))

  // add field
  collection.fields.addAt(16, new Field({
    "help": "",
    "hidden": false,
    "id": "select1580793482",
    "maxSelect": 0,
    "name": "payment_status",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "paid",
      "partial",
      "later"
    ]
  }))

  // add field
  collection.fields.addAt(17, new Field({
    "help": "",
    "hidden": false,
    "id": "select1045090739",
    "maxSelect": 0,
    "name": "direction",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "in",
      "out"
    ]
  }))

  // add field
  collection.fields.addAt(18, new Field({
    "help": "",
    "hidden": false,
    "id": "bool4192399027",
    "name": "affects_cashflow",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(19, new Field({
    "help": "",
    "hidden": false,
    "id": "bool3837428648",
    "name": "is_reversal",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(20, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3174063690",
    "help": "",
    "hidden": false,
    "id": "relation1653163849",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "relation",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(21, new Field({
    "help": "",
    "hidden": false,
    "id": "bool3130737998",
    "name": "is_locked",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(22, new Field({
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
  collection.fields.addAt(23, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2824032381",
    "max": 0,
    "min": 0,
    "name": "reference_collection",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(24, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text373677737",
    "max": 0,
    "min": 0,
    "name": "reference_id",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(25, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text4199597090",
    "max": 0,
    "min": 0,
    "name": "sync_id",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(26, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text18589324",
    "max": 0,
    "min": 0,
    "name": "notes",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(27, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation3725765462",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "created_by",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3174063690")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  // remove field
  collection.fields.removeById("text3773656340")

  // remove field
  collection.fields.removeById("relation2607505338")

  // remove field
  collection.fields.removeById("select2363381545")

  // remove field
  collection.fields.removeById("select1212035241")

  // remove field
  collection.fields.removeById("select2474481402")

  // remove field
  collection.fields.removeById("relation434858273")

  // remove field
  collection.fields.removeById("relation4127452787")

  // remove field
  collection.fields.removeById("relation1797306934")

  // remove field
  collection.fields.removeById("relation3284596383")

  // remove field
  collection.fields.removeById("relation1367337470")

  // remove field
  collection.fields.removeById("number2392944706")

  // remove field
  collection.fields.removeById("date1222445531")

  // remove field
  collection.fields.removeById("date4194645367")

  // remove field
  collection.fields.removeById("select2063623452")

  // remove field
  collection.fields.removeById("select704056627")

  // remove field
  collection.fields.removeById("select1580793482")

  // remove field
  collection.fields.removeById("select1045090739")

  // remove field
  collection.fields.removeById("bool4192399027")

  // remove field
  collection.fields.removeById("bool3837428648")

  // remove field
  collection.fields.removeById("relation1653163849")

  // remove field
  collection.fields.removeById("bool3130737998")

  // remove field
  collection.fields.removeById("text2347871824")

  // remove field
  collection.fields.removeById("text2824032381")

  // remove field
  collection.fields.removeById("text373677737")

  // remove field
  collection.fields.removeById("text4199597090")

  // remove field
  collection.fields.removeById("text18589324")

  // remove field
  collection.fields.removeById("relation3725765462")

  return app.save(collection)
})
