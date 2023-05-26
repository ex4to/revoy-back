# develop stage
FROM node:lts-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# build stage
FROM build as runtime
RUN npm run build

# production stage
FROM nginx:stable-alpine as production
COPY --from=runtime /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
CMD ["npm", "run", "serve"]
