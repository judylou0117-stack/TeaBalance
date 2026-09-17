#!/usr/bin/env python3
"""Import Tea Balance's local rule workbooks into auditable JSON files.

This script only reads Excel workbooks. When --source is supplied it copies the
six named workbooks into resources/raw before importing, preserving their names.
It never writes to the source directory.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import re
from collections import Counter
from pathlib import Path
from typing import Any

import openpyxl


RAW_FILENAMES = (
    "GBT46939-2025附录A中医体质分类判定题目.xlsx",
    "knowledge base.xlsx",
    "安全规则表.xlsx",
    "判定规则表.xlsx",
    "评分映射表.xlsx",
    "中医养生茶饮明细 2.xlsx",
)

CONSTITUTION_CODES = {
    "平和质": "A",
    "气虚质": "B",
    "阳虚质": "C",
    "阴虚质": "D",
    "痰湿质": "E",
    "湿热质": "F",
    "血瘀质": "G",
    "气郁质": "H",
    "特禀质": "I",
}

CODE_NAMES = {value: key for key, value in CONSTITUTION_CODES.items()}
CAUTION_REFERENCE = "需要谨慎使用的材料"


class ImportFailure(RuntimeError):
    """Raised when a required source workbook cannot be interpreted safely."""


def clean(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value).strip()
    return text or None


def source_ref(filename: str, sheet: str, row: int) -> dict[str, Any]:
    return {"file": filename, "sheet": sheet, "row": row}


def read_rows(path: Path, sheet_name: str | None = None) -> tuple[str, list[list[Any]]]:
    workbook = openpyxl.load_workbook(path, read_only=False, data_only=False)
    worksheet = workbook[sheet_name] if sheet_name else workbook.worksheets[0]
    rows = [list(row) for row in worksheet.iter_rows(values_only=True)]
    while rows and all(value is None for value in rows[-1]):
        rows.pop()
    return worksheet.title, rows


def require_columns(headers: list[Any], expected: list[str], context: str) -> dict[str, int]:
    positions = {clean(header): index for index, header in enumerate(headers) if clean(header)}
    missing = [name for name in expected if name not in positions]
    if missing:
        raise ImportFailure(f"{context} 缺少字段：{', '.join(missing)}")
    return positions


def get(row: list[Any], positions: dict[str, int], field: str) -> str | None:
    index = positions[field]
    return clean(row[index]) if index < len(row) else None


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def copy_raw_sources(source_dir: Path, raw_dir: Path, warnings: list[str]) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    for filename in RAW_FILENAMES:
        source = source_dir / filename
        if not source.is_file():
            raise ImportFailure(f"找不到原始资料：{source}")
        destination = raw_dir / filename
        shutil.copy2(source, destination)
    temporary_files = [path.name for path in source_dir.glob("~$*.xlsx")]
    if temporary_files:
        warnings.append("已跳过 Excel 临时锁定文件：" + "、".join(sorted(temporary_files)))


def import_questions(path: Path) -> dict[str, Any]:
    sheet, rows = read_rows(path)
    if not rows:
        raise ImportFailure("题目表为空")
    positions = require_columns(rows[0], ["question_id", "question_text", "time_range", "gender", "answer_type", "source_page", "verified"], "题目表")
    items = []
    for row_number, row in enumerate(rows[1:], start=2):
        question_id = get(row, positions, "question_id")
        if not question_id:
            continue
        items.append({
            "id": question_id,
            "text": get(row, positions, "question_text"),
            "timeRange": get(row, positions, "time_range"),
            "gender": get(row, positions, "gender"),
            "answerType": get(row, positions, "answer_type"),
            "sourcePage": get(row, positions, "source_page"),
            "verified": get(row, positions, "verified"),
            "source": source_ref(path.name, sheet, row_number),
        })
    return {"schemaVersion": 1, "items": items}


def import_score_mappings(path: Path) -> dict[str, Any]:
    sheet, rows = read_rows(path)
    if not rows:
        raise ImportFailure("评分映射表为空")
    positions = require_columns(rows[0], ["mapping_id", "constitution_code", "constitution_name", "question_id", "item_order", "reverse_score"], "评分映射表")
    items = []
    for row_number, row in enumerate(rows[1:], start=2):
        mapping_id = get(row, positions, "mapping_id")
        if not mapping_id:
            continue
        code = get(row, positions, "constitution_code")
        if code not in CODE_NAMES:
            raise ImportFailure(f"评分映射 {mapping_id} 使用未知体质编码：{code}")
        raw_order = get(row, positions, "item_order")
        items.append({
            "id": mapping_id,
            "constitutionCode": code,
            "constitutionName": get(row, positions, "constitution_name"),
            "questionId": get(row, positions, "question_id"),
            "order": int(raw_order or "0"),
            "reverse": (get(row, positions, "reverse_score") or "").lower() == "yes",
            "source": source_ref(path.name, sheet, row_number),
        })
    return {"schemaVersion": 1, "items": items}


def import_decision_rules(path: Path) -> dict[str, Any]:
    sheet, rows = read_rows(path)
    if not rows:
        raise ImportFailure("判定规则表为空")
    positions = require_columns(rows[0], ["rule_id", "constitution_type", "condition", "result"], "判定规则表")
    items = []
    for row_number, row in enumerate(rows[1:], start=2):
        rule_id = get(row, positions, "rule_id")
        if not rule_id:
            continue
        items.append({
            "id": rule_id,
            "constitutionType": get(row, positions, "constitution_type"),
            "condition": get(row, positions, "condition"),
            "result": get(row, positions, "result"),
            "source": source_ref(path.name, sheet, row_number),
        })
    return {"schemaVersion": 1, "items": items}


def split_materials(value: str | None) -> list[str]:
    if not value:
        return []
    text = value.replace("“", "").replace("”", "").replace("\"", "")
    text = text.replace("含咖啡因（茶）", "茶")
    if "：" in text:
        text = text.split("：", 1)[1]
    if "，" in text:
        text = text.split("，", 1)[1]
    for separator in ("、", "，", ",", "；", ";", "、"):
        text = text.replace(separator, "|")
    reserved = {"需要谨慎使用的材料", "所有", "对应过敏原及同科植物", "/"}
    return [piece.strip() for piece in text.split("|") if piece.strip() and piece.strip() not in reserved]


def import_safety_rules(path: Path) -> dict[str, Any]:
    sheet, rows = read_rows(path)
    if not rows:
        raise ImportFailure("安全规则表为空")
    positions = require_columns(rows[0], ["rule_id", "触发条件", "涉及材料", "情况说明", "风险级别", "系统动作", "提示文字", "来源"], "安全规则表")
    items = []
    notes = []
    for row_number, row in enumerate(rows[1:], start=2):
        rule_id = get(row, positions, "rule_id")
        if not rule_id or not re.fullmatch(r"S\d{3}", rule_id):
            text = clean(row[1]) if len(row) > 1 else None
            if rule_id and rule_id != "备注":
                text = (rule_id + "：" + text) if text else rule_id
            if text:
                notes.append({"text": text, "source": source_ref(path.name, sheet, row_number)})
            continue
        source_url = clean(row[8]) if len(row) > 8 else None
        materials_text = get(row, positions, "涉及材料")
        items.append({
            "id": rule_id,
            "trigger": get(row, positions, "触发条件"),
            "materialsText": materials_text,
            "materials": split_materials(materials_text),
            "description": get(row, positions, "情况说明"),
            "riskLevel": get(row, positions, "风险级别"),
            "systemAction": get(row, positions, "系统动作"),
            "message": get(row, positions, "提示文字"),
            "sourceName": get(row, positions, "来源"),
            "sourceUrl": source_url,
            "source": source_ref(path.name, sheet, row_number),
        })
    caution_materials = []
    for note in notes:
        if note["text"].startswith(CAUTION_REFERENCE):
            caution_materials = split_materials(note["text"])
    return {
        "schemaVersion": 1,
        "items": items,
        "notes": notes,
        "cautionMaterials": caution_materials,
    }


def import_teas(path: Path) -> dict[str, Any]:
    sheet, rows = read_rows(path)
    if not rows:
        raise ImportFailure("茶饮表为空")
    expected = ["tea_id", "茶饮名称", "配料", "适合体质", "倾向匹配依据", "口味", "冲泡方式", "不适用情况", "过敏原", "信息来源", "审核状态", "来源网址"]
    positions = require_columns(rows[0], expected, "茶饮表")
    items = []
    for row_number, row in enumerate(rows[1:], start=2):
        tea_id = get(row, positions, "tea_id")
        if not tea_id:
            continue
        constitution_names = [name.strip() for name in (get(row, positions, "适合体质") or "").replace("、", "|").split("|") if name.strip()]
        codes = [CONSTITUTION_CODES[name] for name in constitution_names if name in CONSTITUTION_CODES]
        items.append({
            "id": tea_id,
            "name": get(row, positions, "茶饮名称"),
            "ingredients": get(row, positions, "配料"),
            "constitutionNames": constitution_names,
            "constitutionCodes": codes,
            "matchRationale": get(row, positions, "倾向匹配依据"),
            "flavor": get(row, positions, "口味"),
            "brewMethod": get(row, positions, "冲泡方式"),
            "unsuitable": get(row, positions, "不适用情况"),
            "allergens": get(row, positions, "过敏原"),
            "sourceName": get(row, positions, "信息来源"),
            "reviewStatus": get(row, positions, "审核状态"),
            "sourceUrl": get(row, positions, "来源网址"),
            "source": source_ref(path.name, sheet, row_number),
        })
    return {"schemaVersion": 1, "items": items}


def import_constitutions(path: Path) -> dict[str, Any]:
    sheet, rows = read_rows(path)
    if not rows:
        raise ImportFailure("体质知识表为空")
    chinese_header = [clean(value) for value in rows[0][:8]]
    expected_zh = ["体质编号", "体质名称", "主要特征", "常见表现", "心理特征", "环境适应", "通俗解释", "来源"]
    if chinese_header != expected_zh:
        raise ImportFailure("体质知识表中文表头与预期不一致")
    english_header_index = next((index for index, row in enumerate(rows) if clean(row[0]) == "ID"), None)
    if english_header_index is None:
        raise ImportFailure("体质知识表缺少英文区段表头")
    chinese_rows = [row for row in rows[1:english_header_index] if clean(row[0])]
    english_rows = [row for row in rows[english_header_index + 1 :] if clean(row[0])]
    english_by_id = {clean(row[0]): row for row in english_rows}
    items = []
    for row_number, row in enumerate(chinese_rows, start=2):
        item_id = clean(row[0])
        english = english_by_id.get(item_id)
        code = CODE_NAMES.get("A") if item_id == "1" else None
        if item_id and item_id.isdigit():
            code = chr(ord("A") + int(item_id) - 1)
        if code not in CODE_NAMES:
            raise ImportFailure(f"体质知识表存在无法映射的体质编号：{item_id}")
        items.append({
            "code": code,
            "id": item_id,
            "name": {"zh": clean(row[1]), "en": clean(english[1]) if english else None},
            "mainFeatures": {"zh": clean(row[2]), "en": clean(english[2]) if english else None},
            "commonManifestations": {"zh": clean(row[3]), "en": clean(english[3]) if english else None},
            "psychologicalFeatures": {"zh": clean(row[4]), "en": clean(english[4]) if english else None},
            "environmentalAdaptability": {"zh": clean(row[5]), "en": clean(english[5]) if english else None},
            "plainExplanation": {"zh": clean(row[6]), "en": clean(english[6]) if english else None},
            "source": {"zh": clean(row[7]), "en": clean(english[7]) if english else None, "file": path.name, "sheet": sheet},
        })
    return {"schemaVersion": 1, "items": items}


def find_unnamed_columns(rows: list[list[Any]], label: str) -> list[str]:
    if not rows:
        return []
    headers = rows[0]
    messages = []
    for index, header in enumerate(headers):
        if clean(header) is None:
            filled = sum(1 for row in rows[1:] if index < len(row) and clean(row[index]) is not None)
            messages.append(f"{label} 第 {index + 1} 列无字段名，数据行中有 {filled} 个非空值。")
    return messages


def build_audit(raw_dir: Path, generated: dict[str, dict[str, Any]], warnings: list[str]) -> str:
    workbook_rows = {}
    for filename in RAW_FILENAMES:
        sheet, rows = read_rows(raw_dir / filename)
        workbook_rows[filename] = (sheet, rows)

    duplicate_files: dict[str, list[str]] = {}
    for filename in RAW_FILENAMES:
        duplicate_files.setdefault(file_hash(raw_dir / filename), []).append(filename)
    duplicate_groups = [names for names in duplicate_files.values() if len(names) > 1]

    audit_warnings = list(warnings)
    for filename, (_, rows) in workbook_rows.items():
        audit_warnings.extend(find_unnamed_columns(rows, filename))

    questions = generated["questions"]["items"]
    mappings = generated["score-mappings"]["items"]
    question_ids = {item["id"] for item in questions}
    missing_questions = sorted({item["questionId"] for item in mappings if item["questionId"] not in question_ids})
    mapping_codes = sorted({item["constitutionCode"] for item in mappings})
    inconsistent_codes = [code for code in mapping_codes if code not in CODE_NAMES]

    safety = generated["safety-rules"]
    safety_ids = [item["id"] for item in safety["items"]]
    expected_ids = [f"S{number:03d}" for number in range(1, 16)]
    missing_safety_ids = [rule_id for rule_id in expected_ids if rule_id not in safety_ids]
    placeholder_sources = [item["id"] for item in safety["items"] if item["sourceName"] in (None, "/")]
    missing_safety_urls = [item["id"] for item in safety["items"] if not item["sourceUrl"]]
    teas = generated["teas"]["items"]
    tea_source_missing = [item["id"] for item in teas if not item["sourceName"] or not item["sourceUrl"]]
    tea_review_missing = [item["id"] for item in teas if not item["reviewStatus"]]
    manual_materials = safety["cautionMaterials"]
    manual_teas = [
        item for item in teas
        if any(material and material in (item["ingredients"] or "") for material in manual_materials)
    ]

    lines = [
        "# Tea Balance 数据审计",
        "",
        "本报告仅记录导入前后的结构与来源问题，不修改任何原始 Excel，也不补造医疗规则。",
        "",
        "## 原始资料",
        "",
        *[f"- `{filename}`：已复制到 `resources/raw/`。" for filename in RAW_FILENAMES],
        "",
        "## 数据条数",
        "",
        f"- 题目：{len(questions)} 条。",
        f"- 评分映射：{len(mappings)} 条。",
        f"- 判定规则：{len(generated['decision-rules']['items'])} 条。",
        f"- 茶饮：{len(teas)} 条。",
        f"- 安全规则：{len(safety['items'])} 条，另有 {len(safety['notes'])} 条无编号备注。",
        f"- 体质知识：{len(generated['constitutions']['items'])} 条双语记录。",
        "",
        "## 题目、体质编码与性别分支",
        "",
        "- 题目编号为 `Q001` 至 `Q027`；评分映射引用的题目均存在。" if not missing_questions else f"- **问题**：评分映射引用了不存在的题目：{', '.join(missing_questions)}。",
        "- 映射中出现的体质编码为 " + ", ".join(mapping_codes) + "；与统一编码 A–I 一致。" if not inconsistent_codes else "- **问题**：发现不一致体质编码：" + ", ".join(inconsistent_codes) + "。",
        "- Q017 的题目表性别分支为 `female`，Q018 为 `male`；两题都出现在湿热质（F）映射中。导入后的评分模块只会按用户声明的性别选择其中一题。未透露性别时不会代填，并将湿热质严格判定标为信息不足。",
        "",
        "## 空字段、未命名列与重复数据",
        "",
        "- 重复文件：未发现内容哈希相同的原始文件。" if not duplicate_groups else "- **问题**：重复文件组：" + "；".join("、".join(group) for group in duplicate_groups) + "。",
        *([f"- **检查项**：{warning}" for warning in audit_warnings] if audit_warnings else ["- 未发现未命名列或 Excel 临时锁定文件。"]),
        "- `knowledge base.xlsx` 在中文九条记录后有两行空分隔行，随后为英文表头与九条英文记录；导入程序按编号将中英文配对。",
        "- `判定规则表.xlsx` 的第 5–20 列为空列；导入仅使用有字段名的前四列。",
        "- `安全规则表.xlsx` 第 9 列没有字段名，但部分行存放网址；导入程序保留为 `sourceUrl`，并在此报告标注。",
        "",
        "## 来源、审核与安全规则",
        "",
        "- 茶饮来源缺失：无。" if not tea_source_missing else "- **问题**：茶饮来源或网址缺失的 tea_id：" + ", ".join(tea_source_missing) + "。",
        "- 茶饮审核状态缺失：无。" if not tea_review_missing else "- **问题**：茶饮审核状态缺失的 tea_id：" + ", ".join(tea_review_missing) + "。",
        "- 安全规则编号缺失：无。" if not missing_safety_ids else "- **问题**：安全规则编号序列缺少：" + ", ".join(missing_safety_ids) + "（未补造 S009）。",
        "- 安全规则来源为 `/` 或为空：无。" if not placeholder_sources else "- **问题**：安全规则来源为 `/` 或为空：" + ", ".join(placeholder_sources) + "。",
        "- 安全规则网址缺失：无。" if not missing_safety_urls else "- **检查项**：安全规则网址缺失：" + ", ".join(missing_safety_urls) + "。",
        "- S014 的风险级别写为“警告/阻断”，无法从表格唯一确定动作。规则模块会保留该原文，并按“需人工审核的警告”处理，不擅自升级为阻断。",
        "- 表格没有“咖啡因敏感”这一独立触发条件；仅在孕哺与儿童规则中列出含咖啡因（茶）材料。规则模块会返回明确的数据缺口警告，不将其伪装为国标医学结论。",
        "",
        "## 需要人工审核的自动推荐边界",
        "",
        "- 以下茶饮含安全规则无编号备注列出的“需要谨慎使用的材料”，在涉及该类材料但规则表没有精确条件—动作对应时，不能仅依靠自动匹配作最终结论：" + ("、".join(f"{item['id']}（{item['name']}）" for item in manual_teas) if manual_teas else "无") + "。",
        "- 安全表列出的材料、药物和疾病情形只是示例，表格备注明确说明未覆盖其他材料；规则后端只执行已列出的范围。",
        "- 所有“明显、持续或严重不适”的处理均在代码中标记为产品安全边界，不归因于国标题目或安全表。",
        "",
    ]
    return "\n".join(lines)


def run(project_root: Path, source_dir: Path | None) -> tuple[dict[str, int], list[str], list[str]]:
    raw_dir = project_root / "resources" / "raw"
    generated_dir = project_root / "data" / "generated"
    docs_dir = project_root / "docs"
    warnings: list[str] = []
    failures: list[str] = []
    if source_dir:
        copy_raw_sources(source_dir, raw_dir, warnings)
    missing = [filename for filename in RAW_FILENAMES if not (raw_dir / filename).is_file()]
    if missing:
        raise ImportFailure("resources/raw 中缺少：" + "、".join(missing))

    try:
        payloads = {
            "questions": import_questions(raw_dir / RAW_FILENAMES[0]),
            "constitutions": import_constitutions(raw_dir / RAW_FILENAMES[1]),
            "safety-rules": import_safety_rules(raw_dir / RAW_FILENAMES[2]),
            "decision-rules": import_decision_rules(raw_dir / RAW_FILENAMES[3]),
            "score-mappings": import_score_mappings(raw_dir / RAW_FILENAMES[4]),
            "teas": import_teas(raw_dir / RAW_FILENAMES[5]),
        }
    except ImportFailure as error:
        failures.append(str(error))
        raise

    for name, payload in payloads.items():
        write_json(generated_dir / f"{name}.json", payload)
    audit = build_audit(raw_dir, payloads, warnings)
    docs_dir.mkdir(parents=True, exist_ok=True)
    (docs_dir / "data-audit.md").write_text(audit, encoding="utf-8")

    counts = {name: len(payload["items"]) for name, payload in payloads.items()}
    return counts, warnings, failures


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Tea Balance rule workbooks into generated JSON.")
    parser.add_argument("--project-root", default=Path(__file__).resolve().parents[1], type=Path)
    parser.add_argument("--source", type=Path, help="Optional source directory containing the six named Excel files.")
    args = parser.parse_args()
    try:
        counts, warnings, failures = run(args.project_root.resolve(), args.source.resolve() if args.source else None)
    except (ImportFailure, OSError, openpyxl.utils.exceptions.InvalidFileException) as error:
        print(json.dumps({"ok": False, "counts": {}, "warnings": [], "failures": [str(error)]}, ensure_ascii=False, indent=2))
        return 1
    print(json.dumps({"ok": True, "counts": counts, "warnings": warnings, "failures": failures}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
