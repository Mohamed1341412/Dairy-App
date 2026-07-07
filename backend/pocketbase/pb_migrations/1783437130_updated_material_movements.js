/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1787855659")

  // update field
  collection.fields.addAt(2, new Field({
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
      "purchase",
      "production_consumption",
      "adjustment",
      "waste"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1787855659")

  // update field
  collection.fields.addAt(2, new Field({
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
      "purchase,production_consumption,adjustment,waste"
    ]
  }))

  return app.save(collection)
})
