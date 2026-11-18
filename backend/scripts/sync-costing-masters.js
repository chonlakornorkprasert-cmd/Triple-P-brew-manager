import { readFile } from 'node:fs/promises';
import { pool } from '../config/database.js';

const data = JSON.parse(await readFile(new URL('../database/costing-import.json', import.meta.url), 'utf8'));
const client = await pool.connect();

try {
  await client.query('BEGIN');
  const ingredientIds = new Map();
  for (const item of data.ingredients) {
    const row = (await client.query(`INSERT INTO ingredients
      (sku,name,category,purchase_qty,purchase_unit,purchase_price,base_unit,conversion_to_base,reorder_level,supplier,barcode,expiry_date)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT(sku) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,purchase_qty=EXCLUDED.purchase_qty,
      purchase_unit=EXCLUDED.purchase_unit,purchase_price=EXCLUDED.purchase_price,base_unit=EXCLUDED.base_unit,
      conversion_to_base=EXCLUDED.conversion_to_base,reorder_level=EXCLUDED.reorder_level,supplier=EXCLUDED.supplier,
      barcode=EXCLUDED.barcode,expiry_date=EXCLUDED.expiry_date,active=TRUE,updated_at=NOW()
      RETURNING id`, [item.sku,item.name,item.category,item.purchase_qty,item.purchase_unit,item.purchase_price,
      item.base_unit,item.conversion_to_base,item.reorder_level,item.supplier,item.barcode||null,item.expiry_date||null])).rows[0];
    ingredientIds.set(item.name,row.id);
  }

  for (const recipe of data.recipes) {
    const row = (await client.query(`INSERT INTO recipes(code,name,category,serving_size,selling_price,online_selling_price)
      VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,serving_size=EXCLUDED.serving_size,
      selling_price=EXCLUDED.selling_price,online_selling_price=EXCLUDED.online_selling_price,active=TRUE,updated_at=NOW()
      RETURNING id`, [recipe.code,recipe.name,recipe.category,recipe.serving_size,recipe.selling_price,recipe.online_selling_price])).rows[0];
    await client.query('DELETE FROM recipe_items WHERE recipe_id=$1',[row.id]);
    for (const [index,item] of recipe.items.entries()) {
      const ingredientId = ingredientIds.get(item.ingredient);
      if (!ingredientId) throw new Error(`Missing ingredient: ${item.ingredient}`);
      await client.query('INSERT INTO recipe_items(recipe_id,ingredient_id,qty_base,sort_order) VALUES($1,$2,$3,$4)',
        [row.id,ingredientId,item.qty,index]);
    }
  }

  await client.query(`UPDATE store_settings SET online_gp=$1,updated_at=NOW() WHERE id=1`,[data.online_gp_percent]);
  await client.query('COMMIT');
  const counts = (await client.query(`SELECT
    (SELECT COUNT(*)::int FROM ingredients WHERE active) ingredients,
    (SELECT COUNT(*)::int FROM recipes WHERE active) recipes,
    (SELECT COUNT(*)::int FROM recipe_items) recipe_items`)).rows[0];
  console.log(JSON.stringify({ok:true,mode:'safe-master-sync',...counts},null,2));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
