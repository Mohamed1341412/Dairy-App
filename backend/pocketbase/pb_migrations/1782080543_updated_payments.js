/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_631030571")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_payments_client` ON `payments` (`client_id`)",
      "CREATE INDEX `idx_payments_vendor` ON `payments` (`vendor_id`)",
      "CREATE INDEX `idx_payments_worker` ON `payments` (`worker_id`)",
      "CREATE UNIQUE INDEX `idx_payments_sync` ON `payments` (`sync_id`)"
    ]
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
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
  collection.fields.addAt(2, new Field({
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
  collection.fields.addAt(3, new Field({
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
  collection.fields.addAt(4, new Field({
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
  collection.fields.addAt(5, new Field({
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
  collection.fields.addAt(6, new Field({
    "help": "",
    "hidden": false,
    "id": "number4271801587",
    "max": null,
    "min": null,
    "name": "unallocated_amount",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "select1045090739",
    "maxSelect": 0,
    "name": "direction",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "in",
      "out"
    ]
  }))

  // add field
  collection.fields.addAt(8, new Field({
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
      "pending",
      "confirmed",
      "cancelled"
    ]
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "date2333974542",
    "max": "",
    "min": "",
    "name": "payment_date",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "date"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "help": "",
    "hidden": false,
    "id": "select2069996022",
    "maxSelect": 0,
    "name": "payment_method",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "cash",
      "bank",
      "credit",
      "other"
    ]
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
  collection.fields.addAt(13, new Field({
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

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_631030571")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  // remove field
  collection.fields.removeById("relation2607505338")

  // remove field
  collection.fields.removeById("relation434858273")

  // remove field
  collection.fields.removeById("relation4127452787")

  // remove field
  collection.fields.removeById("relation1797306934")

  // remove field
  collection.fields.removeById("number2392944706")

  // remove field
  collection.fields.removeById("number4271801587")

  // remove field
  collection.fields.removeById("select1045090739")

  // remove field
  collection.fields.removeById("select2063623452")

  // remove field
  collection.fields.removeById("date2333974542")

  // remove field
  collection.fields.removeById("select2069996022")

  // remove field
  collection.fields.removeById("text2347871824")

  // remove field
  collection.fields.removeById("text4199597090")

  // remove field
  collection.fields.removeById("text18589324")

  return app.save(collection)
})
