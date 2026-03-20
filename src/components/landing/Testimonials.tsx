import { Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';

const testimonials = [
  {
    quote: 'Spart mir 2 Stunden pro Woche — die KI erkennt mittlerweile fast alles fehlerfrei.',
    author: 'Maria K.',
    role: 'Vermieterin',
    rating: 5,
  },
  {
    quote: 'Endlich Ordnung in meinen Belegen. Upload, Erkennung, fertig.',
    author: 'Thomas S.',
    role: 'Freelancer',
    rating: 5,
  },
  {
    quote: 'Mein Steuerberater ist begeistert vom DATEV-Export.',
    author: 'Sandra M.',
    role: 'Online-Shop Betreiberin',
    rating: 5,
  },
  {
    quote: 'Angebote, Rechnungen und Belege an einem Ort — genau das hat uns gefehlt.',
    author: 'Markus W.',
    role: 'Geschäftsführer, Handwerksbetrieb',
    rating: 5,
  },
  {
    quote: 'Der automatische Bankabgleich spart uns jeden Monat einen halben Tag Buchhaltung.',
    author: 'Lisa R.',
    role: 'Inhaberin, Kreativagentur',
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section className="py-20 lg:py-28 bg-secondary/30">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4" style={{ textWrap: 'balance' }}>
            Was unsere Nutzer sagen
          </h2>
          <p className="text-lg text-muted-foreground">Freelancer, Vermieter und KMUs vertrauen auf XpenzAi.</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card className="h-full border-border/50 bg-card hover:shadow-md transition-[box-shadow] duration-300">
                <CardContent className="p-6">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <blockquote className="text-foreground font-medium mb-4 leading-relaxed">
                    „{testimonial.quote}"
                  </blockquote>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{testimonial.author}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
