"""
CRM API — управление лидами, воронка продаж, карточка клиента.
Этапы: new | call_planned | qualified | kp_sent | meeting | contract | in_work | done | rejected
"""
import json, os
import psycopg2

S = "t_p78845984_auto_house_cost_calc"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

STAGES = ["new","call_planned","qualified","kp_sent","meeting","contract","in_work","done","rejected"]

STAGE_LABELS = {
    "new":          "Новый лид",
    "call_planned": "Звонок запланирован",
    "qualified":    "Квалифицирован",
    "kp_sent":      "КП отправлено",
    "meeting":      "Встреча",
    "contract":     "Договор",
    "in_work":      "В работе",
    "done":         "Сдан",
    "rejected":     "Отказ",
}

def db(): return psycopg2.connect(os.environ["DATABASE_URL"])

def resp(data, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}

def get_staff(conn, token):
    cur = conn.cursor()
    cur.execute(
        f"SELECT s.id, s.full_name, s.role_code FROM {S}.sessions ss "
        f"JOIN {S}.staff s ON s.id = ss.staff_id "
        f"WHERE ss.token = %s AND ss.expires_at > NOW()", (token,))
    r = cur.fetchone(); cur.close()
    return {"id": r[0], "full_name": r[1], "role_code": r[2]} if r else None

def lead_row(r):
    return {
        "id": r[0], "name": r[1], "phone": r[2], "email": r[3],
        "source_id": r[4], "source_name": r[5], "source_detail": r[6],
        "stage": r[7], "stage_label": STAGE_LABELS.get(r[7], r[7]),
        "stage_changed_at": str(r[8]) if r[8] else None,
        "rejected_reason": r[9],
        "family_size": r[10], "living_type": r[11],
        "area_desired": r[12], "floors_desired": r[13], "rooms_desired": r[14],
        "extra_rooms": r[15], "wall_material_pref": r[16],
        "has_land": r[17], "land_location": r[18],
        "budget": r[19], "payment_type": r[20], "start_date_plan": r[21],
        "project_id": r[22], "project_name": r[23],
        "assigned_to": r[24], "assigned_name": r[25],
        "created_by": r[26], "created_by_name": r[27],
        "created_at": str(r[28]) if r[28] else None,
        "updated_at": str(r[29]) if r[29] else None,
        "next_contact_at": str(r[30]) if r[30] else None,
        "is_active": r[31],
    }

LEAD_SELECT = f"""
    SELECT l.id, l.name, l.phone, l.email,
           l.source_id, ls.name, l.source_detail,
           l.stage, l.stage_changed_at, l.rejected_reason,
           l.family_size, l.living_type,
           l.area_desired, l.floors_desired, l.rooms_desired,
           l.extra_rooms, l.wall_material_pref,
           l.has_land, l.land_location,
           l.budget, l.payment_type, l.start_date_plan,
           l.project_id, l.project_name,
           l.assigned_to, sa.full_name,
           l.created_by, sc.full_name,
           l.created_at, l.updated_at, l.next_contact_at, l.is_active
    FROM {S}.leads l
    LEFT JOIN {S}.lead_sources ls ON ls.id = l.source_id
    LEFT JOIN {S}.staff sa ON sa.id = l.assigned_to
    LEFT JOIN {S}.staff sc ON sc.id = l.created_by
"""

