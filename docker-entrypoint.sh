#!/bin/bash

echo "Parsing: $PLUGIN_API_URL"

(cd python-scripts && python prepare_api_docs.py $PLUGIN_API_URL)

(cd mcp-server && node dist/index.js --multi-user)
