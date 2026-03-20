"""
supply-ops: генерация счёта PDF + операции по предложениям поставщиков + AI-ассистент
"""
import json, os, io, base64, urllib.request, urllib.error
import psycopg2
from datetime import datetime

S = "t_p78845984_auto_house_cost_calc"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-Supplier-Token, X-Role",
}

# ── Системные промпты по ролям ────────────────────────────────────────────────
SYSTEM_PROMPTS = {
    "visitor": """Ты — умный AI-ассистент строительной компании «СтройКалькулятор».
Помогаешь посетителям сайта:
- Объясняешь как пользоваться калькулятором стоимости строительства
- Консультируешь по типам домов (кирпич, каркас, газобетон, дерево, монолит, модульный)
- Рассказываешь о видах фундаментов, кровли, отделки, коммуникаций
- Помогаешь выбрать готовый проект под бюджет и нужды
- Отвечаешь на вопросы о ценах и сроках строительства
- Объясняешь что входит в смету и из чего складывается стоимость
Отвечай кратко, по-деловому, на русском языке. Если не знаешь точной цифры — давай ориентировочный диапазон.""",

    "architect": """Ты — AI-помощник архитектора в компании «СтройКалькулятор».
Помогаешь архитекторам:
- Советуешь по планировочным решениям и типам домов
- Помогаешь описать проект: особенности, преимущества, целевая аудитория
- Объясняешь технические нюансы конструктива
- Предлагаешь идеи для тегов и описаний проектов
- Консультируешь по нормам и стандартам в строительстве
- Помогаешь рассчитать базовые параметры проектов
Отвечай профессионально, используй строительную терминологию.""",

    "constructor": """Ты — AI-помощник конструктора в компании «СтройКалькулятор».
Помогаешь конструкторам:
- Консультируешь по нормам расхода материалов на м² и м³
- Помогаешь составить правильные формулы расчёта количества материалов
- Объясняешь технические характеристики строительных материалов
- Советуешь по маркам бетона, арматуре, утеплителям, кровельным материалам
- Помогаешь корректно заполнить смету
Формулы в системе: переменная `a` = площадь, `fl` = этажи.""",

    "supply": """Ты — AI-помощник снабженца в компании «СтройКалькулятор».
Помогаешь снабженцу:
- Советуешь как составить грамотный запрос КП поставщикам
- Объясняешь критерии выбора поставщиков
- Помогаешь сравнить коммерческие предложения
- Консультируешь по логистике и срокам поставок
- Советуешь как работать с договорами поставки
- Помогаешь с формулировками для переписки с поставщиками""",

    "engineer": """Ты — AI-помощник инженера в компании «СтройКалькулятор».
Помогаешь инженерам:
- Консультируешь по инженерным системам (электрика, водоснабжение, отопление, вентиляция)
- Объясняешь нормы и требования к коммуникациям
- Помогаешь разобраться в технической документации
- Советуешь по современным инженерным решениям и оборудованию""",

    "lawyer": """Ты — AI-помощник юриста в компании «СтройКалькулятор».
Помогаешь юристам:
- Консультируешь по договорам подряда и поставки в строительстве
- Объясняешь требования к разрешительной документации
- Помогаешь с формулировками условий договоров
- Информируешь о законодательстве в сфере строительства (ГрК РФ, ГК РФ)
Важно: ты даёшь информационные ответы, не юридические заключения.""",

    "supplier": """Ты — AI-помощник поставщика на портале «СтройКалькулятор».
Помогаешь поставщикам:
- Объясняешь как правильно заполнить коммерческое предложение
- Советуешь как выгодно представить свою продукцию
- Помогаешь разобраться в технических требованиях к материалам
- Консультируешь по логистике и условиям поставок
- Отвечаешь на вопросы о работе портала""",
}

