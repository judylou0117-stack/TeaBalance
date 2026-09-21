# Tea Balance（知体茶语）前端原型

一个使用 Next.js App Router 兼容结构、TypeScript、React 与 Tailwind CSS 构建的课堂演示前端。项目不连接真实 AI、数据库、用户账户或外部健康数据服务。

## 开始使用

请先安装 Node.js 22.13 或更高版本，以及 pnpm。然后在项目根目录运行：

```bash
pnpm install
pnpm dev
```

终端会显示本地地址，通常是 `http://localhost:3000`。如果 3000 端口已占用，会自动使用 3001 等其他端口。

正式检查：

```bash
pnpm lint
pnpm build
```

## 目录说明

- `app/`：六个页面路由和全局样式。
- `components/`：按首页、安全信息、对话、结果、反馈和通用布局拆分的界面组件。
- `data/`：与界面分离的全部模拟 JSON 数据。
- `data/translations/`：中文、英文页面文案。
- `lib/mock-api.ts`：所有页面共用的模拟服务层，也是未来替换真实请求的主要入口。
- `lib/safety-filter.ts`：急性不适阻止、过敏排除和保守推荐规则。
- `lib/storage.ts`：`sessionStorage` 会话数据读写。
- `types/`：体质、茶饮、安全信息、对话和结果的 TypeScript 类型。
- `public/`：品牌图标和社交分享图。

## 修改模拟内容

- 三轮模拟对话：`data/conversation.json`
- 茶饮与配料：`data/teas.json`
- 体质介绍：`data/constitutions.json`
- 示例结果和证据：`data/mock-result.json`
- 首页演示历史：`data/mock-history.json`
- 安全规则配置：`data/safety-rules.json`
- 中文文案：`data/translations/zh.json`
- 英文文案：`data/translations/en.json`

## 将来接入后端

优先替换 `lib/mock-api.ts` 中的方法。页面已经统一通过这个服务层工作，不需要重写界面。文件内预留了下列真实接口位置：

- `POST /api/session`
- `POST /api/safety-check`
- `POST /api/chat`
- `POST /api/analyze`
- `POST /api/feedback`
- `GET /api/history`

正式版本中，生成式 AI 只应负责自然语言交互、信息提取和结果解释；评分、安全过滤与茶饮匹配应继续使用可审核的规则和数据。

## 当前仍为模拟的内容

AI 回复、体质转化分、证据链、体质解释、茶饮配方、审核状态、资料来源、历史记录和反馈提交均为前端模拟。资料来源统一标记为“演示来源，待替换”，没有编造机构、文献或网址。
