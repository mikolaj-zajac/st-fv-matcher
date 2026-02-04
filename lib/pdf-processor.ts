// Use synchronous PDF text extraction dla Node.js environment
// Bez worker issues
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

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
 * Fallback extraction - szukaj numerów FV bezpośrednio w pliku
 */
function extractFVFromRawPDF(filePath: string): string[] {
  try {
    console.log('[PDF] Fallback extraction dla:', filePath);
    const buffer = fs.readFileSync(filePath);
    const text = buffer.toString('binary');
    console.log('[PDF] Raw buffer size:', buffer.length, 'text length:', text.length);
    
    // Szukaj numerów FV bezpośrednio w surowych danych
    // numery mogą być w różnych formatach w PDF
    const fvMatches = text.match(/FV\/\d{1,4}\/PL\/\d{4}/g) || [];
    console.log('[PDF] Fallback znalazł numerów FV:', fvMatches.length, 'pierwsze 3:', fvMatches.slice(0, 3));
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
    console.log('[PDF] Ekstrakcja tekstu z:', filePath);
    
    // Użyj pdf-parse (działa na Vercelu)
    const dataBuffer = fs.readFileSync(filePath);
    console.log('[PDF] Odczytano buffer:', dataBuffer.length, 'bytes');
    
    const data = await pdfParse(dataBuffer);
    console.log('[PDF] pdf-parse sukces:', {
      pages: data.numpages,
      textLength: data.text.length,
      preview: data.text.substring(0, 200)
    });
    
    if (data.text && data.text.length > 0) {
      return data.text;
    }
    
    // Fallback: szukaj numerów FV bezpośrednio w surowych danych PDF
    console.log('[PDF] pdf-parse zwrócił pusty tekst, próbuję fallback');
    const numeryFV = extractFVFromRawPDF(filePath);
    
    if (numeryFV.length > 0) {
      console.log('[PDF] Fallback znalazł numery:', numeryFV.length);
      return numeryFV.join('\n');
    }

    console.warn(`Warning: Could not extract text from PDF ${filePath}`);
    return '';
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Błąd przy przetwarzaniu PDF ${filePath}:`, errorMsg);
    
    // Nie rzucaj błędu - zamiast tego spróbuj fallback
    try {
      console.log('[PDF] Próbuję fallback po błędzie pdf-parse');
      const fvNumbers = extractFVFromRawPDF(filePath);
      if (fvNumbers.length > 0) {
        console.log('[PDF] Fallback po błędzie znalazł:', fvNumbers.length, 'numerów');
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
  try {
    console.log('[PDF] Przetwarzanie pliku:', filePath);
    const fileName = path.basename(filePath);
    
    console.log('[PDF] Ekstrakcja tekstu z:', fileName);
    const text = await extractTextFromPDF(filePath);
    console.log('[PDF] Tekst wyekstrahowany:', {
      fileName,
      length: text.length,
      preview: text.substring(0, 100),
    });
    
    console.log('[PDF] Wyszukiwanie numerów FV w:', fileName);
    const numeryFV = extractFVNumbers(text);
    console.log('[PDF] Znalezione numery FV:', numeryFV);

    return {
      fileName,
      numeryFV,
    };
  } catch (error) {
    console.error('[PDF] Błąd przy przetwarzaniu PDF:', filePath, error);
    // Zwróć pusty wynik zamiast rzucać błąd
    return {
      fileName: path.basename(filePath),
      numeryFV: [],
    };
  }
}

/**
 * Przetwarza wszystkie pliki PDF z folderu
 */
export async function processPDFFolder(folderPath: string): Promise<PDFExtractionResult[]> {
  try {
    console.log('[PDF] Przetwarzanie folderu:', folderPath);
    
    // Sprawdzenie czy ścieżka to plik czy folder
    const stats = fs.statSync(folderPath);
    
    if (stats.isFile() && folderPath.endsWith('.pdf')) {
      // Jeśli to pojedynczy plik PDF
      console.log('[PDF] Przetwarzanie pojedynczego pliku PDF:', folderPath);
      return [await processPDFFile(folderPath)];
    }

    if (!stats.isDirectory()) {
      throw new Error('Ścieżka musi być folderem lub plikiem PDF');
    }

    // Jeśli to folder
    console.log('[PDF] Czytanie folderu...');
    const files = fs.readdirSync(folderPath);
    console.log('[PDF] Znalezione pliki:', files);
    
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));
    console.log('[PDF] Znalezione pliki PDF:', pdfFiles.length);

    const results: PDFExtractionResult[] = [];
    for (const file of pdfFiles) {
      const filePath = path.join(folderPath, file);
      console.log('[PDF] Przetwarzanie pliku:', file);
      const result = await processPDFFile(filePath);
      console.log('[PDF] Wynik:', {
        fileName: result.fileName,
        fvCount: result.numeryFV.length,
        fvNumbers: result.numeryFV.slice(0, 5),
      });
      results.push(result);
    }

    console.log('[PDF] Przetwarzanie zakończone. Razem plików:', results.length);
    return results;
  } catch (error) {
    console.error('[PDF] Błąd przy przetwarzaniu folderu PDF:', error);
    throw new Error(`Nie udało się przetworzyć folderu: ${error instanceof Error ? error.message : String(error)}`);
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
