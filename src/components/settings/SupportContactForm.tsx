import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Send, Loader2, HelpCircle, Search, ZoomIn, Gift, Bug, Lightbulb, ImagePlus, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const AREA_OPTIONS = [
  'Dashboard',
  'Belege hochladen',
  'Review',
  'Alle Ausgaben',
  'Kontoabgleich',
  'Konto-Import',
  'Angebote',
  'Rechnungen',
  'Berichte',
  'Checklisten',
  'Einstellungen',
  'Sonstiges',
];

export function SupportContactForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [ticketType, setTicketType] = useState<string>('bug');
  const [area, setArea] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [faqSearch, setFaqSearch] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from('faq-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const getSupportImageUrl = (path: string) => {
    const { data } = supabase.storage.from('support-images').createSignedUrl(path, 3600);
    return data?.signedUrl || '';
  };

  const { data: tickets, refetch } = useQuery({
    queryKey: ['support-tickets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: faqs } = useQuery({
    queryKey: ['public-faqs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length + selectedFiles.length > 5) {
      toast({ title: 'Maximal 5 Bilder', variant: 'destructive' });
      return;
    }
    const newFiles = [...selectedFiles, ...imageFiles].slice(0, 5);
    setSelectedFiles(newFiles);
    setPreviewUrls(newFiles.map(f => URL.createObjectURL(f)));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setPreviewUrls(newFiles.map(f => URL.createObjectURL(f)));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (!user || selectedFiles.length === 0) return [];
    const paths: string[] = [];
    for (const file of selectedFiles) {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('support-images').upload(path, file);
      if (error) throw error;
      paths.push(path);
    }
    return paths;
  };

  const handleSubmit = async () => {
    if (!user || !subject.trim() || !message.trim() || !area) return;
    setSending(true);
    try {
      const imagePaths = await uploadImages();
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        user_email: user.email || '',
        subject: subject.trim(),
        message: message.trim(),
        ticket_type: ticketType,
        area,
        images: imagePaths,
      });
      if (error) throw error;
      setSubject('');
      setMessage('');
      setTicketType('bug');
      setArea('');
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setSelectedFiles([]);
      setPreviewUrls([]);
      refetch();
      toast({ title: 'Nachricht gesendet', description: 'Wir melden uns so schnell wie möglich.' });
    } catch {
      toast({ title: 'Fehler', description: 'Nachricht konnte nicht gesendet werden.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    open: { label: 'Offen', variant: 'secondary' },
    replied: { label: 'Beantwortet', variant: 'default' },
    closed: { label: 'Geschlossen', variant: 'outline' },
  };

  const searchLower = faqSearch.toLowerCase().trim();
  const filteredFaqs = searchLower
    ? (faqs || []).filter(
        (f: any) =>
          f.question.toLowerCase().includes(searchLower) ||
          f.answer.toLowerCase().includes(searchLower) ||
          (f.category && f.category.toLowerCase().includes(searchLower))
      )
    : (faqs || []);

  const groupedFaqs: Record<string, any[]> = {};
  for (const faq of filteredFaqs) {
    const cat = (faq as any).category || 'Allgemein';
    if (!groupedFaqs[cat]) groupedFaqs[cat] = [];
    groupedFaqs[cat].push(faq);
  }

  return (
    <div className="space-y-6">
      {/* FAQ Section */}
      {faqs && faqs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Häufig gestellte Fragen
            </CardTitle>
            <CardDescription>Finde schnell Antworten auf deine Fragen</CardDescription>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder="FAQs durchsuchen..."
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredFaqs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Keine FAQs gefunden für &quot;{faqSearch}&quot;
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedFaqs).map(([category, items]) => (
                  <div key={category}>
                    {Object.keys(groupedFaqs).length > 1 && (
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        {category}
                      </p>
                    )}
                    <Accordion type="multiple" className="space-y-1">
                      {items.map((faq: any) => (
                        <AccordionItem key={faq.id} value={faq.id} className="border rounded-lg px-3">
                          <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                            {faq.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground whitespace-pre-wrap pb-3 space-y-3">
                            <p>{faq.answer}</p>
                            {faq.images && faq.images.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                {faq.images.map((imgPath: string, idx: number) => (
                                  <button
                                    key={imgPath}
                                    type="button"
                                    onClick={() => setLightboxImage(getPublicUrl(imgPath))}
                                    className="relative group rounded-lg overflow-hidden border cursor-pointer"
                                  >
                                    <img
                                      src={getPublicUrl(imgPath)}
                                      alt={`${faq.question} - Bild ${idx + 1}`}
                                      className="w-full h-32 object-cover"
                                      loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                      <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reward Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
        <Gift className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-foreground">1 Monat gratis für dein Feedback!</p>
          <p className="text-muted-foreground mt-1">
            Für jeden anerkannten Bug-Report oder umgesetzten Feature-Vorschlag erhältst du automatisch eine Gutschrift in Höhe eines Monatsabos.
          </p>
        </div>
      </div>

      {/* Contact Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Kontakt & Support
          </CardTitle>
          <CardDescription>Keine Antwort gefunden? Schreib uns direkt!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Art der Meldung</Label>
              <Select value={ticketType} onValueChange={setTicketType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">
                    <span className="flex items-center gap-2">
                      <Bug className="h-3.5 w-3.5" />
                      Bug melden
                    </span>
                  </SelectItem>
                  <SelectItem value="feature">
                    <span className="flex items-center gap-2">
                      <Lightbulb className="h-3.5 w-3.5" />
                      Feature-Vorschlag
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Betroffener Bereich</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger>
                  <SelectValue placeholder="Bereich wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {AREA_OPTIONS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-subject">Betreff</Label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Worum geht es?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-message">Nachricht</Label>
            <Textarea
              id="support-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={ticketType === 'bug'
                ? "Beschreibe den Fehler so genau wie möglich. Was hast du gemacht? Was ist passiert?"
                : "Beschreibe deine Feature-Idee. Was soll die Funktion können?"
              }
              rows={5}
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Screenshots (optional, max. 5)</Label>
            <div className="flex flex-wrap gap-2">
              {previewUrls.map((url, idx) => (
                <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border">
                  <img src={url} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {selectedFiles.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-[10px]">Bild</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <Button onClick={handleSubmit} disabled={sending || !subject.trim() || !message.trim() || !area}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Nachricht senden
          </Button>
        </CardContent>
      </Card>

      {/* Previous Tickets */}
      {tickets && tickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deine Anfragen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tickets.map((ticket: any) => {
                const sc = statusConfig[ticket.status] || statusConfig.open;
                return (
                  <div key={ticket.id} className="p-3 rounded-lg border bg-card space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{ticket.subject}</span>
                        {ticket.ticket_type === 'bug' && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Bug className="h-3 w-3" /> Bug
                          </Badge>
                        )}
                        {ticket.ticket_type === 'feature' && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Lightbulb className="h-3 w-3" /> Feature
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {ticket.reward_status === 'approved' && (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                            <Gift className="h-3 w-3" /> 1 Monat Gutschrift
                          </Badge>
                        )}
                        {ticket.reward_status === 'rejected' && (
                          <Badge variant="outline" className="text-muted-foreground text-xs">Nicht anerkannt</Badge>
                        )}
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(ticket.created_at), 'dd.MM.yyyy')}
                        </span>
                      </div>
                    </div>
                    {ticket.area && (
                      <p className="text-xs text-muted-foreground">Bereich: {ticket.area}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{ticket.message}</p>
                    {ticket.images && ticket.images.length > 0 && (
                      <TicketImages images={ticket.images} onImageClick={setLightboxImage} />
                    )}
                    {ticket.admin_reply && (
                      <div className="mt-2 p-2 rounded bg-muted text-sm">
                        <p className="text-xs font-medium text-primary mb-1">Antwort vom Support:</p>
                        {ticket.admin_reply}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="sm:max-w-3xl p-2">
          {lightboxImage && (
            <img
              src={lightboxImage}
              alt="Screenshot"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TicketImages({ images, onImageClick }: { images: string[]; onImageClick: (url: string) => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useState(() => {
    images.forEach(async (path) => {
      const { data } = await supabase.storage.from('support-images').createSignedUrl(path, 3600);
      if (data?.signedUrl) {
        setUrls(prev => ({ ...prev, [path]: data.signedUrl }));
      }
    });
  });

  return (
    <div className="flex flex-wrap gap-2">
      {images.map((path) => (
        urls[path] ? (
          <button
            key={path}
            type="button"
            onClick={() => onImageClick(urls[path])}
            className="relative group w-16 h-16 rounded-lg overflow-hidden border cursor-pointer"
          >
            <img src={urls[path]} alt="Screenshot" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          </button>
        ) : (
          <div key={path} className="w-16 h-16 rounded-lg border bg-muted animate-pulse" />
        )
      ))}
    </div>
  );
}
