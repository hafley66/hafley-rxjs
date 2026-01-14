#!/bin/bash
# Usage: ./scripts/new-chat-log.sh <topic-in-kebab-case>
# Creates: chat_log/YYYY-MM-DD.$next_index.<topic>.md

set -e

TOPIC="${1:?Usage: $0 <topic-in-kebab-case>}"
DATE=$(date +%Y-%m-%d)
CHAT_LOG_DIR="$(dirname "$0")/../chat_log"

# Ensure directory exists
mkdir -p "$CHAT_LOG_DIR"

# Count existing files for today to get next index
EXISTING=$(ls "$CHAT_LOG_DIR" 2>/dev/null | grep "^${DATE}\." | wc -l | tr -d ' ')
NEXT_INDEX=$EXISTING

FILENAME="${DATE}.${NEXT_INDEX}.${TOPIC}.md"
FILEPATH="${CHAT_LOG_DIR}/${FILENAME}"

# Create empty file with header
cat > "$FILEPATH" << EOF
# ${DATE} - ${TOPIC}

## Goal


## Current State


## Problem/Context


## Solution/Approach


## Tasks
- [ ]

## Files to Modify


## Key Insights


## Open Questions

EOF

# Update LATEST.md to point to this file
echo "$FILENAME" > "${CHAT_LOG_DIR}/LATEST.md"

echo "$FILEPATH"
echo ""
echo "--- COPY AFTER COMPACT ---"
echo "/compact please read chat_log/$FILENAME to resume context and continue"
echo "--------------------------"
