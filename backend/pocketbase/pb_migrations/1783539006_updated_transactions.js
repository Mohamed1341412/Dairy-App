/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3174063690")

  // update field
  collection.fields.addAt(17, new Field({
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
      "payment",
      "manual",
      "adjustment",
      "system"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3174063690")

  // update field
  collection.fields.addAt(17, new Field({
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

  return app.save(collection)
})
