import React from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { ValidationResult } from '../types';

interface ResultsDisplayProps {
  results: ValidationResult | null;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results }) => {
  if (!results) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <p className="text-gray-500 text-center">Wyniki pojawią się tutaj po przetworzeniu plików</p>
      </div>
    );
  }

  const { summary, correctPairs, errors, warnings } = results;

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
      {correctPairs.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center text-green-700">
            <CheckCircleIcon className="w-6 h-6 mr-2" />
            Prawidłowe pary ST ↔ FV ({correctPairs.length})
          </h3>
          <div className="bg-green-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            <div className="space-y-2">
              {correctPairs.slice(0, 10).map((pair, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 font-medium">{pair.st}</span>
                  <span className="text-gray-500 mx-2">→</span>
                  <span className="text-gray-700">{pair.fv}</span>
                </div>
              ))}
              {correctPairs.length > 10 && (
                <p className="text-sm text-gray-600 pt-2">... i {correctPairs.length - 10} więcej</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Błędy */}
      {errors.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center text-red-700">
            <XCircleIcon className="w-6 h-6 mr-2" />
            Błędy ({errors.length})
          </h3>
          <div className="bg-red-50 rounded-lg p-4 max-h-64 overflow-y-auto space-y-3">
            {errors.slice(0, 10).map((error, idx) => (
              <div key={idx} className="pb-3 border-b border-red-200 last:border-b-0">
                <p className="text-sm font-medium text-red-700">{error.message}</p>
                {error.data.numerST && (
                  <p className="text-xs text-red-600 mt-1">ST: {error.data.numerST}</p>
                )}
                {error.data.numerFV && (
                  <p className="text-xs text-red-600">FV: {error.data.numerFV}</p>
                )}
              </div>
            ))}
            {errors.length > 10 && (
              <p className="text-sm text-gray-600 pt-2">... i {errors.length - 10} więcej błędów</p>
            )}
          </div>
        </div>
      )}

      {/* Ostrzeżenia */}
      {warnings.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center text-yellow-700">
            <ExclamationCircleIcon className="w-6 h-6 mr-2" />
            Ostrzeżenia ({warnings.length})
          </h3>
          <div className="bg-yellow-50 rounded-lg p-4 max-h-64 overflow-y-auto space-y-3">
            {warnings.slice(0, 10).map((warning, idx) => (
              <div key={idx} className="pb-3 border-b border-yellow-200 last:border-b-0">
                <p className="text-sm font-medium text-yellow-700">{warning.message}</p>
                {warning.data.numerFV && (
                  <p className="text-xs text-yellow-600 mt-1">FV: {warning.data.numerFV}</p>
                )}
              </div>
            ))}
            {warnings.length > 10 && (
              <p className="text-sm text-gray-600 pt-2">... i {warnings.length - 10} więcej ostrzeżeń</p>
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