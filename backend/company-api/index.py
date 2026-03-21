"""
API организаций: список компаний, реквизиты, логотип, печать, шаблоны договоров
Поддерживает несколько организаций (таблица companies)
"""
import json, os, re
import psycopg2
import boto3

S = "t_p78845984_auto_house_cost_calc"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

COMPANY_FIELDS = [
    "company_name", "full_name", "inn", "kpp", "ogrn",
    "legal_address", "actual_address", "phone", "email", "website",
    "director_name", "director_title", "bank_name", "bik",
    "account_number", "corr_account",
    "logo_url", "stamp_url", "signature_url", "company_map_url",
]

def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def resp(data, code=200):
    return {
        "statusCode": code,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False, default=str),
    }

def s3_client():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )

def cdn_url(key):
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

def get_staff(conn, token):
    cur = conn.cursor()
    cur.execute(
        f"SELECT s.id, s.full_name, s.role_code FROM {S}.sessions ss "
        f"JOIN {S}.staff s ON s.id=ss.staff_id "
        f"WHERE ss.token=%s AND ss.expires_at>NOW()",
        (token,),
    )
    r = cur.fetchone()
    cur.close()
    return {"id": r[0], "full_name": r[1], "role_code": r[2]} if r else None

def _esc(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"

def row_to_dict(cur, row):
    return dict(zip([d[0] for d in cur.description], row))

def handler(event: dict, context) -> dict:
    """Управление организациями: CRUD компаний, загрузка файлов, шаблоны договоров"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")
    token = (event.get("headers") or {}).get("X-Auth-Token", "")

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    conn = db()
    try:
        # ------------------------------------------------------------------ #
        # GET companies — список всех организаций (PUBLIC)                    #
        # ------------------------------------------------------------------ #
        if method == "GET" and action == "companies":
            cur = conn.cursor()
            cur.execute(
                f"SELECT id, is_default, company_name, full_name, inn, kpp, ogrn, "
                f"legal_address, actual_address, phone, email, website, "
                f"director_name, director_title, bank_name, bik, account_number, corr_account, "
                f"logo_url, stamp_url, signature_url, company_map_url, updated_at "
                f"FROM {S}.companies ORDER BY is_default DESC, id ASC"
            )
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            cur.close()
            return resp({"companies": rows})

        # ------------------------------------------------------------------ #
        # GET company — одна организация по id (PUBLIC)                       #
        # ------------------------------------------------------------------ #
        if method == "GET" and action == "company":
            cid = qs.get("id")
            if not cid:
                return resp({"error": "id обязателен"}, 400)
            cur = conn.cursor()
            cur.execute(f"SELECT * FROM {S}.companies WHERE id={int(cid)}")
            row = cur.fetchone()
            cur.close()
            if not row:
                return resp({"error": "Организация не найдена"}, 404)
            return resp({"company": row_to_dict(cur if False else conn.cursor(), row)})

        # ------------------------------------------------------------------ #
        # GET settings — совместимость: возвращает дефолтную организацию     #
        # ------------------------------------------------------------------ #
        if method == "GET" and action == "settings":
            cur = conn.cursor()
            cur.execute(
                f"SELECT * FROM {S}.companies WHERE is_default=TRUE ORDER BY id LIMIT 1"
            )
            row = cur.fetchone()
            if not row:
                cur.execute(f"SELECT * FROM {S}.companies ORDER BY id LIMIT 1")
                row = cur.fetchone()
            cols = [d[0] for d in cur.description]
            cur.close()
            settings = dict(zip(cols, row)) if row else {}
            return resp({"settings": settings})

        # ------------------------------------------------------------------ #
        # GET templates — активные шаблоны (PUBLIC)                          #
        # ------------------------------------------------------------------ #
        if method == "GET" and action == "templates":
            cid = qs.get("company_id")
            cur = conn.cursor()
            where = f"is_active=TRUE" + (f" AND company_id={int(cid)}" if cid else "")
            cur.execute(
                f"SELECT id, name, type, content_text, file_name, file_url, company_id, created_at "
                f"FROM {S}.contract_templates WHERE {where} ORDER BY id"
            )
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            cur.close()
            return resp({"templates": rows})

        # ------------------------------------------------------------------ #
        # GET read_template — читает docx из S3                              #
        # ------------------------------------------------------------------ #
        if method == "GET" and action == "read_template":
            import base64, io, zipfile, re as _re
            key = qs.get("key", "")
            if not key:
                return resp({"error": "key обязателен"}, 400)
            obj = s3_client().get_object(Bucket="bucket", Key=key)
            file_bytes = obj["Body"].read()
            try:
                zf = zipfile.ZipFile(io.BytesIO(file_bytes))
                xml = zf.read("word/document.xml").decode("utf-8", errors="ignore")
                text = _re.sub(r"<[^>]+>", " ", xml)
                text = _re.sub(r"\s{2,}", "\n", text).strip()
            except Exception as e:
                text = f"Ошибка чтения docx: {e}"
            return resp({"text": text[:8000]})

        # ------------------------------------------------------------------ #
        # Все write-действия — требуют авторизации                           #
        # ------------------------------------------------------------------ #
        if method in ("POST", "PUT", "DELETE"):
            if not token:
                return resp({"error": "Требуется авторизация"}, 401)
            staff = get_staff(conn, token)
            if not staff:
                return resp({"error": "Сессия истекла или недействительна"}, 401)

        # ------------------------------------------------------------------ #
        # POST create_company — создать новую организацию                     #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "create_company":
            name = body.get("company_name", "").strip()
            if not name:
                return resp({"error": "company_name обязателен"}, 400)
            sets = ["company_name=" + _esc(name)]
            for f in COMPANY_FIELDS:
                if f != "company_name" and f in body:
                    sets.append(f"{f}={_esc(body[f])}")
            cur = conn.cursor()
            cur.execute(
                f"INSERT INTO {S}.companies ({', '.join(COMPANY_FIELDS)}) "
                f"VALUES ({', '.join(_esc(body.get(f, '')) for f in COMPANY_FIELDS)}) "
                f"RETURNING id"
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            cur.execute(f"SELECT * FROM {S}.companies WHERE id={new_id}")
            row = cur.fetchone()
            cols = [d[0] for d in cur.description]
            cur.close()
            return resp({"ok": True, "company": dict(zip(cols, row))})

        # ------------------------------------------------------------------ #
        # POST save_company — сохранить реквизиты организации (по id)        #
        # ------------------------------------------------------------------ #
        if method == "POST" and action in ("save_company", "save_settings"):
            cid = body.get("id") or body.get("company_id")
            sets = []
            for f in COMPANY_FIELDS:
                if f in body:
                    sets.append(f"{f}={_esc(body[f])}")
            if not sets:
                return resp({"error": "Нет полей для обновления"}, 400)
            cur = conn.cursor()
            if cid:
                cur.execute(
                    f"UPDATE {S}.companies SET {', '.join(sets)}, updated_at=NOW() "
                    f"WHERE id={int(cid)} RETURNING id"
                )
            else:
                # fallback: обновляем дефолтную
                cur.execute(
                    f"UPDATE {S}.companies SET {', '.join(sets)}, updated_at=NOW() "
                    f"WHERE is_default=TRUE RETURNING id"
                )
            conn.commit()
            updated_id = cur.fetchone()
            if updated_id:
                cur.execute(f"SELECT * FROM {S}.companies WHERE id={updated_id[0]}")
                row = cur.fetchone()
                cols = [d[0] for d in cur.description]
                cur.close()
                return resp({"ok": True, "company": dict(zip(cols, row))})
            cur.close()
            return resp({"error": "Организация не найдена"}, 404)

        # ------------------------------------------------------------------ #
        # POST set_default — назначить организацию по умолчанию              #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "set_default":
            cid = body.get("id")
            if not cid:
                return resp({"error": "id обязателен"}, 400)
            cur = conn.cursor()
            cur.execute(f"UPDATE {S}.companies SET is_default=FALSE")
            cur.execute(f"UPDATE {S}.companies SET is_default=TRUE WHERE id={int(cid)}")
            conn.commit()
            cur.close()
            return resp({"ok": True})

        # ------------------------------------------------------------------ #
        # POST upload_image — загрузка логотипа/печати/подписи/карты         #
        # ------------------------------------------------------------------ #
        if method == "POST" and action in ("upload_logo", "upload_stamp", "upload_signature", "upload_map"):
            cid = body.get("company_id", 1)
            file_name = body.get("file_name", "")
            if not file_name:
                return resp({"error": "file_name обязателен"}, 400)
            field_map = {
                "upload_logo": "logo_url",
                "upload_stamp": "stamp_url",
                "upload_signature": "signature_url",
                "upload_map": "company_map_url",
            }
            db_field = field_map[action]
            safe_name = re.sub(r"[^\w.\-]", "_", file_name)
            key = f"companies/{cid}/{db_field.replace('_url','')}/{safe_name}"
            presigned = s3_client().generate_presigned_url(
                "put_object",
                Params={"Bucket": "bucket", "Key": key, "ContentType": "application/octet-stream"},
                ExpiresIn=600,
            )
            url = cdn_url(key)
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {S}.companies SET {db_field}={_esc(url)}, updated_at=NOW() WHERE id={int(cid)}"
            )
            conn.commit()
            cur.close()
            return resp({"presigned_url": presigned, "cdn_url": url, "field": db_field})

        # ------------------------------------------------------------------ #
        # POST save_template                                                  #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "save_template":
            tpl_id = body.get("id")
            name = body.get("name", "")
            ttype = body.get("type", "")
            content_text = body.get("content_text", "")
            file_name = body.get("file_name", "")
            file_url = body.get("file_url", "")
            company_id = body.get("company_id")
            if not name or not ttype:
                return resp({"error": "name и type обязательны"}, 400)
            cur = conn.cursor()
            cid_sql = f", company_id={int(company_id)}" if company_id else ""
            if tpl_id:
                cur.execute(
                    f"UPDATE {S}.contract_templates "
                    f"SET name={_esc(name)}, type={_esc(ttype)}, "
                    f"content_text={_esc(content_text)}, "
                    f"file_name={_esc(file_name)}, file_url={_esc(file_url)}{cid_sql}, "
                    f"updated_at=NOW() "
                    f"WHERE id={int(tpl_id)} RETURNING id"
                )
                row = cur.fetchone()
                rid = row[0] if row else tpl_id
            else:
                cid_col = ", company_id" if company_id else ""
                cid_val = f", {int(company_id)}" if company_id else ""
                cur.execute(
                    f"INSERT INTO {S}.contract_templates "
                    f"(name, type, content_text, file_name, file_url, is_active{cid_col}) "
                    f"VALUES ({_esc(name)}, {_esc(ttype)}, {_esc(content_text)}, "
                    f"{_esc(file_name)}, {_esc(file_url)}, TRUE{cid_val}) RETURNING id"
                )
                rid = cur.fetchone()[0]
            conn.commit()
            cur.close()
            return resp({"ok": True, "id": rid})

        # ------------------------------------------------------------------ #
        # POST upload_template_file — base64 загрузка файла шаблона         #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "upload_template_file":
            import base64
            file_name = body.get("file_name", "")
            file_b64 = body.get("file_base64", "")
            if not file_name or not file_b64:
                return resp({"error": "file_name и file_base64 обязательны"}, 400)
            safe_name = re.sub(r"[^\w.\-]", "_", file_name)
            key = f"company/templates/{safe_name}"
            file_bytes = base64.b64decode(file_b64)
            s3_client().put_object(Bucket="bucket", Key=key, Body=file_bytes, ContentType="application/octet-stream")
            url = cdn_url(key)
            return resp({"ok": True, "cdn_url": url, "file_name": file_name})

        # ------------------------------------------------------------------ #
        # POST parse_contract — извлечь реквизиты из docx/pdf/txt           #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "parse_contract":
            import base64, io, zipfile, re as _re
            file_name = body.get("file_name", "")
            file_b64 = body.get("file_base64", "")
            if not file_b64:
                return resp({"error": "file_base64 обязателен"}, 400)
            file_bytes = base64.b64decode(file_b64)
            text = ""
            ext = file_name.lower().split(".")[-1] if "." in file_name else ""
            if ext in ("docx", "doc"):
                try:
                    zf = zipfile.ZipFile(io.BytesIO(file_bytes))
                    xml = zf.read("word/document.xml").decode("utf-8", errors="ignore")
                    text = _re.sub(r"<[^>]+>", " ", xml)
                    text = _re.sub(r"\s+", " ", text)
                except Exception:
                    text = file_bytes.decode("utf-8", errors="ignore")
            else:
                text = file_bytes.decode("utf-8", errors="ignore")

            def find(patterns, txt):
                for p in patterns:
                    m = _re.search(p, txt, _re.IGNORECASE)
                    if m:
                        return m.group(1).strip()
                return ""

            requisites = {
                "inn":            find([r"ИНН[:\s]+(\d{10,12})", r"ИНН/КПП[:\s]+(\d{10})"], text),
                "kpp":            find([r"КПП[:\s]+(\d{9})", r"ИНН/КПП\s*\d+/(\d{9})"], text),
                "ogrn":           find([r"ОГРН[:\s]+(\d{13,15})"], text),
                "bank_name":      find([r"Банк[:\s]+([^\n,;]{4,60})", r"в банке[:\s]+([^\n,;]{4,60})"], text),
                "bik":            find([r"БИК[:\s]+(\d{9})"], text),
                "account_number": find([r"р/с[:\s]+([\d]{20})", r"р\.с\.[:\s]+([\d]{20})"], text),
                "corr_account":   find([r"к/с[:\s]+([\d]{20})", r"корр\. счёт[:\s]+([\d]{20})"], text),
                "legal_address":  find([r"Юридический адрес[:\s]+([^\n]{10,120})", r"Адрес[:\s]+([^\n]{10,120})"], text),
                "phone":          find([r"Тел[.:]\s*([\+\d\s\(\)\-]{7,20})", r"Телефон[:\s]+([\+\d\s\(\)\-]{7,20})"], text),
                "email":          find([r"[Ee]-?mail[:\s]+([\w.\-]+@[\w.\-]+\.\w+)"], text),
                "director_name":  find([r"(?:Генеральный директор|Директор)[:\s]+([А-ЯЁ][а-яё]+\s+[А-ЯЁ][\.А-ЯЁа-яё\s]{2,40})"], text),
                "company_name":   find([r'ООО\s+"([^"]{2,60})"', r"ООО\s+«([^»]{2,60})»", r'АО\s+"([^"]{2,60})"', r"ИП\s+([А-ЯЁ][а-яё]+\s+[А-ЯЁ][\.А-ЯЁ\s]{2,40})"], text),
            }
            filled = {k: v for k, v in requisites.items() if v}
            return resp({"requisites": filled, "fields_found": len(filled)})

        # ------------------------------------------------------------------ #
        # DELETE delete_template                                              #
        # ------------------------------------------------------------------ #
        if method == "DELETE" and action == "delete_template":
            tpl_id = qs.get("id") or body.get("id")
            if not tpl_id:
                return resp({"error": "id обязателен"}, 400)
            if not token:
                return resp({"error": "Требуется авторизация"}, 401)
            staff = get_staff(conn, token)
            if not staff:
                return resp({"error": "Сессия истекла"}, 401)
            cur = conn.cursor()
            cur.execute(
                f"UPDATE {S}.contract_templates SET is_active=FALSE, updated_at=NOW() "
                f"WHERE id={int(tpl_id)}"
            )
            conn.commit()
            cur.close()
            return resp({"ok": True})

        return resp({"error": "Неизвестное действие"}, 404)

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return resp({"error": str(e)}, 500)
    finally:
        conn.close()
