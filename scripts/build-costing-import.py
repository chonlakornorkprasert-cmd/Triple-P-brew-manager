import json
import math
import sys
from collections import OrderedDict
from pathlib import Path

import openpyxl


source = Path(sys.argv[1])
output = Path(sys.argv[2])
book = openpyxl.load_workbook(source, data_only=True, read_only=True)


def is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


settings = OrderedDict()
for row in book["ตั้งค่า"].iter_rows(min_row=5, max_col=7, values_only=True):
    name, price, pack, unit, unit_cost, note, supplier = row
    if not isinstance(name, str) or name in {"สมมติฐานราคาขาย LINE MAN", "วัตถุดิบเพิ่มจากภาพ"}:
        continue
    if unit not in {"g", "ml", "แก้ว", "ชุด"}:
        continue
    settings[name] = {
        "price": float(price) if is_number(price) else 0,
        "pack": float(pack) if is_number(pack) and pack > 0 else 1,
        "unit": unit,
        "unit_cost": float(unit_cost) if is_number(unit_cost) else 0,
        "note": note,
        "supplier": supplier,
    }

recipe_rows = []
for row in book["สูตรและต้นทุน"].iter_rows(min_row=5, max_col=9, values_only=True):
    code, category, menu, ingredient, qty, unit, unit_cost, line_cost, note = row
    if not all(isinstance(value, str) and value for value in (code, category, menu, ingredient)) or not is_number(qty):
        continue
    recipe_rows.append({
        "code": code.strip(), "category": category.strip(), "menu": menu.strip(),
        "ingredient": ingredient.strip(), "qty": float(qty), "unit": str(unit or "หน่วย"),
        "unit_cost": float(unit_cost) if is_number(unit_cost) else 0,
        "line_cost": float(line_cost) if is_number(line_cost) else 0,
        "note": note,
    })

aliases = {
    "นมข้นหวาน": "นมข้นหวาน คาร์เนชั่น",
    "นมข้นจืด": "นมข้นจืด คาร์เนชั่น",
    "น้ำส้ม": "น้ำส้ม Tipco แมนดาริน",
    "น้ำมะนาว": "น้ำมะนาว (มะนาวป้อน ลูกละ4 บาท)",
    "ฟองนม (นมสด Meiji)": "ฟองนม (นมสด Meiji)",
}

ingredient_rows = OrderedDict()
for item in recipe_rows:
    name = item["ingredient"]
    setting = settings.get(aliases.get(name, name))
    if setting:
        price, pack, supplier, note = setting["price"], setting["pack"], setting["supplier"], setting["note"]
    else:
        price, pack, supplier, note = item["unit_cost"], 1, "ข้อมูลจากสูตร Excel", "สร้างจากต้นทุนต่อหน่วยในสูตร"
    category = "ค่าใช้จ่าย" if name in {"น้ำ/น้ำแข็ง/ไฟฟ้า", "น้ำ/น้ำแข็ง/ไฟฟ้า + หลอด/ถุง/ซีล", "ค่าแรงและค่าใช้จ่ายแฝง"} else ("บรรจุภัณฑ์" if any(word in name for word in ("แก้ว", "หลอด", "ถุง", "ซีล")) else "วัตถุดิบ")
    ingredient_rows.setdefault(name, {
        "name": name, "category": category, "purchase_qty": pack,
        "purchase_unit": f"แพ็ก {pack:g} {item['unit']}", "purchase_price": price,
        "base_unit": item["unit"], "conversion_to_base": 1,
        "reorder_level": 0, "supplier": supplier or note or "ไม่ระบุ",
    })

noodle_units = OrderedDict([
    ("เส้นเล็กหรือเส้นหมี่", "g"), ("บะหมี่ไข่", "g"), ("หมูสับ", "g"), ("ลูกชิ้นหมู", "g"),
    ("ถั่วงอก", "g"), ("ผักบุ้ง", "g"), ("ถั่วลิสงคั่วบด", "ช้อนโต๊ะ"), ("กระเทียมเจียว", "ช้อนโต๊ะ"),
    ("ต้นหอมผักชีซอย", "ชุด"), ("น้ำปลา", "ml"), ("น้ำมะนาวสด", "ml"), ("น้ำตาลทราย", "g"),
    ("พริกป่น", "g"), ("น้ำมันหมู", "ml"), ("กระดูกหมู", "g"), ("หัวไชเท้า", "หัว"),
    ("รากผักชี", "ราก"), ("กระเทียม", "กลีบ"), ("พริกไทยเม็ด", "ช้อนชา"),
    ("ซีอิ๊วขาว", "ml"), ("เกลือ", "g"), ("น้ำพริกเผา", "ml"),
])
for name, unit in noodle_units.items():
    ingredient_rows.setdefault(name, {"name": name, "category": "วัตถุดิบ", "purchase_qty": 1,
        "purchase_unit": f"1 {unit}", "purchase_price": 0, "base_unit": unit, "conversion_to_base": 1,
        "reorder_level": 0, "supplier": "รอกรอกราคาซื้อจริง"})

for index, ingredient in enumerate(ingredient_rows.values(), 1):
    ingredient["sku"] = f"ING-{index:03d}"

price_rows = {}
for row in book["สรุปราคา"].iter_rows(min_row=5, max_col=11, values_only=True):
    code, category, menu, cost, store_price, minimum, online_price, *_ = row
    if isinstance(code, str) and category and menu:
        price_rows[code.strip()] = {
            "store_price": float(store_price) if is_number(store_price) else None,
            "online_price": float(online_price) if is_number(online_price) else None,
        }

