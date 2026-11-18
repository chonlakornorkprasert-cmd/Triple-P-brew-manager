import assert from 'node:assert/strict';
import {pool} from '../config/database.js';
const client=await pool.connect();
try{
 await client.query('BEGIN');
 const before=(await client.query('SELECT COUNT(*)::int count FROM orders')).rows[0].count;
 const order=(await client.query("INSERT INTO orders(order_type,customer,total) VALUES('TAKEAWAY','VERIFY-ROLLBACK',125) RETURNING *")).rows[0];
 assert.equal(Number(order.total),125);
 await client.query("UPDATE orders SET served_by='VERIFY',served_at=NOW(),status='READY' WHERE id=$1",[order.id]);
 await client.query("UPDATE orders SET status='COMPLETED',payment_method='CASH',paid_amount=125,completed_at=NOW() WHERE id=$1",[order.id]);
 assert.equal((await client.query('SELECT status FROM orders WHERE id=$1',[order.id])).rows[0].status,'COMPLETED');
 const ingredient=(await client.query('SELECT id FROM ingredients ORDER BY id LIMIT 1')).rows[0];
 const start=Number((await client.query('SELECT stock_qty FROM stock_balances WHERE ingredient_id=$1',[ingredient.id])).rows[0].stock_qty);
 for(const [type,qty] of [['OPENING',10],['PURCHASE',5],['USE',3],['WASTE',1]])await client.query('INSERT INTO stock_transactions(ingredient_id,txn_type,qty_base) VALUES($1,$2,$3)',[ingredient.id,type,qty]);
 assert.equal(Number((await client.query('SELECT stock_qty FROM stock_balances WHERE ingredient_id=$1',[ingredient.id])).rows[0].stock_qty),start+11);
 await client.query('ROLLBACK');
 assert.equal((await client.query('SELECT COUNT(*)::int count FROM orders')).rows[0].count,before);
 console.log('PASS: order write/read/status/payment; Opening + Receive - Sales - Waste; rollback preserves shop data');
}finally{client.release();await pool.end()}
