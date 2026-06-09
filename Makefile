.PHONY: init-service runner client dev

init-service:
	@echo "Starting init-service on port 3001..."
	cd init-service && ./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 3001 --reload

runner:
	@echo "Starting runner on port 3002..."
	cd runner && ./.venv/bin/python -m app.main

client:
	@echo "Starting client on port 5173..."
	cd client && npm run dev

dev:
	@echo "Starting all services concurrently..."
	make -j 3 init-service runner client
