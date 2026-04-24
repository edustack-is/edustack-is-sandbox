import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
    schema: process.env['PRISMA_SCHEMA'] || '../backend/prisma/schema.prisma',
    datasource: {
        url: process.env['DATABASE_URL'],
    },
});
