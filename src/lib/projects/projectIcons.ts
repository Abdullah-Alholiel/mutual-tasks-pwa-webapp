import {
    Target, Rocket, Zap, Star, Flag,
    Briefcase, Presentation, Building2, Laptop,
    Coffee, Dumbbell, Plane, Music, Book, Home,
    Users, Heart, Smile, PartyPopper,
    GraduationCap, Microscope,
    PiggyBank, CreditCard,
    Palette, Camera, Gamepad2, Gift,
    Globe, Layout, Smartphone, Code
} from 'lucide-react';

export const PROJECT_ICONS = [
    { name: 'Target', icon: Target, category: 'Goals' },
    { name: 'Rocket', icon: Rocket, category: 'Goals' },
    { name: 'Zap', icon: Zap, category: 'Goals' },
    { name: 'Star', icon: Star, category: 'Goals' },
    { name: 'Flag', icon: Flag, category: 'Goals' },

    { name: 'Briefcase', icon: Briefcase, category: 'Work' },
    { name: 'Presentation', icon: Presentation, category: 'Work' },
    { name: 'Building2', icon: Building2, category: 'Work' },
    { name: 'Laptop', icon: Laptop, category: 'Work' },
    { name: 'Code', icon: Code, category: 'Work' },

    { name: 'Dumbbell', icon: Dumbbell, category: 'Lifestyle' },
    { name: 'Coffee', icon: Coffee, category: 'Lifestyle' },
    { name: 'Book', icon: Book, category: 'Lifestyle' },
    { name: 'Music', icon: Music, category: 'Lifestyle' },
    { name: 'Home', icon: Home, category: 'Lifestyle' },
    { name: 'Plane', icon: Plane, category: 'Lifestyle' },

    { name: 'Users', icon: Users, category: 'Social' },
    { name: 'Heart', icon: Heart, category: 'Social' },
    { name: 'Smile', icon: Smile, category: 'Social' },
    { name: 'PartyPopper', icon: PartyPopper, category: 'Social' },

    { name: 'PiggyBank', icon: PiggyBank, category: 'Finance' },
    { name: 'CreditCard', icon: CreditCard, category: 'Finance' },

    { name: 'GraduationCap', icon: GraduationCap, category: 'Education' },

    { name: 'Palette', icon: Palette, category: 'Creative' },
    { name: 'Camera', icon: Camera, category: 'Creative' },
    { name: 'Gamepad2', icon: Gamepad2, category: 'Fun' },
    { name: 'Gift', icon: Gift, category: 'Fun' },
];

export const getIconByName = (name: string) => {
    return PROJECT_ICONS.find(item => item.name === name)?.icon || Target;
};

// Get unique categories from PROJECT_ICONS
export const ICON_CATEGORIES = ['All', ...new Set(PROJECT_ICONS.map(icon => icon.category))];

// Get icons filtered by category
export const getIconsByCategory = (category: string) => {
    if (category === 'All') return PROJECT_ICONS;
    return PROJECT_ICONS.filter(icon => icon.category === category);
};
