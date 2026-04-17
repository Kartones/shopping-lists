#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d%H%M%S")
CONFIG="config.py"

if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/^CACHE_BUSTER = \".*\"/CACHE_BUSTER = \"${TIMESTAMP}\"/" "${CONFIG}"
else
    sed -i "s/^CACHE_BUSTER = \".*\"/CACHE_BUSTER = \"${TIMESTAMP}\"/" "${CONFIG}"
fi

echo "CACHE_BUSTER set to ${TIMESTAMP}"
