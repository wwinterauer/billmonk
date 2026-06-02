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

  // Try to start autoplay on desktop as soon as the video is mounted.
  useEffect(() => {
    if (!shouldMount || isMobile) return;
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.then === 'function') {
        p.then(() => setPlaying(true)).catch(() => {
          /* autoplay blocked, user can tap */
        });
      }
    };
    if (v.readyState >= 2) tryPlay();
    else v.addEventListener('loadeddata', tryPlay, { once: true });
    return () => v.removeEventListener('loadeddata', tryPlay);
  }, [shouldMount, isMobile]);

  const handlePlay = () => {
    videoRef.current?.play();
    setPlaying(true);
  };

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden rounded-[inherit] bg-background"
    >
      {/* Poster shown until video has rendered a real frame */}
      {!playing && (
        <img
          src={demoPoster}
          alt="BillMonk Produkt-Demo"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {shouldMount && (!isMobile || playing) && (
        <video
          ref={videoRef}
          src={demoVideo}
          poster={demoPoster}
          autoPlay={!isMobile}
          muted
          loop
          playsInline
          preload="auto"
          onPlaying={() => setPlaying(true)}
          className="relative h-full w-full object-cover"
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
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-card/80 backdrop-blur px-3 py-1.5 text-xs font-semibold text-primary border border-primary/20">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        Produkt-Demo · 15 s
      </div>
    </div>
  );
}
