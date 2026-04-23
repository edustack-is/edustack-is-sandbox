import { Test, TestingModule } from '@nestjs/testing';
import { GradingService } from './grading.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GradingService', () => {
  let service: GradingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GradingService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<GradingService>(GradingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
