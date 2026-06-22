/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_444539071")

  // update field
  collection.fields.addAt(3, new Field({
    "help": "",
    "hidden": false,
    "id": "select2746092216",
    "maxSelect": 0,
    "name": "operation_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "create",
      "update",
      "archive",
      "restore",
      "post",
      "reverse",
      "adjust",
      "permission"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_444539071")

  // update field
  collection.fields.addAt(3, new Field({
    "help": "",
    "hidden": false,
    "id": "select2746092216",
    "maxSelect": 0,
    "name": "operation_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "create, update, archive, restore, post, reverse, adjust, permission"
    ]
  }))

  return app.save(collection)
})
