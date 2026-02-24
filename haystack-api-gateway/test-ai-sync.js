const fetch = require('node-fetch');

async function testSync() {
    const userId = '7649fed1-3287-469d-a09e-0079f2eef666';
    const url = `http://haystack-service:8000/resume/persona/${userId}`;

    console.log(`Testing POST to ${url}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                persona: {
                    full_name: "Sanjana Mandarapu TEST",
                    top_skills: ["Python", "JavaScript", "AI"]
                }
            })
        });

        const data = await response.json();
        console.log('Response:', data);
    } catch (err) {
        console.error('Error:', err);
    }
}

testSync();
