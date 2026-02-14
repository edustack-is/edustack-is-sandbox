#!/bin/sh
set -e

echo "Installing dependencies..."
npm install

echo "Patching Prisma schema for MCP server (adding DATABASE_URL)..."
awk '/datasource db \{/{print; print "  url = env(\"DATABASE_URL\")"; next}1' prisma/schema.prisma > prisma/schema_mcp.prisma

echo "Generating Prisma client..."
npx prisma generate --schema=./prisma/schema_mcp.prisma

echo "Starting MCP server..."
npm run dev
