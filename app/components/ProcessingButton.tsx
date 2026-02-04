import React, { useState } from 'react';
import { ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

interface ProcessingButtonProps {
  isProcessing: boolean;
  onClick: () => void;
  hasFiles: boolean;
  error?: string;
}

const ProcessingButton: React.FC<ProcessingButtonProps> = ({
  isProcessing,
  onClick,
  hasFiles,
  error,
}) => {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <button
        onClick={onClick}
        disabled={!hasFiles || isProcessing}
        className={`
          w-full py-4 px-6 rounded-lg font-semibold text-lg
          flex items-center justify-center space-x-3
          transition-all duration-200
          ${!hasFiles 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : isProcessing
            ? 'bg-blue-100 text-blue-700'
            : 'bg-blue-600 text-white hover:bg-blue-700'
          }
        `}
      >
        {isProcessing ? (
          <>
            <ArrowPathIcon className="w-6 h-6 animate-spin" />
            <span>Przetwarzanie...</span>
          </>
        ) : (
          <>
            <CheckCircleIcon className="w-6 h-6" />
            <span>Rozpocznij weryfikację</span>
          </>
        )}
      </button>
      
      {error && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-start space-x-2">
          <ExclamationCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      
      {!hasFiles && !error && (
        <p className="text-sm text-gray-500 mt-3 text-center">
          Dodaj pliki PDF i plik z Enova aby rozpocząć
        </p>
      )}
      
      {hasFiles && !isProcessing && !error && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-green-700 text-center">
            ✓ Gotowe do weryfikacji. System sprawdzi czy wszystkie FV mają odpowiadające ST.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProcessingButton;