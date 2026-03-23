import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { HelpCircle, Plus, Pencil, Trash2, Loader2, ImagePlus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
  is_published: boolean;
  images: string[] | null;
  created_at: string;
}

export function FAQManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: faqs, isLoading } = useQuery({
    queryKey: ['admin-faqs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FAQ[];
    },
  });

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from('faq-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const resetForm = () => {
    setQuestion('');
    setAnswer('');
    setCategory('');
    setIsPublished(true);
    setImages([]);
    setEditingFaq(null);
  };

  const openEdit = (faq: FAQ) => {
    setEditingFaq(faq);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setCategory(faq.category || '');
    setIsPublished(faq.is_published);
    setImages(faq.images || []);
    setDialogOpen(true);
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newPaths: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('faq-images').upload(path, file);
        if (error) throw error;
        newPaths.push(path);
      }
      setImages(prev => [...prev, ...newPaths]);
    } catch {
      toast({ title: 'Upload fehlgeschlagen', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!question.trim() || !answer.trim() || !user) return;
    setSaving(true);
    try {
      if (editingFaq) {
        const { error } = await supabase
          .from('faqs')
          .update({
            question: question.trim(),
            answer: answer.trim(),
            category: category.trim() || null,
            is_published: isPublished,
            images,
          })
          .eq('id', editingFaq.id);
        if (error) throw error;
        toast({ title: 'FAQ aktualisiert' });
      } else {
        const { error } = await supabase.from('faqs').insert({
          question: question.trim(),
          answer: answer.trim(),
          category: category.trim() || null,
          is_published: isPublished,
          images,
          created_by: user.id,
          sort_order: (faqs?.length || 0) + 1,
        });
        if (error) throw error;
        toast({ title: 'FAQ erstellt' });
      }
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['admin-faqs'] });
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('faqs').delete().eq('id', id);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['admin-faqs'] });
      toast({ title: 'FAQ gelöscht' });
    }
  };

  const togglePublished = async (faq: FAQ) => {
    const { error } = await supabase
      .from('faqs')
      .update({ is_published: !faq.is_published })
      .eq('id', faq.id);
    if (!error) queryClient.invalidateQueries({ queryKey: ['admin-faqs'] });
  };

  const categories = [...new Set((faqs || []).map(f => f.category).filter(Boolean))];

  if (isLoading) return <div className="text-sm text-muted-foreground">Lade FAQs...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{faqs?.length || 0} FAQs</span>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              Neue FAQ
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingFaq ? 'FAQ bearbeiten' : 'Neue FAQ erstellen'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Frage</Label>
                <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="z.B. Wie lade ich einen Beleg hoch?" />
              </div>
              <div className="space-y-2">
                <Label>Antwort</Label>
                <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Die Antwort auf die Frage..." rows={5} />
              </div>
              <div className="space-y-2">
                <Label>Kategorie (optional)</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="z.B. Belege, Rechnungen, Konto" list="faq-categories" />
                <datalist id="faq-categories">
                  {categories.map(c => <option key={c} value={c!} />)}
                </datalist>
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Bilder / Screenshots</Label>
                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((path, index) => (
                      <div key={path} className="relative group rounded-lg overflow-hidden border">
                        <img
                          src={getPublicUrl(path)}
                          alt={`FAQ Bild ${index + 1}`}
                          className="w-full h-24 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ImagePlus className="h-4 w-4 mr-1" />}
                  {uploading ? 'Wird hochgeladen...' : 'Bild hinzufügen'}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                <Label>Veröffentlicht</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
                <Button onClick={handleSave} disabled={saving || !question.trim() || !answer.trim()}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  {editingFaq ? 'Speichern' : 'Erstellen'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            FAQ-Verwaltung
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!faqs || faqs.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">Noch keine FAQs erstellt.</p>
          ) : (
            <div className="space-y-2">
              {faqs.map((faq) => (
                <div key={faq.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{faq.question}</span>
                      {!faq.is_published && <Badge variant="outline" className="text-xs">Entwurf</Badge>}
                      {faq.category && <Badge variant="secondary" className="text-xs">{faq.category}</Badge>}
                      {faq.images && faq.images.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <ImagePlus className="h-3 w-3 mr-0.5" />
                          {faq.images.length}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{faq.answer}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => togglePublished(faq)} title={faq.is_published ? 'Verbergen' : 'Veröffentlichen'}>
                      <Switch checked={faq.is_published} className="pointer-events-none" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(faq)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(faq.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
