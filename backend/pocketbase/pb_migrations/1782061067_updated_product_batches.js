/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1341887345")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_product_batches_code` ON `product_batches` (`batch_code`)",
      "CREATE INDEX `idx_product_batches_product` ON `product_batches` (`product_id`)",
      "CREATE INDEX `idx_product_batches_expiry` ON `product_batches` (`expiration_date`)"
    ]
  }, collection)

  // add field
  collection.fields.addAt(2, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1341887345",
    "help": "",
    "hidden": false,
    "id": "relation199820702",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "production_batch_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1341887345")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  // remove field
  collection.fields.removeById("relation199820702")

  return app.save(collection)
})
