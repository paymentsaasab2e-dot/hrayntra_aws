const { PrismaClient, WorkMode, EmploymentType } = require('@prisma/client');
const prisma = new PrismaClient();

const COMPANIES = [
  "Google", "Microsoft", "Amazon", "Meta", "Tesla", "Stripe", "Airbnb", "Coinbase", "Uber", "Lyft", 
  "Salesforce", "ServiceNow", "Snowflake", "Datadog", "Atlassian", "Twilio", "Adobe", "Zscaler", 
  "NVIDIA", "Intel", "AMD", "ASML", "Qualcomm", "Oracle", "SAP", "Cisco", "IBM", "HPE", 
  "Shopify", "HubSpot", "Zendesk", "Zoom", "Workday", "Splunk", "Okta", "CrowdStrike", 
  "Block", "PayPal", "Robinhood", "SoFi", "Affirm", "Chime", "Wise", "Revolut", "Klarna",
  "Reliance", "TCS", "Infosys", "Wipro", "HCLTech", "L&T", "Flipkart", "Zomato", "Swiggy", "Paytm"
];

const LOCATIONS = [
  "Bangalore, India", "Hyderabad, India", "Mumbai, India", "Pune, India", "Chennai, India", 
  "Gurgaon, India", "Noida, India", "San Francisco, USA", "New York, USA", "Austin, USA", 
  "Seattle, USA", "London, UK", "Berlin, Germany", "Singapore", "Tokyo, Japan", "Dubai, UAE"
];

const TITLES = [
  "Senior Backend Engineer", "Frontend Developer", "Full Stack Ninja", "AI Solutions Architect", 
  "Data Scientist", "ML Operations Engineer", "Growth Marketing Lead", "Product Manager", 
  "DevOps Engineer", "Cloud Solutions Architect", "Cybersecurity Analyst", "UI/UX Designer", 
  "Human Resources Business Partner", "Finance Manager", "Legal Counsel", "Sales Development Rep", 
  "Customer Success Manager", "iOS Developer", "Android Lead", "Site Reliability Engineer"
];

const SKILLS_BY_ROLE = {
  "Senior Backend Engineer": ["Node.js", "Express", "PostgreSQL", "Redis", "Docker", "Go", "AWS"],
  "Frontend Developer": ["React", "Next.js", "Tailwind CSS", "TypeScript", "Redux", "Framer Motion"],
  "Full Stack Ninja": ["React", "Node.js", "MongoDB", "Express", "MySQL", "Prisma", "Typescript"],
  "AI Solutions Architect": ["Python", "PyTorch", "LangChain", "OpenAI", "Pinecone", "Databricks"],
  "Data Scientist": ["Python", "Pandas", "Scikit-learn", "SQL", "Tableau", "TensorFlow"],
  "ML Operations Engineer": ["Python", "Docker", "Kubernetes", "MLFlow", "Terraform", "Google Cloud"],
  "Growth Marketing Lead": ["SEO", "Google Analytics", "SQL", "Copywriting", "A/B Testing", "HubSpot"],
  "Product Manager": ["Agile", "Jira", "Figma", "Market Research", "SQL", "User Interviews"],
  "DevOps Engineer": ["AWS", "GitHub Actions", "Terraform", "Kubernetes", "IAM", "Ansible"],
  "Cloud Solutions Architect": ["Azure", "AWS", "Google Cloud", "Network Security", "Serverless"],
  "Cybersecurity Analyst": ["Penetration Testing", "SIEM", "Firewalls", "ISO 27001", "Wireshark"],
  "UI/UX Designer": ["Figma", "Adobe XD", "User Research", "Prototyping", "Typography"],
  "iOS Developer": ["Swift", "SwiftUI", "Combine", "Core Data", "Objective-C"],
  "Android Lead": ["Kotlin", "Jetpack Compose", "Coroutines", "Dagger Hilt", "Android Studio"]
};

const SALARY_RANGES = [
  { min: 800000, max: 1500000 },
  { min: 1500000, max: 2500000 },
  { min: 2500000, max: 4000000 },
  { min: 4000000, max: 6500000 },
  { min: 6500000, max: 9500000 }
];

async function seedLargeDataset() {
  console.log("🚀 Starting Large Dataset Seeding (500 Jobs)...");
  
  try {
    const jobInserts = [];
    
    for (let i = 0; i < 500; i++) {
      const company = COMPANIES[Math.floor(Math.random() * COMPANIES.length)];
      const title = TITLES[Math.floor(Math.random() * TITLES.length)];
      const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
      const salary = SALARY_RANGES[Math.floor(Math.random() * SALARY_RANGES.length)];
      const skills = SKILLS_BY_ROLE[title] || ["JavaScript", "SQL", "Communications"];
      
      const workModes = ["REMOTE", "ON_SITE", "HYBRID"];
      const workMode = workModes[Math.floor(Math.random() * workModes.length)];
      
      const employmentTypes = ["FULL_TIME", "CONTRACT", "INTERNSHIP"];
      const type = employmentTypes[Math.floor(Math.random() * employmentTypes.length)];

      jobInserts.push({
        title: `${title} - ${company}`,
        location,
        industry: "Technology & Software",
        department: "Engineering",
        isActive: true,
        overview: `Join the team at ${company} to build the future of our digital world.`,
        aboutRole: `We are looking for a highly motivated ${title} to join our growing global team.`,
        description: `This is a high-impact role at ${company} where you will be responsible for building scalable systems and delivering value to millions of users worldwide.`,
        keyResponsibilities: [
          `Lead the development of modular components at ${company}`,
          "Collaborate with multi-functional teams to define project goals",
          "Ensure high code quality through rigorous testing and code reviews",
          "Stay up-to-date with emerging technologies and industry best practices"
        ],
        skills: skills,
        preferredSkills: ["Agile", "Cloud Computing", "Team Leadership"],
        experienceRequired: `${Math.floor(Math.random() * 8) + 1}-${Math.floor(Math.random() * 5) + 8} Years`,
        experienceLevel: i % 3 === 0 ? "Senior" : (i % 2 === 0 ? "Mid" : "Junior"),
        education: "Bachelor's / Master's degree in Computer Science or related field",
        type: type,
        employmentType: type,
        workMode: workMode,
        salaryMin: salary.min,
        salaryMax: salary.max,
        salaryCurrency: "INR",
        salaryType: "ANNUAL",
        benefits: ["Health Insurance", "Stock Options", "Flexible Hours", "Learning Stipend"],
        postedAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000) // Random date in last 30 days
      });
    }

    console.log(`📦 Generated ${jobInserts.length} unique job objects. Committing to Database...`);
    
    // Batch inserts for MongoDB efficiency
    const result = await prisma.job.createMany({
      data: jobInserts
    });

    console.log(`✅ Success! Inserted ${result.count} new jobs.`);
    
    // Summary of Top Industries
    const totalCount = await prisma.job.count();
    console.log(`📊 TOTAL JOBS IN SYSTEM: ${totalCount}`);
    
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedLargeDataset();
