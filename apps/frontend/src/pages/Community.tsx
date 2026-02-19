import { useEffect, useState } from 'react';
import { Plus, Pin, Trash2, Calendar, BarChart3, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import {
    getBulletinPosts, createBulletinPost, deleteBulletinPost,
    getPolls, createPoll, votePoll,
    getCalendarEvents, createCalendarEvent, rsvpEvent,
} from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

export default function Community() {

    // Bulletin
    const [posts, setPosts] = useState<any[]>([]);
    const [postDialog, setPostDialog] = useState(false);
    const [postForm, setPostForm] = useState({ title: '', content: '', pinned: false });

    // Polls
    const [polls, setPolls] = useState<any[]>([]);
    const [pollDialog, setPollDialog] = useState(false);
    const [pollForm, setPollForm] = useState({ question: '', options: ['', ''], multiSelect: false, endsAt: '' });

    // Calendar
    const [events, setEvents] = useState<any[]>([]);
    const [eventDialog, setEventDialog] = useState(false);
    const [eventForm, setEventForm] = useState({ title: '', description: '', startDate: '', endDate: '', location: '' });

    const loadPosts = async () => { try { setPosts(await getBulletinPosts()); } catch { toast.error('Chyba'); } };
    const loadPolls = async () => { try { setPolls(await getPolls()); } catch { toast.error('Chyba'); } };
    const loadEvents = async () => { try { setEvents(await getCalendarEvents()); } catch { toast.error('Chyba'); } };

    useEffect(() => { loadPosts(); }, []);

    const handleCreatePost = async () => {
        if (!postForm.title || !postForm.content) { toast.error('Vyplňte název a obsah'); return; }
        try { await createBulletinPost(postForm); toast.success('Příspěvek vytvořen'); setPostDialog(false); setPostForm({ title: '', content: '', pinned: false }); loadPosts(); }
        catch { toast.error('Chyba'); }
    };

    const handleCreatePoll = async () => {
        const opts = pollForm.options.filter(o => o.trim());
        if (!pollForm.question || opts.length < 2) { toast.error('Zadejte otázku a alespoň 2 možnosti'); return; }
        try { await createPoll({ ...pollForm, options: opts }); toast.success('Anketa vytvořena'); setPollDialog(false); setPollForm({ question: '', options: ['', ''], multiSelect: false, endsAt: '' }); loadPolls(); }
        catch { toast.error('Chyba'); }
    };

    const handleVote = async (optionId: string) => {
        try { await votePoll(optionId); toast.success('Hlas odeslán'); loadPolls(); }
        catch (e: any) { toast.error(e.response?.data?.message || 'Chyba'); }
    };

    const handleCreateEvent = async () => {
        if (!eventForm.title || !eventForm.startDate) { toast.error('Vyplňte název a datum'); return; }
        try { await createCalendarEvent(eventForm); toast.success('Událost vytvořena'); setEventDialog(false); setEventForm({ title: '', description: '', startDate: '', endDate: '', location: '' }); loadEvents(); }
        catch { toast.error('Chyba'); }
    };

    const handleRsvp = async (eventId: string, status: 'YES' | 'NO' | 'MAYBE') => {
        try { await rsvpEvent(eventId, status); toast.success('Odpověď uložena'); loadEvents(); }
        catch { toast.error('Chyba'); }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Komunita</h1>
                <p className="text-muted-foreground">Nástěnka, ankety a kalendář událostí</p>
            </div>

            <Tabs defaultValue="bulletin" onValueChange={v => { if (v === 'polls') loadPolls(); if (v === 'events') loadEvents(); }}>
                <TabsList>
                    <TabsTrigger value="bulletin"><Megaphone className="h-4 w-4 mr-1" />Nástěnka</TabsTrigger>
                    <TabsTrigger value="polls"><BarChart3 className="h-4 w-4 mr-1" />Ankety</TabsTrigger>
                    <TabsTrigger value="events"><Calendar className="h-4 w-4 mr-1" />Události</TabsTrigger>
                </TabsList>

                {/* ─── BULLETIN ─── */}
                <TabsContent value="bulletin">
                    <div className="flex justify-end mb-4">
                        <Button onClick={() => setPostDialog(true)}><Plus className="h-4 w-4 mr-1" />Nový příspěvek</Button>
                    </div>
                    {posts.length === 0 ? (
                        <Card><CardContent className="py-12 text-center text-muted-foreground">Žádné příspěvky</CardContent></Card>
                    ) : (
                        <div className="space-y-3">
                            {posts.map(p => (
                                <Card key={p.id}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                    {p.pinned && <Pin className="h-4 w-4 text-primary" />}
                                                    {p.title}
                                                </CardTitle>
                                                <CardDescription>{p.author?.lastName} {p.author?.firstName} · {new Date(p.createdAt).toLocaleDateString('cs-CZ')}</CardDescription>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => { await deleteBulletinPost(p.id); loadPosts(); }}>
                                                <Trash2 className="h-3 w-3 text-destructive" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent><p className="text-sm whitespace-pre-wrap">{p.content}</p></CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* ─── POLLS ─── */}
                <TabsContent value="polls">
                    <div className="flex justify-end mb-4">
                        <Button onClick={() => setPollDialog(true)}><Plus className="h-4 w-4 mr-1" />Nová anketa</Button>
                    </div>
                    {polls.length === 0 ? (
                        <Card><CardContent className="py-12 text-center text-muted-foreground">Žádné ankety</CardContent></Card>
                    ) : (
                        <div className="space-y-4">
                            {polls.map(poll => {
                                const totalVotes = poll.options?.reduce((sum: number, o: any) => sum + (o._count?.votes || 0), 0) || 0;
                                return (
                                    <Card key={poll.id}>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base">{poll.question}</CardTitle>
                                            <CardDescription>
                                                {poll.author?.lastName} {poll.author?.firstName}
                                                {poll.endsAt && ` · do ${new Date(poll.endsAt).toLocaleDateString('cs-CZ')}`}
                                                {poll.multiSelect && <Badge variant="outline" className="ml-2 text-xs">Více odpovědí</Badge>}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            {poll.options?.map((opt: any) => {
                                                const votes = opt._count?.votes || 0;
                                                const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                                                return (
                                                    <div key={opt.id} className="flex items-center gap-3 cursor-pointer" onClick={() => handleVote(opt.id)}>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between text-sm mb-1">
                                                                <span>{opt.text}</span>
                                                                <span className="text-muted-foreground">{votes} ({pct}%)</span>
                                                            </div>
                                                            <div className="h-2 w-full rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <p className="text-xs text-muted-foreground mt-2">Celkem hlasů: {totalVotes}</p>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* ─── EVENTS ─── */}
                <TabsContent value="events">
                    <div className="flex justify-end mb-4">
                        <Button onClick={() => setEventDialog(true)}><Plus className="h-4 w-4 mr-1" />Nová událost</Button>
                    </div>
                    {events.length === 0 ? (
                        <Card><CardContent className="py-12 text-center text-muted-foreground">Žádné události</CardContent></Card>
                    ) : (
                        <div className="space-y-3">
                            {events.map(ev => {
                                const yes = ev.rsvps?.filter((r: any) => r.status === 'YES').length || 0;
                                const no = ev.rsvps?.filter((r: any) => r.status === 'NO').length || 0;
                                const maybe = ev.rsvps?.filter((r: any) => r.status === 'MAYBE').length || 0;
                                return (
                                    <Card key={ev.id}>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base">{ev.title}</CardTitle>
                                            <CardDescription>
                                                {new Date(ev.startDate).toLocaleDateString('cs-CZ')}
                                                {ev.endDate && ` – ${new Date(ev.endDate).toLocaleDateString('cs-CZ')}`}
                                                {ev.location && ` · ${ev.location}`}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {ev.description && <p className="text-sm mb-3">{ev.description}</p>}
                                            <div className="flex gap-2 items-center">
                                                <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleRsvp(ev.id, 'YES')}>✓ Ano ({yes})</Button>
                                                <Button size="sm" variant="outline" className="text-yellow-600" onClick={() => handleRsvp(ev.id, 'MAYBE')}>? Možná ({maybe})</Button>
                                                <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleRsvp(ev.id, 'NO')}>✗ Ne ({no})</Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* ─── POST DIALOG ─── */}
            <Dialog open={postDialog} onOpenChange={setPostDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nový příspěvek</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div><Label>Název</Label><Input value={postForm.title} onChange={e => setPostForm(f => ({ ...f, title: e.target.value }))} /></div>
                        <div><Label>Obsah</Label><Textarea value={postForm.content} onChange={e => setPostForm(f => ({ ...f, content: e.target.value }))} rows={4} /></div>
                        <div className="flex items-center gap-2"><Switch checked={postForm.pinned} onCheckedChange={v => setPostForm(f => ({ ...f, pinned: v }))} /><Label>Připnout</Label></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPostDialog(false)}>Zrušit</Button>
                        <Button onClick={handleCreatePost}>Vytvořit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── POLL DIALOG ─── */}
            <Dialog open={pollDialog} onOpenChange={setPollDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nová anketa</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div><Label>Otázka</Label><Input value={pollForm.question} onChange={e => setPollForm(f => ({ ...f, question: e.target.value }))} /></div>
                        {pollForm.options.map((opt, i) => (
                            <div key={i}><Label>Možnost {i + 1}</Label><Input value={opt} onChange={e => { const o = [...pollForm.options]; o[i] = e.target.value; setPollForm(f => ({ ...f, options: o })); }} /></div>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => setPollForm(f => ({ ...f, options: [...f.options, ''] }))}>+ Přidat možnost</Button>
                        <div className="flex items-center gap-2"><Switch checked={pollForm.multiSelect} onCheckedChange={v => setPollForm(f => ({ ...f, multiSelect: v }))} /><Label>Více odpovědí</Label></div>
                        <div><Label>Konec (volitelné)</Label><Input type="datetime-local" value={pollForm.endsAt} onChange={e => setPollForm(f => ({ ...f, endsAt: e.target.value }))} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPollDialog(false)}>Zrušit</Button>
                        <Button onClick={handleCreatePoll}>Vytvořit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── EVENT DIALOG ─── */}
            <Dialog open={eventDialog} onOpenChange={setEventDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nová událost</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div><Label>Název</Label><Input value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} /></div>
                        <div><Label>Popis</Label><Textarea value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label>Od</Label><Input type="datetime-local" value={eventForm.startDate} onChange={e => setEventForm(f => ({ ...f, startDate: e.target.value }))} /></div>
                            <div><Label>Do</Label><Input type="datetime-local" value={eventForm.endDate} onChange={e => setEventForm(f => ({ ...f, endDate: e.target.value }))} /></div>
                        </div>
                        <div><Label>Místo</Label><Input value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEventDialog(false)}>Zrušit</Button>
                        <Button onClick={handleCreateEvent}>Vytvořit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
