"""
Авторизация сотрудников: login, register, me, logout, change_password
"""
import json, os, hashlib, secrets
import psycopg2
from datetime import datetime, timedelta, timezone

SCHEMA = "t_p78845984_auto_house_cost_calc"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def json_resp(data, status=200):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False)}

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

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    qs = event.get("queryStringParameters") or {}
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    # action может прийти из query string или из body
    action = qs.get("action", body.get("action", ""))
    token = event.get("headers", {}).get("X-Auth-Token", "")

    conn = get_conn()

    # POST — register
    if method == "POST" and action == "register":
        login = body.get("login", "").strip()
        full_name = body.get("full_name", "").strip()
        role_code = body.get("role_code", "").strip()
        password = body.get("password", "")

        if not login or not full_name or not role_code or not password:
            conn.close()
            return json_resp({"error": "Заполните все поля"}, 400)
        if len(password) < 6:
            conn.close()
            return json_resp({"error": "Пароль должен быть не менее 6 символов"}, 400)

        cur = conn.cursor()
        cur.execute(f"SELECT id FROM {SCHEMA}.staff WHERE login = %s", (login,))
        if cur.fetchone():
            cur.close(); conn.close()
            return json_resp({"error": "Логин уже занят"}, 400)

        cur.execute(
            f"INSERT INTO {SCHEMA}.staff (login, password_hash, full_name, role_code) VALUES (%s, %s, %s, %s) RETURNING id",
            (login, hash_password(password), full_name, role_code)
        )
        staff_id = cur.fetchone()[0]
        conn.commit(); cur.close()

        new_token = secrets.token_hex(32)
        expires = datetime.now(timezone.utc) + timedelta(days=30)
        cur2 = conn.cursor()
        cur2.execute(
            f"INSERT INTO {SCHEMA}.sessions (staff_id, token, expires_at) VALUES (%s, %s, %s)",
            (staff_id, new_token, expires)
        )
        conn.commit(); cur2.close(); conn.close()

        return json_resp({"token": new_token, "staff": {"id": staff_id, "login": login, "full_name": full_name, "role_code": role_code}})

    # POST — login
    if method == "POST" and (action == "login" or path.endswith("/login") or ("login" in body and "password" in body and not action)):
        login = body.get("login", "").strip()
        password = body.get("password", "")
        if not login or not password:
            conn.close()
            return json_resp({"error": "Укажите логин и пароль"}, 400)

        cur = conn.cursor()
        cur.execute(
            f"SELECT id, password_hash, full_name, role_code FROM {SCHEMA}.staff WHERE login = %s",
            (login,)
        )
        row = cur.fetchone()
        cur.close()

        if not row:
            conn.close()
            return json_resp({"error": "Неверный логин или пароль"}, 401)

        staff_id, pw_hash, full_name, role_code = row

        # Первый вход — устанавливаем пароль
        if pw_hash == "RESET":
            new_hash = hash_password(password)
            cur2 = conn.cursor()
            cur2.execute(f"UPDATE {SCHEMA}.staff SET password_hash = %s WHERE id = %s", (new_hash, staff_id))
            conn.commit()
            cur2.close()
        else:
            if hash_password(password) != pw_hash:
                conn.close()
                return json_resp({"error": "Неверный логин или пароль"}, 401)

        new_token = secrets.token_hex(32)
        expires = datetime.now(timezone.utc) + timedelta(days=30)
        cur3 = conn.cursor()
        cur3.execute(
            f"INSERT INTO {SCHEMA}.sessions (staff_id, token, expires_at) VALUES (%s, %s, %s)",
            (staff_id, new_token, expires)
        )
        conn.commit()
        cur3.close()
        conn.close()

        return json_resp({"token": new_token, "staff": {"id": staff_id, "login": login, "full_name": full_name, "role_code": role_code}})

    # GET /me — проверить токен
    if (method == "GET" and action in ("me", "")) or path.endswith("/me"):
        if not token:
            conn.close()
            return json_resp({"error": "Не авторизован"}, 401)
        staff = get_staff_by_token(conn, token)
        conn.close()
        if not staff:
            return json_resp({"error": "Сессия истекла"}, 401)
        return json_resp({"staff": staff})

    # POST /logout
    if method == "POST" and (action == "logout" or path.endswith("/logout")):
        if token:
            cur = conn.cursor()
            cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE token = %s", (token,))
            conn.commit()
            cur.close()
        conn.close()
        return json_resp({"ok": True})

    # GET staff_list — список всех сотрудников (только для director/assistant)
    if action == "staff_list":
        if not token:
            conn.close()
            return json_resp({"error": "Не авторизован"}, 401)
        me = get_staff_by_token(conn, token)
        if not me:
            conn.close()
            return json_resp({"error": "Сессия истекла"}, 401)
        if me["role_code"] not in ("director", "assistant", "admin"):
            conn.close()
            return json_resp({"error": "Доступ запрещён"}, 403)
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, login, full_name, role_code, created_at FROM {SCHEMA}.staff ORDER BY role_code, full_name"
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        staff_list = [{"id": r[0], "login": r[1], "full_name": r[2], "role_code": r[3], "created_at": str(r[4])} for r in rows]
        return json_resp({"staff": staff_list})

    # POST impersonate — войти как другой сотрудник (только director/assistant)
    if method == "POST" and action == "impersonate":
        if not token:
            conn.close()
            return json_resp({"error": "Не авторизован"}, 401)
        me = get_staff_by_token(conn, token)
        if not me:
            conn.close()
            return json_resp({"error": "Сессия истекла"}, 401)
        if me["role_code"] not in ("director", "assistant", "admin"):
            conn.close()
            return json_resp({"error": "Только руководитель может переключаться"}, 403)
        target_id = body.get("staff_id")
        if not target_id:
            conn.close()
            return json_resp({"error": "staff_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, login, full_name, role_code FROM {SCHEMA}.staff WHERE id = %s",
            (target_id,)
        )
        target = cur.fetchone()
        cur.close()
        if not target:
            conn.close()
            return json_resp({"error": "Сотрудник не найден"}, 404)
        # Создаём временный токен с пометкой impersonated (30 мин)
        imp_token = secrets.token_hex(32)
        expires = datetime.now(timezone.utc) + timedelta(minutes=30)
        cur2 = conn.cursor()
        cur2.execute(
            f"INSERT INTO {SCHEMA}.sessions (staff_id, token, expires_at) VALUES (%s, %s, %s)",
            (target[0], imp_token, expires)
        )
        conn.commit(); cur2.close(); conn.close()
        return json_resp({
            "token": imp_token,
            "staff": {"id": target[0], "login": target[1], "full_name": target[2], "role_code": target[3]},
            "impersonated_by": {"id": me["id"], "full_name": me["full_name"], "token": token}
        })

    # POST reset_password — сброс пароля любого сотрудника (только admin/director)
    if method == "POST" and action == "reset_password":
        if not token:
            conn.close()
            return json_resp({"error": "Не авторизован"}, 401)
        me = get_staff_by_token(conn, token)
        if not me:
            conn.close()
            return json_resp({"error": "Сессия истекла"}, 401)
        if me["role_code"] not in ("admin", "director", "assistant"):
            conn.close()
            return json_resp({"error": "Доступ запрещён"}, 403)
        staff_id = body.get("staff_id")
        new_pw = body.get("new_password", "")
        if not staff_id:
            conn.close()
            return json_resp({"error": "staff_id обязателен"}, 400)
        if len(new_pw) < 6:
            conn.close()
            return json_resp({"error": "Пароль должен быть не менее 6 символов"}, 400)
        cur = conn.cursor()
        cur.execute(f"UPDATE {SCHEMA}.staff SET password_hash = %s WHERE id = %s", (hash_password(new_pw), staff_id))
        conn.commit()
        cur.close()
        conn.close()
        return json_resp({"ok": True})

    # POST /change_password
    if method == "POST" and (action == "change_password" or path.endswith("/change_password")):
        if not token:
            conn.close()
            return json_resp({"error": "Не авторизован"}, 401)
        staff = get_staff_by_token(conn, token)
        if not staff:
            conn.close()
            return json_resp({"error": "Сессия истекла"}, 401)
        new_pw = body.get("new_password", "")
        if len(new_pw) < 6:
            conn.close()
            return json_resp({"error": "Пароль должен быть не менее 6 символов"}, 400)
        cur = conn.cursor()
        cur.execute(f"UPDATE {SCHEMA}.staff SET password_hash = %s WHERE id = %s", (hash_password(new_pw), staff["id"]))
        conn.commit()
        cur.close()
        conn.close()
        return json_resp({"ok": True})

    conn.close()
    return json_resp({"error": "Not found"}, 404)