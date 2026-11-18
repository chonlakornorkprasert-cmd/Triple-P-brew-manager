export async function replaceWithCostingData(client,data){
  for(const table of ['daily_stock_counts','production_batches','purchase_order_items','purchase_orders','order_items','orders','recipe_items','stock_transactions','restaurant_tables','recipes','ingredients']) await client.query(`DELETE FROM ${table}`);
  const ingredientIds=new Map();
  for(const item of data.ingredients){
    const row=(await client.query(`INSERT INTO ingredients (sku,name,category,purchase_qty,purchase_unit,purchase_price,base_unit,conversion_to_base,reorder_level,supplier) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[item.sku,item.name,item.category,item.purchase_qty,item.purchase_unit,item.purchase_price,item.base_unit,item.conversion_to_base,item.reorder_level,item.supplier])).rows[0];
    ingredientIds.set(item.name,row.id);
  }
  for(const recipe of data.recipes){
    const row=(await client.query('INSERT INTO recipes(code,name,category,serving_size,selling_price,online_selling_price) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[recipe.code,recipe.name,recipe.category,recipe.serving_size,recipe.selling_price,recipe.online_selling_price])).rows[0];
    for(const [index,item] of recipe.items.entries()) await client.query('INSERT INTO recipe_items(recipe_id,ingredient_id,qty_base,sort_order) VALUES($1,$2,$3,$4)',[row.id,ingredientIds.get(item.ingredient),item.qty,index]);
  }
  await client.query("UPDATE ingredients SET stock_group='C',purchase_cycle_days=7,count_cycle_days=3");
  await client.query("UPDATE ingredients SET stock_group='D',purchase_cycle_days=21,count_cycle_days=7 WHERE category='บรรจุภัณฑ์' OR name ~ '(แก้ว|ฝา|หลอด|ถุง|ซีล|ชาม|กล่อง|ช้อน)'");
  await client.query("UPDATE ingredients SET stock_group='B',purchase_cycle_days=5,count_cycle_days=1 WHERE stock_group<>'D' AND name ~ '(นม|ข้นหวาน|ข้นจืด|เบสชา)'");
  await client.query("UPDATE ingredients SET stock_group='A',purchase_cycle_days=2,count_cycle_days=1 WHERE stock_group NOT IN ('D','B') AND name ~ '(หมู|ลูกชิ้น|ผัก|ถั่วงอก|เส้น|บะหมี่|ต้นหอม|กระดูก|ไชเท้า|รากผักชี|มะนาวสด)'");
  await client.query(`UPDATE store_settings SET store_name='Triple P Brew Café & Noodles',tax_id=NULL,phone=NULL,email=NULL,address=NULL,
    vat_rate=0,service_charge=0,online_gp=$1,currency='THB',promptpay_type='PHONE',promptpay_id=NULL,receipt_prefix='TPP',
    receipt_footer='ขอบคุณที่ใช้บริการ',opening_time='08:00',closing_time='18:00',food_cost_target=35,low_stock_alert=TRUE,updated_at=NOW() WHERE id=1`,[data.online_gp_percent]);
}
