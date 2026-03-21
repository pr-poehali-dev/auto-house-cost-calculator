"""
AI-разбор проектной документации по ПП РФ №87.
Загрузка чанками, постраничный анализ отдельными запросами (обход таймаута).
"""
import json, os, base64, re, uuid, ssl
import psycopg2
import boto3
import urllib.request
import urllib.parse
import urllib.error

S = "t_p78845984_auto_house_cost_calc"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

# Разделы проектной документации по ПП РФ №87
DOC_CATEGORIES = {
    # Текстовые разделы
    "explanatory_note":   "Пояснительная записка (ПЗ)",
    "construction_org":   "Проект организации строительства (ПОС)",
    "demolition_org":     "Проект организации сноса (ПОД)",
    "environment":        "Перечень мероприятий по охране ОС",
    "fire_safety":        "Мероприятия по пожарной безопасности",
    "accessibility":      "Обеспечение доступности МГН",
    "energy_efficiency":  "Энергоэффективность",
    "smeta":              "Смета на строительство",
    # Графические разделы
    "scheme_layout":      "Схема планировочной организации (СПОЗУ)",
    "architecture":       "Архитектурные решения (АР)",
    "construction":       "Конструктивные решения (КР/КЖ/КМ)",
    "engineering":        "Инженерные системы (ИОС/ВК/ОВ/ЭО)",
    "drawing":            "Чертёж / схема",
    # Аналитические разделы
    "specification":      "Спецификация материалов и изделий",
    "work_statement":     "Ведомость объёмов работ (ВОР)",
    "estimate":           "Смета / расчёт стоимости",
    "other":              "Прочее",
}

def db(): return psycopg2.connect(os.environ["DATABASE_URL"])
def resp(data, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}

def s3():
    return boto3.client("s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"])

def cdn_url(key):
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

def get_staff(conn, token):
    cur = conn.cursor()
    cur.execute(
        f"SELECT s.id,s.full_name,s.role_code FROM {S}.sessions ss "
        f"JOIN {S}.staff s ON s.id=ss.staff_id "
        f"WHERE ss.token=%s AND ss.expires_at>NOW()", (token,))
    r = cur.fetchone(); cur.close()
    return {"id":r[0],"full_name":r[1],"role_code":r[2]} if r else None

SPEC_PROMPT = """Ты — ассистент строительной компании. Перед тобой фрагмент строительного документа.

Извлеки ВСЕ позиции работ и материалов. Для каждой позиции:
- section: раздел ("Фундамент", "Стены", "Кровля", "Отделка", "Электрика", "Сантехника", "ОВиК" и т.д.)
- name: название работы или материала
- unit: единица (м², м³, пм, шт, т, кг, л, компл)
- qty: количество (число, 0 если не указано)
- price_per_unit: цена за единицу в рублях (0 если нет)
- note: примечание, марка, артикул

Если позиций нет — верни [].
Верни ТОЛЬКО JSON-массив:
[{"section":"...","name":"...","unit":"...","qty":0,"price_per_unit":0,"note":"..."}]"""

CLASSIFY_PROMPT = """Ты — эксперт проектной документации (ПП РФ №87). Определи тип документа.

Возможные типы:
- specification: Спецификация материалов/изделий (таблицы с артикулами, кол-вом)
- work_statement: Ведомость объёмов работ (таблицы работ с ед.изм. и кол-вом)
- estimate: Смета/расчёт стоимости (таблицы с ценами, суммами)
- explanatory_note: Пояснительная записка (ПЗ) — описательный текст, технические решения
- construction_org: Проект организации строительства (ПОС) — стройгенплан, этапы
- environment: Мероприятия по охране окружающей среды
- fire_safety: Мероприятия по пожарной безопасности
- accessibility: Обеспечение доступности МГН
- energy_efficiency: Энергоэффективность и энергосбережение
- smeta: Сводный сметный расчёт
- scheme_layout: Схема планировочной организации земельного участка (СПОЗУ)
- architecture: Архитектурные решения (АР) — фасады, планы, разрезы
- construction: Конструктивные решения (КР/КЖ/КМ) — узлы, армирование
- engineering: Инженерные системы (ИОС/ВК/ОВ/ЭО) — трубопроводы, кабели
- drawing: Любой чертёж или схема
- other: Прочее

Также дай краткое резюме (1 предложение) содержания.

Верни ТОЛЬКО JSON:
{"category": "...", "summary": "..."}"""

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
    with urllib.request.urlopen(req, timeout=25, context=ctx) as r:
        return json.loads(r.read())["access_token"]

def gigachat_chat(messages: list, temperature: float = 0.1, max_tokens: int = 2000) -> str:
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
    with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
        result = json.loads(r.read())
    return result["choices"][0]["message"]["content"].strip()

