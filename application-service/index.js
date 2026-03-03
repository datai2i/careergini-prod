/**
 * Application Tracker Service
 * Manages job applications with status tracking and analytics
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'careergini',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected successfully');
    }
});

// ============================================
// APPLICATIONS CRUD
// ============================================

/**
 * GET /applications
 * Get all applications for a user
 */
app.get('/applications', async (req, res) => {
    try {
        const { user_id, status } = req.query;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        let query = 'SELECT * FROM applications WHERE user_id = $1';
        const params = [user_id];

        if (status) {
            query += ' AND status = $2';
            params.push(status);
        }

        query += ' ORDER BY last_updated DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /applications/:id
 * Get a specific application with events
 */
app.get('/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get application
        const appResult = await pool.query(
            'SELECT * FROM applications WHERE id = $1',
            [id]
        );

        if (appResult.rows.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Get events
        const eventsResult = await pool.query(
            'SELECT * FROM application_events WHERE application_id = $1 ORDER BY created_at DESC',
            [id]
        );

        const application = appResult.rows[0];
        application.events = eventsResult.rows;

        res.json(application);
    } catch (error) {
        console.error('Error fetching application:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /applications
 * Create a new application
 */
app.post('/applications', async (req, res) => {
    try {
        const {
            user_id,
            job_title,
            company,
            job_url,
            job_description,
            location,
            salary_range,
            status = 'interested',
            resume_version,
            cover_letter,
            job_match_score,
            ats_score,
            has_referral = false,
            referral_contact,
            notes
        } = req.body;

        if (!user_id || !job_title || !company) {
            return res.status(400).json({ error: 'user_id, job_title, and company are required' });
        }

        const result = await pool.query(
            `INSERT INTO applications (
                user_id, job_title, company, job_url, job_description, location,
                salary_range, status, resume_version, cover_letter, job_match_score,
                ats_score, has_referral, referral_contact, notes, applied_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *`,
            [
                user_id, job_title, company, job_url, job_description, location,
                salary_range, status, resume_version, cover_letter, job_match_score,
                ats_score, has_referral, referral_contact, notes,
                status === 'applied' ? new Date() : null
            ]
        );

        // Create initial event
        await pool.query(
            `INSERT INTO application_events (application_id, event_type, description)
             VALUES ($1, $2, $3)`,
            [result.rows[0].id, 'status_change', `Application created with status: ${status}`]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating application:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /applications/:id
 * Update an application
 */
app.put('/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Build dynamic update query
        const fields = [];
        const values = [];
        let paramCount = 1;

        const allowedFields = [
            'job_title', 'company', 'job_url', 'job_description', 'location',
            'salary_range', 'status', 'resume_version', 'cover_letter',
            'job_match_score', 'ats_score', 'has_referral', 'referral_contact',
            'notes', 'company_research', 'interview_notes', 'questions_to_ask'
        ];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                fields.push(`${field} = $${paramCount}`);
                values.push(updates[field]);
                paramCount++;
            }
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        // Add updated_at
        fields.push(`updated_at = NOW()`);

        // Add ID parameter
        values.push(id);

        const query = `UPDATE applications SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Create event if status changed
        if (updates.status) {
            await pool.query(
                `INSERT INTO application_events (application_id, event_type, description)
                 VALUES ($1, $2, $3)`,
                [id, 'status_change', `Status changed to: ${updates.status}`]
            );

            // Update applied_date if status is 'applied'
            if (updates.status === 'applied') {
                await pool.query(
                    'UPDATE applications SET applied_date = NOW() WHERE id = $1',
                    [id]
                );
            }
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating application:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /applications/:id
 * Delete an application
 */
app.delete('/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM applications WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }

        res.json({ message: 'Application deleted successfully' });
    } catch (error) {
        console.error('Error deleting application:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// APPLICATION EVENTS
// ============================================

/**
 * POST /applications/:id/events
 * Add an event to an application
 */
app.post('/applications/:id/events', async (req, res) => {
    try {
        const { id } = req.params;
        const { event_type, event_data, description } = req.body;

        if (!event_type) {
            return res.status(400).json({ error: 'event_type is required' });
        }

        const result = await pool.query(
            `INSERT INTO application_events (application_id, event_type, event_data, description)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [id, event_type, event_data, description]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// ANALYTICS
// ============================================

/**
 * GET /analytics/funnel
 * Get application funnel metrics for a user
 */
app.get('/analytics/funnel', async (req, res) => {
    try {
        const { user_id } = req.query;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        const result = await pool.query(
            'SELECT * FROM user_application_funnel WHERE user_id = $1',
            [user_id]
        );

        if (result.rows.length === 0) {
            // No applications yet
            return res.json({
                applications_sent: 0,
                responses_received: 0,
                interviews_secured: 0,
                offers_received: 0,
                offers_accepted: 0,
                response_rate: 0,
                interview_rate: 0
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching funnel analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /analytics/summary
 * Get overall analytics summary for a user
 */
app.get('/analytics/summary', async (req, res) => {
    try {
        const { user_id } = req.query;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // Get application counts by status
        const statusResult = await pool.query(
            `SELECT status, COUNT(*) as count
             FROM applications
             WHERE user_id = $1
             GROUP BY status`,
            [user_id]
        );

        // Get average scores
        const scoresResult = await pool.query(
            `SELECT 
                AVG(job_match_score) as avg_match_score,
                AVG(ats_score) as avg_ats_score
             FROM applications
             WHERE user_id = $1 AND (job_match_score IS NOT NULL OR ats_score IS NOT NULL)`,
            [user_id]
        );

        // Get recent activity
        const activityResult = await pool.query(
            `SELECT COUNT(*) as count
             FROM applications
             WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
            [user_id]
        );

        res.json({
            by_status: statusResult.rows,
            avg_match_score: Math.round(scoresResult.rows[0].avg_match_score || 0),
            avg_ats_score: Math.round(scoresResult.rows[0].avg_ats_score || 0),
            applications_this_week: parseInt(activityResult.rows[0].count)
        });
    } catch (error) {
        console.error('Error fetching analytics summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// JOB BOOKMARKS
// ============================================

/**
 * GET /bookmarks
 * Get all bookmarked jobs for a user
 */
app.get('/bookmarks', async (req, res) => {
    try {
        const { user_id } = req.query;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        const result = await pool.query(
            'SELECT * FROM job_bookmarks WHERE user_id = $1 ORDER BY created_at DESC',
            [user_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /bookmarks
 * Bookmark a job
 */
app.post('/bookmarks', async (req, res) => {
    try {
        const { user_id, job_id, job_data, notes } = req.body;

        if (!user_id || !job_id || !job_data) {
            return res.status(400).json({ error: 'user_id, job_id, and job_data are required' });
        }

        const result = await pool.query(
            `INSERT INTO job_bookmarks (user_id, job_id, job_data, notes)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, job_id) DO UPDATE SET notes = $4
             RETURNING *`,
            [user_id, job_id, job_data, notes]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating bookmark:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /bookmarks/:id
 * Remove a bookmark
 */
app.delete('/bookmarks/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM job_bookmarks WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bookmark not found' });
        }

        res.json({ message: 'Bookmark removed successfully' });
    } catch (error) {
        console.error('Error deleting bookmark:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'application-tracker' });
});

const PORT = process.env.PORT || process.env.APPLICATION_SERVICE_PORT || 3002;

app.listen(PORT, () => {
    console.log(`Application Tracker Service running on port ${PORT}`);
});

module.exports = app;
