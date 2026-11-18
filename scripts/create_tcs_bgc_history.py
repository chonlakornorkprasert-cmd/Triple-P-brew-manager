from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "TCS_BGC_Employment_History_Chonlakorn.pdf"

FONT_REGULAR = Path(r"C:\Windows\Fonts\tahoma.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\tahomabd.ttf")

pdfmetrics.registerFont(TTFont("Tahoma", str(FONT_REGULAR)))
pdfmetrics.registerFont(TTFont("Tahoma-Bold", str(FONT_BOLD)))


records = [
    ("1", "ส.ค. 2547 (Aug 2004)", "มี.ค. 2548 (Mar 2005)", "ทอสเท็มไทย"),
    ("2", "เม.ย. 2548 (Apr 2005)", "ก.ค. 2548 (Jul 2005)", "ประกันภัยไทยวิวัฒน์"),
    ("3", "ส.ค. 2548 (Aug 2005)", "ก.ย. 2549 (Sep 2006)", "สมาร์ท ไฮเวย์"),
    ("4", "ต.ค. 2549 (Oct 2006)", "มี.ค. 2550 (Mar 2007)", "เวสเทิร์น ดิจิตอล (ประเทศไทย) สาขานวนคร"),
    ("5", "เม.ย. 2550 (Apr 2007)", "ก.พ. 2553 (Feb 2010)", "ไมโครชิพ เทคโนโลยี (ไทยแลนด์)"),
    ("6", "มี.ค. 2553 (Mar 2010)", "เม.ย. 2553 (Apr 2010)", "อินฟินิตี ไอที ซัคเชส"),
    ("7", "พ.ค. 2553 (May 2010)", "ก.ย. 2553 (Sep 2010)", "เวสเทิร์น ดิจิตอล (ประเทศไทย) สาขานวนคร"),
    ("8", "ต.ค. 2553 (Oct 2010)", "มิ.ย. 2554 (Jun 2011)", "ฟูจิฟิล์ม บิสซิเนส อินโนเวชั่น"),
    ("9", "ก.ค. 2554 (Jul 2011)", "ก.ค. 2554 (Jul 2011)", "สแต็ทส์ ชิพแพ็ค (ประเทศไทย)"),
    ("10", "ส.ค. 2554 (Aug 2011)", "พ.ค. 2555 (May 2012)", "เอ็นเอ็กซ์พี แมนูแฟคเจอริ่ง (ไทยแลนด์)"),
    ("11", "มิ.ย. 2555 (Jun 2012)", "ต.ค. 2555 (Oct 2012)", "เอสซีลอร์ แมนูแฟ็คเจอริ่ง (ประเทศไทย)"),
    ("12", "พ.ย. 2555 (Nov 2012)", "ธ.ค. 2557 (Dec 2014)", "อนาล็อก ดีไวเซส (ประเทศไทย)"),
    ("13", "ม.ค. 2558 (Jan 2015)", "ส.ค. 2558 (Aug 2015)", "กรุงไทย-แอกซ่า ประกันชีวิต"),
    ("14", "ก.ย. 2558 (Sep 2015)", "ธ.ค. 2561 (Dec 2018)", "ซีทีซี โกลบอล (ประเทศไทย)"),
    ("15", "ม.ค. 2562 (Jan 2019)", "เม.ย. 2563 (Apr 2020)", "โทเทิ่ล แอ็คเซ็ส คอมมูนิเคชั่น"),
    ("16", "พ.ค. 2563 (May 2020)", "มิ.ย. 2564 (Jun 2021)", "ซีทีซี โกลบอล (ประเทศไทย)"),
    ("17", "ก.ค. 2564 (Jul 2021)", "ส.ค. 2564 (Aug 2021)", "โกซอฟท์ (ประเทศไทย)"),
    ("18", "ก.ย. 2564 (Sep 2021)", "มี.ค. 2565 (Mar 2022)", "ซีทีซี โกลบอล (ประเทศไทย)"),
    ("19", "เม.ย. 2565 (Apr 2022)", "มิ.ย. 2565 (Jun 2022)", "ทรู มูฟ เอช ยูนิเวอร์แซล คอมมิวนิเคชั่น"),
    ("20", "ก.ค. 2565 (Jul 2022)", "ม.ค. 2566 (Jan 2023)", "เอสซีบี เทคเอกซ์"),
    ("21", "ก.พ. 2566 (Feb 2023)", "พ.ย. 2567 (Nov 2024)", "โคฟอร์จ"),
    ("22", "ธ.ค. 2567 (Dec 2024)", "ม.ค. 2568 (Jan 2025)", "แอสเซนด์ คอมเมิร์ซ"),
    ("23", "มี.ค. 2568 (Mar 2025)", "ก.ย. 2569 (Sep 2026)", "เดอะ พรอดดิจี (ประเทศไทย)"),
]


