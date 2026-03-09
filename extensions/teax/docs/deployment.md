# 部署配置文档

> Docker Compose 部署和环境变量配置

## 部署架构

```text
┌─────────────────────────────────────────────────────────┐
│                     Nginx (反向代理)                     │
│                    SSL 终止 + 负载均衡                    │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Teax    │  │  Teax    │  │  Teax    │
│  App 1   │  │  App 2   │  │  App 3   │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │            │            │
     └────────────┼────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌──────────────┐    ┌──────────────┐
│  PostgreSQL  │    │    Redis     │
│   (主从)      │    │   (缓存)     │
└──────────────┘    └──────────────┘
```

## Docker Compose 配置

### docker-compose.yml

```yaml
version: '3.8'

services:
  # Teax 应用
  teax:
    image: teax/app:latest
    container_name: teax-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      # 数据库配置
      - DATABASE_URL=postgresql://teax:${DB_PASSWORD}@postgres:5432/teax
      
      # Gitea 配置
      - GITEA_URL=${GITEA_URL}
      - GITEA_CLIENT_ID=${GITEA_CLIENT_ID}
      - GITEA_CLIENT_SECRET=${GITEA_CLIENT_SECRET}
      - GITEA_WEBHOOK_SECRET=${GITEA_WEBHOOK_SECRET}
      
      # 飞书配置
      - FEISHU_APP_ID=${FEISHU_APP_ID}
      - FEISHU_APP_SECRET=${FEISHU_APP_SECRET}
      - FEISHU_ENCRYPT_KEY=${FEISHU_ENCRYPT_KEY}
      - FEISHU_VERIFICATION_TOKEN=${FEISHU_VERIFICATION_TOKEN}
      - FEISHU_APPROVAL_CODE=${FEISHU_APPROVAL_CODE}
      
      # 应用配置
      - NODE_ENV=production
      - SESSION_SECRET=${SESSION_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      
      # Docker 配置（用于工作区和 Agent）
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - teax-data:/app/data
    depends_on:
      - postgres
      - redis
    networks:
      - teax-network

  # PostgreSQL 数据库
  postgres:
    image: postgres:14-alpine
    container_name: teax-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=teax
      - POSTGRES_USER=teax
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - teax-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U teax"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis 缓存
  redis:
    image: redis:7-alpine
    container_name: teax-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    networks:
      - teax-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Nginx 反向代理
  nginx:
    image: nginx:alpine
    container_name: teax-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - teax
    networks:
      - teax-network

volumes:
  teax-data:
  postgres-data:
  redis-data:

networks:
  teax-network:
    driver: bridge
```

## 环境变量配置

### .env 文件

```bash
# 数据库配置
DB_PASSWORD=your_secure_db_password

# Gitea 配置
GITEA_URL=https://gitea.example.com
GITEA_CLIENT_ID=your_gitea_client_id
GITEA_CLIENT_SECRET=your_gitea_client_secret
GITEA_WEBHOOK_SECRET=your_webhook_secret

# 飞书配置
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=your_feishu_app_secret
FEISHU_ENCRYPT_KEY=your_encrypt_key
FEISHU_VERIFICATION_TOKEN=your_verification_token
FEISHU_APPROVAL_CODE=your_approval_code

# 应用配置
SESSION_SECRET=your_session_secret_min_32_chars
ENCRYPTION_KEY=your_encryption_key_32_chars

# Redis 配置
REDIS_PASSWORD=your_redis_password
```

### 环境变量说明

