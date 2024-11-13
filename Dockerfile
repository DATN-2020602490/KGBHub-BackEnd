##
# Build stage
##

FROM node:lts-iron AS build

WORKDIR /app

COPY ["package.json", "yarn.lock*", "./"]
RUN yarn --pure-lockfile

COPY . .

RUN npx prisma generate
RUN npx tsc

##
# Production stage
##

FROM node:lts-iron AS production

WORKDIR /app

COPY ["package.json", "yarn.lock*", "./"]
RUN yarn --production --pure-lockfile

COPY --from=build /app/dist dist
COPY --from=build /app/prisma prisma
COPY --from=build /app/.env .env

RUN npx prisma generate

EXPOSE 3000
CMD npx prisma migrate deploy && node dist/index
