"""
Синхронизация с Авито Pro API.
Получает новые сообщения/чаты от покупателей и создаёт лиды в CRM.
Запускается вручную или по расписанию через cron.
"""
import json, os, urllib.request, urllib.parse
import psycopg2

S = "t_p78845984_auto_house_cost_calc"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

AVITO_API = "https://api.avito.ru"

def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def resp(data, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}

def get_avito_token() -> str:
    """Получить access_token от Авито через client_credentials"""
    client_id = os.environ.get("AVITO_CLIENT_ID", "")
    client_secret = os.environ.get("AVITO_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise ValueError("AVITO_CLIENT_ID или AVITO_CLIENT_SECRET не заданы")

    data = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
    }).encode()

    req = urllib.request.Request(
        f"{AVITO_API}/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        result = json.loads(r.read())

    token = result.get("access_token")
    if not token:
        raise ValueError(f"Авито не вернул токен: {result}")
    print(f"[avito-sync] Токен получен, expires_in={result.get('expires_in')}")
    return token

def avito_get(path: str, token: str) -> dict:
    """GET запрос к Авито API"""
    req = urllib.request.Request(
        f"{AVITO_API}{path}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def get_user_id(token: str) -> int:
    """Получить ID текущего пользователя Авито"""
    result = avito_get("/core/v1/accounts/self", token)
    return result.get("id")

def get_chats(token: str, user_id: int) -> list:
    """Получить список чатов с новыми сообщениями"""
    result = avito_get(f"/messenger/v3/accounts/{user_id}/chats?unread_only=true&limit=50", token)
    return result.get("chats", [])

def get_chat_messages(token: str, user_id: int, chat_id: str) -> list:
    """Получить сообщения конкретного чата"""
    result = avito_get(f"/messenger/v3/accounts/{user_id}/chats/{chat_id}/messages/?limit=5", token)
    return result.get("messages", [])

def lead_exists(conn, avito_chat_id: str) -> bool:
    """Проверить — есть ли уже лид с этим чатом"""
    cur = conn.cursor()
    cur.execute(
        f"SELECT id FROM {S}.leads WHERE source_detail LIKE %s AND is_active=TRUE LIMIT 1",
        (f"%{avito_chat_id}%",)
    )
    exists = cur.fetchone() is not None
    cur.close()
    return exists

def create_lead(conn, name: str, phone: str, source_detail: str, comment: str) -> int:
    """Создать лид в БД"""
    cur = conn.cursor()
    cur.execute(f"""
        INSERT INTO {S}.leads (name, phone, source_id, source_detail, stage, created_at, updated_at)
        VALUES (%s, %s, 2, %s, 'new', NOW(), NOW()) RETURNING id""",
        (name[:128], phone, source_detail[:256]))
    lead_id = cur.fetchone()[0]
    cur.execute(
        f"INSERT INTO {S}.crm_events (lead_id, type, content, new_stage) VALUES (%s,'created',%s,'new')",
        (lead_id, comment[:500]))
    conn.commit()
    cur.close()
    return lead_id

def notify_bitrix(lead_id: int, name: str, source_detail: str):
    """Уведомить в Битрикс24 о новом лиде с Авито"""
    webhook = os.environ.get("BITRIX24_WEBHOOK", "").rstrip("/")
    if not webhook:
        return
    conn = db()
    cur = conn.cursor()
    cur.execute(
        f"SELECT bitrix_user_id FROM {S}.staff WHERE role_code='manager' AND bitrix_user_id IS NOT NULL LIMIT 1"
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return
    try:
        desc = f"[B]Новый лид с Авито:[/B] {name}\n[B]Источник:[/B] {source_detail}\n[B]Лид ID:[/B] {lead_id}"
        data = json.dumps({"fields": {
            "TITLE": f"🏠 Авито: {name}",
            "DESCRIPTION": desc,
            "RESPONSIBLE_ID": row[0],
            "PRIORITY": "2",
        }}, ensure_ascii=False).encode()
        req = urllib.request.Request(
            f"{webhook}/tasks.task.add.json", data=data,
            headers={"Content-Type": "application/json"}, method="POST"
        )
        urllib.request.urlopen(req, timeout=8)
        print(f"[avito-sync] Битрикс уведомление отправлено для лида {lead_id}")
    except Exception as e:
        print(f"[avito-sync] Битрикс ошибка: {e}")

def handler(event: dict, context) -> dict:
    """Синхронизация новых обращений с Авито Pro → CRM лиды"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # Проверяем токен только для ручного запуска
    token_header = (event.get("headers") or {}).get("X-Auth-Token", "")
    qs = event.get("queryStringParameters") or {}
    # Разрешаем запуск без токена только если передан sync_key
    sync_key = qs.get("sync_key", "")
    expected_key = os.environ.get("AVITO_CLIENT_ID", "")[:8]  # первые 8 символов client_id как ключ

    if not token_header and sync_key != expected_key:
        return resp({"error": "Не авторизован"}, 401)

    print("[avito-sync] Запуск синхронизации с Авито...")

    try:
        avito_token = get_avito_token()
    except Exception as e:
        print(f"[avito-sync] Ошибка получения токена: {e}")
        return resp({"error": f"Ошибка авторизации Авито: {e}"}, 500)

    try:
        user_id = get_user_id(avito_token)
        print(f"[avito-sync] Авито user_id={user_id}")
    except Exception as e:
        print(f"[avito-sync] Ошибка получения user_id: {e}")
        return resp({"error": f"Ошибка получения профиля: {e}"}, 500)

    try:
        chats = get_chats(avito_token, user_id)
        print(f"[avito-sync] Найдено непрочитанных чатов: {len(chats)}")
    except Exception as e:
        print(f"[avito-sync] Ошибка получения чатов: {e}")
        return resp({"error": f"Ошибка получения чатов: {e}"}, 500)

    conn = db()
    created = []
    skipped = []

    for chat in chats:
        chat_id = str(chat.get("id", ""))
        if not chat_id:
            continue

        # Пропускаем уже существующие лиды
        if lead_exists(conn, chat_id):
            skipped.append(chat_id)
            print(f"[avito-sync] Чат {chat_id} — лид уже существует, пропускаем")
            continue

        # Данные об авторе чата (покупателе)
        users = chat.get("users", [])
        buyer = next((u for u in users if u.get("id") != user_id), None)
        buyer_name = buyer.get("name", "Клиент Авито") if buyer else "Клиент Авито"
        buyer_phone = None  # Авито не даёт телефон без дополнительного разрешения

        # Тема объявления
        context_type = chat.get("context", {}).get("type", "")
        item_title = ""
        if context_type == "item":
            item_title = chat.get("context", {}).get("value", {}).get("title", "")

        # Последнее сообщение
        last_msg = ""
        try:
            messages = get_chat_messages(avito_token, user_id, chat_id)
            if messages:
                last_msg = messages[-1].get("content", {}).get("text", "")
        except Exception as e:
            print(f"[avito-sync] Ошибка получения сообщений чата {chat_id}: {e}")

        source_detail = f"Авито чат {chat_id}"
        if item_title:
            source_detail += f": {item_title[:80]}"

        comment = f"Сообщение: {last_msg[:300]}" if last_msg else "Новый чат на Авито"

        lead_id = create_lead(
            conn=conn,
            name=buyer_name,
            phone=buyer_phone,
            source_detail=source_detail,
            comment=comment,
        )
        created.append({"lead_id": lead_id, "chat_id": chat_id, "name": buyer_name})
        print(f"[avito-sync] Создан лид #{lead_id} — {buyer_name} (чат {chat_id})")

        notify_bitrix(lead_id, buyer_name, source_detail)

    conn.close()

    return resp({
        "ok": True,
        "created": len(created),
        "skipped": len(skipped),
        "leads": created,
    })
