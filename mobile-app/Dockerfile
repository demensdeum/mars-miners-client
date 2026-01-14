FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Run the Expo development server for web
# This corresponds to "react web server" (Webpack/Metro)
# We bind to port 80 and ensure it listens on all interfaces
ENV CI=1
CMD ["npx", "expo", "start", "--web", "--port", "80"]

EXPOSE 80
