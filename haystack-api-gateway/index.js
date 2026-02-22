const express = require('express');
const cors = require('cors');
const proxy = require('express-http-proxy');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(morgan('dev'));

// Service URLs
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://haystack-service:8002';
const PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL || 'http://careergini-profile:3001';
const JOB_SERVICE_URL = process.env.JOB_SERVICE_URL || 'http://job-service:3002';
const LEARNING_SERVICE_URL = process.env.LEARNING_SERVICE_URL || 'http://learning-service:3003';
const APPLICATION_SERVICE_URL = process.env.APPLICATION_SERVICE_URL || 'http://application-service:8006';

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'api-gateway' });
});

// Proxy routes - file uploads need special handling
app.use('/api/ai', proxy(AI_SERVICE_URL, {
    timeout: 1800000, // 30 minutes
    parseReqBody: false, // Don't parse body for file uploads
    proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
        // Preserve content-type for multipart/form-data
        return proxyReqOpts;
    }
}));

app.use('/api/profile', proxy(PROFILE_SERVICE_URL));

app.use('/api/jobs', proxy(JOB_SERVICE_URL, {
    proxyReqPathResolver: function (req) {
        return req.originalUrl.replace('/api/jobs', '');
    }
}));

app.use('/api/learning', proxy(LEARNING_SERVICE_URL));

app.use('/api/applications', proxy(APPLICATION_SERVICE_URL, {
    proxyReqPathResolver: function (req) {
        return req.originalUrl.replace('/api', '');
    }
}));

// Resume routes (handled by AI Service)
app.use('/api/resume', proxy(AI_SERVICE_URL, {
    timeout: 1800000, // 30 minutes
    parseReqBody: false, // Don't parse body for file uploads
    proxyReqPathResolver: function (req) {
        // req.url on `app.use` is relative to mount point
        // Use originalUrl to be safe and explicit: /api/resume/upload -> /resume/upload
        return req.originalUrl.replace('/api', '');
    },
    proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
        // Preserve content-type for multipart/form-data
        return proxyReqOpts;
    }
}));

// Route for serving static files (PDFs)
app.use('/api/uploads', proxy(AI_SERVICE_URL, {
    proxyReqPathResolver: function (req) {
        // /api/uploads/user/file.pdf -> /uploads/user/file.pdf
        return '/uploads' + req.url;
    }
}));

const server = app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
});

// Overwrite default Node.js 120s HTTP timeout mechanisms
server.timeout = 1200000;
server.keepAliveTimeout = 1200000;
server.headersTimeout = 1200000;
