"""bim-import: IFC / Excel / PDF / DWG → объёмы для ВОР."""
import json, os, base64, re, io, zipfile, ssl, uuid
import psycopg2
import urllib.request

S = os.environ.get("MAIN_DB_SCHEMA", "t_p78845984_auto_house_cost_calc")
CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token"}

def db(): return psycopg2.connect(os.environ["DATABASE_URL"])
def resp(data, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}
def get_staff(conn, token):
    cur = conn.cursor()
    cur.execute(f"SELECT s.id,s.role_code FROM {S}.sessions ss JOIN {S}.staff s ON s.id=ss.staff_id WHERE ss.token=%s AND ss.expires_at>NOW()", (token,))
    r = cur.fetchone(); cur.close()
    return {"id": r[0], "role_code": r[1]} if r else None

IFC_MAP = {
    "IFCSLAB":("Перекрытия","м³"),"IFCWALL":("Стены","м³"),"IFCWALLSTANDARDCASE":("Стены","м³"),
    "IFCCOLUMN":("Колонны","м³"),"IFCBEAM":("Балки","м³"),"IFCFOOTING":("Фундамент","м³"),
    "IFCPILE":("Сваи","шт"),"IFCROOF":("Кровля","м²"),"IFCSTAIR":("Лестницы","м³"),
    "IFCDOOR":("Двери","шт"),"IFCWINDOW":("Окна","шт"),"IFCMEMBER":("Металл","кг"),
    "IFCPLATE":("Листовой металл","м²"),"IFCCOVERING":("Отделка","м²"),
    "IFCBUILDINGSTOREY":(None,None),"IFCBUILDING":(None,None),"IFCSITE":(None,None),"IFCPROJECT":(None,None),
}

def parse_ifc(text):
    quantities = {}
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("#"): continue
        for qtype in ("IFCQUANTITYVOLUME","IFCQUANTITYAREA","IFCQUANTITYLENGTH"):
            if qtype in line.upper():
                m = re.search(rf"#(\d+)=\s*{qtype}\s*\(([^)]+)\)", line, re.I)
                if m:
                    parts = [p.strip().strip("'") for p in m.group(2).split(",")]
                    if len(parts) >= 4:
                        key = {"IFCQUANTITYVOLUME":"volume","IFCQUANTITYAREA":"area","IFCQUANTITYLENGTH":"length"}[qtype]
                        try: quantities.setdefault(m.group(1), {})[key] = float(parts[3])
                        except ValueError: pass
    elements = []
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("#"): continue
        ifc_type = next((t for t in IFC_MAP if f"{t}(" in line.upper()), None)
        if not ifc_type: continue
        section, def_unit = IFC_MAP[ifc_type]
        if not section: continue
        m_id = re.match(r"#(\d+)\s*=", line)
        if not m_id: continue
        eid = m_id.group(1)
        name = section
        pm = re.search(rf"{ifc_type}\s*\(([^)]+)\)", line, re.I)
        if pm:
            parts = [p.strip().strip("'") for p in pm.group(1).split(",")]
            for idx in (2, 3):
                if len(parts) > idx and parts[idx] and parts[idx] != "$": name = parts[idx]; break
        q = quantities.get(eid, {})
        if ifc_type in ("IFCPILE","IFCDOOR","IFCWINDOW"): qty, unit = 1, "шт"
        elif q.get("volume", 0) > 0: qty, unit = round(q["volume"], 4), "м³"
        elif q.get("area", 0) > 0: qty, unit = round(q["area"], 4), "м²"
        elif q.get("length", 0) > 0: qty, unit = round(q["length"], 4), "п.м"
        else: qty, unit = 1, def_unit or "шт"
        elements.append({"section": section, "name": name, "unit": unit, "qty": qty})
    agg = {}
    for el in elements:
        key = f"{el['section']}|{el['name']}|{el['unit']}"
        if key not in agg: agg[key] = {**el, "count": 0, "price_per_unit": 0}
        agg[key]["qty"] += el["qty"]; agg[key]["count"] += 1
    result = [{**v, "qty": round(v["qty"], 3)} for v in agg.values()]
    return {"format": "IFC", "elements_raw": len(elements), "items": result,
            "warnings": [] if result else ["QuantitySets не найдены. Включите экспорт объёмов в Renga/Revit."]}

