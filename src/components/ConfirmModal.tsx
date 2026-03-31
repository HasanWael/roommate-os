import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning';
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  type = 'danger'
}: ConfirmModalProps) {
  const { t } = useTranslation();

  const finalConfirmText = confirmText || t('common.delete');
  const finalCancelText = cancelText || t('common.cancel');

  const isWarning = type === 'warning';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 w-full h-full bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl relative z-10"
          >
            <div className="p-8 text-center">
              <div className={`w-20 h-20 ${isWarning ? 'bg-amber-50' : 'bg-red-50'} rounded-full flex items-center justify-center mx-auto mb-6`}>
                <AlertTriangle className={`w-10 h-10 ${isWarning ? 'text-amber-500' : 'text-red-500'}`} />
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-3">{title}</h2>
              <p className="text-text-secondary mb-8 leading-relaxed">{message}</p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-4 px-6 bg-gray-100 hover:bg-gray-200 text-text-primary font-bold rounded-2xl transition-all active:scale-95"
                >
                  {finalCancelText}
                </button>
                <button
                  onClick={onConfirm}
                  className={`flex-1 py-4 px-6 ${isWarning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-500 hover:bg-red-600'} text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95`}
                >
                  {finalConfirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