def handler(event: dict, context) -> dict:
    """CRM: управление лидами и воронкой продаж"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    token = (event.get("headers") or {}).get("X-Auth-Token", "")
    if not token:
        return resp({"error": "Не авторизован"}, 401)

    body = {}
    if event.get("body"):
        try: body = json.loads(event["body"])
        except: pass

    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")

    conn = db()
    staff = get_staff(conn, token)
    if not staff:
        conn.close(); return resp({"error": "Сессия истекла"}, 401)

    role = staff["role_code"]

    # ── Список источников ────────────────────────────────────────────────────
    if action == "sources":
        cur = conn.cursor()
        cur.execute(f"SELECT id, name, type FROM {S}.lead_sources WHERE is_active=TRUE ORDER BY id")
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"sources": [{"id": r[0], "name": r[1], "type": r[2]} for r in rows]})

    # ── Список лидов (канбан / список) ───────────────────────────────────────
    if action == "list":
        stage = qs.get("stage")
        assigned = qs.get("assigned_to")
        search = qs.get("search", "").strip()
        cur = conn.cursor()
        where = ["l.is_active = TRUE"]
        params = []
        if stage and stage != "all":
            where.append("l.stage = %s"); params.append(stage)
        if assigned:
            where.append("l.assigned_to = %s"); params.append(assigned)
        if search:
            where.append("(l.name ILIKE %s OR l.phone ILIKE %s OR l.email ILIKE %s)")
            params += [f"%{search}%", f"%{search}%", f"%{search}%"]
        w = " WHERE " + " AND ".join(where)
        cur.execute(LEAD_SELECT + w + " ORDER BY l.created_at DESC LIMIT 200", params)
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"leads": [lead_row(r) for r in rows], "stages": STAGE_LABELS})

    # ── Канбан: кол-во по этапам ─────────────────────────────────────────────
    if action == "kanban_counts":
        cur = conn.cursor()
        cur.execute(f"SELECT stage, COUNT(*) FROM {S}.leads WHERE is_active=TRUE GROUP BY stage")
        rows = cur.fetchall(); cur.close(); conn.close()
        counts = {r[0]: r[1] for r in rows}
        return resp({"counts": {s: counts.get(s, 0) for s in STAGES}, "stages": STAGE_LABELS})

    # ── Получить один лид ────────────────────────────────────────────────────
    if action == "get":
        lid = qs.get("lead_id")
        if not lid: conn.close(); return resp({"error": "lead_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(LEAD_SELECT + " WHERE l.id = %s", (lid,))
        r = cur.fetchone()
        if not r: cur.close(); conn.close(); return resp({"error": "Не найден"}, 404)
        lead = lead_row(r)
        # История событий
        cur.execute(
            f"SELECT le.id, le.type, le.content, le.old_stage, le.new_stage, le.created_at, s.full_name "
            f"FROM {S}.lead_events le LEFT JOIN {S}.staff s ON s.id = le.staff_id "
            f"WHERE le.lead_id = %s ORDER BY le.created_at DESC", (lid,))
        events = [{"id": e[0], "type": e[1], "content": e[2], "old_stage": e[3],
                   "new_stage": e[4], "created_at": str(e[5]), "by": e[6]} for e in cur.fetchall()]
        lead["events"] = events
        cur.close(); conn.close()
        return resp({"lead": lead})

    # ── Создать лид ──────────────────────────────────────────────────────────
    if action == "create":
        name = body.get("name", "").strip()
        if not name: conn.close(); return resp({"error": "Имя обязательно"}, 400)
        cur = conn.cursor()
        cur.execute(f"""
            INSERT INTO {S}.leads
            (name, phone, email, source_id, source_detail, stage,
             family_size, living_type, area_desired, floors_desired, rooms_desired,
             extra_rooms, wall_material_pref, has_land, land_location,
             budget, payment_type, start_date_plan,
             project_id, project_name, assigned_to, created_by, next_contact_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id""",
            (name, body.get("phone"), body.get("email"),
             body.get("source_id"), body.get("source_detail"),
             body.get("stage", "new"),
             body.get("family_size"), body.get("living_type"),
             body.get("area_desired"), body.get("floors_desired"), body.get("rooms_desired"),
             body.get("extra_rooms"), body.get("wall_material_pref"),
             body.get("has_land"), body.get("land_location"),
             body.get("budget"), body.get("payment_type"), body.get("start_date_plan"),
             body.get("project_id"), body.get("project_name"),
             body.get("assigned_to") or staff["id"], staff["id"],
             body.get("next_contact_at")))
        new_id = cur.fetchone()[0]
        # Событие создания
        cur.execute(f"INSERT INTO {S}.lead_events (lead_id, type, content, new_stage, staff_id) VALUES (%s,'created',%s,'new',%s)",
                    (new_id, f"Лид создан: {name}", staff["id"]))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True, "id": new_id})

    # ── Обновить лид (квалификация, данные) ──────────────────────────────────
    if action == "update":
        lid = body.get("lead_id")
        if not lid: conn.close(); return resp({"error": "lead_id обязателен"}, 400)
        editable = ["name","phone","email","source_id","source_detail",
                    "family_size","living_type","area_desired","floors_desired","rooms_desired",
                    "extra_rooms","wall_material_pref","has_land","land_location",
                    "budget","payment_type","start_date_plan",
                    "project_id","project_name","assigned_to","next_contact_at","rejected_reason"]
        fields, vals = [], []
        for k in editable:
            if k in body: fields.append(f"{k}=%s"); vals.append(body[k])
        if not fields: conn.close(); return resp({"error": "Нет полей"}, 400)
        fields.append("updated_at=NOW()"); vals.append(lid)
        cur = conn.cursor()
        cur.execute(f"UPDATE {S}.leads SET {','.join(fields)} WHERE id=%s", vals)
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True})

    # ── Сменить этап ─────────────────────────────────────────────────────────
    if action == "set_stage":
        lid = body.get("lead_id")
        new_stage = body.get("stage")
        comment = body.get("comment", "")
        if not lid or not new_stage: conn.close(); return resp({"error": "lead_id и stage обязательны"}, 400)
        if new_stage not in STAGES: conn.close(); return resp({"error": f"Неверный этап: {new_stage}"}, 400)
        cur = conn.cursor()
        cur.execute(f"SELECT stage FROM {S}.leads WHERE id=%s", (lid,))
        row = cur.fetchone()
        if not row: cur.close(); conn.close(); return resp({"error": "Лид не найден"}, 404)
        old_stage = row[0]
        cur.execute(
            f"UPDATE {S}.leads SET stage=%s, stage_changed_at=NOW(), updated_at=NOW(), "
            f"rejected_reason=%s WHERE id=%s",
            (new_stage, body.get("rejected_reason") if new_stage == "rejected" else None, lid))
        cur.execute(
            f"INSERT INTO {S}.lead_events (lead_id, type, content, old_stage, new_stage, staff_id) "
            f"VALUES (%s,'stage_change',%s,%s,%s,%s)",
            (lid, comment or f"{STAGE_LABELS.get(old_stage,old_stage)} → {STAGE_LABELS.get(new_stage,new_stage)}",
             old_stage, new_stage, staff["id"]))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True, "old_stage": old_stage, "new_stage": new_stage})

    # ── Добавить комментарий / событие ───────────────────────────────────────
    if action == "add_event":
        lid = body.get("lead_id")
        etype = body.get("type", "comment")
        content = body.get("content", "").strip()
        if not lid or not content: conn.close(); return resp({"error": "lead_id и content обязательны"}, 400)
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {S}.lead_events (lead_id, type, content, staff_id) VALUES (%s,%s,%s,%s) RETURNING id",
            (lid, etype, content, staff["id"]))
        eid = cur.fetchone()[0]
        cur.execute(f"UPDATE {S}.leads SET updated_at=NOW() WHERE id=%s", (lid,))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True, "id": eid})

    # ── Удалить (архивировать) лид ────────────────────────────────────────────
    if action == "archive":
        lid = body.get("lead_id")
        if not lid: conn.close(); return resp({"error": "lead_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"UPDATE {S}.leads SET is_active=FALSE WHERE id=%s", (lid,))
        conn.commit(); cur.close(); conn.close()
        return resp({"ok": True})

    # ── Статистика для отчётов ────────────────────────────────────────────────
    if action == "stats":
        cur = conn.cursor()
        cur.execute(f"""
            SELECT
                COUNT(*) FILTER (WHERE is_active=TRUE) as total,
                COUNT(*) FILTER (WHERE stage='done' AND is_active=TRUE) as done,
                COUNT(*) FILTER (WHERE stage='rejected' AND is_active=TRUE) as rejected,
                COUNT(*) FILTER (WHERE stage NOT IN ('done','rejected') AND is_active=TRUE) as active,
                COALESCE(SUM(budget) FILTER (WHERE stage='done' AND is_active=TRUE), 0) as revenue,
                COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days' AND is_active=TRUE) as new_week
            FROM {S}.leads""")
        r = cur.fetchone()
        # По источникам
        cur.execute(f"""
            SELECT ls.name, COUNT(l.id)
            FROM {S}.leads l
            LEFT JOIN {S}.lead_sources ls ON ls.id = l.source_id
            WHERE l.is_active=TRUE
            GROUP BY ls.name ORDER BY COUNT(l.id) DESC""")
        by_source = [{"source": r[0] or "Не указан", "count": r[1]} for r in cur.fetchall()]
        # По менеджерам
        cur.execute(f"""
            SELECT s.full_name, COUNT(l.id), COUNT(*) FILTER (WHERE l.stage='done')
            FROM {S}.leads l JOIN {S}.staff s ON s.id = l.assigned_to
            WHERE l.is_active=TRUE GROUP BY s.full_name ORDER BY COUNT(l.id) DESC""")
        by_manager = [{"name": r[0], "total": r[1], "done": r[2]} for r in cur.fetchall()]
        cur.close(); conn.close()
        return resp({
            "total": r[0], "done": r[1], "rejected": r[2], "active": r[3],
            "revenue": r[4], "new_week": r[5],
            "conversion": round(r[1] / r[0] * 100, 1) if r[0] else 0,
            "by_source": by_source, "by_manager": by_manager,
        })

    # ── Список сотрудников для назначения ─────────────────────────────────────
    if action == "managers_list":
        cur = conn.cursor()
        cur.execute(f"SELECT id, full_name, role_code FROM {S}.staff WHERE role_code IN ('manager','admin','architect') ORDER BY full_name")
        rows = cur.fetchall(); cur.close(); conn.close()
        return resp({"managers": [{"id": r[0], "full_name": r[1], "role_code": r[2]} for r in rows]})

    conn.close()
    return resp({"error": f"Неизвестный action: {action}"}, 400)
