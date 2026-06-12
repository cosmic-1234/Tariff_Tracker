FROM node:20-alpine

WORKDIR /app

# Copy dependency manifest files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Expose port
EXPOSE 5000

# Set production environment variable
ENV NODE_ENV=production

# Run command
CMD ["node", "server.js"]
