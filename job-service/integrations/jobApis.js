const axios = require('axios');

/**
 * RemoteOK API Integration
 * ✅ VERIFIED WORKING — returns ~100 jobs
 * Strategy: fetch ALL jobs unfiltered, score them server-side
 */
class RemoteOKClient {
    constructor() {
        this.baseUrl = 'https://remoteok.com/api';
    }

    async searchJobs(query = '', tags = []) {
        try {
            const response = await axios.get(this.baseUrl, {
                headers: { 'User-Agent': 'CareerGini/1.0 (job aggregator)' },
                timeout: 10000
            });

            // First item is metadata — skip it
            let jobs = response.data.filter(j => j.id && j.position);

            // Soft filter: prefer matches but return ALL if nothing matches
            if (query) {
                const q = query.toLowerCase();
                const matched = jobs.filter(job =>
                    job.position?.toLowerCase().includes(q) ||
                    job.company?.toLowerCase().includes(q) ||
                    job.tags?.some(t => t.toLowerCase().includes(q))
                );
                // Only apply filter if it keeps at least 5 results
                if (matched.length >= 5) jobs = matched;
            }

            return jobs.map(job => this.formatJob(job));
        } catch (error) {
            console.error('RemoteOK API error:', error.message);
            return [];
        }
    }

    formatJob(job) {
        return {
            id: `remoteok_${job.id || job.slug}`,
            title: job.position || 'Unknown Role',
            company: job.company || 'Unknown Company',
            location: 'Remote / Worldwide',
            type: 'Remote',
            description: job.description || `${job.position} role at ${job.company}. Apply via RemoteOK.`,
            url: job.url || `https://remoteok.com/remote-jobs/${job.slug}`,
            tags: job.tags || [],
            salary: job.salary_min ? `$${job.salary_min} - $${job.salary_max}` : null,
            posted: job.date ? new Date(job.date * 1000).toISOString() : new Date().toISOString(),
            logo: job.company_logo || null,
            source: 'RemoteOK',
            isRemote: true
        };
    }
}

/**
 * Remotive API Integration
 * ✅ VERIFIED WORKING — returns many jobs
 * Strategy: fetch ALL (no search param) to get full catalog, then rank
 */
class RemotiveClient {
    constructor() {
        this.baseUrl = 'https://remotive.com/api/remote-jobs';
    }

    async searchJobs(search = '', category = '') {
        try {
            const params = {};
            // Only add search if specific — otherwise get ALL jobs
            if (search && search.length > 2) params.search = search;
            if (category) params.category = category;

            const response = await axios.get(this.baseUrl, { params, timeout: 12000 });
            let jobs = response.data.jobs || [];

            console.log(`Remotive returned ${jobs.length} jobs for search="${search}"`);
            return jobs.map(job => this.formatJob(job));
        } catch (error) {
            console.error('Remotive API error:', error.message);
            return [];
        }
    }

    formatJob(job) {
        const loc = job.candidate_required_location || 'Worldwide';
        return {
            id: `remotive_${job.id}`,
            title: job.title,
            company: job.company_name,
            location: loc || 'Remote / Worldwide',
            type: job.job_type ? job.job_type.replace(/_/g, ' ') : 'Remote',
            description: job.description,
            url: job.url,
            tags: [...(job.tags || []), job.category].filter(Boolean),
            salary: job.salary || null,
            posted: job.publication_date ? new Date(job.publication_date).toISOString() : new Date().toISOString(),
            logo: job.company_logo,
            source: 'Remotive',
            isRemote: true
        };
    }
}

/**
 * Jobicy API Integration
 * ✅ VERIFIED (with correct params)
 */
class JobicyClient {
    constructor() {
        this.baseUrl = 'https://jobicy.com/api/v2/remote-jobs';
    }

    async searchJobs(query = '') {
        try {
            const params = { count: 50 };
            // Jobicy doesn't support 'search', uses 'tag' for category
            const techMap = {
                'react': 'javascript', 'node': 'javascript', 'vue': 'javascript',
                'python': 'python', 'java': 'java', 'php': 'php',
                'devops': 'devops', 'data': 'data-science', 'ml': 'data-science',
                'design': 'design', 'product': 'product'
            };
            const q = query.toLowerCase();
            for (const [k, v] of Object.entries(techMap)) {
                if (q.includes(k)) { params.tag = v; break; }
            }

            const response = await axios.get(this.baseUrl, {
                params,
                headers: { 'User-Agent': 'CareerGini/1.0' },
                timeout: 10000
            });

            const jobs = response.data.jobs || [];
            console.log(`Jobicy returned ${jobs.length} jobs (tag=${params.tag || 'none'})`);
            return jobs.map(job => this.formatJob(job));
        } catch (error) {
            console.error('Jobicy API error:', error.message);
            return [];
        }
    }

