import { motion } from 'framer-motion';

/**
 * Momentum sign-in mark (D-046): no tile, no background plate — the brand
 * artwork sits directly on the auth screen in both themes. The transparent
 * assets are mechanically derived from the brand icon
 * (scripts/derive-transparent-logo.py); the dark variant recolors the
 * near-black wordmark/outlines light so the mark stays readable on the dark
 * sign-in background (darkMode: "class" — .dark on the root).
 */
export const AuthLogo = () => (
    <motion.div
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
        className="inline-flex items-center justify-center mb-6 relative z-10"
    >
        <img
            src="/icons/icon-transparent-512.png"
            alt=""
            aria-hidden="true"
            className="w-40 h-40 md:w-48 md:h-48 dark:hidden"
        />
        <img
            src="/icons/icon-transparent-dark-512.png"
            alt=""
            aria-hidden="true"
            className="w-40 h-40 md:w-48 md:h-48 hidden dark:block"
        />
    </motion.div>
);
