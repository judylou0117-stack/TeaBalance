# Tea Balance 第一阶段知识检索说明

## 新增内容

本阶段新增的是服务端本地知识检索，不接入任何真实 AI、向量数据库或外部健康服务。

- `resources/raw/体质知识表.xlsx`、`RAG茶饮知识表_Sheet2.xlsx`、`体质日常表述.xlsx`：三份原始资料的只读副本，不在 `public/` 中。
- `scripts/import-knowledge.py`：可重复运行的导入程序。它复制原表副本、跳过空行、生成 JSON，并更新检查报告。
- `data/generated/knowledge.json`：9 条体质知识与 16 条茶饮知识的内部 JSON。
- `data/generated/daily-expressions.json`：45 条标准关键词与用户日常表达的内部 JSON。
- `lib/knowledge/retriever.ts`：小型检索函数。它只检索已通过规则结果范围的资料。
- `lib/knowledge/types.ts`：检索输入、知识记录与结构化结果的类型定义。
- `docs/knowledge-data-audit.md`：导入后发现的字段、编号、关联、审核状态与来源问题。
- `tests/knowledge-retrieval.test.ts`：知识检索的自动测试。

## 如何更新 Excel 并重新导入

将更新后的三份 Excel 放到同一个本地目录，保留文件名，然后在项目根目录运行：

```powershell
pnpm run knowledge:import -- --source "D:\203小组作业"
```

程序只读取你指定的目录，并将副本复制到 `resources/raw/`。它不会修改原目录里的 Excel。之后会重写两个生成 JSON 和 `docs/knowledge-data-audit.md`。

如果原始副本已经在项目中，也可以运行：

```powershell
pnpm run knowledge:import
```

导入完成后，应查看检查报告；遇到缺少字段、重复 `knowledge_id`、无效体质编码，或茶饮编号、名称、配料不一致时，应先人工确认资料，而不是在程序里猜测补齐。

## 检索如何工作

现有分析接口先按原有顺序完成：

```text
题目答案 → 体质评分 → 体质判定 → 茶饮匹配 → 安全过滤 → 知识检索
```

检索只读取已得到的规则结果：

1. 用主要和兼夹体质编码查找对应的体质知识。
2. 只用安全过滤后仍可自动推荐的茶饮编号查找茶饮知识。
3. 用标题、关键词、正文及该体质对应的日常表达来排序。
4. 只返回 `review_status` 为 `verified` 的知识资料。
5. 返回 `knowledge_id`、标题、正文、来源名称、来源网址、原表位置和匹配原因。

日常表达只是帮助检索资料的扩展词。例如“没精神”可以帮助找到气虚质相关的说明。它不会进入国标评分，也不会直接决定某人属于哪种体质。

安全过滤始终在检索之前。被阻断的茶饮不会因为知识表中有相关资料而重新出现在结果里。没有安全茶饮或没有符合条件的知识时，接口会返回空数组和明确原因。

## 如何查看一次检索结果

先启动网站并完成一次课堂演示流程。三轮演示对话结束时，网页会调用 `POST /api/analyze`。成功响应中的 `knowledge` 字段就是本阶段的结构化检索结果，包含：

```text
knowledge.constitutions
knowledge.teas
knowledge.emptyReasons
```

当前页面视觉没有改动，`knowledge` 先留给下一阶段的 AI 模块 B 生成可解释说明。也可以运行下面的测试，确认一个完整规则接口响应已经包含知识结果：

```powershell
pnpm run test:api
pnpm run test:knowledge
```

## 当前局限

- 这是本地字段匹配和排序，不是向量检索，也不会理解任意长的自然语言。
- `verified` 是组员填写的状态；程序只能按该字段筛选，不能代替来源和内容的人工核实。
- 体质知识表没有提供 URL，因此体质知识返回来源名称、条款位置和原表位置，`source_url` 会是空值。
- 检索不会补写医学依据、不会改变评分或安全规则，也不会把相关性写成体质概率。

## 下一步 AI 模块 B 应读取什么

AI 模块 B 应只读取规则分析完成后已经确定的字段：

- `scores` 中的转化分、判定和题目证据；
- `primaryConstitution` 与 `secondaryConstitutions`；
- `recommendations`、`cautiousTeas` 和 `excludedTeas`；
- `safetyWarnings`、`dataWarnings` 与 `safetyStatus`；
- `knowledge.constitutions` 和 `knowledge.teas` 中的 `knowledge_id`、`title`、`content`、`source`、`match_reasons`；
- `knowledge.emptyReasons`。

它不应重新计算体质分数、越过安全过滤加入茶饮，或把资料中的内容改写成诊断、治疗或疗效保证。
