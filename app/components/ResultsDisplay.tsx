import React from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { ProcessingResponse } from '../types';

interface ResultsDisplayProps {
  results: ProcessingResponse | null;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results }) => {
  if (!results) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <p className="text-gray-500 text-center">Wyniki pojawią się tutaj po przetworzeniu plików</p>
      </div>
    );
  }

  const { summary, correctPairsPreview, correctPairsCount, errorsPreview, errorsCount, warningsPreview, warningsCount } = results;

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-6">
      {/* Podsumowanie */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Dokumenty ST</p>
          <p className="text-2xl font-bold text-blue-600">{summary.totalST}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Faktury FV (PDF)</p>
          <p className="text-2xl font-bold text-purple-600">{summary.totalFVInPDF}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Prawidłowe pary</p>
          <p className="text-2xl font-bold text-green-600">{summary.matchedPairs}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Błędy</p>
          <p className="text-2xl font-bold text-red-600">{summary.errorCount}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Ostrzeżenia</p>
          <p className="text-2xl font-bold text-yellow-600">{summary.warningCount}</p>
        </div>
      </div>

      {/* Prawidłowe pary */}
      {correctPairsCount > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center text-green-700">
            <CheckCircleIcon className="w-6 h-6 mr-2" />
            Prawidłowe pary ST ↔ FV ({correctPairsCount})
          </h3>
          <div className="bg-green-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            <div className="space-y-2">
              {correctPairsPreview.map((pair, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 font-medium">{pair.st}</span>
                  <span className="text-gray-500 mx-2">→</span>
                  <span className="text-gray-700">{pair.fv}</span>
                </div>
              ))}
              {correctPairsCount > correctPairsPreview.length && (
                <p className="text-sm text-gray-600 pt-2">... i {correctPairsCount - correctPairsPreview.length} więcej</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Błędy */}
      {errorsCount > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center text-red-700">
            <XCircleIcon className="w-6 h-6 mr-2" />
            Błędy ({errorsCount})
          </h3>
          <div className="bg-red-50 rounded-lg p-4 max-h-64 overflow-y-auto space-y-3">
            {errorsPreview.map((error, idx) => (
              <div key={idx} className="pb-3 border-b border-red-200 last:border-b-0">
                <p className="text-sm font-medium text-red-700">{error.message}</p>
              </div>
            ))}
            {errorsCount > errorsPreview.length && (
              <p className="text-sm text-gray-600 pt-2">... i {errorsCount - errorsPreview.length} więcej błędów</p>
            )}
          </div>
        </div>
      )}

      {/* Ostrzeżenia */}
      {warningsCount > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center text-yellow-700">
            <ExclamationCircleIcon className="w-6 h-6 mr-2" />
            Ostrzeżenia ({warningsCount})
          </h3>
          <div className="bg-yellow-50 rounded-lg p-4 max-h-64 overflow-y-auto space-y-3">
            {warningsPreview.map((warning, idx) => (
              <div key={idx} className="pb-3 border-b border-yellow-200 last:border-b-0">
                <p className="text-sm font-medium text-yellow-700">{warning.message}</p>
              </div>
            ))}
            {warningsCount > warningsPreview.length && (
              <p className="text-sm text-gray-600 pt-2">... i {warningsCount - warningsPreview.length} więcej ostrzeżeń</p>
            )}
          </div>
        </div>
      )}

      {/* Status */}
      <div className={`rounded-lg p-4 ${summary.errorCount === 0 ? 'bg-green-50' : 'bg-yellow-50'}`}>
        <p className={`text-sm font-medium ${summary.errorCount === 0 ? 'text-green-700' : 'text-yellow-700'}`}>
          {summary.errorCount === 0
            ? `✓ Wszystkie dokumenty są prawidłowe (${summary.matchedPairs}/${summary.totalST} par)`
            : `⚠ Znaleziono ${summary.errorCount} błędy wymagające uwagi`}
        </p>
      </div>
    </div>
  );
};

export default ResultsDisplay;