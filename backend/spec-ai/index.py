"""
AI-разбор загруженных спецификаций (PDF/Excel) и заполнение ведомости объёмов работ.
Использует OpenAI GPT-4o для извлечения позиций из текста файла.
"""
import json, os, base64, re
import psycopg2
import boto3
import urllib.request
import urllib.error

S = "t_p78845984_auto_house_cost_calc"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
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

SPEC_PROMPT = """Ты — ассистент строительной компании. Перед тобой спецификация или ведомость объёмов работ строительного проекта.

Извлеки ВСЕ позиции работ и материалов и верни их в виде JSON-массива.

Для каждой позиции:
- section: раздел/категория ("Фундамент", "Стены", "Кровля", "Отделка", "Электрика", "Сантехника" и т.д.)
- name: название работы или материала
- unit: единица измерения (м², м³, пм, шт, т, кг, л, компл)
- qty: количество (число, 0 если не указано)
- price_per_unit: цена за единицу в рублях (0 если не указана)
- note: примечание, марка, артикул

Верни ТОЛЬКО валидный JSON-массив без пояснений:
[{"section":"...","name":"...","unit":"...","qty":0,"price_per_unit":0,"note":"..."}]"""

def _openai_request(payload: dict, api_key: str) -> dict:
    data = json.dumps(payload, ensure_ascii=False).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())

def _parse_items(content: str) -> list:
    match = re.search(r'\[.*\]', content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except:
            pass
    return []

def call_openai_text(text: str, materials_context: str) -> list:
    """Разбор текстовой спецификации через GPT-4o-mini"""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return []
    prompt = f"{SPEC_PROMPT}\n\nБаза материалов для сопоставления цен:\n{materials_context}\n\nТекст спецификации:\n{text[:12000]}"
    result = _openai_request({
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 4000,
    }, api_key)
    return _parse_items(result["choices"][0]["message"]["content"].strip())

def call_openai_vision(images_b64: list, materials_context: str) -> list:
    """OCR сканированного PDF через GPT-4o Vision — передаём страницы как изображения"""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return []

    content = [{"type": "text", "text": f"{SPEC_PROMPT}\n\nБаза материалов:\n{materials_context}\n\nИзвлеки позиции из изображений ниже:"}]
    for b64 in images_b64[:6]:  # не более 6 страниц
        content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "high"}})

    result = _openai_request({
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": content}],
        "temperature": 0.1,
        "max_tokens": 4000,
    }, api_key)
    return _parse_items(result["choices"][0]["message"]["content"].strip())

def extract_text_from_pdf(file_data: bytes) -> str:
    """Извлекает встроенный текст из PDF (работает только для текстовых PDF, не сканов)"""
    try:
        text = file_data.decode("latin-1", errors="ignore")
        # Поток BT...ET содержит текстовые объекты
        chunks = re.findall(r'\(([^)]{1,200})\)', text)
        readable = []
        for chunk in chunks:
            cleaned = chunk.replace("\\n", " ").replace("\\r", " ").replace("\\t", " ").strip()
            if len(cleaned) > 2 and any(c.isalpha() for c in cleaned):
                readable.append(cleaned)
        return " | ".join(readable[:600])
    except:
        return ""

