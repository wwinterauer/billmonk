import { Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';

const testimonials = [
  {
    quote: 'Spart mir 2 Stunden pro Woche!',
    author: 'Maria K.',
    role: 'Vermieterin',
    rating: 5,
  },
  {
    quote: 'Endlich Ordnung in meinen Belegen.',
    author: 'Thomas S.',
    role: 'Freelancer',
    rating: 5,
  },
  {
    quote: 'Mein Steuerberater ist begeistert.',
    author: 'Sandra M.',
    role: 'Online-Shop',
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section className="py-20 bg-secondary/30">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Was unsere Nutzer sagen
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <Card className="h-full border-border/50 bg-card">
                <CardContent className="p-6 text-center">
                  <div className="flex justify-center gap-1 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-warning text-warning" />
                    ))}
                  </div>
                  <blockquote className="text-lg font-medium text-foreground mb-4">
                    "{testimonial.quote}"
                  </blockquote>
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
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
