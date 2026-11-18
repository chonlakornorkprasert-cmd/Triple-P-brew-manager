import { pool } from '../config/database.js';

await pool.query("UPDATE ingredients SET stock_group='C',purchase_cycle_days=7,count_cycle_days=3");
await pool.query("UPDATE ingredients SET stock_group='D',purchase_cycle_days=21,count_cycle_days=7 WHERE category='บรรจุภัณฑ์' OR name ~ '(แก้ว|ฝา|หลอด|ถุง|ซีล|ชาม|กล่อง|ช้อน)'");
await pool.query("UPDATE ingredients SET stock_group='B',purchase_cycle_days=5,count_cycle_days=1 WHERE stock_group<>'D' AND name ~ '(นม|ข้นหวาน|ข้นจืด|เบสชา)'");
await pool.query("UPDATE ingredients SET stock_group='A',purchase_cycle_days=2,count_cycle_days=1 WHERE stock_group NOT IN ('D','B') AND name ~ '(หมู|ลูกชิ้น|ผัก|ถั่วงอก|เส้น|บะหมี่|ต้นหอม|กระดูก|ไชเท้า|รากผักชี|มะนาวสด)'");

const { rows } = await pool.query('SELECT stock_group,COUNT(*)::int count FROM ingredients GROUP BY stock_group ORDER BY stock_group');
console.log(rows);
await pool.end();
