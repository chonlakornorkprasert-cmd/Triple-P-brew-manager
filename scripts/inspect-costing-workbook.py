import json
import sys

import openpyxl

book = openpyxl.load_workbook(sys.argv[1], data_only=False, read_only=True)
values_book = openpyxl.load_workbook(sys.argv[1], data_only=True, read_only=True)
print(json.dumps([
    {"sheet": sheet.title, "rows": sheet.max_row, "cols": sheet.max_column}
    for sheet in book.worksheets
], ensure_ascii=False))

for sheet in book.worksheets:
    print(f"---{sheet.title}")
    for row in sheet.iter_rows(min_row=1, max_row=min(sheet.max_row, 18), values_only=True):
        print(json.dumps(list(row), ensure_ascii=False, default=str))

print("---DATA SUMMARY")
for name, start_row, end_col in [("สรุปราคา", 5, 11), ("สูตรและต้นทุน", 5, 9), ("ตั้งค่า", 5, 7)]:
    sheet = values_book[name]
    rows = [list(row) for row in sheet.iter_rows(min_row=start_row, max_col=end_col, values_only=True) if any(v is not None for v in row)]
    print(name, len(rows))
    print(json.dumps(rows, ensure_ascii=False, default=str))

menu_rows = [row for row in values_book["สรุปราคา"].iter_rows(min_row=5, max_col=11, values_only=True) if isinstance(row[0], str) and row[1] and row[2]]
recipe_rows = [row for row in values_book["สูตรและต้นทุน"].iter_rows(min_row=5, max_col=9, values_only=True) if isinstance(row[0], str) and row[1] and row[2] and row[3]]
codes = list(dict.fromkeys(row[0] for row in recipe_rows))
priced = {row[0] for row in menu_rows}
ingredients = list(dict.fromkeys(row[3] for row in recipe_rows))
print("---MAPPING")
print(json.dumps({"menu_rows": len(menu_rows), "recipe_rows": len(recipe_rows), "recipe_codes": codes, "missing_price_codes": [code for code in codes if code not in priced], "ingredient_names": ingredients}, ensure_ascii=False))
