// 🚀 MOBILE-OPTIMIZED Car Boot Site JavaScript
let currentStatus = false;
let customNotice = '';
let galleryImages = [];
let isInitialized = false;

// Device detection and performance optimization
const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isSlowConnection = navigator.connection && navigator.connection.effectiveType && 
                        ['slow-2g', '2g', '3g'].includes(navigator.connection.effectiveType);
const isLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;

// Performance monitoring
const performanceObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
            console.log(`Page load time: ${entry.loadEventEnd - entry.loadEventStart}ms`);
        }
    }
});

if ('PerformanceObserver' in window) {
    performanceObserver.observe({ entryTypes: ['navigation', 'resource'] });
}

// API URLs with cache busting
const API_BASE = window.location.origin;
const API_STATUS = `${API_BASE}/api/status`;
const API_GALLERY = `${API_BASE}/api/gallery`;
const API_HERO_BG = `${API_BASE}/api/hero-background`;

// 🚀 Optimized fetch with timeout and retry logic for mobile
async function fetchWithTimeout(url, timeout = 5000, retries = 2) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(`${url}?t=${Date.now()}&v=${attempt}`, {
                signal: controller.signal,
                headers: { 
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (attempt === retries || error.name === 'AbortError') {
                console.error('Fetch error:', error.name, 'URL:', url);
                return null;
            }
            
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}

// 🚀 MOBILE: Fast status fetch with caching
async function fetchStatus() {
    const cached = sessionStorage.getItem('statusCache');
    const cacheTime = sessionStorage.getItem('statusCacheTime');
    
    // Use cache if less than 30 seconds old
    if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 30000) {
        return JSON.parse(cached);
    }
    
    const data = await fetchWithTimeout(API_STATUS, 3000);
    
    if (data) {
        sessionStorage.setItem('statusCache', JSON.stringify(data));
        sessionStorage.setItem('statusCacheTime', Date.now().toString());
    }
    
    return data;
}

// 🚀 MOBILE: Lazy load gallery only when needed
async function fetchGallery() {
    // Skip gallery on slow connections initially
    if (isSlowConnection && !isInitialized) {
        setTimeout(() => fetchGallery(), 2000);
        return [];
    }
    
    const data = await fetchWithTimeout(API_GALLERY, 5000);
    return data?.images || [];
}

// 🚀 MOBILE: Lazy load hero background
async function fetchHeroBackground() {
    // Load hero background after other content on mobile
    if (isMobile && !isInitialized) {
        setTimeout(() => fetchHeroBackground(), 1000);
        return null;
    }
    
    return await fetchWithTimeout(API_HERO_BG, 5000);
}

// 🚀 MOBILE: Optimized status display with animation
function updateStatusDisplay() {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const customNoticeDiv = document.getElementById('customNotice');
    const customNoticeText = document.getElementById('customNoticeText');

    if (statusIndicator && statusText) {
        // Add loading state first
        statusIndicator.style.opacity = '0.7';
        
        setTimeout(() => {
            if (currentStatus) {
                statusIndicator.className = 'status-indicator open';
                statusText.textContent = 'CURRENTLY OPEN';
                statusIndicator.setAttribute('aria-label', 'Car boot sale is currently open');
            } else {
                statusIndicator.className = 'status-indicator closed';
                statusText.textContent = 'CURRENTLY CLOSED';
                statusIndicator.setAttribute('aria-label', 'Car boot sale is currently closed');
            }
            statusIndicator.style.opacity = '1';
        }, 100);
    }

    // Handle custom notice
    if (customNotice && customNotice.trim()) {
        if (customNoticeText) customNoticeText.textContent = customNotice;
        if (customNoticeDiv) {
            customNoticeDiv.classList.remove('hidden');
            customNoticeDiv.setAttribute('aria-label', `Notice: ${customNotice}`);
        }
    } else {
        if (customNoticeDiv) {
            customNoticeDiv.classList.add('hidden');
            customNoticeDiv.removeAttribute('aria-label');
        }
    }
}

// 🚀 MOBILE: Lazy image loading with intersection observer
function setupLazyImages() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px 0px',
            threshold: 0.1
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
}

// 🚀 MOBILE: Optimized gallery display
function displayGallery(images) {
    const container = document.getElementById('galleryContainer');
    const empty = document.getElementById('galleryEmpty');

    if (!container || !empty) return;

    if (!images || images.length === 0) {
        container.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
    }

    container.classList.remove('hidden');
    empty.classList.add('hidden');

    // Clear existing content
    container.innerHTML = '';

    // Create gallery items with lazy loading
    images.forEach((image, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        const img = document.createElement('img');
        img.className = 'lazy';
        img.dataset.src = `/uploads/gallery/${image.filename}`;
        img.alt = `Gallery image ${index + 1}`;
        img.loading = 'lazy';

        // Add loading placeholder
        img.style.opacity = '0';
        img.onload = () => {
            img.style.opacity = '1';
        };

        item.appendChild(img);
        container.appendChild(item);
    });

    // Setup lazy loading for new images
    setupLazyImages();
}

