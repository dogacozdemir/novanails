"use client";

import { LazyMotion, domMax, m } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * LazyMotion + domMax: tam `motion` yüzeyinden daha küçük çalışma zamanı maliyeti.
 */
export function PageTransition({ children }: Props) {
  return (
    <LazyMotion features={domMax} strict>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
        style={{ willChange: "opacity" }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
