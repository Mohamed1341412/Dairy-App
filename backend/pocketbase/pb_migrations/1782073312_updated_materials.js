/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_4282183725")

  // update field
  collection.fields.addAt(2, new Field({
    "help": "",
    "hidden": false,
    "id": "select3635821084",
    "maxSelect": 0,
    "name": "material_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "raw",
      "packaging",
      "consumable"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4282183725")

  // update field
  collection.fields.addAt(2, new Field({
    "help": "",
    "hidden": false,
    "id": "select3635821084",
    "maxSelect": 0,
    "name": "material_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "raw,packaging,consumable"
    ]
  }))

  return app.save(collection)
})
