FROM oven/bun:1-alpine

WORKDIR /app

COPY package*.json ./

RUN bun install

COPY . .

RUN bunx prisma generate

EXPOSE 3002

CMD ["bun", "run", "src/server.ts"]