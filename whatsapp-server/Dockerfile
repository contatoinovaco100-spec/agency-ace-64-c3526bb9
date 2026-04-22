FROM node:20-slim

WORKDIR /app

# Dependências do sistema necessárias para o Baileys
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Porta que o Fly.io vai expor
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
