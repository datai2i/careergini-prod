const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const redis = require('redis');
const { Pool } = require('pg');
const { YouTubeClient, EdXClient, CourseraClient } = require('./integrations/courseApis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Redis client for caching
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://redis:6379/3'
});

redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.connect().catch(err => console.error('Redis connection error:', err));

// Postgres client for progress tracking
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://careergini:changeme@postgres:5432/careergini'
});

// Create table if not exists
pool.query(`
    CREATE TABLE IF NOT EXISTS user_learning_progress (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        course_id VARCHAR(255) NOT NULL,
        course_data JSONB NOT NULL,
        progress_seconds INTEGER DEFAULT 0,
        is_completed BOOLEAN DEFAULT FALSE,
        last_watched TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, course_id)
    );
`).catch(err => console.error('Error creating user_learning_progress table:', err));


// API clients
const youtube = new YouTubeClient();
const edx = new EdXClient();
const coursera = new CourseraClient();

// Helper: Generate cache key
function getCacheKey(topic, level, platform) {
    return `courses:${topic}:${level}:${platform}`;
}

// Helper: Deduplicate courses by title
function deduplicateCourses(courses) {
    const seen = new Set();
    return courses.filter(course => {
        const key = course.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// Helper: Rank courses by quality (rating, platform reputation)
function rankCourses(courses) {
    const platformScores = {
        'edX': 10,
        'Coursera': 9,
        'YouTube': 7
    };

    return courses.map(course => {
        const platformScore = platformScores[course.platform] || 5;
        const ratingScore = course.rating ? course.rating * 2 : 5;
        const qualityScore = (platformScore + ratingScore) / 2;

        return { ...course, qualityScore };
    }).sort((a, b) => b.qualityScore - a.qualityScore);
}

// Helper: Match courses to skills
function matchCoursesToSkills(courses, skills) {
    if (!skills || skills.length === 0) return courses;

    return courses.map(course => {
        const courseText = `${course.title} ${course.description}`.toLowerCase();
        const matchCount = skills.filter(skill =>
            courseText.includes(skill.toLowerCase())
        ).length;

        return { ...course, relevanceScore: matchCount };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'learning-service' });
});

// Get courses with filtering
app.get('/courses', async (req, res) => {
    try {
        let { topic = '', level = '', platform = '', skills = '' } = req.query;
        if (platform === 'all') platform = '';
        const skillsArray = skills ? skills.split(',').map(s => s.trim()) : [];

        // Check cache
        const cacheKey = getCacheKey(topic, level, platform);
        const cached = await redisClient.get(cacheKey);

        if (cached) {
            console.log('✓ Cache HIT for courses:', cacheKey);
            let courses = JSON.parse(cached);

            // Hard filter by platform even if cached
            if (platform) {
                courses = courses.filter(course => course.platform === platform);
            }

            // Apply skill matching even on cached results
            const matched = skillsArray.length > 0 ? matchCoursesToSkills(courses, skillsArray) : courses;
            return res.json(matched);
        }

        console.log('✗ Cache MISS for courses:', cacheKey);

        // Fetch from multiple sources in parallel
        const promises = [];

        if (!platform || platform === 'YouTube') {
            promises.push(youtube.searchCourses(topic));
        }
        if (!platform || platform === 'edX') {
            promises.push(edx.searchCourses(topic, level));
        }
        if (!platform || platform === 'Coursera') {
            promises.push(coursera.searchCourses(topic));
        }

        const results = await Promise.allSettled(promises);

        // Combine results
        let allCourses = [];
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                allCourses.push(...result.value);
            }
        });

        // Deduplicate and rank
        allCourses = deduplicateCourses(allCourses);
        allCourses = rankCourses(allCourses);

        // Filter by level if specified
        if (level && level !== 'all') {
            allCourses = allCourses.filter(course =>
                course.level.toLowerCase().includes(level.toLowerCase())
            );
        }

        // Hard filter by platform
        if (platform && platform !== 'all') {
            allCourses = allCourses.filter(course =>
                course.platform === platform
            );
        }

        // Match to skills
        if (skillsArray.length > 0) {
            allCourses = matchCoursesToSkills(allCourses, skillsArray);
        }

        // Limit to top 50
        allCourses = allCourses.slice(0, 50);

        // Cache for 24 hours
        await redisClient.setEx(cacheKey, 86400, JSON.stringify(allCourses));

        res.json(allCourses);
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// Get recommended courses based on skill gaps
app.get('/recommendations', async (req, res) => {
    try {
        const { skills = '', level = 'beginner' } = req.query;
        const skillsArray = skills ? skills.split(',').map(s => s.trim()) : [];

        if (skillsArray.length === 0) {
            return res.json([]);
        }

        // Fetch courses for each skill from all available platforms
        const coursePromises = [];
        skillsArray.slice(0, 3).forEach(skill => {
            coursePromises.push(youtube.searchCourses(skill));
            coursePromises.push(edx.searchCourses(skill, level));
            coursePromises.push(coursera.searchCourses(skill));
        });

        const results = await Promise.allSettled(coursePromises);
        let courses = [];
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                courses.push(...result.value);
            }
        });

        courses = deduplicateCourses(courses);
        courses = rankCourses(courses);

        res.json(courses.slice(0, 20));
    } catch (error) {
        console.error('Error fetching recommended courses:', error);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

// Save learning progress
app.post('/progress', async (req, res) => {
    try {
        const { user_id, course_id, course_data, progress_seconds, is_completed } = req.body;

        if (!user_id || !course_id) {
            return res.status(400).json({ error: 'user_id and course_id are required' });
        }

        const result = await pool.query(
            `INSERT INTO user_learning_progress (user_id, course_id, course_data, progress_seconds, is_completed, last_watched)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, course_id) 
             DO UPDATE SET 
                course_data = EXCLUDED.course_data,
                progress_seconds = GREATEST(user_learning_progress.progress_seconds, EXCLUDED.progress_seconds),
                is_completed = CASE WHEN EXCLUDED.is_completed = TRUE THEN TRUE ELSE user_learning_progress.is_completed END,
                last_watched = CURRENT_TIMESTAMP
             RETURNING *`,
            [user_id, course_id, course_data || {}, progress_seconds || 0, is_completed || false]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error saving progress:', error);
        res.status(500).json({ error: 'Failed to save progress' });
    }
});

// Get learning progress
app.get('/progress', async (req, res) => {
    try {
        const { user_id } = req.query;
        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        const result = await pool.query(
            'SELECT * FROM user_learning_progress WHERE user_id = $1 ORDER BY last_watched DESC',
            [user_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
});

app.listen(PORT, () => {
    console.log(`Learning Service running on port ${PORT}`);
    console.log(`Using APIs: YouTube, edX, Coursera`);
});
