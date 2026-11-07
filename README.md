# 轻学计划

面向上班族的多技能学习计划工具。后端使用 Java + Spring Boot，前端使用 React + TypeScript，业务数据存储在 MySQL，登录会话存储在 Redis。

当前 Web 版本包含：

- 今日学习清单与专注计时
- 多技能每周时间预算
- 按技能自动生成本周学习安排
- 学习完成、跳过和真实时长记录
- 每日投入、计划完成率、连续学习和技能时间分配复盘

## 技术栈

- 后端：Java 21、Spring Boot 3.3、Spring Security、Spring Data JPA、Flyway、Bean Validation
- 前端：React 18、TypeScript、Vite
- 数据库：MySQL 8.0
- 缓存与会话：Redis
- 接口：REST + JSON

## 项目结构

```text
codexProject/
├─ backend/           Spring Boot REST API
│  └─ src/
├─ frontend/          React 单页应用
│  └─ src/
├─ miniprogram/       原生微信小程序
├─ scripts/           本地 Maven 与服务启动脚本
├─ package.json       统一开发与构建命令
├─ docker-compose.yml MySQL + Redis 容器配置
└─ README.md
```

## 本地启动

要求：

- JDK 21+
- Maven 3.9+
- Node.js 20+

当前工作区的 `.tools` 中已经放置了便携 JDK、Maven、MySQL 与 Redis。`npm run dev` 会自动启动 MySQL/Redis，并使用项目内 JDK/Maven；其他机器上如果没有 `.tools`，Maven 会回退到系统 PATH。

依赖已配置为国内镜像：

- npm：`https://registry.npmmirror.com/`
- Maven：`https://repo.huaweicloud.com/repository/maven/`

首次安装前后端依赖：

```bash
npm install
npm --prefix frontend install
```

启动 MySQL、Redis 与前后端：

```bash
npm run dev
```

启动后访问：

- 前端：<http://127.0.0.1:5173>
- 后端健康检查：<http://127.0.0.1:4000/api/health>
- MySQL：`127.0.0.1:3306`，数据库 `flowboard`
- Redis：`127.0.0.1:6379`

应用没有预置演示账号。首次打开时选择“立即注册”，注册成功后会自动登录。

也可以分别在两个终端中运行：

```bash
npm run services
npm run dev:api
npm run dev:web
```

### Java 远程调试

启动带 JDWP 调试端口的前后端：

```bash
npm run debug
```

Java 后端会监听 `127.0.0.1:5005`。在 IntelliJ IDEA 中打开：

1. `Run` → `Edit Configurations`
2. 添加 `Remote JVM Debug`
3. Name 设置为 `Flowboard API`
4. Host 设置为 `127.0.0.1`
5. Port 设置为 `5005`
6. 点击 Debug，附加成功后即可设置 Java 断点

如果只需要 Java 调试而前端已经运行：

```bash
npm run debug:api
```

JDWP 只绑定本机回环地址，不应在公网服务器上开放调试端口。

如果已经安装 Docker，也可以使用以下命令代替项目内便携服务：

```bash
docker compose up -d
```

## 验证

```bash
npm test
npm run build
```

后端测试覆盖注册、登录、退出、会话、用户数据隔离、学习技能、自动排课、学习记录、旧任务接口、参数校验和 404 响应；构建命令会同时验证 Java 编译、后端测试以及 TypeScript/Vite 生产构建。

## REST API

