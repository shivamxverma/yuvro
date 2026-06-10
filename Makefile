.PHONY: init-service runner client dev build-runner-image

init-service:
	@echo "Starting init-service on port 3001..."
	cd init-service && ./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 3001 --reload

runner:
	@echo "Starting orchestrator on port 3002..."
	cd orchestrator && ./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 3002 --reload

client:
	@echo "Starting client on port 5173..."
	cd client && npm run dev

build-runner-image:
	@echo "Building runner Docker image..."
	docker build -t yuvro-runner:latest ./runner

dev:
	@echo "Starting all services concurrently..."
	make -j 3 init-service runner client
