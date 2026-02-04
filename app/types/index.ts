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

// Optymizowana odpowiedź API dla zmniejszenia rozmiaru payload
export interface ProcessingResponse {
  summary: {
    totalST: number;
    totalFVInPDF: number;
    matchedPairs: number;
    errorCount: number;
    warningCount: number;
  };
  correctPairsCount: number;
  correctPairsPreview: Array<{ st: string; fv: string }>;
  errorsCount: number;
  errorsPreview: Array<{ type: string; message: string }>;
  warningsCount: number;
  warningsPreview: Array<{ type: string; message: string }>;
}

export interface ProcessingStatus {
  step: string;
  progress: number;
  message: string;
}