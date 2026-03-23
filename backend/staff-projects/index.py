"""
API управления проектами: проекты, файлы (S3), ведомости объёмов работ (BOQ)
Роутинг через ?action=...
"""
import json, os, base64, mimetypes, re, urllib.request
import psycopg2
import boto3

S = "t_p78845984_auto_house_cost_calc"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

def db(): return psycopg2.connect(os.environ["DATABASE_URL"])
def resp(data, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}

def s3_client():
    return boto3.client("s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"])

def cdn_url(key):
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

def get_staff(conn, token):
    cur = conn.cursor()
    cur.execute(f"SELECT s.id,s.full_name,s.role_code FROM {S}.sessions ss "
                f"JOIN {S}.staff s ON s.id=ss.staff_id "
                f"WHERE ss.token=%s AND ss.expires_at>NOW()", (token,))
    r = cur.fetchone(); cur.close()
    return {"id":r[0],"full_name":r[1],"role_code":r[2]} if r else None

def log(conn, staff_id, entity, eid, action, details=""):
    cur = conn.cursor()
    cur.execute(f"INSERT INTO {S}.change_log (staff_id,entity,entity_id,action,details) VALUES (%s,%s,%s,%s,%s)",
                (staff_id, entity, eid, action, details)); cur.close()

def project_row(r):
    return {"id":r[0],"name":r[1],"type":r[2],"area":r[3],"floors":r[4],"rooms":r[5],"price":r[6],
            "tag":r[7],"tag_color":r[8],"description":r[9],"features":r[10],
            "is_active":r[11],"created_by":r[12],"updated_by":r[13],
            "created_at":str(r[14]),"updated_at":str(r[15]),
            "roof_type":r[16] or "","foundation_type":r[17] or "","wall_type":r[18] or "",
            "foundation_material":r[19] or "","foundation_depth":r[20] or "",
            "ext_wall_material":r[21] or "","ext_wall_thickness":r[22] or "",
            "int_bearing_material":r[23] or "","int_bearing_thickness":r[24] or "",
            "partition_material":r[25] or "","partition_thickness":r[26] or "",
            "floor_slab_material":r[27] or "","floor_slab_thickness":r[28] or "","floor_slab_area":r[29] or "",
            "attic_slab_material":r[30] or "","attic_slab_thickness":r[31] or "",
            "window_material":r[32] or "","window_profile":r[33] or "","window_color":r[34] or "","window_area":r[35] or "",
            "door_info":r[36] or "","staircase_info":r[37] or "",
            "roof_material":r[38] or "","roof_area":r[39] or "","roof_style":r[40] or "",
            "heating_type":r[41] or "","water_supply":r[42] or "","sewage":r[43] or "","electrical":r[44] or ""}

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode":200,"headers":CORS,"body":""}

    method = event.get("httpMethod","GET")
    qs = event.get("queryStringParameters") or {}
    action = qs.get("action","")
    token = event.get("headers",{}).get("X-Auth-Token","")
    body = {}
    if event.get("body"):
        try: body = json.loads(event["body"])
        except ValueError: pass

    conn = db()

    # ── Публичные endpoint'ы (без токена) ─────────────────────────────────────

    # GET project list (public)
    if method == "GET" and action == "public_list":
        cur = conn.cursor()
        cur.execute(f"""
            SELECT p.id,p.name,p.type,p.area,p.floors,p.rooms,p.price,p.tag,p.tag_color,
                   p.description,p.features,p.is_active,p.created_by,p.updated_by,p.created_at,p.updated_at,
                   p.roof_type,p.foundation_type,p.wall_type,
                   p.foundation_material,p.foundation_depth,p.ext_wall_material,p.ext_wall_thickness,
                   p.int_bearing_material,p.int_bearing_thickness,p.partition_material,p.partition_thickness,
                   p.floor_slab_material,p.floor_slab_thickness,p.floor_slab_area,p.attic_slab_material,p.attic_slab_thickness,
                   p.window_material,p.window_profile,p.window_color,p.window_area,p.door_info,p.staircase_info,
                   p.roof_material,p.roof_area,p.roof_style,p.heating_type,p.water_supply,p.sewage,p.electrical
            FROM {S}.house_projects p WHERE p.is_active=TRUE ORDER BY p.created_at DESC
        """)
        projects = [project_row(r) for r in cur.fetchall()]
        # Добавляем файлы к каждому проекту
        for p in projects:
            cur.execute(f"SELECT id,file_type,file_url,file_name,sort_order FROM {S}.project_files WHERE project_id=%s ORDER BY file_type,sort_order", (p["id"],))
            p["files"] = [{"id":f[0],"file_type":f[1],"file_url":f[2],"file_name":f[3],"sort_order":f[4]} for f in cur.fetchall()]
        cur.close(); conn.close()
        return resp({"projects": projects})

    # GET single project (public)
    if method == "GET" and action == "public_get":
        pid = qs.get("project_id")
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"""
            SELECT id,name,type,area,floors,rooms,price,tag,tag_color,description,features,
                   is_active,created_by,updated_by,created_at,updated_at,
                   roof_type,foundation_type,wall_type
            FROM {S}.house_projects WHERE id=%s AND is_active=TRUE
        """, (pid,))
        r = cur.fetchone()
        if not r: cur.close(); conn.close(); return resp({"error":"Не найден"}, 404)
        p = project_row(r)
        cur.execute(f"SELECT id,file_type,file_url,file_name,sort_order FROM {S}.project_files WHERE project_id=%s ORDER BY file_type,sort_order", (p["id"],))
        p["files"] = [{"id":f[0],"file_type":f[1],"file_url":f[2],"file_name":f[3],"sort_order":f[4]} for f in cur.fetchall()]
        # Публичная смета (последняя утверждённая версия)
        cur.execute(f"""
            SELECT ps.id,ps.title,ps.version,ps.status,ps.created_at,ps.updated_at
            FROM {S}.project_specs ps
            WHERE ps.project_id=%s
            ORDER BY ps.status='approved' DESC, ps.version DESC LIMIT 1
        """, (pid,))
        spec_row = cur.fetchone()
        if spec_row:
            spec = {"id":spec_row[0],"title":spec_row[1],"version":spec_row[2],"status":spec_row[3],"created_at":str(spec_row[4]),"updated_at":str(spec_row[5])}
            cur.execute(f"""
                SELECT id,section,name,unit,qty,price_per_unit,total_price,note
                FROM {S}.spec_items WHERE spec_id=%s ORDER BY section,id
            """, (spec_row[0],))
            spec["items"] = [{"id":i[0],"section":i[1],"name":i[2],"unit":i[3],"qty":float(i[4]),"price_per_unit":float(i[5]),"total_price":float(i[6]),"note":i[7] or ""} for i in cur.fetchall()]
            p["spec"] = spec
        else:
            p["spec"] = None
        cur.close(); conn.close()
        return resp({"project": p})

    # GET estimate from tech cards (public) — смета из ТТК по типу дома
    if method == "GET" and action == "estimate_from_ttk":
        pid = qs.get("project_id")
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT type,area,floors,rooms,price,roof_type,foundation_type,wall_type FROM {S}.house_projects WHERE id=%s AND is_active=TRUE", (pid,))
        pr = cur.fetchone()
        if not pr: cur.close(); conn.close(); return resp({"error":"Не найден"}, 404)
        house_type, area, floors, rooms, price, roof_type, foundation_type, wall_type = pr

        # Подбираем ТТК по типу дома и составу работ
        # Фундамент
        if foundation_type and "свай" in foundation_type.lower():
            found_ids = [14]
        elif foundation_type and "плит" in foundation_type.lower():
            found_ids = [13]
        else:
            found_ids = [2]

        # Стены — по типу дома
        type_lower = house_type.lower()
        if "каркас" in type_lower:
            wall_ids = [19]
        elif "сип" in type_lower or "модул" in type_lower:
            wall_ids = [20]
        elif "газобетон" in type_lower or "газо" in type_lower:
            wall_ids = [18]
        elif "кирпич" in type_lower:
            wall_ids = [1]
        else:
            wall_ids = [19]  # по умолчанию каркас

        # Кровля — по типу кровли
        if roof_type and ("металло" in roof_type.lower() or "металлочерепиц" in roof_type.lower()):
            roof_ids = [3, 10]
        elif roof_type and ("профнастил" in roof_type.lower() or "профл" in roof_type.lower()):
            roof_ids = [3, 11]
        elif roof_type and ("мягк" in roof_type.lower() or "гибк" in roof_type.lower() or "битум" in roof_type.lower()):
            roof_ids = [3, 12]
        elif "каркас" in type_lower:
            roof_ids = [21]
        else:
            roof_ids = [3, 10]

        # Стандартный набор остальных ТТК
        base_ids = [4, 17, 5, 6, 15, 16]

        all_ids = found_ids + wall_ids + roof_ids + base_ids
        cur.execute(f"SELECT id,title,category,materials FROM {S}.tech_cards WHERE id=ANY(%s) AND is_active=TRUE", (all_ids,))
        ttk_rows = cur.fetchall()
        cur.close()

        # Стоимость по разделам (доля от общей цены)
        section_budget = {
            "Фундамент":    price * 0.14,
            "Стены":        price * 0.22,
            "Кровля":       price * 0.10,
            "Полы":         price * 0.06,
            "Инженерия":    price * 0.16,
            "Окна и двери": price * 0.07,
            "Отделка":      price * 0.09,
            "Электрика":    price * 0.06,
        }

        # Поверхность кровли ~1.35 от площади для двускатной
        roof_area = round(area * 1.35, 1)

        items = []
        item_id = 1
        for row in ttk_rows:
            ttk_id, ttk_title, category, materials = row
            if not materials: continue
            # Определяем базовую площадь для расчёта количества
            if category in ("Кровля",):
                base_qty = roof_area
            elif category in ("Полы",):
                base_qty = area * floors
            elif category in ("Отделка",):
                base_qty = area * floors
            else:
                base_qty = area

            # Считаем количество позиций ТТК с qty_per_unit > 0
            valid_mats = [m for m in materials if m.get("qty_per_unit", 0) > 0]
            if not valid_mats: continue

            # Получаем бюджет раздела и делим между ТТК того же раздела
            ttk_in_section = [r for r in ttk_rows if r[2] == category]
            budget_per_ttk = section_budget.get(category, price * 0.05) / max(len(ttk_in_section), 1)

            for mat in valid_mats:
                qty = round(mat["qty_per_unit"] * base_qty, 2)
                if qty <= 0: continue
                # Распределяем бюджет раздела по материалам равномерно
                price_per_unit = round(budget_per_ttk / (len(valid_mats) * qty), 2) if qty > 0 else 0
                total = round(price_per_unit * qty, 2)
                items.append({
                    "id": item_id,
                    "section": f"{category} / {ttk_title}",
                    "name": mat["name"],
                    "unit": mat.get("unit", "шт"),
                    "qty": qty,
                    "price_per_unit": price_per_unit,
                    "total_price": total,
                    "note": mat.get("note", ""),
                })
                item_id += 1

        conn.close()
        return resp({"ok": True, "items": items, "source": "ttk"})

    # ── Авторизованные endpoint'ы ─────────────────────────────────────────────
    if not token: conn.close(); return resp({"error":"Не авторизован"}, 401)
    staff = get_staff(conn, token)
    if not staff: conn.close(); return resp({"error":"Сессия истекла"}, 401)
    role = staff["role_code"]

    # ── Проекты (CRUD) ────────────────────────────────────────────────────────

    if action == "list":
        cur = conn.cursor()
        cur.execute(f"""
            SELECT hp.id,hp.name,hp.type,hp.area,hp.floors,hp.rooms,hp.price,hp.tag,hp.tag_color,
                   hp.description,hp.features,hp.is_active,hp.created_by,hp.updated_by,hp.created_at,hp.updated_at,
                   hp.roof_type,hp.foundation_type,hp.wall_type,hp.foundation_material,hp.foundation_depth,
                   hp.ext_wall_material,hp.ext_wall_thickness,hp.int_bearing_material,hp.int_bearing_thickness,
                   hp.partition_material,hp.partition_thickness,hp.floor_slab_material,hp.floor_slab_thickness,
                   hp.floor_slab_area,hp.attic_slab_material,hp.attic_slab_thickness,hp.window_material,
                   hp.window_profile,hp.window_color,hp.window_area,hp.door_info,hp.staircase_info,
                   hp.roof_material,hp.roof_area,hp.roof_style,hp.heating_type,hp.water_supply,hp.sewage,hp.electrical,
                   hp.calc_status,hp.locked_by,hp.has_calc,hp.assigned_reviewer,hp.review_comment,
                   ls.full_name as locker_name, rv.full_name as reviewer_name
            FROM {S}.house_projects hp
            LEFT JOIN {S}.staff ls ON ls.id = hp.locked_by
            LEFT JOIN {S}.staff rv ON rv.id = hp.assigned_reviewer
            ORDER BY hp.created_at DESC""")
        rows = cur.fetchall()
        projects = []
        for r in rows:
            p = project_row(r)
            p["calc_status"] = r[45] or "draft"
            p["locked_by"] = r[46]
            p["has_calc"] = bool(r[47])
            p["assigned_reviewer"] = r[48]
            p["review_comment"] = r[49]
            p["locked_by_name"] = r[50]
            p["reviewer_name"] = r[51]
            p["locked_by_me"] = r[46] == staff["id"]
            projects.append(p)
        for p in projects:
            cur.execute(f"SELECT id,file_type,file_url,file_name,sort_order FROM {S}.project_files WHERE project_id=%s ORDER BY file_type,sort_order", (p["id"],))
            p["files"] = [{"id":f[0],"file_type":f[1],"file_url":f[2],"file_name":f[3],"sort_order":f[4]} for f in cur.fetchall()]
        cur.close(); conn.close()
        return resp({"projects": projects})

    if action == "get":
        pid = body.get("project_id") or qs.get("project_id")
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT id,name,type,area,floors,rooms,price,tag,tag_color,description,features,is_active,created_by,updated_by,created_at,updated_at,roof_type,foundation_type,wall_type,foundation_material,foundation_depth,ext_wall_material,ext_wall_thickness,int_bearing_material,int_bearing_thickness,partition_material,partition_thickness,floor_slab_material,floor_slab_thickness,floor_slab_area,attic_slab_material,attic_slab_thickness,window_material,window_profile,window_color,window_area,door_info,staircase_info,roof_material,roof_area,roof_style,heating_type,water_supply,sewage,electrical FROM {S}.house_projects WHERE id=%s", (pid,))
        r = cur.fetchone()
        if not r: cur.close(); conn.close(); return resp({"error":"Не найден"}, 404)
        p = project_row(r)
        cur.execute(f"SELECT id,file_type,file_url,file_name,sort_order FROM {S}.project_files WHERE project_id=%s ORDER BY file_type,sort_order", (p["id"],))
        p["files"] = [{"id":f[0],"file_type":f[1],"file_url":f[2],"file_name":f[3],"sort_order":f[4]} for f in cur.fetchall()]
        # Specs
        cur.execute(f"SELECT id,title,version,status,created_at,updated_at FROM {S}.project_specs WHERE project_id=%s ORDER BY version DESC", (pid,))
        p["specs"] = [{"id":s[0],"title":s[1],"version":s[2],"status":s[3],"created_at":str(s[4]),"updated_at":str(s[5])} for s in cur.fetchall()]
        cur.close(); conn.close()
        return resp({"project": p})

    if action == "create":
        if role != "architect": conn.close(); return resp({"error":"Только архитектор"}, 403)
        for f in ["name","type","area","floors","rooms","price"]:
            if body.get(f) is None: conn.close(); return resp({"error":f"Поле {f} обязательно"}, 400)
        cur = conn.cursor()
        cur.execute(f"""INSERT INTO {S}.house_projects
            (name,type,area,floors,rooms,price,tag,tag_color,description,features,roof_type,foundation_type,wall_type,
             foundation_material,foundation_depth,ext_wall_material,ext_wall_thickness,int_bearing_material,int_bearing_thickness,
             partition_material,partition_thickness,floor_slab_material,floor_slab_thickness,floor_slab_area,
             attic_slab_material,attic_slab_thickness,window_material,window_profile,window_color,window_area,
             door_info,staircase_info,roof_material,roof_area,roof_style,heating_type,water_supply,sewage,electrical,
             created_by,updated_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (body["name"],body["type"],body["area"],body["floors"],body["rooms"],body["price"],
             body.get("tag",""),body.get("tag_color","#FF6B1A"),body.get("description",""),body.get("features",""),
             body.get("roof_type",""),body.get("foundation_type",""),body.get("wall_type",""),
             body.get("foundation_material",""),body.get("foundation_depth",""),
             body.get("ext_wall_material",""),body.get("ext_wall_thickness",""),
             body.get("int_bearing_material",""),body.get("int_bearing_thickness",""),
             body.get("partition_material",""),body.get("partition_thickness",""),
             body.get("floor_slab_material",""),body.get("floor_slab_thickness",""),body.get("floor_slab_area",""),
             body.get("attic_slab_material",""),body.get("attic_slab_thickness",""),
             body.get("window_material",""),body.get("window_profile",""),body.get("window_color",""),body.get("window_area",""),
             body.get("door_info",""),body.get("staircase_info",""),
             body.get("roof_material",""),body.get("roof_area",""),body.get("roof_style",""),
             body.get("heating_type",""),body.get("water_supply",""),body.get("sewage",""),body.get("electrical",""),
             staff["id"],staff["id"]))
        new_id = cur.fetchone()[0]
        log(conn, staff["id"], "house_projects", new_id, "create", body["name"])
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True,"id":new_id})

    if action == "update":
        if role != "architect": conn.close(); return resp({"error":"Только архитектор"}, 403)
        pid = body.get("project_id")
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        editable = ["name","type","area","floors","rooms","price","tag","tag_color","description","features","is_active",
                    "roof_type","foundation_type","wall_type",
                    "foundation_material","foundation_depth","ext_wall_material","ext_wall_thickness",
                    "int_bearing_material","int_bearing_thickness","partition_material","partition_thickness",
                    "floor_slab_material","floor_slab_thickness","floor_slab_area","attic_slab_material","attic_slab_thickness",
                    "window_material","window_profile","window_color","window_area","door_info","staircase_info",
                    "roof_material","roof_area","roof_style","heating_type","water_supply","sewage","electrical"]
        fields, vals = [], []
        for k in editable:
            if k in body: fields.append(f"{k}=%s"); vals.append(body[k])
        if not fields: conn.close(); return resp({"error":"Нет полей"}, 400)
        fields += ["updated_by=%s","updated_at=NOW()"]; vals += [staff["id"], pid]
        cur = conn.cursor()
        cur.execute(f"UPDATE {S}.house_projects SET {','.join(fields)} WHERE id=%s", vals)
        log(conn, staff["id"], "house_projects", pid, "update", str(body))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True})

    # ── Блокировка / разблокировка проекта ───────────────────────────────────

    if action == "lock":
        pid = body.get("project_id")
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        if role not in ("architect","constructor","admin","manager"):
            conn.close(); return resp({"error":"Нет доступа"}, 403)
        cur = conn.cursor()
        # Проверяем — не заблокирован ли уже другим
        cur.execute(f"SELECT locked_by FROM {S}.house_projects WHERE id=%s", (pid,))
        row = cur.fetchone()
        if row and row[0] and row[0] != staff["id"]:
            cur.close(); conn.close(); return resp({"error":"Проект уже заблокирован другим сотрудником"}, 409)
        cur.execute(f"UPDATE {S}.house_projects SET locked_by=%s, locked_at=NOW(), calc_status='in_progress' WHERE id=%s",
                    (staff["id"], pid))
        log(conn, staff["id"], "house_projects", pid, "lock", f"Заблокировал: {staff['full_name']}")
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True})

    if action == "unlock":
        pid = body.get("project_id")
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT locked_by FROM {S}.house_projects WHERE id=%s", (pid,))
        row = cur.fetchone()
        # Снять блокировку может сам заблокировавший или admin/manager
        if row and row[0] and row[0] != staff["id"] and role not in ("admin","manager"):
            cur.close(); conn.close(); return resp({"error":"Нет прав снять блокировку"}, 403)
        cur.execute(f"UPDATE {S}.house_projects SET locked_by=NULL, locked_at=NULL WHERE id=%s", (pid,))
        log(conn, staff["id"], "house_projects", pid, "unlock", f"Разблокировал: {staff['full_name']}")
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True})

    # ── Получить статус блокировки ────────────────────────────────────────────

    if action == "lock_status":
        pid = qs.get("project_id")
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"SELECT hp.locked_by, hp.locked_at, hp.calc_status, hp.has_calc, "
            f"hp.assigned_reviewer, hp.submitted_at, hp.review_comment, "
            f"s.full_name, s.role_code, "
            f"rv.full_name "
            f"FROM {S}.house_projects hp "
            f"LEFT JOIN {S}.staff s ON s.id = hp.locked_by "
            f"LEFT JOIN {S}.staff rv ON rv.id = hp.assigned_reviewer "
            f"WHERE hp.id=%s", (pid,))
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row: return resp({"error":"Не найден"}, 404)
        locked_by_id, locked_at, calc_status, has_calc, reviewer_id, submitted_at, review_comment, locker_name, locker_role, reviewer_name = row
        return resp({
            "locked": locked_by_id is not None,
            "locked_by_id": locked_by_id,
            "locked_by_name": locker_name,
            "locked_by_me": locked_by_id == staff["id"],
            "locked_at": str(locked_at) if locked_at else None,
            "calc_status": calc_status or "draft",
            "has_calc": bool(has_calc),
            "assigned_reviewer_id": reviewer_id,
            "assigned_reviewer_name": reviewer_name,
            "submitted_at": str(submitted_at) if submitted_at else None,
            "review_comment": review_comment,
        })

    # ── Отправить на согласование ─────────────────────────────────────────────

    if action == "submit_for_review":
        pid = body.get("project_id")
        reviewer_id = body.get("reviewer_id")
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        if role not in ("architect","constructor"):
            conn.close(); return resp({"error":"Только архитектор или конструктор"}, 403)
        cur = conn.cursor()
        # Проверяем что проект заблокирован этим сотрудником
        cur.execute(f"SELECT locked_by, name FROM {S}.house_projects WHERE id=%s", (pid,))
        row = cur.fetchone()
        if not row: cur.close(); conn.close(); return resp({"error":"Проект не найден"}, 404)
        if row[0] != staff["id"]:
            cur.close(); conn.close(); return resp({"error":"Проект не заблокирован вами"}, 403)
        project_name = row[1]
        cur.execute(
            f"UPDATE {S}.house_projects SET calc_status='submitted', submitted_by=%s, submitted_at=NOW(), "
            f"assigned_reviewer=%s WHERE id=%s",
            (staff["id"], reviewer_id, pid))
        cur.execute(
            f"INSERT INTO {S}.project_reviews (project_id, action, staff_id, comment) VALUES (%s,'submitted',%s,%s)",
            (pid, staff["id"], f"Отправлен на согласование. Руководитель ID: {reviewer_id}"))
        log(conn, staff["id"], "house_projects", pid, "submit_for_review", project_name)
        conn.commit(); cur.close()

        # Уведомление в Битрикс если есть webhook
        reviewer_bitrix_id = None
        manager_bitrix_ids = []
        if reviewer_id:
            cur2 = conn.cursor()
            cur2.execute(f"SELECT bitrix_user_id FROM {S}.staff WHERE id=%s", (reviewer_id,))
            rv = cur2.fetchone()
            if rv: reviewer_bitrix_id = rv[0]
            cur2.execute(f"SELECT bitrix_user_id FROM {S}.staff WHERE role_code IN ('admin','manager') AND bitrix_user_id IS NOT NULL")
            manager_bitrix_ids = [r[0] for r in cur2.fetchall()]
            cur2.close()

        webhook = os.environ.get("BITRIX24_WEBHOOK","").rstrip("/")
        if webhook and reviewer_bitrix_id:
            try:
                desc = (f"[B]Проект:[/B] {project_name}\n"
                        f"[B]Отправил:[/B] {staff['full_name']}\n\n"
                        f"Расчёт готов. Требуется согласование или отклонение с комментарием.")
                fields = {"TITLE": f"Согласование расчёта — {project_name}",
                          "DESCRIPTION": desc, "RESPONSIBLE_ID": reviewer_bitrix_id,
                          "PRIORITY": "2"}
                auditors = [i for i in manager_bitrix_ids if i != reviewer_bitrix_id]
                if auditors: fields["AUDITORS"] = auditors
                data = json.dumps({"fields": fields}, ensure_ascii=False).encode()
                req = urllib.request.Request(f"{webhook}/tasks.task.add.json", data=data,
                    headers={"Content-Type":"application/json"}, method="POST")
                urllib.request.urlopen(req, timeout=10)
            except Exception as e:
                print(f"[staff-projects] Bitrix notify error: {e}")

        conn.close()
        return resp({"ok": True})

    # ── Согласовать / Отклонить ───────────────────────────────────────────────

    if action in ("approve", "reject"):
        pid = body.get("project_id")
        comment = body.get("comment","").strip()
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        if role not in ("admin","manager"):
            conn.close(); return resp({"error":"Только руководитель"}, 403)
        if action == "reject" and not comment:
            conn.close(); return resp({"error":"Комментарий обязателен при отклонении"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT name, locked_by FROM {S}.house_projects WHERE id=%s", (pid,))
        row = cur.fetchone()
        if not row: cur.close(); conn.close(); return resp({"error":"Не найден"}, 404)
        project_name, locked_by_id = row

        new_status = "approved" if action == "approve" else "rejected"
        cur.execute(
            f"UPDATE {S}.house_projects SET calc_status=%s, reviewed_by=%s, reviewed_at=NOW(), "
            f"review_comment=%s WHERE id=%s",
            (new_status, staff["id"], comment, pid))
        # При отклонении снимаем блокировку — архитектор должен доработать
        if action == "reject":
            cur.execute(f"UPDATE {S}.house_projects SET locked_by=NULL, locked_at=NULL WHERE id=%s", (pid,))
        cur.execute(
            f"INSERT INTO {S}.project_reviews (project_id, action, staff_id, comment) VALUES (%s,%s,%s,%s)",
            (pid, action, staff["id"], comment))
        log(conn, staff["id"], "house_projects", pid, action, f"{project_name}: {comment[:100]}")
        conn.commit(); cur.close()

        # Уведомить архитектора в Битрикс
        webhook = os.environ.get("BITRIX24_WEBHOOK","").rstrip("/")
        if webhook and locked_by_id:
            try:
                cur2 = conn.cursor()
                cur2.execute(f"SELECT bitrix_user_id FROM {S}.staff WHERE id=%s", (locked_by_id,))
                rv = cur2.fetchone(); cur2.close()
                if rv and rv[0]:
                    emoji = "✅" if action == "approve" else "❌"
                    desc = (f"[B]Проект:[/B] {project_name}\n"
                            f"[B]Решение:[/B] {'Согласован' if action=='approve' else 'Отклонён'}\n"
                            f"[B]Руководитель:[/B] {staff['full_name']}\n"
                            + (f"[B]Комментарий:[/B] {comment}" if comment else ""))
                    data = json.dumps({"fields": {
                        "TITLE": f"{emoji} Расчёт {'согласован' if action=='approve' else 'отклонён'} — {project_name}",
                        "DESCRIPTION": desc, "RESPONSIBLE_ID": rv[0], "PRIORITY": "2"
                    }}, ensure_ascii=False).encode()
                    req = urllib.request.Request(f"{webhook}/tasks.task.add.json", data=data,
                        headers={"Content-Type":"application/json"}, method="POST")
                    urllib.request.urlopen(req, timeout=10)
            except Exception as e:
                print(f"[staff-projects] Bitrix feedback error: {e}")

        conn.close()
        return resp({"ok": True, "status": new_status})

    # ── Список руководителей для назначения ───────────────────────────────────

    if action == "reviewers_list":
        cur = conn.cursor()
        cur.execute(f"SELECT id, full_name, role_code FROM {S}.staff WHERE role_code IN ('admin','manager') ORDER BY full_name")
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"reviewers": [{"id":r[0],"full_name":r[1],"role_code":r[2]} for r in rows]})

    # ── Обновить has_calc (вызывается при изменении расчёта) ──────────────────

    if action == "update_has_calc":
        pid = body.get("project_id")
        has = body.get("has_calc", False)
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"UPDATE {S}.house_projects SET has_calc=%s WHERE id=%s", (has, pid))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True})

    # ── История согласований ──────────────────────────────────────────────────

    if action == "reviews_history":
        pid = qs.get("project_id")
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"SELECT pr.id, pr.action, pr.comment, pr.created_at, s.full_name "
            f"FROM {S}.project_reviews pr JOIN {S}.staff s ON s.id=pr.staff_id "
            f"WHERE pr.project_id=%s ORDER BY pr.created_at DESC", (pid,))
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"history": [{"id":r[0],"action":r[1],"comment":r[2],"created_at":str(r[3]),"by":r[4]} for r in rows]})

    # ── Подбор цен поставщиков к позициям ВОР ────────────────────────────────

    if action == "price_match":
        names = body.get("names", [])  # список строк — названия материалов из ВОР
        if not names: conn.close(); return resp({"error":"names обязателен"}, 400)

        cur = conn.cursor()
        # Загружаем весь прайс-лист (600 позиций — не дорого)
        cur.execute(f"""
            SELECT spl.material_name, spl.unit, spl.price_per_unit, s.company_name, s.id as supplier_id
            FROM {S}.supplier_price_list spl
            JOIN {S}.suppliers s ON s.id = spl.supplier_id
            WHERE spl.price_per_unit > 0
            ORDER BY spl.price_per_unit
        """)
        price_rows = cur.fetchall()
        cur.close(); conn.close()

        # Нечёткий поиск: токенизируем оба названия и считаем совпадения
        def tokenize(s):
            return set(re.sub(r"[^а-яёa-z0-9]", " ", s.lower()).split())

        def match_score(query_tokens, candidate):
            cand_tokens = tokenize(candidate)
            if not query_tokens or not cand_tokens: return 0
            common = query_tokens & cand_tokens
            # Взвешиваем: длинные слова важнее
            score = sum(len(w) for w in common)
            # Штраф за лишние слова в кандидате
            score -= len(cand_tokens - query_tokens) * 0.3
            return score

        results = {}
        for name in names[:200]:  # не более 200 позиций за раз
            query_tokens = tokenize(name)
            best_score = 0
            best_match = None
            for row in price_rows:
                cand_name, cand_unit, cand_price, company, sup_id = row
                score = match_score(query_tokens, cand_name)
                if score > best_score:
                    best_score = score
                    best_match = {
                        "matched_name": cand_name,
                        "unit": cand_unit,
                        "price_per_unit": float(cand_price),
                        "company": company,
                        "supplier_id": sup_id,
                        "score": round(score, 1),
                    }
            results[name] = best_match if best_score >= 3 else None

        return resp({"ok": True, "matches": results, "total": len(names), "found": sum(1 for v in results.values() if v)})

    # ── Файлы проекта (S3) ────────────────────────────────────────────────────

    if action == "upload_file":
        if role != "architect": conn.close(); return resp({"error":"Только архитектор"}, 403)
        pid = body.get("project_id")
        file_name = body.get("file_name","file.bin")
        file_type = body.get("file_type","render")
        chunk_b64 = body.get("chunk","")
        chunk_index = int(body.get("chunk_index", 0))
        total_chunks = int(body.get("total_chunks", 1))
        upload_id = body.get("upload_id","")  # случайный ID сессии загрузки

        if not pid or not file_name: conn.close(); return resp({"error":"project_id и file_name обязательны"}, 400)
        safe_name = re.sub(r"[^\w.\-]", "_", file_name)
        ct = mimetypes.guess_type(safe_name)[0] or "application/octet-stream"
        final_key = f"projects/{pid}/{file_type}/{safe_name}"
        s3c = s3_client()

        try:
            if total_chunks == 1:
                # Маленький файл — загружаем целиком напрямую
                file_bytes = base64.b64decode(chunk_b64)
                s3c.put_object(Bucket="files", Key=final_key, Body=file_bytes, ContentType=ct)
                conn.close()
                return resp({"ok":True,"done":True,"cdn_url":cdn_url(final_key),"key":final_key})

            # Многочастная загрузка: каждый чанк сохраняем как отдельный объект во временную папку
            if not upload_id:
                import uuid
                upload_id = str(uuid.uuid4())

            chunk_key = f"_tmp/{upload_id}/chunk_{chunk_index:05d}"
            chunk_bytes = base64.b64decode(chunk_b64)
            s3c.put_object(Bucket="files", Key=chunk_key, Body=chunk_bytes, ContentType="application/octet-stream")

            if chunk_index < total_chunks - 1:
                # Не последний — просто подтверждаем получение
                conn.close()
                return resp({"ok":True,"done":False,"upload_id":upload_id})

            # Последний чанк — собираем все части в один файл
            all_bytes = b""
            for i in range(total_chunks):
                part_key = f"_tmp/{upload_id}/chunk_{i:05d}"
                obj = s3c.get_object(Bucket="files", Key=part_key)
                all_bytes += obj["Body"].read()

            # Загружаем итоговый файл
            s3c.put_object(Bucket="files", Key=final_key, Body=all_bytes, ContentType=ct)

            # Чистим временные чанки
            for i in range(total_chunks):
                try: s3c.delete_object(Bucket="files", Key=f"_tmp/{upload_id}/chunk_{i:05d}")
                except Exception: pass

            conn.close()
            return resp({"ok":True,"done":True,"cdn_url":cdn_url(final_key),"key":final_key})

        except Exception as e:
            conn.close(); return resp({"error":f"S3 ошибка: {str(e)}"}, 500)

    if action == "confirm_upload":
        if role != "architect": conn.close(); return resp({"error":"Только архитектор"}, 403)
        pid = body.get("project_id")
        file_name = body.get("file_name")
        file_type = body.get("file_type","render")
        cdn = body.get("cdn_url")
        if not pid or not file_name or not cdn: conn.close(); return resp({"error":"Не хватает полей"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT COALESCE(MAX(sort_order),0)+1 FROM {S}.project_files WHERE project_id=%s AND file_type=%s", (pid, file_type))
        sort = cur.fetchone()[0]
        cur.execute(f"INSERT INTO {S}.project_files (project_id,file_type,file_url,file_name,sort_order,uploaded_by) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                    (pid, file_type, cdn, file_name, sort, staff["id"]))
        fid = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True,"id":fid,"url":cdn})

    if action == "delete_file":
        if role != "architect": conn.close(); return resp({"error":"Только архитектор"}, 403)
        fid = body.get("file_id")
        if not fid: conn.close(); return resp({"error":"file_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"UPDATE {S}.project_files SET file_url=file_url WHERE id=%s RETURNING file_url", (fid,))
        # Просто деактивируем запись (не удаляем из S3)
        cur.execute(f"DELETE FROM {S}.project_files WHERE id=%s", (fid,))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True})

    # ── Ведомость объёмов работ (BOQ) ─────────────────────────────────────────

    if action == "spec_get":
        pid = body.get("project_id") or qs.get("project_id")
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT id,title,version,status,created_at,updated_at FROM {S}.project_specs WHERE project_id=%s ORDER BY version DESC LIMIT 1", (pid,))
        s = cur.fetchone()
        if not s: cur.close(); conn.close(); return resp({"spec": None})
        spec = {"id":s[0],"title":s[1],"version":s[2],"status":s[3],"created_at":str(s[4]),"updated_at":str(s[5])}
        cur.execute(f"SELECT id,section,name,unit,qty,price_per_unit,total_price,note,sort_order FROM {S}.spec_items WHERE spec_id=%s ORDER BY section,sort_order,id", (spec["id"],))
        spec["items"] = [{"id":r[0],"section":r[1],"name":r[2],"unit":r[3],"qty":float(r[4]),"price_per_unit":float(r[5]),"total_price":float(r[6]),"note":r[7],"sort_order":r[8]} for r in cur.fetchall()]
        cur.close(); conn.close()
        return resp({"spec": spec})

    if action == "spec_create":
        if role not in ("architect","constructor"): conn.close(); return resp({"error":"Нет доступа"}, 403)
        pid = body.get("project_id")
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT COALESCE(MAX(version),0)+1 FROM {S}.project_specs WHERE project_id=%s", (pid,))
        ver = cur.fetchone()[0]
        cur.execute(f"INSERT INTO {S}.project_specs (project_id,title,version,created_by,updated_by) VALUES (%s,%s,%s,%s,%s) RETURNING id",
                    (pid, body.get("title","Ведомость объёмов работ"), ver, staff["id"], staff["id"]))
        spec_id = cur.fetchone()[0]
        # Автозаполнение из шаблона по умолчанию
        items = body.get("items", [])
        for i, item in enumerate(items):
            cur.execute(f"INSERT INTO {S}.spec_items (spec_id,section,name,unit,qty,price_per_unit,note,sort_order,updated_by) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                        (spec_id,item.get("section","Общее"),item["name"],item["unit"],item.get("qty",0),item.get("price_per_unit",0),item.get("note",""),i,staff["id"]))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True,"spec_id":spec_id})

    if action == "spec_add_item":
        if role not in ("architect","constructor"): conn.close(); return resp({"error":"Нет доступа"}, 403)
        spec_id = body.get("spec_id")
        if not spec_id: conn.close(); return resp({"error":"spec_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT COALESCE(MAX(sort_order),0)+1 FROM {S}.spec_items WHERE spec_id=%s", (spec_id,))
        sort = cur.fetchone()[0]
        cur.execute(f"INSERT INTO {S}.spec_items (spec_id,section,name,unit,qty,price_per_unit,note,sort_order,updated_by) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                    (spec_id, body.get("section",""), body.get("name",""), body.get("unit",""), body.get("qty",0), body.get("price_per_unit",0), body.get("note",""), sort, staff["id"]))
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True,"id":new_id})

    if action == "spec_update_item":
        if role not in ("architect","constructor"): conn.close(); return resp({"error":"Нет доступа"}, 403)
        item_id = body.get("item_id")
        spec_id = body.get("spec_id")
        if not item_id: conn.close(); return resp({"error":"item_id обязателен"}, 400)
        editable = ["section","name","unit","qty","price_per_unit","note","sort_order"]
        fields, vals = [], []
        # Сохраняем историю
        cur = conn.cursor()
        for k in editable:
            if k in body:
                cur.execute(f"SELECT {k} FROM {S}.spec_items WHERE id=%s", (item_id,))
                old = cur.fetchone()
                if old:
                    cur.execute(f"INSERT INTO {S}.spec_history (spec_id,item_id,changed_by,field_name,old_value,new_value) VALUES (%s,%s,%s,%s,%s,%s)",
                                (spec_id, item_id, staff["id"], k, str(old[0]), str(body[k])))
                fields.append(f"{k}=%s"); vals.append(body[k])
        if fields:
            fields += ["updated_by=%s","updated_at=NOW()"]; vals += [staff["id"], item_id]
            cur.execute(f"UPDATE {S}.spec_items SET {','.join(fields)} WHERE id=%s", vals)
            # Обновляем updated_at ведомости
            if spec_id:
                cur.execute(f"UPDATE {S}.project_specs SET updated_by=%s,updated_at=NOW() WHERE id=%s", (staff["id"],spec_id))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True})

    if action == "spec_delete_item":
        if role not in ("architect","constructor"): conn.close(); return resp({"error":"Нет доступа"}, 403)
        item_id = body.get("item_id")
        if not item_id: conn.close(); return resp({"error":"item_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"DELETE FROM {S}.spec_items WHERE id=%s", (item_id,))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True})

    if action == "spec_approve":
        if role not in ("architect","constructor"): conn.close(); return resp({"error":"Нет доступа"}, 403)
        spec_id = body.get("spec_id")
        if not spec_id: conn.close(); return resp({"error":"spec_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"UPDATE {S}.project_specs SET status='approved',updated_by=%s,updated_at=NOW() WHERE id=%s", (staff["id"], spec_id))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True})

    if action == "spec_history":
        spec_id = body.get("spec_id") or qs.get("spec_id")
        if not spec_id: conn.close(); return resp({"error":"spec_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"""SELECT h.id,h.field_name,h.old_value,h.new_value,h.created_at,s.full_name,i.name
            FROM {S}.spec_history h
            LEFT JOIN {S}.staff s ON s.id=h.changed_by
            LEFT JOIN {S}.spec_items i ON i.id=h.item_id
            WHERE h.spec_id=%s ORDER BY h.created_at DESC LIMIT 100""", (spec_id,))
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"history":[{"id":r[0],"field":r[1],"old":r[2],"new":r[3],"at":str(r[4]),"by":r[5],"item":r[6]} for r in rows]})

    # ── Технологические карты ─────────────────────────────────────────────────

    if action == "tech_cards":
        cur = conn.cursor()
        cat = qs.get("category", body.get("category", ""))
        if cat:
            cur.execute(f"SELECT id,title,category,description,content,resources,created_at FROM {S}.tech_cards WHERE is_active=TRUE AND category=%s ORDER BY title", (cat,))
        else:
            cur.execute(f"SELECT id,title,category,description,content,resources,created_at FROM {S}.tech_cards WHERE is_active=TRUE ORDER BY category,title")
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"tech_cards":[{"id":r[0],"title":r[1],"category":r[2],"description":r[3],"content":r[4],"resources":r[5],"created_at":str(r[6])} for r in rows]})

    if action == "tech_card_attach":
        if role not in ("architect","constructor"): conn.close(); return resp({"error":"Нет доступа"}, 403)
        pid = body.get("project_id")
        tc_id = body.get("tech_card_id")
        if not pid or not tc_id: conn.close(); return resp({"error":"project_id и tech_card_id обязательны"}, 400)
        log(conn, staff["id"], "house_projects", pid, "attach_tech_card", str(tc_id))
        conn.commit(); conn.close()
        return resp({"ok":True})

    # ── Заполнить ресурсы техкарты через AI ───────────────────────────────────
    if action == "tech_card_fill_resources":
        if role not in ("architect","constructor"): conn.close(); return resp({"error":"Нет доступа"}, 403)
        tc_id = body.get("id")
        if not tc_id: conn.close(); return resp({"error":"id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT id,title,category,description,content,COALESCE(source_text,'') FROM {S}.tech_cards WHERE id=%s AND is_active=TRUE", (tc_id,))
        row = cur.fetchone()
        if not row: cur.close(); conn.close(); return resp({"error":"Карта не найдена"}, 404)

        card_id, title, category, description, content, source_text = row
        steps_text = "\n".join(f"Шаг {s['step']}: {s['name']} — {s['desc']}" for s in (content or []))

        api_key = os.environ.get("OPENAI_API_KEY","")
        resources = []

        if api_key:
            source_section = f"\nИсходный текст файла ТТК:\n{source_text[:5000]}\n" if source_text and source_text.strip() else ""
            prompt = f"""Ты — эксперт-сметчик в строительстве. Проанализируй технологическую карту и составь полный список необходимых материалов и ресурсов.

Технологическая карта: «{title}»
Категория: {category}
Описание: {description}

Технологические шаги:
{steps_text}
{source_section}
Составь JSON-список ресурсов. Каждый ресурс — это:
- type: "material" (материал) | "tool" (инструмент/механизм) | "labor" (трудозатраты)
- name: точное наименование
- unit: единица измерения (м², м³, шт, кг, т, пм, ч/чел, смена)
- qty_per_unit: количество на единицу работы (на 1 м² / 1 м³ итогового результата), число
- note: краткое пояснение (марка, ГОСТ, особенности) — необязательно

Верни ТОЛЬКО JSON-массив (без пояснений):
[
  {{"type":"material","name":"...","unit":"...","qty_per_unit":...,"note":"..."}},
  ...
]

Требования:
- Если есть исходный текст файла — извлеки из него РЕАЛЬНЫЕ нормы расхода
- Укажи ВСЕ материалы, включая расходники (крепёж, плёнки, ленты)
- Укажи основной инструмент и механизмы
- Укажи трудозатраты (ч/чел на ед. работы)
- Нормы расхода — реальные строительные нормативы"""

            try:
                print(f"[fill_resources] id={card_id}, title={title}, source_text_len={len(source_text)}")
                data = json.dumps({"model":"gpt-4o","messages":[{"role":"user","content":prompt}],
                                   "temperature":0.1,"max_tokens":3000}, ensure_ascii=False).encode()
                req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=data,
                    headers={"Content-Type":"application/json","Authorization":f"Bearer {api_key}"}, method="POST")
                with urllib.request.urlopen(req, timeout=50) as r:
                    result = json.loads(r.read())
                content_str = result["choices"][0]["message"]["content"].strip()
                match = re.search(r'\[.*\]', content_str, re.DOTALL)
                if match:
                    resources = json.loads(match.group())
                    print(f"[fill_resources] OK: {len(resources)} resources")
                else:
                    print(f"[fill_resources] no JSON array in response")
            except Exception as e:
                print(f"[fill_resources] GPT FAILED: {e}")

        # Сохраняем в БД
        cur.execute(f"UPDATE {S}.tech_cards SET resources=%s, updated_at=NOW() WHERE id=%s",
                    (json.dumps(resources, ensure_ascii=False), card_id))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True, "id": card_id, "resources": resources, "count": len(resources)})

    # ── Заполнить ресурсы для ВСЕХ карт без ресурсов ──────────────────────────
    if action == "tech_cards_fill_all":
        if role not in ("architect","constructor"): conn.close(); return resp({"error":"Нет доступа"}, 403)
        cur = conn.cursor()
        cur.execute(f"SELECT id FROM {S}.tech_cards WHERE is_active=TRUE AND (resources='[]'::jsonb OR resources IS NULL)")
        ids = [r[0] for r in cur.fetchall()]; cur.close(); conn.close()
        return resp({"ok": True, "pending_ids": ids, "count": len(ids)})

    # ── Обновить техкарту (название, описание, ресурсы) ───────────────────────
    if action == "tech_card_update":
        if role not in ("architect","constructor"): conn.close(); return resp({"error":"Нет доступа"}, 403)
        tc_id = body.get("id")
        if not tc_id: conn.close(); return resp({"error":"id обязателен"}, 400)
        fields, vals = [], []
        for k in ["title","category","description","content","resources"]:
            if k in body:
                fields.append(f"{k}=%s")
                vals.append(json.dumps(body[k], ensure_ascii=False) if isinstance(body[k], list) else body[k])
        if not fields: conn.close(); return resp({"error":"Нет полей"}, 400)
        fields.append("updated_at=NOW()"); vals.append(tc_id)
        cur = conn.cursor()
        cur.execute(f"UPDATE {S}.tech_cards SET {','.join(fields)} WHERE id=%s", vals)
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True})

    # ── Загрузка и парсинг файла технологической карты (PDF / Excel) ──────────
    if action == "tech_card_upload":
        if role not in ("architect","constructor"): conn.close(); return resp({"error":"Нет доступа"}, 403)
        file_b64 = body.get("file_base64","")
        file_name = body.get("file_name","file.pdf")
        if not file_b64: conn.close(); return resp({"error":"file_base64 обязателен"}, 400)

        file_bytes = base64.b64decode(file_b64)
        ext = file_name.rsplit(".",1)[-1].lower() if "." in file_name else "pdf"

        # Сохраняем файл в S3
        s3 = boto3.client("s3", endpoint_url="https://bucket.poehali.dev",
                          aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
                          aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"])
        import secrets as sec
        s3key = f"tech_cards/{sec.token_hex(8)}.{ext}"
        ctype = "application/pdf" if ext == "pdf" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        s3.put_object(Bucket="files", Key=s3key, Body=file_bytes, ContentType=ctype)
        file_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{s3key}"

        # Извлекаем текст для AI
        import io as _io
        text_content = ""
        parse_error = ""
        if ext == "pdf":
            try:
                import pdfplumber
                with pdfplumber.open(_io.BytesIO(file_bytes)) as pdf:
                    pages_text = []
                    for page in pdf.pages[:15]:
                        t = page.extract_text()
                        if t: pages_text.append(t)
                    text_content = "\n".join(pages_text)[:8000]
                print(f"[tech_card_upload] pdfplumber OK, chars={len(text_content)}")
            except Exception as e:
                parse_error = str(e)
                print(f"[tech_card_upload] pdfplumber FAILED: {e}")
                try:
                    import pypdf
                    reader = pypdf.PdfReader(_io.BytesIO(file_bytes))
                    pages_text = []
                    for page in reader.pages[:15]:
                        t = page.extract_text()
                        if t: pages_text.append(t)
                    text_content = "\n".join(pages_text)[:8000]
                    print(f"[tech_card_upload] pypdf OK, chars={len(text_content)}")
                except Exception as e2:
                    print(f"[tech_card_upload] pypdf FAILED: {e2}")
        elif ext in ("xlsx","xls","csv"):
            try:
                import openpyxl
                wb = openpyxl.load_workbook(_io.BytesIO(file_bytes), read_only=True, data_only=True)
                rows_text = []
                for sheet in wb.worksheets[:3]:
                    for row in sheet.iter_rows(max_row=300, values_only=True):
                        vals = [str(v) for v in row if v is not None and str(v).strip()]
                        if vals: rows_text.append(" | ".join(vals))
                text_content = "\n".join(rows_text[:400])[:8000]
                print(f"[tech_card_upload] openpyxl OK, chars={len(text_content)}")
            except Exception as e:
                print(f"[tech_card_upload] openpyxl FAILED: {e}")
        elif ext in ("doc","docx"):
            try:
                import zipfile, xml.etree.ElementTree as ET
                with zipfile.ZipFile(_io.BytesIO(file_bytes)) as z:
                    xml_content = z.read("word/document.xml")
                root = ET.fromstring(xml_content)
                ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
                texts = [node.text for node in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t") if node.text]
                text_content = " ".join(texts)[:8000]
                print(f"[tech_card_upload] docx OK, chars={len(text_content)}")
            except Exception as e:
                print(f"[tech_card_upload] docx FAILED: {e}")

        # Если текст не извлечён — используем имя файла как подсказку
        if not text_content.strip():
            text_content = f"Файл технологической карты: {file_name}"
            print(f"[tech_card_upload] NO TEXT extracted, using filename only")
        else:
            print(f"[tech_card_upload] text preview: {text_content[:200]}")

        # GPT: парсим структуру техкарты + ресурсы в одном запросе
        api_key = os.environ.get("OPENAI_API_KEY","")
        base_title = file_name.rsplit(".",1)[0]
        parsed = {"title": base_title, "category": "Прочее", "description": "", "content": [], "resources": []}

        if api_key:
            prompt = f"""Ты — эксперт по строительным технологическим картам и сметному нормированию. Проанализируй содержимое файла и извлеки ПОЛНУЮ структурированную информацию.

Содержимое файла:
{text_content}

Верни ТОЛЬКО JSON (без пояснений):
{{
  "title": "Название технологической карты",
  "category": "Одна из: Фундамент | Стены | Кровля | Полы | Окна и двери | Отделка | Инженерия | Земляные работы | Прочее",
  "description": "Краткое описание работ (1-2 предложения)",
  "content": [
    {{"step": 1, "name": "Название операции", "desc": "Подробное описание", "duration": "X дней/часов"}},
    ...
  ],
  "resources": [
    {{"type": "material", "name": "Наименование материала", "unit": "м²", "qty_per_unit": 1.05, "note": "Марка, ГОСТ"}},
    {{"type": "tool", "name": "Инструмент/механизм", "unit": "шт", "qty_per_unit": 1, "note": ""}},
    {{"type": "labor", "name": "Рабочий-строитель", "unit": "ч/чел", "qty_per_unit": 2.5, "note": "на 1 м²"}}
  ]
}}

Правила:
- content: если в файле менее 3 шагов — составь логичные шаги на основе названия карты
- resources: извлеки из текста файла ВСЕ материалы с нормами расхода, инструмент и трудозатраты; если явно не указано — рассчитай по строительным нормативам (ГЭСНам)
- type: "material" — материалы и расходники, "tool" — инструмент и механизмы, "labor" — трудозатраты
- qty_per_unit — количество на единицу результата (1 м², 1 м³ и т.д.), дробное число
- unit: м², м³, шт, кг, т, пм, ч/чел, маш-ч"""

            try:
                print(f"[tech_card_upload] calling GPT-4o, text_len={len(text_content)}")
                data = json.dumps({"model":"gpt-4o","messages":[{"role":"user","content":prompt}],
                                   "temperature":0.1,"max_tokens":4000}, ensure_ascii=False).encode()
                req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=data,
                    headers={"Content-Type":"application/json","Authorization":f"Bearer {api_key}"}, method="POST")
                with urllib.request.urlopen(req, timeout=50) as r:
                    result = json.loads(r.read())
                content_str = result["choices"][0]["message"]["content"].strip()
                print(f"[tech_card_upload] GPT response len={len(content_str)}, preview={content_str[:100]}")
                match = re.search(r'\{.*\}', content_str, re.DOTALL)
                if match:
                    parsed = json.loads(match.group())
                    if not isinstance(parsed.get("content"), list): parsed["content"] = []
                    if not isinstance(parsed.get("resources"), list): parsed["resources"] = []
                    print(f"[tech_card_upload] parsed OK: steps={len(parsed['content'])}, resources={len(parsed['resources'])}")
                else:
                    print(f"[tech_card_upload] no JSON match in GPT response")
            except Exception as e:
                print(f"[tech_card_upload] GPT FAILED: {e}")
        else:
            print(f"[tech_card_upload] no OPENAI_API_KEY")

        # Сохраняем в БД (включая ресурсы и исходный текст для повторного анализа)
        cur = conn.cursor()
        cur.execute(f"""
            INSERT INTO {S}.tech_cards (title, category, description, content, resources, source_text, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (parsed.get("title", base_title), parsed.get("category","Прочее"),
              parsed.get("description",""),
              json.dumps(parsed.get("content",[]), ensure_ascii=False),
              json.dumps(parsed.get("resources",[]), ensure_ascii=False),
              text_content,
              staff["id"]))
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()

        return resp({"ok": True, "id": new_id, "title": parsed.get("title",""),
                     "category": parsed.get("category",""), "description": parsed.get("description",""),
                     "steps_count": len(parsed.get("content",[])),
                     "resources_count": len(parsed.get("resources",[])),
                     "file_url": file_url})

    # ── Удаление технологической карты ────────────────────────────────────────
    if action == "tech_card_delete":
        if role not in ("architect","constructor"): conn.close(); return resp({"error":"Нет доступа"}, 403)
        tc_id = body.get("id")
        if not tc_id: conn.close(); return resp({"error":"id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"UPDATE {S}.tech_cards SET is_active=FALSE WHERE id=%s AND created_by=%s", (tc_id, staff["id"]))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True})

    # ── Расчёт по элементам (ВОР) — сохранить ─────────────────────────────────
    if action == "calc_save":
        pid = body.get("project_id")
        elements = body.get("elements", [])
        if not pid: conn.close(); return resp({"error": "project_id обязателен"}, 400)
        elements_str = json.dumps(elements, ensure_ascii=False)
        cur = conn.cursor()
        cur.execute(
            f"""INSERT INTO {S}.project_calc_elements (project_id, elements_json, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (project_id) DO UPDATE
                SET elements_json = EXCLUDED.elements_json, updated_at = NOW()""",
            (pid, elements_str)
        )
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True})

    # ── Расчёт по элементам (ВОР) — загрузить ─────────────────────────────────
    if action == "calc_load":
        pid = body.get("project_id") or qs.get("project_id")
        if not pid: conn.close(); return resp({"error": "project_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"SELECT elements_json, updated_at FROM {S}.project_calc_elements WHERE project_id=%s",
            (pid,)
        )
        row = cur.fetchone(); cur.close(); conn.close()
        if not row:
            return resp({"elements": [], "updated_at": None})
        return resp({"elements": json.loads(row[0]), "updated_at": str(row[1])})

    # ── Информация об объекте — сохранить ─────────────────────────────────────
    if action == "save_object_info":
        pid = body.get("project_id")
        info = body.get("info", {})
        if not pid: conn.close(); return resp({"error": "project_id обязателен"}, 400)
        info_str = json.dumps(info, ensure_ascii=False)
        cur = conn.cursor()
        cur.execute(
            f"""INSERT INTO {S}.project_object_info (project_id, info_json, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (project_id) DO UPDATE
                SET info_json = EXCLUDED.info_json, updated_at = NOW()""",
            (pid, info_str)
        )
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True})

    # ── Информация об объекте — загрузить ─────────────────────────────────────
    if action == "load_object_info":
        pid = body.get("project_id") or qs.get("project_id")
        if not pid: conn.close(); return resp({"error": "project_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"SELECT info_json FROM {S}.project_object_info WHERE project_id=%s",
            (pid,)
        )
        row = cur.fetchone(); cur.close(); conn.close()
        if not row:
            return resp({"info": None})
        return resp({"info": json.loads(row[0])})

    conn.close()
    return resp({"error":"Not found"}, 404)