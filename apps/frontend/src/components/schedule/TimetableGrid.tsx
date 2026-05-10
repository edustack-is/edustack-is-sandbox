import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ─── Types ──────────────────────────────────────────────────

export interface ScheduleEventData {
    id: string;
    dayOfWeek: number; // 1=Mon..5=Fri
    lessonNumber: number; // 1-10
    startTime: string;
    endTime: string;
    subject: {
        id: string;
        template: { id: string; name: string; code: string };
    };
    classroom: { id: string; name: string };
    teacherProfile: {
        id: string;
        user: { firstName: string; lastName: string };
    };
    room?: { id: string; name: string } | null;
    substitutions?: SubstitutionData[];
}

export interface SubstitutionData {
    id: string;
    date: string;
    type: 'SUBSTITUTION' | 'CANCELLED' | 'MERGED' | 'ROOM_CHANGE' | 'SUBJECT_CHANGE';
    note?: string;
    substituteTeacher?: {
        id: string;
        user: { firstName: string; lastName: string };
    } | null;
    substituteRoom?: { id: string; name: string } | null;
    substituteSubject?: {
        template: { name: string; code: string };
    } | null;
}

export interface TimeSlot {
    lessonNumber: number;
    startTime: string;
    endTime: string;
}

interface TimetableGridProps {
    events: ScheduleEventData[];
    timeSlots?: TimeSlot[];
    maxLessons?: number;
    showTeacher?: boolean;
    showClassroom?: boolean;
    showRoom?: boolean;
    onCellClick?: (dayOfWeek: number, lessonNumber: number, event?: ScheduleEventData) => void;
    editable?: boolean;
    highlightDate?: string; // ISO date to highlight substitutions for
}

// ─── Constants ──────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, string> = {
    // Predefined color palette for subjects
    ČJ: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300',
    MA: 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300',
    AJ: 'bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300',
    FY: 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300',
    CH: 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300',
    BI: 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300',
    ZE: 'bg-teal-100 border-teal-300 text-teal-800 dark:bg-teal-900/30 dark:border-teal-700 dark:text-teal-300',
    DE: 'bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300',
    TV: 'bg-cyan-100 border-cyan-300 text-cyan-800 dark:bg-cyan-900/30 dark:border-cyan-700 dark:text-cyan-300',
    HV: 'bg-pink-100 border-pink-300 text-pink-800 dark:bg-pink-900/30 dark:border-pink-700 dark:text-pink-300',
    VV: 'bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-900/30 dark:border-rose-700 dark:text-rose-300',
    INF: 'bg-indigo-100 border-indigo-300 text-indigo-800 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300',
    PŘ: 'bg-lime-100 border-lime-300 text-lime-800 dark:bg-lime-900/30 dark:border-lime-700 dark:text-lime-300',
};

const FALLBACK_COLORS = [
    'bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-800/40 dark:border-slate-600 dark:text-slate-300',
    'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300',
    'bg-violet-100 border-violet-300 text-violet-800 dark:bg-violet-900/30 dark:border-violet-700 dark:text-violet-300',
    'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:border-fuchsia-700 dark:text-fuchsia-300',
];

