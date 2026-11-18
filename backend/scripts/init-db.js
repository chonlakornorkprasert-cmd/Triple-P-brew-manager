import { readFile } from 'node:fs/promises';
import { pool } from '../config/database.js';
import { replaceWithCostingData } from './costing-importer.js';

try {
  const existing=await pool.query("SELECT to_regclass('public.orders') AS orders_table");
  if(existing.rows[0].orders_table)throw new Error('ฐานข้อมูลมีอยู่แล้ว ใช้ db:migrate เพื่อปรับโครงสร้างโดยเก็บข้อมูลเดิม');
  const schema = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
  const seed = await readFile(new URL('../database/seed.sql', import.meta.url), 'utf8');
  await pool.exec(schema);
  await pool.exec(seed);
  const costingData=JSON.parse(await readFile(new URL('../database/costing-import.json', import.meta.url),'utf8'));
  const client=await pool.connect();
  try{await client.query('BEGIN');await replaceWithCostingData(client,costingData);await client.query('COMMIT')}
  catch(error){await client.query('ROLLBACK');throw error}
  finally{client.release()}
  console.log(`Database schema and initial data are ready (${pool.driver}).`);
} catch (error) {
  console.error('Database initialization failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
