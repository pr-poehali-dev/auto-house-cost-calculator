"""
Уведомления при отправке ВОР в снабжение:
- SMS через smsc.ru снабженцам и руководителям
- Задача в Битрикс24 с наблюдателями-руководителями
"""
import json, os, urllib.request, urllib.parse
import psycopg2

S = os.environ.get("MAIN_DB_SCHEMA", "t_p78845984_auto_house_cost_calc")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def resp(data, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}

def get_staff(conn, token):
    cur = conn.cursor()
    cur.execute(
        f"SELECT s.id, s.full_name, s.role_code FROM {S}.sessions ss "
        f"JOIN {S}.staff s ON s.id = ss.staff_id "
        f"WHERE ss.token = %s AND ss.expires_at > NOW()", (token,))
    r = cur.fetchone()
    cur.close()
    return {"id": r[0], "full_name": r[1], "role_code": r[2]} if r else None

def send_sms(phone: str, text: str) -> dict:
    """Отправка SMS через smsc.ru"""
    login = os.environ.get("SMSC_LOGIN", "")
    password = os.environ.get("SMSC_PASSWORD", "")
    if not login or not password:
        print("[notify] SMSC не настроен, SMS пропущена")
        return {"ok": False, "error": "SMSC не настроен"}

    clean_phone = "".join(c for c in phone if c.isdigit() or c == "+")
    if not clean_phone:
        return {"ok": False, "error": "Пустой номер"}

    params = urllib.parse.urlencode({
        "login": login,
        "psw": password,
        "phones": clean_phone,
        "mes": text,
        "fmt": 3,
        "charset": "utf-8",
    })
    url = f"https://smsc.ru/sys/send.php?{params}"
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            result = json.loads(r.read())
        print(f"[notify] SMS → {clean_phone}: {result}")
        if result.get("error_code"):
            return {"ok": False, "error": result.get("error", "Ошибка SMS")}
        return {"ok": True, "id": result.get("id")}
    except Exception as e:
        print(f"[notify] SMS error: {e}")
        return {"ok": False, "error": str(e)}

