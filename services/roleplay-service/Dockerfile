FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY . .

# Exclude python_backend from this image — it has its own container
EXPOSE 10005

CMD ["node", "src/server.js"]
