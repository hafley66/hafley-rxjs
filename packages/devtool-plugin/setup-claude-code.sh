#!/bin/bash

# Setup script for running Claude Code in Docker for RxJS Devtools project
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}RxJS Devtools - Claude Code Setup${NC}"
echo -e "${BLUE}================================${NC}\n"

# Step 1: Check if we're in Docker or need to setup Docker
if [ -f /.dockerenv ]; then
    echo -e "${GREEN}✓ Running inside Docker${NC}"
    IN_DOCKER=true
else
    echo -e "${YELLOW}! Not in Docker, will set up Docker environment${NC}"
    IN_DOCKER=false
fi

# Step 2: Project directory setup
PROJECT_NAME="rxjs-devtools"
PROJECT_ROOT="${PWD}/${PROJECT_NAME}"

if [ "$IN_DOCKER" = true ]; then
    PROJECT_ROOT="/workspace/${PROJECT_NAME}"
fi

echo -e "\n${BLUE}Project directory:${NC} ${PROJECT_ROOT}"

# Create project structure
mkdir -p "${PROJECT_ROOT}"/{src/tracking/__tests__,tasks,docs}

echo -e "${GREEN}✓ Created project structure${NC}"

# Step 3: Claude Code authentication
echo -e "\n${BLUE}Step 1: Claude Code Authentication${NC}"
echo -e "${YELLOW}You need an Anthropic API key to use Claude Code${NC}"
echo -e "Get one from: ${BLUE}https://console.anthropic.com/settings/keys${NC}\n"

# Check if API key is already set
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${YELLOW}ANTHROPIC_API_KEY not found in environment${NC}"
    echo -e "Please enter your Anthropic API key:"
    read -s API_KEY
    export ANTHROPIC_API_KEY="$API_KEY"
    
    # Save to .env file for persistence
    echo "ANTHROPIC_API_KEY=${API_KEY}" > "${PROJECT_ROOT}/.env"
    echo -e "${GREEN}✓ API key saved to .env${NC}"
else
    echo -e "${GREEN}✓ API key found in environment${NC}"
fi

# Step 4: Install Claude Code
echo -e "\n${BLUE}Step 2: Installing Claude Code${NC}"

if command -v claude-code &> /dev/null; then
    echo -e "${GREEN}✓ Claude Code already installed${NC}"
else
    echo -e "${YELLOW}Installing Claude Code...${NC}"
    npm install -g @anthropic-ai/claude-code
    echo -e "${GREEN}✓ Claude Code installed${NC}"
fi

# Step 5: Copy task specs
echo -e "\n${BLUE}Step 3: Setting up task specifications${NC}"

# Check if task files are in outputs directory
TASK_SOURCE="${PWD}"
if [ -d "/mnt/user-data/outputs" ]; then
    TASK_SOURCE="/mnt/user-data/outputs"
fi

# Copy task files
for task_file in "${TASK_SOURCE}"/task-*.md; do
    if [ -f "$task_file" ]; then
        cp "$task_file" "${PROJECT_ROOT}/tasks/"
        echo -e "${GREEN}✓ Copied $(basename $task_file)${NC}"
    fi
done

# Copy main spec
if [ -f "${TASK_SOURCE}/rxjs-devtools-spec.md" ]; then
    cp "${TASK_SOURCE}/rxjs-devtools-spec.md" "${PROJECT_ROOT}/docs/"
    echo -e "${GREEN}✓ Copied main specification${NC}"
fi

# Step 6: Initialize package.json
echo -e "\n${BLUE}Step 4: Initializing Node.js project${NC}"

cat > "${PROJECT_ROOT}/package.json" << 'EOF'
{
  "name": "rxjs-devtools",
  "version": "0.1.0",
  "description": "Runtime devtools for RxJS observables",
  "type": "module",
  "scripts": {
    "test": "vitest",
    "build": "tsc",
    "dev": "vite"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  },
  "peerDependencies": {
    "rxjs": "^7.0.0"
  }
}
EOF

echo -e "${GREEN}✓ Created package.json${NC}"

# Step 7: Create TypeScript config
cat > "${PROJECT_ROOT}/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
EOF

echo -e "${GREEN}✓ Created tsconfig.json${NC}"

# Step 8: Create a run script for Claude Code
cat > "${PROJECT_ROOT}/run-task.sh" << 'EOF'
#!/bin/bash
# Helper script to run Claude Code tasks

set -e

# Load API key from .env if it exists
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

TASK_NUM=$1

if [ -z "$TASK_NUM" ]; then
    echo "Usage: ./run-task.sh <task-number>"
    echo "Example: ./run-task.sh 01"
    echo ""
    echo "Available tasks:"
    ls -1 tasks/task-*.md | sed 's/tasks\/task-/  /' | sed 's/.md//'
    exit 1
