const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const passport = require('./auth');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(passport.initialize());

console.log('[startup] FRONTEND_URL from env:', process.env.FRONTEND_URL);
if (!process.env.FRONTEND_URL) {
    console.warn('[startup] WARNING: FRONTEND_URL is not set! Using fallback: https://www.careergini.com');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Generate JWT Token
function generateToken(user) {
    return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'profile-service' });
});

// --- Auth Routes ---

const getFrontendUrl = (state) => {
    // Priority 1: explicitly set environment variable
    if (process.env.FRONTEND_URL) {
        console.log('[auth] Using FRONTEND_URL from process.env:', process.env.FRONTEND_URL);
        return process.env.FRONTEND_URL;
    }

    // Priority 2: Hardcoded fallback (Production)
    console.warn('[auth] FRONTEND_URL missing at runtime, falling back to Prod');
    return 'https://www.careergini.com';
};

// Google
app.get('/auth/google', (req, res, next) => {
    const state = req.query.source === 'haystack' ? 'haystack' : 'langchain';
    passport.authenticate('google', { scope: ['profile', 'email'], state })(req, res, next);
});
app.get('/auth/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req, res) => {
        const token = generateToken(req.user);
        const frontendUrl = getFrontendUrl(req.query.state);
        res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    }
);

// LinkedIn
app.get('/auth/linkedin', (req, res, next) => {
    const state = req.query.source === 'haystack' ? 'haystack' : 'langchain';
    passport.authenticate('linkedin', { state })(req, res, next);
});
app.get('/auth/linkedin/callback',
    passport.authenticate('linkedin', { session: false, failureRedirect: '/login' }),
    (req, res) => {
        const token = generateToken(req.user);
        const frontendUrl = getFrontendUrl(req.query.state);
        res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    }
);

// GitHub
app.get('/auth/github', (req, res, next) => {
    const state = req.query.source === 'haystack' ? 'haystack' : 'langchain';
    passport.authenticate('github', { scope: ['user:email'], state })(req, res, next);
});
app.get('/auth/github/callback',
    passport.authenticate('github', { session: false, failureRedirect: '/login' }),
    (req, res) => {
        const token = generateToken(req.user);
        const frontendUrl = getFrontendUrl(req.query.state);
        res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    }
);

