FROM node:24-bookworm

ENV HOME=/tmp/pi-home
ENV PI_CODING_AGENT_DIR=/tmp/pi-home/.pi/agent
ENV PI_OFFLINE=0

WORKDIR /workspace/pi-superpowers
COPY . /workspace/pi-superpowers

RUN npm install -g @mariozechner/pi-coding-agent

CMD ["node", "--experimental-strip-types", "tests/integration/docker/run-e2e.ts"]
