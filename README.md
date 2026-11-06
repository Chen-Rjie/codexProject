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

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务健康状态 |
| `POST` | `/api/auth/register` | 注册并建立 Redis 会话 |
| `POST` | `/api/auth/login` | 登录并建立 Redis 会话 |
| `GET` | `/api/auth/me` | 获取当前登录用户 |
| `POST` | `/api/auth/logout` | 退出并删除当前会话 |
| `GET` | `/api/study/skills` | 查询当前用户的技能 |
| `POST` | `/api/study/skills` | 创建学习技能 |
| `PUT` | `/api/study/skills/{id}` | 修改学习技能 |
| `POST` | `/api/study/skills/{id}/generate-plan` | 按每周预算生成计划 |
| `GET` | `/api/study/items` | 查询日期范围内的学习安排 |
| `POST` | `/api/study/items` | 创建学习安排 |
| `POST` | `/api/study/items/{id}/complete` | 完成并记录真实学习时长 |
| `POST` | `/api/study/items/{id}/skip` | 跳过当前安排 |
| `GET` | `/api/study/sessions` | 查询学习记录 |
| `GET` | `/api/tasks` | 查询任务，支持 `search`、`status`、`priority` |
| `POST` | `/api/tasks` | 创建任务 |
| `PATCH` | `/api/tasks/{id}` | 修改任务 |
| `DELETE` | `/api/tasks/{id}` | 删除任务 |

旧任务接口暂时保留，用于兼容改造前的保险版本；新学习计划使用 `/api/study/**` 接口。

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
3. 在后端环境变量中配置 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`
4. 将 [config.ts](miniprogram/config.ts) 的 `API_BASE_URL` 改成已备案的 HTTPS 域名
5. 在微信公众平台配置 request 合法域名
6. 使用微信开发者工具导入 `miniprogram/` 目录

本地未安装微信开发者工具时，可以先执行：

```bash
npm run typecheck:miniprogram
```

当前 `project.config.json` 已写入开发 AppID。正式提审前必须关闭 `ENABLE_PASSWORD_LOGIN`，并配置生产 `WECHAT_APP_SECRET`。

### 无域名生产模式

小程序生产环境使用微信云托管时，不需要单独申请 API 域名：

1. 构建并推送 `backend/Dockerfile`
2. 在微信云托管创建 `flowboard-api` 服务，端口设置为 `4000`
3. 为服务配置腾讯云 MySQL、Redis 的私网地址
4. 将 `miniprogram/config.ts` 中的 `USE_CLOUD_CONTAINER` 改为 `true`
5. 配置 `CLOUD_ENV_ID` 和 `CLOUD_SERVICE_NAME`
6. 小程序端由 `wx.request` 自动切换为 `wx.cloud.callContainer`

本地 Web 端通过 SSH 隧道访问腾讯云后端，不开放公网 API：

```powershell
powershell -File scripts/ssh-tunnel.ps1 `
  -SshHost 腾讯云服务器IP `
  -SshUser ubuntu
```

隧道建立后，本地 Web 继续访问 `http://127.0.0.1:4000`。React 管理端现已使用 Bearer Token，不再依赖跨域 Cookie。生产服务器建议只允许后端访问 MySQL/Redis 私网地址。

小程序认证接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/wechat/login` | 使用微信 `code` 登录 |
| `POST` | `/api/auth/token/login` | 开发环境账号密码换取 Token |
| `POST` | `/api/auth/token/refresh` | 轮换 Access/Refresh Token |
| `POST` | `/api/auth/token/logout` | 撤销当前 Token |
