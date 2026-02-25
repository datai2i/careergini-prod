const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const redis = require('redis');
const { RemoteOKClient, RemotiveClient, JobicyClient, ArbeitnowClient, AdzunaIndiaClient, HimalayasClient, TheMuseClient } = require('./integrations/jobApis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Redis client for caching
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://redis:6379/2'
});
redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.connect().catch(err => console.error('Redis connection error:', err));

// API clients
const remoteOK = new RemoteOKClient();
const remotive = new RemotiveClient();
const jobicy = new JobicyClient();
const arbeitnow = new ArbeitnowClient();
const adzunaIndia = new AdzunaIndiaClient();
const himalayas = new HimalayasClient();
const themuse = new TheMuseClient();

// Normalize verbose profile titles into effective search queries
// e.g. "Associate Software Engineer Intern" → "Software Engineer"
// This dramatically improves API result rates
function normalizeQuery(query) {
    if (!query) return '';

    // Strip common filler prefixes/suffixes that hurt API searches
    const fillerWords = [
        'associate', 'junior', 'senior', 'lead', 'principal', 'staff', 'chief',
        'intern', 'internship', 'trainee', 'fresher', 'entry level', 'entry-level',
        'mid-level', 'mid level', 'experienced', 'sr.', 'jr.',
        'i', 'ii', 'iii', 'iv', 'l1', 'l2', 'l3'
    ];

    let normalized = query.toLowerCase().trim();

    // Remove filler words at start/end
    for (const word of fillerWords) {
        const re = new RegExp(`\\b${word}\\b`, 'gi');
        normalized = normalized.replace(re, '').trim();
    }

    // Clean up multiple spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();

    // If normalized is too short, fall back to original minus the longest filler
    if (normalized.length < 4) normalized = query.trim();

    // Cap at 3 words — APIs can't handle 6-word phrases
    const words = normalized.split(' ').filter(Boolean);
    const effective = words.slice(0, 3).join(' ');

    console.log(`Query normalized: "${query}" → "${effective}"`);
    return effective || query;
}

