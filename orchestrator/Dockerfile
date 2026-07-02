FROM node:22-slim

WORKDIR /app/orchestrator

COPY orchestrator/package.json ./
RUN npm install

COPY orchestrator/tsconfig.json ./
COPY orchestrator/src ./src

RUN npm run build

EXPOSE 3002
ENV PORT=3002

CMD ["node", "dist/index.js"]
