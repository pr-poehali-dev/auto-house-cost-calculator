"""
API настроек организации: реквизиты, логотип, печать, подпись, шаблоны договоров
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

def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def resp(data, code=200):
    return {
        "statusCode": code,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False, default=str),
    }

def s3():
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
    """Minimal SQL string escape for string interpolation."""
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"

def handler(event: dict, context) -> dict:
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
        # GET settings  — PUBLIC, no auth required                            #
        # ------------------------------------------------------------------ #
        if method == "GET" and action == "settings":
            cur = conn.cursor()
            cur.execute(f"SELECT * FROM {S}.company_settings WHERE id=1")
            row = cur.fetchone()
            cols = [d[0] for d in cur.description]
            cur.close()
            settings = dict(zip(cols, row)) if row else {}
            return resp({"settings": settings})

        # ------------------------------------------------------------------ #
        # GET templates — PUBLIC-ish; list active contract templates          #
        # ------------------------------------------------------------------ #
        if method == "GET" and action == "templates":
            cur = conn.cursor()
            cur.execute(
                f"SELECT id, name, type, content_text, file_name, file_url, created_at "
                f"FROM {S}.contract_templates WHERE is_active=TRUE ORDER BY id"
            )
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            cur.close()
            return resp({"templates": rows})

        # ------------------------------------------------------------------ #
        # All write actions require auth                                       #
        # ------------------------------------------------------------------ #
        if method in ("POST", "PUT", "DELETE"):
            if not token:
                return resp({"error": "Требуется авторизация"}, 401)
            staff = get_staff(conn, token)
            if not staff:
                return resp({"error": "Сессия истекла или недействительна"}, 401)

        # ------------------------------------------------------------------ #
        # POST save_settings                                                  #
        # ------------------------------------------------------------------ #
        if method == "POST" and action == "save_settings":
            allowed = [
                "company_name", "inn", "kpp", "ogrn", "legal_address",
                "actual_address", "phone", "email", "website",
                "bank_name", "bik", "account_number", "corr_account",
                "director_name", "director_position",
                "logo_url", "stamp_url", "signature_url", "company_map_url",
            ]
            sets = []
            for field in allowed:
                if field in body:
                    sets.append(f"{field}={_esc(body[field])}")
            if not sets:
                return resp({"error": "Нет полей для обновления"}, 400)
            cur = conn.cursor()
            cur.execute(
                f"INSERT INTO {S}.company_settings (id) VALUES (1) "
                f"ON CONFLICT (id) DO NOTHING"
            )
            cur.execute(
                f"UPDATE {S}.company_settings SET {', '.join(sets)}, updated_at=NOW() WHERE id=1"
            )
            conn.commit()
            cur.execute(f"SELECT * FROM {S}.company_settings WHERE id=1")
            row = cur.fetchone()
            cols = [d[0] for d in cur.description]
            cur.close()
            return resp({"ok": True, "settings": dict(zip(cols, row))})

        # ------------------------------------------------------------------ #
        # POST upload_logo / upload_stamp / upload_signature                  #
        # ------------------------------------------------------------------ #
        if method == "POST" and action in ("upload_logo", "upload_stamp", "upload_signature", "upload_map"):
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

            # sanitise key
            safe_name = re.sub(r"[^\w.\-]", "_", file_name)
            key = f"company/{db_field.replace('_url','')}/{safe_name}"
            bucket = "bucket"

            presigned = s3().generate_presigned_url(
                "put_object",
                Params={"Bucket": bucket, "Key": key, "ContentType": "application/octet-stream"},
                ExpiresIn=600,
            )
            url = cdn_url(key)

            # save cdn url to DB
            cur = conn.cursor()
            cur.execute(
                f"INSERT INTO {S}.company_settings (id) VALUES (1) "
                f"ON CONFLICT (id) DO NOTHING"
            )
            cur.execute(
                f"UPDATE {S}.company_settings SET {db_field}={_esc(url)}, updated_at=NOW() WHERE id=1"
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

            if not name or not ttype:
                return resp({"error": "name и type обязательны"}, 400)

            cur = conn.cursor()
            if tpl_id:
                cur.execute(
                    f"UPDATE {S}.contract_templates "
                    f"SET name={_esc(name)}, type={_esc(ttype)}, "
                    f"content_text={_esc(content_text)}, "
                    f"file_name={_esc(file_name)}, file_url={_esc(file_url)}, "
                    f"updated_at=NOW() "
                    f"WHERE id={int(tpl_id)} RETURNING id"
                )
                row = cur.fetchone()
                rid = row[0] if row else tpl_id
            else:
                cur.execute(
                    f"INSERT INTO {S}.contract_templates "
                    f"(name, type, content_text, file_name, file_url, is_active) "
                    f"VALUES ({_esc(name)}, {_esc(ttype)}, {_esc(content_text)}, "
                    f"{_esc(file_name)}, {_esc(file_url)}, TRUE) RETURNING id"
                )
                rid = cur.fetchone()[0]
            conn.commit()
            cur.close()
            return resp({"ok": True, "id": rid})

        # ------------------------------------------------------------------ #
        # POST upload_template_file  — base64 upload                        #
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
            s3().put_object(
                Bucket="bucket",
                Key=key,
                Body=file_bytes,
                ContentType="application/octet-stream",
            )
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
                # Читаем docx как zip -> word/document.xml
                try:
                    zf = zipfile.ZipFile(io.BytesIO(file_bytes))
                    xml = zf.read("word/document.xml").decode("utf-8", errors="ignore")
                    text = _re.sub(r"<[^>]+>", " ", xml)
                    text = _re.sub(r"\s+", " ", text)
                except Exception:
                    text = file_bytes.decode("utf-8", errors="ignore")
            else:
                # pdf или txt — берём raw text (pdf без библиотек даст мусор, но попробуем)
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
                "account_number": find([r"р/с[:\s]+([\d]{20})", r"р\.с\.[:\s]+([\d]{20})", r"расчётный счёт[:\s]+([\d]{20})"], text),
                "corr_account":   find([r"к/с[:\s]+([\d]{20})", r"корр\. счёт[:\s]+([\d]{20})"], text),
                "legal_address":  find([r"Юридический адрес[:\s]+([^\n]{10,120})", r"Адрес[:\s]+([^\n]{10,120})"], text),
                "phone":          find([r"Тел[.:]\s*([\+\d\s\(\)\-]{7,20})", r"Телефон[:\s]+([\+\d\s\(\)\-]{7,20})"], text),
                "email":          find([r"[Ee]-?mail[:\s]+([\w.\-]+@[\w.\-]+\.\w+)", r"([\w.\-]+@[\w.\-]+\.\w+)"], text),
                "director_name":  find([r"(?:Генеральный директор|Директор|Руководитель)[:\s]+([А-ЯЁ][а-яё]+\s+[А-ЯЁ][\.А-ЯЁа-яё\s]{2,40})"], text),
                "company_name":   find([r'ООО\s+"([^"]{2,60})"', r"ООО\s+«([^»]{2,60})»", r'АО\s+"([^"]{2,60})"', r"ИП\s+([А-ЯЁ][а-яё]+\s+[А-ЯЁ][\.А-ЯЁ\s]{2,40})"], text),
            }

            # убираем пустые
            filled = {k: v for k, v in requisites.items() if v}
            return resp({"requisites": filled, "fields_found": len(filled)})

        # ------------------------------------------------------------------ #
        # GET list_s3 — список файлов в S3 (для отладки)                    #
        # ------------------------------------------------------------------ #
        if method == "GET" and action == "list_s3":
            prefix = qs.get("prefix", "company/")
            result = s3().list_objects_v2(Bucket="bucket", Prefix=prefix, MaxKeys=50)
            files = [
                {"key": o["Key"], "size": o["Size"], "url": cdn_url(o["Key"])}
                for o in result.get("Contents", [])
            ]
            return resp({"files": files, "count": len(files)})

        # ------------------------------------------------------------------ #
        # DELETE delete_template                                              #
        # ------------------------------------------------------------------ #
        if method == "DELETE" and action == "delete_template":
            tpl_id = qs.get("id") or body.get("id")
            if not tpl_id:
                return resp({"error": "id обязателен"}, 400)
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