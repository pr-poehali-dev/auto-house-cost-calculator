"""
Приём лидов из внешних источников:
- POST /webhook/avito  — Авито Pro webhook (новое сообщение/заявка)
- POST /webhook/megafon — Мегафон АТС webhook (входящий звонок)
- POST /webhook/email  — пересылка с Яндекс почты через Яндекс.360 webhook
- POST /manual         — ручное создание лида менеджером
"""
import json, os, re
import psycopg2
import urllib.request

S = "t_p78845984_auto_house_cost_calc"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-Webhook-Secret",
}
CRM_URL = os.environ.get("CRM_API_URL", "https://functions.poehali.dev/ca6be6cc-ad08-4970-a85b-363894cb1a6f")

SOURCE_IDS = {
    "website": 1,
    "avito":   2,
    "email":   3,
    "phone":   5,
    "megafon": 5,
}

def db(): return psycopg2.connect(os.environ["DATABASE_URL"])

def resp(data, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}

def create_lead(name: str, phone: str = None, email: str = None,
                source_id: int = 1, source_detail: str = "", stage: str = "new",
                area: int = None, budget: int = None, comment: str = None) -> int:
    """Создаёт лид в БД и возвращает его ID"""
    conn = db()
    cur = conn.cursor()
    cur.execute(f"""
        INSERT INTO {S}.leads
        (name, phone, email, source_id, source_detail, stage,
         area_desired, budget, created_at, updated_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
        RETURNING id""",
        (name[:128], phone, email, source_id, source_detail[:256], stage,
         area, budget))
    lead_id = cur.fetchone()[0]
    # Событие создания
    cur.execute(
        f"INSERT INTO {S}.crm_events (lead_id, type, content, new_stage) VALUES (%s,'created',%s,'new')",
        (lead_id, f"Лид создан автоматически из: {source_detail}. {comment or ''}"))
    conn.commit(); cur.close(); conn.close()
    return lead_id

def notify_bitrix(lead_id: int, name: str, phone: str, source: str):
    """Уведомление в Битрикс о новом лиде"""
    webhook = os.environ.get("BITRIX24_WEBHOOK", "").rstrip("/")
    if not webhook: return
    try:
        conn = db()
        cur = conn.cursor()
        # Берём первого менеджера с bitrix_user_id
        cur.execute(f"SELECT bitrix_user_id FROM {S}.staff WHERE role_code='manager' AND bitrix_user_id IS NOT NULL LIMIT 1")
        row = cur.fetchone(); cur.close(); conn.close()
        if not row: return
        resp_id = row[0]
        desc = f"[B]Новый лид:[/B] {name}\n[B]Телефон:[/B] {phone or '—'}\n[B]Источник:[/B] {source}\n[B]Лид ID:[/B] {lead_id}"
        data = json.dumps({"fields": {
            "TITLE": f"🔔 Новый лид: {name} ({source})",
            "DESCRIPTION": desc,
            "RESPONSIBLE_ID": resp_id,
            "PRIORITY": "2",
        }}, ensure_ascii=False).encode()
        req = urllib.request.Request(f"{webhook}/tasks.task.add.json", data=data,
            headers={"Content-Type": "application/json"}, method="POST")
        urllib.request.urlopen(req, timeout=8)
    except Exception as e:
        print(f"[lead-intake] Bitrix notify error: {e}")

