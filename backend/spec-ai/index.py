"""
AI-разбор загруженных спецификаций (PDF/Excel) и заполнение ведомости объёмов работ.
Постраничный анализ документов, автоклассификация по разделам проектной документации.
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

# Разделы проектной документации
DOC_CATEGORIES = {
    "specification": "Спецификация материалов",
    "work_statement": "Ведомость объёмов работ",
    "explanatory_note": "Пояснительная записка",
    "drawing": "Чертёж / схема",
    "estimate": "Смета / расчёт стоимости",
    "other": "Прочее",
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

SPEC_PROMPT = """Ты — ассистент строительной компании. Перед тобой фрагмент строительного документа (страница или раздел).

Извлеки ВСЕ позиции работ и материалов и верни их в виде JSON-массива.

Для каждой позиции:
- section: раздел/категория ("Фундамент", "Стены", "Кровля", "Отделка", "Электрика", "Сантехника" и т.д.)
- name: название работы или материала
- unit: единица измерения (м², м³, пм, шт, т, кг, л, компл)
- qty: количество (число, 0 если не указано)
- price_per_unit: цена за единицу в рублях (0 если не указана)
- note: примечание, марка, артикул

Если позиций нет — верни пустой массив [].
Верни ТОЛЬКО валидный JSON-массив без пояснений:
[{"section":"...","name":"...","unit":"...","qty":0,"price_per_unit":0,"note":"..."}]"""

CLASSIFY_PROMPT = """Ты — эксперт проектной документации. Определи тип документа по его тексту.

Типы документов:
- specification: Спецификация материалов и изделий (таблицы с позициями, артикулами, количеством)
- work_statement: Ведомость объёмов работ (таблицы работ с единицами измерения и количеством)
- estimate: Смета или расчёт стоимости (таблицы с ценами, итоговыми суммами)
- explanatory_note: Пояснительная записка (описательный текст, технические решения, характеристики)
- drawing: Чертёж или схема (текст легенды, штамп, аксонометрия, ссылки на чертежи)
- other: Прочее (если ни одно из выше)

Также дай краткое резюме (1-2 предложения) содержания документа.

Верни ТОЛЬКО JSON без пояснений:
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

