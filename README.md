# KGBHub-BackEnd

![alt text](https://i.imgur.com/aUFPomB.png)

## Requirements
- **Node.js**: Version **20 LTS** or later.
- **Yarn**: Yarn package manager.
- **Docker**: For managing database and related services.

---

## Installation

### 1. Install dependencies
Run the following command to install all required dependencies:
```bash
yarn install
```

### 2. Environment configuration
Create a `.env` file in the project root directory with the necessary configurations. For example:
```env
PORT=3000
DB_HOST=postgres_container
DB_PORT=5432
DB_SCHEMA=public
REFRESH_TOKEN=
# local
POSTGRES_USER=gwyn
POSTGRES_PASSWORD=gwyn_trader
POSTGRES_DB=kgb_hub
REDIRECT_URL=https://developers.google.com/oauthplayground
CLIENT_ID=
CLIENT_SECRET=
CALLBACK_URL=http://localhost:3000/api/v1/auth/redirect
SECRET=7haoojNK1mo
REFRESH_SECRET=knxnbOj1nnn
FE_NEXT_URL=http://localhost:3000/
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${DB_HOST}:${DB_PORT}/${POSTGRES_DB}?schema=${DB_SCHEMA}&sslmode=prefer
PUBLIC_URL=https://localhost:3001
EMAIL_SENDER=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

```

---

## Usage

### Manage database

- **Start database**:
  ```bash
  yarn dbup
  ```

- **Stop database**:
  ```bash
  yarn dbdown
  ```

- **Reset and clear database**:
  ```bash
  yarn rsdb
  ```

### Start the project
To start the backend project:
```bash
sh bin/releash.sh
```

---

## Development

### Start server
Ensure the database is running (see **Manage database**), then start the server:
```bash
yarn start
```

### Start server in development mode
For live reload during development:
```bash
yarn dev
```

---