def get_openai_response(messages: list, role: str) -> str:
    api_key = os.environ.get("OPENAI_API_KEY","")
    if not api_key:
        return "AI-ассистент временно недоступен. Пожалуйста, добавьте OPENAI_API_KEY в настройках."
    system_prompt = SYSTEM_PROMPTS.get(role, SYSTEM_PROMPTS["visitor"])
    payload = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "max_tokens": 1024,
        "temperature": 0.7,
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            result = json.loads(r.read().decode())
        return result["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        if "insufficient_quota" in err:
            return "Баланс OpenAI исчерпан. Пополните счёт на platform.openai.com"
        return f"Ошибка OpenAI: {e.code}"
    except Exception as e:
        return f"Ошибка соединения с AI: {str(e)}"

def db(): return psycopg2.connect(os.environ["DATABASE_URL"])
def resp(data, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}

def get_staff(conn, token):
    cur = conn.cursor()
    cur.execute(f"SELECT s.id,s.role_code FROM {S}.sessions ss JOIN {S}.staff s ON s.id=ss.staff_id WHERE ss.token=%s AND ss.expires_at>NOW()", (token,))
    r = cur.fetchone(); cur.close()
    return {"id": r[0], "role_code": r[1]} if r else None

def get_supplier(conn, token):
    cur = conn.cursor()
    cur.execute(f"SELECT id,company_name,contact_name,email,phone FROM {S}.suppliers WHERE token=%s AND token_expires>NOW() AND is_active=TRUE", (token,))
    r = cur.fetchone(); cur.close()
    return {"id":r[0],"company_name":r[1],"contact_name":r[2],"email":r[3],"phone":r[4]} if r else None

def make_invoice_pdf(rfq_title, address, supplier, items, total, inv_number):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
        story = []

        h1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=18, spaceAfter=4)
        sub = ParagraphStyle("sub", fontName="Helvetica", fontSize=10, textColor=colors.grey, spaceAfter=12)
        info = ParagraphStyle("info", fontName="Helvetica", fontSize=10, spaceAfter=4)

        story.append(Paragraph(f"СЧЁТ № {inv_number}", h1))
        story.append(Paragraph(f"от {datetime.now().strftime('%d.%m.%Y')}", sub))
        story.append(Paragraph(f"<b>Объект:</b> {rfq_title}", info))
        story.append(Paragraph(f"<b>Адрес строительства:</b> {address}", info))
        story.append(Paragraph(f"<b>Поставщик:</b> {supplier['company_name']}", info))
        story.append(Paragraph(f"<b>Контакт:</b> {supplier['contact_name']}  |  {supplier.get('phone','')}  |  {supplier.get('email','')}", info))
        story.append(Spacer(1, 6*mm))

        tdata = [["№", "Наименование", "Ед.", "Кол-во", "Цена, руб.", "Сумма, руб."]]
        for i, item in enumerate(items, 1):
            tdata.append([
                str(i), item.get("name","—"), item.get("unit",""),
                str(item.get("qty", item.get("totalQty", 0))),
                f"{float(item.get('price_per_unit', item.get('pricePerUnit', 0))):,.0f}",
                f"{float(item.get('total', item.get('totalPrice', 0))):,.0f}",
            ])
        tdata.append(["","","","","ИТОГО:", f"{float(total):,.0f} руб."])

        t = Table(tdata, colWidths=[8*mm, 72*mm, 15*mm, 18*mm, 28*mm, 28*mm])
        t.setStyle(TableStyle([
            ("FONTNAME", (0,0),(-1,0),"Helvetica-Bold"),
            ("FONTNAME", (0,1),(-1,-1),"Helvetica"),
            ("FONTSIZE", (0,0),(-1,-1), 8.5),
            ("BACKGROUND",(0,0),(-1,0), colors.HexColor("#1E2535")),
            ("TEXTCOLOR",(0,0),(-1,0), colors.white),
            ("ALIGN",(2,0),(-1,-1),"CENTER"),
            ("ALIGN",(4,0),(-1,-1),"RIGHT"),
            ("GRID",(0,0),(-1,-2),0.4, colors.HexColor("#cccccc")),
            ("FONTNAME",(0,-1),(-1,-1),"Helvetica-Bold"),
            ("FONTSIZE",(0,-1),(-1,-1),10),
            ("BACKGROUND",(0,-1),(-1,-1), colors.HexColor("#FFF3E0")),
        ]))
        story.append(t)
        story.append(Spacer(1, 8*mm))
        story.append(Paragraph("Счёт действителен 10 дней с момента выставления.", ParagraphStyle("foot", fontName="Helvetica", fontSize=8, textColor=colors.grey)))

        doc.build(story)
        return base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        return None