| 变量名 | 说明 | 必需 |
| ------ | ---- | ---- |
| `DATABASE_URL` | PostgreSQL 连接字符串 | ✅ |
| `GITEA_URL` | Gitea 实例地址 | ✅ |
| `GITEA_CLIENT_ID` | Gitea OAuth 应用 ID | ✅ |
| `GITEA_CLIENT_SECRET` | Gitea OAuth 应用密钥 | ✅ |
| `GITEA_WEBHOOK_SECRET` | Gitea Webhook 签名密钥 | ✅ |
| `FEISHU_APP_ID` | 飞书应用 ID | ❌ |
| `FEISHU_APP_SECRET` | 飞书应用密钥 | ❌ |
| `FEISHU_ENCRYPT_KEY` | 飞书消息加密 Key | ❌ |
| `FEISHU_VERIFICATION_TOKEN` | 飞书事件验证 Token | ❌ |
| `FEISHU_APPROVAL_CODE` | 飞书审批定义 Code | ❌ |
| `SESSION_SECRET` | Session 加密密钥（≥32 字符） | ✅ |
| `ENCRYPTION_KEY` | 数据加密密钥（32 字符） | ✅ |
| `REDIS_PASSWORD` | Redis 密码 | ✅ |

## Nginx 配置

### nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    upstream teax_backend {
        server teax:3000;
    }

    server {
        listen 80;
        server_name teax.example.com;
        
        # 重定向到 HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name teax.example.com;

        # SSL 证书
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # 客户端最大上传大小
        client_max_body_size 100M;

        # 代理到 Teax 应用
        location / {
            proxy_pass http://teax_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket 超时
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
        }

        # 工作区代理（特殊处理）
        location /workspace/ {
            proxy_pass http://teax_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # 长连接超时（Web IDE）
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
        }
    }
}
```

## 部署步骤

### 1. 准备环境

```bash
# 安装 Docker 和 Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 克隆配置文件

```bash
# 创建部署目录
mkdir -p /opt/teax
cd /opt/teax

# 复制配置文件
cp docker-compose.yml .
cp .env.example .env
cp nginx.conf .

# 创建 SSL 证书目录
mkdir -p ssl
```

### 3. 配置环境变量

```bash
# 编辑 .env 文件
vim .env

# 生成随机密钥
openssl rand -hex 32  # SESSION_SECRET
openssl rand -hex 16  # ENCRYPTION_KEY
```

### 4. 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f teax

# 检查服务状态
docker-compose ps
```

### 5. 初始化数据库

```bash
# 进入应用容器
docker-compose exec teax sh

# 运行数据库迁移
pnpm db:push

# 退出容器
exit
```

### 6. 配置 Gitea OAuth

1. 登录 Gitea 管理后台
2. 创建 OAuth 应用
   - 应用名称：Teax
   - 重定向 URI：`https://teax.example.com/api/auth/callback/gitea`
3. 复制 Client ID 和 Client Secret 到 `.env`

### 7. 配置飞书应用（可选）

1. 登录飞书开放平台
2. 创建企业自建应用
3. 配置事件订阅 URL：`https://teax.example.com/api/webhooks/feishu`
4. 配置机器人和审批权限
5. 复制应用凭证到 `.env`

## 运维指南

### 日志查看

```bash
# 查看应用日志
docker-compose logs -f teax

# 查看数据库日志
docker-compose logs -f postgres

# 查看 Nginx 日志
docker-compose logs -f nginx
```

### 数据备份

```bash
# 备份数据库
docker-compose exec postgres pg_dump -U teax teax > backup_$(date +%Y%m%d).sql

# 备份数据卷
docker run --rm -v teax_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data_$(date +%Y%m%d).tar.gz /data
```

### 更新应用

```bash
# 拉取最新镜像
docker-compose pull teax

# 重启应用
docker-compose up -d teax

# 查看更新日志
docker-compose logs -f teax
```

### 扩容部署

```bash
# 启动多个应用实例
docker-compose up -d --scale teax=3

# Nginx 会自动负载均衡到所有实例
```

## 监控和告警

### Prometheus + Grafana

```yaml
# 添加到 docker-compose.yml
prometheus:
  image: prom/prometheus:latest
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus-data:/prometheus
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana:latest
  volumes:
    - grafana-data:/var/lib/grafana
  ports:
    - "3001:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
```

## 相关文档

- [架构概览](./overview.md) - 系统整体架构
- [数据库设计](./database-design.md) - 数据库配置
- [工作区](./workspace.md) - Docker 容器管理