fi

TASK_FILE="tasks/task-${TASK_NUM}-*.md"

# Find the task file
TASK_PATH=$(ls $TASK_FILE 2>/dev/null | head -n1)

if [ -z "$TASK_PATH" ]; then
    echo "Error: Task $TASK_NUM not found"
    echo "Available tasks:"
    ls -1 tasks/task-*.md | sed 's/tasks\/task-/  /' | sed 's/.md//'
    exit 1
fi

echo "Running Claude Code on: $(basename $TASK_PATH)"
echo "================================"
echo ""

# Run Claude Code with the task file
# --network flag for manual approval mode if you want it
claude-code "$TASK_PATH"

echo ""
echo "================================"
echo "Task completed. Review the generated code and run tests."
EOF

chmod +x "${PROJECT_ROOT}/run-task.sh"
echo -e "${GREEN}✓ Created run-task.sh helper script${NC}"

# Step 9: Create README
cat > "${PROJECT_ROOT}/README.md" << 'EOF'
# RxJS Runtime Devtools

Runtime debugging and introspection tools for RxJS observables.

## Setup Complete! 🎉

### Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run tasks with Claude Code:
   ```bash
   ./run-task.sh 01  # Stack parser
   ./run-task.sh 02  # Observable wrapper
   # ... continue through task 06
   ```

3. Run tests after each task:
   ```bash
   npm test
   ```

### Task Order

1. `task-01` - Stack trace parser
2. `task-02` - Observable wrapper & registry
3. `task-03` - Pipe method patching
4. `task-04` - Subscribe method patching
5. `task-05` - Debugger query API
6. `task-06` - Special operator handling

### Manual Claude Code Usage

If you prefer to run Claude Code directly:

```bash
# Make sure API key is set
export ANTHROPIC_API_KEY="your-key-here"

# Run on a specific task
claude-code tasks/task-01-stack-parser.md

# With network approval (recommended for sandbox)
claude-code --network-mode manual tasks/task-01-stack-parser.md
```

### Project Structure

```
rxjs-devtools/
├── src/
│   └── tracking/
│       ├── stack-parser.ts
│       ├── observable-wrapper.ts
│       ├── registry.ts
│       ├── types.ts
│       ├── pipe-patch.ts
│       ├── subscribe-patch.ts
│       ├── debugger-api.ts
│       ├── special-operators.ts
│       └── __tests__/
├── tasks/           # Claude Code task specifications
├── docs/            # Main specification document
└── package.json
```

### Vite Configuration

After implementation, add this to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'rxjs': path.resolve(__dirname, 'src/tracking/observable-wrapper.ts')
    }
  }
});
```

### Testing Strategy

Each task includes test specifications. Run tests with:

```bash
npm test                    # Run all tests
npm test stack-parser       # Run specific test file
npm test -- --watch         # Watch mode
```

### Debugging

Expose the debugger API globally for console access:

```typescript
// In your app initialization
import { debugger } from './tracking/debugger-api';

if (import.meta.env.DEV) {
  window.__rxjsDebugger = debugger;
}
```

Then in browser console:
```javascript
__rxjsDebugger.getActiveSubscriptions()
__rxjsDebugger.printSubscriptionTree('sub#0')
```

### Network Mode for Docker

If running in Docker with manual network approval:

```bash
# Claude Code with restricted network
claude-code --network-mode manual tasks/task-01-stack-parser.md

# Or disable network entirely
claude-code --no-network tasks/task-01-stack-parser.md
```

### Next Steps

1. Review the main spec: `docs/rxjs-devtools-spec.md`
2. Start with task 01: `./run-task.sh 01`
3. Test each implementation before moving to next task
4. Build incrementally - each task is independent but builds on previous
EOF

echo -e "${GREEN}✓ Created README.md${NC}"

# Step 10: Summary
echo -e "\n${BLUE}================================${NC}"
echo -e "${GREEN}Setup Complete! 🚀${NC}"
echo -e "${BLUE}================================${NC}\n"

echo -e "${YELLOW}Project location:${NC} ${PROJECT_ROOT}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "  1. ${BLUE}cd ${PROJECT_ROOT}${NC}"
echo -e "  2. ${BLUE}npm install${NC}"
echo -e "  3. ${BLUE}./run-task.sh 01${NC}  # Start with first task"
echo -e "\n${YELLOW}To run Claude Code manually:${NC}"
echo -e "  ${BLUE}claude-code tasks/task-01-stack-parser.md${NC}"
echo -e "\n${YELLOW}API Key saved in:${NC} ${PROJECT_ROOT}/.env"
echo -e "\n${GREEN}Happy coding! 🎉${NC}\n"
