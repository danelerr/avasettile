export type RiskSubjectType = 'payout' | 'payin' | 'address';

export type RiskLevel = 'low' | 'medium' | 'high';

export type RiskDecision = 'approve' | 'review' | 'reject';

export type RiskAssessment = {
  id: string;
  subjectType: RiskSubjectType;
  subjectId: string | null;
  score: number;
  level: RiskLevel;
  decision: RiskDecision;
  reasons: string[];
  provider: 'avasettle-mock-risk';
  createdAt: string;
};
