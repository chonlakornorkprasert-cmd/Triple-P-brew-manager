import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pool } from './config/database.js';
import { setupExpenses } from './expenses.js';
import { setupTeaBases } from './tea-bases.js';

const app = express();
// Express 4 does not forward rejected async handlers to error middleware.
for(const method of ['get','post','put','patch','delete']){
 const register=app[method].bind(app);
 app[method]=function(path,...handlers){return register(path,...handlers.map(handler=>typeof handler==='function'&&handler.constructor.name==='AsyncFunction'?(req,res,next)=>Promise.resolve(handler(req,res,next)).catch(next):handler))};
}
const currentDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(currentDir, '../frontend');
app.use(cors());
await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS served_by TEXT');
await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ');
await pool.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ');
await pool.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS served_by TEXT');
await pool.query("UPDATE order_items oi SET served_at=o.served_at,served_by=o.served_by FROM orders o WHERE o.id=oi.order_id AND o.served_at IS NOT NULL AND oi.served_at IS NULL");
app.use(express.json({limit:'6mb'}));
await setupExpenses(app,pool);
await setupTeaBases(app,pool);
await pool.query('CREATE TABLE IF NOT EXISTS recipe_images (recipe_id INTEGER PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE, image_data TEXT NOT NULL)');
app.get('/api/menu-images',async(_req,res)=>res.json((await pool.query('SELECT * FROM recipe_images')).rows));
app.put('/api/menu-images/:id',async(req,res)=>{
 const image=req.body.image_data;
 if(typeof image!=='string'||(image&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)))return res.status(400).json({error:'รูปภาพไม่ถูกต้อง'});
 if(image)await pool.query('INSERT INTO recipe_images(recipe_id,image_data) VALUES($1,$2) ON CONFLICT(recipe_id) DO UPDATE SET image_data=EXCLUDED.image_data',[req.params.id,image]);
 else await pool.query('DELETE FROM recipe_images WHERE recipe_id=$1',[req.params.id]);
 res.json({ok:true});
});
app.use(express.static(frontendDir));

app.get('/api/health', async (_req,res)=>{
  const { rows } = await pool.query('SELECT NOW() AS now');
  res.json({ ok:true, databaseTime: rows[0].now });
});

app.get('/api/ingredients', async (_req,res)=>{
  const { rows } = await pool.query(`SELECT ic.*, sb.stock_qty FROM ingredient_costs ic LEFT JOIN stock_balances sb ON sb.ingredient_id=ic.id ORDER BY ic.category,ic.name`);
  res.json(rows);
});

app.post('/api/ingredients', async (req,res)=>{
  const b=req.body;
  const q=`INSERT INTO ingredients(sku,name,category,purchase_qty,purchase_unit,purchase_price,base_unit,conversion_to_base,reorder_level,supplier,barcode,expiry_date,stock_group,purchase_cycle_days,count_cycle_days)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`;
  const { rows }=await pool.query(q,[b.sku,b.name,b.category,b.purchase_qty,b.purchase_unit,b.purchase_price,b.base_unit,b.conversion_to_base||1,b.reorder_level||0,b.supplier||null,b.barcode||null,b.expiry_date||null,b.stock_group||'C',b.purchase_cycle_days||7,b.count_cycle_days||3]);
  res.status(201).json(rows[0]);
});

app.put('/api/ingredients/:id', async (req,res)=>{
  const b=req.body;
  const { rows }=await pool.query(`UPDATE ingredients SET sku=$1,name=$2,category=$3,purchase_qty=$4,purchase_unit=$5,purchase_price=$6,base_unit=$7,conversion_to_base=$8,reorder_level=$9,supplier=$10,barcode=$11,expiry_date=$12,stock_group=$13,purchase_cycle_days=$14,count_cycle_days=$15,updated_at=NOW() WHERE id=$16 RETURNING *`,[b.sku,b.name,b.category,b.purchase_qty,b.purchase_unit,b.purchase_price,b.base_unit,b.conversion_to_base,b.reorder_level,b.supplier||null,b.barcode||null,b.expiry_date||null,b.stock_group||'C',b.purchase_cycle_days||7,b.count_cycle_days||3,req.params.id]);
  res.json(rows[0]);
});

app.delete('/api/ingredients/:id', async (req,res)=>{
  const used=await pool.query('SELECT 1 FROM recipe_items WHERE ingredient_id=$1 LIMIT 1',[req.params.id]);
  if(used.rowCount) return res.status(409).json({error:'Ingredient is used by a recipe'});
  const hasHistory=await pool.query('SELECT 1 FROM stock_transactions WHERE ingredient_id=$1 LIMIT 1',[req.params.id]);
  if(hasHistory.rowCount) return res.status(409).json({error:'Ingredient has stock history'});
  const { rowCount }=await pool.query('DELETE FROM ingredients WHERE id=$1',[req.params.id]);
  res.status(rowCount?204:404).end();
});

app.get('/api/recipes', async (_req,res)=>{
  const { rows }=await pool.query('SELECT * FROM recipe_costs ORDER BY category,name');
  res.json(rows);
});

app.get('/api/recipes/:id', async (req,res)=>{
  const recipe=(await pool.query('SELECT * FROM recipes WHERE id=$1',[req.params.id])).rows[0];
  const items=(await pool.query(`SELECT ri.*,i.sku,i.name,i.base_unit,ic.cost_per_base_unit,ri.qty_base*ic.cost_per_base_unit AS line_cost FROM recipe_items ri JOIN ingredients i ON i.id=ri.ingredient_id JOIN ingredient_costs ic ON ic.id=i.id WHERE ri.recipe_id=$1 ORDER BY ri.sort_order,ri.id`,[req.params.id])).rows;
  res.json({recipe,items});
});

