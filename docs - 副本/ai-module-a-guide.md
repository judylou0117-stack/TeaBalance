# AI 模块 A：对话理解与追问

## 当前目的

模块 A 负责把用户对标准题目的明确自然语言回答整理为候选频率，并由程序自动记录。自动记录的答案不会立即进入评分；全部题目完成后，用户必须在汇总页统一确认。模块 A 不计算体质转化分、不判定体质、不匹配茶饮，也不绕过安全规则。

默认是本地、确定性的课堂演示模拟：不调用任何模型，不需要 API Key，也不把对话健康信息写入服务端文件或日志。现在也预留了 OpenRouter 的服务端真实调用路径；只有明确切换为真实模式、并完整配置后才会请求模型。

## 对话如何运行

1. 安全页已填写的生理性别决定题目分支：女性使用 Q017，男性使用 Q018；另一题不会出现。
2. 对话页按现有题库逐题询问近一年的频率，不再限制为三轮。
3. 点击五级快捷选项会直接记录并进入下一题；自然语言只有在识别到唯一、明确的五级频率时才会自动记录。
4. 系统保留每题用户原话；模糊、冲突、缺少频率或“不确定 / 不愿透露”只会触发追问。
5. 全部题目完成后显示答案汇总，用户可以修改任意频率；原始表述仍保留。
6. 若回答含糊、包含多个频率、说“不确定”或“不愿透露”，系统只追问，不会填入分数。
7. 只有用户点击“确认并开始分析”，系统才设置汇总确认标记并允许进入规则分析页。

若用户不愿透露生理性别，系统不会代填 Q017 或 Q018。其余题目可继续确认，但湿热质会保持“信息不足，无法完成严格判定”，不会被包装为完整结论。

## 输入与输出格式

`POST /api/chat` 根据服务端模式工作：默认 `mode: "mock"`；真实模式配置完成后为 `mode: "live"`；真实模式缺少配置时为 `mode: "not-configured"`，不会回退成模拟答案或把模拟答案包装成真实 AI 输出。

输入包含：

- `profile.sex`：`female`、`male` 或 `undisclosed`；
- `language`：`zh` 或 `en`；
- `action`：`start`、`interpret`、`select`、`revise-answer`、`finalize`；
- `message`：自然语言输入，或快捷选项的原始文字；
- `value` / `questionId`：快捷选择和汇总修改时使用；
- `state`：当前题目、已整理答案和最终汇总确认时间。

输出包含：

- `mode: "mock"`：明确表示没有真实模型调用；
- `mode: "live"`：表示自然语言由已配置的服务端模型整理；程序仍会严格校验，最终汇总仍须用户确认；
- `mode: "not-configured"`：表示选择了真实模式但服务端没有完整配置，不能继续整理对话；
- 当前标准题、已整理答案和用户原话；
- 用于最终确认的 `reviewItems`；
- 待补充题目编号；
- 性别未透露时的严格判定边界。

类型定义位于 `types/conversation-module.ts`。

## 正式提示词

真实路径使用 [conversation-prompt.ts](../lib/conversation/conversation-prompt.ts) 中的 `CONVERSATION_EXTRACTION_PROMPT` 和 JSON Schema。它约束模型只能处理当前题目、保留原话、在频率明确时给出候选、遇到不确定或矛盾时追问，并禁止直接评分、判定、推荐或输出医疗结论。

模型输出必须经过与当前模拟服务相同的题号、频率和原话校验。明确候选可自动记录，但只有最终汇总确认后才能提交 `/api/analyze`。

## 设计理由

- **可解释**：每一个答案都有题目编号、用户原话和记录时间，最终另有汇总确认标记。
- **不擅自推断**：模糊、矛盾或不愿透露的信息不会被模型或程序猜成分数。
- **不混合职责**：对话理解、规则评分、安全过滤、知识检索和模块 B 分开，便于审计和替换。
- **尊重性别分支**：Q017/Q018 不会互相代填；未透露性别时保留规则后端已有的信息不足状态。
- **易于替换**：前端只调用 `/api/chat`，未来可将该路由内部的模拟服务替换为受约束的服务端模型调用，而无需改写评分、安全或结果页。

## 主要文件

- `data/conversation-simulation.json`：模拟提示文字、频率词、歧义词和英文题目显示文本。
- `lib/conversation/service.ts`：题目分支、候选提取、自动记录、汇总修改和完整性检查。
- `lib/conversation/model-client.ts`：OpenRouter 的模块 A 服务端适配器与候选答案校验。
- `lib/openrouter/client.ts`：模块 A/B 共用的 OpenRouter Chat Completions 传输层。
- `app/api/chat/route.ts`：模拟或真实对话接口；不记录用户健康文本。
- `lib/client-chat.ts`：前端调用接口的服务层。
- `components/chat/ChatPanel.tsx`：逐题对话、自动推进和最终答案汇总界面。
- `lib/mock-api.ts`：只在答案完整且汇总确认后提交给既有 `/api/analyze`。

## 测试

`tests/conversation-module.test.ts` 覆盖快捷选择与自然语言自动记录、含糊与矛盾追问、汇总修改、女性/男性分支、性别未透露的信息不足、最终确认门禁，以及未完成时的缺失题目检查。

## OpenRouter 配置（默认不启用）

在项目根目录的 `.env.local` 中填写配置；该文件已被 Git 忽略。不要把密钥放进任何 `NEXT_PUBLIC_` 字段。可复制根目录的 [.env.example](../.env.example) 作为字段说明：

```text
TEA_BALANCE_AI_MODE=mock
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENROUTER_MODEL_A=
OPENROUTER_MODEL_B=
```

要启用真实模块 A，先核实可用模型 ID 后将 `TEA_BALANCE_AI_MODE` 改为 `live`，填写 `OPENROUTER_API_KEY`，并填写 `OPENROUTER_MODEL_A` 或通用的 `OPENROUTER_MODEL`。本项目不会提供或默认填写任何模型名称。真实模式仍由程序检查当前题目、1—5 范围和用户原话；自动记录的候选也不能绕过最终汇总确认直接进入评分。
