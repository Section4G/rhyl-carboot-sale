// Service Worker for Rhyl Car Boot Sale Website
const CACHE_NAME = 'rhyl-carboot-v1.0.0';
const STATIC_CACHE = 'rhyl-carboot-static-v1.0.0';
const DYNAMIC_CACHE = 'rhyl-carboot-dynamic-v1.0.0';

// Files to cache immediately
const STATIC_FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/styles-mobile.css',
    '/app.js',
    '/server.js',
    '/images/',
    '/uploads/'
];

// API endpoints to cache
const API_ENDPOINTS = [
    '/api/status',
    '/api/gallery',
    '/api/hero-background'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('Service Worker: Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('Service Worker: Static files cached');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Cache installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Handle API requests
    if (API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint))) {
        event.respondWith(handleApiRequest(request));
        return;
    }
    
    // Handle static files
    if (url.origin === self.location.origin) {
        event.respondWith(handleStaticRequest(request));
        return;
    }
    
    // Handle external resources (Google Fonts, etc.)
    if (url.origin === 'https://fonts.googleapis.com' || 
        url.origin === 'https://fonts.gstatic.com' ||
        url.origin === 'https://www.google.com') {
        event.respondWith(handleExternalRequest(request));
        return;
    }
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache the response
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        throw new Error('Network response not ok');
    } catch (error) {
        // Fallback to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline response for status API
        if (request.url.includes('/api/status')) {
            return new Response(JSON.stringify({
                status: false,
                notice: 'Offline - Please check your connection',
                lastUpdated: new Date().toISOString()
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        throw error;
    }
}

// Handle static files with cache-first strategy
async function handleStaticRequest(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Return offline page for HTML requests
        if (request.headers.get('accept').includes('text/html')) {
            return caches.match('/offline.html');
        }
        
        throw error;
    }
}

// Handle external requests with cache-first strategy
async function handleExternalRequest(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Return empty response for failed external requests
        return new Response('', { status: 404 });
    }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    try {
        // Sync any pending data when connection is restored
        console.log('Service Worker: Background sync triggered');
        
        // Clear old dynamic cache entries
        const cache = await caches.open(DYNAMIC_CACHE);
        const keys = await cache.keys();
        const oldKeys = keys.filter(key => {
            const url = new URL(key.url);
            return Date.now() - new Date(key.headers.get('date')).getTime() > 24 * 60 * 60 * 1000; // 24 hours
        });
        
        await Promise.all(oldKeys.map(key => cache.delete(key)));
        
        console.log('Service Worker: Background sync completed');
    } catch (error) {
        console.error('Service Worker: Background sync failed:', error);
    }
}

// Push notifications (if needed in future)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/images/icon-192x192.png',
            badge: '/images/badge-72x72.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: 1
            },
            actions: [
                {
                    action: 'explore',
                    title: 'View Details',
                    icon: '/images/checkmark.png'
                },
                {
                    action: 'close',
                    title: 'Close',
                    icon: '/images/xmark.png'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_UPDATED') {
        // Handle cache update notifications
        console.log('Service Worker: Cache updated');
    }
});

console.log('Service Worker: Loaded');
