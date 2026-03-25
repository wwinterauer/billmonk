const CACHE_NAME = 'billmonk-v1';
const SHARE_CACHE = 'shared-files';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== SHARE_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Handle share target and network requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle Share Target POST requests
  if (url.pathname === '/share-receive' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API calls (always fetch fresh)
  if (event.request.url.includes('/functions/') || 
      event.request.url.includes('supabase') ||
      event.request.url.includes('/rest/') ||
      event.request.url.includes('/auth/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
});

// Handle incoming share target files
async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files');
    
    console.log('[SW] Share target received', files.length, 'files');

    if (files.length === 0) {
      // No files - just redirect
      return Response.redirect('/share-receive?error=no-files', 303);
    }

    // Store files in cache for the page to retrieve
    const cache = await caches.open(SHARE_CACHE);
    
    // Create a unique key for this share
    const shareId = Date.now().toString();
    
    // Store each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 0) {
        const cacheKey = `/shared-file-${shareId}-${i}`;
        const response = new Response(file, {
          headers: {
            'Content-Type': file.type,
            'X-File-Name': encodeURIComponent(file.name),
            'X-Share-Id': shareId,
          }
        });
        await cache.put(cacheKey, response);
        console.log('[SW] Cached file:', file.name, file.type);
      }
    }

    // Redirect to the share receive page
    return Response.redirect(`/share-receive?shareId=${shareId}`, 303);
  } catch (error) {
    console.error('[SW] Share target error:', error);
    return Response.redirect('/share-receive?error=processing', 303);
  }
}
