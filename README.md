# sign-in-with-ethereum

### Tech Stack
- Tailwindcss
- Webpack
- Expressjs
- Nodejs
- Metamask
- Sign In With ethereum SIWE
- JWT Authentication


## Usage


### Server

First run postgres database, we used docker-compose:
```sh
cd server
docker-compose -f docker-compose-postgres-pgadmin4.yml up
```

Then
```sh
yarn

node index.js
```

Server will start on http://localhost:3000


### Client
```bash
cd client

yarn

yarn serve
```
You can open the client app in the browser by visiting: http://localhost:8080
