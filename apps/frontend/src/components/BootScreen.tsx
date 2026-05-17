import { Card, CardContent } from './ui/card';
import { Loader2 } from 'lucide-react';

interface BootScreenProps {
    progress: number;
    status: string;
    lastError: string | null;
}

/**
 * Pure presentational boot screen — the readiness probing happens in App.tsx
 * so the network calls and retry timer aren't tied to this component's
 * lifecycle. Mounting/remounting this view (e.g. from a parent re-render)
 * therefore never duplicates the /health and /init/status requests.
 */
export const BootScreen = ({ progress, status, lastError }: BootScreenProps) => {
    return (
        <div
            className="flex items-center justify-center min-h-screen bg-slate-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="boot-title"
        >
            <Card className="w-full max-w-md shadow-lg border-none">
                <CardContent className="pt-10 pb-8 flex flex-col items-center gap-6">
                    <img
                        src="/edustack-logo.png"
                        alt=""
                        aria-hidden="true"
                        className="h-32 w-auto mb-1 drop-shadow-lg"
                    />
                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" aria-hidden="true" />

                    <div className="text-center space-y-2">
                        <h1 id="boot-title" className="text-2xl font-bold text-slate-900 tracking-tight">
                            EduStack IS
                        </h1>
                        <p className="text-sm text-slate-500 font-medium" role="status" aria-live="polite">
                            {status}
                        </p>
                        {lastError && (
                            <p className="text-[10px] text-red-400 font-mono mt-1 max-w-[250px] truncate">
                                Error: {lastError}
                            </p>
                        )}
                    </div>

                    <div className="w-full space-y-2">
                        <div
                            className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"
                            role="progressbar"
                            aria-valuenow={progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Application loading progress"
                        >
                            <div
                                className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div
                            className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-slate-400"
                            aria-hidden="true"
                        >
                            <span>Initializing</span>
                            <span>{progress}%</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