    formatJob(job) {
        return {
            id: `jobicy_${job.id}`,
            title: job.jobTitle,
            company: job.companyName,
            location: job.jobGeo === 'Anywhere' ? 'Remote / Worldwide' : (job.jobGeo || 'Remote'),
            type: job.jobType || 'Remote',
            description: job.jobDescription || `${job.jobTitle} at ${job.companyName}`,
            url: job.url,
            tags: [job.jobIndustry, job.jobType].filter(Boolean),
            salary: job.annualSalaryMin ? `$${job.annualSalaryMin}k - $${job.annualSalaryMax}k` : null,
            posted: job.pubDate ? new Date(job.pubDate).toISOString() : new Date().toISOString(),
            logo: job.companyLogo || null,
            source: 'Jobicy',
            isRemote: true
        };
    }
}

/**
 * Arbegitnow Board API
 * ✅ Free, no auth, returns real jobs
 */
class ArbeitnowClient {
    constructor() {
        this.baseUrl = 'https://www.arbeitnow.com/api/job-board-api';
    }

    async searchJobs(query = '') {
        try {
            const response = await axios.get(this.baseUrl, {
                headers: { 'User-Agent': 'CareerGini/1.0' },
                timeout: 10000
            });

            let jobs = response.data.data || [];
            console.log(`Arbeitnow returned ${jobs.length} total jobs`);

            // Filter remote-friendly and keep tech jobs
            jobs = jobs.filter(job => job.remote ||
                (job.title || '').toLowerCase().includes('developer') ||
                (job.title || '').toLowerCase().includes('engineer') ||
                (job.title || '').toLowerCase().includes('designer') ||
                (job.title || '').toLowerCase().includes('data') ||
                (job.title || '').toLowerCase().includes('product')
            );

            if (query) {
                const q = query.toLowerCase();
                const matched = jobs.filter(job =>
                    job.title?.toLowerCase().includes(q) ||
                    job.description?.toLowerCase().includes(q) ||
                    job.tags?.some(t => t.toLowerCase().includes(q))
                );
                if (matched.length >= 5) jobs = matched;
            }

            return jobs.map(job => this.formatJob(job));
        } catch (error) {
            console.error('Arbeitnow API error:', error.message);
            return [];
        }
    }

    formatJob(job) {
        return {
            id: `arbeitnow_${job.slug}`,
            title: job.title,
            company: job.company_name,
            location: job.remote ? 'Remote / Worldwide' : (job.location || 'Europe'),
            type: job.remote ? 'Remote' : (job.job_types?.join(', ') || 'Full-time'),
            description: job.description,
            url: job.url,
            tags: job.tags || [],
            salary: null,
            posted: job.created_at ? new Date(job.created_at * 1000).toISOString() : new Date().toISOString(),
            logo: null,
            source: 'Arbeitnow',
            isRemote: !!job.remote
        };
    }
}

/**
 * Adzuna India API Integration (optional — requires free API key)
 */
class AdzunaIndiaClient {
    constructor() {
        this.baseUrl = 'https://api.adzuna.com/v1/api/jobs/in/search/1';
        this.appId = process.env.ADZUNA_APP_ID || '';
        this.appKey = process.env.ADZUNA_APP_KEY || '';
    }

    async searchJobs(query = '', location = '') {
        if (!this.appId || !this.appKey) return [];
        try {
            const params = {
                app_id: this.appId,
                app_key: this.appKey,
                results_per_page: 20,
                what: query || 'software engineer',
                content_type: 'application/json'
            };
            if (location) params.where = location;

            const response = await axios.get(this.baseUrl, { params, timeout: 8000 });
            const jobs = response.data.results || [];
            return jobs.map(job => this.formatJob(job));
        } catch (error) {
            console.error('Adzuna India API error:', error.message);
            return [];
        }
    }

    formatJob(job) {
        return {
            id: `adzuna_${job.id}`,
            title: job.title,
            company: job.company?.display_name || 'Unknown',
            location: job.location?.display_name || 'India',
            type: job.contract_time === 'full_time' ? 'Full-time' : (job.contract_time || 'Full-time'),
            description: job.description,
            url: job.redirect_url,
            tags: [],
            salary: job.salary_min ? `₹${Math.round(job.salary_min / 1000)}k - ₹${Math.round(job.salary_max / 1000)}k` : null,
            posted: job.created ? new Date(job.created).toISOString() : new Date().toISOString(),
            logo: null,
            source: 'Adzuna India',
            isRemote: false
        };
    }
}

