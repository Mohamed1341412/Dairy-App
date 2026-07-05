/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1787855659")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_material_movements_material` ON `material_movements` (`material_id`)",
      "CREATE UNIQUE INDEX `idx_material_movements_ref` ON `material_movements` (`reference_number`)",
      "CREATE UNIQUE INDEX `idx_material_movements_sync` ON `material_movements` (`sync_id`)",
      "CREATE UNIQUE INDEX `idx_material_movements_corrects` ON `material_movements` (`corrects_movement_id`) WHERE `corrects_movement_id` != ''"
    ]
  }, collection)

  // add field
  collection.fields.addAt(12, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1787855659",
    "help": "",
    "hidden": false,
    "id": "relation940563710",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "corrects_movement_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1787855659")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_material_movements_material` ON `material_movements` (`material_id`)",
      "CREATE UNIQUE INDEX `idx_material_movements_ref` ON `material_movements` (`reference_number`)",
      "CREATE UNIQUE INDEX `idx_material_movements_sync` ON `material_movements` (`sync_id`)"
    ]
  }, collection)

  // remove field
  collection.fields.removeById("relation940563710")

  return app.save(collection)
})
