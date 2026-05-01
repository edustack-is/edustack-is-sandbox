import { Test, TestingModule } from '@nestjs/testing';
import { GradingService } from './grading.service';
import { DatabaseService } from '../database/database.service';

describe('GradingService', () => {
  let service: GradingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradingService,
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

    service = module.get<GradingService>(GradingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
