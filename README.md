# chainpoint-node


## Development

Run from directory on port 8080:

```
cd chainpoint-node
npm install --no-optional
npm start
http://127.0.0.1:8080/hello
```

Run using `docker-compose` on port 9090:

```
cd chainpoint-node
docker-compose up -d --build
http://127.0.0.1:9090/hello
```

Repeat the `docker-compose up -d --build` command
to rebuild the container and replace the running one.

Run `docker-compose down` when ready to turn it off.
