"""
Уведомления при отправке ВОР в снабжение:
- Задача в Битрикс24 (снабженец = ответственный, руководители = наблюдатели)
- Max мессенджер — будет добавлен позже
"""
import json, os, urllib.request
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

def send_max_message(user_id: str, text: str) -> dict:
    """Отправка сообщения через Max мессенджер — будет реализовано после создания бота"""
    max_token = os.environ.get("MAX_BOT_TOKEN", "")
    if not max_token:
        return {"ok": False, "error": "MAX_BOT_TOKEN не настроен"}
    try:
        data = json.dumps({"user_id": user_id, "text": text}, ensure_ascii=False).encode()
        req = urllib.request.Request(
            f"https://botapi.max.ru/messages?access_token={max_token}",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            result = json.loads(r.read())
        return {"ok": True} if result.get("message") else {"ok": False, "error": str(result)}
    except Exception as e:
        print(f"[notify] Max error: {e}")
        return {"ok": False, "error": str(e)}

def create_bitrix_task(title: str, description: str, responsible_id: int,
                       auditor_ids: list) -> dict:
    """Создание задачи в Битрикс24 с наблюдателями-руководителями"""
    webhook = os.environ.get("BITRIX24_WEBHOOK", "").rstrip("/")
    if not webhook:
        return {"ok": False, "error": "BITRIX24_WEBHOOK не настроен"}

    fields = {
        "TITLE": title,
        "DESCRIPTION": description,
        "RESPONSIBLE_ID": responsible_id,
        "PRIORITY": "2",
    }
    if auditor_ids:
        fields["AUDITORS"] = auditor_ids

    data = json.dumps({"fields": fields}, ensure_ascii=False).encode("utf-8")
    try:
        req = urllib.request.Request(
            f"{webhook}/tasks.task.add.json", data=data,
            headers={"Content-Type": "application/json"}, method="POST"
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
    """Уведомления о ВОР: задача Битрикс24 + Max (когда будет токен)"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    token = (event.get("headers") or {}).get("X-Auth-Token", "")
    if not token:
        return resp({"error": "Не авторизован"}, 401)

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
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
        sections_text = ", ".join(vor_sections[:5]) if vor_sections else "все разделы"

        cur = conn.cursor()
        cur.execute(
            f"SELECT id, full_name, bitrix_user_id, max_user_id, notify_bitrix "
            f"FROM {S}.staff WHERE role_code = 'supply'"
        )
        supply_staff = cur.fetchall()

        cur.execute(
            f"SELECT id, full_name, bitrix_user_id, max_user_id, notify_bitrix "
            f"FROM {S}.staff WHERE role_code IN ('admin', 'manager')"
        )
        managers = cur.fetchall()
        cur.close()

        bitrix_desc = (
            f"[B]Проект:[/B] {project_name}\n"
            f"[B]Документ:[/B] {doc_name}\n"
            f"[B]Позиций в ВОР:[/B] {vor_count}\n"
            f"[B]Разделы:[/B] {sections_text}\n"
            f"[B]Отправил:[/B] {sender_name}\n\n"
            f"Необходимо запросить коммерческие предложения (КП) от поставщиков "
            f"по всем позициям ведомости объёмов работ."
        )

        max_text = (
            f"📋 ВОР отправлена в снабжение\n"
            f"Проект: {project_name}\n"
            f"Документ: {doc_name}\n"
            f"Позиций: {vor_count} ({sections_text})\n"
            f"Отправил: {sender_name}\n"
            f"Необходимо запросить КП от поставщиков."
        )

        results = {"bitrix_tasks": [], "bitrix_failed": [], "max_sent": [], "max_failed": []}

        # Битрикс — снабженец ответственный, руководители наблюдатели
        manager_bitrix_ids = [r[2] for r in managers if r[2] and r[4]]
        supply_with_bitrix = [r for r in supply_staff if r[2] and r[4]]

        if supply_with_bitrix:
            r = create_bitrix_task(
                title=f"ВОР: запрос КП — {project_name}",
                description=bitrix_desc,
                responsible_id=supply_with_bitrix[0][2],
                auditor_ids=manager_bitrix_ids,
            )
            if r["ok"]:
                results["bitrix_tasks"].append(r["task_id"])
            else:
                results["bitrix_failed"].append(r["error"])
        elif manager_bitrix_ids:
            r = create_bitrix_task(
                title=f"ВОР: запрос КП — {project_name} (назначить снабженца!)",
                description=bitrix_desc,
                responsible_id=manager_bitrix_ids[0],
                auditor_ids=manager_bitrix_ids[1:],
            )
            if r["ok"]:
                results["bitrix_tasks"].append(r["task_id"])
            else:
                results["bitrix_failed"].append(r["error"])

        # Max — снабженцам и руководителям (когда будет токен)
        for row in supply_staff + managers:
            max_uid = row[3]
            if max_uid:
                mr = send_max_message(max_uid, max_text)
                if mr["ok"]:
                    results["max_sent"].append(row[1])
                else:
                    results["max_failed"].append(row[1])

        conn.close()
        return resp({"ok": True, "results": results,
                     "summary": f"Битрикс задач: {len(results['bitrix_tasks'])}, Max: {len(results['max_sent'])}"})

    # ── Получить контакты сотрудников ──────────────────────────────────────
    if action == "get_staff_contacts":
        if staff["role_code"] not in ("admin", "manager", "architect"):
            conn.close()
            return resp({"error": "Нет доступа"}, 403)
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, full_name, role_code, email, bitrix_user_id, max_user_id, notify_bitrix "
            f"FROM {S}.staff ORDER BY role_code, full_name"
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return resp({"staff": [{
            "id": r[0], "full_name": r[1], "role_code": r[2],
            "email": r[3], "bitrix_user_id": r[4],
            "max_user_id": r[5], "notify_bitrix": r[6],
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
            f"UPDATE {S}.staff SET email=%s, bitrix_user_id=%s, max_user_id=%s, notify_bitrix=%s WHERE id=%s",
            (body.get("email"), body.get("bitrix_user_id"), body.get("max_user_id"),
             body.get("notify_bitrix", True), staff_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return resp({"ok": True})

    conn.close()
    return resp({"error": f"Неизвестный action: {action}"}, 400)
