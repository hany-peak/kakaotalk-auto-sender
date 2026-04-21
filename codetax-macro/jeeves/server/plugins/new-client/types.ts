export const BUSINESS_SCOPES = ['기장', '신고대리'] as const;
export type BusinessScope = typeof BUSINESS_SCOPES[number];

export const INFLOW_ROUTES = ['소개1', '소개2', '블로그'] as const;
export type InflowRoute = typeof INFLOW_ROUTES[number];

export interface NewClientInput {
  companyName: string;
  businessScope: BusinessScope;
  representative: string;
  startDate: string; // YYYY-MM-DD
  industry: string;
  bookkeepingFee: number;
  adjustmentFee: number;
  inflowRoute: InflowRoute;
  contractNote?: string;
}

export interface NewClientRecord extends NewClientInput {
  id: string;
  createdAt: string; // ISO 8601
}

export interface SubmitResponse {
  ok: true;
  id: string;
  slackNotified: boolean;
}

export interface ErrorResponse {
  error: string;
}