function getSubjectColor(code: string): string {
    if (SUBJECT_COLORS[code]) return SUBJECT_COLORS[code];
    const hash = code.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

// ─── Component ──────────────────────────────────────────────

const DEFAULT_SLOTS: TimeSlot[] = [
    { lessonNumber: 0, startTime: '07:10', endTime: '07:55' },
    { lessonNumber: 1, startTime: '08:00', endTime: '08:45' },
    { lessonNumber: 2, startTime: '08:55', endTime: '09:40' },
    { lessonNumber: 3, startTime: '09:55', endTime: '10:40' },
    { lessonNumber: 4, startTime: '10:50', endTime: '11:35' },
    { lessonNumber: 5, startTime: '11:45', endTime: '12:30' },
    { lessonNumber: 6, startTime: '12:35', endTime: '13:20' },
    { lessonNumber: 7, startTime: '13:30', endTime: '14:15' },
    { lessonNumber: 8, startTime: '14:20', endTime: '15:05' },
];

export const TimetableGrid: React.FC<TimetableGridProps> = ({
    events,
    timeSlots,
    maxLessons,
    showTeacher = true,
    showClassroom = false,
    onCellClick,
    editable = false,
    highlightDate,
}) => {
    const { t } = useTranslation();
    const slots =
        timeSlots && timeSlots.length > 0 ? timeSlots.sort((a, b) => a.lessonNumber - b.lessonNumber) : DEFAULT_SLOTS;

    // Determine how many lessons to show
    const maxUsed = events.length > 0 ? Math.max(...events.map((e) => e.lessonNumber)) : 0;
    const lessonCount = maxLessons ?? Math.max(maxUsed, Math.min(slots.length, 8));

    const DAYS = [
        { num: 1, label: t('days.mon'), full: t('days.monday') },
        { num: 2, label: t('days.tue'), full: t('days.tuesday') },
        { num: 3, label: t('days.wed'), full: t('days.wednesday') },
        { num: 4, label: t('days.thu'), full: t('days.thursday') },
        { num: 5, label: t('days.fri'), full: t('days.friday') },
    ];

    const getSubstitutionBadge = (type: SubstitutionData['type']) => {
        switch (type) {
            case 'CANCELLED':
                return (
                    <Badge variant="destructive" className="text-[10px] px-1 py-0">
                        {t('schedule.cancelled')}
                    </Badge>
                );
            case 'SUBSTITUTION':
                return <Badge className="text-[10px] px-1 py-0 bg-amber-500">{t('sidebar.substitutions')}</Badge>;
            case 'MERGED':
                return <Badge className="text-[10px] px-1 py-0 bg-violet-500">Spojeno</Badge>;
            case 'ROOM_CHANGE':
                return <Badge className="text-[10px] px-1 py-0 bg-sky-500">{t('schedule.room_change')}</Badge>;
            case 'SUBJECT_CHANGE':
                return <Badge className="text-[10px] px-1 py-0 bg-orange-500">{t('schedule.subject_change')}</Badge>;
            default:
                return null;
        }
    };

    // Build event lookup: { dayOfWeek-lessonNumber -> event }
    const eventMap = new Map<string, ScheduleEventData>();
    events.forEach((e) => {
        eventMap.set(`${e.dayOfWeek}-${e.lessonNumber}`, e);
    });

    return (
        <TooltipProvider delayDuration={200}>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr>
                            <th className="w-16 p-2 text-center text-xs text-muted-foreground font-medium border-b border-r bg-muted/30">
                                Hodina
                            </th>
                            {DAYS.map((day) => (
                                <th
                                    key={day.num}
                                    className="p-2 text-center font-medium border-b bg-muted/30 min-w-[120px]"
                                >
                                    <span className="hidden sm:inline">{day.full}</span>
                                    <span className="sm:hidden">{day.label}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {slots
                            .filter((s) => s.lessonNumber <= lessonCount)
                            .map((slot) => (
                                <tr key={slot.lessonNumber}>
                                    <td className="p-1 text-center border-r border-b bg-muted/10">
                                        <div className="font-semibold text-xs">{slot.lessonNumber}.</div>
                                        <div className="text-[10px] text-muted-foreground">{slot.startTime}</div>
                                        <div className="text-[10px] text-muted-foreground">{slot.endTime}</div>
                                    </td>
                                    {DAYS.map((day) => {
                                        const event = eventMap.get(`${day.num}-${slot.lessonNumber}`);
                                        const todaySub = event?.substitutions?.find((s) => {
                                            if (!highlightDate) return false;
                                            const subDate = new Date(s.date).toISOString().slice(0, 10);
                                            return subDate === highlightDate;
                                        });

                                        return (
                                            <td
                                                key={day.num}
                                                className={`border-b p-0.5 align-top transition-colors ${
                                                    editable && !event ? 'cursor-pointer hover:bg-muted/20' : ''
                                                }`}
                                                onClick={() => {
                                                    if (onCellClick) onCellClick(day.num, slot.lessonNumber, event);
                                                }}
                                            >
                                                {event ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className={`rounded-md border p-1.5 min-h-[52px] transition-all ${
                                                                    todaySub ? 'border-dashed opacity-80' : ''
                                                                } ${getSubjectColor(event.subject?.template?.code)} ${
                                                                    editable ? 'cursor-pointer hover:shadow-md' : ''
                                                                }`}
                                                            >
                                                                <div className="font-bold text-xs leading-tight">
                                                                    {event.subject?.template?.code || '-'}
                                                                </div>
                                                                {showTeacher && (
                                                                    <div className="text-[10px] leading-tight mt-0.5 opacity-80">
                                                                        {event.teacherProfile.user.lastName}
                                                                    </div>
                                                                )}
                                                                {showClassroom && (
                                                                    <div className="text-[10px] leading-tight opacity-70">
                                                                        {event.classroom.name}
                                                                    </div>
                                                                )}
                                                                {event.room && (
                                                                    <div className="text-[10px] leading-tight opacity-60">
                                                                        📍 {event.room.name}
                                                                    </div>
                                                                )}
                                                                {todaySub && (
                                                                    <div className="mt-0.5">
                                                                        {getSubstitutionBadge(todaySub.type)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="right" className="max-w-xs">
                                                            <div className="space-y-1">
                                                                <div className="font-semibold">
                                                                    {event.subject.template.name}
                                                                </div>
                                                                <div className="text-xs">
                                                                    {t('common.teacher')}:{' '}
                                                                    {event.teacherProfile.user.firstName}{' '}
                                                                    {event.teacherProfile.user.lastName}
                                                                </div>
                                                                <div className="text-xs">
                                                                    {t('common.class')}: {event.classroom.name}
                                                                </div>
                                                                {event.room && (
                                                                    <div className="text-xs">
                                                                        {t('common.classroom')}: {event.room.name}
                                                                    </div>
                                                                )}
                                                                <div className="text-xs text-muted-foreground">
                                                                    {event.startTime} – {event.endTime}
                                                                </div>
                                                                {todaySub && (
                                                                    <div className="mt-1 pt-1 border-t">
                                                                        <div className="text-xs font-medium text-amber-600">
                                                                            {t('sidebar.substitutions')}:
                                                                        </div>
                                                                        {todaySub.substituteTeacher && (
                                                                            <div className="text-xs">
                                                                                →{' '}
                                                                                {
                                                                                    todaySub.substituteTeacher.user
                                                                                        .firstName
                                                                                }{' '}
                                                                                {
                                                                                    todaySub.substituteTeacher.user
                                                                                        .lastName
                                                                                }
                                                                            </div>
                                                                        )}
                                                                        {todaySub.note && (
                                                                            <div className="text-xs italic">
                                                                                {todaySub.note}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ) : (
                                                    <div
                                                        className={`min-h-[52px] rounded-md ${
                                                            editable
                                                                ? 'border border-dashed border-transparent hover:border-muted-foreground/20'
                                                                : ''
                                                        }`}
                                                    />
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </TooltipProvider>
    );
};

export default TimetableGrid;