COL_KW = {
    "section":["раздел","секция","глава","section"],
    "name":["наименование","описание","материал","name","работа","позиция"],
    "unit":["ед","единица","unit"],
    "qty":["кол","количество","объём","объем","qty","amount"],
    "price":["цена","стоимость","price","cost","руб"],
}
def detect_cols(header):
    cm = {}
    for field, kws in COL_KW.items():
        for i, h in enumerate(header):
            if any(kw in h for kw in kws): cm[field] = i; break
    return cm
def extr_row(row, cm):
    def g(f):
        i = cm.get(f)
        return str(row[i]).strip() if i is not None and i < len(row) else ""
    name = g("name")
    if not name or len(name) < 2: return None
    if any(kw in name.lower() for kw in ["итого","всего","наименование","раздел","total"]): return None
    try: qty = float(g("qty").replace(",",".").replace(" ",""))
    except ValueError: qty = 0
    try: price = float(g("price").replace(",",".").replace(" ",""))
    except ValueError: price = 0
    return {"section": g("section") or "Общее", "name": name, "unit": g("unit") or "шт", "qty": round(qty,3), "price_per_unit": round(price,2)}
def parse_xlsx(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        ss = []
        if "xl/sharedStrings.xml" in z.namelist():
            ss = re.findall(r"<t[^>]*>([^<]*)</t>", z.read("xl/sharedStrings.xml").decode("utf-8"))
        sheets = [n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml", n)]
        if not sheets: return {"format":"Excel","items":[],"warnings":["Листы не найдены"]}
        sxml = z.read(sheets[0]).decode("utf-8")
    rows = []
    for rx in re.findall(r"<row[^>]*>(.*?)</row>", sxml, re.DOTALL):
        cells = {}
        for c in re.finditer(r'<c r="([A-Z]+\d+)"([^>]*)>(.*?)</c>', rx, re.DOTALL):
            col = re.sub(r"\d","",c.group(1)); inner = c.group(3)
            vm = re.search(r"<v>([^<]+)</v>", inner)
            if not vm: continue
            val = vm.group(1)
            if 't="s"' in c.group(2):
                try: val = ss[int(val)]
                except (IndexError,ValueError): pass
            cells[col] = val
        if cells:
            mc = max(ord(c[0])-ord("A") for c in cells)
            arr = [""]*( mc+1)
            for c,v in cells.items():
                idx = ord(c[0])-ord("A")
                if idx < len(arr): arr[idx]=v
            rows.append(arr)
    if len(rows) < 2: return {"format":"Excel","items":[],"warnings":["Мало данных"]}
    cm = detect_cols([str(c).strip().lower() for c in rows[0]])
    items = [r for r in (extr_row(row,cm) for row in rows[1:]) if r]
    return {"format":"Excel","items":items,"warnings":[] if items else ["Не распознана структура. Нужны колонки: Наименование, Ед., Кол-во"]}
def parse_csv(text):
    import csv
    lines = text.splitlines()
    if not lines: return {"format":"CSV","items":[],"warnings":["Файл пустой"]}
    delim = ";" if lines[0].count(";") > lines[0].count(",") else ","
    rows = list(csv.reader(lines, delimiter=delim))
    if len(rows)<2: return {"format":"CSV","items":[],"warnings":["Мало данных"]}
    cm = detect_cols([h.strip().lower() for h in rows[0]])
    items = [r for r in (extr_row(row,cm) for row in rows[1:]) if r]
    return {"format":"CSV","items":items,"warnings":[] if items else ["Не распознана структура"]}
def parse_excel(b64, fname):
    raw = base64.b64decode(b64)
    if fname.endswith(".csv"): return parse_csv(raw.decode("utf-8","replace"))
    return parse_xlsx(raw)

def text_to_bom(text):
    items = []; sec = "Общее"
    for line in text.splitlines():
        line = line.strip()
        if not line: continue
        if re.match(r"^[А-ЯЁA-Z][А-ЯЁA-Za-zёа-я ]{5,}$", line) and not re.search(r"\d", line):
            sec = line; continue
        m = re.search(r"(.{5,80}?)\s+(м²|м2|м³|м3|п\.м|шт|кг|т)\W*(\d[\d\s,\.]*)", line, re.I)
        if m:
            try: qty = float(m.group(3).replace(" ","").replace(",","."))
            except ValueError: qty = 0
            items.append({"section":sec,"name":m.group(1).strip(),"unit":m.group(2).replace("м2","м²").replace("м3","м³"),"qty":round(qty,3),"price_per_unit":0})
    return items

def parse_pdf(b64):
    key = os.environ.get("OCR_SPACE_API_KEY","")
    if not key: return {"format":"PDF","items":[],"warnings":["OCR_SPACE_API_KEY не настроен"]}
    bnd = f"----{uuid.uuid4().hex}"
    body = "\r\n".join([
        f"--{bnd}\r\nContent-Disposition: form-data; name=\"base64Image\"\r\n\r\ndata:application/pdf;base64,{b64}",
        f"--{bnd}\r\nContent-Disposition: form-data; name=\"apikey\"\r\n\r\n{key}",
        f"--{bnd}\r\nContent-Disposition: form-data; name=\"language\"\r\n\r\nrus",
        f"--{bnd}\r\nContent-Disposition: form-data; name=\"isTable\"\r\n\r\ntrue",
        f"--{bnd}--",
    ]).encode("utf-8")
    req = urllib.request.Request("https://api.ocr.space/parse/image", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={bnd}"}, method="POST")
    ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=50, context=ctx) as r:
        ocr = json.loads(r.read().decode())
    text = " ".join(p.get("ParsedText","") for p in (ocr.get("ParsedResults") or []))
    if not text.strip(): return {"format":"PDF","items":[],"warnings":["Не удалось извлечь текст"]}
    items = text_to_bom(text)
    return {"format":"PDF","items":items,"text_preview":text[:400],
            "warnings":[] if items else ["Не распознаны позиции ВОР. Нужна таблица: Наименование / Ед. / Кол-во"]}

DWG_VER = {b"AC1015":"AutoCAD 2000",b"AC1018":"AutoCAD 2004",b"AC1021":"AutoCAD 2007",b"AC1024":"AutoCAD 2010",b"AC1027":"AutoCAD 2013",b"AC1032":"AutoCAD 2018"}
def parse_dwg(b64):
    raw = base64.b64decode(b64)
    version = DWG_VER.get(raw[:6], f"DWG ({raw[:6].decode('ascii','replace')})")
    blocks = []
    for m in re.finditer(rb"[ -~\t]{6,}", raw):
        t = m.group(0).decode("ascii","replace").strip()
        if t and not t.startswith("AC") and len(t)>4: blocks.append(t)
    try:
        for m in re.finditer(r"[А-ЯЁа-яёA-Za-z]{4,}[\w\s,\.]{0,60}", raw.decode("utf-16-le","ignore")):
            blocks.append(m.group(0).strip())
    except Exception: pass
    unique = list(dict.fromkeys(blocks))[:100]
    items = text_to_bom("\n".join(unique))
    return {"format":"DWG","dwg_version":version,"file_size_kb":round(len(raw)/1024,1),
            "items":items,"text_fragments":unique[:15],
            "warnings":["DWG — бинарный формат. Для точной обработки экспортируйте в IFC или PDF из Renga/AutoCAD."]}

def handler(event: dict, context) -> dict:
    """Парсинг IFC/Excel/PDF/DWG и возврат объёмов для ВОР."""
    if event.get("httpMethod") == "OPTIONS": return {"statusCode":200,"headers":CORS,"body":""}
    if event.get("httpMethod") != "POST": return resp({"error":"Только POST"},405)
    body = {}
    if event.get("body"):
        try: body = json.loads(event["body"])
        except ValueError: return resp({"error":"Невалидный JSON"},400)
    token = event.get("headers",{}).get("X-Auth-Token","")
    if not token: return resp({"error":"Не авторизован"},401)
    conn = db(); staff = get_staff(conn, token); conn.close()
    if not staff: return resp({"error":"Сессия истекла"},401)
    b64 = body.get("file_b64","")
    fname = body.get("filename","file.ifc").lower()
    if not b64: return resp({"error":"Файл не передан (file_b64)"},400)
    ext = fname.rsplit(".",1)[-1] if "." in fname else ""
    try:
        if ext == "ifc": result = parse_ifc(base64.b64decode(b64).decode("utf-8","replace"))
        elif ext in ("xlsx","xls","csv"): result = parse_excel(b64, fname)
        elif ext == "pdf": result = parse_pdf(b64)
        elif ext == "dwg": result = parse_dwg(b64)
        else: return resp({"error":f"Неподдерживаемый формат .{ext}. Поддерживаются: IFC, XLSX, CSV, PDF, DWG"},400)
    except Exception as e:
        return resp({"error":f"Ошибка парсинга: {e}"},422)
    return resp({"ok":True,"filename":fname,**result})
