FROM node:19.9.0-bullseye-slim

WORKDIR /app

COPY package.json ./

RUN npm install

RUN npm install -g typescript
RUN npm install -g ts-node

COPY . ./
RUN npm run build

EXPOSE 80

CMD ["npm", "start"]