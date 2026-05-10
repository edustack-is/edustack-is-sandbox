import { useState, useEffect } from 'react';
import { getHealth, getInitStatus } from '../api';
import { Card, CardContent } from './ui/card';
import { Loader2 } from 'lucide-react';

interface BootScreenProps {
    onReady: (initialized: boolean) => void;
}

/**
 * BootScreen handles the initial application loading sequence.
 * It waits for the backend service to be alive and then checks the system initialization status.
 * This is crucial for handling slow backend starts or cold starts in serverless environments.
 */
export const BootScreen = ({ onReady }: BootScreenProps) => {
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('Starting application...');

    useEffect(() => {
        let isMounted = true;
        let retryCount = 0;

        const checkReadiness = async () => {
            try {
                // First check if backend is even alive
                const health = await getHealth();

                // If health check reports degraded database, we still wait
                if (health.status !== 'ok') {
                    throw new Error('Backend is degraded');
                }

                if (retryCount < 5 && isMounted) {
                    setStatus('Backend online, checking system status...');
                    setProgress(50);
                }

                // If alive, check initialization status
                const res = await getInitStatus();

                if (isMounted) {
                    setProgress(100);
                    setStatus('System ready!');
                    // Small delay to show 100%
                    setTimeout(() => {
                        if (isMounted) onReady(res.initialized);
                    }, 500);
                }
            } catch (err) {
                if (isMounted) {
                    retryCount++;
                    // Cap progress at 45% during retries
                    const nextProgress = Math.min(retryCount * 5, 45);
                    setProgress(nextProgress);
                    setStatus(`Waiting for backend service (attempt ${retryCount})...`);
                    // Poll every 1.5 seconds
                    setTimeout(checkReadiness, 1500);
                }
            }
        };

        checkReadiness();

        return () => {
            isMounted = false;
        };
    }, [onReady]);

    return (
        <div
            className="flex items-center justify-center min-h-screen bg-slate-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="boot-title"
        >
            <Card className="w-full max-w-md shadow-lg border-none">
                <CardContent className="pt-10 pb-8 flex flex-col items-center gap-6">
                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-indigo-200 shadow-xl mb-2">
                        <Loader2 className="w-8 h-8 text-white animate-spin" aria-hidden="true" />
                    </div>

                    <div className="text-center space-y-2">
                        <h1 id="boot-title" className="text-2xl font-bold text-slate-900 tracking-tight">
                            EduStack IS
                        </h1>
                        <p className="text-sm text-slate-500 font-medium" role="status" aria-live="polite">
                            {status}
                        </p>
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
