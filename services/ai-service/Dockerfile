FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY . .

EXPOSE 5008

CMD ["node", "src/server.js"]
