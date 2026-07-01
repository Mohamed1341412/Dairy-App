/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3174063690")

  // add field
  collection.fields.addAt(12, new Field({
    "help": "",
    "hidden": false,
    "id": "number324838872",
    "max": null,
    "min": null,
    "name": "remaining_amount",
    "onlyInt": false,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "help": "",
    "hidden": false,
    "id": "number23929447062",
    "max": null,
    "min": null,
    "name": "amount",
    "onlyInt": false,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

  // update field
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "number2392944706",
    "max": null,
    "min": null,
    "name": "paid_amount",
    "onlyInt": false,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

  // update field
  collection.fields.addAt(18, new Field({
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
      "overpaid",
      "unpaid"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3174063690")

  // remove field
  collection.fields.removeById("number324838872")

  // remove field
  collection.fields.removeById("number23929447062")

  // update field
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

  // update field
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

  return app.save(collection)
})
