#!/bin/bash
set -e

# 0. Load settings from properties file if it exists
if [ -f "/app/opencode-server.properties" ]; then
    # 공백 양쪽을 트림하여 변수로 안전하게 적용
    export $(grep -v '^#' /app/opencode-server.properties | grep '=' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*=[[:space:]]*/=/' | xargs | tr -d '\r')
fi

# 대상 작업 공간. 모든 개별 레포지토리들이 위치할 부모 폴더입니다.
WORKSPACE_DIR="/repository"

echo "========================================="
echo "Initializing OpenCode Workspace Environment"
echo "Workspace Directory: $WORKSPACE_DIR"
echo "========================================="

mkdir -p "$WORKSPACE_DIR"
cd "$WORKSPACE_DIR"

# REPOSITORIES 설정 파싱 및 자동 클론 (GitLab 연동)
if [ "$GITLAB_AUTO_CLONE" = "true" ] && [ -n "$REPOSITORIES" ]; then
  echo "🔍 Processing multi-repositories under $WORKSPACE_DIR ..."
  
  # 계정 정보가 둘 다 있을 때만 자격증명 포맷 생성
  if [ -n "$GITLAB_HOST" ] && [ -n "$GITLAB_USERNAME" ] && [ -n "$GITLAB_TOKEN" ]; then
    GITLAB_HOST=${GITLAB_HOST%/}
    PROTOCOL=$(echo "$GITLAB_HOST" | awk -F:// '{print $1}')
    DOMAIN=$(echo "$GITLAB_HOST" | awk -F:// '{print $2}')
    AUTH_BASE="${PROTOCOL}://${GITLAB_USERNAME}:${GITLAB_TOKEN}@${DOMAIN}"
  fi

  IFS='|' read -ra REPOS <<< "$REPOSITORIES"
  for repo_entry in "${REPOS[@]}"; do
    if [ -z "$repo_entry" ]; then continue; fi
    
    # 구분자를 세미콜론(;) 기준으로 경로와 폴더명 파싱
    IFS=';' read -ra INFO <<< "$repo_entry"
    REPO_PATH="${INFO[0]}"
    REPO_DIR="${INFO[1]}"

    if [ -n "$REPO_PATH" ] && [ -n "$REPO_DIR" ]; then
      TARGET_DIR="$WORKSPACE_DIR/$REPO_DIR"
      
      # 풀 URL인지, Path만 입력된 건지에 따라 URL 조립
      if [[ "$REPO_PATH" == http* ]]; then
          REPO_URL="$REPO_PATH"
      else
          if [[ "$REPO_PATH" != /* ]]; then REPO_PATH="/$REPO_PATH"; fi
          if [ -n "$AUTH_BASE" ]; then
              REPO_URL="${AUTH_BASE}${REPO_PATH}"
          else
              REPO_URL="${GITLAB_HOST}${REPO_PATH}"
          fi
      fi

      if [ -d "$TARGET_DIR/.git" ]; then
        echo "🔄 Repository '$REPO_DIR' exists. Pulling latest changes..."
        (cd "$TARGET_DIR" && git pull origin) || echo "❌ Failed to pull $REPO_DIR"
      else
        echo "⬇️  Cloning into '$TARGET_DIR'..."
        git clone "$REPO_URL" "$TARGET_DIR" || echo "❌ Failed to clone $REPO_DIR"
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

# Export the workspace explicitly so our single-tenant Docker wrapper can hijack the Node processcwd logic safely 
export OPENCODE_WORKSPACE="$WORKSPACE_DIR"

# The bun application server must run from its package root so it properly discovers its own tsconfig.json for JSX compilations.
# Our proxy logic in docker-bootstrap.ts will transparently set the operational directory back securely AFTER boot.
cd /app/packages/opencode

# Execute via our new wrapper
exec bun run --conditions=browser docker-bootstrap.ts "$COMMAND" --port "$PORT" --hostname "$HOSTNAME" "${ARGS[@]}"
