import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [
    DatabaseService,
    {
      provide: 'CLOUDFLARE_DB',
      useFactory: () => {
        // In Cloudflare Workers, the binding is often available on the global object or injected.
        return (globalThis as any).DB || null;
      },
    },
  ],
  exports: [DatabaseService, 'CLOUDFLARE_DB'],
})
export class DatabaseModule {}
