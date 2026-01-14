FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build the static site
# Uses "baseUrl": "/mars-miners"
RUN npx expo export -p web

# Install 'serve'
RUN npm install -g serve

# Organize files for subpath serving
# User requested flat structure ("use only public")
RUN mkdir -p public && cp -r dist/* public/



# Serve the 'public' directory
# We do NOT use -s (SPA mode) because we want simple static serving that respects the folder structure
CMD ["serve", "public", "-l", "80"]

EXPOSE 80
