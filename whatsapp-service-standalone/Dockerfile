FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3001

ENV NODE_ENV=production

CMD ["dumb-init", "node", "dist/index.js"]
