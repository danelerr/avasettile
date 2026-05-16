import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { RequestContext } from '../payouts/payout.types';
import { AssessRiskDto } from './dto/assess-risk.dto';
import { RiskAssessment } from './risk.types';

@Injectable()
export class RiskService {
  constructor(
    private readonly audit: AuditService,
    private readonly configuration: ConfigurationService,
  ) {}

  assess(dto: AssessRiskDto, context?: RequestContext): RiskAssessment {
    const reasons: string[] = [];
    let score = 10;
    const numericAmount = dto.amount ? Number(dto.amount) : 0;

    if (numericAmount >= this.configuration.riskRejectAmount) {
      score += 85;
      reasons.push('amount_above_reject_threshold');
    } else if (numericAmount >= this.configuration.riskReviewAmount) {
      score += 45;
      reasons.push('amount_above_review_threshold');
    }

    if (dto.address?.toLowerCase().startsWith('0x000000')) {
      score += 20;
      reasons.push('unusual_zero_prefixed_address');
    }

    const countryValue = dto.metadata?.country;
    const country =
      typeof countryValue === 'string' ? countryValue.toUpperCase() : '';
    if (['IR', 'KP', 'SY'].includes(country)) {
      score += 80;
      reasons.push('restricted_country_metadata');
    }

    score = Math.min(score, 100);
    const level = score >= 75 ? 'high' : score >= 40 ? 'medium' : 'low';
    const decision =
      level === 'high' ? 'reject' : level === 'medium' ? 'review' : 'approve';
    const assessment: RiskAssessment = {
      id: randomUUID(),
      subjectType: dto.subjectType,
      subjectId: dto.subjectId ?? null,
      score,
      level,
      decision,
      reasons: reasons.length > 0 ? reasons : ['baseline_clear'],
      provider: 'avasettle-mock-risk',
      createdAt: new Date().toISOString(),
    };

    this.audit.record({
      type: 'RISK_ASSESSED',
      subjectId: dto.subjectId ?? assessment.id,
      actor: {
        institutionId: context?.institutionId ?? null,
        actor: context?.actor ?? null,
        correlationId: context?.correlationId ?? null,
        sourceIp: context?.sourceIp ?? null,
      },
      payload: assessment,
    });

    return assessment;
  }
}
