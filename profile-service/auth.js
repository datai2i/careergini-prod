const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const db = require('./db');

// Helper to find or create user
async function findOrCreateUser(profile, provider, accessToken, refreshToken) {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Check if linked account exists
        const res = await client.query(
            'SELECT user_id FROM linked_accounts WHERE provider = $1 AND provider_id = $2',
            [provider, profile.id]
        );

        let userId;

        if (res.rows.length > 0) {
            userId = res.rows[0].user_id;
            // Update tokens
            await client.query(
                'UPDATE linked_accounts SET access_token = $1, refresh_token = $2, updated_at = NOW() WHERE provider = $3 AND provider_id = $4',
                [accessToken, refreshToken, provider, profile.id]
            );
        } else {
            // Check if user exists with same email
            const email = profile.emails[0].value;
            const userRes = await client.query('SELECT id FROM users WHERE email = $1', [email]);

            if (userRes.rows.length > 0) {
                userId = userRes.rows[0].id;
                // Ensure profile exists for existing users
                await client.query('INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
            } else {
                // Create new user
                const newUser = await client.query(
                    'INSERT INTO users (email, full_name, avatar_url) VALUES ($1, $2, $3) RETURNING id',
                    [email, profile.displayName, profile.photos?.[0]?.value]
                );
                userId = newUser.rows[0].id;

                // Create empty profile
                await client.query(
                    'INSERT INTO profiles (user_id) VALUES ($1)',
                    [userId]
                );
            }

            // Create linked account
            await client.query(
                'INSERT INTO linked_accounts (user_id, provider, provider_id, access_token, refresh_token, profile_data) VALUES ($1, $2, $3, $4, $5, $6)',
                [userId, provider, profile.id, accessToken, refreshToken, JSON.stringify(profile)]
            );
        }

        await client.query('COMMIT');

        // Fetch full user object
        const user = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
        return user.rows[0];
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID) {
    const googleCallback = process.env.GOOGLE_CALLBACK_URL || `${process.env.FRONTEND_URL}/api/profile/auth/google/callback`;
    console.log('[auth] Registering GoogleStrategy with callbackURL:', googleCallback);
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        // Force the absolute URL built from FRONTEND_URL rather than letting Passport guess from the Host header
        callbackURL: googleCallback,
        proxy: true
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const user = await findOrCreateUser(profile, 'google', accessToken, refreshToken);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    }));
}

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const res = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        done(null, res.rows[0]);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;
