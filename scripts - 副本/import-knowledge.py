#!/usr/bin/env python3
"""Import Tea Balance's local knowledge workbooks into retrieval-only JSON.

The importer reads Excel files and writes generated JSON/audit files. With
--source it first copies the three original workbooks to resources/raw without
modifying the supplied files. Review status is preserved; retrieval decides
which records are eligible to return.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import openpyxl


RAW_FILENAMES = (
    "体质知识表.xlsx",
    "RAG茶饮知识表_Sheet2.xlsx",
    "体质日常表述.xlsx",
)
VALID_CONSTITUTION_CODES = set("ABCDEFGHI")
ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "resources" / "raw"
GENERATED_DIR = ROOT / "data" / "generated"
AUDIT_PATH = ROOT / "docs" / "knowledge-data-audit.md"


class ImportFailure(RuntimeError):
    """Raised when a workbook cannot be converted without guessing data."""


def clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def source_ref(filename: str, sheet: str, row: int) -> dict[str, Any]:
    return {"file": filename, "sheet": sheet, "row": row}


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def copy_raw_sources(source_dir: Path) -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for filename in RAW_FILENAMES:
        source = source_dir / filename
        if not source.is_file():
            raise ImportFailure(f"找不到原始资料：{source}")
        shutil.copy2(source, RAW_DIR / filename)


def read_sheet(path: Path) -> tuple[str, list[list[Any]]]:
    if not path.is_file():
        raise ImportFailure(f"找不到原始资料副本：{path}")
    workbook = openpyxl.load_workbook(path, read_only=False, data_only=False)
    worksheet = workbook.worksheets[0]
    rows = [list(row) for row in worksheet.iter_rows(values_only=True)]
    return worksheet.title, rows


def headers_for(rows: list[list[Any]], context: str) -> dict[str, int]:
    if not rows:
        raise ImportFailure(f"{context} 为空")
    headers = {clean(value): index for index, value in enumerate(rows[0]) if clean(value)}
    return headers


def require_headers(headers: dict[str, int], expected: list[str], context: str) -> None:
    missing = [field for field in expected if field not in headers]
    if missing:
        raise ImportFailure(f"{context} 缺少字段：{'、'.join(missing)}")


def field(row: list[Any], headers: dict[str, int], name: str) -> str | None:
    index = headers[name]
    return clean(row[index]) if index < len(row) else None


def split_terms(value: str | None) -> list[str]:
    if not value:
        return []
    terms = re.split(r"[、，,；;|\n]", value)
    return [term.strip() for term in terms if term and term.strip()]


def normalize_tea_id(value: str | None) -> str | None:
    if not value:
        return None
    matched = re.fullmatch(r"(?:T)?0*(\d+)", value.strip(), flags=re.IGNORECASE)
    return str(int(matched.group(1))) if matched else value.strip()


def extract_ingredients(content: str | None) -> str | None:
    if not content:
        return None
    matched = re.search(r"【配料】(.*?)(?=【|$)", content, flags=re.DOTALL)
    return matched.group(1).strip() if matched else None


def canonical_ingredients(value: str | None) -> str:
    if not value:
        return ""
    text = re.sub(r"[（(].*?[）)]", "", value)
    text = re.sub(r"(?:\d+(?:\.\d+)?\s*(?:g|克|枚|颗|片)|[一二三四五六七八九十]+(?:片|枚|颗)|一把)", "", text, flags=re.IGNORECASE)
    return re.sub(r"[、，,；;：:。\s]", "", text).replace("各", "")


def import_knowledge(path: Path, kind: str) -> tuple[dict[str, Any], dict[str, int]]:
    sheet, rows = read_sheet(path)
    headers = headers_for(rows, path.name)
    expected = ["knowledge_id", "type", "title", "content", "constitution_code", "tea_id", "keywords", "source_name", "review_status"]
    require_headers(headers, expected, path.name)
    url_header = "URL" if "URL" in headers else "source_url" if "source_url" in headers else None
    if kind == "tea" and not url_header:
        raise ImportFailure(f"{path.name} 缺少 URL 字段")

    items: list[dict[str, Any]] = []
    skipped_empty = 0
    missing_required = 0
    for row_number, row in enumerate(rows[1:], start=2):
        if not any(clean(value) for value in row):
            skipped_empty += 1
            continue
        record = {
            "knowledge_id": field(row, headers, "knowledge_id"),
            "type": field(row, headers, "type"),
            "title": field(row, headers, "title"),
            "content": field(row, headers, "content"),
            "constitution_code": field(row, headers, "constitution_code"),
            "tea_id": field(row, headers, "tea_id"),
            "keywords": split_terms(field(row, headers, "keywords")),
            "source_name": field(row, headers, "source_name"),
            "source_url": field(row, headers, url_header) if url_header else None,
            "source_section": field(row, headers, "source_section") if "source_section" in headers else None,
            "review_status": field(row, headers, "review_status"),
            "source": source_ref(path.name, sheet, row_number),
        }
        required = ["knowledge_id", "type", "title", "content", "constitution_code", "source_name", "review_status"]
        if kind == "tea":
            required.extend(["tea_id", "source_url"])
        if any(not record[key] for key in required):
            missing_required += 1
        items.append(record)
    return {"schemaVersion": 1, "items": items}, {"skipped_empty": skipped_empty, "missing_required": missing_required}


def import_daily_expressions(path: Path) -> tuple[dict[str, Any], dict[str, int]]:
    sheet, rows = read_sheet(path)
    headers = headers_for(rows, path.name)
    require_headers(headers, ["constitution_code", "标准关键词", "用户日常表达"], path.name)
    items: list[dict[str, Any]] = []
    skipped_empty = 0
    missing_required = 0
    for row_number, row in enumerate(rows[1:], start=2):
        if not any(clean(value) for value in row):
            skipped_empty += 1
            continue
        code = field(row, headers, "constitution_code")
        keyword = field(row, headers, "标准关键词")
        expression = field(row, headers, "用户日常表达")
        if not code or not keyword or not expression:
            missing_required += 1
        items.append({
            "constitution_code": code,
            "standard_keyword": keyword,
            "user_expressions": split_terms(expression),
            "source": source_ref(path.name, sheet, row_number),
        })
    return {"schemaVersion": 1, "items": items}, {"skipped_empty": skipped_empty, "missing_required": missing_required}


def check_codes(items: list[dict[str, Any]], label: str) -> list[str]:
    return sorted({str(item["constitution_code"]) for item in items if item.get("constitution_code") not in VALID_CONSTITUTION_CODES})


def audit_report(
    constitution_knowledge: dict[str, Any],
    tea_knowledge: dict[str, Any],
    daily_expressions: dict[str, Any],
    import_counts: dict[str, dict[str, int]],
    rule_teas: list[dict[str, Any]],
) -> str:
    all_knowledge = [*constitution_knowledge["items"], *tea_knowledge["items"]]
    duplicate_ids = sorted(key for key, count in Counter(item["knowledge_id"] for item in all_knowledge if item["knowledge_id"]).items() if count > 1)
    missing_knowledge = [item["knowledge_id"] or f"{item['source']['file']}:{item['source']['row']}" for item in all_knowledge if any(not item.get(key) for key in ("knowledge_id", "type", "title", "content", "constitution_code", "source_name", "review_status"))]
    missing_tea_fields = [item["knowledge_id"] or f"{item['source']['file']}:{item['source']['row']}" for item in tea_knowledge["items"] if not item.get("tea_id")]
    invalid_codes = {
        "体质知识": check_codes(constitution_knowledge["items"], "体质知识"),
        "茶饮知识": check_codes(tea_knowledge["items"], "茶饮知识"),
        "日常表达": check_codes(daily_expressions["items"], "日常表达"),
    }
    rule_by_id = {normalize_tea_id(item.get("id")): item for item in rule_teas}
    tea_checks: list[tuple[str, str]] = []
    unmatched: list[str] = []
    title_mismatches: list[str] = []
    ingredient_mismatches: list[str] = []
    for item in tea_knowledge["items"]:
        normalized_id = normalize_tea_id(item.get("tea_id"))
        rule_tea = rule_by_id.get(normalized_id)
        if not rule_tea:
            unmatched.append(item["knowledge_id"] or str(item.get("tea_id")))
            continue
        tea_checks.append((item["knowledge_id"], normalized_id or ""))
        if clean(rule_tea.get("name")) != item.get("title"):
            title_mismatches.append(f"{item['knowledge_id']}（规则：{rule_tea.get('name')}；知识：{item.get('title')}）")
        if canonical_ingredients(rule_tea.get("ingredients")) != canonical_ingredients(extract_ingredients(item.get("content"))):
            ingredient_mismatches.append(item["knowledge_id"])
    unverified = [item["knowledge_id"] for item in all_knowledge if (item.get("review_status") or "").strip().lower() != "verified"]
    source_missing = [item["knowledge_id"] for item in tea_knowledge["items"] if not item.get("source_name") or not item.get("source_url")]

    def issue(items: list[str], clear_text: str, issue_text: str) -> str:
        return f"- {clear_text}" if not items else f"- **问题**：{issue_text}{'、'.join(items)}。"

    lines = [
        "# Tea Balance 知识检索数据检查报告",
        "",
        "本报告记录知识资料的导入、关联与来源字段检查。它不修改原始 Excel，不补写医学依据，也不能替代对来源的人工核实。",
        "",
        "## 原始资料",
        "",
        *[f"- `{filename}`：已复制到 `resources/raw/`。" for filename in RAW_FILENAMES],
        "",
        "## 导入结果",
        "",
        f"- 体质知识：{len(constitution_knowledge['items'])} 条；跳过空行 {import_counts['constitution']['skipped_empty']} 条。",
        f"- 茶饮知识：{len(tea_knowledge['items'])} 条；跳过空行 {import_counts['tea']['skipped_empty']} 条。",
        f"- 日常表达：{len(daily_expressions['items'])} 条；跳过空行 {import_counts['expressions']['skipped_empty']} 条。",
        "- 茶饮表中的 `URL` 已映射为生成 JSON 的 `source_url`；体质知识表未提供 URL，保留其 `source_name` 和 `source_section`。",
        "",
        "## 字段、编号与体质编码",
        "",
        issue(duplicate_ids, "未发现重复的 knowledge_id。", "发现重复的 knowledge_id："),
        issue(missing_knowledge, "知识记录的必填字段完整。", "知识记录缺少必填字段："),
        issue(missing_tea_fields, "茶饮知识记录均包含 tea_id。", "茶饮知识缺少 tea_id："),
        *[issue(codes, f"{label}的体质编码均为 A–I。", f"{label}存在无效体质编码：") for label, codes in invalid_codes.items()],
        "",
        "## 与规则后端茶饮的关联",
        "",
        f"- 已找到 {len(tea_checks)} 条 tea_id 与规则茶饮编号的关联。规则编号为数字形式时，导入检查会将 `T001` 与 `1` 视为同一编号。",
        issue(unmatched, "所有茶饮知识均能关联到规则后端茶饮。", "无法关联到规则后端茶饮的 knowledge_id："),
        issue(title_mismatches, "关联茶饮的名称与规则茶饮名称一致。", "茶饮名称不一致："),
        issue(ingredient_mismatches, "关联茶饮的配料字段与规则茶饮配料在忽略剂量、单位和标点后保持一致。", "茶饮配料存在差异，需人工复核的 knowledge_id："),
        "",
        "## 审核状态与来源边界",
        "",
        "- 默认只有 `review_status` 为 `verified` 的资料会进入正式检索。未通过该筛选的资料仍保留在生成 JSON 中，便于后续人工复核。",
        "- `verified` 是组员在资料中填写的审核状态；程序只检查字段值，不能代替对来源、内容或适用边界的人工核实。",
        issue(unverified, "当前所有知识记录均标记为 verified。", "未进入正式检索的非 verified knowledge_id："),
        issue(source_missing, "所有茶饮知识记录均包含来源名称和 URL。", "茶饮知识的来源名称或 URL 缺失的 knowledge_id："),
        "",
        "## 检索边界",
        "",
        "- 日常表达仅用于扩展检索词和说明匹配原因，不会参与国标体质评分，也不会直接判定体质。",
        "- 茶饮知识只会从规则后端安全过滤后仍可显示的茶饮编号中检索；被阻断的茶饮不会被知识检索重新加入。",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Tea Balance knowledge workbooks")
    parser.add_argument("--source", type=Path, help="包含三份原始 Excel 的目录；指定后仅复制读取，不会修改该目录")
    args = parser.parse_args()
    if args.source:
        copy_raw_sources(args.source)

    constitution_data, constitution_counts = import_knowledge(RAW_DIR / "体质知识表.xlsx", "constitution")
    tea_data, tea_counts = import_knowledge(RAW_DIR / "RAG茶饮知识表_Sheet2.xlsx", "tea")
    expression_data, expression_counts = import_daily_expressions(RAW_DIR / "体质日常表述.xlsx")
    write_json(GENERATED_DIR / "knowledge.json", {"schemaVersion": 1, "items": [*constitution_data["items"], *tea_data["items"]]})
    write_json(GENERATED_DIR / "daily-expressions.json", expression_data)

    rules_path = GENERATED_DIR / "teas.json"
    if not rules_path.is_file():
        raise ImportFailure("找不到规则后端生成的 data/generated/teas.json，无法执行 tea_id 核对")
    rule_teas = json.loads(rules_path.read_text(encoding="utf-8")).get("items", [])
    report = audit_report(
        constitution_data,
        tea_data,
        expression_data,
        {"constitution": constitution_counts, "tea": tea_counts, "expressions": expression_counts},
        rule_teas,
    )
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_PATH.write_text(report, encoding="utf-8")

    print("知识导入完成：")
    print(f"- 体质知识：{len(constitution_data['items'])} 条")
    print(f"- 茶饮知识：{len(tea_data['items'])} 条")
    print(f"- 日常表达：{len(expression_data['items'])} 条")
    print(f"- 检查报告：{AUDIT_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ImportFailure as error:
        print(f"导入失败：{error}", file=sys.stderr)
        raise SystemExit(1)
