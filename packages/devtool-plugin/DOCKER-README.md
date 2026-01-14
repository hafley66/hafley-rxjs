# Claude Code Docker Setup

## Quick Start

```bash
# Build the image
docker-compose build

# Start the container
docker-compose up -d

# Attach to the container
docker-compose exec claude-code-dev bash
```

## Status Line Configuration

The Docker container is pre-configured with a status line that shows:

- **Model name** - Currently active Claude model
- **Token counts** - Input/output tokens (cumulative)
- **Context usage** - Percentage of context window used
- **Cost** - Total session cost in USD

Example: `[Sonnet 4.5] Tokens: 12345in/6789out | Context: 15% | Cost: $0.0234`

## Persistence Strategy

Your Docker setup uses **Docker volumes** to persist data across container restarts:

### What's Persisted

1. **Claude Code data** (`claude-data` volume)
   - Conversation history
   - Statistics and cost tracking
   - Settings and configuration
   - Session state

2. **Your workspace** (bind mount: `./:/workspace`)
   - All your project files
   - Any changes you make

### What's NOT Persisted (by default)

- API credentials (you'll need to authenticate each time)

### Option 1: Authenticate Each Time (Default)

```bash
# Inside container
docker-compose exec claude-code-dev bash

# Set your API key
export ANTHROPIC_API_KEY="your-key-here"

# Or use the .env file
echo "ANTHROPIC_API_KEY=your-key-here" > .env
```

### Option 2: Share Host Credentials (Recommended)

Uncomment this line in [docker-compose.yml](docker-compose.yml:14):

```yaml
volumes:
  - ~/.claude/.credentials.json:/root/.claude/.credentials.json:ro
```

This mounts your host machine's Claude credentials into the container (read-only).

## Usage

### Start Working

```bash
# Start container
docker-compose up -d

# Attach to shell
docker-compose exec claude-code-dev bash

# Inside container - run Claude Code
claude-code
```

### Stop Container (Data Persists)

```bash
# Stop but keep volumes
docker-compose down

# Start again later - your history is preserved
docker-compose up -d
```

### Complete Reset

```bash
# Remove container AND volumes (loses all data)
docker-compose down -v

# Fresh start
docker-compose build
docker-compose up -d
```

## Volume Management

### View Volumes

```bash
# List volumes
docker volume ls | grep claude-data

# Inspect the volume
docker volume inspect hafley-rxjs-debugger_claude-data
```

### Backup Your Data

```bash
# Create backup of Claude data
docker run --rm \
  -v hafley-rxjs-debugger_claude-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/claude-backup.tar.gz -C /data .

# Restore from backup
docker run --rm \
  -v hafley-rxjs-debugger_claude-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/claude-backup.tar.gz -C /data
```

### Manual Volume Copy

```bash
# Copy specific files from volume
docker run --rm \
  -v hafley-rxjs-debugger_claude-data:/data \
  alpine cat /data/history.jsonl > my-history.jsonl
```

## Files

- [Dockerfile](Dockerfile) - Container image definition
- [docker-compose.yml](docker-compose.yml) - Service configuration with volumes
- [claude-statusline.sh](claude-statusline.sh) - Status line script (copied to container)
- [claude-settings.json](claude-settings.json) - Claude settings (copied to container)
- [setup-claude-code.sh](setup-claude-code.sh) - Project setup script

## Customizing the Status Line

The status line script is copied during build. To modify it:

1. Edit [claude-statusline.sh](claude-statusline.sh)
2. Rebuild the image: `docker-compose build`
3. Restart the container: `docker-compose up -d`

Alternatively, you can edit it directly in the running container:

```bash
docker-compose exec claude-code-dev vi /root/.claude/statusline.sh
```

Note: Changes in the running container won't survive a rebuild unless you update the source file.

## Troubleshooting

### Status Line Not Showing

```bash
# Check if jq is installed
docker-compose exec claude-code-dev which jq

# Check if script is executable
docker-compose exec claude-code-dev ls -la /root/.claude/statusline.sh

# Test the script manually
docker-compose exec claude-code-dev /root/.claude/statusline.sh
```

### Lost Data After Rebuild

If you ran `docker-compose down -v`, you deleted the volumes. Use `docker-compose down` (without `-v`) to preserve data.

### Permission Issues

```bash
# Fix permissions in volume
docker-compose exec claude-code-dev chown -R root:root /root/.claude
```

## Advanced: Multiple Projects

You can run multiple Claude Code containers for different projects:

```bash
# Clone this setup to a new directory
cp -r hafley-rxjs-debugger my-new-project
cd my-new-project

# Update container name in docker-compose.yml
# Then start normally
docker-compose up -d
```

Each project gets its own isolated `claude-data` volume.
