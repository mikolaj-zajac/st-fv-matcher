import * as XLSX from 'xlsx';
import fs from 'fs';

export interface XLSXData {
  mapping: Record<string, string>; // Numer.Pelny -> NumerDokumentu
  numeryST: string[];
  numeryFV: string[];
}

/**
 * Odczytuje dane z pliku XLSX
 * @param filePath - ścieżka do pliku XLSX
 * @returns Mapowanie ST -> FV i listy numerów
 */
export async function processXLSX(filePath: string): Promise<XLSXData> {
  try {
    // Odczyt pliku
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    // Zakładamy, że dane są na pierwszym arkuszu
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Konwersja do JSON
    const rows = XLSX.utils.sheet_to_json(worksheet);
    
    const mapping: Record<string, string> = {};
    const numeryFV = new Set<string>();
    const numeryST: string[] = [];

    // Przetwarzanie wierszy
    for (const row of rows) {
      const rowData = row as Record<string, any>;
      const numerPelny = (rowData['Numer.Pelny'] || rowData['Numer Pelny'] || rowData['NumerPelny'] || '').toString().trim();
      const numerDokumentu = (rowData['NumerDokumentu'] || rowData['Numer Dokumentu'] || rowData['numer'] || '').toString().trim();

      if (numerPelny && numerDokumentu) {
        mapping[numerPelny] = numerDokumentu;
        numeryST.push(numerPelny);
        numeryFV.add(numerDokumentu);
      }
    }

    return {
      mapping,
      numeryST,
      numeryFV: Array.from(numeryFV),
    };
  } catch (error) {
    console.error('Błąd przy przetwarzaniu XLSX:', error);
    throw new Error(`Nie udało się przetworzyć pliku XLSX: ${error}`);
  }
}
