/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4280990403")

  // update field
  collection.fields.addAt(3, new Field({
    "help": "",
    "hidden": false,
    "id": "select1425029171",
    "maxSelect": 0,
    "name": "movement_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "production",
      "sale",
      "return",
      "purchase",
      "adjustment",
      "waste"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4280990403")

  // update field
  collection.fields.addAt(3, new Field({
    "help": "",
    "hidden": false,
    "id": "select1425029171",
    "maxSelect": 0,
    "name": "movement_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "production",
      "sale",
      "return",
      "adjustment",
      "waste"
    ]
  }))

  return app.save(collection)
})
