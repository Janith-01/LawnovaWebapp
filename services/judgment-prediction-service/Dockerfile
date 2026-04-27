FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
# CPU-only torch - saves ~2GB vs CUDA build, fine for demo/inference
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# ML model files are NOT baked into this image.
# They are volume-mounted at runtime from the EC2 host.
# Inside the container the models will be at:
#   /app/models/MODEL_A
#   /app/models/MODEL_B_35K
# Update your Python loading code to use these paths.

EXPOSE 5006

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "5006"]
