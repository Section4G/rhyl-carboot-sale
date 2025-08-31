const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// File paths
const DATA_FILE = path.join(__dirname, 'status.json');
const GALLERY_FILE = path.join(__dirname, 'gallery.json');
const HERO_BG_FILE = path.join(__dirname, 'hero-background.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const GALLERY_UPLOADS_DIR = path.join(UPLOADS_DIR, 'gallery');
const HERO_UPLOADS_DIR = path.join(UPLOADS_DIR, 'hero');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'noblesrhyl1121';

// Security middleware
const helmet = require('helmet');

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit admin endpoints to 10 requests per windowMs
    message: 'Too many admin requests, please try again later.',
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "https://images.unsplash.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            frameSrc: ["'self'", "https://www.google.com"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            upgradeInsecureRequests: []
        },
    },
    crossOriginEmbedderPolicy: false,
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'https://rhylcarboot.com', 'https://rhyl-carboot-sale.onrender.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);

// Input validation middleware
function validateStatusData(req, res, next) {
    const { status, notice } = req.body;
    
    if (typeof status !== 'boolean') {
        return res.status(400).json({ error: 'Status must be a boolean value' });
    }
    
    if (notice && typeof notice !== 'string') {
        return res.status(400).json({ error: 'Notice must be a string' });
    }
    
    if (notice && notice.length > 500) {
        return res.status(400).json({ error: 'Notice must be less than 500 characters' });
    }
    
    next();
}

function validatePassword(req, res, next) {
    const { password } = req.body;
    
    if (!password || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid password' });
    }
    
    next();
}

// Create upload directories
async function createUploadDirectories() {
    try {
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        await fs.mkdir(GALLERY_UPLOADS_DIR, { recursive: true });
        await fs.mkdir(HERO_UPLOADS_DIR, { recursive: true });
        console.log('✅ Upload directories created');
    } catch (error) {
        console.error('❌ Error creating upload directories:', error);
    }
}

// Multer configuration with enhanced security
const galleryStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, GALLERY_UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, 'gallery-' + uniqueSuffix + path.extname(sanitizedName));
    }
});

const heroStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, HERO_UPLOADS_DIR),
    filename: (req, file, cb) => {
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, 'hero-background' + path.extname(sanitizedName));
    }
});

// Enhanced file filter with MIME type validation
const imageFileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    if (!allowedMimes.includes(file.mimetype)) {
        return cb(new Error('Invalid file type. Only images are allowed.'), false);
    }
    
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
        return cb(new Error('Invalid file extension. Only .jpg, .jpeg, .png, .gif, .webp are allowed.'), false);
    }
    
    cb(null, true);
};

const uploadGallery = multer({
    storage: galleryStorage,
    limits: { 
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 10 // Max 10 files at once
    },
    fileFilter: imageFileFilter
});

const uploadHero = multer({
    storage: heroStorage,
    limits: { 
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1 // Only 1 file
    },
    fileFilter: imageFileFilter
});

// Serve static files with cache-busting
app.use(express.static(__dirname, {
    maxAge: '1h', // Reduced from 1 day to 1 hour
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        if (path.endsWith('.css') || path.endsWith('.js')) {
            res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate'); // 1 hour with must-revalidate
        }
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

app.use('/uploads', express.static(UPLOADS_DIR, {
    maxAge: '7d',
    etag: true,
    lastModified: true
}));

// Initialize data files
async function initializeDataFiles() {
    try {
        // Status file
        try {
            await fs.access(DATA_FILE);
        } catch {
            const defaultData = { status: false, notice: '', lastUpdated: new Date().toISOString() };
            await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2));
            console.log('✅ Created status.json');
        }

        // Gallery file
        try {
            await fs.access(GALLERY_FILE);
        } catch {
            const defaultGallery = { images: [] };
            await fs.writeFile(GALLERY_FILE, JSON.stringify(defaultGallery, null, 2));
            console.log('✅ Created gallery.json');
        }

        // Hero background file
        try {
            await fs.access(HERO_BG_FILE);
        } catch {
            const defaultHero = { filename: null, uploadedAt: null };
            await fs.writeFile(HERO_BG_FILE, JSON.stringify(defaultHero, null, 2));
            console.log('✅ Created hero-background.json');
        }
    } catch (error) {
        console.error('❌ Error initializing data files:', error);
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB for gallery, 10MB for hero.' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files uploaded.' });
        }
        return res.status(400).json({ error: 'File upload error: ' + error.message });
    }
    
    if (error.message.includes('Invalid file type') || error.message.includes('Invalid file extension')) {
        return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
});

// API Routes with enhanced security and validation

// Get status
app.get('/api/status', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const statusData = JSON.parse(data);
        res.json(statusData);
    } catch (error) {
        console.error('Error reading status:', error);
        res.status(500).json({ error: 'Failed to read status' });
    }
});

