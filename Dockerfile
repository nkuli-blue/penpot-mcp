## ------ Build
FROM node:22.21.1 AS build

RUN set -ex; \
    apt update ; \
    apt -y install python3 python3-venv pip

RUN python3 -m venv /opt/venv

WORKDIR /app

ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .

RUN pip install -Ur requirements.txt

COPY . .

RUN set -ex; \
    cd mcp-server; \
    npm install --frozen-lockfile; \
    npm run build;

# MCP API Server
EXPOSE 4401

# WebSocket server
EXPOSE 4402

# Repl server
EXPOSE 4403

ENV PLUGIN_API_URL="https://penpot-plugins-api-doc.pages.dev/"

#ENTRYPOINT node ./dist/index.js
CMD [ "./docker-entrypoint.sh" ]
