import {mkdir,writeFile,readFile} from 'node:fs/promises';
const plans=[
 ['กระดูกหมู',70,1000,'ถุง 1 กก.','ประมาณ 70 บาท/กก.'],
 ['ต้นหอมผักชีซอย',1,1,'ชุด 10 กรัม','ประมาณ 100 บาท/กก.; 1 ชุด=10g'],
 ['ถั่วงอก',25,1000,'ถุง 1 กก.','Makro ราคาอ้างอิง 25 บาท/กก.'],
 ['น้ำมะนาวสด',140,1000,'ขวด 1 ลิตร','ประมาณน้ำคั้น 140 บาท/ลิตร'],
 ['น้ำมันหมู',90,1000,'ขวด 1 ลิตร','ประมาณ 90 บาท/ลิตร'],
 ['บะหมี่ไข่',65,1000,'ถุง 1 กก.','ประมาณ 65 บาท/กก.'],
 ['ผักบุ้ง',30,1000,'ถุง 1 กก.','ประมาณ 30 บาท/กก.'],
 ['รากผักชี',0.65,1,'ราก 5 กรัม','ประมาณ 130 บาท/กก.; 1 ราก=5g'],
 ['ลูกชิ้นหมู',120,1000,'ถุง 1 กก.','ประมาณ 120 บาท/กก.'],
 ['หมูสับ',160,1000,'ถุง 1 กก.','ประมาณ 160 บาท/กก.'],
 ['หัวไชเท้า',15,1,'หัว 500 กรัม','ประมาณ 30 บาท/กก.; 1 หัว=500g'],
 ['เส้นเล็กหรือเส้นหมี่',35,1000,'ถุงสด 1 กก.','ประมาณเส้นสด 35 บาท/กก.; ไม่ใช่เส้นแห้ง']
];
const response=await fetch('http://localhost:3001/api/ingredients');if(!response.ok)throw Error('อ่านข้อมูลไม่ได้');const items=await response.json();
const backup=items.filter(x=>plans.some(p=>p[0]===x.name));await mkdir('backups',{recursive:true});await writeFile(`backups/before-planning-prices-${Date.now()}.json`,JSON.stringify(backup,null,2));
for(const [name,price,qty,unit,note] of plans){const item=items.find(x=>x.name===name);if(!item)throw Error(`ไม่พบ ${name}`);const payload={...item,purchase_price:price,purchase_qty:qty,purchase_unit:unit,conversion_to_base:1,supplier:`ราคาวางแผน 2026-11-03 | ${note} | รอใบซื้อจริง`};const saved=await fetch(`http://localhost:3001/api/ingredients/${item.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!saved.ok)throw Error(await saved.text());console.log(`${name}: ${price/qty} บาท/${item.base_unit}`)}
const path=new URL('../database/costing-import.json',import.meta.url),data=JSON.parse(await readFile(path,'utf8'));
for(const [name,price,qty,unit,note] of plans){const item=data.ingredients.find(x=>x.name===name);if(item)Object.assign(item,{purchase_price:price,purchase_qty:qty,purchase_unit:unit,conversion_to_base:1,supplier:`ราคาวางแผน 2026-11-03 | ${note} | รอใบซื้อจริง`})}
await writeFile(path,JSON.stringify(data,null,2)+'\n');
