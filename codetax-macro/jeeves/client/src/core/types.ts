export interface SessionStatus {
  loggedIn: boolean;
  isLoggingIn: boolean;
  isRunning: boolean;
  progress: {
    current: number;
    total: number;
    success: number;
    failed: number;
  };
}

export interface SSEEvent {
  type: string;
  message: any;
  time: string;
}

export interface KakaoTarget {
  name: string;
  bizNo: string;
  groupName: string;
  taxAmount: number;
  imageFile: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  dateFolder: string;
  status: string;
  ocrStatus: string | null;
  ocrNote: string | null;
  ocrVerifiedAt: string | null;
  note: string | null;
  taxList: any[];
  taxYear: number;
  taxPeriod: number;
}

export interface DateFolder {
  folder: string;
  bizCount: number;
  taxYear: number | null;
  taxPeriod: number | null;
  startedAt: string | null;
}
