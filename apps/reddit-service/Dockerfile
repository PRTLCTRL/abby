# Reddit Parenting Tips Service - Python FastAPI
FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install
COPY apps/reddit-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY apps/reddit-service/main.py /app/main.py

# Set environment
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8080/health').raise_for_status()"

# Start server
CMD ["python", "main.py"]
