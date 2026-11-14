import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Trash2, StickyNote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const COLORS = ['yellow', 'green', 'blue', 'pink', 'orange'] as const;
type Note = { id: string; content: string; color: string; is_done: boolean; created_at: string };
const bg = (c: string) => ({ backgroundColor: `hsl(var(--note-${COLORS.includes(c as any) ? c : 'yellow'}))` });

function NoteCard({ note, autoFocus, onChange, onDelete }: {
  note: Note; autoFocus: boolean;
  onChange: (patch: Partial<Note>) => void; onDelete: () => void;
}) {
  const [text, setText] = useState(note.content);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onType = (v: string) => {
    setText(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onChange({ content: v }), 600);
  };
  return (
    <div className={cn('group relative flex min-h-[150px] flex-col rounded-sm p-3 shadow-md transition-transform hover:-rotate-1', note.is_done && 'opacity-60')}
      style={{ ...bg(note.color), color: 'hsl(var(--note-foreground))' }}>
      <textarea
        aria-label="Notiz"
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => onType(e.target.value)}
        onBlur={() => { window.clearTimeout(timer.current); if (text !== note.content) onChange({ content: text }); }}
        placeholder="Notiz…"
        className={cn('flex-1 resize-none bg-transparent text-sm outline-none placeholder:opacity-50', note.is_done && 'line-through')}
      />
      <div className="mt-2 flex items-center gap-1">
        <button aria-label={note.is_done ? 'Wieder öffnen' : 'Erledigt'} onClick={() => onChange({ is_done: !note.is_done })}
          className={cn('flex h-6 w-6 items-center justify-center rounded-full border border-current/40', note.is_done && 'bg-foreground/20')}>
          {note.is_done && <Check className="h-3.5 w-3.5" />}
        </button>
        <div className="ml-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {COLORS.map((c) => (
            <button key={c} aria-label={`Farbe ${c}`} onClick={() => onChange({ color: c })}
              className={cn('h-4 w-4 rounded-full border border-foreground/30', note.color === c && 'ring-2 ring-foreground/50')} style={bg(c)} />
          ))}
        </div>
        <button aria-label="Notiz löschen" onClick={onDelete} className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function StickyNotes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ['dashboard_notes', user?.id];
  const [hideDone, setHideDone] = useState(() => localStorage.getItem('notes_hide_done') === '1');
  const [newId, setNewId] = useState<string | null>(null);

  const { data: notes = [] } = useQuery({
    queryKey: key, enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('dashboard_notes').select('id, content, color, is_done, created_at').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('dashboard_notes').insert({ user_id: user!.id }).select('id, content, color, is_done, created_at').single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (n) => { setNewId(n.id); qc.setQueryData<Note[]>(key, (old = []) => [n, ...old]); },
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Note> }) => {
      const { error } = await supabase.from('dashboard_notes').update(patch).eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, patch }) => qc.setQueryData<Note[]>(key, (old = []) => old.map((n) => (n.id === id ? { ...n, ...patch } : n))),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dashboard_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => qc.setQueryData<Note[]>(key, (old = []) => old.filter((n) => n.id !== id)),
  });

  const visible = [...notes]
    .filter((n) => !(hideDone && n.is_done))
    .sort((a, b) => Number(a.is_done) - Number(b.is_done) || b.created_at.localeCompare(a.created_at));
  const doneCount = notes.filter((n) => n.is_done).length;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><StickyNote className="h-5 w-5" /> Notizen</h2>
        <div className="flex items-center gap-4">
          {doneCount > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={hideDone} onCheckedChange={(v) => { setHideDone(v); localStorage.setItem('notes_hide_done', v ? '1' : '0'); }} />
              Erledigte ausblenden
            </label>
          )}
          <Button size="sm" variant="outline" onClick={() => add.mutate()} disabled={add.isPending}><Plus className="mr-1 h-4 w-4" /> Notiz</Button>
        </div>
      </div>
      {notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Hier kannst du dir kurze Notizen und To-dos merken.
          <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>Erste Notiz anlegen</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {visible.map((n) => (
            <NoteCard key={n.id} note={n} autoFocus={n.id === newId}
              onChange={(patch) => update.mutate({ id: n.id, patch })} onDelete={() => remove.mutate(n.id)} />
          ))}
        </div>
      )}
    </section>
  );
}
