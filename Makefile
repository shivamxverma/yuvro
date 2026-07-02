.PHONY: init-service runner client dev build-runner-image setup

setup:
	@echo "Installing dependencies and building local workspace packages..."
	cd db-schema && npm install && npm run build
	cd init-service && npm install
	cd orchestrator && npm install
	cd runner && npm install

init-service:
	@echo "Starting init-service on port 3001..."
	cd init-service && bun run dev

runner:
	@echo "Starting orchestrator on port 3002..."
	cd orchestrator && bun run dev

client:
	@echo "Starting client on port 5173..."
	cd client && npm run dev

build-runner-image:
	@echo "Building runner Docker image..."
	docker build -t yuvro-runner:latest ./runner

dev:
	@echo "Starting all services concurrently..."
	make -j 3 init-service runner client
