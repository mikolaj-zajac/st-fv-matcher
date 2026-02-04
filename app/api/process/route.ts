import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { processXLSX } from '@/lib/xlsx-processor';
import { processPDFFolder } from '@/lib/pdf-processor';
import { validateData, generateXLSXReport } from '@/lib/validator';
import { unzipSync } from 'fflate';

interface ProcessingResult {
  success: boolean;
  data?: {
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
  };
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
    
    const maxXlsxSize = 10 * 1024 * 1024; // 10MB
    const maxPdfSize = 15 * 1024 * 1024; // 15MB
    const maxBundleSize = 20 * 1024 * 1024; // 20MB

    const bundleFile = formData.get('bundle') as File | null;

    // Tworzenie tymczasowego folderu
    const tempDir = join(tmpdir(), 'st-fv-matcher-' + Date.now());
    await mkdir(tempDir, { recursive: true });

    let xlsxPath = '';
    const pdfDir = join(tempDir, 'pdfs');
    await mkdir(pdfDir, { recursive: true });

    if (bundleFile) {
      if (bundleFile.size > maxBundleSize) {
        console.log('[API] Błąd: paczka ZIP za duża:', bundleFile.size);
        return NextResponse.json(
          { success: false, error: `Paczka ZIP jest za duża (${(bundleFile.size / 1024 / 1024).toFixed(2)}MB). Maksymalnie 20MB.` },
          { status: 413 }
        );
      }

      console.log('[API] Otrzymano paczkę ZIP:', `${bundleFile.name} (${(bundleFile.size / 1024).toFixed(2)}KB)`);
      const zipBuffer = new Uint8Array(await bundleFile.arrayBuffer());
      const entries = unzipSync(zipBuffer);
      const entryNames = Object.keys(entries);

      const xlsxEntryName = entryNames.find((name) => {
        const lower = name.toLowerCase();
        return lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv');
      });

      if (!xlsxEntryName) {
        return NextResponse.json(
          { success: false, error: 'Paczka ZIP nie zawiera pliku XLSX/CSV' },
          { status: 400 }
        );
      }

      const pdfEntryNames = entryNames.filter((name) => name.toLowerCase().endsWith('.pdf'));
      if (pdfEntryNames.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Paczka ZIP nie zawiera plików PDF' },
          { status: 400 }
        );
      }

      const xlsxEntry = entries[xlsxEntryName];
      if (xlsxEntry.length > maxXlsxSize) {
        return NextResponse.json(
          { success: false, error: `Plik XLSX jest za duży (${(xlsxEntry.length / 1024 / 1024).toFixed(2)}MB). Maksymalnie 10MB.` },
          { status: 413 }
        );
      }

      const xlsxFileName = xlsxEntryName.split('/').pop() || 'upload.xlsx';
      xlsxPath = join(tempDir, xlsxFileName);
      await writeFile(xlsxPath, Buffer.from(xlsxEntry));
      console.log('[API] XLSX z ZIP zapisany:', xlsxPath);

      for (const pdfEntryName of pdfEntryNames) {
        const pdfEntry = entries[pdfEntryName];
        if (pdfEntry.length > maxPdfSize) {
          return NextResponse.json(
            { success: false, error: `Plik PDF "${pdfEntryName}" jest za duży (${(pdfEntry.length / 1024 / 1024).toFixed(2)}MB). Maksymalnie 15MB na plik.` },
            { status: 413 }
          );
        }
        const pdfFileName = pdfEntryName.split('/').pop() || 'file.pdf';
        const pdfPath = join(pdfDir, pdfFileName);
        await writeFile(pdfPath, Buffer.from(pdfEntry));
        console.log('[API] PDF z ZIP zapisany:', pdfPath);
      }
    } else {
      // Pobranie pliku XLSX
      const xlsxFile = formData.get('xlsx') as File;
      if (!xlsxFile) {
        console.log('[API] Błąd: brak pliku XLSX');
        return NextResponse.json(
          { success: false, error: 'Brak pliku XLSX' },
          { status: 400 }
        );
      }

      // Weryfikacja rozmiaru XLSX (max 5MB)
      if (xlsxFile.size > maxXlsxSize) {
        console.log('[API] Błąd: plik XLSX za duży:', xlsxFile.size);
        return NextResponse.json(
          { success: false, error: `Plik XLSX jest za duży (${(xlsxFile.size / 1024 / 1024).toFixed(2)}MB). Maksymalnie 10MB.` },
          { status: 413 }
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

      // Weryfikacja rozmiaru PDF plików (max 2MB na plik)
      for (const pdfFile of pdfFiles) {
        if (pdfFile.size > maxPdfSize) {
          console.log('[API] Błąd: plik PDF za duży:', pdfFile.name, pdfFile.size);
          return NextResponse.json(
            { success: false, error: `Plik PDF "${pdfFile.name}" jest za duży (${(pdfFile.size / 1024 / 1024).toFixed(2)}MB). Maksymalnie 15MB na plik.` },
            { status: 413 }
          );
        }
      }

      console.log('[API] Otrzymano pliki:', {
        xlsx: `${xlsxFile.name} (${(xlsxFile.size / 1024).toFixed(2)}KB)`,
        pdfs: pdfFiles.map(f => `${f.name} (${(f.size / 1024).toFixed(2)}KB)`),
      });

      // Zapis pliku XLSX
      xlsxPath = join(tempDir, xlsxFile.name);
      const xlsxBuffer = await xlsxFile.arrayBuffer();
      await writeFile(xlsxPath, Buffer.from(xlsxBuffer));
      console.log('[API] XLSX zapisany:', xlsxPath);

      // Zapis plików PDF
      for (const pdfFile of pdfFiles) {
        const pdfPath = join(pdfDir, pdfFile.name);
        const pdfBuffer = await pdfFile.arrayBuffer();
        await writeFile(pdfPath, Buffer.from(pdfBuffer));
        console.log('[API] PDF zapisany:', pdfPath);
      }
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
        filesProcessed: pdfResults.length,
        totalFVNumbers: pdfResults.reduce((sum, r) => sum + r.numeryFV.length, 0),
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

      // Zwróć optymizowany wynik (bez pełnych list błędów/ostrzeżeń aby zmniejszyć rozmiar payload)
      return {
        success: true,
        data: {
          summary: validationResult.summary,
          correctPairsCount: validationResult.correctPairs.length,
          correctPairsPreview: validationResult.correctPairs.slice(0, 10), // Tylko pierwszych 10
          errorsCount: validationResult.errors.length,
          errorsPreview: validationResult.errors.slice(0, 10).map(e => ({
            type: e.type,
            message: e.message,
          })),
          warningsCount: validationResult.warnings.length,
          warningsPreview: validationResult.warnings.slice(0, 10).map(w => ({
            type: w.type,
            message: w.message,
          })),
        },
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
