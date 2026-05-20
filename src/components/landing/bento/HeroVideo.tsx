import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import demoVideo from '@/assets/landing-demo.mp4';
import demoPoster from '@/assets/landing-demo-poster.jpg';

/** Lazy-mounted hero video. Mobile shows poster + tap-to-play. */
export function HeroVideo() {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldMount, setShouldMount] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.matchMedia('(max-width: 767px)').matches);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldMount(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const handlePlay = () => {
    videoRef.current?.play();
    setPlaying(true);
  };

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden rounded-[inherit] bg-sidebar"
      aria-hidden
    >
      {shouldMount && (!isMobile || playing) ? (
        <video
          ref={videoRef}
          src={demoVideo}
          poster={demoPoster}
          autoPlay={!isMobile}
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        <img
          src={demoPoster}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      )}
      {isMobile && !playing && (
        <button
          onClick={handlePlay}
          aria-label="Demo abspielen"
          className="absolute inset-0 flex items-center justify-center bg-foreground/10 backdrop-blur-[2px]"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-primary">
            <Play className="h-7 w-7 ml-1" fill="currentColor" />
          </span>
        </button>
      )}
      {/* subtle bottom gradient for any overlaid text */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-foreground/40 to-transparent" />
      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-card/80 backdrop-blur px-3 py-1.5 text-xs font-semibold text-primary border border-primary/20">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        Produkt-Demo · 15 s
      </div>
    </div>
  );
}
