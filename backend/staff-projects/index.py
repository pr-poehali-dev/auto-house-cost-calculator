"""
API управления проектами домов: архитекторы создают/редактируют, остальные смотрят
"""
import json, os
import psycopg2

SCHEMA = "t_p78845984_auto_house_cost_calc"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def json_resp(data, status=200):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}

def get_staff_by_token(conn, token: str):
    cur = conn.cursor()
    cur.execute(
        f"SELECT s.id, s.login, s.full_name, s.role_code FROM {SCHEMA}.sessions ss "
        f"JOIN {SCHEMA}.staff s ON s.id = ss.staff_id "
        f"WHERE ss.token = %s AND ss.expires_at > NOW()",
        (token,)
    )
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {"id": row[0], "login": row[1], "full_name": row[2], "role_code": row[3]}

def log_change(conn, staff_id, entity_id, action, details):
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.change_log (staff_id, entity, entity_id, action, details) VALUES (%s, 'house_projects', %s, %s, %s)",
        (staff_id, entity_id, action, details)
    )
    cur.close()

def row_to_dict(r):
    return {
        "id": r[0], "name": r[1], "type": r[2], "area": r[3],
        "floors": r[4], "rooms": r[5], "price": r[6], "tag": r[7],
        "tag_color": r[8], "description": r[9], "features": r[10],
        "is_active": r[11], "created_by": r[12], "updated_by": r[13],
        "created_at": str(r[14]), "updated_at": str(r[15])
    }

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    token = event.get("headers", {}).get("X-Auth-Token", "")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    conn = get_conn()

    if not token:
        conn.close()
        return json_resp({"error": "Не авторизован"}, 401)
    staff = get_staff_by_token(conn, token)
    if not staff:
        conn.close()
        return json_resp({"error": "Сессия истекла"}, 401)

    role = staff["role_code"]

    # GET / — все проекты
    if method == "GET" and not path.rstrip("/").split("/")[-1].isdigit():
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, name, type, area, floors, rooms, price, tag, tag_color, description, features, "
            f"is_active, created_by, updated_by, created_at, updated_at "
            f"FROM {SCHEMA}.house_projects ORDER BY created_at DESC"
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return json_resp({"projects": [row_to_dict(r) for r in rows]})

    # GET /{id}
    if method == "GET":
        parts = path.rstrip("/").split("/")
        proj_id = int(parts[-1])
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, name, type, area, floors, rooms, price, tag, tag_color, description, features, "
            f"is_active, created_by, updated_by, created_at, updated_at "
            f"FROM {SCHEMA}.house_projects WHERE id = %s",
            (proj_id,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            return json_resp({"error": "Проект не найден"}, 404)
        return json_resp({"project": row_to_dict(row)})

    # POST / — создать (только архитектор)
    if method == "POST":
        if role != "architect":
            conn.close()
            return json_resp({"error": "Только архитектор может создавать проекты"}, 403)
        required = ["name", "type", "area", "floors", "rooms", "price"]
        for f in required:
            if body.get(f) is None:
                conn.close()
                return json_resp({"error": f"Поле {f} обязательно"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.house_projects "
            f"(name, type, area, floors, rooms, price, tag, tag_color, description, features, created_by, updated_by) "
            f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (body["name"], body["type"], body["area"], body["floors"], body["rooms"], body["price"],
             body.get("tag", ""), body.get("tag_color", "#FF6B1A"),
             body.get("description", ""), body.get("features", ""),
             staff["id"], staff["id"])
        )
        new_id = cur.fetchone()[0]
        log_change(conn, staff["id"], new_id, "create", body["name"])
        conn.commit()
        cur.close()
        conn.close()
        return json_resp({"ok": True, "id": new_id})

    # PUT /{id} — редактировать (только архитектор)
    if method == "PUT":
        if role != "architect":
            conn.close()
            return json_resp({"error": "Только архитектор может редактировать проекты"}, 403)
        parts = path.rstrip("/").split("/")
        proj_id = int(parts[-1]) if parts[-1].isdigit() else None
        if not proj_id:
            conn.close()
            return json_resp({"error": "Укажите id проекта"}, 400)
        editable = ["name", "type", "area", "floors", "rooms", "price", "tag", "tag_color", "description", "features", "is_active"]
        fields = []
        values = []
        for key in editable:
            if key in body:
                fields.append(f"{key} = %s")
                values.append(body[key])
        if not fields:
            conn.close()
            return json_resp({"error": "Нет полей для обновления"}, 400)
        fields.append("updated_by = %s"); values.append(staff["id"])
        fields.append("updated_at = NOW()")
        values.append(proj_id)
        cur = conn.cursor()
        cur.execute(f"UPDATE {SCHEMA}.house_projects SET {', '.join(fields)} WHERE id = %s", values)
        log_change(conn, staff["id"], proj_id, "update", str(body))
        conn.commit()
        cur.close()
        conn.close()
        return json_resp({"ok": True})

    conn.close()
    return json_resp({"error": "Not found"}, 404)