styles = getSampleStyleSheet()
title = ParagraphStyle(
    "TitleThai", parent=styles["Title"], fontName="Tahoma-Bold", fontSize=16,
    leading=21, alignment=TA_CENTER, textColor=colors.HexColor("#17324D"), spaceAfter=5*mm,
)
subtitle = ParagraphStyle(
    "Subtitle", parent=styles["Normal"], fontName="Tahoma", fontSize=8.7,
    leading=12, alignment=TA_CENTER, textColor=colors.HexColor("#536273"), spaceAfter=5*mm,
)
body = ParagraphStyle(
    "BodyThai", parent=styles["BodyText"], fontName="Tahoma", fontSize=9,
    leading=13, alignment=TA_LEFT, textColor=colors.HexColor("#263442"),
)
small = ParagraphStyle(
    "SmallThai", parent=body, fontSize=7.7, leading=10.5,
)
small_bold = ParagraphStyle(
    "SmallBoldThai", parent=small, fontName="Tahoma-Bold",
)
header = ParagraphStyle(
    "HeaderThai", parent=small_bold, textColor=colors.white, alignment=TA_CENTER,
)
note = ParagraphStyle(
    "NoteThai", parent=body, fontSize=8.2, leading=12, leftIndent=3*mm,
    borderColor=colors.HexColor("#C7D4E1"), borderWidth=0.6, borderPadding=3*mm,
    backColor=colors.HexColor("#F5F8FB"), spaceBefore=3*mm,
)


def p(text, style=small):
    return Paragraph(text, style)


