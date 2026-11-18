-- ข้อมูลตั้งต้นอ้างอิงจาก profit_calculator_detailed.xlsx
INSERT INTO ingredients (sku,name,category,purchase_qty,purchase_unit,purchase_price,base_unit,conversion_to_base,reorder_level)
VALUES
('RAW-THAI-TEA','ผงชาไทย','วัตถุดิบ',1,'กก.',180,'กรัม',1000,200),
('TEA-CHA-TRA-MUE-GOLD','ชาตรามือ Gold Label (ฉลากทอง)','วัตถุดิบ',1,'ถุง 400 กรัม',128,'กรัม',400,200),
('TEA-CHANG-THONG-CEYLON','ชาช้างทอง ซีลอน','วัตถุดิบ',1,'ถุง 400 กรัม',88,'กรัม',400,200),
('TEA-CHA-TRA-MUE-RED','ชาตรามือ สีแดง (ฉลากแดง)','วัตถุดิบ',1,'ถุง 400 กรัม',104,'กรัม',400,200),
('BASE-THAI-TEA-18G','เบสชาไทยแห้ง 50/25/25 (ช็อต 18 กรัม)','วัตถุดิบกึ่งสำเร็จรูป',1,'ช็อต 18 กรัม',5.04,'ช็อต',1,10),
('MILK-FRESH-1L','นมสด UHT / พาสเจอร์ไรส์','วัตถุดิบ',1,'กล่อง 1 ลิตร',44,'มล.',1000,2000),
('MILK-SWEET-COND-CAN','นมข้นหวาน / ครีมเทียมข้นหวาน (กระป๋อง)','วัตถุดิบ',1,'กระป๋อง 384 กรัม',26.50,'กรัม',384,500),
('MILK-SWEET-COND-BAG','นมข้นหวาน / ครีมเทียมข้นหวาน (ถุง)','วัตถุดิบ',1,'ถุง 1 กก.',65,'กรัม',1000,1000),
('MILK-EVAP-CAN','นมข้นจืด / ครีมเทียมพร่องไขมัน','วัตถุดิบ',1,'กระป๋อง 395 กรัม',25.50,'กรัม',395,500),
('RAW-GREEN-TEA','ผงชาเขียว','วัตถุดิบ',1,'กก.',450,'กรัม',1000,200),
('RAW-COCOA','ผงโกโก้','วัตถุดิบ',1,'กก.',350,'กรัม',1000,200),
('RAW-SWEET-COND','นมข้นหวาน','วัตถุดิบ',1,'กระป๋อง (380 ก.)',25,'กรัม',380,100),
('RAW-EVAP-MILK','นมข้นจืด','วัตถุดิบ',1,'กระป๋อง (410 ก.)',22,'กรัม',410,100),
('RAW-SUGAR','น้ำตาลทราย','วัตถุดิบ',1,'กก.',28,'กรัม',1000,500),
('RAW-ICE','น้ำแข็ง','วัตถุดิบ',1,'กก.',5,'กรัม',1000,2000),
('RAW-RICE','ข้าวสวย (หุงสุก)','วัตถุดิบ',1,'กก.',35,'กรัม',1000,1000),
('RAW-EGG','ไข่ไก่','วัตถุดิบ',1,'แผง (30 ฟอง)',150,'ฟอง',30,15),
('RAW-SAUSAGE','ไส้กรอก','วัตถุดิบ',1,'แพ็ค (10 ชิ้น)',60,'ชิ้น',10,10),
('RAW-BREAD','ขนมปัง','วัตถุดิบ',1,'แถว (10 แผ่น)',35,'แผ่น',10,10),
('RAW-SEASON-RICE','เครื่องปรุง/ผักโรยหน้า (ข้าวไข่ข้น)','วัตถุดิบ',1,'ชุดต่อจาน',2,'จาน',1,10),
('RAW-SEASON-EGG','เครื่องปรุง/ผักโรยหน้า (ไข่กระทะ)','วัตถุดิบ',1,'ชุดต่อจาน',3,'จาน',1,10),
('PKG-CUP16','แก้วพลาสติก+ฝา 16oz','บรรจุภัณฑ์',1,'ใบ',2,'ใบ',1,50),
('PKG-STRAW','หลอดพลาสติก','บรรจุภัณฑ์',1,'อัน',0.30,'อัน',1,50),
('PKG-CUP-BAG','ถุงหูหิ้วใส่แก้ว','บรรจุภัณฑ์',1,'ใบ',0.50,'ใบ',1,50),
('PKG-RICE-BOX','กล่องข้าว','บรรจุภัณฑ์',1,'กล่อง',3.50,'กล่อง',1,30),
('PKG-SPOON','ช้อนพลาสติก','บรรจุภัณฑ์',1,'อัน',0.50,'อัน',1,50),
('PKG-EGG-BOX','กล่องไข่กระทะกันรั่ว','บรรจุภัณฑ์',1,'กล่อง',4.50,'กล่อง',1,30),
('PKG-FOOD-BAG','ถุงหูหิ้วใส่อาหาร','บรรจุภัณฑ์',1,'ใบ',0.50,'ใบ',1,50)
ON CONFLICT (sku) DO UPDATE SET
 name=EXCLUDED.name, category=EXCLUDED.category, purchase_qty=EXCLUDED.purchase_qty,
 purchase_unit=EXCLUDED.purchase_unit, purchase_price=EXCLUDED.purchase_price,
 base_unit=EXCLUDED.base_unit, conversion_to_base=EXCLUDED.conversion_to_base,
 reorder_level=EXCLUDED.reorder_level, updated_at=NOW();

