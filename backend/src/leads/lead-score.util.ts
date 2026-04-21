import { LeadSource } from '@prisma/client';

export type ScoreInput = {
  source: LeadSource;
  engagementCount: number;
  createdAt: Date;
  firstResponseAt?: Date | null;
};

export function calculateLeadScore(input: ScoreInput): number {
  const sourceScore =
    input.source === LeadSource.WHATSAPP
      ? 30
      : input.source === LeadSource.WEBSITE
        ? 22
        : input.source === LeadSource.OFFLINE
          ? 15
          : 10;

  const engagementScore = Math.min(40, input.engagementCount * 4);

  let responseScore = 0;
  if (input.firstResponseAt) {
    const mins = Math.max(
      0,
      Math.floor((input.firstResponseAt.getTime() - input.createdAt.getTime()) / 60000),
    );
    if (mins <= 15) responseScore = 30;
    else if (mins <= 60) responseScore = 24;
    else if (mins <= 240) responseScore = 16;
    else if (mins <= 1440) responseScore = 8;
    else responseScore = 3;
  }

  return Math.max(0, Math.min(100, sourceScore + engagementScore + responseScore));
}

