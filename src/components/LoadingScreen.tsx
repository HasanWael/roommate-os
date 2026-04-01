import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';

export default function LoadingScreen({ message }: { message?: string }) {
  const { t } = useTranslation();
  const displayMessage = message || t('common.loading');

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background overflow-hidden"
      >
        {/* Background decorative elements */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.05, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute h-[500px] w-[500px] rounded-full bg-primary blur-[100px]"
      />
      
      <div className="relative flex flex-col items-center">
        {/* App Icon/Logo Placeholder */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-8"
        >
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-2xl shadow-primary/30 transform rotate-12">
            <motion.div
              animate={{ rotate: -12 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="h-12 w-12 text-white"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </motion.div>
          </div>
        </motion.div>

        {/* App Name */}
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-4xl font-black text-text-primary tracking-tighter mb-2"
        >
          {t('app.name')}
        </motion.h1>

        {/* Loading Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <div className="flex gap-1.5 mb-4">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{ 
                  duration: 1, 
                  repeat: Infinity, 
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
                className="h-2 w-2 rounded-full bg-primary"
              />
            ))}
          </div>
          <p className="text-sm font-bold text-text-secondary uppercase tracking-[0.2em] animate-pulse">
            {displayMessage}
          </p>
        </motion.div>
      </div>

      {/* Version Tag */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-12 text-[10px] font-bold text-text-secondary uppercase tracking-widest"
      >
        Version 1.0.0
      </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
