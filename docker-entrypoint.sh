#!/bin/bash
set -e

# 대상 작업 공간. 쿠버네티스/Docker 의 Persistent Volume (PV) 마운트 대상 폴더입니다.
WORKSPACE_DIR="/workspace"

echo "========================================="
echo "Initializing OpenCode Workspace Environment"
echo "Workspace Directory: $WORKSPACE_DIR"
echo "========================================="

mkdir -p "$WORKSPACE_DIR"
cd "$WORKSPACE_DIR"

# REPOSITORIES 환경변수 파싱 및 클론/업데이트 처리
# 포맷: "URL1;폴더명1|URL2;폴더명2"
if [ -z "$REPOSITORIES" ]; then
  echo "ℹ️  REPOSITORIES is empty. Skipping git operations."
else
  echo "🔍 Processing repositories..."
  IFS='|' read -ra REPOS <<< "$REPOSITORIES"
  for repo_entry in "${REPOS[@]}"; do
    if [ -z "$repo_entry" ]; then continue; fi
    
    IFS=';' read -ra INFO <<< "$repo_entry"
    REPO_URL="${INFO[0]}"
    REPO_DIR="${INFO[1]}"

    if [ -n "$REPO_URL" ] && [ -n "$REPO_DIR" ]; then
      if [ -d "$REPO_DIR/.git" ]; then
        echo "🔄 Repository '$REPO_DIR' exists. Pulling latest changes..."
        (cd "$REPO_DIR" && git pull origin) || echo "❌ Failed to pull $REPO_DIR"
      else
        echo "⬇️  Cloning into '$REPO_DIR'..."
        git clone "$REPO_URL" "$REPO_DIR" || echo "❌ Failed to clone $REPO_URL"
      fi
    else
      echo "⚠️  Invalid repository format: $repo_entry"
    fi
  done
fi

# 첫 번째 인자가 있으면 명령어 모드로 사용, 없으면 'serve'
COMMAND="${1:-serve}"
if [ $# -gt 0 ]; then shift; fi

ARGS=("$@")
if [ -n "$OPENCODE_ARGS" ]; then
  read -r -a EXTRA_ARGS <<< "$OPENCODE_ARGS"
  ARGS+=("${EXTRA_ARGS[@]}")
fi

PORT="${OPENCODE_PORT:-10043}"
HOSTNAME="${OPENCODE_HOSTNAME:-0.0.0.0}"

echo "========================================="
echo "🚀 Starting OpenCode Server via '$COMMAND' mode"
echo "========================================="

# workspace 환경에서 실행해야 OpenCode가 해당 프로젝트(클론된 코드 등)를 인식합니다.
cd "$WORKSPACE_DIR"

# 컨테이너 외부 프로세스(1번 PID)로 엮어 graceful shutdown 이 가능하게 exec 로 실행
exec bun run --conditions=browser /app/packages/opencode/src/index.ts "$COMMAND" --port "$PORT" --hostname "$HOSTNAME" "${ARGS[@]}"
