# 商城分销系统（Mall Distribution System）

一个面向商城分销场景的全栈 Monorepo 项目，覆盖 **C 端消费者小程序、B 端商家小程序、管理后台、后端 API** 四端，支持 H5 与微信小程序双端运行。

## 项目结构

```
MallDistributionSystem
├── apps
│   ├── mini-c        # C 端消费者小程序（Taro + React + NutUI）
│   ├── mini-b        # B 端商家小程序（Taro + React + NutUI，黑金主题）
│   ├── admin         # 管理后台（React 18 + Vite + Ant Design Pro）
│   └── api           # 后端 API（NestJS + Prisma + PostgreSQL）
├── packages
│   └── shared        # 多端共享的类型、工具与业务常量
├── deploy
│   └── cloudbase     # 云托管部署（Dockerfile + 构建脚本）
├── docs              # 产品方案、设计规范与领域文档（含 ADR、Glossary）
└── docker-compose.yml
```

## 技术栈

| 端 | 技术 |
| --- | --- |
| C 端小程序 | Taro 4、React 18、NutUI-React、支持 weapp / H5 双端构建 |
| B 端小程序 | Taro 4、React 18、NutUI-React、黑金主题设计规范 |
| 管理后台 | React 18、Vite 7、Ant Design 5、Pro Components |
| 后端 API | NestJS 11、Prisma ORM、PostgreSQL 16、JWT 认证、定时任务 |
| 共享包 | TypeScript、tsup（CJS/ESM 双格式） |
| 基础设施 | pnpm Workspace、Docker Compose、腾讯云托管（CloudBase） |

## 核心功能

- **分销体系**：邀请码绑定、佣金结算（commissions）、对账单（statements）
- **商家端**：商品与定价管理、销售工作台、样品（samples）、客户旅程（journeys）
- **C 端商城**：商品浏览、下单、个人中心
- **运营支撑**：盒码（box-codes）、渠道（channels）、合同（contracts）、预付金（prepaid）
- **管理后台**：账户与权限、审计日志、报表、预警与提醒、培训资料（materials / training）
- **通知**：消息通知（notifications）、合同解读（interpretations）

## 快速开始

### 环境要求

- Node.js >= 20.19
- pnpm 12（`corepack enable` 后自动生效）
- Docker（用于本地 PostgreSQL）

### 安装依赖

```bash
pnpm install
```

### 启动数据库

```bash
pnpm db:up          # 启动 PostgreSQL（docker compose）
```

### 初始化数据

```bash
pnpm db:push        # 同步 Prisma Schema 到数据库
pnpm db:seed        # 写入种子数据
```

### 本地开发

```bash
pnpm dev            # 并行启动所有端
pnpm dev:api        # 仅启动后端 API
pnpm dev:admin      # 仅启动管理后台
pnpm dev:mini-b     # 仅启动商家端（H5 模式）
pnpm dev:mini-c     # 仅启动 C 端（H5 模式）
```

> 小程序端如需切换为微信小程序构建，可将对应端的 `dev` 命令改为 `--type weapp`。

### 构建与验证

```bash
pnpm build          # 构建全部（shared 优先）
pnpm typecheck      # 全仓库类型检查
pnpm test           # 单元测试
pnpm test:e2e       # API 端到端测试
```

## 常用命令速查

| 命令 | 说明 |
| --- | --- |
| `pnpm db:up` / `pnpm db:down` | 启动 / 停止本地 PostgreSQL |
| `pnpm db:generate` | 生成 Prisma Client |
| `pnpm db:push` | 同步 Schema 到数据库 |
| `pnpm db:migrate` | 执行迁移 |
| `pnpm db:setup` | 一键建库 + 种子数据 |
| `pnpm db:seed` | 写入种子数据 |

## 工程约定

- **Monorepo 管理**：使用 pnpm workspace，`@mall/shared` 为各端共享包，修改后需重新构建（`postinstall` 已自动处理）
- **数据库**：Prisma Schema 位于 `apps/api/prisma`，本地连接默认端口 `5433`
- **双主题体系**：商家端采用黑金主题（详见 `docs/mini-b-blackgold-ui-spec.md`）
- **领域文档**：统一词汇见根目录 `GLOSSARY.md`，架构决策记录见 `docs/adr/`
- **部署**：云托管部署方案见 `deploy/cloudbase/README.md`

## License

Apache License 2.0
