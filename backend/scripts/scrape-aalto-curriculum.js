// scrape-aalto-curriculum.js
// Run with: node scrape-aalto-curriculum.js
// Output: JSON file with degree structure

const fs = require('fs');
const https = require('https');

const BASE_URL = 'https://sisu.aalto.fi';

// Common Aalto degree programme IDs (can be expanded)
const PROGRAMME_IDS = [
  'otm-5d4a1b5e-1c2d-4e3f-4a5b-6c7d8e9f0a1b', // Data Science
  'otm-12345678-abcd-efgh-ijkl-mnopqrstuvwx', // Computer Science
  // Add more programme IDs as needed
];

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

async function scrapeCurriculum(programmeId) {
  console.log(`Fetching curriculum for ${programmeId}...`);
  
  // Try the public curriculum API
  const url = `${BASE_URL}/api/v1/curriculum/${programmeId}`;
  const data = await fetchJson(url);
  
  if (!data) {
    // Fallback: try fetching from course catalog
    console.log('Trying course catalog...');
    return null;
  }
  
  return data;
}

// Alternative: Scrape from course search pages
async function scrapeCourseCatalog() {
  console.log('Scraping course catalog...');
  
  const courses = [];
  const baseUrl = `${BASE_URL}/api/v1/courseunit/search`;
  
  // Paginate through courses
  for (let page = 0; page < 10; page++) {
    const url = `${baseUrl}?page=${page}&size=100`;
    const data = await fetchJson(url);
    
    if (!data || !data.content || data.content.length === 0) break;
    
    courses.push(...data.content.map(c => ({
      code: c.code,
      name: c.name?.en || c.name?.fi,
      credits: c.credits,
      period: c.teachingPeriod?.en,
      department: c.organisation?.name?.en
    })));
    
    console.log(`Page ${page + 1}: ${data.content.length} courses`);
  }
  
  return courses;
}

// Extract degree structure from curriculum JSON
function parseDegreeStructure(curriculum) {
  const modules = [];
  
  function extractModules(items, parentId = null, level = 0) {
    if (!items || !Array.isArray(items)) return;
    
    for (const item of items) {
      const module = {
        id: item.id || item.groupId,
        code: item.code,
        name: item.name?.en || item.name?.fi,
        type: item.__typename || item.type,
        credits: item.targetCredits?.min || item.credits,
        parentId,
        level,
        children: []
      };
      
      modules.push(module);
      
      if (item.modules || item.children) {
        extractModules(item.modules || item.children, module.id, level + 1);
      }
    }
  }
  
  if (curriculum.structure) {
    extractModules(curriculum.structure);
  }
  
  return modules;
}

// Main execution
async function main() {
  console.log('=== Aalto Curriculum Scraper ===\n');
  
  // Option 1: Try to fetch curriculum
  for (const progId of PROGRAMME_IDS) {
    const curriculum = await scrapeCurriculum(progId);
    if (curriculum) {
      const modules = parseDegreeStructure(curriculum);
      fs.writeFileSync('degree-structure.json', JSON.stringify(modules, null, 2));
      console.log(`Saved ${modules.length} modules to degree-structure.json`);
      return;
    }
  }
  
  // Option 2: Scrape course catalog as fallback
  console.log('\nFalling back to course catalog...');
  const courses = await scrapeCourseCatalog();
  
  if (courses.length > 0) {
    fs.writeFileSync('courses.json', JSON.stringify(courses, null, 2));
    console.log(`Saved ${courses.length} courses to courses.json`);
  } else {
    console.log('No data retrieved. The API may require authentication.');
    console.log('\nAlternative approaches:');
    console.log('1. Get API credentials from Aalto IT');
    console.log('2. Use Sisu UI network inspector to find API calls');
    console.log('3. Manually export from Sisu Kori and import via UI');
  }
}

main().catch(console.error);