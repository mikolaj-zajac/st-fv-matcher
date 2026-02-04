// Use synchronous PDF text extraction dla Node.js environment
// Bez worker issues
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface PDFExtractionResult {
  fileName: string;
  numeryFV: string[];
}

/**
 * Wyszukuje numery FV w tekście PDF
 */
export function extractFVNumbers(text: string): string[] {
  const regex = /FV\/\d+\/PL\/\d{4}/g;
  const matches = text.match(regex) || [];
  return [...new Set(matches)];
}

/**
 * Ekstrahuj tekst z PDF używając pdftotext (system command)
 */
function extractWithPdftotext(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('pdftotext', [filePath, '-']);
    let output = '';
    let error = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      error += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`pdftotext failed: ${error || 'unknown error'}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });

    // Timeout - jeśli pdftotext trwa dłużej niż 10s, zabij proces
    setTimeout(() => {
      proc.kill();
      reject(new Error('pdftotext timeout'));
    }, 10000);
  });
}

/**
 * Fallback extraction - szukaj numerów FV bezpośrednio w pliku
 */
function extractFVFromRawPDF(filePath: string): string[] {
  try {
    const buffer = fs.readFileSync(filePath);
    const text = buffer.toString('binary');
    
    // Szukaj numerów FV bezpośrednio w surowych danych
    // numery mogą być w różnych formatach w PDF
    const fvMatches = text.match(/FV\/\d{1,4}\/PL\/\d{4}/g) || [];
    return [...new Set(fvMatches)];
  } catch (error) {
    console.warn(`Fallback extraction failed for ${filePath}:`, error);
    return [];
  }
}

/**
 * Odczytuje tekst z pliku PDF
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    // Spróbuj pdftotext najpierw (jeśli jest dostępny w systemie)
    try {
      const text = await extractWithPdftotext(filePath);
      if (text && text.length > 0) {
        return text;
      }
    } catch (pdfototextError) {
      // Pdftotext nie jest dostępny lub timeout, kontynuuj do fallback
      console.warn(`pdftotext failed, using fallback extraction:`, pdfototextError);
    }

    // Fallback: szukaj numerów FV bezpośrednio w surowych danych PDF
    const numeryFV = extractFVFromRawPDF(filePath);
    
    if (numeryFV.length > 0) {
      // Zwróć znalezione numery FV
      return numeryFV.join('\n');
    }

    // Ostateczny fallback - zwróć ostrzeżenie ale nie rzucaj błędu
    console.warn(`Warning: Could not extract text from PDF ${filePath}`);
    return '';
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Błąd przy przetwarzaniu PDF ${filePath}:`, errorMsg);
    
    // Nie rzucaj błędu - zamiast tego spróbuj fallback
    try {
      const fvNumbers = extractFVFromRawPDF(filePath);
      if (fvNumbers.length > 0) {
        return fvNumbers.join('\n');
      }
    } catch (fallbackError) {
      console.error(`Fallback also failed for ${filePath}`);
    }
    
    // Jeśli wszystko zawiedzie, zwróć pusty string zamiast rzucać błąd
    return '';
  }
}

/**
 * Przetwarza pojedynczy plik PDF
 */
export async function processPDFFile(filePath: string): Promise<PDFExtractionResult> {
  const fileName = path.basename(filePath);
  const text = await extractTextFromPDF(filePath);
  const numeryFV = extractFVNumbers(text);

  return {
    fileName,
    numeryFV,
  };
}

/**
 * Przetwarza wszystkie pliki PDF z folderu
 */
export async function processPDFFolder(folderPath: string): Promise<PDFExtractionResult[]> {
  try {
    // Sprawdzenie czy ścieżka to plik czy folder
    const stats = fs.statSync(folderPath);
    
    if (stats.isFile() && folderPath.endsWith('.pdf')) {
      // Jeśli to pojedynczy plik PDF
      return [await processPDFFile(folderPath)];
    }

    if (!stats.isDirectory()) {
      throw new Error('Ścieżka musi być folderem lub plikiem PDF');
    }

    // Jeśli to folder
    const files = fs.readdirSync(folderPath);
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));

    const results: PDFExtractionResult[] = [];
    for (const file of pdfFiles) {
      const filePath = path.join(folderPath, file);
      const result = await processPDFFile(filePath);
      results.push(result);
    }

    return results;
  } catch (error) {
    console.error('Błąd przy przetwarzaniu folderu PDF:', error);
    throw new Error(`Nie udało się przetworzyć folderu: ${error}`);
  }
}

/**
 * Ekstrahuje wszystkie unikalne numery FV z wyników
 */
export function getAllFVNumbers(results: PDFExtractionResult[]): string[] {
  const allNumbers = new Set<string>();
  for (const result of results) {
    result.numeryFV.forEach(num => allNumbers.add(num));
  }
  return Array.from(allNumbers);
}
