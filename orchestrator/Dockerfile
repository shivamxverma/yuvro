FROM python:3.10-slim

WORKDIR /orchestrator

COPY orchestrator/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY orchestrator/app ./app

EXPOSE 3002

ENV PORT=3002

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3002"]
