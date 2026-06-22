/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2694150484")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE INDEX `idx_recipe_items_recipe` ON `recipe_items` (`recipe_id`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2694150484")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
