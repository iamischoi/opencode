#!/bin/bash
# ===============================================================================
# OpenCode Server 기동 스크립트 (Podman Compose)
# ===============================================================================
#
# 사전 준비사항:
# 1. opencode-server.properties 파일에 환경 설정값들을 입력해주세요.
# 2. podman-compose.yml 내의 이미지 이름(image)과 호스트 볼륨 경로를 실제 사용 환경에 맞게 수정해주세요.
#
# [Podman Compose 옵션 설명]
# podman-compose up: 컨테이너를 생성하고 실행하는 명령어입니다.
# 
# --env-file ./opencode-server.properties
#   : 지정한 파일을 읽어와 컨테이너 내부의 환경 변수로 설정합니다.
#     이 옵션을 통해 GitLab 토큰, Clone 자동화 여부 등을 동적으로 주입합니다.
#
# -d (detached mode)
#   : 컨테이너를 백그라운드(데몬 모드)로 실행합니다. 터미널을 종료해도 컨테이너는 계속 구동됩니다.
#
# --force-recreate
#   : 속성 파일(opencode-server.properties)이나 compose 파일 내용이 변경되었을 때,
#     기존 컨테이너를 삭제하고 변경된 설정으로 새로운 컨테이너를 강제로 생성합니다.
#     이를 통해 설정 변경사항이 즉각적으로 반영됩니다.
# ===============================================================================

echo "🚀 Starting OpenCode Server with Podman Compose..."

# .properties 파일이 같은 디렉토리에 존재하는지 확인
if [ ! -f "./opencode-server.properties" ]; then
    echo "❌ Error: opencode-server.properties 파일을 찾을 수 없습니다."
    echo "   동봉된 설정 템플릿 파일을 확인해주세요."
    exit 1
fi

# Podman Compose 실행
echo "🔄 옵션을 적용하여 컨테이너를 백그라운드에서 다시 생성 및 실행합니다..."
podman-compose --env-file ./opencode-server.properties -f podman-compose.yml up -d --force-recreate

echo "==========================================================="
echo "✅ OpenCode Server is running in the background."
echo "📜 실시간 로그를 확인하려면 다음 명령어를 사용하세요:"
echo "   podman logs -f opencode-server"
echo "==========================================================="