def handler(event, context):
    if event.get("httpMethod") == "OPTIONS": return {"statusCode":200,"headers":CORS,"body":""}
    method = event.get("httpMethod","GET")
    qs = event.get("queryStringParameters") or {}
    action = qs.get("action","")
    staff_token = event.get("headers",{}).get("X-Auth-Token","")
    sup_token = event.get("headers",{}).get("X-Supplier-Token","")
    body = {}
    if event.get("body"):
        try: body = json.loads(event["body"])
        except: pass

    conn = db()

    # ── Генерация счёта (снабженец) ──
    if action == "generate_invoice" or body.get("action") == "generate_invoice":
        if not staff_token: conn.close(); return resp({"error":"Не авторизован"}, 401)
        staff = get_staff(conn, staff_token)
        if not staff: conn.close(); return resp({"error":"Сессия истекла"}, 401)
        if staff["role_code"] != "supply": conn.close(); return resp({"error":"Только снабженец"}, 403)

        proposal_id = body.get("proposal_id")
        if not proposal_id: conn.close(); return resp({"error":"proposal_id обязателен"}, 400)

        cur = conn.cursor()
        cur.execute(f"""
            SELECT p.rfq_id,p.supplier_id,p.items,p.total_amount,
                   r.title,r.construction_address,
                   s.company_name,s.contact_name,s.email,s.phone
            FROM {S}.proposals p
            JOIN {S}.rfq r ON r.id=p.rfq_id
            JOIN {S}.suppliers s ON s.id=p.supplier_id
            WHERE p.id=%s
        """, (proposal_id,))
        row = cur.fetchone()
        if not row: cur.close(); conn.close(); return resp({"error":"Предложение не найдено"}, 404)

        rfq_id,sup_id,items,total,rfq_title,address,comp,contact,email,phone = row
        inv_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{proposal_id}"

        cur.execute(f"SELECT id FROM {S}.invoices WHERE invoice_number=%s", (inv_number,))
        if not cur.fetchone():
            cur.execute(f"""
                INSERT INTO {S}.invoices (rfq_id,proposal_id,supplier_id,invoice_number,amount,items,created_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
            """, (rfq_id,proposal_id,sup_id,inv_number,total,json.dumps(items,ensure_ascii=False),staff["id"]))
            conn.commit()
        cur.close()

        supplier_info = {"company_name":comp,"contact_name":contact,"email":email,"phone":phone}
        item_list = items if isinstance(items, list) else []
        pdf_b64 = make_invoice_pdf(rfq_title, address, supplier_info, item_list, total, inv_number)
        conn.close()
        return resp({"ok":True,"invoice_number":inv_number,"amount":float(total),"supplier":supplier_info,"pdf_base64":pdf_b64})

    # ── Список счетов (снабженец) ──
    if action == "invoices_list":
        if not staff_token: conn.close(); return resp({"error":"Не авторизован"}, 401)
        staff = get_staff(conn, staff_token)
        if not staff: conn.close(); return resp({"error":"Сессия истекла"}, 401)
        cur = conn.cursor()
        cur.execute(f"""
            SELECT i.id,i.invoice_number,i.amount,i.status,i.created_at,
                   r.title,s.company_name
            FROM {S}.invoices i JOIN {S}.rfq r ON r.id=i.rfq_id JOIN {S}.suppliers s ON s.id=i.supplier_id
            ORDER BY i.created_at DESC
        """)
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"invoices":[{"id":r[0],"invoice_number":r[1],"amount":float(r[2]),"status":r[3],"created_at":str(r[4]),"rfq_title":r[5],"company_name":r[6]} for r in rows]})

    # ── Мои счета (поставщик) ──
    if action == "my_invoices":
        if not sup_token: conn.close(); return resp({"error":"Не авторизован"}, 401)
        supplier = get_supplier(conn, sup_token)
        if not supplier: conn.close(); return resp({"error":"Сессия истекла"}, 401)
        cur = conn.cursor()
        cur.execute(f"""
            SELECT i.id,i.invoice_number,i.amount,i.status,i.created_at,r.title,r.construction_address
            FROM {S}.invoices i JOIN {S}.rfq r ON r.id=i.rfq_id
            WHERE i.supplier_id=%s ORDER BY i.created_at DESC
        """, (supplier["id"],))
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"invoices":[{"id":r[0],"invoice_number":r[1],"amount":float(r[2]),"status":r[3],"created_at":str(r[4]),"rfq_title":r[5],"address":r[6]} for r in rows]})

    # ── AI chat (не требует БД) ──
    if action == "chat":
        conn.close()
        messages = body.get("messages", [])
        role = body.get("role", "visitor")
        if not messages:
            return resp({"error": "messages обязательны"}, 400)
        clean = [{"role": m["role"], "content": str(m["content"])[:4000]}
                 for m in messages if m.get("role") in ("user","assistant") and m.get("content")]
        if not clean:
            return resp({"error": "Нет сообщений"}, 400)
        answer = get_openai_response(clean, role)
        return resp({"reply": answer})

    conn.close()
    return resp({"error":"Not found"}, 404)