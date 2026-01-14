#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/usr/local/bin"

cd "$SCRIPT_DIR"
docker build -t claude-code:latest .

if [ -w "$INSTALL_DIR" ]; then
    cp "${SCRIPT_DIR}/claude-docker" "${INSTALL_DIR}/claude-docker"
    chmod +x "${INSTALL_DIR}/claude-docker"
else
    sudo cp "${SCRIPT_DIR}/claude-docker" "${INSTALL_DIR}/claude-docker"
    sudo chmod +x "${INSTALL_DIR}/claude-docker"
fi

echo "✓ Installed: claude-docker"
echo ""
echo "Usage:"
echo "  claude-docker              # bash in current dir"
echo "  claude-docker claude-code  # run Claude Code"
echo ""
echo "Set API key: export ANTHROPIC_API_KEY='your-key'"
echo "Alias: alias claude='claude-docker claude-code'"
