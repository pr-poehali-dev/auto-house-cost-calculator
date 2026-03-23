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
    """Очистка HTML в текст"""
    text = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.I | re.DOTALL)
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.I | re.DOTALL)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</(p|div|tr|li|h\d|td|th)>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;", '"', text)
    text = re.sub(r"&#\d+;", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    lines = [l.strip() for l in text.split("\n")]
    text = "\n".join(l for l in lines if l)
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


SERVICE_SENDERS = {
    "jivosite.com": "JivoSite",
    "jivo.ru": "JivoSite",
    "tildamail.com": "Tilda",
    "tilda.cc": "Tilda",
    "bitrix24.ru": "Битрикс24",
    "bitrix24.com": "Битрикс24",
    "callbackhunter.com": "CallbackHunter",
    "envybox.io": "Envybox",
    "marquiz.ru": "Marquiz",
    "roistat.com": "Roistat",
    "lptracker.ru": "LPTracker",
    "calltouch.ru": "Calltouch",
}


def parse_service_email(from_email: str, subject: str, body: str) -> dict | None:
    """Парсит письмо от JivoSite, Tilda и других сервисов, возвращает данные клиента"""
    domain = from_email.split("@")[-1].lower() if "@" in from_email else ""
    service = None
    for srv_domain, srv_name in SERVICE_SENDERS.items():
        if srv_domain in domain:
            service = srv_name
            break
    if not service:
        return None

    full = f"{subject}\n{body}"
    result = {"service": service, "site_url": None, "client_name": None,
              "client_email": None, "client_phone": None, "client_message": None}

    service_domains = ["jivosite.com", "jivo.ru", "tilda.cc", "tildamail.com",
                       "bitrix24.ru", "bitrix24.com", "callbackhunter.com",
                       "envybox.io", "marquiz.ru", "app.jivo.chat"]
    for m in re.finditer(r"https?://[^\s<>\"']+", f"{subject} {body}"):
        url = m.group(0).rstrip("./)")
        if not any(sd in url.lower() for sd in service_domains):
            result["site_url"] = url
            break

    jivo_name = re.search(r"(?:от|from)\s+([A-Za-zА-Яа-яЁё0-9\s]+?)(?:\s*$|\s*\n)", subject)
    if jivo_name:
        result["client_name"] = jivo_name.group(1).strip()

    name_patterns = [
        r"(?:Имя|Name|Клиент|Посетитель|ФИО|Контакт)[:\s]+([^\n<]{2,60})",
        r"(?:имя|name|клиент)[:\s]+([^\n<]{2,60})",
        r"\bОт[:\s]+([A-Za-zА-Яа-яЁё0-9][^\n<]{1,59})",
    ]
    for pat in name_patterns:
        m = re.search(pat, body, re.I)
        if m:
            val = m.group(1).strip().strip("\"'")
            if val and len(val) > 1 and not val.startswith("http") and "@" not in val:
                result["client_name"] = val
                break

    phone_patterns = [
        r"(?:Телефон|Phone|Тел|Номер)[:\s]+([\+\d\s\-\(\)]{10,20})",
        r"(?:телефон|phone|тел)[:\s]+([\+\d\s\-\(\)]{10,20})",
    ]
    for pat in phone_patterns:
        m = re.search(pat, full, re.I)
        if m:
            clean = re.sub(r"[^\d+]", "", m.group(1))
            if len(clean) >= 10:
                result["client_phone"] = clean
                break

    email_patterns = [
        r"(?:Email|E-mail|Почта|Mail)[:\s]+([\w\.\-+]+@[\w\.\-]+\.\w{2,})",
        r"(?:email|почта|mail)[:\s]+([\w\.\-+]+@[\w\.\-]+\.\w{2,})",
    ]
    for pat in email_patterns:
        m = re.search(pat, full, re.I)
        if m:
            result["client_email"] = m.group(1).strip()
            break

    msg_patterns = [
        r"(?:Сообщение|Message|Текст|Вопрос|Комментарий)[:\s]+(.{5,500}?)(?:\n\s*\n|\n(?:Имя|Телефон|Email|Phone|От|Информация|---)|$)",
        r"(?:сообщение|message|текст сообщения)[:\s]+(.{5,500}?)(?:\n\s*\n|$)",
    ]
    for pat in msg_patterns:
        m = re.search(pat, full, re.I | re.DOTALL)
        if m:
            result["client_message"] = m.group(1).strip()[:500]
            break

    if service == "JivoSite":
        lines = [l.strip() for l in body.split("\n") if l.strip()]
        skip_phrases = ["сообщение с сайта", "информация о клиенте", "от:", "телефон:",
                        "email:", "чтобы узнать", "подключите", "ответить в приложении",
                        "client", "скачать для", "скачать msi", "если отвечать",
                        "конверсия", "будьте на связи", "скачайте приложение",
                        "jivo", "приложении"]
        candidates = []
        for line in lines:
            ll = line.lower()
            if any(sp in ll for sp in skip_phrases):
                continue
            if line.startswith("http") or len(line) < 5 or "@" in line:
                continue
            if re.match(r"^[\d\s\+\-\(\)]+$", line):
                continue
            candidates.append(line)
        if candidates:
            result["client_message"] = candidates[0][:500]

    if not result["client_phone"]:
        phones = extract_phones(full)
        if phones:
            result["client_phone"] = phones[0]
    if not result["client_email"]:
        emails = extract_email_addresses(full, exclude=from_email)
        if emails:
            result["client_email"] = emails[0]

    return result


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

            skip_keywords = ["noreply", "no-reply", "donotreply", "mailer", "notification",
                             "support@", "info@avito", "yandex.ru",
                             "subscribe@", "news@", "promo@", "marketing@",
                             "digest@", "newsletter@", "timeweb.cloud"]
            el = from_email.lower()
            if any(kw in el for kw in skip_keywords):
                skipped.append({"email": from_email, "reason": "рассылка"})
                continue

            service_data = parse_service_email(from_email, subject, body)
            if service_data:
                dedup_email = service_data["client_email"] or from_email
                if email_lead_exists(conn, dedup_email, subject):
                    skipped.append({"email": dedup_email, "reason": "дубль"})
                    continue
                lead_name = service_data["client_name"] or f"Заявка {service_data['service']}"
                lead_phone = service_data["client_phone"]
                lead_email = service_data["client_email"] or from_email
                site_url = service_data["site_url"]
                src = f"{service_data['service']}: {subject[:60]}" if subject else service_data["service"]
                if site_url:
                    src = f"{service_data['service']} ({site_url[:80]})"
                comment_parts = [f"Источник: {service_data['service']}"]
                if site_url:
                    comment_parts.append(f"Сайт: {site_url}")
                if service_data["client_name"]:
                    comment_parts.append(f"Клиент: {service_data['client_name']}")
                if lead_phone:
                    comment_parts.append(f"Телефон: {lead_phone}")
                if service_data["client_email"]:
                    comment_parts.append(f"Email: {service_data['client_email']}")
                if service_data["client_message"]:
                    comment_parts.append(f"Сообщение: {service_data['client_message']}")
                comment_parts.append(f"\n--- Полный текст ---\n{body[:1200]}")
                comment = "\n".join(comment_parts)
                lead_id = create_lead(
                    conn=conn, name=lead_name, phone=lead_phone,
                    email_addr=lead_email, source_detail=src[:256], comment=comment)
            else:
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
                    conn=conn, name=from_name, phone=phone,
                    email_addr=from_email, source_detail=source_detail, comment=comment)
            if service_data:
                created.append({"lead_id": lead_id, "from": lead_email, "subject": subject,
                                "service": service_data["service"], "site": service_data.get("site_url")})
                print(f"[email-sync] Лид #{lead_id} из {service_data['service']} — {lead_name} <{lead_email}>")
                notify_bitrix(lead_id, lead_name, src[:256])
            else:
                created.append({"lead_id": lead_id, "from": from_email, "subject": subject,
                                "phone": phone, "urls": urls})
                print(f"[email-sync] Лид #{lead_id} — {from_name} <{from_email}>")
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