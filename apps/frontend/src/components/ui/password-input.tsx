import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";
import { validatePassword, getStrengthColor, getStrengthLabel } from "../../lib/password-utils";

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    showStrength?: boolean;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
    ({ className, showStrength = true, value, onChange, ...props }, ref) => {
        const [showPassword, setShowPassword] = React.useState(false);
        const password = typeof value === 'string' ? value : '';
        const { strength } = validatePassword(password);

        const togglePasswordVisibility = () => {
            setShowPassword(!showPassword);
        };

        return (
            <div className="space-y-2">
                <div className="relative">
                    <Input
                        type={showPassword ? "text" : "password"}
                        className={`pr-10 ${className}`}
                        value={value}
                        onChange={onChange}
                        ref={ref}
                        maxLength={72}
                        {...props}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={togglePasswordVisibility}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                    </Button>
                </div>

                {showStrength && password.length > 0 && (
                    <div className="space-y-1">
                        <div className="flex h-1 gap-1">
                            {[1, 2, 3, 4].map((step) => (
                                <div
                                    key={step}
                                    className={`h-full flex-1 rounded-full transition-colors ${step <= strength ? getStrengthColor(strength) : "bg-gray-200"
                                        }`}
                                />
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground text-right">
                            {getStrengthLabel(strength)}
                        </p>
                    </div>
                )}
            </div>
        );
    }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
