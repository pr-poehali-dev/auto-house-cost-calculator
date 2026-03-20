"""
База материалов и работ: CRUD для конструктора/архитектора/снабженца,
предложения поставщиков, автообновление лучшей цены
"""
import json, os
import psycopg2

S = "t_p78845984_auto_house_cost_calc"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-Supplier-Token",
}

def db(): return psycopg2.connect(os.environ["DATABASE_URL"])
def resp(data, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}

def get_staff(conn, token):
    cur = conn.cursor()
    cur.execute(
        f"SELECT s.id,s.full_name,s.role_code FROM {S}.sessions ss "
        f"JOIN {S}.staff s ON s.id=ss.staff_id "
        f"WHERE ss.token=%s AND ss.expires_at>NOW()", (token,))
    r = cur.fetchone(); cur.close()
    return {"id":r[0],"full_name":r[1],"role_code":r[2]} if r else None

def get_supplier(conn, token):
    cur = conn.cursor()
    cur.execute(
        f"SELECT id,company_name,region FROM {S}.suppliers "
        f"WHERE token=%s AND token_expires>NOW() AND is_active=TRUE", (token,))
    r = cur.fetchone(); cur.close()
    return {"id":r[0],"company_name":r[1],"region":r[2]} if r else None

def update_best_price(conn, material_id):
    """Находит лучшую (минимальную) активную цену среди предложений поставщиков и обновляет materials"""
    cur = conn.cursor()
    cur.execute(
        f"SELECT supplier_id, price FROM {S}.price_offers "
        f"WHERE material_id=%s AND is_active=TRUE ORDER BY price ASC LIMIT 1",
        (material_id,))
    r = cur.fetchone()
    if r:
        cur.execute(
            f"UPDATE {S}.materials SET best_price=%s, best_price_supplier_id=%s, "
            f"best_price_updated_at=NOW() WHERE id=%s",
            (r[1], r[0], material_id))
    cur.close()

