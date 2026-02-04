export interface UploadedFile {
  file: File;
  type: 'pdf' | 'enova';
  status: 'pending' | 'processing' | 'processed' | 'error';
}

export interface ValidationError {
  type: 'missing_pdf' | 'orphan_pdf' | 'duplicate_fv_pdf' | 'duplicate_fv_xlsx';
  message: string;
  data: {
    numerST?: string;
    numerFV?: string;
    count?: number;
  };
}

export interface ValidationResult {
  correctPairs: Array<{ st: string; fv: string }>;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    totalST: number;
    totalFVInPDF: number;
    matchedPairs: number;
    errorCount: number;
    warningCount: number;
  };
}

export interface ProcessingStatus {
  step: string;
  progress: number;
  message: string;
}