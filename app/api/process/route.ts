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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    
    // Pobranie pliku XLSX
    const xlsxFile = formData.get('xlsx') as File;
    if (!xlsxFile) {
      return NextResponse.json(
        { success: false, error: 'Brak pliku XLSX' },
        { status: 400 }
      );
    }

    // Pobranie plików PDF
    const pdfFiles = formData.getAll('pdfs') as File[];
    if (pdfFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Brak plików PDF' },
        { status: 400 }
      );
    }

    // Tworzenie tymczasowego folderu
    const tempDir = join(tmpdir(), 'st-fv-matcher-' + Date.now());
    await mkdir(tempDir, { recursive: true });

    // Zapis pliku XLSX
    const xlsxPath = join(tempDir, xlsxFile.name);
    const xlsxBuffer = await xlsxFile.arrayBuffer();
    await writeFile(xlsxPath, Buffer.from(xlsxBuffer));

    // Zapis plików PDF
    const pdfDir = join(tempDir, 'pdfs');
    await mkdir(pdfDir, { recursive: true });

    for (const pdfFile of pdfFiles) {
      const pdfPath = join(pdfDir, pdfFile.name);
      const pdfBuffer = await pdfFile.arrayBuffer();
      await writeFile(pdfPath, Buffer.from(pdfBuffer));
    }

    // Przetwarzanie danych
    const xlsxData = await processXLSX(xlsxPath);
    const pdfResults = await processPDFFolder(pdfDir);
    
    // Walidacja
    const validationResult = validateData(xlsxData, pdfResults);

    // Generowanie raportu XLSX
    const reportPath = join(tempDir, 'raport.xlsx');
    generateXLSXReport(validationResult, reportPath);

    // Przygotowanie odpowiedzi
    const response: ProcessingResult = {
      success: true,
      data: validationResult,
      reportPath: reportPath,
    };

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
