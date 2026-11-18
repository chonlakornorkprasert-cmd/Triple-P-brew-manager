import { readFile } from 'node:fs/promises';
import { pool } from '../config/database.js';

try{
  const schema=await readFile(new URL('../database/schema.sql',import.meta.url),'utf8');
  await pool.exec(schema);
  console.log('Database schema migration completed.');
}finally{
  await pool.end();
}
