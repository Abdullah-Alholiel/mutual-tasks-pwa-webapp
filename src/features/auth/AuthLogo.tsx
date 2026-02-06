import { motion } from 'framer-motion';

export const AuthLogo = () => (
    <motion.div
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
        className="inline-flex items-center justify-center mb-6 relative z-10 group"
    >
        {/* Ambient Glow */}
        <div className="absolute -inset-6 bg-primary/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        {/* Shadow for 3D Lift */}
        <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-[80%] h-6 bg-primary/30 blur-xl opacity-60 rounded-[100%]" />

        {/* Logo Container */}
        <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-[1.8rem] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.25)] bg-background overflow-hidden transform-gpu">
            <img
                src="/icons/icon-192x192.png"
                alt="Momentum"
                className="w-full h-full object-cover"
            />

            {/* 3D Lighting Effects */}
            <div className="absolute inset-0 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)] pointer-events-none rounded-[1.8rem]" />
            <div className="absolute inset-0 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.1)] pointer-events-none rounded-[1.8rem]" />

            {/* Subtle sheen */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
        </div>
    </motion.div>
);
