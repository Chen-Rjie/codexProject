# Flowboard

一个前后端分离的任务管理看板。后端使用 Java + Spring Boot，前端使用 React + TypeScript，业务数据存储在 MySQL，登录会话存储在 Redis。

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

后端测试覆盖注册、登录、退出、会话、用户数据隔离、任务 CRUD、参数校验和 404 响应；构建命令会同时验证 Java 编译、后端测试以及 TypeScript/Vite 生产构建。

## REST API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务健康状态 |
| `POST` | `/api/auth/register` | 注册并建立 Redis 会话 |
| `POST` | `/api/auth/login` | 登录并建立 Redis 会话 |
| `GET` | `/api/auth/me` | 获取当前登录用户 |
| `POST` | `/api/auth/logout` | 退出并删除当前会话 |
| `GET` | `/api/tasks` | 查询任务，支持 `search`、`status`、`priority` |
| `POST` | `/api/tasks` | 创建任务 |
| `PATCH` | `/api/tasks/{id}` | 修改任务 |
| `DELETE` | `/api/tasks/{id}` | 删除任务 |

任务状态：`TODO`、`IN_PROGRESS`、`DONE`

任务优先级：`LOW`、`MEDIUM`、`HIGH`

## 配置

后端支持以下环境变量：

- `PORT`：服务端口，默认 `4000`
- `DB_HOST`、`DB_PORT`、`DB_NAME`：MySQL 地址与数据库名
- `DB_USERNAME`、`DB_PASSWORD`：MySQL 账号密码
- `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD`：Redis 连接配置
- `CORS_ALLOWED_ORIGINS`：允许的前端来源，逗号分隔
- `SESSION_COOKIE_SECURE`：HTTPS 部署时设置为 `true`
- `REGISTRATION_ENABLED`：是否开放注册，默认 `true`

完整示例见 [.env.example](.env.example)。生产环境必须修改默认数据库密码，并通过环境变量注入真实凭据。

前端生产环境可以通过 `VITE_API_URL` 指向后端 API 根地址：

```bash
VITE_API_URL=https://api.example.com/api npm run build:web
```
