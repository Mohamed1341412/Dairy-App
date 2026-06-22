/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_1342968361",
        "help": "",
        "hidden": false,
        "id": "relation2757590634",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "purchase_order_id",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "help": "",
        "hidden": false,
        "id": "select127116528",
        "maxSelect": 0,
        "name": "line_type",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "material",
          "product"
        ]
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_4282183725",
        "help": "",
        "hidden": false,
        "id": "relation3808996463",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "material_id",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_4092854851",
        "help": "",
        "hidden": false,
        "id": "relation1166304858",
        "maxSelect": 0,
        "minSelect": 0,
        "name": "product_id",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number2683508278",
        "max": null,
        "min": null,
        "name": "quantity",
        "onlyInt": false,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number2497738150",
        "max": null,
        "min": null,
        "name": "unit_cost",
        "onlyInt": false,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "help": "",
        "hidden": false,
        "id": "number1715341057",
        "max": null,
        "min": null,
        "name": "total_cost",
        "onlyInt": false,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_336616017",
    "indexes": [
      "CREATE INDEX `idx_purchase_order_items_order` ON `purchase_order_items` (`purchase_order_id`)",
      "CREATE INDEX `idx_purchase_items_line_type` ON `purchase_order_items` (`line_type`)"
    ],
    "listRule": null,
    "name": "purchase_order_items",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_336616017");

  return app.delete(collection);
})