// 🚀 MOBILE: Optimized hero background
function updateHeroBackground(heroData) {
    if (!heroData || !heroData.filename) return;

    const hero = document.querySelector('.hero');
    if (hero) {
        hero.style.backgroundImage = `linear-gradient(135deg, rgba(6, 95, 212, 0.9) 0%, rgba(3, 86, 214, 0.9) 100%), url('/uploads/hero/${heroData.filename}')`;
        hero.style.backgroundSize = 'cover';
        hero.style.backgroundPosition = 'center';
        hero.style.backgroundAttachment = 'fixed';
    }
}

// 🚀 MOBILE: Smooth scrolling for navigation
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// 🚀 MOBILE: Touch-friendly interactions
function setupTouchInteractions() {
    if (isMobile) {
        // Add touch feedback to buttons
        document.querySelectorAll('.btn, .nav-link, .theme-toggle').forEach(button => {
            button.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.95)';
            });
            
            button.addEventListener('touchend', function() {
                this.style.transform = '';
            });
        });
    }
}

// 🚀 MOBILE: Performance monitoring and error handling
function setupErrorHandling() {
    window.addEventListener('error', (event) => {
        console.error('JavaScript error:', event.error);
        // Could send to analytics service here
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        // Could send to analytics service here
    });
}

// 🚀 MOBILE: Service Worker registration for offline support
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }
}

// 🚀 MOBILE: Main initialization function
async function initializeApp() {
    try {
        console.log('🚀 Initializing Car Boot website...');
        
        // Setup error handling first
        setupErrorHandling();
        
        // Setup smooth scrolling
        setupSmoothScrolling();
        
        // Setup touch interactions
        setupTouchInteractions();
        
        // Fetch initial data
        const [statusData, galleryData, heroData] = await Promise.allSettled([
            fetchStatus(),
            fetchGallery(),
            fetchHeroBackground()
        ]);

        // Update status
        if (statusData.status === 'fulfilled' && statusData.value) {
            currentStatus = statusData.value.status;
            customNotice = statusData.value.notice || '';
            updateStatusDisplay();
        }

        // Update gallery
        if (galleryData.status === 'fulfilled') {
            galleryImages = galleryData.value;
            displayGallery(galleryImages);
        }

        // Update hero background
        if (heroData.status === 'fulfilled' && heroData.value) {
            updateHeroBackground(heroData.value);
        }

        // Register service worker
        registerServiceWorker();

        // Mark as initialized
        isInitialized = true;
        
        console.log('✅ App initialized successfully');
        
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        
        // Show fallback status
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        if (statusIndicator && statusText) {
            statusIndicator.className = 'status-indicator closed';
            statusText.textContent = 'STATUS UNAVAILABLE';
            statusIndicator.setAttribute('aria-label', 'Status information is currently unavailable');
        }
    }
}

// 🚀 MOBILE: Auto-refresh status every 30 seconds
function startStatusRefresh() {
    setInterval(async () => {
        const statusData = await fetchStatus();
        if (statusData) {
            const newStatus = statusData.status;
            const newNotice = statusData.notice || '';
            
            if (newStatus !== currentStatus || newNotice !== customNotice) {
                currentStatus = newStatus;
                customNotice = newNotice;
                updateStatusDisplay();
                console.log('🔄 Status updated:', newStatus ? 'OPEN' : 'CLOSED');
            }
        }
    }, 30000);
}

// 🚀 MOBILE: Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// 🚀 MOBILE: Start status refresh after initialization
setTimeout(startStatusRefresh, 30000);

// 🚀 MOBILE: Export functions for global access
window.CarBootApp = {
    fetchStatus,
    fetchGallery,
    updateStatusDisplay,
    displayGallery,
    updateHeroBackground
};

// 🚀 MOBILE: Performance optimization - preload critical resources
function preloadCriticalResources() {
    const criticalResources = [
        '/styles-mobile.css',
        '/app.js'
    ];

    criticalResources.forEach(resource => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = resource;
        link.as = resource.endsWith('.css') ? 'style' : 'script';
        document.head.appendChild(link);
    });
}

// 🚀 MOBILE: Call preload function
preloadCriticalResources();
