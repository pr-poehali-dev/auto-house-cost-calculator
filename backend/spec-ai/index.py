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

def call_openai(text: str, materials_context: str) -> list:
    """Отправляет текст спецификации в GPT-4o, получает список позиций ВОР"""
    api_key = os.environ.get("OPENAI_API_KEY","")
    if not api_key:
        return []

    prompt = f"""Ты — ассистент строительной компании. Тебе дан текст спецификации или ведомости из строительного проекта.

Твоя задача: извлечь все позиции работ и материалов и вернуть их в виде JSON-массива.

Для каждой позиции определи:
- section: раздел/категория (например: "Фундамент", "Стены", "Кровля", "Отделка")
- name: название материала или работы
- unit: единица измерения (м², м³, пм, шт, т, кг)
- qty: количество (число, если не указано — поставь 0)
- price_per_unit: цена за единицу в рублях (если не указана — попробуй найти в базе материалов ниже, если нет — поставь 0)
- note: примечание (марка, артикул, характеристики)

База материалов для сопоставления цен:
{materials_context}

Верни ТОЛЬКО валидный JSON-массив без пояснений:
[{{"section":"...","name":"...","unit":"...","qty":0,"price_per_unit":0,"note":"..."}}]

Текст спецификации:
{text[:8000]}"""

    payload = json.dumps({
        "model": "gpt-4o-mini",
        "messages": [{"role":"user","content": prompt}],
        "temperature": 0.1,
        "max_tokens": 4000,
    }).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={"Content-Type":"application/json","Authorization":f"Bearer {api_key}"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        result = json.loads(r.read())
    content = result["choices"][0]["message"]["content"].strip()
    # Извлекаем JSON из ответа
    match = re.search(r'\[.*\]', content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return []

def extract_text_from_file(file_data: bytes, file_name: str) -> str:
    """Базовое извлечение текста из PDF или Excel (без внешних библиотек)"""
    ext = file_name.rsplit(".",1)[-1].lower() if "." in file_name else ""

    if ext == "pdf":
        # Простое извлечение текста из PDF через поиск читаемых строк
        try:
            text = file_data.decode("latin-1", errors="ignore")
            # Извлекаем текстовые объекты PDF
            import re
            chunks = re.findall(r'\((.*?)\)', text)
            readable = []
            for chunk in chunks:
                cleaned = chunk.replace("\\n"," ").replace("\\r"," ").strip()
                if len(cleaned) > 2 and any(c.isalpha() for c in cleaned):
                    readable.append(cleaned)
            return " | ".join(readable[:500])
        except:
            return ""

    elif ext in ("xlsx","xls","csv"):
        # Для CSV — прямое чтение
        if ext == "csv":
            try:
                return file_data.decode("utf-8", errors="ignore")[:10000]
            except:
                return file_data.decode("cp1251", errors="ignore")[:10000]
        # Для xlsx — извлекаем XML из zip
        try:
            import zipfile, io
            with zipfile.ZipFile(io.BytesIO(file_data)) as z:
                # Читаем shared strings
                strings = []
                if "xl/sharedStrings.xml" in z.namelist():
                    ss_xml = z.read("xl/sharedStrings.xml").decode("utf-8","ignore")
                    strings = re.findall(r'<t[^>]*>([^<]+)</t>', ss_xml)
                # Читаем первый лист
                sheet_files = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet")]
                if sheet_files:
                    sheet_xml = z.read(sheet_files[0]).decode("utf-8","ignore")
                    # Числа
                    nums = re.findall(r'<v>([^<]+)</v>', sheet_xml)
                    # Индексы строк
                    str_refs = re.findall(r't="s"[^>]*><v>(\d+)</v>', sheet_xml)
                    row_data = []
                    for ref in str_refs:
                        idx = int(ref)
                        if idx < len(strings):
                            row_data.append(strings[idx])
                    row_data.extend(nums[:200])
                    return " | ".join(row_data[:500])
        except:
            pass
        return ""

    return ""

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

    # ── Загрузить файл спецификации и запустить AI-разбор ────────────────────
    if method == "POST" and action == "upload_spec":
        project_id = body.get("project_id")
        spec_id = body.get("spec_id")
        file_data_b64 = body.get("file_data","")
        file_name = body.get("file_name","spec.pdf")

        if not file_data_b64:
            conn.close(); return resp({"error":"file_data обязателен"}, 400)

        # Сохраняем файл в S3
        file_bytes = base64.b64decode(file_data_b64)
        ext = file_name.rsplit(".",1)[-1].lower() if "." in file_name else "pdf"
        ct_map = {"pdf":"application/pdf","xlsx":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  "xls":"application/vnd.ms-excel","csv":"text/csv"}
        ct = ct_map.get(ext,"application/octet-stream")
        key = f"spec_uploads/{project_id or 'noproject'}/{file_name}"
        s3().put_object(Bucket="files", Key=key, Body=file_bytes, ContentType=ct)
        url = cdn_url(key)

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

        # Извлекаем текст из файла
        extracted_text = extract_text_from_file(file_bytes, file_name)

        ai_items = []
        error_msg = ""

        if not os.environ.get("OPENAI_API_KEY"):
            error_msg = "OPENAI_API_KEY не настроен — добавьте ключ в секреты проекта"
        elif not extracted_text:
            error_msg = "Не удалось извлечь текст из файла"
        else:
            try:
                ai_items = call_openai(extracted_text, mat_ctx)
            except Exception as e:
                error_msg = str(e)

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
            "extracted_chars": len(extracted_text),
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
