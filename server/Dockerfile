FROM node:20-alpine

# sharp needs these for image processing on alpine
RUN apk add --no-cache vips-dev build-base python3

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src

RUN mkdir -p /app/uploads
VOLUME /app/uploads

EXPOSE 4000
CMD ["node", "src/index.js"]
