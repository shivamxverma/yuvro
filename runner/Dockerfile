FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    git \
    g++ \
    procps \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory inside the container for the runner
WORKDIR /runner-app

# Copy requirements and install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy runner app code and scripts
COPY app ./app
COPY scripts ./scripts

# Append custom cd wrapper to /etc/bash.bashrc and /root/.bashrc to prevent directory escaping and set prompt
RUN cat /runner-app/scripts/cd_wrapper.sh >> /etc/bash.bashrc && cat /runner-app/scripts/cd_wrapper.sh >> /root/.bashrc

# Expose the internal port for the runner API
EXPOSE 3002

# Set runtime environment variables
ENV BASE_DIR=/workspace
ENV IS_CONTAINER=true
ENV PORT=3002

# Start the runner service
CMD ["python", "-m", "app.main"]