def _parse_items(content: str) -> list:
    match = re.search(r'\[.*\]', content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except:
            pass
    return []

def classify_document(text: str) -> dict:
    if not text.strip():
        return {"category": "other", "summary": ""}
    try:
        prompt = f"{CLASSIFY_PROMPT}\n\nТекст документа:\n{text[:2000]}"
        content = gigachat_chat([{"role": "user", "content": prompt}], temperature=0.1, max_tokens=200)
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            result = json.loads(match.group())
            if result.get("category") not in DOC_CATEGORIES:
                result["category"] = "other"
            return result
    except Exception as e:
        print(f"[spec-ai] classify error: {e}")
    return {"category": "other", "summary": ""}

def extract_text_from_pdf(file_data: bytes) -> str:
    try:
        text = file_data.decode("latin-1", errors="ignore")
        chunks = re.findall(r'\(([^)]{1,200})\)', text)
        readable = []
        for chunk in chunks:
            cleaned = chunk.replace("\\n", " ").replace("\\r", " ").replace("\\t", " ").strip()
            if len(cleaned) > 2 and any(c.isalpha() for c in cleaned):
                readable.append(cleaned)
        return " | ".join(readable[:1200])
    except:
        return ""

def extract_images_from_pdf(file_data: bytes) -> list:
    try:
        images = []
        pos = 0
        while pos < len(file_data) - 4:
            idx = file_data.find(b'\xff\xd8\xff', pos)
            if idx == -1: break
            end = file_data.find(b'\xff\xd9', idx + 2)
            if end != -1 and end - idx > 5000:
                images.append(base64.b64encode(file_data[idx:end+2]).decode())
                if len(images) >= 4: break
            pos = idx + 3
        return images
    except:
        return []

def extract_text_from_file(file_data: bytes, file_name: str) -> tuple:
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if ext == "pdf":
        text = extract_text_from_pdf(file_data)
        if len(text) < 200:
            return ("", extract_images_from_pdf(file_data))
        return (text, [])
    elif ext in ("xlsx", "xls", "csv"):
        if ext == "csv":
            try: return (file_data.decode("utf-8", errors="ignore")[:12000], [])
            except: return (file_data.decode("cp1251", errors="ignore")[:12000], [])
        try:
            import zipfile, io
            with zipfile.ZipFile(io.BytesIO(file_data)) as z:
                strings = []
                if "xl/sharedStrings.xml" in z.namelist():
                    ss_xml = z.read("xl/sharedStrings.xml").decode("utf-8", "ignore")
                    strings = re.findall(r'<t[^>]*>([^<]+)</t>', ss_xml)
                sheet_files = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet")]
                if sheet_files:
                    sheet_xml = z.read(sheet_files[0]).decode("utf-8", "ignore")
                    str_refs = re.findall(r't="s"[^>]*><v>(\d+)</v>', sheet_xml)
                    row_data = [strings[int(r)] for r in str_refs if int(r) < len(strings)]
                    return (" | ".join(row_data[:600]), [])
        except: pass
        return ("", [])
    return ("", [])

def split_text_into_pages(text: str, page_size: int = 3000) -> list:
    """Делит текст на страницы ~3000 символов"""
    pages = [text[i:i+page_size] for i in range(0, len(text), page_size)]
    return [p.strip() for p in pages if p.strip()]

def ocr_images_to_text(images_b64: list) -> str:
    ocr_key = os.environ.get("OCR_SPACE_API_KEY", "")
    if not ocr_key or not images_b64:
        return ""
    texts = []
    for b64 in images_b64[:4]:
        try:
            payload = urllib.parse.urlencode({
                "base64Image": f"data:image/jpeg;base64,{b64}",
                "language": "rus", "isOverlayRequired": "false", "OCREngine": "2", "scale": "true",
            }).encode()
            req = urllib.request.Request("https://api.ocr.space/parse/image", data=payload,
                headers={"apikey": ocr_key, "Content-Type": "application/x-www-form-urlencoded"}, method="POST")
            with urllib.request.urlopen(req, timeout=30) as r:
                result = json.loads(r.read())
            parsed = result.get("ParsedResults", [])
            if parsed: texts.append(parsed[0].get("ParsedText", ""))
        except Exception as e:
            print(f"[spec-ai] OCR error: {e}")
    return "\n".join(texts)

def handler(event: dict, context) -> dict:
    """Загрузка и анализ проектной документации по ПП РФ №87"""
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
    if staff["role_code"] not in ("architect","constructor","supply","engineer","admin","manager"):
        conn.close(); return resp({"error": "Нет доступа"}, 403)

    # ── ШАГ 1: Загрузка чанка ────────────────────────────────────────────────
    if method == "POST" and action == "upload_doc_chunk":
        project_id = body.get("project_id")
        file_name = body.get("file_name", "doc.pdf")
        chunk_b64 = body.get("chunk", "")
        chunk_index = int(body.get("chunk_index", 0))
        total_chunks = int(body.get("total_chunks", 1))
        upload_sess = body.get("upload_id", "")

        if not chunk_b64:
            conn.close(); return resp({"error": "chunk обязателен"}, 400)

        import mimetypes as _mt
        safe_name = re.sub(r"[^\w.\-]", "_", file_name)
        ct = _mt.guess_type(safe_name)[0] or "application/octet-stream"
        final_key = f"spec_uploads/{project_id or 'noproject'}/{safe_name}"
        s3c = s3()

        try:
            if total_chunks == 1:
                file_bytes = base64.b64decode(chunk_b64)
                s3c.put_object(Bucket="files", Key=final_key, Body=file_bytes, ContentType=ct)
            else:
                if not upload_sess:
                    upload_sess = str(uuid.uuid4())
                chunk_key = f"_tmp/{upload_sess}/chunk_{chunk_index:05d}"
                s3c.put_object(Bucket="files", Key=chunk_key, Body=base64.b64decode(chunk_b64), ContentType="application/octet-stream")

                if chunk_index < total_chunks - 1:
                    conn.close()
                    return resp({"ok": True, "done": False, "upload_id": upload_sess})

                # Последний чанк — собираем
                all_bytes = b""
                for i in range(total_chunks):
                    obj = s3c.get_object(Bucket="files", Key=f"_tmp/{upload_sess}/chunk_{i:05d}")
                    all_bytes += obj["Body"].read()
                file_bytes = all_bytes
                s3c.put_object(Bucket="files", Key=final_key, Body=file_bytes, ContentType=ct)
                for i in range(total_chunks):
                    try: s3c.delete_object(Bucket="files", Key=f"_tmp/{upload_sess}/chunk_{i:05d}")
                    except: pass
        except Exception as e:
            conn.close(); return resp({"error": f"S3 ошибка: {e}"}, 500)

        url = cdn_url(final_key)

        # Извлекаем текст и сразу классифицируем
        extracted_text, images_b64 = extract_text_from_file(file_bytes, file_name)
        pages = split_text_into_pages(extracted_text) if extracted_text else []

        doc_info = {"category": "other", "summary": ""}
        if extracted_text and os.environ.get("GIGACHAT_AUTH_KEY"):
            try: doc_info = classify_document(extracted_text)
            except Exception as e: print(f"[spec-ai] classify: {e}")
        elif images_b64:
            ocr_txt = ocr_images_to_text(images_b64[:1])
            if ocr_txt and os.environ.get("GIGACHAT_AUTH_KEY"):
                try: doc_info = classify_document(ocr_txt)
                except: pass
            pages = [ocr_txt] if ocr_txt else []

        # Сохраняем в БД — пустые pages_data, анализ будет по запросу
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {S}.spec_uploads (project_id,file_name,file_url,status,uploaded_by,doc_category,page_count) "
            f"VALUES (%s,%s,%s,'uploaded',%s,%s,%s) RETURNING id",
            (project_id, file_name, url, staff["id"], doc_info.get("category","other"), len(pages)))
        db_upload_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()

        return resp({
            "ok": True,
            "done": True,
            "upload_id": db_upload_id,
            "file_url": url,
            "status": "uploaded",
            "doc_category": doc_info.get("category", "other"),
            "doc_category_label": DOC_CATEGORIES.get(doc_info.get("category","other"), "Прочее"),
            "doc_summary": doc_info.get("summary", ""),
            "pages_count": len(pages),
            "s3_key": final_key,
        })

    # ── ШАГ 2: Анализ одной страницы (вызывается фронтом в цикле) ────────────
    if method == "POST" and action == "analyze_page":
        upload_id = body.get("upload_id")
        page_num = int(body.get("page", 1))
        s3_key = body.get("s3_key", "")

        if not upload_id or not s3_key:
            conn.close(); return resp({"error": "upload_id и s3_key обязательны"}, 400)

        try:
            s3c = s3()
            obj = s3c.get_object(Bucket="files", Key=s3_key)
            file_bytes = obj["Body"].read()
        except Exception as e:
            conn.close(); return resp({"error": f"Файл не найден: {e}"}, 404)

        file_name_key = s3_key.split("/")[-1]
        extracted_text, images_b64 = extract_text_from_file(file_bytes, file_name_key)

        items = []
        page_text = ""

        if extracted_text:
            pages = split_text_into_pages(extracted_text)
            if page_num <= len(pages):
                page_text = pages[page_num - 1]
                if page_text.strip() and os.environ.get("GIGACHAT_AUTH_KEY"):
                    cur = conn.cursor()
                    cur.execute(f"SELECT name,unit,price_per_unit,category FROM {S}.materials WHERE is_active=TRUE ORDER BY category,name LIMIT 100")
                    mats = cur.fetchall()
                    cur.close()
                    mat_ctx = "\n".join([f"{r[3]}|{r[0]}|{r[1]}|{r[2]}₽" for r in mats])
                    try:
                        prompt = f"{SPEC_PROMPT}\n\nМатериалы:\n{mat_ctx}\n\nСтраница {page_num}:\n{page_text}"
                        content = gigachat_chat([{"role": "user", "content": prompt}], temperature=0.1, max_tokens=2000)
                        items = _parse_items(content)
                    except Exception as e:
                        print(f"[spec-ai] page {page_num} error: {e}")

        # Сохраняем результат страницы в pages_data
        cur = conn.cursor()
        cur.execute(f"SELECT pages_data FROM {S}.spec_uploads WHERE id=%s", (upload_id,))
        row = cur.fetchone()
        pages_data = row[0] if row and row[0] else []

        # Обновляем или добавляем страницу
        page_entry = {"page": page_num, "text_preview": page_text[:400], "items": items, "items_count": len(items)}
        pages_data = [p for p in pages_data if p.get("page") != page_num]
        pages_data.append(page_entry)
        pages_data.sort(key=lambda x: x.get("page", 0))

        cur.execute(
            f"UPDATE {S}.spec_uploads SET pages_data=%s, status='processing' WHERE id=%s",
            (json.dumps(pages_data, ensure_ascii=False), upload_id))
        conn.commit(); cur.close(); conn.close()

        return resp({
            "ok": True,
            "page": page_num,
            "items": items,
            "items_count": len(items),
            "text_preview": page_text[:400],
        })

    # ── ШАГ 3: Завершить анализ — собрать все позиции ────────────────────────
    if method == "POST" and action == "finish_analysis":
        upload_id = body.get("upload_id")
        if not upload_id:
            conn.close(); return resp({"error": "upload_id обязателен"}, 400)

        cur = conn.cursor()
        cur.execute(f"SELECT pages_data FROM {S}.spec_uploads WHERE id=%s", (upload_id,))
        row = cur.fetchone()
        pages_data = row[0] if row and row[0] else []

        all_items = []
        for p in pages_data:
            all_items.extend(p.get("items", []))

        # Дедупликация
        seen = set()
        unique = []
        for item in all_items:
            k = f"{item.get('section','')}|{item.get('name','')}".lower()
            if k not in seen:
                seen.add(k); unique.append(item)

        cur.execute(
            f"UPDATE {S}.spec_uploads SET status='done', ai_result=%s, processed_at=NOW() WHERE id=%s",
            (json.dumps(unique, ensure_ascii=False), upload_id))
        conn.commit(); cur.close(); conn.close()

        return resp({"ok": True, "items": unique, "items_count": len(unique)})

    # ── Список загрузок ───────────────────────────────────────────────────────
    if method == "GET" and action == "list":
        pid = qs.get("project_id")
        cur = conn.cursor()
        q = (f"SELECT su.id,su.file_name,su.file_url,su.status,su.error_msg,"
             f"su.created_at,su.processed_at,s.full_name,su.doc_category,su.page_count "
             f"FROM {S}.spec_uploads su LEFT JOIN {S}.staff s ON s.id=su.uploaded_by WHERE 1=1")
        params = []
        if pid: q += " AND su.project_id=%s"; params.append(pid)
        q += " ORDER BY su.created_at DESC LIMIT 50"
        cur.execute(q, params)
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"uploads": [{
            "id": r[0], "file_name": r[1], "file_url": r[2], "status": r[3],
            "error": r[4], "created_at": str(r[5]), "processed_at": str(r[6]), "by": r[7],
            "doc_category": r[8], "page_count": r[9],
            "doc_category_label": DOC_CATEGORIES.get(r[8] or "other", "Прочее"),
        } for r in rows]})

    # ── Получить данные конкретной загрузки ───────────────────────────────────
    if method == "GET" and action == "get":
        uid = qs.get("upload_id")
        if not uid: conn.close(); return resp({"error": "upload_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"SELECT id,file_name,file_url,status,ai_result,error_msg,created_at,"
            f"doc_category,page_count,pages_data FROM {S}.spec_uploads WHERE id=%s", (uid,))
        r = cur.fetchone(); cur.close(); conn.close()
        if not r: return resp({"error": "Не найдено"}, 404)
        return resp({"upload": {
            "id": r[0], "file_name": r[1], "file_url": r[2], "status": r[3],
            "items": r[4] or [], "error": r[5], "created_at": str(r[6]),
            "doc_category": r[7], "page_count": r[8], "pages": r[9] or [],
            "doc_category_label": DOC_CATEGORIES.get(r[7] or "other", "Прочее"),
        }})

    conn.close()
    return resp({"error": "Not found"}, 404)
