FROM node:20-slim

# Install essential tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    vim \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Create workspace
WORKDIR /workspace

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code

# Set up Claude Code status line
RUN mkdir -p /root/.claude
COPY claude-statusline.sh /root/.claude/statusline.sh
COPY claude-settings.json /root/.claude/settings.json
RUN chmod +x /root/.claude/statusline.sh

# Copy setup script
COPY setup-claude-code.sh /workspace/setup.sh
RUN chmod +x /workspace/setup.sh

# Set up environment
ENV NODE_ENV=development

# Default command drops you into bash
CMD ["/bin/bash"]
