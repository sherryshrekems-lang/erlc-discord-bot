FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p data public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "node src/deploy-commands.js && node src/server.js"]