app.post('/api/recipes', async (req,res)=>{
  const c=await pool.connect();
  try{ await c.query('BEGIN');
    const b=req.body;
    const r=(await c.query('INSERT INTO recipes(code,name,category,serving_size,selling_price,online_selling_price) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[b.code,b.name,b.category,b.serving_size,b.selling_price||0,b.online_selling_price||0])).rows[0];
    for(const [index,item] of (b.items||[]).entries()) await c.query('INSERT INTO recipe_items(recipe_id,ingredient_id,qty_base,sort_order) VALUES($1,$2,$3,$4)',[r.id,item.ingredient_id,item.qty_base,index]);
    await c.query('COMMIT'); res.status(201).json(r);
  }catch(e){ await c.query('ROLLBACK'); throw e; } finally{ c.release(); }
});

app.put('/api/recipes/:id', async (req,res)=>{
  const c=await pool.connect();
  try{await c.query('BEGIN');const b=req.body;
    const recipe=(await c.query(`UPDATE recipes SET code=$1,name=$2,category=$3,serving_size=$4,selling_price=$5,online_selling_price=$6,updated_at=NOW() WHERE id=$7 RETURNING *`,[b.code,b.name,b.category,b.serving_size,b.selling_price||0,b.online_selling_price||0,req.params.id])).rows[0];
    if(!recipe){await c.query('ROLLBACK');return res.status(404).json({error:'Menu not found'})}
    await c.query('DELETE FROM recipe_items WHERE recipe_id=$1',[req.params.id]);
    for(const [index,item] of (b.items||[]).entries()) await c.query('INSERT INTO recipe_items(recipe_id,ingredient_id,qty_base,sort_order) VALUES($1,$2,$3,$4)',[req.params.id,item.ingredient_id,item.qty_base,index]);
    await c.query('COMMIT');res.json(recipe);
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
});

app.delete('/api/recipes/:id', async (req,res)=>{
  const used=await pool.query('SELECT 1 FROM order_items WHERE recipe_id=$1 LIMIT 1',[req.params.id]);
  if(used.rowCount) return res.status(409).json({error:'Menu is used by an existing order'});
  const { rowCount }=await pool.query('DELETE FROM recipes WHERE id=$1',[req.params.id]);
  res.status(rowCount?204:404).end();
});

app.patch('/api/recipes/:id/availability', async (req,res)=>{
  const { rows }=await pool.query('UPDATE recipes SET sold_out=$1,updated_at=NOW() WHERE id=$2 RETURNING id,sold_out',[req.body.sold_out===true,req.params.id]);
  if(!rows[0]) return res.status(404).json({error:'Menu not found'});
  res.json(rows[0]);
});

app.post('/api/stock/transaction', async (req,res)=>{
  const b=req.body;
  if(!['OPENING','PURCHASE','USE','ADJUST_IN','ADJUST_OUT','WASTE'].includes(b.txn_type)||!Number.isFinite(Number(b.qty_base))||Number(b.qty_base)<=0)return res.status(400).json({error:'ประเภทหรือจำนวนไม่ถูกต้อง'});
  if(b.txn_type==='WASTE'&&!String(b.note||'').trim())return res.status(400).json({error:'กรุณาระบุสาเหตุของเสีย'});
  if(['USE','ADJUST_OUT','WASTE'].includes(b.txn_type)){
    const balance=(await pool.query('SELECT stock_qty FROM stock_balances WHERE ingredient_id=$1',[b.ingredient_id])).rows[0];
    if(!balance||Number(balance.stock_qty)<Number(b.qty_base)) return res.status(400).json({error:'Insufficient stock'});
  }
  const { rows }=await pool.query('INSERT INTO stock_transactions(ingredient_id,txn_type,qty_base,unit_cost,reference,note) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[b.ingredient_id,b.txn_type,b.qty_base,b.unit_cost||null,b.reference||null,b.note||null]);
  res.status(201).json(rows[0]);
});

app.get('/api/stock/transactions', async (req,res)=>{
  const ingredientId=Number(req.query.ingredient_id)||null;
  const txnType=String(req.query.txn_type||'').trim()||null;
  const limit=Math.min(Math.max(Number(req.query.limit)||100,1),500);
  const { rows }=await pool.query(`
    SELECT st.id,st.ingredient_id,i.sku,i.name,i.base_unit,st.txn_type,st.qty_base,
           st.unit_cost,st.reference,st.note,st.txn_at
    FROM stock_transactions st
    JOIN ingredients i ON i.id=st.ingredient_id
    WHERE ($1::int IS NULL OR st.ingredient_id=$1)
      AND ($2::text IS NULL OR st.txn_type=$2)
    ORDER BY st.txn_at DESC,st.id DESC
    LIMIT $3`,[ingredientId,txnType,limit]);
  res.json(rows);
});

app.get('/api/stock/counts', async (req,res)=>{
  const date=String(req.query.date||'').trim()||null;
  const { rows }=await pool.query(`SELECT dsc.*,i.sku,i.name,i.base_unit,ic.cost_per_base_unit,
    dsc.variance_qty*ic.cost_per_base_unit AS variance_value
    FROM daily_stock_counts dsc JOIN ingredients i ON i.id=dsc.ingredient_id
    JOIN ingredient_costs ic ON ic.id=i.id
    WHERE dsc.count_date=COALESCE($1::date,CURRENT_DATE)
    ORDER BY ABS(dsc.variance_qty*ic.cost_per_base_unit) DESC,i.name`,[date]);
  res.json(rows);
});

app.get('/api/stock/daily-control', async (req,res)=>{
  const date=String(req.query.date||'').trim()||null;
  const { rows }=await pool.query(`WITH params AS (SELECT COALESCE($1::date,CURRENT_DATE) AS target_date), movement AS (
    SELECT i.id ingredient_id,
      COALESCE(SUM(CASE WHEN st.txn_at<p.target_date AND st.txn_type IN ('OPENING','PURCHASE','ADJUST_IN') THEN st.qty_base WHEN st.txn_at<p.target_date THEN -st.qty_base WHEN st.txn_at>=p.target_date AND st.txn_at<p.target_date+INTERVAL '1 day' AND st.txn_type='OPENING' THEN st.qty_base ELSE 0 END),0) opening_qty,
      COALESCE(SUM(st.qty_base) FILTER(WHERE st.txn_at>=p.target_date AND st.txn_at<p.target_date+INTERVAL '1 day' AND st.txn_type='PURCHASE'),0) received_qty,
      COALESCE(SUM(st.qty_base) FILTER(WHERE st.txn_at>=p.target_date AND st.txn_at<p.target_date+INTERVAL '1 day' AND st.txn_type='USE' AND st.reference LIKE 'ORDER-%'),0) sales_usage_qty,
      COALESCE(SUM(st.qty_base) FILTER(WHERE st.txn_at>=p.target_date AND st.txn_at<p.target_date+INTERVAL '1 day' AND st.txn_type='USE' AND COALESCE(st.reference,'') NOT LIKE 'ORDER-%'),0) other_usage_qty,
      COALESCE(SUM(st.qty_base) FILTER(WHERE st.txn_at>=p.target_date AND st.txn_at<p.target_date+INTERVAL '1 day' AND st.txn_type='WASTE'),0) waste_qty,
      COALESCE(SUM(CASE WHEN st.txn_at>=p.target_date AND st.txn_at<p.target_date+INTERVAL '1 day' AND COALESCE(st.reference,'') NOT LIKE 'COUNT-%' AND st.txn_type='ADJUST_IN' THEN st.qty_base WHEN st.txn_at>=p.target_date AND st.txn_at<p.target_date+INTERVAL '1 day' AND COALESCE(st.reference,'') NOT LIKE 'COUNT-%' AND st.txn_type='ADJUST_OUT' THEN -st.qty_base ELSE 0 END),0) adjustment_qty
    FROM ingredients i CROSS JOIN params p LEFT JOIN stock_transactions st ON st.ingredient_id=i.id GROUP BY i.id
  ) SELECT i.id ingredient_id,i.sku,i.name,i.category,i.stock_group,i.purchase_cycle_days,i.count_cycle_days,i.base_unit,ic.cost_per_base_unit,m.*,
    m.opening_qty+m.received_qty-m.sales_usage_qty-m.other_usage_qty-m.waste_qty+m.adjustment_qty expected_closing_qty,
    dsc.actual_qty,dsc.variance_qty,dsc.reason,dsc.counted_by,dsc.counted_at,
    ABS(COALESCE(dsc.variance_qty,0)*ic.cost_per_base_unit) variance_value
    FROM movement m JOIN ingredients i ON i.id=m.ingredient_id JOIN ingredient_costs ic ON ic.id=i.id CROSS JOIN params p
    LEFT JOIN daily_stock_counts dsc ON dsc.ingredient_id=i.id AND dsc.count_date=p.target_date
    ORDER BY CASE WHEN dsc.variance_qty IS NULL THEN 1 ELSE 0 END,ABS(COALESCE(dsc.variance_qty,0)*ic.cost_per_base_unit) DESC,i.category,i.name`,[date]);
  res.json(rows);
});

app.post('/api/stock/counts', async (req,res)=>{
  const b=req.body,c=await pool.connect();
  try{await c.query('BEGIN');
    const balance=(await c.query('SELECT stock_qty FROM stock_balances WHERE ingredient_id=$1',[b.ingredient_id])).rows[0];
    if(!balance){await c.query('ROLLBACK');return res.status(404).json({error:'Ingredient not found'})}
    const expected=Number(balance.stock_qty),actual=Number(b.actual_qty),variance=actual-expected;
    if(!Number.isFinite(actual)||actual<0){await c.query('ROLLBACK');return res.status(400).json({error:'Invalid actual quantity'})}
    if(variance!==0) await c.query(`INSERT INTO stock_transactions(ingredient_id,txn_type,qty_base,reference,note)
      VALUES($1,$2,$3,$4,$5)`,[b.ingredient_id,variance>0?'ADJUST_IN':'ADJUST_OUT',Math.abs(variance),`COUNT-${b.count_date||'TODAY'}`,b.reason||'ปรับยอดตามการตรวจนับจริง']);
    const row=(await c.query(`INSERT INTO daily_stock_counts(count_date,ingredient_id,expected_qty,actual_qty,variance_qty,reason,counted_by)
      VALUES(COALESCE($1::date,CURRENT_DATE),$2,$3,$4,$5,$6,$7)
      ON CONFLICT(count_date,ingredient_id) DO UPDATE SET expected_qty=EXCLUDED.expected_qty,actual_qty=EXCLUDED.actual_qty,
      variance_qty=EXCLUDED.variance_qty,reason=EXCLUDED.reason,counted_by=EXCLUDED.counted_by,counted_at=NOW()
      RETURNING *`,[b.count_date||null,b.ingredient_id,expected,actual,variance,b.reason||null,b.counted_by])).rows[0];
    await c.query('COMMIT');res.status(201).json(row);
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
});

app.get('/api/orders', async (_req,res)=>{
  const { rows }=await pool.query(`SELECT o.*,COALESCE(json_agg(oi ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL),'[]') items FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100`);
  res.json(rows);
});

app.post('/api/orders', async (req,res)=>{
  const c=await pool.connect();
  try{await c.query('BEGIN');const b=req.body;
    const total=(b.items||[]).reduce((sum,x)=>sum+Number(x.quantity)*Number(x.unit_price),0);
    const order=(await c.query(`INSERT INTO orders(order_type,customer,guest_count,note,phone,delivery_address,requested_at,total,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'WAITING') RETURNING *`,[b.order_type,b.customer,b.guest_count||null,b.note||null,b.phone||null,b.delivery_address||null,b.requested_at||null,total])).rows[0];
    for(const item of (b.items||[])){
      const recipeId=Number.isInteger(Number(item.recipe_id))?item.recipe_id:null;
      await c.query(`INSERT INTO order_items(order_id,recipe_id,menu_name,quantity,unit_price) VALUES($1,$2,$3,$4,$5)`,[order.id,recipeId,item.menu_name,item.quantity,item.unit_price]);
      if(recipeId){
        const components=(await c.query(`SELECT ri.ingredient_id,ri.qty_base*$2 AS required_qty,sb.stock_qty FROM recipe_items ri JOIN stock_balances sb ON sb.ingredient_id=ri.ingredient_id WHERE ri.recipe_id=$1`,[recipeId,item.quantity])).rows;
        for(const part of components){
          if(Number(part.stock_qty)<Number(part.required_qty)) throw new Error(`สต็อกไม่พอสำหรับ ${item.menu_name}`);
          await c.query(`INSERT INTO stock_transactions(ingredient_id,txn_type,qty_base,reference,note) VALUES($1,'USE',$2,$3,'ตัดสต็อกจาก POS')`,[part.ingredient_id,part.required_qty,`ORDER-${order.id}`]);
        }
      }
    }
    if(b.order_type==='DINE_IN') await c.query(`UPDATE restaurant_tables SET status='OCCUPIED',updated_at=NOW() WHERE name=$1`,[b.customer]);
    await c.query('COMMIT');res.status(201).json(order);
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
});

app.post('/api/orders/:id/serve',async(req,res)=>{
 const c=await pool.connect();try{await c.query('BEGIN');const order=(await c.query("SELECT * FROM orders WHERE id=$1 AND status NOT IN ('COMPLETED','CANCELLED') FOR UPDATE",[req.params.id])).rows[0];if(!order)throw Error('ไม่พบออเดอร์ที่เปิดอยู่');const ids=req.body.item_ids,staff=String(req.body.served_by||'').trim();if(!staff||!Array.isArray(ids)||!ids.length)throw Error('เลือกรายการที่ส่งและระบุชื่อพนักงาน');const valid=(await c.query('SELECT id FROM order_items WHERE order_id=$1 AND id=ANY($2::bigint[])',[order.id,ids])).rows;if(valid.length!==new Set(ids.map(String)).size)throw Error('รายการไม่ตรงกับออเดอร์');await c.query('UPDATE order_items SET served_at=NOW(),served_by=$1 WHERE order_id=$2 AND id=ANY($3::bigint[]) AND served_at IS NULL',[staff,order.id,ids]);const pending=(await c.query('SELECT id FROM order_items WHERE order_id=$1 AND served_at IS NULL',[order.id])).rows.length;const result=(await c.query("UPDATE orders SET status=$1,served_at=CASE WHEN $2 THEN NOW() ELSE NULL END,served_by=$3 WHERE id=$4 RETURNING *",[pending?'PREPARING':'READY',pending===0,staff,order.id])).rows[0];await c.query('COMMIT');return res.json(result)}catch(error){await c.query('ROLLBACK');return res.status(400).json({error:error.message})}finally{c.release()}
 const staff=String(req.body.served_by||'').trim();if(!staff||req.body.confirmed!==true)return res.status(400).json({error:'กรุณาตรวจครบรายการและระบุผู้ส่งอาหาร'});
 const row=(await pool.query("UPDATE orders SET served_by=$1,served_at=NOW(),status='READY' WHERE id=$2 AND status NOT IN ('COMPLETED','CANCELLED') RETURNING *",[staff,req.params.id])).rows[0];
 if(!row)return res.status(404).json({error:'ไม่พบออเดอร์ที่เปิดอยู่'});res.json(row);
});
app.post('/api/orders/:id/checkout', async (req,res)=>{
  const c=await pool.connect();
  try{await c.query('BEGIN');const b=req.body;
    const order=(await c.query(`UPDATE orders SET status='COMPLETED',payment_method=$1,paid_amount=$2,completed_at=NOW() WHERE id=$3 AND status='READY' AND served_at IS NOT NULL RETURNING *`,[b.payment_method,b.paid_amount,req.params.id])).rows[0];
    if(!order){await c.query('ROLLBACK');return res.status(404).json({error:'Order not found or already paid'})}
    if(order.order_type==='DINE_IN') await c.query(`UPDATE restaurant_tables SET status='AVAILABLE',updated_at=NOW() WHERE name=$1`,[order.customer]);
    await c.query('COMMIT');res.json(order);
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
});

app.put('/api/orders/:id', async (req,res)=>{
  const c=await pool.connect();
  try{await c.query('BEGIN');const b=req.body;
    const old=(await c.query(`SELECT * FROM orders WHERE id=$1 AND status<>'COMPLETED' FOR UPDATE`,[req.params.id])).rows[0];
    if(!old){await c.query('ROLLBACK');return res.status(404).json({error:'Order not found or already paid'})}
    await c.query("UPDATE orders SET served_at=NULL,served_by=NULL,status='WAITING' WHERE id=$1",[old.id]);
    const oldItems=(await c.query('SELECT * FROM order_items WHERE order_id=$1',[old.id])).rows;
    const locked=oldItems.filter(x=>x.served_at);const incoming=(b.items||[]).map(x=>({...x,quantity:Number(x.quantity)}));
    for(const item of locked){let remaining=Number(item.quantity);for(const next of incoming){if(String(next.recipe_id)===String(item.recipe_id)&&Number(next.unit_price)===Number(item.unit_price)&&next.menu_name===item.menu_name){const take=Math.min(remaining,next.quantity);remaining-=take;next.quantity-=take}}if(remaining>0)throw Error('ไม่สามารถแก้ไขหรือลบรายการที่เสิร์ฟแล้ว')}
    b.items=incoming.filter(x=>x.quantity>0);
    for(const item of oldItems){
      if(item.served_at)continue;
      if(!item.recipe_id)continue;
      const parts=(await c.query('SELECT ingredient_id,qty_base*$2 AS qty FROM recipe_items WHERE recipe_id=$1',[item.recipe_id,item.quantity])).rows;
      for(const part of parts)await c.query(`INSERT INTO stock_transactions(ingredient_id,txn_type,qty_base,reference,note) VALUES($1,'ADJUST_IN',$2,$3,'คืนสต็อกจากการแก้ไขออเดอร์')`,[part.ingredient_id,part.qty,`EDIT-${old.id}`]);
    }
    await c.query('DELETE FROM order_items WHERE order_id=$1 AND served_at IS NULL',[old.id]);
    const total=(b.items||[]).reduce((sum,x)=>sum+Number(x.quantity)*Number(x.unit_price),0)+locked.reduce((s,x)=>s+Number(x.quantity)*Number(x.unit_price),0);
    const updated=(await c.query(`UPDATE orders SET order_type=$1,customer=$2,guest_count=$3,note=$4,phone=$5,delivery_address=$6,requested_at=$7,total=$8 WHERE id=$9 RETURNING *`,[b.order_type,b.customer,b.guest_count||null,b.note||null,b.phone||null,b.delivery_address||null,b.requested_at||null,total,old.id])).rows[0];
    for(const item of (b.items||[])){
      const recipeId=Number.isInteger(Number(item.recipe_id))?item.recipe_id:null;
      await c.query(`INSERT INTO order_items(order_id,recipe_id,menu_name,quantity,unit_price) VALUES($1,$2,$3,$4,$5)`,[old.id,recipeId,item.menu_name,item.quantity,item.unit_price]);
      if(recipeId){
        const parts=(await c.query(`SELECT ri.ingredient_id,ri.qty_base*$2 AS qty,sb.stock_qty FROM recipe_items ri JOIN stock_balances sb ON sb.ingredient_id=ri.ingredient_id WHERE ri.recipe_id=$1`,[recipeId,item.quantity])).rows;
        for(const part of parts){if(Number(part.stock_qty)<Number(part.qty))throw new Error(`สต็อกไม่พอสำหรับ ${item.menu_name}`);await c.query(`INSERT INTO stock_transactions(ingredient_id,txn_type,qty_base,reference,note) VALUES($1,'USE',$2,$3,'ตัดสต็อกจากการแก้ไข POS')`,[part.ingredient_id,part.qty,`ORDER-${old.id}`])}
      }
    }
    if(locked.length&&!b.items.length)await c.query("UPDATE orders SET status='READY',served_at=NOW(),served_by=$1 WHERE id=$2",[locked[0].served_by,old.id]);
    else if(locked.length)await c.query("UPDATE orders SET status='PREPARING' WHERE id=$1",[old.id]);
    if(old.order_type==='DINE_IN'&&(b.order_type!=='DINE_IN'||old.customer!==b.customer))await c.query(`UPDATE restaurant_tables SET status='AVAILABLE',updated_at=NOW() WHERE name=$1`,[old.customer]);
    if(b.order_type==='DINE_IN')await c.query(`UPDATE restaurant_tables SET status='OCCUPIED',updated_at=NOW() WHERE name=$1`,[b.customer]);
    await c.query('COMMIT');res.json(updated);
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
});

app.delete('/api/orders/:id', async (req,res)=>{
  if((await pool.query('SELECT id FROM order_items WHERE order_id=$1 AND served_at IS NOT NULL LIMIT 1',[req.params.id])).rows.length)return res.status(409).json({error:'ยกเลิกไม่ได้ มีรายการเสิร์ฟแล้ว'});
  const c=await pool.connect();
  try{await c.query('BEGIN');
    const order=(await c.query(`SELECT * FROM orders WHERE id=$1 AND status<>'COMPLETED' FOR UPDATE`,[req.params.id])).rows[0];
    if(!order){await c.query('ROLLBACK');return res.status(404).json({error:'Order not found'})}
    const items=(await c.query('SELECT * FROM order_items WHERE order_id=$1',[order.id])).rows;
    for(const item of items){if(!item.recipe_id)continue;const parts=(await c.query('SELECT ingredient_id,qty_base*$2 AS qty FROM recipe_items WHERE recipe_id=$1',[item.recipe_id,item.quantity])).rows;for(const part of parts)await c.query(`INSERT INTO stock_transactions(ingredient_id,txn_type,qty_base,reference,note) VALUES($1,'ADJUST_IN',$2,$3,'คืนสต็อกจากการยกเลิกออเดอร์')`,[part.ingredient_id,part.qty,`CANCEL-${order.id}`])}
    await c.query(`UPDATE orders SET status='CANCELLED',completed_at=NOW() WHERE id=$1`,[order.id]);
    if(order.order_type==='DINE_IN')await c.query(`UPDATE restaurant_tables SET status='AVAILABLE',updated_at=NOW() WHERE name=$1`,[order.customer]);
    await c.query('COMMIT');res.status(204).end();
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
});

app.get('/api/reports/sales', async (req,res)=>{
  const period=req.query.period||'today';
  const intervalSql={today:`completed_at>=CURRENT_DATE`, '7days':`completed_at>=NOW()-INTERVAL '7 days'`, month:`completed_at>=DATE_TRUNC('month',CURRENT_DATE)`, all:'TRUE'}[period]||`completed_at>=CURRENT_DATE`;
  const totals=(await pool.query(`SELECT COALESCE(SUM(total),0) total,COUNT(*)::int order_count,COALESCE(SUM(total) FILTER(WHERE order_type IN ('DINE_IN','TAKEAWAY')),0) store_sales,COUNT(*) FILTER(WHERE order_type IN ('DINE_IN','TAKEAWAY'))::int store_count,COALESCE(SUM(total) FILTER(WHERE order_type='DELIVERY'),0) online_sales,COUNT(*) FILTER(WHERE order_type='DELIVERY')::int online_count FROM orders WHERE status='COMPLETED' AND ${intervalSql}`)).rows[0];
  const payments=(await pool.query(`SELECT payment_method,COALESCE(SUM(total),0) total,COUNT(*)::int count FROM orders WHERE status='COMPLETED' AND ${intervalSql} GROUP BY payment_method`)).rows;
  const cost=(await pool.query(`SELECT COALESCE(SUM(oi.quantity*rc.recipe_cost),0) theoretical_cost FROM orders o JOIN order_items oi ON oi.order_id=o.id JOIN recipe_costs rc ON rc.recipe_id=oi.recipe_id WHERE o.status='COMPLETED' AND ${intervalSql}`)).rows[0];
  const expenseFilter={today:'expense_date=CURRENT_DATE','7days':"expense_date>=CURRENT_DATE-6",month:"expense_date>=DATE_TRUNC('month',CURRENT_DATE)",all:'TRUE'}[period]||'expense_date=CURRENT_DATE';
  const expenses=(await pool.query(`SELECT COALESCE(SUM(amount),0) total FROM operating_expenses WHERE ${expenseFilter}`)).rows[0];
  res.json({period,totals,payments,theoretical_cost:cost.theoretical_cost,operating_expenses:expenses.total});
});

app.get('/api/reports/daily-control', async (_req,res)=>{
  const sales=(await pool.query(`WITH today_orders AS (
      SELECT * FROM orders WHERE status='COMPLETED' AND completed_at>=CURRENT_DATE
    ), totals AS (
      SELECT COALESCE(SUM(total),0) sales_total,COUNT(*)::int order_count FROM today_orders
    ), item_totals AS (
      SELECT COALESCE(SUM(oi.quantity) FILTER(WHERE r.category ~ '(เครื่องดื่ม|กาแฟ|ชา|โกโก้)'),0) drink_qty,
        COALESCE(SUM(oi.quantity) FILTER(WHERE r.category !~ '(เครื่องดื่ม|กาแฟ|ชา|โกโก้)'),0) food_qty,
        COALESCE(SUM(oi.quantity*rc.recipe_cost),0) theoretical_cost
      FROM today_orders o LEFT JOIN order_items oi ON oi.order_id=o.id LEFT JOIN recipes r ON r.id=oi.recipe_id
      LEFT JOIN recipe_costs rc ON rc.recipe_id=r.id
    ) SELECT * FROM totals CROSS JOIN item_totals`)).rows[0];
  const waste=(await pool.query(`SELECT COALESCE(SUM(st.qty_base*ic.cost_per_base_unit),0) waste_value,COUNT(*)::int waste_count
    FROM stock_transactions st JOIN ingredient_costs ic ON ic.id=st.ingredient_id
    WHERE st.txn_type='WASTE' AND st.txn_at>=CURRENT_DATE`)).rows[0];
  const counts=(await pool.query(`SELECT COUNT(*)::int count_items,COALESCE(SUM(ABS(dsc.variance_qty*ic.cost_per_base_unit)),0) variance_value
    FROM daily_stock_counts dsc JOIN ingredient_costs ic ON ic.id=dsc.ingredient_id WHERE dsc.count_date=CURRENT_DATE`)).rows[0];
  const reorder=(await pool.query(`SELECT sb.*,ic.supplier,ic.cost_per_base_unit FROM stock_balances sb JOIN ingredient_costs ic ON ic.id=sb.ingredient_id
    WHERE sb.stock_qty<=sb.reorder_level ORDER BY (sb.stock_qty-sb.reorder_level),sb.name`)).rows;
  res.json({sales,waste,counts,reorder});
});

app.get('/api/settings', async (_req,res)=>{
  const { rows }=await pool.query('SELECT * FROM store_settings WHERE id=1');
  res.json(rows[0]);
});

app.put('/api/settings', async (req,res)=>{
  const b=req.body;
  const { rows }=await pool.query(`UPDATE store_settings SET store_name=$1,tax_id=$2,phone=$3,email=$4,address=$5,vat_rate=$6,service_charge=$7,online_gp=$8,currency=$9,promptpay_type=$10,promptpay_id=$11,receipt_prefix=$12,receipt_footer=$13,opening_time=$14,closing_time=$15,food_cost_target=$16,low_stock_alert=$17,updated_at=NOW() WHERE id=1 RETURNING *`,[b.store_name,b.tax_id||null,b.phone||null,b.email||null,b.address||null,b.vat_rate||0,b.service_charge||0,b.online_gp??35,b.currency||'THB',b.promptpay_type||'PHONE',b.promptpay_id||null,b.receipt_prefix||'TPP',b.receipt_footer||null,b.opening_time||null,b.closing_time||null,b.food_cost_target||35,b.low_stock_alert!==false]);
  res.json(rows[0]);
});

app.get('/api/tables', async (_req,res)=>{
  const { rows }=await pool.query('SELECT * FROM restaurant_tables ORDER BY sort_order,id');
  res.json(rows);
});

app.post('/api/tables', async (req,res)=>{
  const b=req.body;
  const { rows }=await pool.query(`INSERT INTO restaurant_tables(name,seats,zone,status,sort_order) VALUES($1,$2,$3,$4,COALESCE((SELECT MAX(sort_order)+1 FROM restaurant_tables),1)) RETURNING *`,[b.name,b.seats,b.zone||null,b.status||'AVAILABLE']);
  res.status(201).json(rows[0]);
});

app.put('/api/tables/:id', async (req,res)=>{
  const b=req.body;
  const { rows }=await pool.query(`UPDATE restaurant_tables SET name=$1,seats=$2,zone=$3,status=$4,updated_at=NOW() WHERE id=$5 RETURNING *`,[b.name,b.seats,b.zone||null,b.status,req.params.id]);
  if(!rows[0]) return res.status(404).json({error:'Table not found'});
  res.json(rows[0]);
});

app.delete('/api/tables/:id', async (req,res)=>{
  const { rowCount }=await pool.query('DELETE FROM restaurant_tables WHERE id=$1',[req.params.id]);
  res.status(rowCount?204:404).end();
});

app.get('/api/purchase-orders', async (_req,res)=>{
  const { rows }=await pool.query(`SELECT po.*,poi.quantity,poi.unit_price,poi.ingredient_id,i.name ingredient_name
    FROM purchase_orders po LEFT JOIN LATERAL (SELECT * FROM purchase_order_items WHERE purchase_order_id=po.id ORDER BY id LIMIT 1) poi ON TRUE
    LEFT JOIN ingredients i ON i.id=poi.ingredient_id ORDER BY po.created_at DESC LIMIT 100`);
  res.json(rows);
});

app.post('/api/purchase-orders', async (req,res)=>{
  const b=req.body,poNumber=`PO-${Date.now().toString().slice(-8)}`,total=Number(b.quantity)*Number(b.unit_price);
  const c=await pool.connect();
  try{await c.query('BEGIN');
    const po=(await c.query(`INSERT INTO purchase_orders(po_number,supplier,expected_date,note,total) VALUES($1,$2,$3,$4,$5) RETURNING *`,[poNumber,b.supplier,b.expected_date||null,b.note||null,total])).rows[0];
    await c.query(`INSERT INTO purchase_order_items(purchase_order_id,ingredient_id,quantity,unit_price) VALUES($1,$2,$3,$4)`,[po.id,b.ingredient_id,b.quantity,b.unit_price]);
    await c.query('COMMIT');res.status(201).json(po);
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
});

app.post('/api/purchase-orders/:id/receive', async (req,res)=>{
  const c=await pool.connect();
  try{await c.query('BEGIN');
    const po=(await c.query('SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];
    if(!po||po.status==='RECEIVED'){await c.query('ROLLBACK');return res.status(400).json({error:'Invalid PO'})}
    const items=(await c.query(`SELECT poi.*,i.purchase_qty,i.conversion_to_base FROM purchase_order_items poi JOIN ingredients i ON i.id=poi.ingredient_id WHERE purchase_order_id=$1`,[po.id])).rows;
    let receivedTotal=0;
    for(const item of items){const quantity=Number(req.body.quantity||item.quantity),unitPrice=Number(req.body.unit_price??item.unit_price);receivedTotal+=quantity*unitPrice;await c.query('UPDATE purchase_order_items SET quantity=$1,unit_price=$2 WHERE id=$3',[quantity,unitPrice,item.id]);await c.query('UPDATE ingredients SET purchase_price=$1,updated_at=NOW() WHERE id=$2',[unitPrice,item.ingredient_id]);await c.query(`INSERT INTO stock_transactions(ingredient_id,txn_type,qty_base,unit_cost,reference,note) VALUES($1,'PURCHASE',$2,$3,$4,$5)`,[item.ingredient_id,quantity*Number(item.purchase_qty)*Number(item.conversion_to_base),unitPrice/(Number(item.purchase_qty)*Number(item.conversion_to_base)),po.po_number,`รับโดย ${req.body.received_by||'ไม่ระบุ'}${req.body.invoice_number?` · ใบส่งของ ${req.body.invoice_number}`:''}`]);}
    const updated=(await c.query(`UPDATE purchase_orders SET status='RECEIVED',total=$1,received_by=$2,invoice_number=$3,received_at=NOW() WHERE id=$4 RETURNING *`,[receivedTotal,req.body.received_by||null,req.body.invoice_number||null,po.id])).rows[0];
    await c.query('COMMIT');res.json(updated);
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
});

app.get('/api/reorder/suggestions', async (_req,res)=>{
  const { rows }=await pool.query(`SELECT sb.ingredient_id,sb.sku,sb.name,sb.base_unit,sb.stock_qty,sb.reorder_level,ic.purchase_qty,ic.purchase_unit,ic.purchase_price,ic.conversion_to_base,ic.supplier,GREATEST(1,CEIL((sb.reorder_level*2-sb.stock_qty)/NULLIF(ic.purchase_qty*ic.conversion_to_base,0))) suggested_quantity FROM stock_balances sb JOIN ingredient_costs ic ON ic.id=sb.ingredient_id WHERE sb.stock_qty<=sb.reorder_level AND sb.reorder_level>0 ORDER BY sb.stock_qty-sb.reorder_level,sb.name`);
  res.json(rows);
});

app.post('/api/reorder/generate', async (_req,res)=>{
  const suggestions=(await pool.query(`SELECT sb.ingredient_id,ic.purchase_price,ic.supplier,GREATEST(1,CEIL((sb.reorder_level*2-sb.stock_qty)/NULLIF(ic.purchase_qty*ic.conversion_to_base,0))) suggested_quantity FROM stock_balances sb JOIN ingredient_costs ic ON ic.id=sb.ingredient_id WHERE sb.stock_qty<=sb.reorder_level AND sb.reorder_level>0 AND ic.purchase_price>0 AND COALESCE(ic.supplier,'')<>''`)).rows;
  const c=await pool.connect(),created=[];try{await c.query('BEGIN');for(const item of suggestions){const poNumber=`AUTO-${Date.now().toString().slice(-8)}-${item.ingredient_id}`,total=Number(item.suggested_quantity)*Number(item.purchase_price);const po=(await c.query(`INSERT INTO purchase_orders(po_number,supplier,note,total) VALUES($1,$2,'สร้างอัตโนมัติจากจุดสั่งซื้อ',$3) RETURNING *`,[poNumber,item.supplier,total])).rows[0];await c.query('INSERT INTO purchase_order_items(purchase_order_id,ingredient_id,quantity,unit_price) VALUES($1,$2,$3,$4)',[po.id,item.ingredient_id,item.suggested_quantity,item.purchase_price]);created.push(po)}await c.query('COMMIT');res.status(201).json(created)}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
});

app.get('/api/production', async (_req,res)=>{
  const { rows }=await pool.query(`SELECT pb.*,o.name output_name,o.base_unit output_unit,i.name input_name FROM production_batches pb JOIN ingredients o ON o.id=pb.output_ingredient_id JOIN ingredients i ON i.id=pb.input_ingredient_id ORDER BY produced_at DESC LIMIT 100`);
  res.json(rows);
});

app.post('/api/production', async (req,res)=>{
  const b=req.body,c=await pool.connect();
  try{await c.query('BEGIN');
    const input=(await c.query(`SELECT ic.*,sb.stock_qty FROM ingredient_costs ic JOIN stock_balances sb ON sb.ingredient_id=ic.id WHERE ic.id=$1`,[b.input_ingredient_id])).rows[0];
    if(!input||Number(input.stock_qty)<Number(b.input_qty)){await c.query('ROLLBACK');return res.status(400).json({error:'Insufficient stock'})}
    const cost=Number(input.cost_per_base_unit)*Number(b.input_qty);
    const batch=(await c.query(`INSERT INTO production_batches(batch_code,output_ingredient_id,output_qty,input_ingredient_id,input_qty,total_cost,note) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[b.batch_code,b.output_ingredient_id,b.output_qty,b.input_ingredient_id,b.input_qty,cost,b.note||null])).rows[0];
    await c.query(`INSERT INTO stock_transactions(ingredient_id,txn_type,qty_base,reference,note) VALUES($1,'USE',$2,$3,'ใช้ในการผลิต')`,[b.input_ingredient_id,b.input_qty,b.batch_code]);
    await c.query(`INSERT INTO stock_transactions(ingredient_id,txn_type,qty_base,unit_cost,reference,note) VALUES($1,'ADJUST_IN',$2,$3,$4,'ผลผลิตจาก Batch')`,[b.output_ingredient_id,b.output_qty,cost/Number(b.output_qty),b.batch_code]);
    await c.query('COMMIT');res.status(201).json(batch);
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
});

app.get('/api/dashboard', async (_req,res)=>{
  const summary=(await pool.query(`SELECT COUNT(*)::int menu_count, ROUND(AVG(recipe_cost),2) avg_cost, ROUND(AVG(gross_profit),2) avg_profit, ROUND(AVG(food_cost_pct),2) avg_food_cost_pct FROM recipe_costs`)).rows[0];
  const low=(await pool.query(`SELECT * FROM stock_balances WHERE stock_qty<=reorder_level ORDER BY stock_qty ASC`)).rows;
  res.json({summary,lowStock:low});
});

app.use((err,_req,res,_next)=>{ console.error(err); res.status(500).json({error:err.message}); });
const port=process.env.PORT||3000;
const server=app.listen(port,()=>console.log(`Triple P Brew Manager: http://localhost:${port}`));

server.on('error',async error=>{
  console.error(`Server failed to start: ${error.message}`);
  await pool.end();
  process.exit(1);
});

async function shutdown(signal){
  console.log(`${signal} received, shutting down...`);
  server.close(async()=>{
    await pool.end();
    process.exit(0);
  });
}

process.once('SIGINT',()=>shutdown('SIGINT'));
process.once('SIGTERM',()=>shutdown('SIGTERM'));
