# Claude Code Task List - RxJS Devtools

## How to Use This
Run Claude Code with each task file sequentially. Each task is self-contained but builds on previous tasks.

## Task Order
1. `task-01-stack-parser.md` - Stack trace parsing utility
2. `task-02-observable-wrapper.md` - Wrapped Observable class
3. `task-03-pipe-patch.md` - Pipe method patching
4. `task-04-subscribe-patch.md` - Subscribe method patching  
5. `task-05-debugger-api.md` - Query/introspection API
6. `task-06-special-operators.md` - Share/retry/repeat handling

## Running Tasks
```bash
# In your Docker/sandbox environment
claude-code task-01-stack-parser.md

# Review output, test, then move to next
claude-code task-02-observable-wrapper.md

# ... etc
```

## Integration Testing
After all tasks, create `test/integration.spec.ts` that exercises:
- Basic pipe chains
- Multiple subscriptions
- Nested subscriptions (switchMap)
- Shared observables
- Retry behavior

## Success Criteria Per Task
Each task should:
- Include TypeScript types
- Have error handling
- Include inline comments explaining tricky parts
- Reference the main spec document
- Work independently (can be tested in isolation)
