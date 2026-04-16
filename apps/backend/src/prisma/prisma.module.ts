import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
    providers: [
        PrismaService,
        {
            provide: 'CLOUDFLARE_DB',
            useFactory: () => {
                // In Cloudflare Workers, the binding is often available on the global object or injected.
                // When using a NestJS worker adapter, it might be passed via the request context.
                return (globalThis as any).DB || null;
            }
        }
    ],
    exports: [PrismaService, 'CLOUDFLARE_DB'],
})
export class PrismaModule { }
