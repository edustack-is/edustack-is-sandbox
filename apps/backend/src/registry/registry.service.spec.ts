import { Test, TestingModule } from '@nestjs/testing';
import { RegistryService } from './registry.service';
import { DatabaseService } from '../database/database.service';

describe('RegistryService', () => {
  let service: RegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistryService,
        {
          provide: DatabaseService,
          useValue: {
            query: jest.fn().mockResolvedValue([]),
            queryOne: jest.fn().mockResolvedValue(null),
            execute: jest
              .fn()
              .mockResolvedValue({ lastInsertRowid: 0, changes: 0 }),
          },
        },
      ],
    }).compile();

    service = module.get<RegistryService>(RegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
