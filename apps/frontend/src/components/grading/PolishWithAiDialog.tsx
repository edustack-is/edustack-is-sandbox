import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { polishVerbalEvaluation, PolishVariant } from '@/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * AI polish flow. The teacher's original text is never overwritten in
 * the underlying form — this dialog only shows the AI's variants
 * side-by-side and reports back the one the teacher accepts via
 * `onAccept`. Closing without accepting leaves the original text
 * intact. Variants are not persisted server-side; only the accepted
 * text becomes part of the report-card save.
 */
export interface PolishWithAiDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    originalText: string;
    studentName: string;
    subjectName: string;
    onAccept: (chosen: string) => void;
}

export function PolishWithAiDialog({
    open,
    onOpenChange,
    originalText,
    studentName,
    subjectName,
    onAccept,
}: PolishWithAiDialogProps) {
    const { t } = useTranslation();
    const [variants, setVariants] = useState<PolishVariant[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState('');

    const fetchVariants = async (fb?: string) => {
        if (!originalText.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const result = await polishVerbalEvaluation({
                text: originalText,
                studentName,
                subjectName,
                feedback: fb?.trim() ? fb.trim() : undefined,
            });
            setVariants(Array.isArray(result.variants) ? result.variants : []);
        } catch (e: any) {
            setError(e?.response?.data?.message || t('report_cards.ai_unavailable'));
            setVariants([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch the first set of variants whenever the dialog is opened
    // with non-empty text. Reset state when closed.
    useEffect(() => {
        if (open) {
            setFeedback('');
            fetchVariants();
        } else {
            setVariants([]);
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, originalText]);

    const handleRegenerate = () => {
        fetchVariants(feedback);
    };

    const handleAccept = (text: string) => {
        onAccept(text);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-violet-500" />
                        {t('polish_dialog.title', 'AI návrhy slovního hodnocení')}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            'polish_dialog.description',
                            'Vyberte návrh, který nejlépe odpovídá, nebo upřesněte pokyn a vygenerujte nové varianty. Vaše původní hodnocení zůstává nezměněné, dokud nějaký návrh nepřevezmete.',
                        )}
                    </DialogDescription>
                </DialogHeader>

                {/* Original text (read-only reminder) */}
                <div className="rounded-md border bg-muted/30 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        {t('polish_dialog.original', 'Váš původní text')}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{originalText}</p>
                </div>

                {/* Variants */}
                {loading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        {t('polish_dialog.generating', 'Generuji návrhy…')}
                    </div>
                ) : error ? (
                    <div className="text-sm text-destructive py-4">{error}</div>
                ) : (
                    <div className="space-y-3">
                        {variants.map((v) => (
                            <div key={v.id} className="rounded-md border p-3 hover:border-primary/40 transition-colors">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div>
                                        <div className="font-semibold text-sm">{v.label}</div>
                                        <div className="text-xs text-muted-foreground">{v.tone}</div>
                                    </div>
                                    <Button size="sm" onClick={() => handleAccept(v.text)}>
                                        <Check className="h-3.5 w-3.5 mr-1" />
                                        {t('polish_dialog.use_this', 'Použít tento návrh')}
                                    </Button>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{v.text}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Feedback + regenerate */}
                <div className="border-t pt-4 space-y-2">
                    <label className="text-sm font-medium" htmlFor="polish-feedback">
                        {t('polish_dialog.feedback_label', 'Zpětná vazba pro AI (volitelné)')}
                    </label>
                    <Textarea
                        id="polish-feedback"
                        rows={2}
                        placeholder={t(
                            'polish_dialog.feedback_placeholder',
                            'např. Zaměř se více na pokrok studenta. Buď stručnější.',
                        )}
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleRegenerate} disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                    {t('polish_dialog.generating', 'Generuji návrhy…')}
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                                    {t('polish_dialog.regenerate', 'Vygenerovat znovu')}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