menus = OrderedDict()
for item in recipe_rows:
    menus.setdefault(item["code"], {"code": item["code"], "name": item["menu"], "category": item["category"], "items": [], "notes": []})
    menus[item["code"]]["items"].append({"ingredient": item["ingredient"], "qty": item["qty"]})
    if item["note"] and item["note"] not in menus[item["code"]]["notes"]:
        menus[item["code"]]["notes"].append(item["note"])

for menu in menus.values():
    cost = sum(next(row["line_cost"] for row in recipe_rows if row["code"] == menu["code"] and row["ingredient"] == part["ingredient"] and row["qty"] == part["qty"]) for part in menu["items"])
    prices = price_rows.get(menu["code"], {})
    menu["selling_price"] = prices.get("store_price") or math.ceil((cost / (1 - 0.45)) / 5) * 5
    menu["online_selling_price"] = prices.get("online_price") or math.ceil((cost / ((1 - 0.321) * (1 - 0.45))) / 5) * 5
    menu["serving_size"] = "20 oz"
    menu["note"] = " | ".join(menu.pop("notes"))

menus["NOODLE-DRY-TOMYUM"] = {
    "code": "NOODLE-DRY-TOMYUM", "name": "ก๋วยเตี๋ยวแห้งยำ", "category": "ก๋วยเตี๋ยว",
    "serving_size": "1 ชาม", "selling_price": 0, "online_selling_price": 0,
    "note": "แปลงจากสูตร 8–10 ชามโดยใช้ฐาน 10 ชาม; เสิร์ฟพร้อมน้ำซุป 1 ถ้วย",
    "items": [
        {"ingredient": "เส้นเล็กหรือเส้นหมี่", "qty": 100}, {"ingredient": "หมูสับ", "qty": 50},
        {"ingredient": "ลูกชิ้นหมู", "qty": 50}, {"ingredient": "ถั่วงอก", "qty": 50},
        {"ingredient": "ผักบุ้ง", "qty": 30}, {"ingredient": "ถั่วลิสงคั่วบด", "qty": 1.6},
        {"ingredient": "กระเทียมเจียว", "qty": 1.6}, {"ingredient": "ต้นหอมผักชีซอย", "qty": 1},
        {"ingredient": "น้ำปลา", "qty": 15}, {"ingredient": "น้ำมะนาวสด", "qty": 22.5},
        {"ingredient": "น้ำตาลทราย", "qty": 8}, {"ingredient": "พริกป่น", "qty": 3},
        {"ingredient": "น้ำมันหมู", "qty": 30}, {"ingredient": "น้ำ", "qty": 240},
    ],
}
menus["NOODLE-BA-MEE-TOMYUM"] = {
    "code": "NOODLE-BA-MEE-TOMYUM", "name": "บะหมี่ต้มยำ", "category": "ก๋วยเตี๋ยว",
    "serving_size": "1 ชาม", "selling_price": 0, "online_selling_price": 0,
    "note": "สูตรมาตรฐานต่อชาม แปลงจากสูตร 4 ชาม รวมส่วนแบ่งวัตถุดิบน้ำซุป",
    "items": [
        {"ingredient": "บะหมี่ไข่", "qty": 125}, {"ingredient": "หมูสับ", "qty": 75},
        {"ingredient": "ลูกชิ้นหมู", "qty": 50}, {"ingredient": "ถั่วงอก", "qty": 50},
        {"ingredient": "ผักบุ้ง", "qty": 50}, {"ingredient": "ถั่วลิสงคั่วบด", "qty": 1},
        {"ingredient": "กระเทียมเจียว", "qty": 1}, {"ingredient": "ต้นหอมผักชีซอย", "qty": 1},
        {"ingredient": "กระดูกหมู", "qty": 250}, {"ingredient": "น้ำ", "qty": 1000},
        {"ingredient": "หัวไชเท้า", "qty": 0.25}, {"ingredient": "รากผักชี", "qty": 0.75},
        {"ingredient": "กระเทียม", "qty": 2.5}, {"ingredient": "พริกไทยเม็ด", "qty": 0.25},
        {"ingredient": "ซีอิ๊วขาว", "qty": 11.25}, {"ingredient": "เกลือ", "qty": 1.25},
        {"ingredient": "น้ำพริกเผา", "qty": 15}, {"ingredient": "น้ำปลา", "qty": 15},
        {"ingredient": "น้ำมะนาวสด", "qty": 22.5}, {"ingredient": "น้ำตาลทราย", "qty": 4},
        {"ingredient": "พริกป่น", "qty": 3},
    ],
}

payload = {
    "source": str(source),
    "source_modified": source.stat().st_mtime,
    "online_gp_percent": 32.1,
    "ingredients": list(ingredient_rows.values()),
    "recipes": list(menus.values()),
    "missing_cost_ingredients": [row["name"] for row in ingredient_rows.values() if row["purchase_price"] == 0],
    "generated_price_codes": [code for code in menus if code not in price_rows],
}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({
    "ingredients": len(payload["ingredients"]), "recipes": len(payload["recipes"]),
    "recipe_items": sum(len(recipe["items"]) for recipe in payload["recipes"]),
    "missing_cost_ingredients": payload["missing_cost_ingredients"],
    "generated_price_codes": payload["generated_price_codes"],
}, ensure_ascii=False))
