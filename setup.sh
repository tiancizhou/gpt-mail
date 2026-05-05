#!/bin/bash
set -euo pipefail

# ============================================================
#  GPT Mail - macOS 一键部署脚本
#  用法: chmod +x setup.sh && ./setup.sh
# ============================================================

cd "$(dirname "$0")"

# ---------- 颜色 ----------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ---------- 1. 检查系统依赖 ----------
info "检查系统依赖..."

if ! command -v node &>/dev/null; then
  err "未检测到 Node.js，请先安装 Node.js >= 18。"
  echo "  推荐使用 Homebrew: brew install node"
  echo "  或者使用 nvm: https://github.com/nvm-sh/nvm"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  err "Node.js 版本过低 (当前 $(node -v))，需要 >= 18。"
  exit 1
fi
ok "Node.js $(node -v)"

if ! command -v npm &>/dev/null; then
  err "未检测到 npm。"
  exit 1
fi
ok "npm $(npm -v)"

# Xcode Command Line Tools (better-sqlite3 编译需要)
if ! xcode-select -p &>/dev/null; then
  warn "未检测到 Xcode Command Line Tools，正在安装..."
  xcode-select --install 2>/dev/null || true
  echo ""
  echo -e "${YELLOW}请等待 Xcode Command Line Tools 安装完成后重新运行此脚本。${NC}"
  exit 0
fi
ok "Xcode Command Line Tools"

# ---------- 2. 检查或创建 .env ----------
ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
  echo ""
  info "未检测到 .env 文件，开始配置环境变量。"
  echo -e "${BOLD}以下信息请按提示输入，生成的密钥会自动填入。${NC}"
  echo ""

  # 交互式输入
  read -rp "$(echo -e ${CYAN}管理员邮箱 [admin@example.com]: ${NC})" ADMIN_EMAIL
  ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}

  read -rp "$(echo -e ${CYAN}管理员密码 [至少 6 位]: ${NC})" ADMIN_PASSWORD
  while [ ${#ADMIN_PASSWORD} -lt 6 ]; do
    warn "密码长度至少 6 位，请重新输入。"
    read -rp "$(echo -e ${CYAN}管理员密码: ${NC})" ADMIN_PASSWORD
  done

  read -rp "$(echo -e ${CYAN}域名邮箱 API 地址 [例如 https://qlcc.online]: ${NC})" EMAIL_API_URL
  while [ -z "$EMAIL_API_URL" ]; do
    warn "不能为空。"
    read -rp "$(echo -e ${CYAN}域名邮箱 API 地址: ${NC})" EMAIL_API_URL
  done

  read -rp "$(echo -e ${CYAN}域名邮箱管理员邮箱: ${NC})" EMAIL_ADMIN
  while [ -z "$EMAIL_ADMIN" ]; do
    warn "不能为空。"
    read -rp "$(echo -e ${CYAN}域名邮箱管理员邮箱: ${NC})" EMAIL_ADMIN
  done

  read -rp "$(echo -e ${CYAN}域名邮箱管理员密码: ${NC})" EMAIL_PASSWORD
  while [ -z "$EMAIL_PASSWORD" ]; do
    warn "不能为空。"
    read -rp "$(echo -e ${CYAN}域名邮箱管理员密码: ${NC})" EMAIL_PASSWORD
  done

  # 自动生成密钥
  SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
  ENCRYPTION_KEY=$(openssl rand -base64 24 | tr -d '\n')

  cat > "$ENV_FILE" << EOF
DATABASE_URL="file:./dev.db"
SESSION_SECRET="${SESSION_SECRET}"
ENCRYPTION_KEY="${ENCRYPTION_KEY}"
ADMIN_BOOTSTRAP_EMAIL="${ADMIN_EMAIL}"
ADMIN_BOOTSTRAP_PASSWORD="${ADMIN_PASSWORD}"
DOMAIN_EMAIL_API_BASE_URL="${EMAIL_API_URL}"
DOMAIN_EMAIL_ADMIN_EMAIL="${EMAIL_ADMIN}"
DOMAIN_EMAIL_ADMIN_PASSWORD="${EMAIL_PASSWORD}"
EMAIL_TOKEN_CACHE_TTL_SECONDS="600"
EMAIL_CODE_POLL_TIMEOUT_SECONDS="60"
EMAIL_CODE_POLL_INTERVAL_SECONDS="5"
EOF

  ok ".env 文件已生成。"
else
  ok ".env 文件已存在，跳过配置。"
fi

# ---------- 3. 安装依赖 ----------
echo ""
info "安装 npm 依赖（better-sqlite3 需要本地编译，请耐心等待）..."
npm install
ok "依赖安装完成。"

# ---------- 4. 数据库初始化 ----------
echo ""
info "初始化数据库..."

npx prisma generate

if [ -f "prisma/dev.db" ]; then
  info "检测到已有数据库，应用增量迁移..."
  npx prisma migrate deploy
else
  info "首次部署，创建数据库并应用迁移..."
  npx prisma migrate dev --name init
fi

ok "数据库迁移完成。"

# ---------- 5. 种子数据 ----------
echo ""
info "创建管理员账号..."
npm run prisma:seed
ok "管理员账号已就绪。"

# ---------- 6. 构建并启动 ----------
echo ""
echo -e "${BOLD}──────────────────────────────────${NC}"
echo -e "${BOLD}  部署模式选择${NC}"
echo -e "${BOLD}──────────────────────────────────${NC}"
echo "  1) 开发模式 (npm run dev，支持热重载)"
echo "  2) 生产模式 (npm run build && npm run start，性能更优)"
echo ""
read -rp "$(echo -e ${CYAN}请选择 [1/2，默认 1]: ${NC})" MODE
MODE=${MODE:-1}

# 停掉占用 3000 端口的进程
PORT_PID=$(lsof -ti:3000 2>/dev/null || true)
if [ -n "$PORT_PID" ]; then
  warn "端口 3000 被占用 (PID: $PORT_PID)，正在释放..."
  kill -9 $PORT_PID 2>/dev/null || true
  sleep 1
fi

cleanup() {
  echo ""
  info "正在停止服务..."
  if [ -n "${CHILD_PID:-}" ]; then
    kill "$CHILD_PID" 2>/dev/null || true
    wait "$CHILD_PID" 2>/dev/null || true
  fi
  ok "服务已停止。"
  exit 0
}
trap cleanup SIGINT SIGTERM

echo ""
if [ "$MODE" = "2" ]; then
  info "构建生产版本..."
  npm run build
  ok "构建完成。"
  echo ""
  info "启动生产服务器 (http://localhost:3000)..."
  echo -e "  按 ${BOLD}Ctrl+C${NC} 停止服务。"
  echo ""
  npx next start &
  CHILD_PID=$!
else
  info "启动开发服务器 (http://localhost:3000)..."
  echo -e "  按 ${BOLD}Ctrl+C${NC} 停止服务。"
  echo ""
  npm run dev &
  CHILD_PID=$!
fi

wait "$CHILD_PID"
