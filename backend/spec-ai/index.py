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

def extract_text_from_pdf_native(file_data: bytes) -> str:
    """Извлекает встроенный текст из PDF через pdfminer (только для текстовых PDF, быстро)"""
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract
        from pdfminer.layout import LAParams
        import io, signal

        def _timeout(signum, frame):
            raise TimeoutError("pdfminer timeout")

        signal.signal(signal.SIGALRM, _timeout)
        signal.alarm(8)  # 8 секунд максимум
        try:
            laparams = LAParams(line_margin=0.5, word_margin=0.1)
            text = pdfminer_extract(io.BytesIO(file_data), laparams=laparams)
        finally:
            signal.alarm(0)

        if text and len(text.strip()) > 50:
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            result = "\n".join(lines)
            print(f"[spec-ai] pdfminer extracted {len(result)} chars")
            return result
    except Exception as e:
        print(f"[spec-ai] pdfminer: {e}")
    return ""

def extract_jpegs_from_pdf(file_data: bytes, max_images: int = 5) -> list:
    """Извлекает JPEG-изображения из PDF (для скан-документов)"""
    images = []
    pos = 0
    while pos < len(file_data) - 4 and len(images) < max_images:
        idx = file_data.find(b'\xff\xd8\xff', pos)
        if idx == -1: break
        end = file_data.find(b'\xff\xd9', idx + 2)
        if end != -1 and end - idx > 10000:  # минимум 10КБ — реальная страница
            images.append(file_data[idx:end+2])
        pos = idx + 3
    return images

def ocr_image_via_ocrspace(img_bytes: bytes) -> str:
    """OCR одного изображения через OCR.space"""
    ocr_key = os.environ.get("OCR_SPACE_API_KEY", "")
    if not ocr_key: return ""
    try:
        b64 = base64.b64encode(img_bytes).decode()
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
        with urllib.request.urlopen(req, timeout=25) as r:
            result = json.loads(r.read())
        parsed = result.get("ParsedResults", [])
        return parsed[0].get("ParsedText", "") if parsed else ""
    except Exception as e:
        print(f"[spec-ai] ocr_image error: {e}")
        return ""

