#!/bin/sh
set -e

echo "Installing dependencies..."
npm install

echo "Generating Prisma client..."
npx prisma generate

echo "Starting MCP server..."
npm run dev