def extract_images_from_pdf(file_data: bytes) -> list:
    """Извлекает изображения страниц из PDF-скана (JPEG/PNG потоки)"""
    try:
        import io, struct, zlib
        images = []
        # Ищем встроенные JPEG (начинаются с FFD8FF)
        pos = 0
        while pos < len(file_data) - 4:
            idx = file_data.find(b'\xff\xd8\xff', pos)
            if idx == -1:
                break
            # Ищем конец JPEG (FFD9)
            end = file_data.find(b'\xff\xd9', idx + 2)
            if end != -1 and end - idx > 5000:  # минимум 5кб — реальное изображение
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
        # Если текста мало — скорее всего скан, пробуем извлечь изображения
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
    if role not in ("architect","constructor","supply","engineer"):
        conn.close(); return resp({"error":"Нет доступа"}, 403)

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

    # ── Загрузить файл спецификации и запустить AI-разбор ────────────────────
    if method == "POST" and action == "upload_spec":
        project_id = body.get("project_id")
        spec_id = body.get("spec_id")
        file_name = body.get("file_name","spec.pdf")
        s3_key = body.get("s3_key","")  # ключ файла уже загруженного в S3

        if not s3_key:
            conn.close(); return resp({"error":"s3_key обязателен"}, 400)

        # Читаем файл из S3
        try:
            s3c = s3()
            obj = s3c.get_object(Bucket="files", Key=s3_key)
            file_bytes = obj["Body"].read()
        except Exception as e:
            conn.close(); return resp({"error":f"Не удалось прочитать файл из S3: {e}"}, 500)

        url = cdn_url(s3_key)

        # Сохраняем запись об upload
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

        # Извлекаем текст или изображения из файла
        extracted_text, images_b64 = extract_text_from_file(file_bytes, file_name)

        ai_items = []
        error_msg = ""
        mode = "text"

        if not os.environ.get("OPENAI_API_KEY"):
            error_msg = "OPENAI_API_KEY не настроен — добавьте ключ в секреты проекта"
        elif extracted_text:
            # Текстовый PDF — быстрый GPT-4o-mini
            try:
                ai_items = call_openai_text(extracted_text, mat_ctx)
            except Exception as e:
                error_msg = str(e)
        elif images_b64:
            # Скан PDF — OCR через GPT-4o Vision
            mode = "ocr"
            try:
                ai_items = call_openai_vision(images_b64, mat_ctx)
            except Exception as e:
                error_msg = str(e)
        else:
            error_msg = "Не удалось извлечь данные из файла. Убедитесь что файл не повреждён."

        # Обновляем статус upload
        status = "done" if ai_items else ("error" if error_msg else "empty")
        cur.execute(
            f"UPDATE {S}.spec_uploads SET status=%s,ai_result=%s,error_msg=%s,processed_at=NOW() WHERE id=%s",
            (status, json.dumps(ai_items, ensure_ascii=False), error_msg, upload_id))
        conn.commit(); cur.close(); conn.close()

        return resp({
            "ok": True,
            "upload_id": upload_id,
            "file_url": url,
            "status": status,
            "items": ai_items,
            "error": error_msg,
            "mode": mode,
            "extracted_chars": len(extracted_text),
            "ocr_pages": len(images_b64),
        })

    # ── Получить список загрузок по проекту ──────────────────────────────────
    if method == "GET" and action == "list":
        pid = qs.get("project_id")
        cur = conn.cursor()
        q = (f"SELECT su.id,su.file_name,su.file_url,su.status,su.error_msg,"
             f"su.created_at,su.processed_at,s.full_name "
             f"FROM {S}.spec_uploads su LEFT JOIN {S}.staff s ON s.id=su.uploaded_by "
             f"WHERE 1=1")
        params = []
        if pid: q += " AND su.project_id=%s"; params.append(pid)
        q += " ORDER BY su.created_at DESC LIMIT 50"
        cur.execute(q, params)
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"uploads":[{
            "id":r[0],"file_name":r[1],"file_url":r[2],"status":r[3],
            "error":r[4],"created_at":str(r[5]),"processed_at":str(r[6]),"by":r[7]
        } for r in rows]})

    # ── Получить результат AI-разбора конкретного upload ─────────────────────
    if method == "GET" and action == "get":
        uid = qs.get("upload_id")
        if not uid: conn.close(); return resp({"error":"upload_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"SELECT id,file_name,file_url,status,ai_result,error_msg,created_at FROM {S}.spec_uploads WHERE id=%s",
            (uid,))
        r = cur.fetchone(); cur.close(); conn.close()
        if not r: return resp({"error":"Не найдено"}, 404)
        return resp({"upload":{
            "id":r[0],"file_name":r[1],"file_url":r[2],"status":r[3],
            "items":r[4] or [],"error":r[5],"created_at":str(r[6])
        }})

    conn.close()
    return resp({"error":"Not found"}, 404)