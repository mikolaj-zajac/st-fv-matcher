import React from 'react';
import { UploadedFile } from '../types';
import { XMarkIcon, DocumentIcon, TableCellsIcon } from '@heroicons/react/24/outline';

interface FileListProps {
  pdfFiles: UploadedFile[];
  enovaFile: UploadedFile | null;
  onRemovePdf: (index: number) => void;
  onRemoveEnova: () => void;
  onClearAll: () => void;
}

const FileList: React.FC<FileListProps> = ({
  pdfFiles,
  enovaFile,
  onRemovePdf,
  onRemoveEnova,
  onClearAll,
}) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Załadowane pliki</h2>
        {(pdfFiles.length > 0 || enovaFile) && (
          <button
            onClick={onClearAll}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Wyczyść wszystkie
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Pliki PDF */}
        <div>
          <h3 className="font-medium text-gray-700 mb-2 flex items-center">
            <DocumentIcon className="w-5 h-5 mr-2" />
            Pliki PDF z fakturami ({pdfFiles.length})
          </h3>
          {pdfFiles.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Brak plików PDF</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {pdfFiles.map((file, index) => (
                <div
                  key={`${file.file.name}-${index}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <div className="flex items-center min-w-0">
                    <DocumentIcon className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{file.file.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.file.size)} • {file.status}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemovePdf(index)}
                    className="text-gray-400 hover:text-red-500 p-1"
                    title="Usuń plik"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plik Enova */}
        <div>
          <h3 className="font-medium text-gray-700 mb-2 flex items-center">
            <TableCellsIcon className="w-5 h-5 mr-2" />
            Plik z Enova
          </h3>
          {!enovaFile ? (
            <p className="text-sm text-gray-500 italic">Brak pliku z Enova</p>
          ) : (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center min-w-0">
                <TableCellsIcon className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{enovaFile.file.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(enovaFile.file.size)} • {enovaFile.status}
                  </p>
                </div>
              </div>
              <button
                onClick={onRemoveEnova}
                className="text-gray-400 hover:text-red-500 p-1"
                title="Usuń plik"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Podsumowanie */}
        <div className="pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="font-medium">{pdfFiles.length}</p>
              <p className="text-gray-600">Plików PDF</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="font-medium">{enovaFile ? '1' : '0'}</p>
              <p className="text-gray-600">Plik Enova</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileList;