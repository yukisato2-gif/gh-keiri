#!/bin/bash
export PATH="$HOME/local/node/bin:$PATH"
cd "$(dirname "$0")"
exec npx vite --host --port 5174