def _parse_items(content: str) -> list:
    match = re.search(r'\[.*\]', content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except:
            pass
    return []

def classify_document(text: str) -> dict:
    """Определяет тип документа и даёт краткое резюме через GigaChat"""
    if not text.strip():
        return {"category": "other", "summary": ""}
    try:
        prompt = f"{CLASSIFY_PROMPT}\n\nТекст документа (первые 3000 символов):\n{text[:3000]}"
        content = gigachat_chat([{"role": "user", "content": prompt}], temperature=0.1, max_tokens=300)
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            result = json.loads(match.group())
            if result.get("category") not in DOC_CATEGORIES:
                result["category"] = "other"
            return result
    except Exception as e:
        print(f"[spec-ai] classify error: {e}")
    return {"category": "other", "summary": ""}

def analyze_page_text(page_text: str, page_num: int, materials_context: str) -> list:
    """Анализирует одну страницу текста и возвращает извлечённые позиции"""
    if not page_text.strip() or len(page_text) < 50:
        return []
    prompt = f"{SPEC_PROMPT}\n\nКонтекст материалов:\n{materials_context[:2000]}\n\nСтраница {page_num}:\n{page_text[:8000]}"
    try:
        content = gigachat_chat([{"role": "user", "content": prompt}], temperature=0.1, max_tokens=3000)
        return _parse_items(content)
    except Exception as e:
        print(f"[spec-ai] page {page_num} analyze error: {e}")
        return []

def call_openai_text(text: str, materials_context: str) -> list:
    """Разбор текстовой спецификации через GigaChat"""
    if not os.environ.get("GIGACHAT_AUTH_KEY"):
        return []
    prompt = f"{SPEC_PROMPT}\n\nБаза материалов для сопоставления цен:\n{materials_context}\n\nТекст спецификации:\n{text[:12000]}"
    content = gigachat_chat([{"role": "user", "content": prompt}], temperature=0.1, max_tokens=4000)
    return _parse_items(content)

def ocr_images_to_text(images_b64: list) -> str:
    """OCR через OCR.space — распознаёт текст из base64 JPEG изображений"""
    ocr_key = os.environ.get("OCR_SPACE_API_KEY", "")
    if not ocr_key or not images_b64:
        return ""
    texts = []
    for b64 in images_b64[:6]:
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
            print(f"[spec-ai] OCR error: {e}")
    return "\n".join(texts)

def call_openai_vision(images_b64: list, materials_context: str) -> list:
    """OCR сканированного PDF: сначала OCR.space → потом GigaChat анализирует текст"""
    ocr_text = ocr_images_to_text(images_b64)
    print(f"[spec-ai] OCR extracted {len(ocr_text)} chars")
    if not ocr_text.strip():
        return []
    return call_openai_text(ocr_text, materials_context)

def split_text_into_pages(text: str, page_size: int = 4000) -> list:
    """Делит длинный текст на страницы по разделителям или фиксированному размеру"""
    pages = []
    # Пробуем разбить по естественным разрывам (заголовки, нумерованные разделы)
    parts = re.split(r'\n(?=\d+[\.\)]\s|\s*[А-ЯA-Z][А-ЯA-Z\s]{3,}\n)', text)
    current = ""
    for part in parts:
        if len(current) + len(part) > page_size and current:
            pages.append(current.strip())
            current = part
        else:
            current += "\n" + part
    if current.strip():
        pages.append(current.strip())
    # Если разбивка не дала результатов — делим механически
    if len(pages) <= 1:
        pages = [text[i:i+page_size] for i in range(0, len(text), page_size)]
    return pages

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
        return " | ".join(readable[:1200])
    except:
        return ""

def extract_images_from_pdf(file_data: bytes) -> list:
    """Извлекает изображения страниц из PDF-скана (JPEG/PNG потоки)"""
    try:
        images = []
        pos = 0
        while pos < len(file_data) - 4:
            idx = file_data.find(b'\xff\xd8\xff', pos)
            if idx == -1:
                break
            end = file_data.find(b'\xff\xd9', idx + 2)
            if end != -1 and end - idx > 5000:
                img_bytes = file_data[idx:end + 2]
                images.append(base64.b64encode(img_bytes).decode())
                if len(images) >= 6:
                    break
            pos = idx + 3
        return images
    except:
        return []

def extract_text_from_file(file_data: bytes, file_name: str) -> tuple:
    """Возвращает (text, images_b64) — text для текстовых PDF, images для сканов"""
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""

    if ext == "pdf":
        text = extract_text_from_pdf(file_data)
        if len(text) < 200:
            images = extract_images_from_pdf(file_data)
            return ("", images)
        return (text, [])

    elif ext in ("xlsx", "xls", "csv"):
        if ext == "csv":
            try:
                return (file_data.decode("utf-8", errors="ignore")[:12000], [])
            except:
                return (file_data.decode("cp1251", errors="ignore")[:12000], [])
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
                    nums = re.findall(r'<v>([^<]+)</v>', sheet_xml)
                    str_refs = re.findall(r't="s"[^>]*><v>(\d+)</v>', sheet_xml)
                    row_data = [strings[int(r)] for r in str_refs if int(r) < len(strings)]
                    row_data.extend(nums[:200])
                    return (" | ".join(row_data[:600]), [])
        except:
            pass
        return ("", [])

    return ("", [])

def handler(event: dict, context) -> dict:
    """AI-разбор спецификаций: постраничный анализ, автоклассификация документов"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode":200,"headers":CORS,"body":""}

    method = event.get("httpMethod","GET")
    qs = event.get("queryStringParameters") or {}
    action = qs.get("action","")
    token = event.get("headers",{}).get("X-Auth-Token","")
    body = {}
    if event.get("body"):
        try: body = json.loads(event["body"])
        except: pass

    conn = db()

    if not token:
        conn.close(); return resp({"error":"Не авторизован"}, 401)
    staff = get_staff(conn, token)
    if not staff:
        conn.close(); return resp({"error":"Сессия истекла"}, 401)

    role = staff["role_code"]
    if role not in ("architect","constructor","supply","engineer","admin","manager"):
        conn.close(); return resp({"error":"Нет доступа"}, 403)

    # ── Загрузка файла base64 напрямую через бэкенд (без presigned URL) ─────────
    if method == "POST" and action == "upload_doc":
        project_id = body.get("project_id")
        spec_id = body.get("spec_id")
        file_name = body.get("file_name", "doc.pdf")
        file_b64 = body.get("file_b64", "")
        page_by_page = body.get("page_by_page", True)

        if not file_b64:
            conn.close(); return resp({"error": "file_b64 обязателен"}, 400)

        try:
            file_bytes = base64.b64decode(file_b64)
        except Exception as e:
            conn.close(); return resp({"error": f"Ошибка декодирования файла: {e}"}, 400)

        # Сохраняем в S3
        safe_name = re.sub(r"[^\w.\-]", "_", file_name)
        key = f"spec_uploads/{project_id or 'noproject'}/{safe_name}"
        try:
            import mimetypes as _mt
            ct = _mt.guess_type(safe_name)[0] or "application/octet-stream"
            s3c = s3()
            s3c.put_object(Bucket="files", Key=key, Body=file_bytes, ContentType=ct)
        except Exception as e:
            conn.close(); return resp({"error": f"Ошибка сохранения в S3: {e}"}, 500)

        url = cdn_url(key)

        # Загружаем базу материалов для контекста
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {S}.spec_uploads (project_id,spec_id,file_name,file_url,status,uploaded_by) "
            f"VALUES (%s,%s,%s,%s,'processing',%s) RETURNING id",
            (project_id, spec_id, file_name, url, staff["id"]))
        upload_id = cur.fetchone()[0]
        conn.commit()

        cur.execute(f"SELECT name,unit,price_per_unit,category FROM {S}.materials WHERE is_active=TRUE ORDER BY category,name")
        mats = cur.fetchall()
        mat_ctx = "\n".join([f"{r[3]} | {r[0]} | {r[1]} | {r[2]}₽" for r in mats[:150]])

        extracted_text, images_b64 = extract_text_from_file(file_bytes, file_name)
        print(f"[spec-ai/upload_doc] file={file_name} size={len(file_bytes)} text={len(extracted_text)} images={len(images_b64)}")

        ai_items = []
        error_msg = ""
        mode = "text"
        doc_info = {"category": "other", "summary": ""}
        pages_data = []

        if not os.environ.get("GIGACHAT_AUTH_KEY"):
            error_msg = "GIGACHAT_AUTH_KEY не настроен"
        elif extracted_text:
            try:
                doc_info = classify_document(extracted_text)
            except Exception as e:
                print(f"[spec-ai] classify error: {e}")

            if page_by_page:
                mode = "page_by_page"
                pages = split_text_into_pages(extracted_text)
                print(f"[spec-ai] page_by_page: {len(pages)} pages")
                for i, page_text in enumerate(pages):
                    page_items = analyze_page_text(page_text, i + 1, mat_ctx)
                    pages_data.append({
                        "page": i + 1,
                        "text_preview": page_text[:500],
                        "items": page_items,
                        "items_count": len(page_items)
                    })
                    ai_items.extend(page_items)
                seen = set()
                unique = []
                for item in ai_items:
                    k = f"{item.get('section','')}|{item.get('name','')}".lower()
                    if k not in seen:
                        seen.add(k); unique.append(item)
                ai_items = unique
            else:
                try:
                    ai_items = call_openai_text(extracted_text, mat_ctx)
                except Exception as e:
                    error_msg = str(e)
        elif images_b64:
            mode = "ocr"
            try:
                ai_items = call_openai_vision(images_b64, mat_ctx)
                ocr_text = ocr_images_to_text(images_b64[:2])
                if ocr_text:
                    doc_info = classify_document(ocr_text)
            except Exception as e:
                error_msg = str(e)
        else:
            error_msg = "Не удалось извлечь данные из файла."

        status = "done" if ai_items else ("error" if error_msg else "empty")
        cur.execute(
            f"UPDATE {S}.spec_uploads SET status=%s,ai_result=%s,error_msg=%s,"
            f"doc_category=%s,page_count=%s,pages_data=%s,processed_at=NOW() WHERE id=%s",
            (status, json.dumps(ai_items, ensure_ascii=False), error_msg,
             doc_info.get("category","other"), len(pages_data) or None,
             json.dumps(pages_data, ensure_ascii=False) if pages_data else None,
             upload_id))
        conn.commit(); cur.close(); conn.close()

        return resp({
            "ok": True,
            "upload_id": upload_id,
            "file_url": url,
            "status": status,
            "items": ai_items,
            "error": error_msg,
            "mode": mode,
            "doc_category": doc_info.get("category","other"),
            "doc_category_label": DOC_CATEGORIES.get(doc_info.get("category","other"), "Прочее"),
            "doc_summary": doc_info.get("summary",""),
            "pages": pages_data,
            "pages_count": len(pages_data),
        })

    # ── Получить presigned URL для загрузки файла спецификации напрямую в S3 ──
    if method == "POST" and action == "presigned_spec":
        project_id = body.get("project_id")
        file_name = body.get("file_name","spec.pdf")
        import re as _re
        safe_name = _re.sub(r"[^\w.\-]", "_", file_name)
        import mimetypes as _mt
        ct = _mt.guess_type(safe_name)[0] or "application/octet-stream"
        key = f"spec_uploads/{project_id or 'noproject'}/{safe_name}"
        s3c = s3()
        presigned = s3c.generate_presigned_url(
            "put_object",
            Params={"Bucket":"files","Key":key},
            ExpiresIn=600
        )
        conn.close()
        return resp({"ok":True,"presigned_url":presigned,"s3_key":key,"cdn_url":cdn_url(key),"content_type":ct})

    # ── Загрузить файл + AI-классификация + постраничный анализ ──────────────
    if method == "POST" and action == "upload_spec":
        project_id = body.get("project_id")
        spec_id = body.get("spec_id")
        file_name = body.get("file_name","spec.pdf")
        s3_key = body.get("s3_key","")
        page_by_page = body.get("page_by_page", False)  # постраничный режим

        if not s3_key:
            conn.close(); return resp({"error":"s3_key обязателен"}, 400)

        try:
            s3c = s3()
            obj = s3c.get_object(Bucket="files", Key=s3_key)
            file_bytes = obj["Body"].read()
        except Exception as e:
            conn.close(); return resp({"error":f"Не удалось прочитать файл из S3: {e}"}, 500)

        url = cdn_url(s3_key)

        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {S}.spec_uploads (project_id,spec_id,file_name,file_url,status,uploaded_by) "
            f"VALUES (%s,%s,%s,%s,'processing',%s) RETURNING id",
            (project_id, spec_id, file_name, url, staff["id"]))
        upload_id = cur.fetchone()[0]
        conn.commit()

        # Загружаем базу материалов для контекста
        cur.execute(f"SELECT name,unit,price_per_unit,category FROM {S}.materials WHERE is_active=TRUE ORDER BY category,name")
        mats = cur.fetchall()
        mat_ctx = "\n".join([f"{r[3]} | {r[0]} | {r[1]} | {r[2]}₽" for r in mats[:150]])

        extracted_text, images_b64 = extract_text_from_file(file_bytes, file_name)
        print(f"[spec-ai] file={file_name} size={len(file_bytes)} text_len={len(extracted_text)} images={len(images_b64)}")

        ai_items = []
        error_msg = ""
        mode = "text"
        doc_info = {"category": "other", "summary": ""}
        pages_data = []

        if not os.environ.get("GIGACHAT_AUTH_KEY"):
            error_msg = "GIGACHAT_AUTH_KEY не настроен"
        elif extracted_text:
            # Классифицируем документ
            try:
                doc_info = classify_document(extracted_text)
                print(f"[spec-ai] doc classified as: {doc_info}")
            except Exception as e:
                print(f"[spec-ai] classify error: {e}")

            if page_by_page:
                # Постраничный режим — анализируем каждую страницу отдельно
                mode = "page_by_page"
                pages = split_text_into_pages(extracted_text)
                print(f"[spec-ai] page_by_page mode: {len(pages)} pages")
                for i, page_text in enumerate(pages):
                    page_items = analyze_page_text(page_text, i + 1, mat_ctx)
                    pages_data.append({
                        "page": i + 1,
                        "text_preview": page_text[:500],
                        "items": page_items,
                        "items_count": len(page_items)
                    })
                    ai_items.extend(page_items)
                # Убираем дубликаты по имени+секции
                seen = set()
                unique_items = []
                for item in ai_items:
                    key = f"{item.get('section','')}|{item.get('name','')}".lower()
                    if key not in seen:
                        seen.add(key)
                        unique_items.append(item)
                ai_items = unique_items
            else:
                # Обычный режим — весь текст сразу
                try:
                    ai_items = call_openai_text(extracted_text, mat_ctx)
                    print(f"[spec-ai] GigaChat returned {len(ai_items)} items")
                except Exception as e:
                    error_msg = str(e)
                    print(f"[spec-ai] GigaChat error: {e}")
        elif images_b64:
            mode = "ocr"
            print(f"[spec-ai] mode=ocr, {len(images_b64)} images")
            try:
                ai_items = call_openai_vision(images_b64, mat_ctx)
                # Классифицируем по OCR тексту
                ocr_text = ocr_images_to_text(images_b64[:2])
                if ocr_text:
                    doc_info = classify_document(ocr_text)
            except Exception as e:
                error_msg = str(e)
        else:
            error_msg = "Не удалось извлечь данные из файла. Убедитесь что файл не повреждён."

        status = "done" if ai_items else ("error" if error_msg else "empty")

        # Сохраняем результат с категорией и постраничными данными
        cur.execute(
            f"UPDATE {S}.spec_uploads SET status=%s,ai_result=%s,error_msg=%s,"
            f"doc_category=%s,page_count=%s,pages_data=%s,processed_at=NOW() WHERE id=%s",
            (status, json.dumps(ai_items, ensure_ascii=False), error_msg,
             doc_info.get("category","other"), len(pages_data) or None,
             json.dumps(pages_data, ensure_ascii=False) if pages_data else None,
             upload_id))

        # Обновляем doc_category в project_files если есть file_url совпадение
        if project_id and doc_info.get("category"):
            cur.execute(
                f"UPDATE {S}.project_files SET doc_category=%s, ai_summary=%s "
                f"WHERE project_id=%s AND file_url=%s",
                (doc_info["category"], doc_info.get("summary",""), project_id, url))

        conn.commit(); cur.close(); conn.close()

        return resp({
            "ok": True,
            "upload_id": upload_id,
            "file_url": url,
            "status": status,
            "items": ai_items,
            "error": error_msg,
            "mode": mode,
            "doc_category": doc_info.get("category","other"),
            "doc_category_label": DOC_CATEGORIES.get(doc_info.get("category","other"), "Прочее"),
            "doc_summary": doc_info.get("summary",""),
            "pages": pages_data,
            "pages_count": len(pages_data),
            "extracted_chars": len(extracted_text),
            "ocr_pages": len(images_b64),
        })

    # ── Постраничный анализ уже загруженного документа ───────────────────────
    if method == "POST" and action == "analyze_pages":
        upload_id = body.get("upload_id")
        if not upload_id:
            conn.close(); return resp({"error":"upload_id обязателен"}, 400)

        cur = conn.cursor()
        cur.execute(
            f"SELECT id,file_name,file_url,status,ai_result,pages_data,doc_category FROM {S}.spec_uploads WHERE id=%s",
            (upload_id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close(); return resp({"error":"Загрузка не найдена"}, 404)

        file_url = row[2]
        # Получаем s3_key из url
        s3_key_match = re.search(r'/bucket/(.+)$', file_url)
        if not s3_key_match:
            cur.close(); conn.close(); return resp({"error":"Не удалось определить ключ файла"}, 400)
        s3_key = s3_key_match.group(1)

        try:
            s3c = s3()
            obj = s3c.get_object(Bucket="files", Key=s3_key)
            file_bytes = obj["Body"].read()
        except Exception as e:
            cur.close(); conn.close(); return resp({"error":f"Ошибка чтения файла: {e}"}, 500)

        extracted_text, _ = extract_text_from_file(file_bytes, row[1])
        if not extracted_text:
            cur.close(); conn.close(); return resp({"error":"Текст не найден в файле"}, 422)

        cur.execute(f"SELECT name,unit,price_per_unit,category FROM {S}.materials WHERE is_active=TRUE ORDER BY category,name")
        mats = cur.fetchall()
        mat_ctx = "\n".join([f"{r[3]} | {r[0]} | {r[1]} | {r[2]}₽" for r in mats[:150]])

        pages = split_text_into_pages(extracted_text)
        pages_data = []
        all_items = []

        for i, page_text in enumerate(pages):
            page_items = analyze_page_text(page_text, i + 1, mat_ctx)
            pages_data.append({
                "page": i + 1,
                "text_preview": page_text[:500],
                "items": page_items,
                "items_count": len(page_items)
            })
            all_items.extend(page_items)

        # Дедупликация
        seen = set()
        unique_items = []
        for item in all_items:
            key = f"{item.get('section','')}|{item.get('name','')}".lower()
            if key not in seen:
                seen.add(key)
                unique_items.append(item)

        cur.execute(
            f"UPDATE {S}.spec_uploads SET ai_result=%s,pages_data=%s,page_count=%s,"
            f"status='done',processed_at=NOW() WHERE id=%s",
            (json.dumps(unique_items, ensure_ascii=False),
             json.dumps(pages_data, ensure_ascii=False),
             len(pages_data), upload_id))
        conn.commit(); cur.close(); conn.close()

        return resp({
            "ok": True,
            "pages": pages_data,
            "pages_count": len(pages_data),
            "items": unique_items,
            "items_count": len(unique_items),
        })

    # ── Получить данные страницы ──────────────────────────────────────────────
    if method == "GET" and action == "get_page":
        upload_id = qs.get("upload_id")
        page_num = int(qs.get("page", "1"))
        if not upload_id:
            conn.close(); return resp({"error":"upload_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT pages_data FROM {S}.spec_uploads WHERE id=%s", (upload_id,))
        row = cur.fetchone(); cur.close(); conn.close()
        if not row or not row[0]:
            return resp({"error":"Страницы не найдены"}, 404)
        pages = row[0]
        page = next((p for p in pages if p["page"] == page_num), None)
        return resp({"page": page, "total_pages": len(pages)})

    # ── Получить список загрузок по проекту ──────────────────────────────────
    if method == "GET" and action == "list":
        pid = qs.get("project_id")
        cur = conn.cursor()
        q = (f"SELECT su.id,su.file_name,su.file_url,su.status,su.error_msg,"
             f"su.created_at,su.processed_at,s.full_name,su.doc_category,su.page_count "
             f"FROM {S}.spec_uploads su LEFT JOIN {S}.staff s ON s.id=su.uploaded_by "
             f"WHERE 1=1")
        params = []
        if pid: q += " AND su.project_id=%s"; params.append(pid)
        q += " ORDER BY su.created_at DESC LIMIT 50"
        cur.execute(q, params)
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"uploads":[{
            "id":r[0],"file_name":r[1],"file_url":r[2],"status":r[3],
            "error":r[4],"created_at":str(r[5]),"processed_at":str(r[6]),"by":r[7],
            "doc_category":r[8],"page_count":r[9],
            "doc_category_label": DOC_CATEGORIES.get(r[8] or "other", "Прочее"),
        } for r in rows]})

    # ── Получить результат AI-разбора конкретного upload ─────────────────────
    if method == "GET" and action == "get":
        uid = qs.get("upload_id")
        if not uid: conn.close(); return resp({"error":"upload_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"SELECT id,file_name,file_url,status,ai_result,error_msg,created_at,doc_category,page_count,pages_data FROM {S}.spec_uploads WHERE id=%s",
            (uid,))
        r = cur.fetchone(); cur.close(); conn.close()
        if not r: return resp({"error":"Не найдено"}, 404)
        pages_data = r[9] or []
        return resp({"upload":{
            "id":r[0],"file_name":r[1],"file_url":r[2],"status":r[3],
            "items":r[4] or [],"error":r[5],"created_at":str(r[6]),
            "doc_category":r[7],"doc_category_label": DOC_CATEGORIES.get(r[7] or "other","Прочее"),
            "page_count":r[8],"pages": pages_data,
        }})

    conn.close()
    return resp({"error":"Not found"}, 404)