小程序当前使用下列接口（云托管 `callContainer` 私有链路，请求头带 `X-WX-SERVICE`）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务健康状态 |
| `POST` | `/api/auth/wechat/login` | 微信登录，由网关注入 openid，返回 access/refresh token |
| `POST` | `/api/auth/token/refresh` | 刷新 access token（401 时自动调用一次） |
| `POST` | `/api/auth/token/logout` | 退出并吊销 refresh token |
| `GET` | `/api/auth/me` | 获取当前用户 |
| `PUT` | `/api/auth/me` | 修改昵称（`flowboard-api-021` 起提供） |
| `POST` | `/api/auth/token/login` | 账号密码登录，仅本地开发 |
| `POST` | `/api/auth/token/register` | 账号密码注册，仅本地开发 |
| `GET` | `/api/study/skills` | 查询技能（含已归档，返回 `archived` 标记） |
| `POST` | `/api/study/skills` | 创建技能 |
| `PUT` | `/api/study/skills/{id}` | 修改技能（`active` 省略时保持原值） |
| `DELETE` | `/api/study/skills/{id}` | 归档技能，从列表移除，保留全部计划与学习记录 |
| `POST` | `/api/study/skills/{id}/generate-plan` | 按每周次数补足指定周安排；`weekStart` 可传，过去周与已停止排期返回 409/空 |
| `GET` | `/api/study/items` | 查询日期范围内的学习安排（跨度上限 366 天） |
| `POST` | `/api/study/items` | 创建学习安排（已停止排期返回 409） |
| `DELETE` | `/api/study/items/{id}` | 删除学习安排，已产生的学习记录保留 |
| `POST` | `/api/study/items/{id}/complete` | 完成并记录学习时长（幂等；未来日期返回 409；单次 1–600 分钟） |
| `POST` | `/api/study/items/{id}/skip` | 跳过安排（已完成项返回 409；不覆盖原备注） |
| `POST` | `/api/study/items/reflow` | 顺延过期的未完成安排，顺延备注只追加一次 |
| `GET` | `/api/study/sessions` | 查询学习记录（跨度上限 366 天） |

技能有两个独立状态：`active=false` 表示「停止排期」（可逆，不再产生新安排，已有安排保留），`archived=true` 表示「已移除」（不再出现在技能列表，也不再可编辑或排期）。两者都**不会删除** `study_items` 和 `study_sessions`；计划页仍用归档技能的名称显示历史安排。`GET /api/study/skills` 会返回归档技能，客户端需按 `archived` 自行过滤列表，同时保留它做名称映射。

兼容接口 `/api/auth/login`、`/api/auth/register`、`/api/auth/logout`、`/api/tasks` 仍保留，用于改造前的保险版本，小程序不再调用。

## 数据库迁移

`V1`–`V4` 位于 `backend/src/main/resources/db/migration/`，由 Flyway 在后端启动时自动执行，**不需要手工执行 SQL**。本地配置是同步迁移（`flyway.enabled: true`、`ddl-auto: validate`）；云托管配置是异步迁移（`app.database.async-initialization: true`），迁移完成后 `/api/health/database` 才就绪，期间 `/api/study/**` 返回带 `Retry-After` 的 503。

`V4__archive_study_skills.sql` 会新增 `archived` 列并把唯一约束改为 `(owner_id, name, archived)`，使同名技能在归档后可以重新创建。**不要修改已发布的迁移文件**，否则 Flyway 校验 checksum 会失败；新的结构变更请新增 `V5`。

## 配置

后端支持以下环境变量：

- `PORT`：服务端口，默认 `4000`
- `DB_HOST`、`DB_PORT`、`DB_NAME`：MySQL 地址与数据库名
- `DB_USERNAME`、`DB_PASSWORD`：MySQL 账号密码
- `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD`：Redis 连接配置
- `CORS_ALLOWED_ORIGINS`：允许的前端来源，逗号分隔
- `SESSION_COOKIE_SECURE`：HTTPS 部署时设置为 `true`
- `REGISTRATION_ENABLED`：是否开放注册，默认 `true`
- `WECHAT_APP_ID`：微信小程序 AppID
- `WECHAT_APP_SECRET`：微信小程序 AppSecret，只允许配置在后端

完整示例见 [.env.example](.env.example)。生产环境必须修改默认数据库密码，并通过环境变量注入真实凭据。

