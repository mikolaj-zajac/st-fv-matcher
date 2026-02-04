'use client';

import { useState, useCallback } from 'react';
import { zipSync } from 'fflate';
import { upload } from '@vercel/blob/client';
import { useDropzone } from 'react-dropzone';
import FileList from './components/FileList';
import ProcessingButton from './components/ProcessingButton';
import ResultsDisplay from './components/ResultsDisplay';
import type { ProcessingResponse, UploadedFile } from './types';

export default function Home() {
  const [pdfFiles, setPdfFiles] = useState<UploadedFile[]>([]);
  const [enovaFile, setEnovaFile] = useState<UploadedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [compressUploads, setCompressUploads] = useState(true);
  const [directUpload, setDirectUpload] = useState(true);
  const [results, setResults] = useState<ProcessingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    
    acceptedFiles.forEach((file) => {
      // Sprawdź rozmiar pliku
      const maxXLSXSize = directUpload ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 50MB / 10MB
      const maxPDFSize = directUpload ? 100 * 1024 * 1024 : 15 * 1024 * 1024; // 100MB / 15MB
      
      // Sprawdź typ pliku
      if (file.type === 'application/pdf') {
        // PDF - faktury z IdoSell
        if (file.size > maxPDFSize) {
          setError(`Plik PDF "${file.name}" jest za duży (${(file.size / 1024 / 1024).toFixed(2)}MB). Maksymalnie ${(maxPDFSize / 1024 / 1024).toFixed(0)}MB.`);
          return;
        }
        
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
        if (file.size > maxXLSXSize) {
          setError(`Plik XLSX "${file.name}" jest za duży (${(file.size / 1024 / 1024).toFixed(2)}MB). Maksymalnie ${(maxXLSXSize / 1024 / 1024).toFixed(0)}MB.`);
          return;
        }
        
        setEnovaFile({
          file,
          type: 'enova',
          status: 'pending'
        });
      } else {
        setError(`Nieobsługiwany format pliku: ${file.name}`);
      }
    });
  }, [directUpload]);

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

    // Sprawdzenie całkowitego rozmiaru (limit Vercela ~10MB)
    if (!directUpload) {
      const totalSize = enovaFile.file.size + pdfFiles.reduce((sum, f) => sum + f.file.size, 0);
      const maxTotalSize = 20 * 1024 * 1024; // 20MB
      
      if (totalSize > maxTotalSize) {
        setError(`Całkowity rozmiar plików (${(totalSize / 1024 / 1024).toFixed(2)}MB) przekracza limit 20MB. Spróbuj z mniejszą ilością plików PDF.`);
        return;
      }
    }

    setIsProcessing(true);
    setError(null);

    try {
      if (directUpload) {
        const xlsxUpload = await upload(
          `uploads/${Date.now()}-${enovaFile.file.name}`,
          enovaFile.file,
          {
            access: 'public',
            contentType: enovaFile.file.type,
            handleUploadUrl: '/api/blob/upload',
            multipart: true,
          }
        );

        const pdfUploads = await Promise.all(
          pdfFiles.map((pdf) =>
            upload(`uploads/${Date.now()}-${pdf.file.name}`, pdf.file, {
              access: 'public',
              contentType: pdf.file.type,
              handleUploadUrl: '/api/blob/upload',
              multipart: true,
            })
          )
        );

        const response = await fetch('/api/process', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            xlsxUrl: xlsxUpload.url,
            pdfUrls: pdfUploads.map((p) => p.url),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Błąd serwera: ${response.status}`);
        }

        setResults(data.data);
      } else {
        const formData = new FormData();
        if (compressUploads) {
          const zipEntries: Record<string, Uint8Array> = {};
          const xlsxData = new Uint8Array(await enovaFile.file.arrayBuffer());
          zipEntries[`xlsx/${enovaFile.file.name}`] = xlsxData;

          for (const pdf of pdfFiles) {
            const pdfData = new Uint8Array(await pdf.file.arrayBuffer());
            zipEntries[`pdfs/${pdf.file.name}`] = pdfData;
          }

          const zipped = zipSync(zipEntries, { level: 6 });
          const zippedBuffer = zipped.buffer.slice(
            zipped.byteOffset,
            zipped.byteOffset + zipped.byteLength
          ) as ArrayBuffer;
          const zipBlob = new Blob([zippedBuffer], { type: 'application/zip' });
          const zipFile = new File([zipBlob], 'upload.zip', { type: 'application/zip' });
          formData.append('bundle', zipFile);
        } else {
          pdfFiles.forEach((file) => {
            formData.append('pdfs', file.file);
          });
          formData.append('xlsx', enovaFile.file);
        }

        const response = await fetch('/api/process', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Błąd serwera: ${response.status}`);
        }

        setResults(data.data);
      }

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
            {/* Ustawienia wysyłki */}
            <div className="bg-white rounded-xl shadow p-4 space-y-3">
              <label className="flex items-center gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={directUpload}
                  onChange={(e) => {
                    setDirectUpload(e.target.checked);
                    if (e.target.checked) {
                      setCompressUploads(false);
                    }
                  }}
                />
                Bezpośredni upload do storage (omija limit Vercela)
              </label>
              <p className="text-xs text-gray-500">
                Wymaga skonfigurowanego BLOB_READ_WRITE_TOKEN na Vercelu.
              </p>

              <label className="flex items-center gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={compressUploads}
                  onChange={(e) => setCompressUploads(e.target.checked)}
                  disabled={directUpload}
                />
                Kompresuj pliki przed wysłaniem (ZIP)
              </label>
              <p className="text-xs text-gray-500">
                ZIP zwykle zmniejsza payload, ale przy PDF oszczędność może być niewielka.
              </p>
            </div>

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