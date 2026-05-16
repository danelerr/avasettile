import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { RiskService } from './risk.service';

describe('RiskService', () => {
  let service: RiskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskService,
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
          },
        },
        {
          provide: ConfigurationService,
          useValue: {
            riskReviewAmount: 1000,
            riskRejectAmount: 5000,
          },
        },
      ],
    }).compile();

    service = module.get(RiskService);
  });

  it('approves baseline low-risk requests', () => {
    const assessment = service.assess({
      subjectType: 'payout',
      amount: '25',
      asset: 'USDC',
    });

    expect(assessment.decision).toBe('approve');
    expect(assessment.level).toBe('low');
  });

  it('rejects requests above the reject threshold', () => {
    const assessment = service.assess({
      subjectType: 'payout',
      amount: '6000',
      asset: 'USDC',
    });

    expect(assessment.decision).toBe('reject');
    expect(assessment.reasons).toContain('amount_above_reject_threshold');
  });
});
