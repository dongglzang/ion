import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';

interface FloatingActionButtonProps {
  onClick: () => void;
}

export function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  return (
    <motion.button
    className="fixed bottom-6 right-4 sm:right-5 w-14 h-14 bg-accent hover:bg-accent/90 text-accent-foreground rounded-full flex items-center justify-center shadow-ds-lg hover:shadow-ds-xl transition-all duration-200 z-[380] touch-target"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
    >
      <Plus className="w-6 h-6" />
    </motion.button>
  );
}
