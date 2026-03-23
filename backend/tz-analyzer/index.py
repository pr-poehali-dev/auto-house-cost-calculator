"""
tz-analyzer: Парсинг .docx/.doc Word-файла и анализ ТЗ через GigaChat
"""
import json, os, io, base64, uuid, ssl, urllib.request, urllib.parse

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}

SYSTEM_PROMPT = """Ты — опытный архитектор и аналитик технических заданий в строительной компании «СтройКалькулятор».

Тебе дали текст ТЗ на кабинет архитектора (или другую часть системы). Проведи детальный анализ и сравни с тем, что уже реализовано в системе.

В системе уже реализован кабинет архитектора со следующим функционалом:
1. Управление проектами домов (создание, редактирование, удаление)
2. Поля проекта: название, тип дома (кирпич/каркас/монолит/дерево/газобетон/модульный), площадь, этажи, комнаты, цена, тег, цвет тега, описание, особенности, статус публикации, тип фундамента, тип кровли, тип стен
3. Загрузка файлов по типам: рендер фасада, план, фасад, разрез, спецификация, весь проект, прочее
4. Работа со спецификациями (SpecUploader) — загрузка Excel/CSV с позициями материалов
5. AI-ассистент архитектора (GigaChat) — генерация описания, особенностей, консультации
6. Технологические карты (ТТК) — просмотр и привязка к проекту
7. Нормативные документы
8. Поиск и фильтрация проектов

Проведи анализ по следующему плану:
1. **КРАТКОЕ РЕЗЮМЕ ТЗ** — о чём ТЗ, основные требования (3-5 пунктов)
2. **УЖЕ РЕАЛИЗОВАНО** ✅ — что из ТЗ уже есть в системе (список)
3. **ОТСУТСТВУЕТ / НУЖНО ДОДЕЛАТЬ** ❌ — чего нет, что нужно реализовать (список с приоритетами)
4. **ЧАСТИЧНО РЕАЛИЗОВАНО** ⚠️ — что есть, но требует доработки
5. **РЕКОМЕНДАЦИИ** — что сделать в первую очередь

Отвечай структурировано, на русском языке, конкретно и по делу."""


LM_URL = "http://87.117.11.177:4321"
LM_MODEL = "gemma-3-4b-it"


def gigachat_analyze(text: str) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Вот текст ТЗ для анализа:\n\n{text[:12000]}"}
    ]
    payload = {
        "model": LM_MODEL,
        "messages": messages,
        "max_tokens": 1500,
        "temperature": 0.3,
        "stream": False,
    }
    req = urllib.request.Request(
        f"{LM_URL}/v1/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        result = json.loads(r.read().decode())
    return result["choices"][0]["message"]["content"].strip()


def extract_text_from_docx(b64_content: str) -> str:
    try:
        import zipfile, xml.etree.ElementTree as ET
        raw = base64.b64decode(b64_content)
        buf = io.BytesIO(raw)
        with zipfile.ZipFile(buf) as z:
            if "word/document.xml" not in z.namelist():
                return ""
            with z.open("word/document.xml") as f:
                tree = ET.parse(f)
        root = tree.getroot()
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        paragraphs = []
        for para in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
            texts = []
            for run in para.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"):
                if run.text:
                    texts.append(run.text)
            line = "".join(texts).strip()
            if line:
                paragraphs.append(line)
        return "\n".join(paragraphs)
    except Exception as e:
        return f"[Ошибка парсинга: {e}]"


def resp(data, code=200):
    return {
        "statusCode": code,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False, default=str)
    }


def handler(event: dict, context) -> dict:
    """Парсинг Word-файла (.docx) и анализ ТЗ через GigaChat"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if event.get("httpMethod") != "POST":
        return resp({"error": "Только POST"}, 405)

    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except ValueError:
            pass

    file_b64 = body.get("file_b64", "")
    file_name = body.get("file_name", "")

    if not file_b64:
        return resp({"error": "Файл не передан (поле file_b64)"}, 400)

    if not file_name.lower().endswith(".docx"):
        return resp({"error": "Поддерживается только .docx формат"}, 400)

    text = extract_text_from_docx(file_b64)
    if not text or text.startswith("[Ошибка"):
        return resp({"error": f"Не удалось прочитать файл: {text}"}, 422)

    if len(text.strip()) < 50:
        return resp({"error": "Файл пустой или не содержит текста"}, 422)

    analysis = gigachat_analyze(text)

    return resp({
        "ok": True,
        "file_name": file_name,
        "chars_extracted": len(text),
        "analysis": analysis,
    })