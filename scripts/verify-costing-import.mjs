import { pool } from '../backend/config/database.js';

const one=async sql=>(await pool.query(sql)).rows;
const result={
  ingredients:(await one('SELECT COUNT(*)::int count FROM ingredients'))[0].count,
  recipes:(await one('SELECT COUNT(*)::int count FROM recipes'))[0].count,
  recipe_items:(await one('SELECT COUNT(*)::int count FROM recipe_items'))[0].count,
  cleared:{
    orders:(await one('SELECT COUNT(*)::int count FROM orders'))[0].count,
    stock_transactions:(await one('SELECT COUNT(*)::int count FROM stock_transactions'))[0].count,
    purchase_orders:(await one('SELECT COUNT(*)::int count FROM purchase_orders'))[0].count,
    production_batches:(await one('SELECT COUNT(*)::int count FROM production_batches'))[0].count,
    restaurant_tables:(await one('SELECT COUNT(*)::int count FROM restaurant_tables'))[0].count,
  },
  settings:(await one('SELECT store_name,online_gp,tax_id,phone,email,address FROM store_settings WHERE id=1'))[0],
  missing_costs:await one('SELECT name,purchase_price FROM ingredients WHERE purchase_price=0 ORDER BY name'),
  sample:await one('SELECT code,name,ROUND(recipe_cost,2) recipe_cost,selling_price,online_selling_price FROM recipe_costs ORDER BY code LIMIT 8'),
  noodle_menus:await one(`SELECT r.code,r.name,r.serving_size,r.selling_price,r.online_selling_price,COUNT(ri.id)::int item_count
    FROM recipes r LEFT JOIN recipe_items ri ON ri.recipe_id=r.id WHERE r.code LIKE 'NOODLE-%'
    GROUP BY r.id ORDER BY r.code`),
};
console.log(JSON.stringify(result,null,2));
await pool.end();
