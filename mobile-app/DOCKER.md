# Docker Setup for Mars Miners Client

This document describes how to build and run the Docker container for the Mars Miners mobile app.
**Note:** This setup runs the **Expo Development Server** (`npx expo start --web`), allowing for dynamic execution of the React Native web app.

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
`http://localhost:8080/`

## Managing the Container

Stop the container:
```bash
docker stop mars-miners-client
```

Remove the container:
```bash
docker rm mars-miners-client
```

View logs (useful for checking dev server status):
```bash
docker logs -f mars-miners-client
```
