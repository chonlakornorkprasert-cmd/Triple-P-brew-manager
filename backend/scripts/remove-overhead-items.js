import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pool} from '../config/database.js';
const names=['น้ำ/น้ำแข็ง/ไฟฟ้า','น้ำ/น้ำแข็ง/ไฟฟ้า + หลอด/ถุง/ซีล'];
const c=await pool.connect();
try{await c.query('BEGIN');const ingredients=(await c.query('SELECT * FROM ingredients WHERE name=ANY($1::text[])',[names])).rows;
 const ids=ingredients.map(x=>x.id);const items=(await c.query('SELECT * FROM recipe_items WHERE ingredient_id=ANY($1::int[])',[ids])).rows;
 await mkdir('backups',{recursive:true});await writeFile(`backups/removed-overhead-${Date.now()}.json`,JSON.stringify({ingredients,recipe_items:items},null,2));
 await c.query('DELETE FROM recipe_items WHERE ingredient_id=ANY($1::int[])',[ids]);
 for(const id of ids){const history=(await c.query('SELECT 1 FROM stock_transactions WHERE ingredient_id=$1 LIMIT 1',[id])).rows;if(history.length)throw Error('รายการมีประวัติสต็อก ต้องเก็บประวัติไว้');await c.query('DELETE FROM ingredients WHERE id=$1',[id])}
 await c.query('COMMIT');
 const path=new URL('../database/costing-import.json',import.meta.url),data=JSON.parse(await readFile(path,'utf8'));data.ingredients=data.ingredients.filter(x=>!names.includes(x.name));for(const recipe of data.recipes)recipe.items=recipe.items.filter(x=>!names.includes(x.ingredient));await writeFile(path,JSON.stringify(data,null,2)+'\n');
 console.log(JSON.stringify({removed:ingredients.map(x=>x.name),recipe_items_removed:items.length}));
}catch(error){await c.query('ROLLBACK');throw error}finally{c.release();await pool.end()}
