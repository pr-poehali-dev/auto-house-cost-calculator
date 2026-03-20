"""
API управления материалами: GET/POST/PUT — для конструкторов (структура) и снабженца (цены)
"""
import json, os
import psycopg2
from datetime import datetime, timezone

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

def log_change(conn, staff_id, entity, entity_id, action, details):
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.change_log (staff_id, entity, entity_id, action, details) VALUES (%s, %s, %s, %s, %s)",
        (staff_id, entity, entity_id, action, details)
    )
    cur.close()

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

    # Авторизация
    if not token:
        conn.close()
        return json_resp({"error": "Не авторизован"}, 401)
    staff = get_staff_by_token(conn, token)
    if not staff:
        conn.close()
        return json_resp({"error": "Сессия истекла"}, 401)

    role = staff["role_code"]
    allowed = role in ("constructor", "supply", "engineer", "lawyer")
    if not allowed:
        conn.close()
        return json_resp({"error": "Нет доступа"}, 403)

    # GET / — список всех материалов
    if method == "GET":
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, category, name, unit, price_per_unit, qty_formula, sort_order, is_active, updated_at "
            f"FROM {SCHEMA}.materials ORDER BY category, sort_order, id"
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        items = []
        for r in rows:
            items.append({
                "id": r[0], "category": r[1], "name": r[2], "unit": r[3],
                "price_per_unit": float(r[4]), "qty_formula": r[5],
                "sort_order": r[6], "is_active": r[7], "updated_at": str(r[8])
            })
        return json_resp({"items": items})

    # POST / — создать материал (только конструктор)
    if method == "POST":
        if role != "constructor":
            conn.close()
            return json_resp({"error": "Только конструктор может добавлять материалы"}, 403)
        required = ["category", "name", "unit", "price_per_unit", "qty_formula"]
        for f in required:
            if not body.get(f):
                conn.close()
                return json_resp({"error": f"Поле {f} обязательно"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.materials (category, name, unit, price_per_unit, qty_formula, sort_order, updated_by) "
            f"VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (body["category"], body["name"], body["unit"], body["price_per_unit"],
             body["qty_formula"], body.get("sort_order", 0), staff["id"])
        )
        new_id = cur.fetchone()[0]
        log_change(conn, staff["id"], "materials", new_id, "create", body["name"])
        conn.commit()
        cur.close()
        conn.close()
        return json_resp({"ok": True, "id": new_id})

    # PUT /{id} — обновить материал
    if method == "PUT":
        parts = path.rstrip("/").split("/")
        mat_id = int(parts[-1]) if parts[-1].isdigit() else None
        if not mat_id:
            conn.close()
            return json_resp({"error": "Укажите id материала"}, 400)

        # Конструктор — редактирует всё, снабженец — только цену
        if role == "supply":
            if "price_per_unit" not in body:
                conn.close()
                return json_resp({"error": "Снабженец может изменять только цену"}, 400)
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.materials SET price_per_unit = %s, updated_by = %s, updated_at = NOW() WHERE id = %s",
                (body["price_per_unit"], staff["id"], mat_id)
            )
            log_change(conn, staff["id"], "materials", mat_id, "price_update", str(body["price_per_unit"]))
            conn.commit()
            cur.close()
        elif role == "constructor":
            fields = []
            values = []
            for key in ["category", "name", "unit", "price_per_unit", "qty_formula", "sort_order", "is_active"]:
                if key in body:
                    fields.append(f"{key} = %s")
                    values.append(body[key])
            if not fields:
                conn.close()
                return json_resp({"error": "Нет полей для обновления"}, 400)
            fields.append("updated_by = %s"); values.append(staff["id"])
            fields.append("updated_at = NOW()")
            values.append(mat_id)
            cur = conn.cursor()
            cur.execute(f"UPDATE {SCHEMA}.materials SET {', '.join(fields)} WHERE id = %s", values)
            log_change(conn, staff["id"], "materials", mat_id, "update", str(body))
            conn.commit()
            cur.close()
        else:
            conn.close()
            return json_resp({"error": "Нет прав на редактирование"}, 403)

        conn.close()
        return json_resp({"ok": True})

    conn.close()
    return json_resp({"error": "Not found"}, 404)
