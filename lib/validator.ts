import { XLSXData } from './xlsx-processor';
import { PDFExtractionResult } from './pdf-processor';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

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

/**
 * Porównuje dane z XLSX i PDF oraz generuje raport walidacji
 */
export function validateData(xlsxData: XLSXData, pdfResults: PDFExtractionResult[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const correctPairs: Array<{ st: string; fv: string }> = [];

  // Wyodrębnianie wszystkich numerów FV z PDF
  const fvInPDFSet = new Set<string>();
  const fvInPDFCount: Record<string, number> = {};

  for (const result of pdfResults) {
    for (const fv of result.numeryFV) {
      fvInPDFSet.add(fv);
      fvInPDFCount[fv] = (fvInPDFCount[fv] || 0) + 1;
    }
  }

  const fvInPDFArray = Array.from(fvInPDFSet);

  // 4.1 Sprawdzenie brakujących faktur PDF
  for (const numerST of xlsxData.numeryST) {
    const numerFV = xlsxData.mapping[numerST];
    
    if (fvInPDFSet.has(numerFV)) {
      correctPairs.push({ st: numerST, fv: numerFV });
    } else {
      errors.push({
        type: 'missing_pdf',
        message: `Brak faktury PDF dla ST = ${numerST}, FV = ${numerFV}`,
        data: { numerST, numerFV },
      });
    }
  }

  // 4.2 Sprawdzenie faktur PDF bez numeru ST
  const fvInXLSXSet = new Set(xlsxData.numeryFV);

  for (const numerFV of fvInPDFArray) {
    if (!fvInXLSXSet.has(numerFV)) {
      errors.push({
        type: 'orphan_pdf',
        message: `Faktura PDF bez przypisanego numeru ST: FV = ${numerFV}`,
        data: { numerFV },
      });
    }
  }

  // 4.3 Sprawdzenie duplikatów w PDF
  for (const fv of fvInPDFArray) {
    if (fvInPDFCount[fv] > 1) {
      warnings.push({
        type: 'duplicate_fv_pdf',
        message: `Numer FV ${fv} występuje ${fvInPDFCount[fv]} razy w plikach PDF`,
        data: { numerFV: fv, count: fvInPDFCount[fv] },
      });
    }
  }

  // 4.3 Sprawdzenie duplikatów w XLSX
  const fvInXLSXCount: Record<string, number> = {};
  for (const numerFV of xlsxData.numeryFV) {
    fvInXLSXCount[numerFV] = (fvInXLSXCount[numerFV] || 0) + 1;
  }

  for (const fv of Object.keys(fvInXLSXCount)) {
    if (fvInXLSXCount[fv] > 1) {
      warnings.push({
        type: 'duplicate_fv_xlsx',
        message: `Numer FV ${fv} przypisany jest do ${fvInXLSXCount[fv]} numerów ST w XLSX`,
        data: { numerFV: fv, count: fvInXLSXCount[fv] },
      });
    }
  }

  return {
    correctPairs,
    errors,
    warnings,
    summary: {
      totalST: xlsxData.numeryST.length,
      totalFVInPDF: fvInPDFArray.length,
      matchedPairs: correctPairs.length,
      errorCount: errors.length,
      warningCount: warnings.length,
    },
  };
}

/**
 * Generuje raport w formacie XLSX
 */
export function generateXLSXReport(
  validationResult: ValidationResult,
  outputPath: string
): void {
  const workbook = XLSX.utils.book_new();

  // Arkusz 1: Prawidłowe pary ST <-> FV
  const correctPairsSheet = XLSX.utils.json_to_sheet(
    validationResult.correctPairs.map(pair => ({
      'Numer ST': pair.st,
      'Numer FV': pair.fv,
      'Status': 'Prawidłowa',
    }))
  );
  XLSX.utils.book_append_sheet(workbook, correctPairsSheet, 'Prawidłowe pary');

  // Arkusz 2: Błędy
  const errorsSheet = XLSX.utils.json_to_sheet(
    validationResult.errors.map(error => ({
      'Typ błędu': error.type,
      'Wiadomość': error.message,
      'Numer ST': error.data.numerST || '-',
      'Numer FV': error.data.numerFV || '-',
    }))
  );
  XLSX.utils.book_append_sheet(workbook, errorsSheet, 'Błędy');

  // Arkusz 3: Ostrzeżenia
  const warningsSheet = XLSX.utils.json_to_sheet(
    validationResult.warnings.map(warning => ({
      'Typ ostrzeżenia': warning.type,
      'Wiadomość': warning.message,
      'Numer FV': warning.data.numerFV || '-',
      'Liczba': warning.data.count || '-',
    }))
  );
  XLSX.utils.book_append_sheet(workbook, warningsSheet, 'Ostrzeżenia');

  // Arkusz 4: Podsumowanie
  const summarySheet = XLSX.utils.json_to_sheet([
    { 'Metrika': 'Całkowita liczba dokumentów ST', 'Wartość': validationResult.summary.totalST },
    { 'Metrika': 'Liczba numerów FV w PDF', 'Wartość': validationResult.summary.totalFVInPDF },
    { 'Metrika': 'Prawidłowe pary ST-FV', 'Wartość': validationResult.summary.matchedPairs },
    { 'Metrika': 'Liczba błędów', 'Wartość': validationResult.summary.errorCount },
    { 'Metrika': 'Liczba ostrzeżeń', 'Wartość': validationResult.summary.warningCount },
  ]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Podsumowanie');

  // Zapis pliku - użyj write() zamiast writeFile() dla Node.js
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync(outputPath, buffer);
}

/**
 * Generuje raport w formacie CSV
 */
export function generateCSVReport(
  validationResult: ValidationResult,
  outputPath: string
): void {
  const csvLines: string[] = [];

  // Nagłówek
  csvLines.push('RAPORT WALIDACJI FAKTUR');
  csvLines.push('');

  // Podsumowanie
  csvLines.push('PODSUMOWANIE');
  csvLines.push('Metryka,Wartość');
  csvLines.push(`"Całkowita liczba dokumentów ST","${validationResult.summary.totalST}"`);
  csvLines.push(`"Liczba numerów FV w PDF","${validationResult.summary.totalFVInPDF}"`);
  csvLines.push(`"Prawidłowe pary ST-FV","${validationResult.summary.matchedPairs}"`);
  csvLines.push(`"Liczba błędów","${validationResult.summary.errorCount}"`);
  csvLines.push(`"Liczba ostrzeżeń","${validationResult.summary.warningCount}"`);
  csvLines.push('');

  // Prawidłowe pary
  csvLines.push('PRAWIDŁOWE PARY');
  csvLines.push('Numer ST,Numer FV,Status');
  for (const pair of validationResult.correctPairs) {
    csvLines.push(`"${pair.st}","${pair.fv}","Prawidłowa"`);
  }
  csvLines.push('');

  // Błędy
  csvLines.push('BŁĘDY');
  csvLines.push('Typ błędu,Wiadomość,Numer ST,Numer FV');
  for (const error of validationResult.errors) {
    csvLines.push(
      `"${error.type}","${error.message}","${error.data.numerST || '-'}","${error.data.numerFV || '-'}"`
    );
  }
  csvLines.push('');

  // Ostrzeżenia
  csvLines.push('OSTRZEŻENIA');
  csvLines.push('Typ ostrzeżenia,Wiadomość,Numer FV,Liczba');
  for (const warning of validationResult.warnings) {
    csvLines.push(
      `"${warning.type}","${warning.message}","${warning.data.numerFV || '-'}","${warning.data.count || '-'}"`
    );
  }

  fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf-8');
}
