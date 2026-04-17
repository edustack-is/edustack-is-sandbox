import { Test, TestingModule } from '@nestjs/testing';
import { RegistryService } from './registry.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RegistryService', () => {
  let service: RegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistryService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<RegistryService>(RegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
