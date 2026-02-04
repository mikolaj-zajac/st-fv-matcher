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
    console.log('[XLSX] Odczyt pliku:', filePath);
    
    // Odczyt pliku
    const fileBuffer = fs.readFileSync(filePath);
    console.log('[XLSX] Rozmiar pliku:', fileBuffer.length, 'bytes');
    
    let workbook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (xlsxError) {
      console.error('[XLSX] Błąd przy odczytywaniu XLSX:', xlsxError);
      // Spróbuj ponownie bez opcji
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    }
    
    console.log('[XLSX] Arkusze:', workbook.SheetNames);
    
    if (workbook.SheetNames.length === 0) {
      throw new Error('Plik XLSX nie zawiera żadnych arkuszy');
    }
    
    // Zakładamy, że dane są na pierwszym arkuszu
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log('[XLSX] Przetwarzanie arkusza:', sheetName);
    
    // Konwersja do JSON
    let rows;
    try {
      rows = XLSX.utils.sheet_to_json(worksheet);
    } catch (jsonError) {
      console.error('[XLSX] Błąd przy konwersji JSON:', jsonError);
      rows = XLSX.utils.sheet_to_json(worksheet);
    }
    
    console.log('[XLSX] Liczba wierszy:', rows.length);
    if (rows.length === 0) {
      console.warn('[XLSX] Arkusz jest pusty!');
    }
    
    const mapping: Record<string, string> = {};
    const numeryFV = new Set<string>();
    const numeryST: string[] = [];

    // Przetwarzanie wierszy
    for (const row of rows) {
      try {
        const rowData = row as Record<string, any>;
        
        // Bezpieczne pobranie wartości
        let numerPelny = '';
        let numerDokumentu = '';
        
        // Spróbuj znaleźć numer pełny
        const npKey = Object.keys(rowData).find(k => 
          k.toLowerCase().includes('numer') && k.toLowerCase().includes('pelny')
        );
        if (npKey && rowData[npKey] != null) {
          numerPelny = String(rowData[npKey]).trim();
        } else if (rowData['Numer.Pelny']) {
          numerPelny = String(rowData['Numer.Pelny']).trim();
        } else if (rowData['Numer Pelny']) {
          numerPelny = String(rowData['Numer Pelny']).trim();
        } else if (rowData['NumerPelny']) {
          numerPelny = String(rowData['NumerPelny']).trim();
        }
        
        // Spróbuj znaleźć numer dokumentu
        const ndKey = Object.keys(rowData).find(k => 
          k.toLowerCase().includes('numer') && k.toLowerCase().includes('dokument')
        );
        if (ndKey && rowData[ndKey] != null) {
          numerDokumentu = String(rowData[ndKey]).trim();
        } else if (rowData['NumerDokumentu']) {
          numerDokumentu = String(rowData['NumerDokumentu']).trim();
        } else if (rowData['Numer Dokumentu']) {
          numerDokumentu = String(rowData['Numer Dokumentu']).trim();
        } else if (rowData['numer']) {
          numerDokumentu = String(rowData['numer']).trim();
        }

        if (numerPelny && numerDokumentu) {
          mapping[numerPelny] = numerDokumentu;
          numeryST.push(numerPelny);
          numeryFV.add(numerDokumentu);
          console.log('[XLSX] Wiersz:', { numerPelny, numerDokumentu });
        }
      } catch (rowError) {
        console.error('[XLSX] Błąd przetwarzania wiersza:', rowError, row);
      }
    }

    console.log('[XLSX] Przetworzono:', {
      mapping: Object.keys(mapping).length,
      numeryST: numeryST.length,
      numeryFV: numeryFV.size,
    });

    return {
      mapping,
      numeryST,
      numeryFV: Array.from(numeryFV),
    };
  } catch (error) {
    console.error('[XLSX] Błąd przy przetwarzaniu XLSX:', error);
    throw new Error(`Nie udało się przetworzyć pliku XLSX: ${error instanceof Error ? error.message : String(error)}`);
  }
}
