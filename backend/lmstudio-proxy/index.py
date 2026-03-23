"""
Прокси к локальному LM Studio. Принимает запросы от фронтенда и перенаправляет к LM Studio API.
Поддерживает стриминг и обычные запросы, хранит настройки подключения в БД.
"""
import json, os, urllib.request, urllib.error
import psycopg2

S = os.environ.get("MAIN_DB_SCHEMA", "public")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def resp(data, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}

def get_lm_url(conn):
    cur = conn.cursor()
    cur.execute(f"SELECT value FROM {S}.app_settings WHERE key='lmstudio_url' LIMIT 1")
    row = cur.fetchone()
    cur.close()
    return row[0] if row else "http://192.168.1.123:1234"

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    conn = db()

    # ── Получить/сохранить настройки подключения ─────────────────────────────
    if action == "get_settings":
        url = get_lm_url(conn)
        cur = conn.cursor()
        cur.execute(f"SELECT value FROM {S}.app_settings WHERE key='lmstudio_model' LIMIT 1")
        row = cur.fetchone()
        model = row[0] if row else ""
        cur.close()
        conn.close()
        return resp({"url": url, "model": model})

    if action == "save_settings":
        url = body.get("url", "").rstrip("/")
        model = body.get("model", "")
        cur = conn.cursor()
        cur.execute(f"""
            INSERT INTO {S}.app_settings (key, value) VALUES ('lmstudio_url', %s)
            ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value
        """, (url,))
        cur.execute(f"""
            INSERT INTO {S}.app_settings (key, value) VALUES ('lmstudio_model', %s)
            ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value
        """, (model,))
        conn.commit()
        cur.close()
        conn.close()
        return resp({"ok": True})

    # ── Получить список моделей из LM Studio ─────────────────────────────────
    if action == "models":
        lm_url = get_lm_url(conn)
        conn.close()
        try:
            req = urllib.request.Request(f"{lm_url}/v1/models",
                headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=5) as r:
                data = json.loads(r.read())
            return resp({"models": [m["id"] for m in data.get("data", [])]})
        except Exception as e:
            return resp({"models": [], "error": str(e)})

    # ── Chat completion ───────────────────────────────────────────────────────
    if action == "chat":
        messages = body.get("messages", [])
        system_prompt = body.get("system_prompt", "")
        model = body.get("model", "")
        temperature = body.get("temperature", 0.7)

        if system_prompt:
            messages = [{"role": "system", "content": system_prompt}] + [
                m for m in messages if m.get("role") != "system"
            ]

        lm_url = get_lm_url(conn)
        if not model:
            cur = conn.cursor()
            cur.execute(f"SELECT value FROM {S}.app_settings WHERE key='lmstudio_model' LIMIT 1")
            row = cur.fetchone()
            model = row[0] if row else ""
            cur.close()
        conn.close()

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 2048,
            "stream": False,
        }

        try:
            req = urllib.request.Request(
                f"{lm_url}/v1/chat/completions",
                data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read())
            reply = data["choices"][0]["message"]["content"]
            return resp({"ok": True, "reply": reply, "model": data.get("model", model)})
        except urllib.error.URLError as e:
            return resp({"ok": False, "error": f"Нет связи с LM Studio: {e.reason}"}, 200)
        except Exception as e:
            return resp({"ok": False, "error": str(e)}, 200)

    # ── Получить все промпты ролей ────────────────────────────────────────────
    if action == "get_prompts":
        cur = conn.cursor()
        cur.execute(f"SELECT role_code, role_label, system_prompt FROM {S}.ai_role_prompts ORDER BY role_code")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return resp({"prompts": [{"role_code": r[0], "role_label": r[1], "system_prompt": r[2]} for r in rows]})

    if action == "get_prompt":
        role_code = qs.get("role_code") or body.get("role_code", "")
        cur = conn.cursor()
        cur.execute(f"SELECT system_prompt, role_label FROM {S}.ai_role_prompts WHERE role_code=%s", (role_code,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            return resp({"system_prompt": "Ты — ИИ-ассистент сотрудника строительной компании. Помогай в рабочих вопросах.", "role_label": role_code})
        return resp({"system_prompt": row[0], "role_label": row[1]})

    # ── Сохранить промпт роли ─────────────────────────────────────────────────
    if action == "save_prompt":
        role_code = body.get("role_code", "")
        role_label = body.get("role_label", "")
        system_prompt = body.get("system_prompt", "")
        if not role_code:
            conn.close()
            return resp({"error": "role_code обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"""
            INSERT INTO {S}.ai_role_prompts (role_code, role_label, system_prompt, updated_at)
            VALUES (%s, %s, %s, NOW())
            ON CONFLICT (role_code) DO UPDATE
            SET role_label=EXCLUDED.role_label, system_prompt=EXCLUDED.system_prompt, updated_at=NOW()
        """, (role_code, role_label, system_prompt))
        conn.commit()
        cur.close()
        conn.close()
        return resp({"ok": True})

    conn.close()
    return resp({"error": "Unknown action"}, 400)