def mat_row(r):
    return {
        "id":r[0],"item_type":r[1],"category":r[2],"name":r[3],"unit":r[4],
        "price_per_unit":float(r[5]),"qty_formula":r[6],"article":r[7],"description":r[8],
        "best_price":float(r[9]) if r[9] else None,"best_price_updated_at":str(r[10]) if r[10] else None,
        "sort_order":r[11],"is_active":r[12],"updated_at":str(r[13])
    }

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode":200,"headers":CORS,"body":""}

    method = event.get("httpMethod","GET")
    qs = event.get("queryStringParameters") or {}
    action = qs.get("action","")
    headers = event.get("headers",{})
    staff_token = headers.get("X-Auth-Token","")
    supplier_token = headers.get("X-Supplier-Token","")

    body = {}
    if event.get("body"):
        try: body = json.loads(event["body"])
        except: pass

    conn = db()

    # ── Публичный: список материалов для поставщиков без авторизации ──────────
    if method == "GET" and action == "public":
        cur = conn.cursor()
        cat = qs.get("category","")
        q = (f"SELECT id,item_type,category,name,unit,price_per_unit,qty_formula,article,description,"
             f"best_price,best_price_updated_at,sort_order,is_active,updated_at "
             f"FROM {S}.materials WHERE is_active=TRUE")
        if cat: q += " AND category=%s ORDER BY category,sort_order,id"
        else: q += " ORDER BY category,sort_order,id"
        cur.execute(q, (cat,) if cat else ())
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"items":[mat_row(r) for r in rows]})

    # ── Авторизация сотрудника или поставщика ─────────────────────────────────
    staff = None
    supplier = None
    if staff_token:
        staff = get_staff(conn, staff_token)
    elif supplier_token:
        supplier = get_supplier(conn, supplier_token)

    if not staff and not supplier:
        conn.close()
        return resp({"error":"Не авторизован"}, 401)

    role = staff["role_code"] if staff else None
    STAFF_EDIT_ROLES = ("constructor","architect","supply")

    # ── GET список материалов ─────────────────────────────────────────────────
    if method == "GET" and action in ("","list"):
        cur = conn.cursor()
        cat = qs.get("category","")
        item_type = qs.get("item_type","")
        q = (f"SELECT m.id,m.item_type,m.category,m.name,m.unit,m.price_per_unit,m.qty_formula,"
             f"m.article,m.description,m.best_price,m.best_price_updated_at,m.sort_order,m.is_active,m.updated_at "
             f"FROM {S}.materials m WHERE 1=1")
        params = []
        if not staff: q += " AND m.is_active=TRUE"  # поставщик видит только активные
        if cat: q += " AND m.category=%s"; params.append(cat)
        if item_type: q += " AND m.item_type=%s"; params.append(item_type)
        q += " ORDER BY m.category,m.sort_order,m.id"
        cur.execute(q, params)
        items = [mat_row(r) for r in cur.fetchall()]

        # Добавляем предложения поставщиков если запрошено
        if qs.get("with_offers") == "1" and staff and role in STAFF_EDIT_ROLES:
            for item in items:
                cur.execute(
                    f"SELECT po.id,po.supplier_id,s.company_name,po.price,po.location,po.note,po.updated_at "
                    f"FROM {S}.price_offers po JOIN {S}.suppliers s ON s.id=po.supplier_id "
                    f"WHERE po.material_id=%s AND po.is_active=TRUE ORDER BY po.price ASC",
                    (item["id"],))
                item["offers"] = [{"id":r[0],"supplier_id":r[1],"company":r[2],"price":float(r[3]),
                                   "location":r[4],"note":r[5],"updated_at":str(r[6])} for r in cur.fetchall()]
        cur.close(); conn.close()
        return resp({"items": items})

    # ── POST create material ──────────────────────────────────────────────────
    if method == "POST" and action == "create":
        if not staff or role not in STAFF_EDIT_ROLES:
            conn.close(); return resp({"error":"Нет доступа"}, 403)
        for f in ["category","name","unit","price_per_unit"]:
            if not body.get(f) and body.get(f) != 0:
                conn.close(); return resp({"error":f"Поле {f} обязательно"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {S}.materials (item_type,category,name,unit,price_per_unit,qty_formula,"
            f"article,description,sort_order,updated_by,created_by) "
            f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (body.get("item_type","material"),body["category"],body["name"],body["unit"],
             body["price_per_unit"],body.get("qty_formula",""),body.get("article",""),
             body.get("description",""),body.get("sort_order",0),staff["id"],staff["id"]))
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True,"id":new_id})

    # ── POST update material ──────────────────────────────────────────────────
    if method == "POST" and action == "update":
        if not staff or role not in STAFF_EDIT_ROLES:
            conn.close(); return resp({"error":"Нет доступа"}, 403)
        mid = body.get("id")
        if not mid: conn.close(); return resp({"error":"id обязателен"}, 400)
        editable = ["item_type","category","name","unit","price_per_unit","qty_formula",
                    "article","description","sort_order","is_active"]
        if role == "supply": editable = ["price_per_unit"]  # снабженец только цену
        fields, vals = [], []
        for k in editable:
            if k in body: fields.append(f"{k}=%s"); vals.append(body[k])
        if not fields: conn.close(); return resp({"error":"Нет полей"}, 400)
        fields += ["updated_by=%s","updated_at=NOW()"]; vals += [staff["id"],mid]
        cur = conn.cursor()
        cur.execute(f"UPDATE {S}.materials SET {','.join(fields)} WHERE id=%s", vals)
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True})

    # ── POST supplier: подать/обновить предложение цены ──────────────────────
    if method == "POST" and action == "offer_price":
        if not supplier:
            conn.close(); return resp({"error":"Только поставщик"}, 403)
        mid = body.get("material_id")
        price = body.get("price")
        if not mid or price is None: conn.close(); return resp({"error":"material_id и price обязательны"}, 400)
        if float(price) <= 0: conn.close(); return resp({"error":"Цена должна быть больше 0"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {S}.price_offers (material_id,supplier_id,price,location,note) "
            f"VALUES (%s,%s,%s,%s,%s) "
            f"ON CONFLICT (material_id,supplier_id) DO UPDATE SET "
            f"price=%s,location=%s,note=%s,updated_at=NOW(),is_active=TRUE",
            (mid,supplier["id"],price,body.get("location",supplier.get("region","")),body.get("note",""),
             price,body.get("location",supplier.get("region","")),body.get("note","")))
        # Обновляем лучшую цену в базе материалов
        update_best_price(conn, mid)
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True})

    # ── POST staff: принять лучшую цену поставщика как базовую ───────────────
    if method == "POST" and action == "accept_best_price":
        if not staff or role not in STAFF_EDIT_ROLES:
            conn.close(); return resp({"error":"Нет доступа"}, 403)
        mid = body.get("material_id")
        if not mid: conn.close(); return resp({"error":"material_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT best_price FROM {S}.materials WHERE id=%s", (mid,))
        r = cur.fetchone()
        if not r or not r[0]: conn.close(); return resp({"error":"Нет лучшей цены"}, 400)
        cur.execute(
            f"UPDATE {S}.materials SET price_per_unit=%s, updated_by=%s, updated_at=NOW() WHERE id=%s",
            (r[0], staff["id"], mid))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True})

    # ── GET offers for material ───────────────────────────────────────────────
    if method == "GET" and action == "offers":
        mid = qs.get("material_id")
        if not mid: conn.close(); return resp({"error":"material_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"SELECT po.id,po.supplier_id,s.company_name,s.region,po.price,po.location,po.note,po.updated_at "
            f"FROM {S}.price_offers po JOIN {S}.suppliers s ON s.id=po.supplier_id "
            f"WHERE po.material_id=%s AND po.is_active=TRUE ORDER BY po.price ASC",
            (mid,))
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"offers":[{"id":r[0],"supplier_id":r[1],"company":r[2],"region":r[3],
                                "price":float(r[4]),"location":r[5],"note":r[6],"updated_at":str(r[7])}
                               for r in rows]})

    # ── GET мои предложения (для поставщика) ──────────────────────────────────
    if method == "GET" and action == "my_offers" and supplier:
        cur = conn.cursor()
        cur.execute(
            f"SELECT po.id,po.material_id,m.name,m.category,m.unit,po.price,po.location,po.note,po.updated_at "
            f"FROM {S}.price_offers po JOIN {S}.materials m ON m.id=po.material_id "
            f"WHERE po.supplier_id=%s AND po.is_active=TRUE ORDER BY m.category,m.name",
            (supplier["id"],))
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"offers":[{"id":r[0],"material_id":r[1],"material_name":r[2],"category":r[3],
                                "unit":r[4],"price":float(r[5]),"location":r[6],"note":r[7],"updated_at":str(r[8])}
                               for r in rows]})

    # ── GET категории ─────────────────────────────────────────────────────────
    if method == "GET" and action == "categories":
        cur = conn.cursor()
        cur.execute(f"SELECT DISTINCT category FROM {S}.materials WHERE is_active=TRUE ORDER BY category")
        cats = [r[0] for r in cur.fetchall()]; cur.close(); conn.close()
        return resp({"categories": cats})

    conn.close()
    return resp({"error":"Not found"}, 404)