def page_decor(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D8E0E8"))
    canvas.line(18*mm, 15*mm, 192*mm, 15*mm)
    canvas.setFont("Tahoma", 7.5)
    canvas.setFillColor(colors.HexColor("#6C7885"))
    canvas.drawString(18*mm, 10*mm, "จัดทำจากใบแจ้งยอดเงินสมทบกองทุนประกันสังคม พ.ศ. 2547-2569")
    canvas.drawRightString(192*mm, 10*mm, f"หน้า {doc.page}")
    canvas.restoreState()


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
doc = BaseDocTemplate(
    str(OUTPUT), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm,
    topMargin=16*mm, bottomMargin=20*mm, title="TCS BGC Employment History",
    author="Prepared from Social Security Office contribution statements",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
doc.addPageTemplates([PageTemplate(id="main", frames=frame, onPage=page_decor)])

story = [
    Paragraph("ประวัติการทำงานเพื่อประกอบการตรวจสอบ TCS BGC", title),
    Paragraph("Employment History for TCS Background Check", subtitle),
]

info = Table(
    [
        [p("ชื่อ-นามสกุล", small_bold), p("นางสาวชลกร ออกประเสริฐ"),
         p("เลขประจำตัวประชาชน", small_bold), p("*********7524")],
        [p("ช่วงข้อมูล", small_bold), p("สิงหาคม 2547 - กันยายน 2569<br/>(August 2004 - September 2026)"),
         p("หลักฐาน", small_bold), p("ใบแจ้งยอดเงินสมทบกองทุนประกันสังคม")],
    ],
    colWidths=[28*mm, 60*mm, 31*mm, 55*mm],
)
info.setStyle(TableStyle([
    ("GRID", (0,0), (-1,-1), 0.4, colors.HexColor("#CDD7E0")),
    ("BACKGROUND", (0,0), (0,-1), colors.HexColor("#EAF0F5")),
    ("BACKGROUND", (2,0), (2,-1), colors.HexColor("#EAF0F5")),
    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("LEFTPADDING", (0,0), (-1,-1), 5), ("RIGHTPADDING", (0,0), (-1,-1), 5),
    ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5),
]))
story += [info, Spacer(1, 6*mm)]

headers = [p("ลำดับ", header), p("ตั้งแต่ / From", header), p("ถึง / To", header),
           p("นายจ้างตามประกันสังคม / Employer", header), p("ตำแหน่ง / Position", header)]
rows = [headers]
for no, start, end, employer in records:
    rows.append([p(no), p(start), p(end), p(employer), p("ไม่ระบุในเอกสาร")])

table = Table(rows, colWidths=[10*mm, 32*mm, 32*mm, 64*mm, 36*mm], repeatRows=1)
table.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#17324D")),
    ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("GRID", (0,0), (-1,-1), 0.35, colors.HexColor("#C9D3DD")),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("ALIGN", (0,0), (0,-1), "CENTER"),
    ("LEFTPADDING", (0,0), (-1,-1), 4), ("RIGHTPADDING", (0,0), (-1,-1), 4),
    ("TOPPADDING", (0,0), (-1,-1), 4), ("BOTTOMPADDING", (0,0), (-1,-1), 4),
]))
for i in range(1, len(rows)):
    if i % 2 == 0:
        table.setStyle(TableStyle([("BACKGROUND", (0,i), (-1,i), colors.HexColor("#F5F8FA"))]))
story.append(table)

story += [
    Paragraph(
        "<b>หมายเหตุสำคัญ</b><br/>"
        "1) ช่วงเวลาข้างต้นสรุปจากเดือนที่มีการนำส่งเงินสมทบโดยนายจ้าง จึงไม่ใช่การยืนยันวันเริ่มงานหรือวันสิ้นสุดงานแบบรายวัน<br/>"
        "2) เอกสารต้นทางไม่แสดงตำแหน่งงาน เหตุผลที่ออกจากงาน สถานที่ทำงาน หรือข้อมูลผู้ติดต่อของนายจ้าง ต้องกรอกจากสัญญาจ้าง หนังสือรับรองการทำงาน หรือข้อมูลส่วนบุคคลเพิ่มเติม<br/>"
        "3) ไม่พบรายการเงินสมทบเดือนกุมภาพันธ์ 2568 (February 2025) ในชุดเอกสารที่ได้รับ ควรตรวจสอบว่าเป็นช่วงว่างงาน การนำส่งล่าช้า หรือเอกสารตกหล่น<br/>"
        "4) บางเดือนมีรายการซ้ำในเอกสารต้นทาง เอกสารสรุปนี้นับช่วงเดือนเพียงครั้งเดียว และไม่ได้ใช้ยอดค่าจ้างหรือยอดเงินสมทบในการสรุปประวัติ",
        note,
    ),
    Spacer(1, 5*mm),
    Paragraph(
        "คำรับรอง: ข้อมูลฉบับนี้เป็นสรุปเพื่ออำนวยความสะดวกในการตรวจสอบประวัติ โดยควรใช้ร่วมกับเอกสารต้นฉบับจากสำนักงานประกันสังคมและเอกสารรับรองการทำงานจากนายจ้าง",
        body,
    ),
]

doc.build(story)
print(OUTPUT)
