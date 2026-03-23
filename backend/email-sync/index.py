"""
Синхронизация входящих писем с Яндекс почты → CRM лиды.
Подключается по IMAP, читает непрочитанные письма, создаёт лиды.
"""
import json, os, re, imaplib, email
from email.header import decode_header
from datetime import datetime, timedelta
import psycopg2

S = "t_p78845984_auto_house_cost_calc"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

IMAP_HOST = "imap.yandex.ru"
IMAP_PORT = 993


def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def resp(data, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}


def decode_str(s):
    """Декодирует заголовок письма в строку"""
    if not s:
        return ""
    parts = decode_header(s)
    result = []
    for part, enc in parts:
        if isinstance(part, bytes):
            result.append(part.decode(enc or "utf-8", errors="ignore"))
        else:
            result.append(str(part))
    return " ".join(result)


def strip_html(html: str) -> str:
    """Грубая очистка HTML в текст"""
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    text = re.sub(r"</(p|div|tr|li|h\d)>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;", '"', text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def get_body(msg) -> str:
    """Извлекает текст письма (предпочитает plain text, fallback на HTML)"""
    plain = ""
    html = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if "attachment" in cd:
                continue
            charset = part.get_content_charset() or "utf-8"
            try:
                payload = part.get_payload(decode=True).decode(charset, errors="ignore")
            except:
                continue
            if ct == "text/plain" and not plain:
                plain = payload
            elif ct == "text/html" and not html:
                html = payload
    else:
        charset = msg.get_content_charset() or "utf-8"
        try:
            payload = msg.get_payload(decode=True).decode(charset, errors="ignore")
        except:
            payload = ""
        if msg.get_content_type() == "text/html":
            html = payload
        else:
            plain = payload
    body = plain or strip_html(html)
    return body[:3000]


def extract_phones(text: str) -> list[str]:
    """Ищет все телефоны в тексте (российские форматы)"""
    patterns = [
        r"(\+7|8)[\s\-\(]?\d{3}[\s\-\)]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}",
        r"(\+7|8)\s?\(\d{3}\)\s?\d{3}[\-\s]?\d{2}[\-\s]?\d{2}",
    ]
    found = set()
    for pat in patterns:
        for m in re.finditer(pat, text):
            clean = re.sub(r"[^\d+]", "", m.group(0))
            if len(clean) >= 11:
                found.add(clean)
    return list(found)


def extract_urls(text: str) -> list[str]:
    """Извлекает URL-ссылки из текста"""
    url_re = r"https?://[^\s<>\"\'\)\]\},;]+"
    skip = ["yandex.ru", "mail.ru", "google.com/maps", "unsubscribe", "click.mail",
            "passport.yandex", "avatars.mds", "mc.yandex", "favicon", ".png", ".jpg", ".gif"]
    urls = []
    for m in re.finditer(url_re, text):
        url = m.group(0).rstrip(".")
        if not any(s in url.lower() for s in skip):
            urls.append(url)
    return list(dict.fromkeys(urls))[:5]


def extract_email_addresses(text: str, exclude: str = "") -> list[str]:
    """Извлекает все email-адреса из текста, кроме exclude"""
    found = set()
    for m in re.finditer(r"[\w\.\-+]+@[\w\.\-]+\.\w{2,}", text):
        addr = m.group(0).lower()
        if addr != exclude.lower() and "yandex.ru" not in addr and "noreply" not in addr:
            found.add(addr)
    return list(found)[:5]


def email_lead_exists(conn, from_email: str, subject: str) -> bool:
    """Проверяем — нет ли уже лида с таким email и темой за последние 24ч"""
    cur = conn.cursor()
    cur.execute(
        f"SELECT id FROM {S}.leads WHERE email=%s AND source_detail LIKE %s "
        f"AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1",
        (from_email, f"%{subject[:30]}%"))
    exists = cur.fetchone() is not None
    cur.close()
    return exists


def create_lead(conn, name: str, phone: str, email_addr: str,
                source_detail: str, comment: str) -> int:
    cur = conn.cursor()
    cur.execute(f"""
        INSERT INTO {S}.leads
        (name, phone, email, source_id, source_detail, stage, created_at, updated_at)
        VALUES (%s,%s,%s,3,%s,'new',NOW(),NOW()) RETURNING id""",
        (name[:128], phone, email_addr, source_detail[:256]))
    lead_id = cur.fetchone()[0]
    cur.execute(
        f"INSERT INTO {S}.crm_events (lead_id, type, content, new_stage) VALUES (%s,'created',%s,'new')",
        (lead_id, comment[:2000]))
    conn.commit()
    cur.close()
    return lead_id


def notify_bitrix(lead_id: int, name: str, source_detail: str):
    import urllib.request
    webhook = os.environ.get("BITRIX24_WEBHOOK", "").rstrip("/")
    if not webhook:
        return
    conn = db()
    cur = conn.cursor()
    cur.execute(
        f"SELECT bitrix_user_id FROM {S}.staff "
        f"WHERE role_code='manager' AND bitrix_user_id IS NOT NULL LIMIT 1")
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return
    try:
        desc = f"[B]Новый лид из Email:[/B] {name}\n[B]Источник:[/B] {source_detail}\n[B]Лид ID:[/B] {lead_id}"
        data = json.dumps({"fields": {
            "TITLE": f"📧 Email: {name}",
            "DESCRIPTION": desc,
            "RESPONSIBLE_ID": row[0],
            "PRIORITY": "2",
        }}, ensure_ascii=False).encode()
        req = urllib.request.Request(
            f"{webhook}/tasks.task.add.json", data=data,
            headers={"Content-Type": "application/json"}, method="POST")
        urllib.request.urlopen(req, timeout=8)
    except Exception as e:
        print(f"[email-sync] Битрикс ошибка: {e}")


def handler(event: dict, context) -> dict:
    """Читает письма с Яндекс почты за последние 7 дней и создаёт лиды в CRM"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    token = (event.get("headers") or {}).get("X-Auth-Token", "")
    if not token:
        return resp({"error": "Не авторизован"}, 401)

    yandex_email = os.environ.get("YANDEX_EMAIL", "")
    yandex_password = os.environ.get("YANDEX_APP_PASSWORD", "")

    if not yandex_email or not yandex_password:
        return resp({"error": "YANDEX_EMAIL или YANDEX_APP_PASSWORD не заданы"}, 500)

    print(f"[email-sync] Подключаюсь к {IMAP_HOST} для {yandex_email}...")

    try:
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        mail.login(yandex_email, yandex_password)
    except Exception as e:
        print(f"[email-sync] Ошибка подключения IMAP: {e}")
        return resp({"error": f"Ошибка подключения к почте: {e}"}, 500)

    # Получаем список всех папок
    try:
        _, folders_raw = mail.list()
        folders = []
        for f in folders_raw:
            decoded = f.decode()
            # Формат: (\Flags) "/" "folder_name" или (\Flags) "|" folder_name
            match = re.search(r'["\s]([^\s"]+)\s*$', decoded)
            if match:
                folder_name = match.group(1).strip('"')
                folders.append(folder_name)
        print(f"[email-sync] Папки: {folders}")
    except Exception as e:
        mail.logout()
        return resp({"error": f"Ошибка получения папок: {e}"}, 500)

    conn = db()
    created = []
    skipped = []
    all_email_ids = []

    # Ищем письма за последние 7 дней во всех папках
    since_date = (datetime.now() - timedelta(days=7)).strftime("%d-%b-%Y")
    for folder in folders:
        try:
            status, _ = mail.select(folder)
            if status != "OK":
                continue
            _, msg_ids = mail.search(None, f'SINCE "{since_date}"')
            ids = msg_ids[0].split()
            if ids:
                print(f"[email-sync] Папка '{folder}': {len(ids)} писем за неделю")
                all_email_ids.extend([(folder, eid) for eid in ids])
        except Exception as e:
            print(f"[email-sync] Ошибка папки '{folder}': {e}")
            continue

    print(f"[email-sync] Всего непрочитанных: {len(all_email_ids)}")

    for folder, eid in all_email_ids[-20:]:  # максимум 20 последних
        try:
            mail.select(folder)
            _, msg_data = mail.fetch(eid, "(RFC822)")
            msg = email.message_from_bytes(msg_data[0][1])

            from_raw = decode_str(msg.get("From", ""))
            subject = decode_str(msg.get("Subject", ""))
            body = get_body(msg)

            # Парсим имя и email из поля From
            email_match = re.search(r"[\w\.\-]+@[\w\.\-]+", from_raw)
            from_email = email_match.group(0) if email_match else ""
            from_name = re.sub(r"<.*?>", "", from_raw).strip().strip('"') or from_email.split("@")[0]

            if not from_email:
                continue

            # Пропускаем рассылки и уведомления
            skip_keywords = ["noreply", "no-reply", "donotreply", "mailer", "notification",
                             "support@", "info@avito", "yandex.ru"]
            if any(kw in from_email.lower() for kw in skip_keywords):
                skipped.append({"email": from_email, "reason": "рассылка"})
                continue

            # Проверяем дубли
            if email_lead_exists(conn, from_email, subject):
                skipped.append({"email": from_email, "reason": "дубль"})
                continue

            full_text = f"{subject} {body}"
            phones = extract_phones(full_text)
            phone = phones[0] if phones else None
            urls = extract_urls(full_text)
            extra_emails = extract_email_addresses(full_text, exclude=from_email)

            source_detail = f"Email: {subject[:80]}" if subject else "Входящее письмо"

            comment_parts = [f"От: {from_name} <{from_email}>", f"Тема: {subject}"]
            if phones:
                comment_parts.append(f"Телефоны: {', '.join(phones)}")
            if urls:
                comment_parts.append(f"Ссылки: {', '.join(urls)}")
            if extra_emails:
                comment_parts.append(f"Доп. email: {', '.join(extra_emails)}")
            comment_parts.append(f"\n--- Текст письма ---\n{body[:1500]}")
            comment = "\n".join(comment_parts)

            lead_id = create_lead(
                conn=conn,
                name=from_name,
                phone=phone,
                email_addr=from_email,
                source_detail=source_detail,
                comment=comment,
            )
            created.append({"lead_id": lead_id, "from": from_email, "subject": subject,
                            "phone": phone, "urls": urls})
            print(f"[email-sync] Создан лид #{lead_id} — {from_name} <{from_email}>")

            notify_bitrix(lead_id, from_name, source_detail)

        except Exception as e:
            print(f"[email-sync] Ошибка обработки письма {eid}: {e}")
            continue

    conn.close()
    mail.logout()

    return resp({
        "ok": True,
        "created": len(created),
        "skipped": len(skipped),
        "leads": created,
    })