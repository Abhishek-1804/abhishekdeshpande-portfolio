// ─────────────────────────────────────────────────────────────────────────────
// ALL SITE TEXT LIVES HERE.
// Edit this file to update the portfolio — the 3D city, the info panels and the
// plain "classic" view are all generated from it. No 3D code needs to change.
// ─────────────────────────────────────────────────────────────────────────────

export const profile = {
  name: 'Abhishek Deshpande',
  role: 'Software Engineer',
  tagline: 'Aeronautical engineer turned software engineer. I build scalable web apps, ML models and cloud infrastructure.',
  photo: '/me.jpeg',
  email: 'apdeshp4@asu.edu',
  resume: 'https://drive.google.com/file/d/1Z0g-mcGxI1uOAOPPMJjPJ26FwhIdPU84/view?usp=drive_link',
  links: [
    { label: 'GitHub', url: 'https://github.com/Abhishek-1804' },
    { label: 'LinkedIn', url: 'https://linkedin.com/in/abhishekdeshpande18/' },
    { label: 'Buy me a coffee', url: 'https://buymeacoffee.com/abhishekdeshpande' },
  ],
  site: 'https://abhishekdp.com',
  goatcounter: 'abhishek',
};

export const about = [
  "Hi, I'm Abhishek. I'm a software engineer with experience building scalable web applications, machine learning models and REST APIs.",
  'I enjoy creating solutions to real-world problems with a mix of data analysis, cloud technologies and modern development practices.',
  'I studied aeronautical engineering before moving into computer science, so I still like anything that moves through the air.',
];

export const experience = [
  {
    role: 'Software Development Engineer Intern',
    company: 'Amazon',
    period: 'May 2025 – Aug 2025',
    place: 'Seattle, USA',
    points: [
      'Automated AWS SES provisioning for QuickSight across regions, cutting setup time from 4–5 days to under 1 day and reducing manual effort by ~80%.',
      'Enabled cross-region email notifications via automated domain verification, identities, and SNS/Lambda for bounces/complaints; eliminated delivery failures in target regions.',
      'Drove design-to-prod execution with CDK-based, least-privilege IaC; validated in sandbox and shipped via internal CI/CD.',
      'Migrated internal service gateway proxies (AppService → Brazil Config) and refactored APIs to modern patterns.',
      'Improved monitoring with region-aware CDK alarms, increasing signal quality and incident detection.',
    ],
  },
  {
    role: 'Data Analyst',
    company: 'Ganit Inc',
    period: 'Aug 2022 – Mar 2023',
    place: 'India',
    points: [
      'Built RESTful APIs using Python and machine learning models to extract metadata from medical prescriptions with 92% accuracy.',
      'Designed and maintained Power BI dashboards tracking over 20 KPIs, improving operational efficiency by 22% and driving an 18% annual revenue increase.',
      'Automated workflows using Bash scripting, Python, and AWS EC2 to refresh dashboards dynamically.',
      'Managed code reviews and pull requests in Git to ensure high-quality, maintainable code.',
    ],
  },
  {
    role: 'Data Analyst Intern',
    company: 'Ganit Inc',
    period: 'Feb 2022 – Jul 2022',
    place: 'India',
    points: [
      'Reduced fraud analytics processing time by 40% through optimized data workflows using Pandas and Numpy.',
      'Developed Python scripts to link related emails using regex, improving data linkage accuracy by 25%.',
      'Automated error handling pipelines with Python, reducing manual investigation time by 50%.',
      'Performed stress testing on an ELK-stack-based front-end tool to ensure robust performance.',
    ],
  },
];

