"""
CRM заказов: воронка продаж, загрузка проектов, AI-разбор спецификаций, ВОР, КП, договоры, список материалов
"""
import json, os, re
import psycopg2
import boto3
import urllib.request
import urllib.error

S = "t_p78845984_auto_house_cost_calc"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}
ALLOWED_ROLES = {"manager", "architect", "lawyer", "build_manager", "supply", "admin", "constructor", "engineer"}

def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def resp(data, code=200):
    return {
        "statusCode": code,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False, default=str),
    }

def s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )

def cdn_url(key):
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

def get_staff(conn, token):
    cur = conn.cursor()
    cur.execute(
        f"SELECT s.id, s.full_name, s.role_code FROM {S}.sessions ss "
        f"JOIN {S}.staff s ON s.id=ss.staff_id "
        f"WHERE ss.token=%s AND ss.expires_at>NOW()",
        (token,),
    )
    r = cur.fetchone()
    cur.close()
    return {"id": r[0], "full_name": r[1], "role_code": r[2]} if r else None

def _esc(v):
    """Minimal SQL string escape."""
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"

def _esc_json(v):
    """Escape a value that will be stored as JSONB."""
    if v is None:
        return "NULL"
    s = json.dumps(v, ensure_ascii=False)
    return "'" + s.replace("'", "''") + "'::jsonb"

# ------------------------------------------------------------------ #
# PDF / file text extraction (same approach as spec-ai)              #
# ------------------------------------------------------------------ #

def extract_text_from_pdf(file_data: bytes) -> str:
    try:
        text = file_data.decode("latin-1", errors="ignore")
        chunks = re.findall(r'\(([^)]{1,200})\)', text)
        readable = []
        for chunk in chunks:
            cleaned = chunk.replace("\\n", " ").replace("\\r", " ").replace("\\t", " ").strip()
            if len(cleaned) > 2 and any(c.isalpha() for c in cleaned):
                readable.append(cleaned)
        return " | ".join(readable[:600])
    except Exception:
        return ""

def extract_text_from_file(file_data: bytes, file_name: str) -> str:
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if ext == "pdf":
        return extract_text_from_pdf(file_data)
    if ext == "csv":
        try:
            return file_data.decode("utf-8", errors="ignore")[:12000]
        except Exception:
            return file_data.decode("cp1251", errors="ignore")[:12000]
    if ext in ("xlsx", "xls"):
        try:
            import zipfile, io
            with zipfile.ZipFile(io.BytesIO(file_data)) as z:
                strings = []
                if "xl/sharedStrings.xml" in z.namelist():
                    ss_xml = z.read("xl/sharedStrings.xml").decode("utf-8", "ignore")
                    strings = re.findall(r'<t[^>]*>([^<]+)</t>', ss_xml)
                sheet_files = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet")]
                if sheet_files:
                    sheet_xml = z.read(sheet_files[0]).decode("utf-8", "ignore")
                    str_refs = re.findall(r't="s"[^>]*><v>(\d+)</v>', sheet_xml)
                    row_data = [strings[int(r)] for r in str_refs if int(r) < len(strings)]
                    return " | ".join(row_data[:600])
        except Exception:
            pass
    return ""

# ------------------------------------------------------------------ #
# DeepSeek call                                                       #
# ------------------------------------------------------------------ #

PARSE_PROMPT = """Ты — ассистент строительной компании. Перед тобой спецификация или ведомость объёмов работ.

Извлеки ВСЕ позиции работ и материалов и верни их в виде JSON-массива.

Для каждой позиции:
- section: раздел/категория (Фундамент, Стены, Кровля, Отделка, Электрика, Сантехника и т.д.)
- name: название работы или материала
- unit: единица измерения (м², м³, пм, шт, т, кг, л, компл)
- qty: количество (число, 0 если не указано)
- price_per_unit: цена за единицу в рублях (0 если не указана)
- note: примечание, марка, артикул

Верни ТОЛЬКО валидный JSON-массив без пояснений:
[{"section":"...","name":"...","unit":"...","qty":0,"price_per_unit":0,"note":"..."}]"""

