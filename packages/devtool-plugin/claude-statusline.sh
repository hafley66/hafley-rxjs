#!/bin/bash

# Claude Code Status Line Script
# Shows: Token count/breakdown and current cost breakdown

input=$(cat)

# Extract model info
MODEL=$(echo "$input" | jq -r '.model.display_name')

# Extract token counts
TOTAL_INPUT=$(echo "$input" | jq -r '.context_window.total_input_tokens')
TOTAL_OUTPUT=$(echo "$input" | jq -r '.context_window.total_output_tokens')

# Extract current context window usage
CONTEXT_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size')
CURRENT_USAGE=$(echo "$input" | jq -r '.context_window.current_usage')

# Calculate current context tokens (handle null case)
if [ "$CURRENT_USAGE" != "null" ]; then
    CURRENT_INPUT=$(echo "$input" | jq -r '.context_window.current_usage.input_tokens // 0')
    CACHE_CREATE=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0')
    CACHE_READ=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // 0')
    CURRENT_TOTAL=$((CURRENT_INPUT + CACHE_CREATE + CACHE_READ))
    PERCENT_USED=$((CURRENT_TOTAL * 100 / CONTEXT_SIZE))
else
    PERCENT_USED=0
fi

# Extract cost info
TOTAL_COST=$(echo "$input" | jq -r '.cost.total_cost_usd')

# Format cost to 4 decimal places
COST_FORMATTED=$(printf "%.4f" "$TOTAL_COST")

# Build status line
echo "[$MODEL] Tokens: ${TOTAL_INPUT}in/${TOTAL_OUTPUT}out | Context: ${PERCENT_USED}% | Cost: \$${COST_FORMATTED}"