def ocr_pdf_via_ocrspace(file_data: bytes) -> str:
    """OCR PDF-скана: извлекаем JPEG страницы и распознаём по одной"""
    ocr_key = os.environ.get("OCR_SPACE_API_KEY", "")
    if not ocr_key:
        print("[spec-ai] OCR_SPACE_API_KEY не настроен")
        return ""

    # Если файл маленький (<4МБ) — шлём целиком как PDF
    if len(file_data) < 4 * 1024 * 1024:
        try:
            b64 = base64.b64encode(file_data).decode()
            payload = urllib.parse.urlencode({
                "base64Image": f"data:application/pdf;base64,{b64}",
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
            with urllib.request.urlopen(req, timeout=25) as r:
                result = json.loads(r.read())
            parsed = result.get("ParsedResults", [])
            texts = [p.get("ParsedText", "") for p in parsed if p.get("ParsedText")]
            combined = "\n".join(texts)
            print(f"[spec-ai] OCR.space (pdf) extracted {len(combined)} chars from {len(parsed)} pages")
            return combined
        except Exception as e:
            print(f"[spec-ai] ocr_pdf error: {e}")

    # Большой файл — извлекаем JPEG страницы и OCR по одной (до 8 страниц)
    print(f"[spec-ai] Large PDF ({len(file_data)//1024}КБ), extracting JPEGs...")
    images = extract_jpegs_from_pdf(file_data, max_images=8)
    if not images:
        print("[spec-ai] No JPEG pages found in PDF")
        return ""
    print(f"[spec-ai] Found {len(images)} JPEG pages, running OCR...")
    texts = []
    for i, img_bytes in enumerate(images):
        text = ocr_image_via_ocrspace(img_bytes)
        if text.strip():
            texts.append(f"--- Страница {i+1} ---\n{text}")
        print(f"[spec-ai] OCR page {i+1}: {len(text)} chars")
    combined = "\n".join(texts)
    print(f"[spec-ai] Total OCR: {len(combined)} chars from {len(images)} pages")
    return combined

def extract_text_from_file(file_data: bytes, file_name: str) -> tuple:
    """Возвращает (text, is_scan) — text для всех типов, is_scan=True если скан"""
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if ext == "pdf":
        # Сначала пробуем нативный текст (быстро)
        text = extract_text_from_pdf_native(file_data)
        if len(text) >= 200:
            return (text, [])
        # Если текста нет — это скан, пробуем OCR
        print(f"[spec-ai] PDF has no native text, trying OCR...")
        ocr_text = ocr_pdf_via_ocrspace(file_data)
        return (ocr_text, [])
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
        print(f"[spec-ai] saved file={file_name} size={len(file_bytes)} key={final_key}")

        is_pdf = file_name.lower().endswith(".pdf")
        is_scan = False
        pages_count = 0
        pages_data_init = []
        doc_info = {"category": "other", "summary": ""}

        if is_pdf:
            # Быстрая попытка нативного текста (таймаут 8 сек)
            extracted_text = extract_text_from_pdf_native(file_bytes)
            print(f"[spec-ai] native text={len(extracted_text)} chars")
            if len(extracted_text) >= 200:
                # Текстовый PDF — сохраняем страницы, классифицируем
                pages_list = split_text_into_pages(extracted_text)
                pages_count = len(pages_list)
                pages_data_init = [
                    {"page": i+1, "text": p, "text_preview": p[:400], "items": [], "items_count": 0, "analyzed": False, "needs_ocr": False}
                    for i, p in enumerate(pages_list)
                ]
                if os.environ.get("GIGACHAT_AUTH_KEY"):
                    try: doc_info = classify_document(extracted_text)
                    except Exception as e: print(f"[spec-ai] classify: {e}")
            else:
                # Скан — считаем JPEG страницы для информации
                is_scan = True
                jpeg_count = len(extract_jpegs_from_pdf(file_bytes, max_images=100))
                pages_count = max(jpeg_count, 1)
                print(f"[spec-ai] scan detected, ~{pages_count} pages (JPEGs)")
                pages_data_init = [{"page": 1, "text": "", "text_preview": "", "items": [], "items_count": 0, "analyzed": False, "needs_ocr": True}]
                pages_count = 0  # 0 = скан, фронт покажет кнопку OCR
        else:
            # Excel/CSV
            extracted_text, _ = extract_text_from_file(file_bytes, file_name)
            if extracted_text:
                pages_list = split_text_into_pages(extracted_text)
                pages_count = len(pages_list)
                pages_data_init = [
                    {"page": i+1, "text": p, "text_preview": p[:400], "items": [], "items_count": 0, "analyzed": False, "needs_ocr": False}
                    for i, p in enumerate(pages_list)
                ]
                if os.environ.get("GIGACHAT_AUTH_KEY"):
                    try: doc_info = classify_document(extracted_text)
                    except Exception as e: print(f"[spec-ai] classify: {e}")

        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {S}.spec_uploads (project_id,file_name,file_url,status,uploaded_by,doc_category,page_count,pages_data) "
            f"VALUES (%s,%s,%s,'uploaded',%s,%s,%s,%s) RETURNING id",
            (project_id, file_name, url, staff["id"],
             doc_info.get("category","other"), pages_count if not is_scan else None,
             json.dumps(pages_data_init, ensure_ascii=False)))
        db_upload_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        print(f"[spec-ai] saved upload_id={db_upload_id} pages={pages_count} is_scan={is_scan}")

        return resp({
            "ok": True,
            "done": True,
            "upload_id": db_upload_id,
            "file_url": url,
            "status": "uploaded",
            "is_scan": is_scan,
            "doc_category": doc_info.get("category", "other"),
            "doc_category_label": DOC_CATEGORIES.get(doc_info.get("category","other"), "Прочее"),
            "doc_summary": doc_info.get("summary", ""),
            "pages_count": pages_count,
            "s3_key": final_key,
        })

    # ── ШАГ 2: Анализ одной страницы — текст берём из pages_data в БД ─────────
    if method == "POST" and action == "analyze_page":
        upload_id = body.get("upload_id")
        page_num = int(body.get("page", 1))

        if not upload_id:
            conn.close(); return resp({"error": "upload_id обязателен"}, 400)

        cur = conn.cursor()
        cur.execute(f"SELECT pages_data FROM {S}.spec_uploads WHERE id=%s", (upload_id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close(); return resp({"error": "Загрузка не найдена"}, 404)

        pages_data = row[0] or []
        page_entry = next((p for p in pages_data if p.get("page") == page_num), None)

        items = []
        page_text = page_entry.get("text", page_entry.get("text_preview", "")) if page_entry else ""
        needs_ocr = (page_entry or {}).get("needs_ocr", False)

        # Для скан-документов — делаем OCR при первом обращении к странице
        if needs_ocr and not page_text.strip():
            cur2 = conn.cursor()
            cur2.execute(f"SELECT file_url FROM {S}.spec_uploads WHERE id=%s", (upload_id,))
            frow = cur2.fetchone(); cur2.close()
            if frow:
                s3_key_match = re.search(r'/bucket/(.+)$', frow[0])
                if s3_key_match:
                    try:
                        s3c = s3()
                        obj = s3c.get_object(Bucket="files", Key=s3_key_match.group(1))
                        file_bytes = obj["Body"].read()
                        print(f"[spec-ai] running OCR on scan, size={len(file_bytes)}")
                        page_text = ocr_pdf_via_ocrspace(file_bytes)
                        print(f"[spec-ai] OCR result: {len(page_text)} chars")
                        # Сохраняем OCR-текст в pages_data чтобы не делать повторно
                        pages_data = [
                            {**p, "text": page_text, "text_preview": page_text[:400], "needs_ocr": False}
                            if p.get("page") == page_num else p
                            for p in pages_data
                        ]
                    except Exception as e:
                        print(f"[spec-ai] OCR error: {e}")

        if page_text.strip() and os.environ.get("GIGACHAT_AUTH_KEY"):
            cur.execute(f"SELECT name,unit,price_per_unit,category FROM {S}.materials WHERE is_active=TRUE ORDER BY category,name LIMIT 100")
            mats = cur.fetchall()
            mat_ctx = "\n".join([f"{r[3]}|{r[0]}|{r[1]}|{r[2]}₽" for r in mats])
            # Добавляем нормативный контекст
            cur.execute(f"SELECT title,doc_number,content FROM {S}.norm_documents WHERE is_active=TRUE ORDER BY created_at DESC LIMIT 10")
            norms = cur.fetchall()
            norm_ctx = "\n\n".join([f"[{r[1] or r[0]}]: {r[2][:300]}" for r in norms if r[2]]) if norms else ""
            try:
                norm_section = f"\n\nНормативная база:\n{norm_ctx}" if norm_ctx else ""
                prompt = f"{SPEC_PROMPT}{norm_section}\n\nМатериалы:\n{mat_ctx}\n\nСтраница {page_num}:\n{page_text[:6000]}"
                content = gigachat_chat([{"role": "user", "content": prompt}], temperature=0.1, max_tokens=2000)
                items = _parse_items(content)
                print(f"[spec-ai] page {page_num}: {len(items)} items")
            except Exception as e:
                print(f"[spec-ai] page {page_num} error: {e}")

        # Обновляем pages_data — сохраняем items, помечаем analyzed=True
        updated = []
        for p in pages_data:
            if p.get("page") == page_num:
                updated.append({**p, "items": items, "items_count": len(items), "analyzed": True})
            else:
                updated.append(p)
        if not any(p.get("page") == page_num for p in pages_data):
            updated.append({"page": page_num, "text_preview": page_text[:400], "items": items, "items_count": len(items), "analyzed": True})
        updated.sort(key=lambda x: x.get("page", 0))
        pages_data = updated

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

    # ── Удалить загрузку ─────────────────────────────────────────────────────
    if method == "POST" and action == "delete_upload":
        upload_id = body.get("upload_id")
        if not upload_id:
            conn.close(); return resp({"error": "upload_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT file_url FROM {S}.spec_uploads WHERE id=%s", (upload_id,))
        row = cur.fetchone()
        if row:
            # Удаляем файл из S3
            try:
                s3_key_match = re.search(r'/bucket/(.+)$', row[0])
                if s3_key_match:
                    s3().delete_object(Bucket="files", Key=s3_key_match.group(1))
            except Exception as e:
                print(f"[spec-ai] s3 delete error: {e}")
            cur.execute(f"DELETE FROM {S}.spec_uploads WHERE id=%s", (upload_id,))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True})

    # ── Нормативные документы: список ────────────────────────────────────────
    if method == "GET" and action == "norms_list":
        cur = conn.cursor()
        cur.execute(
            f"SELECT id,title,doc_type,doc_number,content,file_url,file_name,is_active,created_at "
            f"FROM {S}.norm_documents WHERE is_active=TRUE ORDER BY doc_type,title")
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"norms": [{
            "id": r[0], "title": r[1], "doc_type": r[2], "doc_number": r[3],
            "content": r[4][:500] if r[4] else "", "file_url": r[5], "file_name": r[6],
            "is_active": r[7], "created_at": str(r[8]),
        } for r in rows]})

    # ── Нормативные документы: добавить текст/выдержку ───────────────────────
    if method == "POST" and action == "norm_add":
        title = body.get("title", "").strip()
        doc_type = body.get("doc_type", "norm")
        doc_number = body.get("doc_number", "").strip()
        content = body.get("content", "").strip()
        if not title:
            conn.close(); return resp({"error": "title обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {S}.norm_documents (title,doc_type,doc_number,content,uploaded_by) "
            f"VALUES (%s,%s,%s,%s,%s) RETURNING id",
            (title, doc_type, doc_number, content, staff["id"]))
        nid = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True, "id": nid})

    # ── Нормативные документы: загрузить PDF ─────────────────────────────────
    if method == "POST" and action == "norm_upload_chunk":
        title = body.get("title", "").strip()
        doc_type = body.get("doc_type", "norm")
        doc_number = body.get("doc_number", "").strip()
        file_name = body.get("file_name", "norm.pdf")
        chunk_b64 = body.get("chunk", "")
        chunk_index = int(body.get("chunk_index", 0))
        total_chunks = int(body.get("total_chunks", 1))
        upload_sess = body.get("upload_id", "")

        if not chunk_b64:
            conn.close(); return resp({"error": "chunk обязателен"}, 400)

        import mimetypes as _mt2
        safe_name = re.sub(r"[^\w.\-]", "_", file_name)
        final_key = f"norms/{safe_name}"
        s3c = s3()

        try:
            if total_chunks == 1:
                file_bytes = base64.b64decode(chunk_b64)
                s3c.put_object(Bucket="files", Key=final_key, Body=file_bytes,
                               ContentType=_mt2.guess_type(safe_name)[0] or "application/octet-stream")
            else:
                if not upload_sess:
                    upload_sess = str(uuid.uuid4())
                s3c.put_object(Bucket="files", Key=f"_tmp/{upload_sess}/chunk_{chunk_index:05d}",
                               Body=base64.b64decode(chunk_b64), ContentType="application/octet-stream")
                if chunk_index < total_chunks - 1:
                    conn.close()
                    return resp({"ok": True, "done": False, "upload_id": upload_sess})
                all_bytes = b""
                for i in range(total_chunks):
                    obj = s3c.get_object(Bucket="files", Key=f"_tmp/{upload_sess}/chunk_{i:05d}")
                    all_bytes += obj["Body"].read()
                file_bytes = all_bytes
                s3c.put_object(Bucket="files", Key=final_key, Body=file_bytes,
                               ContentType=_mt2.guess_type(safe_name)[0] or "application/octet-stream")
                for i in range(total_chunks):
                    try: s3c.delete_object(Bucket="files", Key=f"_tmp/{upload_sess}/chunk_{i:05d}")
                    except: pass
        except Exception as e:
            conn.close(); return resp({"error": f"S3 ошибка: {e}"}, 500)

        norm_url = cdn_url(final_key)
        # Извлекаем текст для поиска
        extracted = extract_text_from_pdf_native(file_bytes) if file_name.lower().endswith(".pdf") else ""
        content_snippet = extracted[:5000] if extracted else ""

        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {S}.norm_documents (title,doc_type,doc_number,content,file_url,file_name,uploaded_by) "
            f"VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (title or file_name, doc_type, doc_number, content_snippet, norm_url, file_name, staff["id"]))
        nid = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True, "done": True, "id": nid, "file_url": norm_url})

    # ── Нормативные документы: удалить ───────────────────────────────────────
    if method == "POST" and action == "norm_delete":
        nid = body.get("norm_id")
        if not nid:
            conn.close(); return resp({"error": "norm_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"UPDATE {S}.norm_documents SET is_active=FALSE WHERE id=%s", (nid,))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True})

    conn.close()
    return resp({"error": "Not found"}, 404)