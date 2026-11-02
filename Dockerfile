# 构建阶段固定跑在构建机原生架构：产物是纯静态文件，与目标架构无关，
# 多架构镜像只构建一次前端，避免 arm64 在 QEMU 里模拟安装与构建
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS builder

WORKDIR /build

# 使用与仓库一致的 pnpm 版本，避免 latest 带来不兼容
RUN corepack enable && corepack prepare pnpm@9.0.2 --activate

# 依赖下载只取决于锁文件，单独成层，源码改动不会让它失效
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY package.json turbo.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN pnpm install --offline --frozen-lockfile && \
    pnpm --filter @wemd/web run build

# 运行阶段 - 使用 nginx 提供静态文件服务
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /build/apps/web/dist /usr/share/nginx/html

# 复制 nginx 配置（支持 SPA 路由）
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
