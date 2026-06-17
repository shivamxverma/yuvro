FROM python:3.10-slim

WORKDIR /init-service

COPY init-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY init-service/app ./app
COPY init-service/scripts ./scripts
COPY runner/templates ./runner/templates
COPY runner/template_manifests ./runner/template_manifests

EXPOSE 3001

ENV PORT=3001

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001"]
