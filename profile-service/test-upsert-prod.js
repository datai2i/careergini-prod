const db = require('./db');

async function testUpsert() {
    const user_id = '0ba83b1d-ed92-486c-8ebb-877bd5445a93'; // active test user
    const skills = ["Python", "JavaScript"];
    const experience = [{ "role": "test", "company": "test" }];
    const education = [];

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
        "test headline",
        "test summary",
        "test location",
        skills,
        JSON.stringify(experience),
        JSON.stringify(education),
        "test.pdf",
        "/test/test.pdf"
    ];

    try {
        const result = await db.query(query, values);
        console.log("Success:", result.rows[0]);
    } catch (err) {
        console.error("Error during upsert:", err);
    }
}

testUpsert().then(() => process.exit(0));
