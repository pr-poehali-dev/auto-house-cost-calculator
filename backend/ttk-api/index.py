"""
ttk-api: справочник технологических карт (ТТК).
Загрузка PDF (текст или скан), OCR через OCR.space, AI-разбор через GigaChat.
Хранение структурированных данных: материалы, ресурсы, условия хранения/приёмки.
"""
import json, os, base64, re, uuid, ssl, urllib.request, urllib.parse, urllib.error
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

def s3c():
    return boto3.client("s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"])

def cdn_url(key):
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

def get_staff(conn, token):
    cur = conn.cursor()
    cur.execute(
        f"SELECT s.id, s.full_name, s.role_code FROM {S}.sessions ss "
        f"JOIN {S}.staff s ON s.id=ss.staff_id "
        f"WHERE ss.token=%s AND ss.expires_at>NOW()", (token,))
    r = cur.fetchone(); cur.close()
    return {"id": r[0], "full_name": r[1], "role_code": r[2]} if r else None

TTK_PROMPT = """Ты — эксперт строительной компании. Перед тобой технологическая карта (ТТК) строительных работ.

Извлеки и структурируй следующую информацию:

1. title — название работы (например "Монтаж металлочерепицы")
2. category — категория (Кровля / Стены / Фундамент / Полы / Отделка / Электрика / Сантехника / Инженерия / Прочее)
3. work_type — тип работы (монтаж / кладка / устройство / отделка / демонтаж / прочее)
4. description — краткое описание (1-2 предложения)
5. tags — массив тегов для подбора (например ["металлочерепица","кровля","скат"])
6. materials — массив материалов, каждый объект:
   {"name": "...", "unit": "м²/шт/кг/...", "qty_per_unit": 0.0, "note": "..."}
7. resources — массив ресурсов (техника, инструменты, рабочие), каждый:
   {"name": "...", "type": "рабочий/техника/инструмент", "qty": 0, "unit": "чел/шт/..."}
8. storage_conditions — условия хранения материалов (текст)
9. acceptance_conditions — требования и условия приёмки работ (текст)
10. content — этапы работ, массив:
    {"step": 1, "name": "...", "desc": "...", "duration": "..."}

Верни ТОЛЬКО валидный JSON объект (без пояснений):
{
  "title": "...",
  "category": "...",
  "work_type": "...",
  "description": "...",
  "tags": ["..."],
  "materials": [...],
  "resources": [...],
  "storage_conditions": "...",
  "acceptance_conditions": "...",
  "content": [...]
}"""

def ocr_pdf_images(images_b64: list) -> str:
    """OCR через OCR.space — извлекает текст из изображений PDF-скана"""
    ocr_key = os.environ.get("OCR_SPACE_API_KEY", "")
    if not ocr_key or not images_b64:
        return ""
    texts = []
    for b64 in images_b64[:8]:
        try:
            payload = urllib.parse.urlencode({
                "base64Image": f"data:image/jpeg;base64,{b64}",
                "language": "rus",
                "isOverlayRequired": "false",
                "OCREngine": "2",
                "scale": "true",
            }).encode()
            req = urllib.request.Request(
                "https://api.ocr.space/parse/image",
                data=payload,
                headers={"apikey": ocr_key, "Content-Type": "application/x-www-form-urlencoded"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=60) as r:
                result = json.loads(r.read())
            parsed = result.get("ParsedResults", [])
            if parsed:
                texts.append(parsed[0].get("ParsedText", ""))
        except Exception as e:
            print(f"[ttk-api] OCR error: {e}")
    return "\n".join(texts)

def extract_text_from_pdf(file_data: bytes) -> str:
    """Извлекает встроенный текст из PDF"""
    try:
        text = file_data.decode("latin-1", errors="ignore")
        chunks = re.findall(r'\(([^)]{1,200})\)', text)
        readable = []
        for chunk in chunks:
            cleaned = chunk.replace("\\n", " ").replace("\\r", " ").replace("\\t", " ").strip()
            if len(cleaned) > 2 and any(c.isalpha() for c in cleaned):
                readable.append(cleaned)
        return " | ".join(readable[:800])
    except:
        return ""

def extract_images_from_pdf(file_data: bytes) -> list:
    """Извлекает JPEG-изображения из PDF-скана"""
    try:
        images = []
        pos = 0
        while pos < len(file_data) - 4:
            idx = file_data.find(b'\xff\xd8\xff', pos)
            if idx == -1:
                break
            end = file_data.find(b'\xff\xd9', idx + 2)
            if end != -1 and end - idx > 5000:
                images.append(base64.b64encode(file_data[idx:end + 2]).decode())
                if len(images) >= 8:
                    break
            pos = idx + 3
        return images
    except:
        return []

def gigachat_token() -> str:
    auth_key = os.environ.get("GIGACHAT_AUTH_KEY", "")
    data = urllib.parse.urlencode({"scope": "GIGACHAT_API_PERS"}).encode()
    req = urllib.request.Request(
        "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {auth_key}",
            "RqUID": str(uuid.uuid4()),
        },
        method="POST"
    )
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        return json.loads(r.read())["access_token"]

