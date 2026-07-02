FROM node:22-slim

WORKDIR /app

# Copy db-schema
COPY db-schema ./db-schema
RUN cd db-schema && npm install && npm run build

# Copy init-service
COPY init-service/package.json ./init-service/
RUN cd init-service && npm install

COPY init-service/tsconfig.json init-service/drizzle.config.ts ./init-service/
COPY init-service/src ./init-service/src

# Templates and manifests copied from runner
COPY runner/templates ./runner/templates
COPY runner/template_manifests ./runner/template_manifests

RUN cd init-service && npm run build

EXPOSE 3001
ENV PORT=3001

CMD ["node", "init-service/dist/index.js"]