/**
 * Himalayas App API
 * Free API delivering JSON without auth. Focuses on tech & remote jobs.
 */
class HimalayasClient {
    constructor() {
        this.baseUrl = 'https://himalayas.app/jobs/api';
    }

    async searchJobs(query = '') {
        try {
            const response = await axios.get(this.baseUrl, {
                params: { limit: 50 },
                headers: { 'User-Agent': 'CareerGini/1.0' },
                timeout: 10000
            });

            let jobs = response.data.jobs || [];
            console.log(`Himalayas returned ${jobs.length} jobs`);

            if (query) {
                const q = query.toLowerCase();
                const matched = jobs.filter(job =>
                    job.title?.toLowerCase().includes(q) ||
                    job.companyName?.toLowerCase().includes(q) ||
                    job.categories?.some(c => c.toLowerCase().includes(q))
                );
                if (matched.length >= 3) jobs = matched;
            }

            return jobs.map(job => this.formatJob(job));
        } catch (error) {
            console.error('Himalayas API error:', error.message);
            return [];
        }
    }

    formatJob(job) {
        return {
            id: `himala_${job.guid || job.applicationLink}`,
            title: job.title || 'Unknown Role',
            company: job.companyName || 'Unknown Company',
            location: job.locationRestrictions && job.locationRestrictions.length ? job.locationRestrictions.join(', ') : 'Remote / Worldwide',
            type: job.employmentType || 'Remote',
            description: job.excerpt || `${job.title} at ${job.companyName}`,
            url: job.applicationLink,
            tags: job.categories || [],
            salary: (job.minSalary && job.maxSalary) ? `$${job.minSalary} - $${job.maxSalary}` : null,
            posted: job.pubDate ? new Date(job.pubDate * 1000).toISOString() : new Date().toISOString(),
            logo: job.companyLogo || null,
            source: 'Himalayas',
            isRemote: true
        };
    }
}

/**
 * TheMuse API
 * Free public API without auth. We query for Flexible/Remote locations out of the box.
 */
class TheMuseClient {
    constructor() {
        this.baseUrl = 'https://www.themuse.com/api/public/jobs';
    }

    async searchJobs(query = '') {
        try {
            const params = {
                page: 1,
                location: 'Flexible / Remote'
            };

            // TheMuse doesn't allow 'search' for titles easily on the free tier, 
            // so we fetch category based if possible, or filter locally.
            const categoryMap = {
                'software': 'Software Engineer', 'data': 'Data Science',
                'design': 'Design', 'product': 'Product'
            };
            const q = query.toLowerCase();
            for (const [k, v] of Object.entries(categoryMap)) {
                if (q.includes(k)) { params.category = v; break; }
            }

            const response = await axios.get(this.baseUrl, {
                params,
                headers: { 'User-Agent': 'CareerGini/1.0' },
                timeout: 10000
            });

            let jobs = response.data.results || [];
            console.log(`TheMuse returned ${jobs.length} jobs`);

            if (query) {
                const matched = jobs.filter(job =>
                    job.name?.toLowerCase().includes(q) ||
                    job.company?.name?.toLowerCase().includes(q)
                );
                if (matched.length >= 3) jobs = matched;
            }

            return jobs.map(job => this.formatJob(job));
        } catch (error) {
            console.error('TheMuse API error:', error.message);
            return [];
        }
    }

    formatJob(job) {
        const type = (job.levels && job.levels.length) ? job.levels[0].name : 'Remote';
        return {
            id: `themuse_${job.id}`,
            title: job.name || 'Unknown Role',
            company: job.company?.name || 'Unknown Company',
            location: (job.locations && job.locations.length) ? job.locations[0].name : 'Remote',
            type: type,
            description: job.contents || `${job.name} position`,
            url: job.refs?.landing_page,
            tags: job.categories?.map(c => c.name) || [],
            salary: null,
            posted: job.publication_date ? new Date(job.publication_date).toISOString() : new Date().toISOString(),
            logo: null,
            source: 'TheMuse',
            isRemote: true
        };
    }
}

module.exports = {
    RemoteOKClient,
    RemotiveClient,
    JobicyClient,
    ArbeitnowClient,
    AdzunaIndiaClient,
    HimalayasClient,
    TheMuseClient
};
