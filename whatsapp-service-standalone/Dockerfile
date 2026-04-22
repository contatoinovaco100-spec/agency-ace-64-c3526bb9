FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init git

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

EXPOSE 3001

ENV NODE_ENV=production

CMD ["dumb-init", "node", "dist/index.js"]
