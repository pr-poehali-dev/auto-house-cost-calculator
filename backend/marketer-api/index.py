"""
Маркетолог API — анализ конкурентов и импорт проектов.
Позволяет маркетологу вставить ссылку на проект конкурента,
AI извлекает характеристики и сохраняет проект в наш каталог.
"""

import json
import os
import re
import uuid
import ssl
import urllib.request
import urllib.parse
import psycopg2

S = os.environ.get("MAIN_DB_SCHEMA", "t_p78845984_auto_house_cost_calc")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}


def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def resp(data, status=200):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False)}


def get_staff(conn, token):
    cur = conn.cursor()
    cur.execute(f"SELECT s.id, s.role_code FROM {S}.staff s JOIN {S}.sessions ss ON ss.staff_id=s.id WHERE ss.token=%s AND ss.expires_at>NOW()", (token,))
    row = cur.fetchone()
    cur.close()
    return {"id": row[0], "role_code": row[1]} if row else None


def fetch_page(url: str) -> str:
    """Загружает HTML страницы и возвращает чистый текст."""
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "ru-RU,ru;q=0.9",
        })
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read().decode("utf-8", errors="ignore")

        # Убираем скрипты, стили, навигацию
        raw = re.sub(r"<script[^>]*>.*?</script>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
        raw = re.sub(r"<style[^>]*>.*?</style>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
        raw = re.sub(r"<nav[^>]*>.*?</nav>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
        raw = re.sub(r"<footer[^>]*>.*?</footer>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
        # Убираем теги, оставляем текст
        text = re.sub(r"<[^>]+>", " ", raw)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:8000]
    except Exception as e:
        return f"Ошибка загрузки страницы: {e}"


LM_URL = "http://87.117.11.177:4321"
LM_MODEL = "gemma-3-4b-it"

def gigachat_chat(messages: list, temperature: float = 0.2, max_tokens: int = 1200) -> str:
    data = json.dumps({
        "model": LM_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }, ensure_ascii=False).encode()
    req = urllib.request.Request(
        f"{LM_URL}/v1/chat/completions",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        result = json.loads(r.read())
    return result["choices"][0]["message"]["content"].strip()

def ai_extract(text: str, url: str) -> dict:
    """Через LM Studio извлекает характеристики проекта из текста страницы."""
    if not text.strip():
        return {"error": "Нет текста для анализа"}

    prompt = f"""Ты анализируешь страницу проекта дома конкурента. URL: {url}

Текст страницы:
{text}

Извлеки характеристики проекта и верни JSON строго в таком формате (без markdown, только JSON):
{{
  "name": "название проекта",
  "type": "тип дома (Кирпичный/Каркасный/Монолитный/Деревянный/Газобетон/Модульный)",
  "area": число_площадь_м2,
  "floors": число_этажей,
  "rooms": число_комнат,
  "price": цена_в_рублях_число,
  "description": "краткое описание 2-3 предложения",
  "features": "особенность 1\\nособенность 2\\nособенность 3",
  "roof_type": "тип кровли",
  "foundation_type": "тип фундамента",
  "wall_type": "тип стен",
  "tag": "метка (Популярный/Хит/Новинка/Премиум или пусто)",
  "competitor_notes": "что интересного у конкурента, чем отличается, что можно взять для себя",
  "source_url": "{url}"
}}

Если данных нет — используй null для чисел и "" для строк. Площадь и цену переводи в числа (убирай пробелы и символы).
"""

    content = gigachat_chat([{"role": "user", "content": prompt}], temperature=0.2, max_tokens=1200)
    content = re.sub(r"^```json\s*", "", content)
    content = re.sub(r"\s*```$", "", content)
    return json.loads(content)


def handler(event: dict, context) -> dict:
    """Маркетолог API: анализ конкурентов и управление импортированными проектами."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")
    token = event.get("headers", {}).get("X-Auth-Token", "")
    body = {}
    if event.get("body"):
        try: body = json.loads(event["body"])
        except: pass

    conn = db()

    # Проверяем авторизацию
    staff = get_staff(conn, token)
    if not staff:
        conn.close()
        return resp({"error": "Не авторизован"}, 401)

    if staff["role_code"] not in ("marketer", "admin"):
        conn.close()
        return resp({"error": "Доступ только для маркетолога"}, 403)

    # ── analyze_url: загрузить страницу и извлечь данные через AI ──
    if action == "analyze_url":
        url = body.get("url", "").strip()
        if not url:
            conn.close()
            return resp({"error": "url обязателен"}, 400)
        if not url.startswith("http"):
            url = "https://" + url

        conn.close()
        page_text = fetch_page(url)
        if page_text.startswith("Ошибка загрузки"):
            return resp({"error": page_text}, 422)

        data = ai_extract(page_text, url)
        if "error" in data:
            return resp({"error": data["error"]}, 500)

        return resp({"ok": True, "data": data})

    # ── import_project: сохранить извлечённый проект в каталог ──
    if action == "import_project":
        d = body.get("data", {})
        if not d.get("name"):
            conn.close()
            return resp({"error": "Нет данных проекта"}, 400)

        cur = conn.cursor()
        cur.execute(f"""
            INSERT INTO {S}.house_projects
              (name, type, area, floors, rooms, price, description, features,
               roof_type, foundation_type, wall_type, tag, tag_color, is_active, created_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
        """, (
            d.get("name", "Импортированный проект"),
            d.get("type", "Кирпичный"),
            d.get("area") or 0,
            d.get("floors") or 1,
            d.get("rooms") or 0,
            d.get("price") or 0,
            d.get("description", ""),
            d.get("features", ""),
            d.get("roof_type", ""),
            d.get("foundation_type", ""),
            d.get("wall_type", ""),
            d.get("tag", ""),
            "#A855F7",
            False,
            staff["id"],
        ))
        project_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return resp({"ok": True, "project_id": project_id})

    # ── competitor_list: список всех анализов конкурентов ──
    if action == "competitor_list":
        cur = conn.cursor()
        cur.execute(f"""
            SELECT id, name, type, area, floors, price, is_active, created_at
            FROM {S}.house_projects
            WHERE created_by=%s
            ORDER BY created_at DESC LIMIT 50
        """, (staff["id"],))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        projects = [{"id": r[0], "name": r[1], "type": r[2], "area": r[3], "floors": r[4], "price": float(r[5]), "is_active": r[6], "created_at": str(r[7])} for r in rows]
        return resp({"ok": True, "projects": projects})

    # ── publish_project: опубликовать импортированный проект ──
    if action == "publish_project":
        project_id = body.get("project_id")
        if not project_id:
            conn.close()
            return resp({"error": "project_id обязателен"}, 400)
        cur = conn.cursor()
        cur.execute(f"UPDATE {S}.house_projects SET is_active=TRUE, updated_at=NOW() WHERE id=%s AND created_by=%s", (project_id, staff["id"]))
        conn.commit()
        cur.close()
        conn.close()
        return resp({"ok": True})

    conn.close()
    return resp({"error": f"Неизвестный action: {action}"}, 400)