UPDATE ingredients
SET supplier='Makro', expiry_date='2027-12-15'
WHERE sku IN ('TEA-CHA-TRA-MUE-GOLD','TEA-CHANG-THONG-CEYLON','TEA-CHA-TRA-MUE-RED');

UPDATE ingredients
SET supplier='ผลิตภายในร้าน', barcode='BASE-THAI-TEA-18G'
WHERE sku='BASE-THAI-TEA-18G';

INSERT INTO recipes(code,name,category,serving_size,selling_price,online_selling_price)
VALUES
('DRK-THAI-TEA','ชาไทยเย็น','เครื่องดื่ม','20 oz',35,45),
('DRK-GREEN-TEA','ชาเขียวเย็น','เครื่องดื่ม','16 oz',35,45),
('DRK-COCOA','โกโก้เย็น','เครื่องดื่ม','16 oz',40,50),
('FOOD-CREAMY-EGG-RICE','ข้าวไข่ข้น','อาหารจานหลัก','1 จาน',45,55),
('FOOD-PAN-EGG','ไข่กระทะ','อาหารจานหลัก','1 จาน',55,70)
ON CONFLICT (code) DO UPDATE SET
 name=EXCLUDED.name, category=EXCLUDED.category, serving_size=EXCLUDED.serving_size,
 selling_price=EXCLUDED.selling_price, online_selling_price=EXCLUDED.online_selling_price, updated_at=NOW();

-- รีเซ็ตสูตรของเมนูตั้งต้น เพื่อให้การรันซ้ำได้สูตรล่าสุดโดยไม่มีวัตถุดิบเก่าค้างอยู่
DELETE FROM recipe_items
WHERE recipe_id IN (
  SELECT id FROM recipes WHERE code IN (
    'DRK-THAI-TEA','DRK-GREEN-TEA','DRK-COCOA',
    'FOOD-CREAMY-EGG-RICE','FOOD-PAN-EGG'
  )
);