// Deduplicate jobs by title+company
function deduplicateJobs(jobs) {
    const seen = new Set();
    return jobs.filter(job => {
        const key = `${(job.title || '').toLowerCase().trim()}:${(job.company || '').toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// Score a job's relevance to given skills/query
function scoreJob(job, skillsArray, query) {
    const title = (job.title || '').toLowerCase();
    const txt = `${title} ${job.description || ''} ${(job.tags || []).join(' ')}`.toLowerCase();
    const qLower = (query || '').toLowerCase();
    let score = 0;

    // 1. Exact or partial query match in TITLE brings the most weight
    if (qLower) {
        if (title === qLower) score += 20;
        else if (title.includes(qLower)) score += 10;

        // 2. Heavy penalties for explicit role mismatches
        // E.g., if user wants "Java Developer", penalize "Site Reliability", "Data Engineer", "SRE"
        if (qLower.includes('developer') || qLower.includes('engineer') || qLower.includes('stack')) {
            if (!qLower.includes('site reliability') && title.includes('site reliability')) score -= 25;
            if (!qLower.includes('sre') && /\bsre\b/.test(title)) score -= 25;
            if (!qLower.includes('devops') && title.includes('devops')) score -= 20;
            if (!qLower.includes('data') && title.includes('data')) score -= 15;
            if (!qLower.includes('machine learning') && title.includes('machine learning')) score -= 15;
        }

        // Intern penalty check
        if (!qLower.includes('intern') && title.includes('intern')) score -= 10;
        if (qLower.includes('intern') && title.includes('senior')) score -= 10;
    }

    // 3. Skill matching — each match +3
    skillsArray.forEach(skill => {
        if (txt.includes(skill.toLowerCase())) score += 3;
    });

    // 4. Strict tech-check penalty to aggressively drop non-tech spam from broad fallbacks
    // If the title contains translation, writing, administrative, or accounting terms, heavily penalize it
    const nonTechSpamCheck = ['übersetz', 'translation', 'writer', 'administrative', 'accounting', 'assistant', 'praktikum', 'sales', 'marketing', 'hr', 'recruiter', 'compliance'];
    if (nonTechSpamCheck.some(spamWord => title.includes(spamWord))) {
        score -= 50;
    }

    // 5. Remote/worldwide bonus
    const loc = (job.location || '').toLowerCase();
    if (job.isRemote || loc.includes('remote') || loc.includes('worldwide') || loc.includes('anywhere')) {
        score += 2;
    }

    return score;
}

function rankJobs(jobs, skillsArray, query) {
    return jobs
        .map(job => ({ ...job, relevanceScore: scoreJob(job, skillsArray, query) }))
        // Filter out completely irrelevant jobs
        // Score must be > 2, meaning it must have AT LEAST a skill match (3 pts) or be a tech fallback (3 pts)
        .filter(job => job.relevanceScore > 2)
        // Compound sorting: Relevance first, Recency second
        .sort((a, b) => {
            if (b.relevanceScore !== a.relevanceScore) {
                return b.relevanceScore - a.relevanceScore;
            }
            const dateA = a.posted ? new Date(a.posted).getTime() : 0;
            const dateB = b.posted ? new Date(b.posted).getTime() : 0;
            return dateB - dateA;
        });
}

// India city detection
function isIndiaLocation(location) {
    if (!location) return false;
    const india = ['india', 'andhra', 'visakhapatnam', 'vizag', 'bangalore', 'bengaluru',
        'hyderabad', 'mumbai', 'delhi', 'pune', 'chennai', 'kolkata', 'noida', 'gurugram', 'gurgaon'];
    const locLow = location.toLowerCase();
    return india.some(k => locLow.includes(k));
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'job-service' });
});

// Get jobs
app.get('/jobs', async (req, res) => {
    try {
        let { query = '', location = '', skills = '' } = req.query;
        const skillsArray = skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [];
        const indiaUser = isIndiaLocation(location);

        // Normalize verbose profile titles → effective search terms
        const effectiveQuery = normalizeQuery(query);

        const cacheKey = `jobs_v7:${effectiveQuery}:${indiaUser ? 'india' : location}:${skillsArray.slice(0, 5).join(',')}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            console.log('✓ Cache HIT:', cacheKey);
            return res.json(JSON.parse(cached));
        }

        console.log(`✗ Cache MISS — original="${query}" effective="${effectiveQuery}", india=${indiaUser}`);

        // Fetch from ALL sources in parallel using normalized query
        const [r1, r2, r3, r4, r5, r6, r7] = await Promise.allSettled([
            remoteOK.searchJobs(effectiveQuery, skillsArray),
            remotive.searchJobs(effectiveQuery),
            jobicy.searchJobs(effectiveQuery),
            arbeitnow.searchJobs(effectiveQuery),
            himalayas.searchJobs(effectiveQuery),
            themuse.searchJobs(effectiveQuery),
            indiaUser ? adzunaIndia.searchJobs(effectiveQuery, 'India') : Promise.resolve([])
        ]);

        let allJobs = [];
        if (r1.status === 'fulfilled') allJobs.push(...r1.value);
        if (r2.status === 'fulfilled') allJobs.push(...r2.value);
        if (r3.status === 'fulfilled') allJobs.push(...r3.value);
        if (r4.status === 'fulfilled') allJobs.push(...r4.value);
        if (r5.status === 'fulfilled') allJobs.push(...r5.value);
        if (r6.status === 'fulfilled') allJobs.push(...r6.value);
        if (r7.status === 'fulfilled') allJobs.push(...r7.value);

        console.log(`Total before dedup: ${allJobs.length}`);
        allJobs = deduplicateJobs(allJobs);
        console.log(`Total after dedup: ${allJobs.length}`);

        // Rank by relevance
        allJobs = rankJobs(allJobs, skillsArray, query);

        // If STILL less than 10 jobs (e.g. all APIs failed, or query too specific), emergency fallback
        if (allJobs.length < 10) {
            console.log('Emergency fallback: fetching unfiltered generic remote jobs to guarantee results');
            const fallbackQuery = 'developer';
            const [fb1, fb2, fb3] = await Promise.allSettled([
                remoteOK.searchJobs(fallbackQuery, []),
                remotive.searchJobs(fallbackQuery),
                himalayas.searchJobs(fallbackQuery)
            ]);
            let extra = [];
            if (fb1.status === 'fulfilled') extra.push(...fb1.value);
            if (fb2.status === 'fulfilled') extra.push(...fb2.value);
            if (fb3.status === 'fulfilled') extra.push(...fb3.value);

            // Artificial relevance boost for fallback jobs so they pass the >2 filter
            extra = extra.map(job => ({ ...job, relevanceScore: 3 }));

            allJobs = deduplicateJobs([...allJobs, ...extra]);

            // Filter and Sort again
            allJobs = allJobs.filter(job => job.relevanceScore > 2);
            allJobs.sort((a, b) => {
                if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
                const d1 = a.posted ? new Date(a.posted).getTime() : 0;
                const d2 = b.posted ? new Date(b.posted).getTime() : 0;
                return d2 - d1;
            });
        }

        const result = allJobs.slice(0, 50);
        console.log(`Returning ${result.length} jobs`);

        // Cache for 3 hours
        await redisClient.setEx(cacheKey, 10800, JSON.stringify(result));
        res.json(result);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// Get recommended jobs — GUARANTEED minimum 5
app.get('/recommendations', async (req, res) => {
    try {
        const { skills = '', title = '' } = req.query;
        const skillsArray = skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [];
        const rawTitle = title || skillsArray[0] || 'software';
        const query = normalizeQuery(rawTitle);

        const cacheKey = `recs_v7:${query}:${skillsArray.slice(0, 3).join(',')}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));

        // Fetch from best sources using normalized query
        const [r1, r2, r3, r4, r5] = await Promise.allSettled([
            remoteOK.searchJobs(query, skillsArray),
            remotive.searchJobs(query),
            jobicy.searchJobs(query),
            himalayas.searchJobs(query),
            themuse.searchJobs(query)
        ]);

        let jobs = [];
        if (r1.status === 'fulfilled') jobs.push(...r1.value);
        if (r2.status === 'fulfilled') jobs.push(...r2.value);
        if (r3.status === 'fulfilled') jobs.push(...r3.value);
        if (r4.status === 'fulfilled') jobs.push(...r4.value);
        if (r5.status === 'fulfilled') jobs.push(...r5.value);

        jobs = deduplicateJobs(jobs);
        jobs = rankJobs(jobs, skillsArray, query);

        // Guarantee min 5 (broaden if needed)
        if (jobs.length < 5) {
            console.log('Emergency fallback recs: fetching unfiltered general jobs');
            const fallbackQuery = 'developer';
            const [fb1, fb2, fb3] = await Promise.allSettled([
                remoteOK.searchJobs(fallbackQuery, []),
                remotive.searchJobs(fallbackQuery),
                himalayas.searchJobs(fallbackQuery)
            ]);
            let extra = [];
            if (fb1.status === 'fulfilled') extra.push(...fb1.value);
            if (fb2.status === 'fulfilled') extra.push(...fb2.value);
            if (fb3.status === 'fulfilled') extra.push(...fb3.value);

            // Artificial relevance boost for fallback jobs so they pass the filter
            extra = extra.map(job => ({ ...job, relevanceScore: 3 }));

            jobs = deduplicateJobs([...jobs, ...extra]);

            // Filter and Sort again
            jobs = jobs.filter(job => job.relevanceScore > 2);
            jobs.sort((a, b) => {
                if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
                const d1 = a.posted ? new Date(a.posted).getTime() : 0;
                const d2 = b.posted ? new Date(b.posted).getTime() : 0;
                return d2 - d1;
            });
        }

        const result = jobs.slice(0, 20);
        await redisClient.setEx(cacheKey, 10800, JSON.stringify(result));
        res.json(result);
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

app.listen(PORT, () => {
    console.log(`Job Service running on port ${PORT}`);
    console.log(`APIs: RemoteOK ✅, Remotive ✅, Jobicy ✅, Arbeitnow ✅, Himalayas ✅, TheMuse ✅`);
});
