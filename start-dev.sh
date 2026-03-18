#!/bin/bash
export PATH="/Users/administrator/local/node/bin:$PATH"
cd "/Users/administrator/claude/claude code/gh-suitocho"
exec node ./node_modules/.bin/vite --port 5173 --host