INSERT INTO recipe_items(recipe_id,ingredient_id,qty_base)
SELECT r.id,i.id,x.qty
FROM (VALUES
 ('DRK-THAI-TEA','TEA-CHA-TRA-MUE-GOLD',9.0),('DRK-THAI-TEA','TEA-CHANG-THONG-CEYLON',4.5),('DRK-THAI-TEA','TEA-CHA-TRA-MUE-RED',4.5),('DRK-THAI-TEA','MILK-FRESH-1L',80.0),('DRK-THAI-TEA','MILK-SWEET-COND-CAN',39.0),('DRK-THAI-TEA','MILK-EVAP-CAN',31.0),('DRK-THAI-TEA','RAW-ICE',150.0),('DRK-THAI-TEA','PKG-CUP16',1.0),('DRK-THAI-TEA','PKG-STRAW',1.0),('DRK-THAI-TEA','PKG-CUP-BAG',1.0),
 ('DRK-GREEN-TEA','RAW-GREEN-TEA',15.0),('DRK-GREEN-TEA','RAW-EVAP-MILK',30.0),('DRK-GREEN-TEA','RAW-SUGAR',15.0),('DRK-GREEN-TEA','RAW-ICE',150.0),('DRK-GREEN-TEA','PKG-CUP16',1.0),('DRK-GREEN-TEA','PKG-STRAW',1.0),('DRK-GREEN-TEA','PKG-CUP-BAG',1.0),
 ('DRK-COCOA','RAW-COCOA',20.0),('DRK-COCOA','RAW-EVAP-MILK',30.0),('DRK-COCOA','RAW-SUGAR',15.0),('DRK-COCOA','RAW-ICE',150.0),('DRK-COCOA','PKG-CUP16',1.0),('DRK-COCOA','PKG-STRAW',1.0),('DRK-COCOA','PKG-CUP-BAG',1.0),
 ('FOOD-CREAMY-EGG-RICE','RAW-RICE',200.0),('FOOD-CREAMY-EGG-RICE','RAW-EGG',2.0),('FOOD-CREAMY-EGG-RICE','RAW-SEASON-RICE',1.0),('FOOD-CREAMY-EGG-RICE','PKG-RICE-BOX',1.0),('FOOD-CREAMY-EGG-RICE','PKG-SPOON',1.0),('FOOD-CREAMY-EGG-RICE','PKG-FOOD-BAG',1.0),
 ('FOOD-PAN-EGG','RAW-EGG',2.5),('FOOD-PAN-EGG','RAW-SAUSAGE',2.0),('FOOD-PAN-EGG','RAW-BREAD',2.0),('FOOD-PAN-EGG','RAW-SEASON-EGG',1.0),('FOOD-PAN-EGG','PKG-EGG-BOX',1.0),('FOOD-PAN-EGG','PKG-FOOD-BAG',1.0)
) x(recipe_code,sku,qty)
JOIN recipes r ON r.code=x.recipe_code
JOIN ingredients i ON i.sku=x.sku
ON CONFLICT (recipe_id,ingredient_id) DO UPDATE SET qty_base=EXCLUDED.qty_base;

-- ยอดเปิดสต็อกเท่ากับจุดสั่งซื้อ x 3 เพื่อให้พร้อมทดลองใช้งาน
INSERT INTO stock_transactions(ingredient_id,txn_type,qty_base,unit_cost,reference,note)
SELECT i.id,'OPENING',i.reorder_level*3,ic.cost_per_base_unit,'XLSX-INITIAL','ข้อมูลตั้งต้นจาก profit_calculator_detailed.xlsx'
FROM ingredients i JOIN ingredient_costs ic ON ic.id=i.id
WHERE i.reorder_level>0 AND NOT EXISTS (
 SELECT 1 FROM stock_transactions st WHERE st.ingredient_id=i.id AND st.reference='XLSX-INITIAL'
);

INSERT INTO restaurant_tables(name,seats,zone,status,sort_order)
SELECT 'โต๊ะ '||n, CASE WHEN n%3=0 THEN 4 ELSE 2 END,
       CASE WHEN n<=8 THEN 'Indoor' ELSE 'Garden' END,
       CASE WHEN n IN (2,3,5,6,8,10,12) THEN 'OCCUPIED' ELSE 'AVAILABLE' END, n
FROM generate_series(1,12) n
ON CONFLICT(name) DO NOTHING;
