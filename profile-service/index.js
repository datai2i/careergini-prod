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
// Generate JWT Token with Role & Plan
function generateToken(user) {
    return jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role || 'user',
        plan: user.plan || 'free'
    }, JWT_SECRET, { expiresIn: '7d' });
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

// Middleware to verify Admin role
const verifyAdmin = async (req, res, next) => {
    await verifyToken(req, res, async () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    });
};

// Protected Route: Get Profile
app.get('/me', verifyToken, async (req, res) => {
    try {
        const client = await db.pool.connect();
        try {
            // Get user info
            const userRes = await client.query('SELECT id, email, full_name, avatar_url, role, plan FROM users WHERE id = $1', [req.user.id]);
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

/**
 * Internal Route: Log User Activity
 * Primarily called by haystack-service
 */
app.post('/internal/log-activity', async (req, res) => {
    const { user_id, activity_type, activity_data } = req.body;
    if (!user_id || !activity_type) return res.status(400).json({ error: 'Missing required fields' });

    try {
        const query = 'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES ($1::uuid, $2, $3::jsonb) RETURNING id';
        const result = await db.query(query, [user_id, activity_type, JSON.stringify(activity_data || {})]);
        res.json({ status: 'ok', activity_id: result.rows[0].id });
    } catch (err) {
        console.error('[log-activity] Error:', err);
        res.status(500).json({ error: 'Failed to log activity' });
    }
});

/**
 * Internal Route: Log Chat Interaction
 * Primarily called by haystack-service
 */
app.post('/internal/log-chat', async (req, res) => {
    const { user_id, session_id, message, response, agent_name } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    try {
        const query = `
            INSERT INTO chat_logs (user_id, session_id, message, response, agent_name) 
            VALUES ($1::uuid, $2, $3, $4, $5) 
            RETURNING id
        `;
        const result = await db.query(query, [user_id || null, session_id, message, response, agent_name]);
        res.json({ status: 'ok', log_id: result.rows[0].id });
    } catch (err) {
        console.error('[log-chat] Error:', err);
        res.status(500).json({ error: 'Failed to log chat' });
    }
});

/**
 * GET /internal/user-plan/:user_id
 * Internal helper for other services to check plan limits
 */
app.get('/internal/user-plan/:user_id', async (req, res) => {
    const { user_id } = req.params;
    try {
        const query = `
            SELECT id, email, role, plan,
                   (SELECT COUNT(*) FROM user_activity WHERE user_id = u.id AND activity_type = 'resume_generated') as resume_count
            FROM users u
            WHERE u.id = $1
        `;
        const result = await db.query(query, [user_id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[internal-user-plan] Error:', err);
        res.status(500).json({ error: 'Failed to fetch user plan' });
    }
});


// --- Admin Specific Routes ---

/**
 * GET /admin/stats
 * Dashboard overview metrics
 */
app.get('/admin/stats', verifyAdmin, async (req, res) => {
    try {
        const stats = {};
        const userCount = await db.query('SELECT COUNT(*) FROM users');
        stats.total_users = parseInt(userCount.rows[0].count);

        const activityCount = await db.query('SELECT activity_type, COUNT(*) FROM user_activity GROUP BY activity_type');
        stats.activity_breakdown = activityCount.rows;

        const planLabels = await db.query('SELECT plan, COUNT(*) FROM users GROUP BY plan');
        stats.plans = planLabels.rows;

        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
});

/**
 * GET /admin/users
 * List users with activity details
 */
app.get('/admin/users', verifyAdmin, async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.email, u.full_name, u.role, u.plan, u.created_at, u.last_login_at, u.login_count,
                   (SELECT COUNT(*) FROM user_activity WHERE user_id = u.id AND activity_type = 'resume_generated') as resume_count,
                   (SELECT MAX(created_at) FROM user_activity WHERE user_id = u.id) as last_active,
                   (SELECT activity_data->>'pdf_path' FROM user_activity 
                    WHERE user_id = u.id AND activity_type = 'resume_generated' 
                    ORDER BY created_at DESC LIMIT 1) as latest_resume_path
            FROM users u
            ORDER BY COALESCE(u.last_login_at, u.created_at) DESC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * POST /admin/users/:id/update
 * Change user role or plan
 */
app.post('/admin/users/:id/update', verifyAdmin, async (req, res) => {
    const { role, plan } = req.body;
    const userId = req.params.id;
    try {
        const query = `
            UPDATE users 
            SET role = COALESCE($1, role),
                plan = COALESCE($2, plan),
                updated_at = NOW()
            WHERE id = $3
            RETURNING id, email, role, plan
        `;
        const result = await db.query(query, [role, plan, userId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

/**
 * POST /admin/users/:id/reset-usage
 * Archive existing resume generation logs to reset the user's build quota to 0.
 */
app.post('/admin/users/:id/reset-usage', verifyAdmin, async (req, res) => {
    const userId = req.params.id;
    try {
        const query = `
            UPDATE user_activity 
            SET activity_type = 'resume_generated_archived'
            WHERE user_id = $1 AND activity_type = 'resume_generated'
        `;
        const result = await db.query(query, [userId]);
        res.json({ success: true, archived_count: result.rowCount });
    } catch (err) {
        console.error("Reset usage error:", err);
        res.status(500).json({ error: 'Failed to reset usage' });
    }
});

/**
 * GET /admin/logs/chats
 * Audit Gini Chat history
 */
app.get('/admin/logs/chats', verifyAdmin, async (req, res) => {
    try {
        const query = `
            SELECT c.*, u.email as user_email 
            FROM chat_logs c
            LEFT JOIN users u ON c.user_id = u.id
            ORDER BY c.created_at DESC
            LIMIT 100
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch chat logs' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS MODULE
// ─────────────────────────────────────────────────────────────────────────────

// Lazy-init payment libraries
const getPayPalClient = () => {
    const { Client, Environment, OrdersController } = require('@paypal/paypal-server-sdk');
    const client = new Client({
        clientCredentialsAuthCredentials: {
            oAuthClientId: process.env.PAYPAL_CLIENT_ID || 'SANDBOX_CLIENT_ID',
            oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET || 'SANDBOX_CLIENT_SECRET',
        },
        environment: process.env.NODE_ENV === 'production' && process.env.PAYPAL_CLIENT_ID
            ? Environment.Production : Environment.Sandbox,
    });
    return { ordersController: new OrdersController(client) };
};

const getRazorpay = () => {
    const Razorpay = require('razorpay');
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
    });
};

const getStripe = () => require('stripe')(
    process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
);

const PLAN_PRICES = {
    starter: { USD: 5.00, EUR: 4.50, INR: 420 },
    premium: { USD: 25.00, EUR: 23.00, INR: 2099 },
};

const PLAN_DB_MAP = { starter: 'basic', premium: 'premium' };

async function upgradeUserPlan(userId, planKey, gateway, orderId, amount, currency) {
    const dbPlan = PLAN_DB_MAP[planKey] || planKey;
    await db.query(
        'UPDATE users SET plan = $1, resume_count = 0, updated_at = NOW() WHERE id = $2',
        [dbPlan, userId]
    );
    await db.query(
        `INSERT INTO payments (user_id, gateway, order_id, amount, currency, plan, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'completed')`,
        [userId, gateway, orderId, amount, currency, dbPlan]
    );
    console.log(`[payments] User ${userId} upgraded to ${dbPlan} via ${gateway}.`);
}

// Routes
app.post('/payments/paypal/create-order', verifyToken, async (req, res) => {
    try {
        const { plan, currency = 'USD' } = req.body;
        const price = PLAN_PRICES[plan]?.[currency];
        if (!price) return res.status(400).json({ error: 'Invalid plan or currency' });

        const { ordersController } = getPayPalClient();
        const frontendUrl = process.env.FRONTEND_URL || 'https://www.careergini.com';
        const { body: order } = await ordersController.createOrder({
            body: {
                intent: 'CAPTURE',
                purchaseUnits: [{
                    amount: { currencyCode: currency, value: price.toFixed(2) },
                    description: `CareerGini ${plan} Plan`,
                }],
                applicationContext: {
                    returnUrl: `${frontendUrl}/auth/callback?payment=success&plan=${plan}`,
                    cancelUrl: `${frontendUrl}/payment?plan=${plan}&cancelled=1`,
                },
            },
        });
        const approval = order.links?.find(l => l.rel === 'approve');
        res.json({ orderId: order.id, approvalUrl: approval?.href });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/payments/paypal/capture-order', verifyToken, async (req, res) => {
    try {
        const { orderId, plan, currency = 'USD' } = req.body;
        const { ordersController } = getPayPalClient();
        const { body: capture } = await ordersController.captureOrder({ id: orderId });
        if (capture.status === 'COMPLETED') {
            const price = PLAN_PRICES[plan]?.[currency] || 0;
            await upgradeUserPlan(req.user.id, plan, 'paypal', orderId, price, currency);
            res.json({ success: true, plan: PLAN_DB_MAP[plan] || plan });
        } else {
            res.status(400).json({ error: 'Payment not completed' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/payments/razorpay/create-order', verifyToken, async (req, res) => {
    try {
        const { plan } = req.body;
        const amountPaise = Math.round((PLAN_PRICES[plan]?.INR || 420) * 100);
        const rzp = getRazorpay();
        const order = await rzp.orders.create({ amount: amountPaise, currency: 'INR', receipt: `cg_${plan}_${Date.now()}` });
        res.json({ orderId: order.id, amount: order.amount, keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/payments/razorpay/verify', verifyToken, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
        const crypto = require('crypto');
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret');
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        if (hmac.digest('hex') !== razorpay_signature) return res.status(400).json({ error: 'Invalid signature' });

        const price = PLAN_PRICES[plan]?.INR || 420;
        await upgradeUserPlan(req.user.id, plan, 'razorpay', razorpay_payment_id, price, 'INR');
        res.json({ success: true, plan: PLAN_DB_MAP[plan] || plan });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/payments/stripe/create-session', verifyToken, async (req, res) => {
    try {
        const { plan, currency = 'usd' } = req.body;
        const stripe = getStripe();
        const unitAmount = Math.round((PLAN_PRICES[plan]?.[currency.toUpperCase()] || 5) * 100);
        const frontendUrl = process.env.FRONTEND_URL || 'https://www.careergini.com';
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: { currency: currency.toLowerCase(), product_data: { name: `CareerGini ${plan} Plan` }, unit_amount: unitAmount },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${frontendUrl}/payment?status=success&plan=${plan}`,
            cancel_url: `${frontendUrl}/payment?plan=${plan}&cancelled=1`,
            metadata: { user_id: req.user.id, plan },
        });
        res.json({ checkoutUrl: session.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin/payments', verifyAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, u.email as user_email, u.full_name as user_name
            FROM payments p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

async function startServer() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id),
                gateway VARCHAR(50) NOT NULL,
                order_id VARCHAR(255),
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(10) NOT NULL,
                plan VARCHAR(50) NOT NULL,
                status VARCHAR(50) DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('[startup] Payments table ensured.');
    } catch (e) {
        console.error('[startup] DB migration failed:', e);
    }

    app.listen(PORT, () => {
        console.log(`Profile Service running on port ${PORT}`);
    });
}

startServer();

