import { motion } from 'framer-motion';
import { ISLAND_CONTENT_VARIANTS } from '@/components/island/animations';
import { type MusicShape } from './musicCapsuleShapes';

interface SlotProps {
  shape: MusicShape;
  children: React.ReactNode;
}

export function Slot({ shape, children }: SlotProps): React.JSX.Element {
  return (
    <motion.div
      variants={ISLAND_CONTENT_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="h-full w-full"
      style={{
        paddingInline: shape.paddingX,
        paddingBlock: shape.paddingY,
      }}
    >
      {children}
    </motion.div>
  );
}
