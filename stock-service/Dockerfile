FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
EXPOSE 3002
CMD ["node", "index.js"]