def gigachat_chat(messages: list, temperature: float = 0.1, max_tokens: int = 4000) -> str:
    token = gigachat_token()
    data = json.dumps({
        "model": "GigaChat",
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }, ensure_ascii=False).encode()
    req = urllib.request.Request(
        "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
        data=data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST"
    )
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=120, context=ctx) as r:
        result = json.loads(r.read())
    return result["choices"][0]["message"]["content"].strip()

def ai_parse_ttk(text: str) -> dict:
    """GigaChat анализирует текст ТТК и возвращает структурированные данные"""
    if not os.environ.get("GIGACHAT_AUTH_KEY") or not text.strip():
        return {}
    prompt = f"{TTK_PROMPT}\n\nТекст технологической карты:\n{text[:15000]}"
    content = gigachat_chat([{"role": "user", "content": prompt}], temperature=0.1, max_tokens=4000)
    match = re.search(r'\{.*\}', content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except:
            pass
    return {}

def ttk_row(r):
    return {
        "id": r[0], "title": r[1], "category": r[2], "work_type": r[3],
        "description": r[4], "tags": r[5] or [], "materials": r[6] or [],
        "resources": r[7] or [], "storage_conditions": r[8] or "",
        "acceptance_conditions": r[9] or "", "content": r[10] or [],
        "file_url": r[11] or "", "file_name": r[12] or "",
        "parse_status": r[13] or "manual", "is_active": r[14],
        "created_at": str(r[15]), "source_text": r[16] or "",
    }

SELECT_COLS = (
    "id, title, category, work_type, description, tags, materials, resources, "
    "storage_conditions, acceptance_conditions, content, file_url, file_name, "
    "parse_status, is_active, created_at, source_text"
)

def handler(event: dict, context) -> dict:
    """Справочник технологических карт: CRUD + загрузка PDF + AI-разбор"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")
    token = event.get("headers", {}).get("X-Auth-Token", "")
    body = {}
    if event.get("body"):
        try: body = json.loads(event["body"])
        except: pass

    conn = db()
    if not token:
        conn.close(); return resp({"error": "Не авторизован"}, 401)
    staff = get_staff(conn, token)
    if not staff:
        conn.close(); return resp({"error": "Сессия истекла"}, 401)

    role = staff["role_code"]

    # ── GET список ТТК ──────────────────────────────────────────────────────
    if method == "GET" and action == "list":
        cur = conn.cursor()
        category = qs.get("category", "")
        search = qs.get("search", "")
        q = f"SELECT {SELECT_COLS} FROM {S}.tech_cards WHERE is_active=TRUE"
        params = []
        if category:
            q += " AND category=%s"; params.append(category)
        if search:
            q += " AND (title ILIKE %s OR description ILIKE %s OR %s=ANY(tags))"
            params += [f"%{search}%", f"%{search}%", search]
        q += " ORDER BY category, title"
        cur.execute(q, params)
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"cards": [ttk_row(r) for r in rows]})

    # ── GET одна карта ───────────────────────────────────────────────────────
    if method == "GET" and action == "get":
        ttk_id = qs.get("id")
        if not ttk_id: conn.close(); return resp({"error": "id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT {SELECT_COLS} FROM {S}.tech_cards WHERE id=%s", (ttk_id,))
        r = cur.fetchone(); cur.close(); conn.close()
        if not r: return resp({"error": "Не найдено"}, 404)
        return resp({"card": ttk_row(r)})

    # ── GET категории ────────────────────────────────────────────────────────
    if method == "GET" and action == "categories":
        cur = conn.cursor()
        cur.execute(f"SELECT DISTINCT category FROM {S}.tech_cards WHERE is_active=TRUE ORDER BY category")
        cats = [r[0] for r in cur.fetchall()]; cur.close(); conn.close()
        return resp({"categories": cats})

    # ── POST получить presigned URL для загрузки PDF ─────────────────────────
    if method == "POST" and action == "presigned":
        if role not in ("architect", "constructor", "supply", "engineer"):
            conn.close(); return resp({"error": "Нет доступа"}, 403)
        file_name = body.get("file_name", "ttk.pdf")
        safe_name = re.sub(r"[^\w.\-]", "_", file_name)
        key = f"ttk_uploads/{safe_name}"
        s3 = s3c()
        presigned = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": "files", "Key": key},
            ExpiresIn=600
        )
        conn.close()
        return resp({"ok": True, "presigned_url": presigned, "s3_key": key, "cdn_url": cdn_url(key)})

    # ── POST загрузить и распознать PDF ──────────────────────────────────────
    if method == "POST" and action == "upload_parse":
        if role not in ("architect", "constructor", "supply", "engineer"):
            conn.close(); return resp({"error": "Нет доступа"}, 403)
        s3_key = body.get("s3_key", "")
        file_name = body.get("file_name", "ttk.pdf")
        if not s3_key:
            conn.close(); return resp({"error": "s3_key обязателен"}, 400)

        # Читаем файл из S3
        try:
            s3 = s3c()
            obj = s3.get_object(Bucket="files", Key=s3_key)
            file_bytes = obj["Body"].read()
        except Exception as e:
            conn.close(); return resp({"error": f"Не удалось прочитать файл: {e}"}, 500)

        ext = file_name.rsplit(".", 1)[-1].lower()
        extracted_text = ""
        mode = "text"

        if ext == "pdf":
            extracted_text = extract_text_from_pdf(file_bytes)
            if len(extracted_text) < 200:
                # Скан — OCR
                mode = "ocr"
                images = extract_images_from_pdf(file_bytes)
                print(f"[ttk-api] scan detected, {len(images)} images, running OCR")
                extracted_text = ocr_pdf_images(images)
        elif ext in ("txt",):
            extracted_text = file_bytes.decode("utf-8", errors="ignore")

        print(f"[ttk-api] extracted {len(extracted_text)} chars, mode={mode}")

        if not extracted_text.strip():
            conn.close()
            return resp({"error": "Не удалось извлечь текст из файла. Проверьте что файл не повреждён.", "mode": mode}, 400)

        # AI-разбор
        try:
            parsed = ai_parse_ttk(extracted_text)
        except Exception as e:
            conn.close()
            return resp({"error": f"Ошибка AI-разбора: {e}"}, 500)

        if not parsed:
            conn.close()
            return resp({"error": "AI не смог распознать структуру ТТК. Попробуйте другой файл."}, 400)

        conn.close()
        return resp({
            "ok": True,
            "parsed": parsed,
            "source_text": extracted_text[:5000],
            "mode": mode,
            "file_url": cdn_url(s3_key),
            "file_name": file_name,
        })

    # ── POST сохранить ТТК ───────────────────────────────────────────────────
    if method == "POST" and action == "save":
        if role not in ("architect", "constructor", "supply", "engineer"):
            conn.close(); return resp({"error": "Нет доступа"}, 403)
        d = body
        cur = conn.cursor()
        cur.execute(
            f"""INSERT INTO {S}.tech_cards
            (title, category, work_type, description, tags, materials, resources,
             storage_conditions, acceptance_conditions, content, file_url, file_name,
             parse_status, source_text, created_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (
                d.get("title", ""), d.get("category", "Прочее"), d.get("work_type", ""),
                d.get("description", ""), d.get("tags", []),
                json.dumps(d.get("materials", []), ensure_ascii=False),
                json.dumps(d.get("resources", []), ensure_ascii=False),
                d.get("storage_conditions", ""), d.get("acceptance_conditions", ""),
                json.dumps(d.get("content", []), ensure_ascii=False),
                d.get("file_url", ""), d.get("file_name", ""),
                d.get("parse_status", "ai"), d.get("source_text", ""),
                staff["id"]
            )
        )
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True, "id": new_id})

    # ── PUT обновить ТТК ─────────────────────────────────────────────────────
    if method == "PUT" and action == "update":
        if role not in ("architect", "constructor", "supply", "engineer"):
            conn.close(); return resp({"error": "Нет доступа"}, 403)
        ttk_id = body.get("id")
        if not ttk_id: conn.close(); return resp({"error": "id обязателен"}, 400)
        d = body
        cur = conn.cursor()
        cur.execute(
            f"""UPDATE {S}.tech_cards SET
            title=%s, category=%s, work_type=%s, description=%s, tags=%s,
            materials=%s, resources=%s, storage_conditions=%s, acceptance_conditions=%s,
            content=%s, updated_at=NOW()
            WHERE id=%s""",
            (
                d.get("title"), d.get("category"), d.get("work_type"), d.get("description"),
                d.get("tags", []),
                json.dumps(d.get("materials", []), ensure_ascii=False),
                json.dumps(d.get("resources", []), ensure_ascii=False),
                d.get("storage_conditions", ""), d.get("acceptance_conditions", ""),
                json.dumps(d.get("content", []), ensure_ascii=False),
                ttk_id
            )
        )
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True})

    # ── DELETE удалить ТТК ───────────────────────────────────────────────────
    if method == "DELETE" and action == "delete":
        if role not in ("architect", "constructor"):
            conn.close(); return resp({"error": "Нет доступа"}, 403)
        ttk_id = qs.get("id")
        if not ttk_id: conn.close(); return resp({"error": "id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"UPDATE {S}.tech_cards SET is_active=FALSE WHERE id=%s", (ttk_id,))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True})

    # ── POST AI-подбор ТТК для проекта ───────────────────────────────────────
    if method == "POST" and action == "match_project":
        params_in = body.get("params", {})
        roof_type = params_in.get("roof_type", "")
        wall_type = params_in.get("wall_type", "")
        foundation_type = params_in.get("foundation_type", "")
        area = params_in.get("area", 0)

        cur = conn.cursor()
        cur.execute(
            f"SELECT {SELECT_COLS} FROM {S}.tech_cards WHERE is_active=TRUE ORDER BY category, title"
        )
        all_cards = [ttk_row(r) for r in cur.fetchall()]
        cur.close()

        if not all_cards:
            conn.close(); return resp({"cards": [], "reply": "Справочник ТТК пуст."})

        api_key = os.environ.get("DEEPSEEK_API_KEY", "")
        if not api_key:
            conn.close(); return resp({"cards": [], "reply": "DeepSeek не настроен."})

        catalog = "\n".join(
            f"{i+1}. [{c['category']}] {c['title']} (теги: {', '.join(c['tags'][:5])})"
            for i, c in enumerate(all_cards)
        )
        prompt = f"""Для строительного проекта дома подбери подходящие технологические карты из справочника.

Параметры проекта:
- Тип кровли: {roof_type or 'не указан'}
- Тип стен: {wall_type or 'не указан'}
- Тип фундамента: {foundation_type or 'не указан'}
- Площадь: {area or 'не указана'} м²

Справочник ТТК:
{catalog}

Выбери ВСЕ подходящие карты. Верни JSON:
{{"reply": "краткий комментарий", "indices": [1, 3, 5]}}"""

        data = json.dumps({
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2, "max_tokens": 800,
        }, ensure_ascii=False).encode()
        req = urllib.request.Request(
            "https://api.deepseek.com/v1/chat/completions", data=data,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                result = json.loads(r.read())
            content = result["choices"][0]["message"]["content"].strip()
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                ai_res = json.loads(match.group())
                indices = [i - 1 for i in ai_res.get("indices", []) if 1 <= i <= len(all_cards)]
                matched = [all_cards[i] for i in indices]
                conn.close()
                return resp({"cards": matched, "reply": ai_res.get("reply", "")})
        except Exception as e:
            print(f"[ttk-api] match error: {e}")

        conn.close()
        return resp({"cards": [], "reply": "Не удалось подобрать карты."})

    conn.close()
    return resp({"error": "Not found"}, 404)