// Update status (admin only)
app.post('/api/status', adminLimiter, validatePassword, validateStatusData, async (req, res) => {
    try {
        const { status, notice } = req.body;
        const statusData = {
            status: Boolean(status),
            notice: notice || '',
            lastUpdated: new Date().toISOString()
        };
        
        await fs.writeFile(DATA_FILE, JSON.stringify(statusData, null, 2));
        console.log(`✅ Status updated: ${status ? 'OPEN' : 'CLOSED'}`);
        res.json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Get gallery
app.get('/api/gallery', async (req, res) => {
    try {
        const data = await fs.readFile(GALLERY_FILE, 'utf8');
        const galleryData = JSON.parse(data);
        res.json(galleryData);
    } catch (error) {
        console.error('Error reading gallery:', error);
        res.status(500).json({ error: 'Failed to read gallery' });
    }
});

// Upload gallery images (admin only)
app.post('/api/gallery/upload', adminLimiter, validatePassword, uploadGallery.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const data = await fs.readFile(GALLERY_FILE, 'utf8');
        const galleryData = JSON.parse(data);
        
        const newImages = req.files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            uploadedAt: new Date().toISOString(),
            size: file.size,
            mimetype: file.mimetype
        }));
        
        galleryData.images = [...galleryData.images, ...newImages];
        
        await fs.writeFile(GALLERY_FILE, JSON.stringify(galleryData, null, 2));
        console.log(`✅ ${newImages.length} gallery images uploaded`);
        res.json({ success: true, message: `${newImages.length} images uploaded successfully` });
    } catch (error) {
        console.error('Error uploading gallery images:', error);
        res.status(500).json({ error: 'Failed to upload images' });
    }
});

// Delete gallery image (admin only)
app.delete('/api/gallery/:filename', adminLimiter, validatePassword, async (req, res) => {
    try {
        const { filename } = req.params;
        
        // Validate filename
        if (!filename || filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        
        const data = await fs.readFile(GALLERY_FILE, 'utf8');
        const galleryData = JSON.parse(data);
        
        const imageIndex = galleryData.images.findIndex(img => img.filename === filename);
        if (imageIndex === -1) {
            return res.status(404).json({ error: 'Image not found' });
        }
        
        // Delete file from filesystem
        try {
            await fs.unlink(path.join(GALLERY_UPLOADS_DIR, filename));
        } catch (fileError) {
            console.warn('File not found on filesystem, continuing with database cleanup');
        }
        
        // Remove from gallery data
        galleryData.images.splice(imageIndex, 1);
        await fs.writeFile(GALLERY_FILE, JSON.stringify(galleryData, null, 2));
        
        console.log(`✅ Gallery image deleted: ${filename}`);
        res.json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Error deleting gallery image:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

// Get hero background
app.get('/api/hero-background', async (req, res) => {
    try {
        const data = await fs.readFile(HERO_BG_FILE, 'utf8');
        const heroData = JSON.parse(data);
        res.json(heroData);
    } catch (error) {
        console.error('Error reading hero background:', error);
        res.status(500).json({ error: 'Failed to read hero background' });
    }
});

// Upload hero background (admin only)
app.post('/api/hero-background/upload', adminLimiter, validatePassword, uploadHero.single('heroImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const heroData = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            uploadedAt: new Date().toISOString(),
            size: req.file.size,
            mimetype: req.file.mimetype
        };
        
        await fs.writeFile(HERO_BG_FILE, JSON.stringify(heroData, null, 2));
        console.log('✅ Hero background uploaded');
        res.json({ success: true, message: 'Hero background uploaded successfully' });
    } catch (error) {
        console.error('Error uploading hero background:', error);
        res.status(500).json({ error: 'Failed to upload hero background' });
    }
});

// Delete hero background (admin only)
app.delete('/api/hero-background', adminLimiter, validatePassword, async (req, res) => {
    try {
        const data = await fs.readFile(HERO_BG_FILE, 'utf8');
        const heroData = JSON.parse(data);
        
        if (heroData.filename) {
            // Delete file from filesystem
            try {
                await fs.unlink(path.join(HERO_UPLOADS_DIR, heroData.filename));
            } catch (fileError) {
                console.warn('Hero background file not found on filesystem');
            }
        }
        
        const defaultHero = { filename: null, uploadedAt: null };
        await fs.writeFile(HERO_BG_FILE, JSON.stringify(defaultHero, null, 2));
        
        console.log('✅ Hero background deleted');
        res.json({ success: true, message: 'Hero background deleted successfully' });
    } catch (error) {
        console.error('Error deleting hero background:', error);
        res.status(500).json({ error: 'Failed to delete hero background' });
    }
});

// Admin panel route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Initialize and start server
async function startServer() {
    try {
        await createUploadDirectories();
        await initializeDataFiles();
        
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📁 Upload directories: ${UPLOADS_DIR}`);
            console.log(`🔒 Admin password: ${ADMIN_PASSWORD}`);
            console.log(`🌐 Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    process.exit(0);
});
