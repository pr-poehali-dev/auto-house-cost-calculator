"""
supplier-api: регистрация/авторизация поставщиков + управление запросами КП (RFQ)
Роутинг через querystring: ?action=register|login|me|profile_update|rfq_list|rfq_get|rfq_create|rfq_award|rfq_close|notify
"""
import json, os, hashlib, secrets, smtplib, urllib.request, urllib.parse
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
import psycopg2

S = "t_p78845984_auto_house_cost_calc"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-Supplier-Token",
}

def db(): return psycopg2.connect(os.environ["DATABASE_URL"])
def hp(pw): return hashlib.sha256(pw.encode()).hexdigest()
def resp(data, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}

def get_staff(conn, token):
    cur = conn.cursor()
    cur.execute(f"SELECT s.id,s.role_code FROM {S}.sessions ss JOIN {S}.staff s ON s.id=ss.staff_id WHERE ss.token=%s AND ss.expires_at>NOW()", (token,))
    r = cur.fetchone(); cur.close()
    return {"id": r[0], "role_code": r[1]} if r else None

def get_supplier(conn, token):
    cur = conn.cursor()
    cur.execute(f"SELECT id,company_name,contact_name,email,phone,categories,region,description,is_verified,is_active FROM {S}.suppliers WHERE token=%s AND token_expires>NOW()", (token,))
    r = cur.fetchone(); cur.close()
    if not r: return None
    return {"id":r[0],"company_name":r[1],"contact_name":r[2],"email":r[3],"phone":r[4],"categories":r[5],"region":r[6],"description":r[7],"is_verified":r[8],"is_active":r[9]}

def send_email(to_email, subject, html_body):
    smtp_email = os.environ.get("SMTP_EMAIL","")
    smtp_pass = os.environ.get("SMTP_PASSWORD","")
    if not smtp_email or not smtp_pass: return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"СтройКалькулятор <{smtp_email}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html", "utf-8"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as srv:
            srv.login(smtp_email, smtp_pass)
            srv.sendmail(smtp_email, to_email, msg.as_string())
        return True
    except: return False

def send_sms(phone, text):
    api_key = os.environ.get("SMSRU_API_KEY","")
    if not api_key: return False
    p = "".join(c for c in phone if c.isdigit())
    if p.startswith("8"): p = "7" + p[1:]
    if not p.startswith("7"): p = "7" + p
    try:
        params = urllib.parse.urlencode({"api_id": api_key, "to": p, "msg": text, "json": 1})
        with urllib.request.urlopen(f"https://sms.ru/sms/send?{params}", timeout=8) as r:
            res = json.loads(r.read().decode())
        return res.get("status") == "OK"
    except: return False

def row_rfq(r):
    d = {"id":r[0],"title":r[1],"construction_address":r[2],"area":r[3],"floors":r[4],"house_type":r[5],"items":r[6],"deadline":str(r[7]) if r[7] else None,"status":r[8],"created_at":str(r[9])}
    if len(r) > 10: d["proposals_count"] = r[10]
    return d

