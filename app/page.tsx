'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import FileList from './components/FileList';
import ProcessingButton from './components/ProcessingButton';
import ResultsDisplay from './components/ResultsDisplay';
import type { ValidationResult, UploadedFile } from './types';

export default function Home() {
  const [pdfFiles, setPdfFiles] = useState<UploadedFile[]>([]);
  const [enovaFile, setEnovaFile] = useState<UploadedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    
    acceptedFiles.forEach((file) => {
      // Sprawdź typ pliku
      if (file.type === 'application/pdf') {
        // PDF - faktury z IdoSell
        const newFile: UploadedFile = {
          file,
          type: 'pdf',
          status: 'pending'
        };
        setPdfFiles(prev => [...prev, newFile]);
      } else if (
        file.type === 'text/csv' || 
        file.type === 'application/vnd.ms-excel' ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        // Plik z Enova (CSV/Excel)
        setEnovaFile({
          file,
          type: 'enova',
          status: 'pending'
        });
      } else {
        setError(`Nieobsługiwany format pliku: ${file.name}`);
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: true
  });

  const handleProcess = async () => {
    if (pdfFiles.length === 0 || !enovaFile) {
      setError('Potrzebujesz przynajmniej jeden plik PDF i plik z Enova');
      return;
    }

    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    pdfFiles.forEach((file) => {
      formData.append('pdfs', file.file);
    });
    formData.append('xlsx', enovaFile.file);

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Błąd serwera: ${response.status}`);
      }

      setResults(data.data);
      
      // Aktualizuj statusy plików
      setPdfFiles(prev => prev.map(f => ({ ...f, status: 'processed' })));
      if (enovaFile) {
        setEnovaFile({ ...enovaFile, status: 'processed' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
    } finally {
      setIsProcessing(false);
    }
  };

  const removePdfFile = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeEnovaFile = () => {
    setEnovaFile(null);
  };

  const clearAll = () => {
    setPdfFiles([]);
    setEnovaFile(null);
    setResults(null);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Nagłówek */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            InvoiceGap - Weryfikacja kompletności faktur
          </h1>
          <p className="text-gray-600">
            Sprawdź czy wszystkie faktury (FV) z IdoSell mają odpowiadające wpisy (ST) w Enova
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Lewa kolumna - Upload */}
          <div className="space-y-6">
            {/* Dropzone */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Przeciągnij pliki</h2>
              
              <div 
                {...getRootProps()} 
                className={`dropzone ${isDragActive ? 'dropzone-active' : ''}`}
              >
                <input {...getInputProps()} />
                <div className="space-y-2">
                  <div className="text-4xl">📁</div>
                  <p className="text-lg font-medium">
                    {isDragActive ? 'Upuść pliki tutaj...' : 'Przeciągnij pliki tutaj lub kliknij'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Akceptowane: PDF (faktury) + CSV/Excel (Enova)
                  </p>
                </div>
              </div>

              {/* Instrukcja */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium mb-2">Jak to działa:</h3>
                <ol className="text-sm space-y-1 list-decimal pl-4">
                  <li>Wrzuć pliki PDF z fakturami z IdoSell (numer FV/...)</li>
                  <li>Wrzuć plik z Enova z mapowaniem ST → FV (CSV/Excel)</li>
                  <li>Kliknij "Rozpocznij weryfikację"</li>
                  <li>Otrzymaj raport brakujących i niepasujących faktur</li>
                </ol>
              </div>
            </div>

            {/* Lista plików */}
            <FileList
              pdfFiles={pdfFiles}
              enovaFile={enovaFile}
              onRemovePdf={removePdfFile}
              onRemoveEnova={removeEnovaFile}
              onClearAll={clearAll}
            />
          </div>

          {/* Prawa kolumna - Wyniki */}
          <div className="space-y-6">
            {/* Przycisk procesowania */}
            <ProcessingButton
              isProcessing={isProcessing}
              onClick={handleProcess}
              hasFiles={pdfFiles.length > 0 && !!enovaFile}
              error={error || undefined}
            />

            {/* Błędy */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <p className="font-medium">Błąd:</p>
                <p>{error}</p>
              </div>
            )}

            {/* Wyniki */}
            {results && <ResultsDisplay results={results} />}

            {/* Placeholder gdy brak wyników */}
            {!results && !error && (
              <div className="bg-white rounded-xl shadow p-8 text-center">
                <div className="text-5xl mb-4">📊</div>
                <h3 className="text-lg font-medium mb-2">Oczekiwanie na dane</h3>
                <p className="text-gray-500">
                  Po wrzuceniu plików i kliknięciu przycisku, tutaj pojawi się raport weryfikacji
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer z informacjami */}
        <footer className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-500">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <p><strong>FV</strong> = numer faktury z IdoSell (np. FV/1/PL/2505)</p>
              <p><strong>ST</strong> = numer systemowy z Enova (np. ST/1234)</p>
            </div>
            <div className="mt-4 md:mt-0">
              <p>InvoiceGap v1.0 • Next.js + TypeScript</p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}