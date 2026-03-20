"""
API управления проектами: проекты, файлы (S3), ведомости объёмов работ (BOQ)
Роутинг через ?action=...
"""
import json, os, base64, mimetypes
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
            "created_at":str(r[14]),"updated_at":str(r[15])}

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
        except: pass

    conn = db()

    # ── Публичные endpoint'ы (без токена) ─────────────────────────────────────

    # GET project list (public)
    if method == "GET" and action == "public_list":
        cur = conn.cursor()
        cur.execute(f"""
            SELECT p.id,p.name,p.type,p.area,p.floors,p.rooms,p.price,p.tag,p.tag_color,
                   p.description,p.features,p.is_active,p.created_by,p.updated_by,p.created_at,p.updated_at
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
        cur.execute(f"SELECT id,name,type,area,floors,rooms,price,tag,tag_color,description,features,is_active,created_by,updated_by,created_at,updated_at FROM {S}.house_projects WHERE id=%s", (pid,))
        r = cur.fetchone()
        if not r: cur.close(); conn.close(); return resp({"error":"Не найден"}, 404)
        p = project_row(r)
        cur.execute(f"SELECT id,file_type,file_url,file_name,sort_order FROM {S}.project_files WHERE project_id=%s ORDER BY file_type,sort_order", (p["id"],))
        p["files"] = [{"id":f[0],"file_type":f[1],"file_url":f[2],"file_name":f[3],"sort_order":f[4]} for f in cur.fetchall()]
        cur.close(); conn.close()
        return resp({"project": p})

    # ── Авторизованные endpoint'ы ─────────────────────────────────────────────
    if not token: conn.close(); return resp({"error":"Не авторизован"}, 401)
    staff = get_staff(conn, token)
    if not staff: conn.close(); return resp({"error":"Сессия истекла"}, 401)
    role = staff["role_code"]

    # ── Проекты (CRUD) ────────────────────────────────────────────────────────

    if action == "list":
        cur = conn.cursor()
        cur.execute(f"SELECT id,name,type,area,floors,rooms,price,tag,tag_color,description,features,is_active,created_by,updated_by,created_at,updated_at FROM {S}.house_projects ORDER BY created_at DESC")
        projects = [project_row(r) for r in cur.fetchall()]
        for p in projects:
            cur.execute(f"SELECT id,file_type,file_url,file_name,sort_order FROM {S}.project_files WHERE project_id=%s ORDER BY file_type,sort_order", (p["id"],))
            p["files"] = [{"id":f[0],"file_type":f[1],"file_url":f[2],"file_name":f[3],"sort_order":f[4]} for f in cur.fetchall()]
        cur.close(); conn.close()
        return resp({"projects": projects})

    if action == "get":
        pid = body.get("project_id") or qs.get("project_id")
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT id,name,type,area,floors,rooms,price,tag,tag_color,description,features,is_active,created_by,updated_by,created_at,updated_at FROM {S}.house_projects WHERE id=%s", (pid,))
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
            (name,type,area,floors,rooms,price,tag,tag_color,description,features,created_by,updated_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (body["name"],body["type"],body["area"],body["floors"],body["rooms"],body["price"],
             body.get("tag",""),body.get("tag_color","#FF6B1A"),body.get("description",""),body.get("features",""),
             staff["id"],staff["id"]))
        new_id = cur.fetchone()[0]
        log(conn, staff["id"], "house_projects", new_id, "create", body["name"])
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True,"id":new_id})

    if action == "update":
        if role != "architect": conn.close(); return resp({"error":"Только архитектор"}, 403)
        pid = body.get("project_id")
        if not pid: conn.close(); return resp({"error":"project_id обязателен"}, 400)
        editable = ["name","type","area","floors","rooms","price","tag","tag_color","description","features","is_active"]
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

    # ── Файлы проекта (S3) ────────────────────────────────────────────────────

    if action == "upload_file":
        if role != "architect": conn.close(); return resp({"error":"Только архитектор"}, 403)
        pid = body.get("project_id")
        file_data = body.get("file_data","")  # base64
        file_name = body.get("file_name","file.jpg")
        file_type = body.get("file_type","render")  # render|plan|facade|section|other
        if not pid or not file_data: conn.close(); return resp({"error":"project_id и file_data обязательны"}, 400)

        ext = file_name.rsplit(".",1)[-1].lower() if "." in file_name else "jpg"
        ct = mimetypes.guess_type(file_name)[0] or "application/octet-stream"
        key = f"projects/{pid}/{file_type}/{file_name}"
        try:
            s3 = s3_client()
            s3.put_object(Bucket="files", Key=key, Body=base64.b64decode(file_data), ContentType=ct)
            url = cdn_url(key)
        except Exception as e:
            conn.close(); return resp({"error":f"S3 ошибка: {str(e)}"}, 500)

        cur = conn.cursor()
        cur.execute(f"SELECT COALESCE(MAX(sort_order),0)+1 FROM {S}.project_files WHERE project_id=%s AND file_type=%s", (pid, file_type))
        sort = cur.fetchone()[0]
        cur.execute(f"INSERT INTO {S}.project_files (project_id,file_type,file_url,file_name,sort_order,uploaded_by) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                    (pid, file_type, url, file_name, sort, staff["id"]))
        fid = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True,"id":fid,"url":url})

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

    conn.close()
    return resp({"error":"Not found"}, 404)
