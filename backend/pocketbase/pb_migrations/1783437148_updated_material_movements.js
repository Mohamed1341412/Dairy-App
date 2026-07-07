/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1787855659")

  // update field
  collection.fields.addAt(3, new Field({
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

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1787855659")

  // update field
  collection.fields.addAt(3, new Field({
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
      "out "
    ]
  }))

  return app.save(collection)
})
