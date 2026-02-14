import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Languages } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
    const { i18n } = useTranslation();

    const handleLanguageChange = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <div className="flex items-center space-x-2">
            <Languages size={16} className="text-muted-foreground" />
            <Select value={i18n.language.split('-')[0]} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-[80px] h-8 text-xs">
                    <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="cs">CS</SelectItem>
                    <SelectItem value="en">EN</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
};
