import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool } from '../config/database.js';

const backupPath = resolve('backups/before-costing-import-2026-11-02T08-27-50-000Z.json');
const importUrl = new URL('../database/costing-import.json', import.meta.url);
const backup = JSON.parse(await readFile(backupPath, 'utf8')).tables;
const noodleRecipes = backup.recipes.filter(recipe => String(recipe.code).startsWith('NOODLE-'));
const noodleRecipeIds = new Set(noodleRecipes.map(recipe => String(recipe.id)));
const noodleItems = backup.recipe_items.filter(item => noodleRecipeIds.has(String(item.recipe_id)));
const oldIngredients = new Map(backup.ingredients.map(item => [String(item.id), item]));
const requiredOldIngredientIds = new Set(noodleItems.map(item => String(item.ingredient_id)));
const requiredIngredients = backup.ingredients.filter(item => requiredOldIngredientIds.has(String(item.id)));
const client = await pool.connect();

try {
  await client.query('BEGIN');
  for (const item of requiredIngredients) {
    await client.query(`INSERT INTO ingredients
      (sku,name,category,purchase_qty,purchase_unit,purchase_price,base_unit,conversion_to_base,reorder_level,supplier,barcode,expiry_date,active,stock_group,purchase_cycle_days,count_cycle_days)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT(sku) DO NOTHING`, [
      item.sku,item.name,item.category,item.purchase_qty,item.purchase_unit,item.purchase_price,item.base_unit,
      item.conversion_to_base,item.reorder_level,item.supplier,item.barcode,item.expiry_date,item.active,
      item.stock_group,item.purchase_cycle_days,item.count_cycle_days
    ]);
  }

  const currentIngredients = (await client.query('SELECT id,sku FROM ingredients')).rows;
  const ingredientIdBySku = new Map(currentIngredients.map(item => [item.sku, item.id]));
  for (const recipe of noodleRecipes) {
    const saved = (await client.query(`INSERT INTO recipes
      (code,name,category,serving_size,selling_price,online_selling_price,active,sold_out)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,serving_size=EXCLUDED.serving_size
      RETURNING id`, [recipe.code,recipe.name,recipe.category,recipe.serving_size,recipe.selling_price,
      recipe.online_selling_price,recipe.active,recipe.sold_out])).rows[0];
    await client.query('DELETE FROM recipe_items WHERE recipe_id=$1',[saved.id]);
    const items = noodleItems.filter(item => String(item.recipe_id) === String(recipe.id)).sort((a,b) => a.sort_order-b.sort_order);
    for (const item of items) {
      const sourceIngredient = oldIngredients.get(String(item.ingredient_id));
      await client.query('INSERT INTO recipe_items(recipe_id,ingredient_id,qty_base,sort_order) VALUES($1,$2,$3,$4)',
        [saved.id,ingredientIdBySku.get(sourceIngredient.sku),item.qty_base,item.sort_order]);
    }
  }
  const counts = (await client.query(`SELECT
    (SELECT COUNT(*)::int FROM ingredients) ingredients,
    (SELECT COUNT(*)::int FROM recipes) recipes,
    (SELECT COUNT(*)::int FROM recipe_items) recipe_items`)).rows[0];
  if (counts.ingredients !== 48 || counts.recipes !== 32 || counts.recipe_items !== 282) {
    throw new Error(`Unexpected totals: ${JSON.stringify(counts)}`);
  }
  await client.query('COMMIT');

  const importData = JSON.parse(await readFile(importUrl, 'utf8'));
  const importIngredientNames = new Set(importData.ingredients.map(item => item.name));
  for (const item of requiredIngredients) if (!importIngredientNames.has(item.name)) importData.ingredients.push({
    sku:item.sku,name:item.name,category:item.category,purchase_qty:Number(item.purchase_qty),purchase_unit:item.purchase_unit,
    purchase_price:Number(item.purchase_price),base_unit:item.base_unit,conversion_to_base:Number(item.conversion_to_base),
    reorder_level:Number(item.reorder_level),supplier:item.supplier,barcode:item.barcode,expiry_date:item.expiry_date
  });
  const importCodes = new Set(importData.recipes.map(item => item.code));
  for (const recipe of noodleRecipes) if (!importCodes.has(recipe.code)) {
    const items = noodleItems.filter(item => String(item.recipe_id) === String(recipe.id)).sort((a,b) => a.sort_order-b.sort_order);
    importData.recipes.push({
      code:recipe.code,name:recipe.name,category:recipe.category,serving_size:recipe.serving_size,
      selling_price:Number(recipe.selling_price),online_selling_price:Number(recipe.online_selling_price),
      note:recipe.code==='NOODLE-DRY-TOMYUM'?'สูตรต่อชาม ใช้ฐาน 10 ชามจากช่วง 8–10 ชาม':'สูตร 4 ชาม แปลงเป็นสูตรต่อชาม',
      items:items.map(item => ({ingredient:oldIngredients.get(String(item.ingredient_id)).name,qty:Number(item.qty_base)}))
    });
  }
  importData.missing_cost_ingredients = [...new Set(importData.ingredients.filter(item => Number(item.purchase_price)===0).map(item => item.name))];
  importData.generated_price_codes = [...new Set([...(importData.generated_price_codes||[]),...noodleRecipes.map(item => item.code)])];
  importData.source_policy = 'Excel source plus owner-approved noodle recipes';
  await writeFile(importUrl, `${JSON.stringify(importData,null,2)}\n`, 'utf8');
  console.log(JSON.stringify({ok:true,...counts,noodle_recipes:noodleRecipes.map(item => item.name)},null,2));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
