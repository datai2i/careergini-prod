const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkUser() {
    try {
        const userId = '7649fed1-3287-469d-a09e-0079f2eef666'; // Latest successful sync ID
        const userRes = await pool.query('SELECT id, email, full_name FROM users WHERE id = $1', [userId]);
        console.log('--- USER TABLE ---');
        console.log(JSON.stringify(userRes.rows[0], null, 2));

        const profileRes = await pool.query('SELECT user_id, headline, skills FROM profiles WHERE user_id = $1', [userId]);
        console.log('\n--- PROFILES TABLE ---');
        console.log(JSON.stringify(profileRes.rows[0], null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkUser();
