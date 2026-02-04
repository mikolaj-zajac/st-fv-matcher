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
 * Fallback dla sytuacji gdzie worker nie jest dostępny
 */
function extractWithPdftotext(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Spróbuj użyć pdftotext command-line tool jeśli jest dostępny
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
  });
}

/**
 * Odczytuje tekst z pliku PDF
 * Próbuje kilka różnych podejść aby uniknąć worker issues
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    // Spróbuj pdftotext najpierw (jeśli jest dostępny w systemie)
    try {
      const text = await extractWithPdftotext(filePath);
      if (text.length > 0) {
        return text;
      }
    } catch (pdfototextError) {
      // Pdftotext nie jest dostępny, próbuj fallback
    }

    // Fallback: użyj regex extraction z surowych danych
    // To jest limited ale będzie działać bez worker issues
    const buffer = fs.readFileSync(filePath);
    const text = buffer.toString('binary');
    
    // Spróbuj wyciągnąć tekst z PDF stream
    // PDF zawiera tekst między BT...ET lub TJ operators
    const matches = text.match(/BT[\s\S]*?ET/g) || [];
    let extractedText = matches.join('\n');
    
    // Jeśli to nie zadziałało, spróbuj innego podejścia
    if (extractedText.length === 0) {
      // Fallback: szukaj bezpośrednio numerów FV w surowych danych
      // Numery FV mogą być zakodowane w PDF
      const fvMatches = text.match(/FV\/\d+\/PL\/\d{4}/g) || [];
      if (fvMatches.length > 0) {
        return fvMatches.join('\n');
      }
      
      // Ostateczny fallback - zwróć warning ale nie rzucaj błędu
      console.warn(`Warning: Could not extract text from PDF ${filePath}, using raw search only`);
      return text;
    }

    return extractedText;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Błąd przy przetwarzaniu PDF ${filePath}:`, errorMsg);
    throw new Error(`Nie udało się przetworzyć pliku PDF: ${errorMsg}`);
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
