# Docker Setup for Mars Miners Client

This document describes how to build and run the Docker container for the Mars Miners mobile app.

**Note:** We use a **Static Build** served by Node.js. This is **required** to support hosting under a subpath like `/mars-miners/`, as the development server does not support this.

## Prerequisites

- Docker installed on your machine.

## Build the Image

Run the following command in the `mobile-app` directory:

```bash
docker build -t demensdeum/mars-miners-client .
```

## Run the Container

Run the container mapping port 80 to a port of your choice (e.g., 8080):

```bash
docker run -d -p 8080:80 --name mars-miners-client demensdeum/mars-miners-client
```

## Accessing the App

Access the application at:
`http://localhost:8080/mars-miners/`

(Or `https://mediumdemens.vps.webdock.cloud/mars-miners/`)

## Managing the Container

Stop:
```bash
docker stop mars-miners-client
```

Remove:
```bash
docker rm mars-miners-client
```