export const projects = [
  {
    name: 'Notion Notes App',
    url: 'https://github.com/Abhishek-1804/notion_notes_app',
    tech: ['Flask', 'Python', 'Nix', 'Docker', 'DigitalOcean', 'Traefik', 'Notion API', 'OpenAI API'],
    text: 'A containerized app integrated with the Notion API to manage notes using Siri Shortcuts, deployed on DigitalOcean.',
  },
  {
    name: 'Deep Q-Learning Snake Game',
    url: 'https://github.com/Abhishek-1804/SnakeAI',
    tech: ['Python', 'PyTorch', 'Reinforcement Learning'],
    text: 'An AI-based Snake game with Deep Q-Learning and a GUI to visualize performance in real time.',
  },
  {
    name: 'Cotton Disease Classification',
    url: 'https://github.com/Abhishek-1804/Cotton_disease_classification',
    tech: ['Python', 'TensorFlow', 'Transfer Learning'],
    text: 'A transfer learning model achieving 96–97% accuracy for cotton disease classification using CNNs.',
  },
];

export const openSource = [
  {
    name: 'tldr-pages',
    note: '51.8k+ GitHub stars',
    url: 'https://github.com/tldr-pages/tldr',
    text: 'Active contributor: resolving issues and adding or improving command pages such as chat, lazygit and speedtest.',
    more: { label: 'View my contributions', url: 'https://github.com/tldr-pages/tldr/commits/main/?author=Abhishek-1804' },
  },
];

export const education = [
  {
    degree: "Master of Science in Computer Science",
    school: 'Arizona State University',
    courses: ['Machine Learning Acceleration', 'Information Assurance and Security', 'Operating Systems', 'Cloud Computing', 'Data Processing'],
  },
  {
    degree: "Bachelor of Technology in Aeronautical Engineering",
    school: 'Manipal Institute of Technology',
    courses: ['Python', 'C', 'Statistics', 'Data Structures', 'Web Development'],
  },
];

// Every skill listed here becomes a collectible orb floating somewhere in the city.
export const skills = [
  { group: 'Programming', items: ['Python', 'SQL', 'JavaScript', 'TypeScript', 'HTML/CSS'] },
  { group: 'Web Development', items: ['React', 'Next.js', 'Node.js', 'Express', 'REST APIs'] },
  { group: 'Data Analysis', items: ['Numpy', 'Pandas', 'Power BI', 'Excel'] },
  { group: 'Cloud & DevOps', items: ['Docker', 'AWS', 'Firebase', 'Linux', 'CI/CD'] },
  { group: 'Databases', items: ['PostgreSQL', 'MSSQL', 'MongoDB'] },
  { group: 'Tooling & Testing', items: ['Git', 'Pytest'] },
  { group: 'Machine Learning', items: ['Deep Learning', 'Transfer Learning', 'OpenCV', 'Reinforcement Learning'] },
  { group: 'AI', items: ['LangChain', 'MCP', 'RAG'] },
  { group: 'Others', items: ['Agile', 'SDLC', 'Bash Scripting'] },
];

export const blogIntro =
  "Tools I love (and sometimes hate), 'aha' moments, and random musings about all things tech.";

// The section towers, in the order they appear in the navigation.
// `hue` tints the tower's lights, sign and beacon. `blurb` is the one-line label in the nav.
export const sections = [
  { id: 'about', title: 'About', blurb: 'Home base', hue: '#ffb347' },
  { id: 'experience', title: 'Experience', blurb: 'Where I have worked', hue: '#5ad1ff' },
  { id: 'projects', title: 'Projects', blurb: 'Things I have built', hue: '#b48cff' },
  { id: 'skills', title: 'Skills', blurb: 'Collect them all', hue: '#5dffb0' },
  { id: 'opensource', title: 'Open Source', blurb: 'Giving back', hue: '#ff7a9c' },
  { id: 'education', title: 'Education', blurb: 'Where I studied', hue: '#ffe066' },
  { id: 'blog', title: 'Blog', blurb: 'Tech musings', hue: '#7df0ff' },
  { id: 'contact', title: 'Contact', blurb: 'Say hello', hue: '#ff9f5a' },
];

export const allSkills = skills.flatMap((g) => g.items);
