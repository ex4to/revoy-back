# develop stage
FROM node:lts-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# build stage
FROM build as runtime
RUN npm run build
CMD ["npm", "run", "serve"]
