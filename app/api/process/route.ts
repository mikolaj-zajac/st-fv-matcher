import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { processXLSX } from '@/lib/xlsx-processor';
import { processPDFFolder, getAllFVNumbers } from '@/lib/pdf-processor';
import { validateData, generateXLSXReport, ValidationResult } from '@/lib/validator';

interface ProcessingResult {
  success: boolean;
  data?: ValidationResult;
  reportPath?: string;
  error?: string;
}

// Timeout dla serverless function (Vercel limit to 60s dla Hobby, do 900s dla Pro)
const PROCESSING_TIMEOUT = 50000; // 50 seconds

// Export maxDuration dla Vercela
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[API] Nowe żądanie POST /api/process');
    const formData = await request.formData();
    
    // Pobranie pliku XLSX
    const xlsxFile = formData.get('xlsx') as File;
    if (!xlsxFile) {
      console.log('[API] Błąd: brak pliku XLSX');
      return NextResponse.json(
        { success: false, error: 'Brak pliku XLSX' },
        { status: 400 }
      );
    }

    // Pobranie plików PDF
    const pdfFiles = formData.getAll('pdfs') as File[];
    if (pdfFiles.length === 0) {
      console.log('[API] Błąd: brak plików PDF');
      return NextResponse.json(
        { success: false, error: 'Brak plików PDF' },
        { status: 400 }
      );
    }

    console.log('[API] Otrzymano pliki:', {
      xlsx: xlsxFile.name,
      pdfs: pdfFiles.map(f => f.name),
    });

    // Tworzenie tymczasowego folderu
    const tempDir = join(tmpdir(), 'st-fv-matcher-' + Date.now());
    await mkdir(tempDir, { recursive: true });

    // Zapis pliku XLSX
    const xlsxPath = join(tempDir, xlsxFile.name);
    const xlsxBuffer = await xlsxFile.arrayBuffer();
    await writeFile(xlsxPath, Buffer.from(xlsxBuffer));
    console.log('[API] XLSX zapisany:', xlsxPath);

    // Zapis plików PDF
    const pdfDir = join(tempDir, 'pdfs');
    await mkdir(pdfDir, { recursive: true });

    for (const pdfFile of pdfFiles) {
      const pdfPath = join(pdfDir, pdfFile.name);
      const pdfBuffer = await pdfFile.arrayBuffer();
      await writeFile(pdfPath, Buffer.from(pdfBuffer));
      console.log('[API] PDF zapisany:', pdfPath);
    }

    // Przetwarzanie z timeout
    const processingPromise = async () => {
      console.log('[API] Początek przetwarzania');
      
      console.log('[API] Odczyt XLSX...');
      const xlsxData = await processXLSX(xlsxPath);
      console.log('[API] XLSX załadowany:', {
        numeryST: xlsxData.numeryST.length,
        numeryFV: xlsxData.numeryFV.length,
        mappingSize: Object.keys(xlsxData.mapping).length,
      });
      
      console.log('[API] Przetwarzanie PDF...');
      const pdfResults = await processPDFFolder(pdfDir);
      console.log('[API] PDF przetworzony:', {
        allFVNumbers: pdfResults.allFVNumbers.length,
        filesProcessed: pdfResults.filesFVNumbers.size,
      });
      
      // Walidacja
      console.log('[API] Walidacja danych...');
      const validationResult = validateData(xlsxData, pdfResults);
      console.log('[API] Walidacja zakończona:', {
        correctPairs: validationResult.correctPairs.length,
        errors: validationResult.errors.length,
        warnings: validationResult.warnings.length,
      });

      // Generowanie raportu XLSX
      console.log('[API] Generowanie raportu XLSX...');
      const reportPath = join(tempDir, 'raport.xlsx');
      generateXLSXReport(validationResult, reportPath);
      console.log('[API] Raport wygenerowany:', reportPath);

      return {
        success: true,
        data: validationResult,
        reportPath: reportPath,
      } as ProcessingResult;
    };

    // Dodaj timeout
    const timeoutPromise = new Promise<ProcessingResult>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Przetwarzanie przekroczyło limit czasu (50s). Spróbuj z mniejszą ilością plików.'));
      }, PROCESSING_TIMEOUT);
    });

    const response = await Promise.race([
      processingPromise(),
      timeoutPromise,
    ]);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Błąd podczas przetwarzania:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Nieznany błąd',
      },
      { status: 500 }
    );
  }
}