def create_bitrix_task(title: str, description: str, responsible_id: int,
                        auditor_ids: list, deadline: str = None) -> dict:
    """Создание задачи в Битрикс24 с наблюдателями"""
    webhook = os.environ.get("BITRIX24_WEBHOOK", "").rstrip("/")
    if not webhook:
        print("[notify] BITRIX24_WEBHOOK не настроен")
        return {"ok": False, "error": "Битрикс не настроен"}

    fields = {
        "TITLE": title,
        "DESCRIPTION": description,
        "RESPONSIBLE_ID": responsible_id,
        "PRIORITY": "2",
        "GROUP_ID": 0,
    }
    if auditor_ids:
        fields["AUDITORS"] = auditor_ids
    if deadline:
        fields["DEADLINE"] = deadline

    data = json.dumps({"fields": fields}, ensure_ascii=False).encode("utf-8")
    url = f"{webhook}/tasks.task.add.json"
    try:
        req = urllib.request.Request(
            url, data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            result = json.loads(r.read())
        print(f"[notify] Bitrix task: {result}")
        if result.get("error"):
            return {"ok": False, "error": result.get("error_description", result["error"])}
        task_id = result.get("result", {}).get("task", {}).get("id")
        return {"ok": True, "task_id": task_id}
    except Exception as e:
        print(f"[notify] Bitrix error: {e}")
        return {"ok": False, "error": str(e)}

def handler(event: dict, context) -> dict:
    """Отправка уведомлений о ВОР в снабжение: SMS + задача Битрикс24"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    token = (event.get("headers") or {}).get("X-Auth-Token", "")
    if not token:
        return resp({"error": "Не авторизован"}, 401)

    body = {}
    raw_body = event.get("body") or ""
    if raw_body:
        try:
            body = json.loads(raw_body)
        except:
            pass

    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "send_vor_notification")

    conn = db()
    staff = get_staff(conn, token)
    if not staff:
        conn.close()
        return resp({"error": "Сессия истекла"}, 401)

    # ── Отправить уведомление о ВОР ────────────────────────────────────────
    if action == "send_vor_notification":
        project_name = body.get("project_name", "Проект")
        vor_count = int(body.get("vor_count", 0))
        vor_sections = body.get("vor_sections", [])
        doc_name = body.get("doc_name", "")
        sender_name = staff["full_name"]

        # Собираем получателей из БД
        cur = conn.cursor()

        # Снабженцы — получают задачу как ответственные
        cur.execute(
            f"SELECT id, full_name, phone, email, bitrix_user_id, notify_sms, notify_bitrix "
            f"FROM {S}.staff WHERE role_code = 'supply'"
        )
        supply_staff = cur.fetchall()

        # Руководители — наблюдатели в Битриксе, получают SMS
        cur.execute(
            f"SELECT id, full_name, phone, email, bitrix_user_id, notify_sms, notify_bitrix "
            f"FROM {S}.staff WHERE role_code IN ('admin', 'manager')"
        )
        managers = cur.fetchall()
        cur.close()

        sections_text = ", ".join(vor_sections[:5]) if vor_sections else "все разделы"
        sms_text = (
            f"ВОР отправлена в снабжение\n"
            f"Проект: {project_name}\n"
            f"Документ: {doc_name}\n"
            f"Позиций: {vor_count} ({sections_text})\n"
            f"Отправил: {sender_name}"
        )

        bitrix_desc = (
            f"[B]Проект:[/B] {project_name}\n"
            f"[B]Документ:[/B] {doc_name}\n"
            f"[B]Позиций в ВОР:[/B] {vor_count}\n"
            f"[B]Разделы:[/B] {sections_text}\n"
            f"[B]Отправил:[/B] {sender_name}\n\n"
            f"Необходимо запросить коммерческие предложения (КП) от поставщиков "
            f"по всем позициям ведомости объёмов работ."
        )

        results = {
            "sms_sent": [],
            "sms_failed": [],
            "bitrix_tasks": [],
            "bitrix_failed": [],
        }

        # SMS снабженцам
        for row in supply_staff:
            sid, sname, sphone, semail, sbitrix, notify_sms, _ = row
            if notify_sms and sphone:
                r = send_sms(sphone, sms_text)
                if r["ok"]:
                    results["sms_sent"].append(sname)
                else:
                    results["sms_failed"].append({"name": sname, "error": r["error"]})

        # SMS руководителям
        for row in managers:
            mid, mname, mphone, memail, mbitrix, notify_sms, _ = row
            if notify_sms and mphone:
                mgr_sms = sms_text + f"\n[Уведомление руководителю]"
                r = send_sms(mphone, mgr_sms)
                if r["ok"]:
                    results["sms_sent"].append(mname)
                else:
                    results["sms_failed"].append({"name": mname, "error": r["error"]})

        # Битрикс задача — ответственный первый снабженец с bitrix_user_id
        manager_bitrix_ids = [row[4] for row in managers if row[4] and row[6]]
        supply_with_bitrix = [row for row in supply_staff if row[4] and row[6]]

        if supply_with_bitrix:
            responsible = supply_with_bitrix[0][4]
            task_title = f"ВОР: запрос КП — {project_name}"
            r = create_bitrix_task(
                title=task_title,
                description=bitrix_desc,
                responsible_id=responsible,
                auditor_ids=manager_bitrix_ids,
            )
            if r["ok"]:
                results["bitrix_tasks"].append({"task_id": r["task_id"], "title": task_title})
            else:
                results["bitrix_failed"].append(r["error"])
        elif manager_bitrix_ids:
            # Если снабженца с Битрикс ID нет — ставим задачу первому руководителю
            responsible = manager_bitrix_ids[0]
            task_title = f"ВОР: запрос КП — {project_name} (назначить снабженца!)"
            r = create_bitrix_task(
                title=task_title,
                description=bitrix_desc,
                responsible_id=responsible,
                auditor_ids=manager_bitrix_ids[1:],
            )
            if r["ok"]:
                results["bitrix_tasks"].append({"task_id": r["task_id"], "title": task_title})
            else:
                results["bitrix_failed"].append(r["error"])

        conn.close()
        return resp({
            "ok": True,
            "results": results,
            "summary": (
                f"SMS отправлено: {len(results['sms_sent'])}, "
                f"Задач Битрикс: {len(results['bitrix_tasks'])}"
            )
        })

    # ── Получить контакты сотрудников ──────────────────────────────────────
    if action == "get_staff_contacts":
        if staff["role_code"] not in ("admin", "manager", "architect"):
            conn.close()
            return resp({"error": "Нет доступа"}, 403)
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, full_name, role_code, phone, email, bitrix_user_id, notify_sms, notify_bitrix "
            f"FROM {S}.staff ORDER BY role_code, full_name"
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return resp({"staff": [{
            "id": r[0], "full_name": r[1], "role_code": r[2],
            "phone": r[3], "email": r[4], "bitrix_user_id": r[5],
            "notify_sms": r[6], "notify_bitrix": r[7],
        } for r in rows]})

    # ── Обновить контакты сотрудника ────────────────────────────────────────
    if action == "update_staff_contacts":
        if staff["role_code"] not in ("admin", "manager"):
            conn.close()
            return resp({"error": "Нет доступа"}, 403)
        staff_id = body.get("staff_id")
        if not staff_id:
            conn.close()
            return resp({"error": "staff_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"UPDATE {S}.staff SET phone=%s, email=%s, bitrix_user_id=%s, "
            f"notify_sms=%s, notify_bitrix=%s WHERE id=%s",
            (body.get("phone"), body.get("email"), body.get("bitrix_user_id"),
             body.get("notify_sms", True), body.get("notify_bitrix", True), staff_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return resp({"ok": True})

    conn.close()
    return resp({"error": f"Неизвестный action: {action}"}, 400)