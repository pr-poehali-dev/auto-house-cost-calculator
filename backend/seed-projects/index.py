"""
Одноразовый seed-скрипт: генерирует 10 проектов домов через GigaChat и сохраняет в БД.
Вызывать: GET /?action=seed (только admin или без токена для первого запуска)
"""
import json, os, uuid, ssl, urllib.request, urllib.parse, re
import psycopg2

S = os.environ.get("MAIN_DB_SCHEMA", "t_p78845984_auto_house_cost_calc")
CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"}

def db(): return psycopg2.connect(os.environ["DATABASE_URL"])
def resp(data, code=200):
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}

PROMPT = """Ты архитектор строительной компании. Создай 10 реальных проектов частных домов для российского рынка.
Верни ТОЛЬКО JSON-массив без markdown, без пояснений, без комментариев.

Каждый объект:
{
  "name": "уникальное красивое название",
  "type": "один из: Кирпичный, Каркасный, Монолитный, Деревянный, Газобетон, Модульный",
  "area": число 80-350,
  "floors": 1 или 2,
  "rooms": число 2-6,
  "price": цена в рублях 2500000-18000000,
  "tag": "один из: Хит, Популярный, Новинка, Премиум, Эконом",
  "tag_color": "hex цвет",
  "description": "2-3 предложения живого описания для клиента",
  "features": "5-7 особенностей через символ \\n, каждая 3-7 слов",
  "roof_type": "например: Двускатная, Вальмовая, Мансардная",
  "foundation_type": "например: Ленточный монолитный, Свайно-ростверковый, Плитный",
  "wall_type": "например: Газобетон D500 400мм, Брус 200х200мм, Кирпич М150 510мм"
}

Требования:
- Разнообразные типы: 2 каркасных, 2 газобетон, 2 кирпичных, 1 деревянный, 1 монолитный, 1 модульный, 1 любой
- Реалистичные цены 2024-2025 года для России
- Красивые маркетинговые названия: Берёзовая роща, Северный модерн, Альпийский шале и т.п.
- Разные бюджеты: 3 эконом (80-120м²), 4 средний (120-200м²), 3 премиум (200-350м²)
- tag_color: Хит=#FF6B1A, Популярный=#00D4FF, Новинка=#00FF88, Премиум=#A855F7, Эконом=#FBBF24"""

LM_URL = "http://87.117.11.177:4321"
LM_MODEL = "gemma-3-4b-it"

def generate_projects():
    payload = json.dumps({
        "model": LM_MODEL,
        "temperature": 0.8,
        "max_tokens": 4000,
        "stream": False,
        "messages": [{"role": "user", "content": PROMPT}]
    }, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(
        f"{LM_URL}/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        result = json.loads(r.read().decode())

    content = result["choices"][0]["message"]["content"].strip()
    content = re.sub(r"^```json\s*", "", content)
    content = re.sub(r"^```\s*", "", content)
    content = re.sub(r"\s*```$", "", content)
    return json.loads(content)

def handler(event: dict, context) -> dict:
    """Seed: генерирует 10 проектов домов через LM Studio и сохраняет в БД."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")

    if action != "seed":
        return resp({"error": "Используйте ?action=seed"}, 400)

    # Генерируем проекты
    try:
        projects = generate_projects()
    except Exception as e:
        return resp({"error": f"Ошибка генерации: {e}"}, 500)

    if not isinstance(projects, list):
        return resp({"error": "GigaChat вернул не массив"}, 500)

    # Сохраняем в БД
    conn = db()
    cur = conn.cursor()

    # Берём id архитектора dudin (id=11) или первого доступного
    cur.execute(f"SELECT id FROM {S}.staff WHERE role_code='architect' ORDER BY id LIMIT 1")
    row = cur.fetchone()
    architect_id = row[0] if row else 1

    saved = []
    errors = []

    for p in projects:
        try:
            cur.execute(f"""
                INSERT INTO {S}.house_projects
                  (name, type, area, floors, rooms, price, tag, tag_color,
                   description, features, roof_type, foundation_type, wall_type,
                   is_active, created_by, updated_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
            """, (
                p.get("name", "Без названия"),
                p.get("type", "Каркасный"),
                int(p.get("area", 100)),
                int(p.get("floors", 1)),
                int(p.get("rooms", 3)),
                int(p.get("price", 5000000)),
                p.get("tag", ""),
                p.get("tag_color", "#FF6B1A"),
                p.get("description", ""),
                p.get("features", ""),
                p.get("roof_type", ""),
                p.get("foundation_type", ""),
                p.get("wall_type", ""),
                True,
                architect_id,
                architect_id,
            ))
            new_id = cur.fetchone()[0]
            saved.append({"id": new_id, "name": p.get("name")})
        except Exception as e:
            errors.append({"name": p.get("name", "?"), "error": str(e)})

    conn.commit()
    cur.close()
    conn.close()

    return resp({
        "ok": True,
        "saved": len(saved),
        "projects": saved,
        "errors": errors
    })