前端生产环境可以通过 `VITE_API_URL` 指向后端 API 根地址：

```bash
VITE_API_URL=https://api.example.com/api npm run build:web
```

## 微信小程序

小程序目录为 `miniprogram/`，使用原生微信小程序 + TypeScript。当前包含：

- 微信 `wx.login()` 获取 code
- 后端换取 `openid` 并签发 Access Token / Refresh Token
- 开发环境账号密码 Token 登录
- 今日学习、技能、本周计划、学习复盘

首次打开前：

1. 在微信公众平台注册小程序并取得 AppID
2. 将 AppID 写入 `miniprogram/project.config.json`
3. 在微信云托管创建环境与服务（生产服务 `flowboard-api`，端口 `4000`）
4. 在 `miniprogram/config.ts` 配置 `CLOUD_ENV_ID` 和 `CLOUD_SERVICE_NAME`，保持 `USE_CLOUD_CONTAINER = true`
5. 使用微信开发者工具导入 `miniprogram/` 目录

云托管模式下 `callContainer` 由网关注入 `X-WX-OPENID`，无需 request 合法域名、无需备案域名，也不需要 `WECHAT_APP_SECRET` 换取 `code`。只有本地 `USE_CLOUD_CONTAINER = false` 时才走 `wx.request` + `API_BASE_URL` + `WECHAT_APP_SECRET`。

本地未安装微信开发者工具时，可以先执行：

```bash
npm run typecheck:miniprogram
```

`ENABLE_PASSWORD_LOGIN` 已跟随 `USE_CLOUD_CONTAINER` 自动取反：云托管模式关闭账号密码登录入口，本地模式自动开启供联调。

### 云托管生产模式

小程序生产环境使用微信云托管，不需要单独申请 API 域名：

1. 使用仓库根目录 `Dockerfile` 构建并推送镜像；镜像已内置 `SPRING_PROFILES_ACTIVE=cloud`
2. 在微信云托管创建 `flowboard-api` 服务，端口设置为 `4000`
3. 为服务配置腾讯云 MySQL、Redis 的私网地址（生产 `REDIS_URL` 需为 `rediss://`）
4. 保持 `USE_CLOUD_CONTAINER = true`，配置 `CLOUD_ENV_ID` 和 `CLOUD_SERVICE_NAME`
5. 小程序端由 `wx.request` 切换为 `wx.cloud.callContainer`
6. 生产环境在「服务设置」中关闭公网访问，只保留 `callContainer`，避免外部伪造 `X-WX-OPENID`

`cloud` Profile 会先启动 4000 端口，再在后台执行 Flyway 迁移，避免 Serverless MySQL 冷启动期间被 Readiness/Liveness 检查误杀。若云平台显式设置 `SPRING_PROFILES_ACTIVE`，该值会覆盖镜像默认值，因此应保持为 `cloud` 或留空。

首次微信登录会自动建号（默认昵称「微信用户」），随后引导用户填写昵称，通过 `PUT /api/auth/me` 持久化。

`scripts/ssh-tunnel.ps1` 属于旧 CVM 架构，用于本地 Web 通过 SSH 隧道访问当时没有公网入口的后端；云托管没有 SSH 宿主机，该链路已不可用。现在本地 Web 仅用于开发：`http://127.0.0.1:5173` → Vite 代理 → 本地 `127.0.0.1:4000` → 本地 MySQL/Redis。React 管理端使用 Bearer Token，不依赖跨域 Cookie。

小程序认证接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/wechat/login` | 云托管模式读网关注入的 `X-WX-OPENID`（本地模式用 `code`）；首次登录自动建号 |
| `PUT` | `/api/auth/me` | 更新当前用户昵称 |
| `POST` | `/api/auth/token/login` | 本地联调环境账号密码换取 Token |
| `POST` | `/api/auth/token/refresh` | 轮换 Access/Refresh Token |
| `POST` | `/api/auth/token/logout` | 撤销当前 Token |
