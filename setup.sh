#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

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

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "未检测到 $1，请先安装后再运行。"
    exit 1
  fi
}

free_port_3001() {
  if command -v lsof >/dev/null 2>&1; then
    local port_pid
    port_pid=$(lsof -ti:3001 2>/dev/null || true)
    if [ -n "$port_pid" ]; then
      warn "端口 3001 被占用 (PID: $port_pid)，正在释放..."
      kill -9 $port_pid 2>/dev/null || true
      sleep 1
    fi
  else
    warn "未检测到 lsof，跳过端口 3001 占用检查。"
  fi
}

create_env_if_missing() {
  if [ -f ".env" ]; then
    ok ".env 文件已存在，跳过配置。"
    return
  fi

  echo ""
  info "未检测到 .env 文件，开始配置环境变量。"

  read -rp "$(echo -e ${CYAN}系统管理员邮箱 [qlc@qlcc.online]: ${NC})" ADMIN_EMAIL
  ADMIN_EMAIL=${ADMIN_EMAIL:-qlc@qlcc.online}

  read -rp "$(echo -e ${CYAN}系统管理员密码 [至少 6 位]: ${NC})" ADMIN_PASSWORD
  while [ ${#ADMIN_PASSWORD} -lt 6 ]; do
    warn "密码长度至少 6 位，请重新输入。"
    read -rp "$(echo -e ${CYAN}系统管理员密码: ${NC})" ADMIN_PASSWORD
  done

  read -rp "$(echo -e ${CYAN}域名邮箱 API 地址 [https://qlcc.online]: ${NC})" EMAIL_API_URL
  EMAIL_API_URL=${EMAIL_API_URL:-https://qlcc.online}

  read -rp "$(echo -e ${CYAN}域名邮箱管理员邮箱 [qlc@qlcc.online]: ${NC})" EMAIL_ADMIN
  EMAIL_ADMIN=${EMAIL_ADMIN:-qlc@qlcc.online}

  read -rp "$(echo -e ${CYAN}域名邮箱管理员密码: ${NC})" EMAIL_PASSWORD
  while [ -z "$EMAIL_PASSWORD" ]; do
    warn "不能为空。"
    read -rp "$(echo -e ${CYAN}域名邮箱管理员密码: ${NC})" EMAIL_PASSWORD
  done

  SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
  ENCRYPTION_KEY=$(openssl rand -base64 24 | tr -d '\n')

  cat > ".env" << EOF
DATABASE_URL="file:./prisma/dev.db"
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
}

install_dependencies_if_needed() {
  echo ""
  if [ -d "node_modules" ] && [ -x "node_modules/.bin/next" ] && [ -d "node_modules/@libsql/client" ]; then
    ok "npm 依赖已完整，跳过 npm install。"
  else
    info "npm 依赖缺失或不完整，正在安装..."
    npm install
    ok "依赖安装完成。"
  fi
}

init_database_if_needed() {
  echo ""
  if [ -f "prisma/dev.db" ]; then
    ok "数据库已存在，跳过初始化。"
    return
  fi

  info "未检测到数据库，正在初始化..."
  npm run db:init
  npm run db:seed
  ok "数据库初始化完成。"
}

start_server() {
  echo ""
  echo -e "${BOLD}──────────────────────────────────${NC}"
  echo -e "${BOLD}  启动模式选择${NC}"
  echo -e "${BOLD}──────────────────────────────────${NC}"
  echo "  1) 开发模式：npm run dev"
  echo "  2) 生产模式：npm run build && npm run start"
  echo ""
  read -rp "$(echo -e ${CYAN}请选择 [1/2，默认 1]: ${NC})" MODE
  MODE=${MODE:-1}

  free_port_3001

  if [ "$MODE" = "2" ]; then
    info "构建生产版本..."
    npm run build
    ok "构建完成。"
    info "启动生产服务器：http://localhost:3001"
    npm run start
  else
    info "启动开发服务器：http://localhost:3001"
    npm run dev
  fi
}

info "开始 GPT Mail 启动部署..."
info "项目目录：$(pwd)"

require_command node
require_command npm
require_command openssl

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node.js 版本过低，当前 $(node -v)，需要 >= 18。"
  exit 1
fi
ok "Node.js $(node -v)"
ok "npm $(npm -v)"

create_env_if_missing
install_dependencies_if_needed
init_database_if_needed
start_server