// Middleware to verify JWT
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Protected Route: Get Profile
app.get('/me', verifyToken, async (req, res) => {
    try {
        const client = await db.pool.connect();
        try {
            // Get user info
            const userRes = await client.query('SELECT id, email, full_name, avatar_url FROM users WHERE id = $1', [req.user.id]);
            const user = userRes.rows[0];
            console.log(`[me] Serving user data for ${req.user.id}: name="${user?.full_name}"`);

            if (!user) return res.status(404).json({ error: 'User not found' });

            // Get profile info
            const profileRes = await client.query('SELECT * FROM profiles WHERE user_id = $1', [req.user.id]);
            const profile = profileRes.rows[0] || {};

            // Allow mock response for testing/onboarding if db is empty
            if (!profile.skills && !user.email) {
                // Should not happen with new schema, but good fallback
            }

            // Prevent profile.id from overwriting user.id
            if (profile.id) {
                profile.profile_id = profile.id;
                delete profile.id;
            }

            res.json({ ...user, ...profile });

        } finally {
            client.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Protected Route: Update Profile (Onboarding)
app.post('/profile', verifyToken, async (req, res) => {
    const { headline, summary, location, skills, experience, education, goals, onboarding_completed } = req.body;

    try {
        const query = `
            UPDATE profiles 
            SET headline = COALESCE($1, headline),
                summary = COALESCE($2, summary),
                location = COALESCE($3, location),
                skills = COALESCE($4, skills),
                experience = COALESCE($5, experience),
                education = COALESCE($6, education),
                goals = COALESCE($7, goals),
                onboarding_completed = COALESCE($8, onboarding_completed),
                updated_at = NOW()
            WHERE user_id = $9
            RETURNING *
        `;
        const values = [headline, summary, location, skills, JSON.stringify(experience), JSON.stringify(education), JSON.stringify(goals), onboarding_completed, req.user.id];

        const result = await db.query(query, values);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Internal Route: Sync resume data from haystack-service into the profile DB
// Called server-side after resume upload — no user token required (internal only)
app.post('/sync-resume', async (req, res) => {
    const { user_id, full_name, headline, summary, location, skills, experience, education, latest_resume_filename, latest_resume_path } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    // UUID Validation Helper
    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (!isUUID(user_id)) {
        console.warn(`[sync-resume] Refusing sync for non-UUID user_id: ${user_id}`);
        return res.status(400).json({ error: 'Invalid user_id format (UUID required)' });
    }

    try {
        // UPDATE only — the profiles row is created at login via auth upsert
        // skills is text[] in pg; experience/education are jsonb
        const query = `
            INSERT INTO profiles (
                user_id, headline, summary, location, skills, experience, education, 
                latest_resume_filename, latest_resume_path, last_parsed_at, updated_at
            )
            VALUES (
                $1::uuid, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, NOW(), NOW()
            )
            ON CONFLICT (user_id) DO UPDATE
            SET headline = COALESCE(EXCLUDED.headline, profiles.headline),
                summary = COALESCE(EXCLUDED.summary, profiles.summary),
                location = COALESCE(EXCLUDED.location, profiles.location),
                skills = COALESCE(EXCLUDED.skills, profiles.skills),
                experience = COALESCE(EXCLUDED.experience, profiles.experience),
                education = COALESCE(EXCLUDED.education, profiles.education),
                latest_resume_filename = COALESCE(EXCLUDED.latest_resume_filename, profiles.latest_resume_filename),
                latest_resume_path = COALESCE(EXCLUDED.latest_resume_path, profiles.latest_resume_path),
                last_parsed_at = NOW(),
                updated_at = NOW()
            RETURNING *
        `;
        const values = [
            user_id,
            headline || full_name || null,
            summary || null,
            location || null,
            skills && skills.length ? skills : null,          // text[] — pass JS array directly
            experience && experience.length ? JSON.stringify(experience) : null,  // jsonb
            education && education.length ? JSON.stringify(education) : null,     // jsonb
            latest_resume_filename || null,
            latest_resume_path || null
        ];
        const result = await db.query(query, values);

        // --- ADVANCED SYNC: Update the main User Name if provided ---
        // Only update if it's a real name (not the default 'Candidate')
        console.log(`[sync-resume] Advanced sync check for name: "${full_name}"`);
        if (full_name && full_name.trim() && full_name.toLowerCase() !== 'candidate') {
            try {
                const userUpdate = await db.query('UPDATE users SET full_name = $1 WHERE id = $2::uuid RETURNING *', [full_name.trim(), user_id]);
                if (userUpdate.rowCount > 0) {
                    console.log(`[sync-resume] SUCCESS: Updated official full_name for user ${user_id} to "${full_name.trim()}"`);
                } else {
                    console.warn(`[sync-resume] WARNING: No user found with id ${user_id} in users table`);
                }
            } catch (err) {
                console.error(`[sync-resume] ERROR: Failed to update official full_name: ${err.message}`);
            }
        }

        if (result.rowCount === 0) {
            console.warn(`[sync-resume] No profile row found for user ${user_id} — user must complete onboarding first`);
            return res.json({ status: 'no_profile', message: 'Profile not found; data will be available after onboarding' });
        }
        console.log(`[sync-resume] Synced profile for user ${user_id}`);
        res.json({ status: 'ok', profile: result.rows[0] });
    } catch (err) {
        console.error('[sync-resume] Error:', err);
        res.status(500).json({ error: 'Failed to sync resume to profile', detail: err.message });
    }
});


app.listen(PORT, () => {
    console.log(`Profile Service running on port ${PORT}`);
});
