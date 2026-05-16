import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Check, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { polishVerbalEvaluation, translateVerbalEvaluation, PolishVariant } from '@/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface PolishWithAiDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    originalText: string;
    studentName: string;
    subjectName: string;
    onAccept: (chosen: string) => void;
}

/**
 * Map an i18next language tag ("cs", "en", "cs-CZ", "en-US"…) to the
 * compact 2-letter code the backend expects.
 */
function normaliseLang(lang: string): 'cs' | 'en' {
    return lang?.toLowerCase().startsWith('en') ? 'en' : 'cs';
}

/**
 * Coarse language detection used solely to surface the "Translate"
 * button when the model ignored the language instruction. A handful
 * of Czech-only diacritics is enough — false positives merely hide a
 * useful button, never break anything.
 */
function detectLang(text: string): 'cs' | 'en' {
    return /[ěščřžýáíéůúďťň]/i.test(text) ? 'cs' : 'en';
}

interface VariantState extends PolishVariant {
    /** Translation status per-variant. */
    translating: boolean;
    /** If the user translated, we keep the original to allow toggling back. */
    untranslated?: string;
}

export function PolishWithAiDialog({
    open,
    onOpenChange,
    originalText,
    studentName,
    subjectName,
    onAccept,
}: PolishWithAiDialogProps) {
    const { t, i18n } = useTranslation();
    const uiLang = normaliseLang(i18n.language || 'cs');

    const [variants, setVariants] = useState<VariantState[]>([]);
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
                language: uiLang,
            });
            setVariants(
                (result.variants || []).map((v) => ({
                    ...v,
                    translating: false,
                })),
            );
        } catch (e: any) {
            setError(e?.response?.data?.message || t('report_cards.ai_unavailable'));
            setVariants([]);
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch on open; reset when closed.
    useEffect(() => {
        if (open) {
            setFeedback('');
            fetchVariants();
        } else {
            setVariants([]);
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, originalText, uiLang]);

    const handleRegenerate = () => fetchVariants(feedback);

    const handleAccept = (text: string) => {
        onAccept(text);
        onOpenChange(false);
    };

    const handleTranslate = async (variant: VariantState, idx: number) => {
        const target = uiLang;
        setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, translating: true } : v)));
        try {
            const result = await translateVerbalEvaluation({
                text: variant.text,
                targetLanguage: target,
            });
            setVariants((prev) =>
                prev.map((v, i) =>
                    i === idx
                        ? {
                              ...v,
                              text: result.text,
                              translating: false,
                              untranslated: v.untranslated ?? variant.text,
                          }
                        : v,
                ),
            );
        } catch {
            setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, translating: false } : v)));
        }
    };

    const translateLabel = uiLang === 'cs' ? t('polish_dialog.translate_to_cs') : t('polish_dialog.translate_to_en');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-violet-500" />
                        {t('polish_dialog.title')}
                    </DialogTitle>
                    <DialogDescription>{t('polish_dialog.description')}</DialogDescription>
                </DialogHeader>

                {/* Original text (read-only reminder) */}
                <div className="rounded-md border bg-muted/30 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        {t('polish_dialog.original')}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{originalText}</p>
                </div>

                {/* Variants */}
                {loading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        {t('polish_dialog.generating')}
                    </div>
                ) : error ? (
                    <div className="text-sm text-destructive py-4">{error}</div>
                ) : (
                    <div className="space-y-3">
                        {variants.map((v, idx) => {
                            const detected = detectLang(v.text);
                            const mismatched = detected !== uiLang;
                            return (
                                <div
                                    key={v.id}
                                    className="rounded-md border p-3 hover:border-primary/40 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div>
                                            <div className="font-semibold text-sm">{v.label}</div>
                                            <div className="text-xs text-muted-foreground">{v.tone}</div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {mismatched && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleTranslate(v, idx)}
                                                    disabled={v.translating}
                                                    title={t('polish_dialog.language_mismatch')}
                                                >
                                                    {v.translating ? (
                                                        <>
                                                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                                            {t('polish_dialog.translating')}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Languages className="h-3.5 w-3.5 mr-1" />
                                                            {translateLabel}
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                            <Button size="sm" onClick={() => handleAccept(v.text)}>
                                                <Check className="h-3.5 w-3.5 mr-1" />
                                                {t('polish_dialog.use_this')}
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{v.text}</p>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Feedback + regenerate */}
                <div className="border-t pt-4 space-y-2">
                    <label className="text-sm font-medium" htmlFor="polish-feedback">
                        {t('polish_dialog.feedback_label')}
                    </label>
                    <Textarea
                        id="polish-feedback"
                        rows={2}
                        placeholder={t('polish_dialog.feedback_placeholder')}
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
                                    {t('polish_dialog.generating')}
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                                    {t('polish_dialog.regenerate')}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