def handler(event: dict, context) -> dict:
    """Приём лидов из внешних источников: Авито, Мегафон АТС, Email, ручной ввод"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    source = qs.get("source", "manual")

    body = {}
    raw = event.get("body") or ""
    if raw:
        try: body = json.loads(raw)
        except: pass

    print(f"[lead-intake] source={source} body={str(body)[:300]}")

    # ── Авито Pro webhook ─────────────────────────────────────────────────────
    if source == "avito":
        # Авито присылает: {"payload": {"value": {"user": {"name":..., "phone":...}, "chat_id":...}}}
        payload = body.get("payload", {}).get("value", {})
        user_info = payload.get("user", {}) or body.get("user", {})
        name = user_info.get("name") or body.get("name") or "Клиент Авито"
        phone = user_info.get("phone") or body.get("phone")
        chat_id = str(payload.get("chat_id", "") or body.get("chat_id", ""))
        item_title = payload.get("item", {}).get("title", "") or body.get("item_title", "")
        comment = f"Авито чат: {chat_id}. Объявление: {item_title}"
        if not name or name == "Клиент Авито":
            name = f"Авито #{chat_id[:8]}" if chat_id else "Клиент Авито"
        lead_id = create_lead(name=name, phone=phone, source_id=SOURCE_IDS["avito"],
                              source_detail=f"Авито: {item_title[:100]}" if item_title else "Авито", comment=comment)
        notify_bitrix(lead_id, name, phone or "—", "Авито")
        return resp({"ok": True, "lead_id": lead_id})

    # ── Мегафон АТС webhook (входящий звонок) ────────────────────────────────
    if source == "megafon":
        # Мегафон присылает: {"caller_id": "+79001234567", "called_id": "...", "call_id": "..."}
        phone = body.get("caller_id") or body.get("from") or body.get("phone")
        call_id = body.get("call_id", "")
        called = body.get("called_id", "")
        if not phone:
            return resp({"ok": True, "skipped": "no phone"})
        clean_phone = re.sub(r"[^\d+]", "", str(phone))
        # Проверяем — нет ли уже лида с этим телефоном за последние 24ч
        conn = db()
        cur = conn.cursor()
        cur.execute(f"SELECT id FROM {S}.leads WHERE phone=%s AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1", (clean_phone,))
        existing = cur.fetchone(); cur.close(); conn.close()
        if existing:
            print(f"[lead-intake] Мегафон: лид с телефоном {clean_phone} уже есть (id={existing[0]})")
            return resp({"ok": True, "lead_id": existing[0], "duplicate": True})
        name = f"Звонок {clean_phone}"
        lead_id = create_lead(name=name, phone=clean_phone, source_id=SOURCE_IDS["megafon"],
                              source_detail=f"Мегафон АТС, вызов {call_id[:20]}", comment=f"Входящий звонок на номер {called}")
        notify_bitrix(lead_id, name, clean_phone, "Мегафон АТС")
        return resp({"ok": True, "lead_id": lead_id})

    # ── Email webhook (Яндекс 360 / пересылка) ───────────────────────────────
    if source == "email":
        from_email = body.get("from_email") or body.get("email", "")
        from_name = body.get("from_name") or body.get("name") or from_email.split("@")[0] if from_email else "Email клиент"
        subject = body.get("subject", "")
        text = body.get("text", "") or body.get("body", "")
        full_text = f"{subject} {text}"
        phones = list(set(re.sub(r"[^\d+]", "", m.group(0))
                         for m in re.finditer(r"(\+7|8)[\s\-\(]?\d{3}[\s\-\)]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}", full_text)
                         if len(re.sub(r"[^\d+]", "", m.group(0))) >= 11))
        phone = phones[0] if phones else None
        url_re = r"https?://[^\s<>\"\'\)\]\},;]+"
        url_skip = ["yandex.ru", "mail.ru", "unsubscribe", "click.mail", "passport.yandex", ".png", ".jpg", ".gif"]
        urls = list(dict.fromkeys(m.group(0).rstrip(".") for m in re.finditer(url_re, full_text)
                                  if not any(s in m.group(0).lower() for s in url_skip)))[:5]
        extra_emails = list(set(m.group(0).lower() for m in re.finditer(r"[\w\.\-+]+@[\w\.\-]+\.\w{2,}", full_text)
                                if m.group(0).lower() != (from_email or "").lower() and "noreply" not in m.group(0).lower()))[:5]
        comment_parts = [f"От: {from_name} <{from_email}>", f"Тема: {subject}"]
        if phones:
            comment_parts.append(f"Телефоны: {', '.join(phones)}")
        if urls:
            comment_parts.append(f"Ссылки: {', '.join(urls)}")
        if extra_emails:
            comment_parts.append(f"Доп. email: {', '.join(extra_emails)}")
        comment_parts.append(f"\n--- Текст письма ---\n{text}")
        comment = "\n".join(comment_parts)
        lead_id = create_lead(name=from_name[:128], phone=phone, email=from_email,
                              source_id=SOURCE_IDS["email"],
                              source_detail=f"Email: {subject[:100]}" if subject else "Email заявка",
                              comment=comment)
        notify_bitrix(lead_id, from_name, phone or from_email, "Email")
        return resp({"ok": True, "lead_id": lead_id})

    # ── Ручное создание (публичная форма на сайте) ────────────────────────────
    if source in ("site", "manual", "calc", "builder"):
        name = body.get("name", "").strip() or body.get("client_name", "").strip()
        phone = body.get("phone") or body.get("client_phone")
        email = body.get("email") or body.get("client_email")
        if not name:
            return resp({"error": "name обязателен"}, 400)
        source_labels = {"site": "Сайт (форма заявки)", "calc": "Калькулятор", "builder": "Конструктор проекта"}
        source_detail = source_labels.get(source, "Сайт")
        lead_id = create_lead(
            name=name, phone=phone, email=email,
            source_id=SOURCE_IDS["website"],
            source_detail=source_detail,
            area=body.get("area_desired") or body.get("area"),
            budget=body.get("budget"),
            comment=body.get("comment") or body.get("client_comment"))
        notify_bitrix(lead_id, name, phone or "—", source_detail)
        return resp({"ok": True, "lead_id": lead_id})

    return resp({"error": f"Неизвестный source: {source}"}, 400)