def deepseek_parse(text: str) -> list:
    api_key = os.environ.get("DEEPSEEK_API_KEY", "")
    if not api_key or not text.strip():
        return []
    payload = json.dumps({
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": f"{PARSE_PROMPT}\n\nТекст спецификации:\n{text[:12000]}"}],
        "temperature": 0.1,
        "max_tokens": 4000,
    }, ensure_ascii=False).encode()
    req = urllib.request.Request(
        "https://api.deepseek.com/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            result = json.loads(r.read())
        content = result["choices"][0]["message"]["content"].strip()
        m = re.search(r'\[.*\]', content, re.DOTALL)
        if m:
            return json.loads(m.group())
    except Exception as e:
        print(f"[order-api] deepseek error: {e}")
    return []

# ------------------------------------------------------------------ #
# Number generators                                                   #
# ------------------------------------------------------------------ #

def gen_order_number(cur) -> str:
    from datetime import datetime
    year = datetime.utcnow().year
    cur.execute(f"SELECT COUNT(*) FROM {S}.orders WHERE EXTRACT(YEAR FROM created_at)={year}")
    cnt = (cur.fetchone() or [0])[0]
    return f"ЗК-{year}-{int(cnt)+1:03d}"

def gen_proposal_number(cur) -> str:
    from datetime import datetime
    year = datetime.utcnow().year
    cur.execute(f"SELECT COUNT(*) FROM {S}.commercial_proposals WHERE EXTRACT(YEAR FROM created_at)={year}")
    cnt = (cur.fetchone() or [0])[0]
    return f"КП-{year}-{int(cnt)+1:03d}"

def gen_contract_number(cur) -> str:
    from datetime import datetime
    year = datetime.utcnow().year
    cur.execute(f"SELECT COUNT(*) FROM {S}.contracts WHERE EXTRACT(YEAR FROM created_at)={year}")
    cnt = (cur.fetchone() or [0])[0]
    return f"ДГ-{year}-{int(cnt)+1:03d}"

# ------------------------------------------------------------------ #
# Handler                                                             #
# ------------------------------------------------------------------ #

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")
    token = (event.get("headers") or {}).get("X-Auth-Token", "")

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    # All actions require auth
    if not token:
        return resp({"error": "Требуется авторизация"}, 401)

    conn = db()
    try:
        staff = get_staff(conn, token)
        if not staff:
            return resp({"error": "Сессия истекла или недействительна"}, 401)
        if staff["role_code"] not in ALLOWED_ROLES:
            return resp({"error": "Недостаточно прав"}, 403)

        # ------------------------------------------------------------------ #
        # GET list                                                            #
        # ------------------------------------------------------------------ #
        if method == "GET" and action == "list":
            status_f = qs.get("status")
            stage_f = qs.get("stage")
            manager_f = qs.get("manager_id")
            where = ["1=1"]
            if status_f:
                where.append(f"o.status={_esc(status_f)}")
            if stage_f:
                where.append(f"o.stage={_esc(stage_f)}")
            if manager_f:
                where.append(f"o.manager_id={int(manager_f)}")
            where_sql = " AND ".join(where)
            cur = conn.cursor()
            cur.execute(
                f"SELECT o.id, o.number, o.status, o.stage, o.source, "
                f"o.client_name, o.client_phone, o.client_email, "
                f"o.area, o.budget, "
                f"s.full_name AS manager_name, "
                f"o.created_at, o.updated_at, "
                f"o.next_action, o.next_action_at, o.priority "
                f"FROM {S}.orders o "
                f"LEFT JOIN {S}.staff s ON s.id=o.manager_id "
                f"WHERE {where_sql} "
                f"ORDER BY o.created_at DESC"
            )
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            cur.close()
            return resp({"orders": rows})

        # ------------------------------------------------------------------ #
        # GET get                                                             #
        # ------------------------------------------------------------------ #
        if method == "GET" and action == "get":
            order_id = qs.get("order_id")
            if not order_id:
                return resp({"error": "order_id обязателен"}, 400)
            oid = int(order_id)
            cur = conn.cursor()
            # main order row
            cur.execute(
                f"SELECT o.*, s.full_name AS manager_name "
                f"FROM {S}.orders o "
                f"LEFT JOIN {S}.staff s ON s.id=o.manager_id "
                f"WHERE o.id={oid}"
            )
            row = cur.fetchone()
            if not row:
                cur.close()
                return resp({"error": "Заказ не найден"}, 404)
            cols = [d[0] for d in cur.description]
            order = dict(zip(cols, row))
            # files
            cur.execute(
                f"SELECT id, file_name, file_url, file_type, parse_status, created_at "
                f"FROM {S}.order_files WHERE order_id={oid} ORDER BY created_at"
            )
            fcols = [d[0] for d in cur.description]
            order["files"] = [dict(zip(fcols, r)) for r in cur.fetchall()]
            # specs
            cur.execute(
                f"SELECT id, title, items, total_qty, total_amount, created_at "
                f"FROM {S}.order_specs WHERE order_id={oid} ORDER BY created_at"
            )
            scols = [d[0] for d in cur.description]
            order["specs"] = [dict(zip(scols, r)) for r in cur.fetchall()]
            # events (last 20)
            cur.execute(
                f"SELECT e.id, e.type, e.direction, e.content, e.source, "
                f"e.created_at, s.full_name AS author "
                f"FROM {S}.lead_events e "
                f"LEFT JOIN {S}.staff s ON s.id=e.staff_id "
                f"WHERE e.order_id={oid} "
                f"ORDER BY e.created_at DESC LIMIT 20"
            )
            ecols = [d[0] for d in cur.description]
            order["events"] = [dict(zip(ecols, r)) for r in cur.fetchall()]
            cur.close()
            return resp({"order": order})

        # ------------------------------------------------------------------ #
        # POST create                                                         #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "create":
            client_name = body.get("client_name", "").strip()
            if not client_name:
                return resp({"error": "client_name обязателен"}, 400)
            client_phone = body.get("client_phone", "")
            client_email = body.get("client_email", "")
            client_comment = body.get("client_comment", "")
            source = body.get("source", "site")
            area = body.get("area")
            floors = body.get("floors")
            budget = body.get("budget")
            address = body.get("address", "")
            house_project_id = body.get("house_project_id")
            notes = body.get("notes", "")
            manager_id = staff["id"] if staff["role_code"] == "manager" else body.get("manager_id")

            cur = conn.cursor()
            number = gen_order_number(cur)
            area_sql = str(float(area)) if area is not None else "NULL"
            floors_sql = str(int(floors)) if floors is not None else "NULL"
            budget_sql = str(float(budget)) if budget is not None else "NULL"
            mgr_sql = str(int(manager_id)) if manager_id else "NULL"
            proj_sql = str(int(house_project_id)) if house_project_id else "NULL"
            cur.execute(
                f"INSERT INTO {S}.orders "
                f"(number, client_name, client_phone, client_email, client_comment, "
                f"source, area, floors, budget, address, house_project_id, notes, manager_id, "
                f"status, stage) "
                f"VALUES ({_esc(number)}, {_esc(client_name)}, {_esc(client_phone)}, "
                f"{_esc(client_email)}, {_esc(client_comment)}, {_esc(source)}, "
                f"{area_sql}, {floors_sql}, {budget_sql}, {_esc(address)}, "
                f"{proj_sql}, {_esc(notes)}, {mgr_sql}, 'new', 'lead') "
                f"RETURNING id"
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            cur.close()
            return resp({"ok": True, "id": new_id, "number": number})

        # ------------------------------------------------------------------ #
        # POST update                                                         #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "update":
            order_id = body.get("order_id") or qs.get("order_id")
            if not order_id:
                return resp({"error": "order_id обязателен"}, 400)
            oid = int(order_id)
            allowed_fields = [
                "client_name", "client_phone", "client_email", "client_comment",
                "area", "floors", "budget", "address", "stage", "status",
                "priority", "next_action", "next_action_at", "notes",
            ]
            numeric_fields = {"area", "floors", "budget", "manager_id", "house_project_id"}
            sets = []
            for f in allowed_fields:
                if f in body:
                    if f in numeric_fields:
                        v = body[f]
                        sets.append(f"{f}={str(float(v)) if v is not None else 'NULL'}")
                    else:
                        sets.append(f"{f}={_esc(body[f])}")
            # handle foreign keys separately
            if "manager_id" in body:
                v = body["manager_id"]
                sets.append(f"manager_id={str(int(v)) if v else 'NULL'}")
            if "house_project_id" in body:
                v = body["house_project_id"]
                sets.append(f"house_project_id={str(int(v)) if v else 'NULL'}")
            if not sets:
                return resp({"error": "Нет полей для обновления"}, 400)
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {S}.orders SET {', '.join(sets)}, updated_at=NOW() WHERE id={oid}"
            )
            conn.commit()
            cur.close()
            return resp({"ok": True})

        # ------------------------------------------------------------------ #
        # POST add_event                                                      #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "add_event":
            order_id = body.get("order_id")
            if not order_id:
                return resp({"error": "order_id обязателен"}, 400)
            etype = body.get("type", "note")
            direction = body.get("direction", "out")
            content = body.get("content", "")
            source = body.get("source", "manual")
            cur = conn.cursor()
            cur.execute(
                f"INSERT INTO {S}.lead_events "
                f"(order_id, staff_id, type, direction, content, source) "
                f"VALUES ({int(order_id)}, {int(staff['id'])}, "
                f"{_esc(etype)}, {_esc(direction)}, {_esc(content)}, {_esc(source)}) "
                f"RETURNING id"
            )
            eid = cur.fetchone()[0]
            # bump order updated_at
            cur.execute(f"UPDATE {S}.orders SET updated_at=NOW() WHERE id={int(order_id)}")
            conn.commit()
            cur.close()
            return resp({"ok": True, "id": eid})

        # ------------------------------------------------------------------ #
        # POST presigned_file                                                 #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "presigned_file":
            order_id = body.get("order_id")
            file_name = body.get("file_name", "")
            if not order_id or not file_name:
                return resp({"error": "order_id и file_name обязательны"}, 400)
            safe_name = re.sub(r"[^\w.\-]", "_", file_name)
            key = f"orders/{int(order_id)}/{safe_name}"
            presigned = s3().generate_presigned_url(
                "put_object",
                Params={"Bucket": "bucket", "Key": key, "ContentType": "application/octet-stream"},
                ExpiresIn=600,
            )
            return resp({"presigned_url": presigned, "cdn_url": cdn_url(key), "key": key})

        # ------------------------------------------------------------------ #
        # POST confirm_file                                                   #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "confirm_file":
            order_id = body.get("order_id")
            file_name = body.get("file_name", "")
            file_url = body.get("file_url", "")
            file_type = body.get("file_type", "other")
            if not order_id or not file_url:
                return resp({"error": "order_id и file_url обязательны"}, 400)
            cur = conn.cursor()
            cur.execute(
                f"INSERT INTO {S}.order_files "
                f"(order_id, file_name, file_url, file_type, parse_status) "
                f"VALUES ({int(order_id)}, {_esc(file_name)}, {_esc(file_url)}, "
                f"{_esc(file_type)}, 'pending') RETURNING id"
            )
            fid = cur.fetchone()[0]
            conn.commit()
            cur.close()
            return resp({"ok": True, "id": fid})

        # ------------------------------------------------------------------ #
        # POST parse_file                                                     #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "parse_file":
            order_id = body.get("order_id")
            file_url = body.get("file_url", "")
            file_id = body.get("file_id")
            if not order_id or not file_url:
                return resp({"error": "order_id и file_url обязательны"}, 400)

            # Download file from S3 / CDN
            try:
                req = urllib.request.Request(file_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=60) as r:
                    file_data = r.read()
            except Exception as e:
                return resp({"error": f"Ошибка загрузки файла: {e}"}, 500)

            file_name = file_url.rsplit("/", 1)[-1]
            text = extract_text_from_file(file_data, file_name)
            items = deepseek_parse(text) if text else []

            parse_result = json.dumps(items, ensure_ascii=False)

            cur = conn.cursor()
            # update order_files if file_id given
            if file_id:
                cur.execute(
                    f"UPDATE {S}.order_files "
                    f"SET parse_result={_esc(parse_result)}::jsonb, parse_status='done' "
                    f"WHERE id={int(file_id)}"
                )
            else:
                cur.execute(
                    f"UPDATE {S}.order_files "
                    f"SET parse_result={_esc(parse_result)}::jsonb, parse_status='done' "
                    f"WHERE order_id={int(order_id)} AND file_url={_esc(file_url)}"
                )

            # calculate totals
            total_qty = sum(float(i.get("qty") or 0) for i in items)
            total_amount = sum(
                float(i.get("qty") or 0) * float(i.get("price_per_unit") or 0) for i in items
            )

            # upsert order_specs
            cur.execute(
                f"SELECT id FROM {S}.order_specs WHERE order_id={int(order_id)} ORDER BY created_at LIMIT 1"
            )
            spec_row = cur.fetchone()
            if spec_row:
                cur.execute(
                    f"UPDATE {S}.order_specs "
                    f"SET items={_esc(parse_result)}::jsonb, "
                    f"total_qty={total_qty}, total_amount={total_amount}, "
                    f"updated_at=NOW() "
                    f"WHERE id={spec_row[0]}"
                )
            else:
                cur.execute(
                    f"INSERT INTO {S}.order_specs "
                    f"(order_id, title, items, total_qty, total_amount) "
                    f"VALUES ({int(order_id)}, 'Спецификация из файла', "
                    f"{_esc(parse_result)}::jsonb, {total_qty}, {total_amount})"
                )
            conn.commit()
            cur.close()
            return resp({"ok": True, "items": items, "total_qty": total_qty, "total_amount": total_amount})

        # ------------------------------------------------------------------ #
        # GET specs                                                           #
        # ------------------------------------------------------------------ #
        if method == "GET" and action == "specs":
            order_id = qs.get("order_id")
            if not order_id:
                return resp({"error": "order_id обязателен"}, 400)
            cur = conn.cursor()
            cur.execute(
                f"SELECT id, title, items, total_qty, total_amount, created_at, updated_at "
                f"FROM {S}.order_specs WHERE order_id={int(order_id)} ORDER BY created_at"
            )
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            cur.close()
            return resp({"specs": rows})

        # ------------------------------------------------------------------ #
        # POST save_spec                                                      #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "save_spec":
            order_id = body.get("order_id")
            if not order_id:
                return resp({"error": "order_id обязателен"}, 400)
            title = body.get("title", "Спецификация")
            items = body.get("items", [])
            spec_id = body.get("id")

            total_qty = sum(float(i.get("qty") or 0) for i in items)
            total_amount = sum(
                float(i.get("qty") or 0) * float(i.get("price_per_unit") or 0) for i in items
            )
            items_json = json.dumps(items, ensure_ascii=False)

            cur = conn.cursor()
            if spec_id:
                cur.execute(
                    f"UPDATE {S}.order_specs "
                    f"SET title={_esc(title)}, items={_esc(items_json)}::jsonb, "
                    f"total_qty={total_qty}, total_amount={total_amount}, updated_at=NOW() "
                    f"WHERE id={int(spec_id)} RETURNING id"
                )
                rid = (cur.fetchone() or [spec_id])[0]
            else:
                cur.execute(
                    f"INSERT INTO {S}.order_specs "
                    f"(order_id, title, items, total_qty, total_amount) "
                    f"VALUES ({int(order_id)}, {_esc(title)}, "
                    f"{_esc(items_json)}::jsonb, {total_qty}, {total_amount}) RETURNING id"
                )
                rid = cur.fetchone()[0]
            conn.commit()
            cur.close()
            return resp({"ok": True, "id": rid, "total_qty": total_qty, "total_amount": total_amount})

        # ------------------------------------------------------------------ #
        # POST create_proposal                                                #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "create_proposal":
            order_id = body.get("order_id")
            if not order_id:
                return resp({"error": "order_id обязателен"}, 400)
            oid = int(order_id)
            cur = conn.cursor()
            # get latest spec
            cur.execute(
                f"SELECT id, items, total_amount FROM {S}.order_specs "
                f"WHERE order_id={oid} ORDER BY created_at DESC LIMIT 1"
            )
            spec_row = cur.fetchone()
            items = spec_row[1] if spec_row else []
            total_amount = float(spec_row[2]) if spec_row else 0.0
            items_json = json.dumps(items if items else [], ensure_ascii=False)

            number = gen_proposal_number(cur)
            cur.execute(
                f"INSERT INTO {S}.commercial_proposals "
                f"(order_id, number, items, total_amount, status, created_by) "
                f"VALUES ({oid}, {_esc(number)}, {_esc(items_json)}::jsonb, "
                f"{total_amount}, 'draft', {int(staff['id'])}) RETURNING id"
            )
            pid = cur.fetchone()[0]
            conn.commit()
            cur.close()
            return resp({"ok": True, "id": pid, "number": number, "total_amount": total_amount})

        # ------------------------------------------------------------------ #
        # GET proposals                                                       #
        # ------------------------------------------------------------------ #
        if method == "GET" and action == "proposals":
            order_id = qs.get("order_id")
            if not order_id:
                return resp({"error": "order_id обязателен"}, 400)
            cur = conn.cursor()
            cur.execute(
                f"SELECT id, number, status, total_amount, items, created_at "
                f"FROM {S}.commercial_proposals WHERE order_id={int(order_id)} ORDER BY created_at DESC"
            )
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            cur.close()
            return resp({"proposals": rows})

        # ------------------------------------------------------------------ #
        # POST create_contract                                                #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "create_contract":
            order_id = body.get("order_id")
            template_id = body.get("template_id")
            if not order_id:
                return resp({"error": "order_id обязателен"}, 400)
            oid = int(order_id)
            cur = conn.cursor()

            # get order
            cur.execute(
                f"SELECT client_name, client_phone, client_email, address, budget "
                f"FROM {S}.orders WHERE id={oid}"
            )
            order_row = cur.fetchone()
            if not order_row:
                cur.close()
                return resp({"error": "Заказ не найден"}, 404)
            client_name, client_phone, client_email, address, budget = order_row

            # get company settings
            cur.execute(f"SELECT company_name, inn, legal_address, director_name FROM {S}.company_settings WHERE id=1")
            cs = cur.fetchone()
            company_name = cs[0] if cs else ""
            company_inn = cs[1] if cs else ""
            company_address = cs[2] if cs else ""
            director_name = cs[3] if cs else ""

            # get template content
            content_text = ""
            if template_id:
                cur.execute(
                    f"SELECT content_text FROM {S}.contract_templates WHERE id={int(template_id)} AND is_active=TRUE"
                )
                tr = cur.fetchone()
                if tr:
                    content_text = tr[0] or ""

            # fill placeholders
            content_filled = (
                content_text
                .replace("{{client_name}}", client_name or "")
                .replace("{{client_phone}}", client_phone or "")
                .replace("{{client_email}}", client_email or "")
                .replace("{{address}}", address or "")
                .replace("{{budget}}", str(budget) if budget else "")
                .replace("{{company_name}}", company_name or "")
                .replace("{{company_inn}}", company_inn or "")
                .replace("{{company_address}}", company_address or "")
                .replace("{{director_name}}", director_name or "")
            )

            number = gen_contract_number(cur)
            tpl_id_sql = str(int(template_id)) if template_id else "NULL"
            cur.execute(
                f"INSERT INTO {S}.contracts "
                f"(order_id, number, template_id, content_text, status, created_by) "
                f"VALUES ({oid}, {_esc(number)}, {tpl_id_sql}, {_esc(content_filled)}, 'draft', {int(staff['id'])}) "
                f"RETURNING id"
            )
            cid = cur.fetchone()[0]
            conn.commit()
            cur.close()
            return resp({"ok": True, "id": cid, "number": number})

        # ------------------------------------------------------------------ #
        # GET contracts                                                       #
        # ------------------------------------------------------------------ #
        if method == "GET" and action == "contracts":
            order_id = qs.get("order_id")
            if not order_id:
                return resp({"error": "order_id обязателен"}, 400)
            cur = conn.cursor()
            cur.execute(
                f"SELECT id, number, status, template_id, created_at, "
                f"lawyer_approved_by, lawyer_approved_at "
                f"FROM {S}.contracts WHERE order_id={int(order_id)} ORDER BY created_at DESC"
            )
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            cur.close()
            return resp({"contracts": rows})

        # ------------------------------------------------------------------ #
        # POST approve_contract                                               #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "approve_contract":
            contract_id = body.get("contract_id") or qs.get("contract_id")
            if not contract_id:
                return resp({"error": "contract_id обязателен"}, 400)
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {S}.contracts "
                f"SET status='approved', lawyer_approved_by={int(staff['id'])}, "
                f"lawyer_approved_at=NOW() "
                f"WHERE id={int(contract_id)}"
            )
            conn.commit()
            cur.close()
            return resp({"ok": True})

        # ------------------------------------------------------------------ #
        # POST create_procurement                                             #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "create_procurement":
            order_id = body.get("order_id")
            if not order_id:
                return resp({"error": "order_id обязателен"}, 400)
            oid = int(order_id)
            cur = conn.cursor()
            # get latest spec items
            cur.execute(
                f"SELECT items FROM {S}.order_specs WHERE order_id={oid} "
                f"ORDER BY created_at DESC LIMIT 1"
            )
            sr = cur.fetchone()
            if not sr or not sr[0]:
                cur.close()
                return resp({"error": "Спецификация не найдена"}, 404)
            items = sr[0] if isinstance(sr[0], list) else json.loads(sr[0])

            # aggregate materials by name+unit
            materials: dict = {}
            for item in items:
                name = item.get("name", "").strip()
                unit = item.get("unit", "шт")
                qty = float(item.get("qty") or 0)
                price = float(item.get("price_per_unit") or 0)
                if not name or qty <= 0:
                    continue
                key = f"{name}|{unit}"
                if key in materials:
                    materials[key]["qty"] += qty
                else:
                    materials[key] = {
                        "name": name,
                        "unit": unit,
                        "qty": qty,
                        "price_per_unit": price,
                        "section": item.get("section", ""),
                        "note": item.get("note", ""),
                    }

            material_list = list(materials.values())
            total_amount = sum(m["qty"] * m["price_per_unit"] for m in material_list)
            items_json = json.dumps(material_list, ensure_ascii=False)

            # upsert procurement_lists
            cur.execute(
                f"SELECT id FROM {S}.procurement_lists WHERE order_id={oid} LIMIT 1"
            )
            pr = cur.fetchone()
            if pr:
                cur.execute(
                    f"UPDATE {S}.procurement_lists "
                    f"SET items={_esc(items_json)}::jsonb, total_amount={total_amount}, "
                    f"updated_at=NOW() WHERE id={pr[0]}"
                )
                proc_id = pr[0]
            else:
                cur.execute(
                    f"INSERT INTO {S}.procurement_lists "
                    f"(order_id, items, total_amount, status) "
                    f"VALUES ({oid}, {_esc(items_json)}::jsonb, {total_amount}, 'draft') "
                    f"RETURNING id"
                )
                proc_id = cur.fetchone()[0]
            conn.commit()
            cur.close()
            return resp({"ok": True, "id": proc_id, "items": material_list, "total_amount": total_amount})

        # ------------------------------------------------------------------ #
        # GET procurement                                                     #
        # ------------------------------------------------------------------ #
        if method == "GET" and action == "procurement":
            order_id = qs.get("order_id")
            if not order_id:
                return resp({"error": "order_id обязателен"}, 400)
            cur = conn.cursor()
            cur.execute(
                f"SELECT id, items, total_amount, status, created_at, updated_at "
                f"FROM {S}.procurement_lists WHERE order_id={int(order_id)} ORDER BY created_at DESC LIMIT 1"
            )
            row = cur.fetchone()
            if not row:
                cur.close()
                return resp({"procurement": None})
            cols = [d[0] for d in cur.description]
            cur.close()
            return resp({"procurement": dict(zip(cols, row))})

        return resp({"error": "Неизвестное действие"}, 404)

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return resp({"error": str(e)}, 500)
    finally:
        conn.close()
