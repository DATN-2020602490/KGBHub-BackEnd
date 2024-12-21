git pull
yarn
pm2 delete kgb-hub-backend
yarn migrate
pm2 start "yarn start" --name kgb-hub-backend