def handler(event, context):
    if event.get("httpMethod") == "OPTIONS": return {"statusCode": 200, "headers": CORS, "body": ""}
    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")
    staff_token = event.get("headers", {}).get("X-Auth-Token", "")
    sup_token = event.get("headers", {}).get("X-Supplier-Token", "")
    body = {}
    if event.get("body"):
        try: body = json.loads(event["body"])
        except: pass

    conn = db()

    # ══ SUPPLIER AUTH ══════════════════════════════════════════

    # register
    if action == "register" or body.get("action") == "register":
        for f in ["company_name","contact_name","email","password","categories"]:
            if not body.get(f): conn.close(); return resp({"error": f"Поле {f} обязательно"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT id FROM {S}.suppliers WHERE email=%s", (body["email"],))
        if cur.fetchone(): cur.close(); conn.close(); return resp({"error":"Email уже зарегистрирован"}, 409)
        tok = secrets.token_hex(32)
        exp = datetime.now(timezone.utc) + timedelta(days=90)
        cur.execute(f"""
            INSERT INTO {S}.suppliers (company_name,contact_name,email,phone,categories,region,description,password_hash,token,token_expires)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        """, (body["company_name"],body["contact_name"],body["email"],body.get("phone",""),
              body["categories"],body.get("region",""),body.get("description",""),hp(body["password"]),tok,exp))
        new_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return resp({"ok":True,"token":tok,"supplier_id":new_id})

    # login
    if action == "login" or body.get("action") == "login" or ("email" in body and "password" in body and not action):
        cur = conn.cursor()
        cur.execute(f"SELECT id,password_hash,company_name,is_active FROM {S}.suppliers WHERE email=%s", (body.get("email",""),))
        r = cur.fetchone(); cur.close()
        if not r or hp(body.get("password","")) != r[1]: conn.close(); return resp({"error":"Неверный email или пароль"}, 401)
        if not r[3]: conn.close(); return resp({"error":"Аккаунт заблокирован"}, 403)
        tok = secrets.token_hex(32)
        exp = datetime.now(timezone.utc) + timedelta(days=90)
        cur2 = conn.cursor()
        cur2.execute(f"UPDATE {S}.suppliers SET token=%s,token_expires=%s WHERE id=%s", (tok,exp,r[0]))
        conn.commit(); cur2.close(); conn.close()
        return resp({"ok":True,"token":tok,"supplier":{"id":r[0],"company_name":r[2]}})

    # me (supplier)
    if action == "me" and sup_token:
        s = get_supplier(conn, sup_token)
        conn.close()
        if not s: return resp({"error":"Сессия истекла"}, 401)
        return resp({"supplier": s})

    # profile update
    if action == "profile_update" and sup_token and method == "PUT":
        s = get_supplier(conn, sup_token)
        if not s: conn.close(); return resp({"error":"Сессия истекла"}, 401)
        fields, vals = [], []
        for k in ["company_name","contact_name","phone","categories","region","description"]:
            if k in body: fields.append(f"{k}=%s"); vals.append(body[k])
        if fields:
            vals.append(s["id"])
            cur = conn.cursor()
            cur.execute(f"UPDATE {S}.suppliers SET {','.join(fields)} WHERE id=%s", vals)
            conn.commit(); cur.close()
        conn.close(); return resp({"ok": True})

    # ══ RFQ (staff: снабженец) ════════════════════════════════

    if action in ("rfq_list","rfq_get","rfq_create","rfq_award","rfq_close","notify","suppliers_list","verify_supplier") and staff_token:
        staff = get_staff(conn, staff_token)
        if not staff: conn.close(); return resp({"error":"Сессия истекла"}, 401)
        if staff["role_code"] != "supply": conn.close(); return resp({"error":"Только снабженец"}, 403)

        # список поставщиков
        if action == "suppliers_list":
            cur = conn.cursor()
            cur.execute(f"SELECT id,company_name,contact_name,email,phone,categories,region,is_verified,created_at FROM {S}.suppliers ORDER BY created_at DESC")
            rows = cur.fetchall(); cur.close(); conn.close()
            return resp({"suppliers":[{"id":r[0],"company_name":r[1],"contact_name":r[2],"email":r[3],"phone":r[4],"categories":r[5],"region":r[6],"is_verified":r[7],"created_at":str(r[8])} for r in rows]})

        # верификация поставщика
        if action == "verify_supplier":
            sup_id = body.get("supplier_id")
            verified = body.get("is_verified", True)
            if not sup_id: conn.close(); return resp({"error":"supplier_id обязателен"}, 400)
            cur = conn.cursor()
            cur.execute(f"UPDATE {S}.suppliers SET is_verified=%s WHERE id=%s", (verified, sup_id))
            conn.commit(); cur.close(); conn.close()
            return resp({"ok": True})

        # rfq_list
        if action == "rfq_list":
            cur = conn.cursor()
            cur.execute(f"""
                SELECT r.id,r.title,r.construction_address,r.area,r.floors,r.house_type,r.items,r.deadline,r.status,r.created_at,
                  COUNT(p.id) as cnt
                FROM {S}.rfq r LEFT JOIN {S}.proposals p ON p.rfq_id=r.id
                GROUP BY r.id ORDER BY r.created_at DESC
            """)
            rows = cur.fetchall(); cur.close(); conn.close()
            return resp({"rfqs": [row_rfq(r) for r in rows]})

        # rfq_get
        if action == "rfq_get":
            rfq_id = body.get("rfq_id") or qs.get("rfq_id")
            if not rfq_id: conn.close(); return resp({"error":"rfq_id обязателен"}, 400)
            cur = conn.cursor()
            cur.execute(f"SELECT id,title,construction_address,area,floors,house_type,items,deadline,status,created_at FROM {S}.rfq WHERE id=%s", (rfq_id,))
            r = cur.fetchone()
            if not r: cur.close(); conn.close(); return resp({"error":"Не найден"}, 404)
            rfq = row_rfq(r)
            cur.execute(f"""
                SELECT p.id,p.supplier_id,s.company_name,s.phone,s.email,p.items,p.total_amount,p.delivery_days,p.comment,p.status,p.submitted_at
                FROM {S}.proposals p JOIN {S}.suppliers s ON s.id=p.supplier_id
                WHERE p.rfq_id=%s ORDER BY p.total_amount ASC
            """, (rfq_id,))
            props = cur.fetchall(); cur.close(); conn.close()
            proposals = [{"id":p[0],"supplier_id":p[1],"company_name":p[2],"phone":p[3],"email":p[4],"items":p[5],"total_amount":float(p[6]),"delivery_days":p[7],"comment":p[8],"status":p[9],"submitted_at":str(p[10])} for p in props]
            rfq["proposals"] = proposals
            if proposals: rfq["best_proposal"] = proposals[0]
            return resp({"rfq": rfq})

        # rfq_create
        if action == "rfq_create":
            for f in ["title","construction_address","items"]:
                if not body.get(f): conn.close(); return resp({"error":f"Поле {f} обязательно"}, 400)
            cur = conn.cursor()
            cur.execute(f"""
                INSERT INTO {S}.rfq (title,construction_address,area,floors,house_type,items,deadline,created_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """, (body["title"],body["construction_address"],body.get("area"),body.get("floors"),
                  body.get("house_type",""),json.dumps(body["items"],ensure_ascii=False),
                  body.get("deadline"),staff["id"]))
            new_id = cur.fetchone()[0]
            conn.commit(); cur.close(); conn.close()
            return resp({"ok":True,"id":new_id})

        # rfq_award
        if action == "rfq_award":
            rfq_id = body.get("rfq_id")
            proposal_id = body.get("proposal_id")
            if not rfq_id or not proposal_id: conn.close(); return resp({"error":"rfq_id и proposal_id обязательны"}, 400)
            cur = conn.cursor()
            cur.execute(f"UPDATE {S}.proposals SET status='winner' WHERE id=%s AND rfq_id=%s", (proposal_id,rfq_id))
            cur.execute(f"UPDATE {S}.proposals SET status='rejected' WHERE rfq_id=%s AND id!=%s", (rfq_id,proposal_id))
            cur.execute(f"UPDATE {S}.rfq SET status='awarded',updated_at=NOW() WHERE id=%s", (rfq_id,))
            conn.commit(); cur.close(); conn.close()
            return resp({"ok":True})

        # rfq_close
        if action == "rfq_close":
            rfq_id = body.get("rfq_id")
            if not rfq_id: conn.close(); return resp({"error":"rfq_id обязателен"}, 400)
            cur = conn.cursor()
            cur.execute(f"UPDATE {S}.rfq SET status='closed',updated_at=NOW() WHERE id=%s", (rfq_id,))
            conn.commit(); cur.close(); conn.close()
            return resp({"ok":True})

        # notify
        if action == "notify":
            rfq_id = body.get("rfq_id")
            channels = body.get("channels",["email"])
            cat = body.get("category","")
            if not rfq_id: conn.close(); return resp({"error":"rfq_id обязателен"}, 400)
            cur = conn.cursor()
            cur.execute(f"SELECT title,construction_address,deadline FROM {S}.rfq WHERE id=%s", (rfq_id,))
            rfq_row = cur.fetchone()
            if not rfq_row: cur.close(); conn.close(); return resp({"error":"RFQ не найден"}, 404)
            rfq_title, address, deadline = rfq_row
            q = f"SELECT id,company_name,email,phone FROM {S}.suppliers WHERE is_active=TRUE AND is_verified=TRUE"
            params = []
            if cat: q += " AND categories ILIKE %s"; params.append(f"%{cat}%")
            cur.execute(q, params)
            sups = cur.fetchall(); cur.close()
            rfq_url = f"https://poehali.dev/supplier?rfq={rfq_id}"
            dl = str(deadline) if deadline else "не указан"
            results = {"sent_email":0,"sent_sms":0,"failed":0,"total":len(sups)}
            for sid,company,email,phone in sups:
                html = f"""<div style="font-family:Arial,sans-serif;background:#0A0D14;color:#fff;padding:30px;border-radius:12px;">
                  <h2 style="color:#FF6B1A;">Новый запрос КП — {rfq_title}</h2>
                  <p>Уважаемая компания <b>{company}</b>!</p>
                  <p><b>Объект:</b> {rfq_title}<br><b>Адрес:</b> {address}<br><b>Срок подачи:</b> {dl}</p>
                  <a href="{rfq_url}" style="display:inline-block;background:#FF6B1A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Подать предложение →</a>
                </div>"""
                e_ok = send_email(email, f"Запрос КП: {rfq_title}", html) if "email" in channels and email else False
                s_ok = send_sms(phone, f"Новый запрос КП: {rfq_title[:40]}. Адрес: {address[:30]}. Срок: {dl}. {rfq_url}") if "sms" in channels and phone else False
                if e_ok:
                    results["sent_email"] += 1
                    c2 = conn.cursor(); c2.execute(f"INSERT INTO {S}.notification_log (supplier_id,rfq_id,channel) VALUES (%s,%s,'email')", (sid,rfq_id)); conn.commit(); c2.close()
                if s_ok:
                    results["sent_sms"] += 1
                    c3 = conn.cursor(); c3.execute(f"INSERT INTO {S}.notification_log (supplier_id,rfq_id,channel) VALUES (%s,%s,'sms')", (sid,rfq_id)); conn.commit(); c3.close()
                if not e_ok and not s_ok: results["failed"] += 1
            conn.close(); return resp({"ok":True,"results":results})

    # ══ RFQ (supplier: просмотр + подача предложений) ════════

    if action in ("rfq_list","rfq_get","proposal_submit","my_proposals") and sup_token:
        supplier = get_supplier(conn, sup_token)
        if not supplier: conn.close(); return resp({"error":"Сессия истекла"}, 401)

        if action == "rfq_list":
            cur = conn.cursor()
            cur.execute(f"SELECT id,title,construction_address,area,floors,house_type,items,deadline,status,created_at FROM {S}.rfq WHERE status='open' ORDER BY created_at DESC")
            rows = cur.fetchall(); cur.close(); conn.close()
            return resp({"rfqs":[row_rfq(r) for r in rows]})

        if action == "rfq_get":
            rfq_id = body.get("rfq_id") or qs.get("rfq_id")
            if not rfq_id: conn.close(); return resp({"error":"rfq_id обязателен"}, 400)
            cur = conn.cursor()
            cur.execute(f"SELECT id,title,construction_address,area,floors,house_type,items,deadline,status,created_at FROM {S}.rfq WHERE id=%s AND status='open'", (rfq_id,))
            r = cur.fetchone()
            if not r: cur.close(); conn.close(); return resp({"error":"Не найден"}, 404)
            rfq = row_rfq(r)
            cur.execute(f"SELECT id,items,total_amount,delivery_days,comment,status FROM {S}.proposals WHERE rfq_id=%s AND supplier_id=%s", (rfq_id,supplier["id"]))
            my = cur.fetchone(); cur.close(); conn.close()
            if my: rfq["my_proposal"] = {"id":my[0],"items":my[1],"total_amount":float(my[2]),"delivery_days":my[3],"comment":my[4],"status":my[5]}
            return resp({"rfq": rfq})

        if action == "proposal_submit":
            rfq_id = body.get("rfq_id")
            items = body.get("items",[])
            if not rfq_id or not items: conn.close(); return resp({"error":"rfq_id и items обязательны"}, 400)
            total = sum(float(i.get("total",0)) for i in items)
            cur = conn.cursor()
            cur.execute(f"""
                INSERT INTO {S}.proposals (rfq_id,supplier_id,items,total_amount,delivery_days,comment)
                VALUES (%s,%s,%s,%s,%s,%s)
                ON CONFLICT (rfq_id,supplier_id) DO UPDATE
                SET items=EXCLUDED.items,total_amount=EXCLUDED.total_amount,
                    delivery_days=EXCLUDED.delivery_days,comment=EXCLUDED.comment,submitted_at=NOW()
                RETURNING id
            """, (rfq_id,supplier["id"],json.dumps(items,ensure_ascii=False),total,body.get("delivery_days"),body.get("comment","")))
            pid = cur.fetchone()[0]; conn.commit(); cur.close(); conn.close()
            return resp({"ok":True,"id":pid})

        if action == "my_proposals":
            cur = conn.cursor()
            cur.execute(f"""
                SELECT p.id,p.rfq_id,r.title,r.construction_address,p.total_amount,p.delivery_days,p.status,p.submitted_at
                FROM {S}.proposals p JOIN {S}.rfq r ON r.id=p.rfq_id
                WHERE p.supplier_id=%s ORDER BY p.submitted_at DESC
            """, (supplier["id"],))
            rows = cur.fetchall(); cur.close(); conn.close()
            return resp({"proposals":[{"id":r[0],"rfq_id":r[1],"rfq_title":r[2],"address":r[3],"total_amount":float(r[4]),"delivery_days":r[5],"status":r[6],"submitted_at":str(r[7])} for r in rows]})

    conn.close()
    return resp({"error":"Not found"}, 404)
