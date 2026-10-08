// ============================================
// MUBAS - FULL DATA SEED
// Parses the exam timetables to produce accurate
// programs, modules, lecturers, and student cohorts.
// 
// Run:  node scripts/seed-mubas.js
// ============================================

require('dotenv').config();
const db = require('../config/database');
const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const RESET = true;                 // set false to preserve existing rows
const STUDENTS_PER_PROGRAM = 4;     // Year 1 only by default
const SEED_STUDY_YEAR = 1;          // year the generated students are in

// ─────────────────────────────────────────────
// 1. SCHOOLS
// ─────────────────────────────────────────────
const SCHOOLS = [
    { id: 1, name: 'School of Engineering',                                    code: 'SOE'    },
    { id: 2, name: 'School of Science and Technology',                         code: 'SOST'   },
    { id: 3, name: 'School of Business and Economic Sciences',                 code: 'SOBES'  },
    { id: 4, name: 'School of Education, Communication and Media Studies',     code: 'SECOMS' },
    { id: 5, name: 'School of the Built Environment',                          code: 'SOBE'   },
];

// ─────────────────────────────────────────────
// 2. DEPARTMENTS
// ─────────────────────────────────────────────
const DEPARTMENTS = [
    // SoE (id 1)
    { code: 'CIV',  name: 'Civil Engineering',                              school_id: 1 },
    { code: 'ELE',  name: 'Electrical Engineering',                         school_id: 1 },
    { code: 'MEC',  name: 'Mechanical Engineering',                         school_id: 1 },
    { code: 'MIN',  name: 'Mining Engineering',                             school_id: 1 },
    // SoST (id 2)
    { code: 'CS',   name: 'Computer Science and Information Systems',       school_id: 2 },
    { code: 'MATH', name: 'Mathematical Sciences',                          school_id: 2 },
    { code: 'PBS',  name: 'Physics and Biochemical Sciences',               school_id: 2 },
    { code: 'PEHS', name: 'Public and Environmental Health Sciences',       school_id: 2 },
    // SoBES (id 3)
    { code: 'BM',   name: 'Business Management',                            school_id: 3 },
    { code: 'AF',   name: 'Accountancy and Finance',                        school_id: 3 },
    { code: 'EL',   name: 'Economics and Law',                              school_id: 3 },
    // SECOMS (id 4)
    { code: 'AE',   name: 'Applied Education',                              school_id: 4 },
    { code: 'LCS',  name: 'Language and Communication Studies',             school_id: 4 },
    { code: 'JMS',  name: 'Journalism and Media Studies',                   school_id: 4 },
    // SoBE (id 5)
    { code: 'ARC',  name: 'Architecture',                                   school_id: 5 },
    { code: 'PPLS', name: 'Physical Planning and Land Surveying',           school_id: 5 },
    { code: 'QSLE', name: 'Quantity Surveying and Land Economy',            school_id: 5 },
];

// ─────────────────────────────────────────────
// 3. PROGRAMS  (code, name, type, dept_code, duration)
// ─────────────────────────────────────────────
const PROGRAMS = [
    // ── School of Built Environment ────────────────────────
    ['BARC',  'BSc in Architecture (Honours)',                     'Degree', 'ARC',  5],
    ['BQS',   'BSc in Quantity Surveying (Honours)',               'Degree', 'QSLE', 5],
    ['BRE',   'BSc in Real Estate (Honours)',                      'Degree', 'QSLE', 5],
    ['BLS',   'BSc in Land Surveying (Honours)',                   'Degree', 'PPLS', 5],
    ['BPP',   'BSc in Physical Planning (Honours)',                'Degree', 'PPLS', 5],
    // ── School of Business and Economic Sciences ───────────
    ['BAC',   'Bachelor of Accountancy',                           'Degree', 'AF',   4],
    ['BAF',   'Bachelor of Banking & Finance',                     'Degree', 'AF',   4],
    ['BCTA',  'Bachelor of Commerce (Taxation)',                   'Degree', 'AF',   4],
    ['BIA',   'Bachelor of Internal Auditing',                     'Degree', 'AF',   4],
    ['BIRM',  'Bachelor of Insurance & Risk Management',           'Degree', 'AF',   4],
    ['BAM',   'Bachelor of Business Administration (Marketing)',   'Degree', 'BM',   4],
    ['BBA',   'Bachelor of Business Administration',               'Degree', 'BM',   4],
    ['BCEC',  'Bachelor of Commerce (Economics)',                  'Degree', 'EL',   4],
    ['BCERE', 'Bachelor of Commerce in Entrepreneurship',          'Degree', 'BM',   4],
    ['BCME',  'Bachelor of Commerce in Marketing',                 'Degree', 'BM',   4],
    ['BCTM',  'Bachelor of Commerce (Tourism Management)',         'Degree', 'BM',   4],
    ['BPSCM', 'Bachelor of Procurement and Logistics Management',  'Degree', 'BM',   4],
    ['LLB',   'Bachelor of Laws (Honours)',                        'Degree', 'EL',   4],
    // ── School of Engineering ──────────────────────────────
    ['BAE',   'BEng in Automotive Engineering (Honours)',          'Degree', 'MEC',  5],
    ['BBME',  'BEng in Biomedical Engineering (Honours)',          'Degree', 'ELE',  5],
    ['BCE',   'BEng in Civil Engineering (Honours)',               'Degree', 'CIV',  5],
    ['BECE',  'BEng in Electronics & Computer Engineering',        'Degree', 'ELE',  5],
    ['BEE',   'BEng in Electrical & Electronics Engineering',      'Degree', 'ELE',  5],
    ['BETE',  'BEng in Telecommunications Engineering',            'Degree', 'ELE',  5],
    ['BGEN',  'BEng in Geological Engineering (Honours)',          'Degree', 'MIN',  5],
    ['BMEN',  'BEng in Mining Engineering (Honours)',              'Degree', 'MIN',  5],
    ['BMMP',  'BEng in Metallurgy and Mineral Processing',         'Degree', 'MIN',  5],
    ['BPEN',  'BEng in Petroleum Engineering (Honours)',           'Degree', 'MIN',  5],
    ['BIE',   'BEng in Industrial Engineering (Honours)',          'Degree', 'MEC',  5],
    ['BME',   'BEng in Mechanical Engineering (Honours)',          'Degree', 'MEC',  5],
    // ── SECOMS ────────────────────────────────────────────
    ['BAJ',   'Bachelor of Arts in Journalism',                    'Degree', 'JMS',  4],
    ['BDJOU', 'Bachelor of Arts in Digital Journalism',            'Degree', 'JMS',  4],
    ['BBC',   'Bachelor of Arts in Business Communication',        'Degree', 'LCS',  4],
    ['BDC',   'Bachelor of Arts in Development Communication',     'Degree', 'JMS',  4],
    ['BPR',   'Bachelor of Arts in Public Relations',              'Degree', 'LCS',  4],
    ['BSBCC', 'Bachelor of Arts in Social & Behaviour Change Comm','Degree', 'LCS',  4],
    ['BSNIE', 'Bachelor of Special Needs and Inclusive Education', 'Degree', 'AE',   4],
    ['BTECH', 'Bachelor of Technical Education (Technology)',      'Degree', 'AE',   5],
    ['EBCS',  'BSc in Mathematical Sciences Education (Stats/Comp)','Degree','AE',   4],
    ['TED',   'Bachelor of Technical Education',                   'Degree', 'AE',   5],
    // ── SoST ──────────────────────────────────────────────
    ['BCS',   'BSc in Cybersecurity',                              'Degree', 'CS',   4],
    ['BIS',   'BSc in Information Systems',                        'Degree', 'CS',   4],
    ['BIT',   'BSc in Information Technology',                     'Degree', 'CS',   4],
    ['BSE',   'BSc in Software Engineering',                       'Degree', 'CS',   4],
    ['BEMT',  'BSc in Environmental Management & Technology',      'Degree', 'PBS',  4],
    ['BFST',  'BSc in Food Science and Technology',                'Degree', 'PBS',  4],
    ['BIEP',  'BSc in Industrial & Environmental Physics',         'Degree', 'PBS',  4],
    ['BILT',  'BSc in Industrial Laboratory Technology',           'Degree', 'PBS',  4],
    ['BOSH',  'BSc in Occupational Safety & Health',               'Degree', 'PEHS', 4],
    ['BEH',   'BSc in Environmental Health',                       'Degree', 'PEHS', 4],
];

// ─────────────────────────────────────────────
// 4. MODULES  [code, name, credits, level, dept_code]
//    (extracted from the exam timetable)
// ─────────────────────────────────────────────
const MODULES = [
    // ── LNC (Language & Communication) ────────────────────
    ['LNC-EAP-111', 'English for Academic Purposes I',             10, '100', 'LCS'],
    ['LNC-EAP-122', 'English for Academic Purposes II',            10, '100', 'LCS'],
    ['LNC-BCS-121', 'Business Communication Skills I',             10, '100', 'LCS'],
    ['LNC-BCO-121', 'Communication Skills I',                      10, '100', 'LCS'],
    ['LNC-LIT-111', 'Literature in English',                       10, '100', 'LCS'],
    ['LNC-MAC-111', 'Mass Communication',                          10, '100', 'LCS'],
    ['LNC-COT-111', 'Communication Theory',                        10, '100', 'LCS'],
    ['LNC-ORC-111', 'Oral Communication',                          10, '100', 'LCS'],
    ['LNC-BUC-221', 'Business Communication',                      10, '200', 'LCS'],
    ['LNC-IBC-121', 'Introduction to Business Communication',      10, '100', 'LCS'],
    ['LNC-INS-121', 'Introduction to Sociology',                   10, '100', 'LCS'],
    ['LNC-INC-121', 'Intercultural Communication',                 10, '100', 'LCS'],
    ['LNC-LCT-121', 'Logic and Critical Thinking',                 10, '100', 'LCS'],
    ['LNC-MES-121', 'Media and Society',                           10, '100', 'LCS'],
    ['LNC-PSY-111', 'Introduction to Psychology',                  10, '100', 'LCS'],
    ['LNC-ISB-111', 'Introduction to SBCC',                        10, '100', 'LCS'],
    ['LNC-PSY-121', 'Psychology',                                  10, '100', 'LCS'],
    ['LNC-SOC-121', 'Sociology',                                   10, '100', 'LCS'],
    ['LNC-CET-021', 'Communication Ethics',                        10, '000', 'LCS'],
    ['LNC-ELS-011', 'English Language Skills I',                   10, '000', 'LCS'],
    ['LNC-ELS-022', 'English Language Skills II',                  10, '000', 'LCS'],
    ['LNC-OMC-221', 'Organizational and Managerial Communication', 10, '200', 'LCS'],
    ['LNC-AAW-211', 'Advanced Academic Writing',                   10, '200', 'LCS'],
    ['LNC-COR-121', 'Community Relations',                         10, '100', 'LCS'],
    ['LNC-PRN-121', 'Public Relations in NGO',                     10, '100', 'LCS'],
    ['LNC-WPR-121', 'Writing for PR',                              10, '100', 'LCS'],
    ['LNC-IPR-111', 'Introduction to Public Relations',            10, '100', 'LCS'],
    ['LNC-MER-111', 'Media Relations',                             10, '100', 'LCS'],
    ['LNC-SPS-211', 'Social Psychology',                           10, '200', 'LCS'],
    ['LNC-ASP-311', 'Advertising and Sales Promotion',             10, '300', 'LCS'],
    ['LNC-OCO-311', 'Organizational Communication',                10, '300', 'LCS'],
    ['LNC-IDC-311', 'Introduction to Development Communication',   10, '300', 'LCS'],
    ['LNC-CSC-311', 'Customer Services Communication',             10, '300', 'LCS'],
    ['LNC-SBC-311', 'Social & Behaviour Change Communication',     10, '300', 'LCS'],
    ['LNC-BUN-411', 'Business Negotiation',                        10, '400', 'LCS'],
    ['LNC-GCO-411', 'Government Communication',                    10, '400', 'LCS'],
    ['LNC-RCO-411', 'Recruitment Communication',                   10, '400', 'LCS'],

    // ── MTS (Mathematical Sciences) ───────────────────────
    ['MTS-CAT-111', 'College Algebra and Trigonometry',            10, '100', 'MATH'],
    ['MTS-CAL-121', 'Trigonometry & Introduction to Calculus',     10, '100', 'MATH'],
    ['MTS-BUN-111', 'Business Numeracy',                           10, '100', 'MATH'],
    ['MTS-BUM-111', 'Business Mathematics I',                      10, '100', 'MATH'],
    ['MTS-ALT-111', 'Algebra & Trigonometry',                      10, '100', 'MATH'],
    ['MTS-STA-111', 'Introduction to Statistics',                  10, '100', 'MATH'],
    ['MTS-COA-111', 'College Algebra',                             10, '100', 'MATH'],
    ['MTS-PRO-111', 'Procedural Programming',                      10, '100', 'MATH'],
    ['MTS-NST-121', 'Numeracy & Statistics',                       10, '100', 'MATH'],
    ['MTS-LIA-221', 'Linear Algebra',                              10, '200', 'MATH'],
    ['MTS-CAB-121', 'Calculus for Business',                       10, '100', 'MATH'],
    ['MTS-STA-211', 'Statistics',                                  10, '200', 'MATH'],
    ['MTS-STA-221', 'Statistics',                                  10, '200', 'MATH'],
    ['MTS-STA-222', 'Business Statistics',                         10, '200', 'MATH'],
    ['MTS-CAL-212', 'Calculus II',                                 10, '200', 'MATH'],
    ['MTS-PST-311', 'Probability and Statistics',                  10, '300', 'MATH'],
    ['MTS-PRT-211', 'Probability Theory',                          10, '200', 'MATH'],
    ['MTS-DMA-211', 'Discrete Mathematics',                        10, '200', 'MATH'],
    ['MTS-INC-211', 'Integral Calculus',                           10, '200', 'MATH'],
    ['MTS-OOP-212', 'Object Oriented Programming',                 10, '200', 'MATH'],
    ['MTS-SEN-211', 'Introduction to Software Engineering',        10, '200', 'MATH'],
    ['MTS-DEQ-311', 'Differential Equations',                      10, '300', 'MATH'],
    ['MTS-RAN-311', 'Real Analysis',                               10, '300', 'MATH'],
    ['MTS-MCA-311', 'Multivariate Calculus',                       10, '300', 'MATH'],
    ['MTS-PVI-311', 'Programming - Visual Interfaces',             10, '300', 'MATH'],
    ['MTS-OPS-311', 'Operating Systems',                           10, '300', 'MATH'],
    ['MTS-DIT-311', 'Distribution Theory',                         10, '300', 'MATH'],
    ['MTS-RME-311', 'Research Methods',                            10, '300', 'MATH'],
    ['MTS-QAB-313', 'Quantitative Analysis for Business',          10, '300', 'MATH'],
    ['MTS-QFM-314', 'Quantitative Finance',                        10, '300', 'MATH'],
    ['MTS-NUM-211', 'Numerical Methods',                           10, '200', 'MATH'],
    ['MTS-ERM-321', 'Estimation and Regression Modelling',         10, '300', 'MATH'],
    ['MTS-ELC-021', 'Elementary Calculus',                         10, '000', 'MATH'],
    ['MTS-FBS-021', 'Fundamentals of Business Statistics',         10, '000', 'MATH'],
    ['MTS-FBM-011', 'Fundamentals of Business Mathematics',        10, '000', 'MATH'],
    ['MTS-AST-221', 'Applied Statistics',                          10, '200', 'MATH'],
    ['MTS-SET-221', 'Sampling and Estimation Theory',              10, '200', 'MATH'],
    ['MTS-CAN-421', 'Complex Analysis',                            10, '400', 'MATH'],
    ['MTS-ABA-421', 'Abstract Algebra',                            10, '400', 'MATH'],
    ['MTS-DAS-423', 'Data Analysis III',                           10, '400', 'MATH'],
    ['MTS-STA-423', 'Mathematical Statistics III',                 10, '400', 'MATH'],
    ['MTS-BST-221', 'Business Statistics I',                       10, '200', 'MATH'],
    ['MTS-VCS-221', 'Vector Calculus & Series',                    10, '200', 'MATH'],
    ['MTS-MCT-221', 'Foundations of Mathematics & Computer Teach', 10, '200', 'MATH'],
    ['MTS-OPR-321', 'Operations Research',                         10, '300', 'MATH'],
    ['MTS-APR-121', 'Advanced Programming',                        10, '100', 'MATH'],
    ['MTS-SOM-221', 'Software Management',                         10, '200', 'MATH'],
    ['MTS-STA-321', 'Statistical Inference',                       10, '300', 'MATH'],
    ['MTS-GLM-321', 'Generalized Linear Models',                   10, '300', 'MATH'],
    ['MTS-PAS-221', 'Probability & Statistics',                    10, '200', 'MATH'],
    ['MTS-STT-211', 'Probability and Statistics I',                10, '200', 'MATH'],
    ['MTS-STT-312', 'Probability and Statistics II',               10, '300', 'MATH'],

    // ── ACF (Accountancy & Finance) ───────────────────────
    ['ACF-FAC-111', 'Fundamentals of Accounting',                  10, '100', 'AF'],
    ['ACF-ACC-121', 'Business Accounting I',                       10, '100', 'AF'],
    ['ACF-ACC-211', 'Business Accounting II',                      10, '200', 'AF'],
    ['ACF-ACC-212', 'Business Accounting III',                     10, '200', 'AF'],
    ['ACF-ACC-223', 'Business Accounting III',                     10, '200', 'AF'],
    ['ACF-FIA-111', 'Financial Accounting I',                      10, '100', 'AF'],
    ['ACF-FIA-121', 'Financial Accounting II',                     10, '100', 'AF'],
    ['ACF-FIA-211', 'Financial Accounting II',                     10, '200', 'AF'],
    ['ACF-FIA-313', 'Financial Accounting III',                    10, '300', 'AF'],
    ['ACF-FIN-222', 'Financial Accounting II',                     10, '200', 'AF'],
    ['ACF-FIN-311', 'Financial Reporting I',                       10, '300', 'AF'],
    ['ACF-FIN-325', 'Financial Reporting II',                      10, '300', 'AF'],
    ['ACF-FIN-411', 'Financial Management',                        10, '400', 'AF'],
    ['ACF-FIN-412', 'Financial Management',                        10, '400', 'AF'],
    ['ACF-FIN-413', 'Advanced Financial Reporting',                10, '400', 'AF'],
    ['ACF-FIN-414', 'Financial Accounting IV',                     10, '400', 'AF'],
    ['ACF-FIN-425', 'Financial Accounting V',                      10, '400', 'AF'],
    ['ACF-CAC-211', 'Cost Accounting',                             10, '200', 'AF'],
    ['ACF-CAC-222', 'Costing and Budgetary Control',               10, '200', 'AF'],
    ['ACF-COA-321', 'Cost Accounting',                             10, '300', 'AF'],
    ['ACF-CGE-411', 'Corporate Governance and Ethics',             10, '400', 'AF'],
    ['ACF-CGE-414', 'Corporate Governance and Ethics',             10, '400', 'AF'],
    ['ACF-AAS-411', 'Auditing and Assurance Services',             10, '400', 'AF'],
    ['ACF-AAS-322', 'Auditing & Assurance Services I',             10, '300', 'AF'],
    ['ACF-AUD-321', 'Internal Auditing II',                        10, '300', 'AF'],
    ['ACF-AUD-421', 'Tax Auditing',                                10, '400', 'AF'],
    ['ACF-IAU-221', 'Introduction to Auditing',                    10, '200', 'AF'],
    ['ACF-IAU-412', 'Internal Auditing II',                        10, '400', 'AF'],
    ['ACF-TAX-221', 'Fundamentals of Taxation',                    10, '200', 'AF'],
    ['ACF-TAX-422', 'Advanced Taxation',                           10, '400', 'AF'],
    ['ACF-VAT-221', 'Value Added Tax',                             10, '200', 'AF'],
    ['ACF-INT-322', 'International Trade',                         10, '300', 'AF'],
    ['ACF-INT-421', 'International Taxation',                      10, '400', 'AF'],
    ['ACF-RIM-321', 'Risk Management',                             10, '300', 'AF'],
    ['ACF-RIM-421', 'Risk Management',                             10, '400', 'AF'],
    ['ACF-MAC-321', 'Performance Management',                      10, '300', 'AF'],
    ['ACF-MAA-422', 'Management Accounting II',                    10, '400', 'AF'],
    ['ACF-SAP-421', 'Security and Portfolio Management',           10, '400', 'AF'],
    ['ACF-PIV-421', 'Principles of Investment',                    10, '400', 'AF'],
    ['ACF-CRM-426', 'Credit Risk Analysis',                        10, '400', 'AF'],
    ['ACF-FSA-423', 'Finance and Security Analysis',               10, '400', 'AF'],
    ['ACF-FRM-421', 'Financial Risk Management',                   10, '400', 'AF'],
    ['ACF-FOM-411', 'Financial Modelling',                         10, '400', 'AF'],
    ['ACF-FMI-221', 'Financial Markets & Institutions',            10, '200', 'AF'],
    ['ACF-IBF-211', 'Introduction to Banking and Finance',         10, '200', 'AF'],
    ['ACF-INB-413', 'International Banking and Trade Finance',     10, '400', 'AF'],
    ['ACF-TRM-411', 'Treasury Management',                         10, '400', 'AF'],
    ['ACF-PLI-222', 'Property and Liability Insurance',            10, '200', 'AF'],
    ['ACF-UNP-222', 'Underwriting Practice',                       10, '200', 'AF'],
    ['ACF-RIM-223', 'Risk Management I',                           10, '200', 'AF'],
    ['ACF-PEA-421', 'Pension Administration',                      10, '400', 'AF'],
    ['ACF-GNI-212', 'General Insurance',                           10, '200', 'AF'],
    ['ACF-REI-411', 'Reinsurance',                                 10, '400', 'AF'],
    ['ACF-CLM-411', 'Claims Management',                           10, '400', 'AF'],
    ['ACF-ASC-411', 'Actuarial Science',                           10, '400', 'AF'],
    ['ACF-FUT-211', 'Fundamentals of Taxation',                    10, '200', 'AF'],
    ['ACF-PSF-211', 'Public Sector Finance',                       10, '200', 'AF'],
    ['ACF-INC-311', 'Income Tax',                                  10, '300', 'AF'],
    ['ACF-CUS-311', 'Customs and Excise',                          10, '300', 'AF'],
    ['ACF-FAM-311', 'Financial Management',                        10, '300', 'AF'],
    ['ACC-ACC-121', 'Business Accounting I',                       10, '100', 'AF'],
    ['ACC-ACC-212', 'Business Accounting II',                      10, '200', 'AF'],
    ['ACC-FIN-311', 'Financial Reporting I',                       10, '300', 'AF'],
    ['ACC-FIN-312', 'Financial Reporting I',                       10, '300', 'AF'],

    // ── BUS (Business Management) ─────────────────────────
    ['BUS-POM-111', 'Principles of Management',                    10, '100', 'BM'],
    ['BUS-ECO-111', 'Micro-Economics',                             10, '100', 'BM'],
    ['BUS-ECN-111', 'Introduction to Microeconomics',              10, '100', 'BM'],
    ['BUS-MGT-311', 'Engineering Management',                      10, '300', 'BM'],
    ['BUS-OBE-111', 'Organisational Behaviour',                    10, '100', 'BM'],
    ['BUS-OBE-211', 'Organisational Behaviour',                    10, '200', 'BM'],
    ['BUS-OBE-311', 'Organisational Behaviour',                    10, '300', 'BM'],
    ['BUS-PRM-321', 'Project Management',                          10, '300', 'BM'],
    ['BUS-PRM-411', 'Project Management',                          10, '400', 'BM'],
    ['BUS-MRK-212', 'Fundamentals of Marketing II',                10, '200', 'BM'],
    ['BUS-MKT-121', 'Fundamentals of Marketing I',                 10, '100', 'BM'],
    ['BUS-MKT-212', 'Principles of Marketing',                     10, '200', 'BM'],
    ['BUS-PMK-211', 'Property Marketing',                          10, '200', 'BM'],
    ['BUS-PMK-221', 'Principles of Marketing',                     10, '200', 'BM'],
    ['BUS-DIM-311', 'Digital Marketing',                           10, '300', 'BM'],
    ['BUS-DIM-312', 'Digital Marketing',                           10, '300', 'BM'],
    ['BUS-DIM-322', 'Digital Marketing II',                        10, '300', 'BM'],
    ['BUS-MQT-311', 'Management Quantitative Techniques',          10, '300', 'BM'],
    ['BUS-LAW-213', 'Commercial Law',                              10, '200', 'BM'],
    ['BUS-LAW-311', 'Corporate Law I',                             10, '300', 'BM'],
    ['BUS-LAW-314', 'Company Law',                                 10, '300', 'BM'],
    ['BUS-LAW-322', 'Corporate Law II',                            10, '300', 'BM'],
    ['BUS-STM-411', 'Strategic Management',                        10, '400', 'BM'],
    ['BUS-EBS-411', 'E-Business',                                  10, '400', 'BM'],
    ['BUS-MAM-411', 'Marketing Management',                        10, '400', 'BM'],
    ['BUS-OPM-411', 'Operations Management',                       10, '400', 'BM'],
    ['BUS-OPM-412', 'Operations Management',                       10, '400', 'BM'],
    ['BUS-SOM-411', 'Sales Operations Management',                 10, '400', 'BM'],
    ['BUS-HRM-421', 'Human Resource Management',                   10, '400', 'BM'],
    ['BUS-ENT-411', 'Entrepreneurship',                            10, '400', 'BM'],
    ['BUS-ENT-413', 'Entrepreneurship and Innovation',             10, '400', 'BM'],
    ['BUS-ENT-421', 'Entrepreneurship & Innovation',               10, '400', 'BM'],
    ['BUS-ENT-423', 'Fundamentals of Entrepreneurship',            10, '400', 'BM'],
    ['BUS-CAC-211', 'Cost Accounting',                             10, '200', 'BM'],
    ['BUS-ACC-212', 'Business Accounting II',                      10, '200', 'BM'],
    ['BUS-ACC-213', 'Business Accounting II',                      10, '200', 'BM'],
    ['BUS-PMA-211', 'Principles of Marketing',                     10, '200', 'BM'],
    ['BUS-WIM-211', 'Warehousing and Inventory Management',        10, '200', 'BM'],
    ['BUS-SCM-311', 'Supply Chain Management Theory',              10, '300', 'BM'],
    ['BUS-PPR-311', 'Public Procurement Regimes',                  10, '300', 'BM'],
    ['BUS-HLM-311', 'Humanitarian Logistics Management',           10, '300', 'BM'],
    ['BUS-CGE-311', 'Corporate Governance and Procurement',        10, '300', 'BM'],
    ['BUS-PCM-411', 'Projects and Contracts Management',           10, '400', 'BM'],
    ['BUS-PDA-411', 'Procurement & Disposal Audit',                10, '400', 'BM'],
    ['BUS-STP-411', 'Strategic Procurement',                       10, '400', 'BM'],
    ['BUS-FIR-310', 'Financial Reporting',                         10, '300', 'BM'],
    ['BUS-MPP-221', 'Management Principles',                       10, '200', 'BM'],
    ['BUS-SUS-221', 'Sustainable Tourism',                         10, '200', 'BM'],
    ['BUS-SUS-322', 'Sustainable Tourism',                         10, '300', 'BM'],
    ['BUS-SBE-421', 'Small Business Enterprise',                   10, '400', 'BM'],
    ['BUS-SBM-421', 'Small Business Management',                   10, '400', 'BM'],
    ['BUS-BME-521', 'Business Management and Entrepreneurship',    10, '500', 'BM'],
    ['BUS-MBE-521', 'Business Management and Entrepreneurship',    10, '500', 'BM'],
    ['BUS-MMG-422', 'Media Management',                            10, '400', 'BM'],
    ['BUS-MRK-121', 'Fundamentals of Marketing I',                 10, '100', 'BM'],
    ['BUS-POM-122', 'Principles of Management',                    10, '100', 'BM'],
    ['BUS-CIN-211', 'Creativity and Innovation',                   10, '200', 'BM'],
    ['BUS-IHM-121', 'Introduction to Hospitality Management',      10, '100', 'BM'],
    ['BUS-TPP-121', 'Tourism Principles and Practice',             10, '100', 'BM'],
    ['BUS-MOB-121', 'Management & Organisational Behaviour',       10, '100', 'BM'],
    ['BUS-PSM-121', 'Principles of Procurement & SCM',             10, '100', 'BM'],
    ['BUS-PPS-111', 'Principles of Procurement & Supply',          10, '100', 'BM'],
    ['BUS-PPS-221', 'Procurement Planning and Dev of Specs',       10, '200', 'BM'],
    ['BUS-CON-221', 'Commercial Negotiations',                     10, '200', 'BM'],
    ['BUS-TLM-221', 'Transport and Logistic Management',           10, '200', 'BM'],
    ['BUS-IPN-221', 'International Procurement',                   10, '200', 'BM'],
    ['BUS-EBS-321', 'Electronic Business Strategy',                10, '300', 'BM'],
    ['BUS-SRM-421', 'Supply Chain Risk Management',                10, '400', 'BM'],
    ['BUS-SPS-421', 'Sustainable Procurement and SCM',             10, '400', 'BM'],
    ['BUS-WIM-121', 'Warehousing and Inventory Management',        10, '100', 'BM'],
    ['BUS-PPS-111', 'Principles of Procurement & Supply Chain',    10, '100', 'BM'],
    ['BUS-CSP-421', 'Corporate Policy & Strategic Planning',       10, '400', 'BM'],
    ['BUS-ORB-111', 'Organisational Behaviour',                    10, '100', 'BM'],
    ['BUS-MGT-311', 'Engineering Management',                      10, '300', 'BM'],
    ['BUS-IEM-221', 'Introduction to Entrepreneurship & Mgmt',     10, '200', 'BM'],
    ['BUS-ECN-313', 'Managerial Economics',                        10, '300', 'BM'],
    ['BUS-MEC-521', 'Mechatronics',                                10, '500', 'MEC'],
    ['BUS-SME-511', 'Strategic Management for Engineers',          10, '500', 'BM'],
    ['BUS-EHL-411', 'Environmental Health Law',                    10, '400', 'BM'],

    // ── ECL (Economics & Law) ─────────────────────────────
    ['ECL-TOT-111', 'Law of Torts',                                10, '100', 'EL'],
    ['ECL-CON-111', 'Law of Contract',                             10, '100', 'EL'],
    ['ECL-ITL-111', 'Introduction to Law / Legal Method',          10, '100', 'EL'],
    ['ECL-ADL-111', 'Administrative Law',                          10, '100', 'EL'],
    ['ECL-COL-111', 'Constitutional Law',                          10, '100', 'EL'],
    ['ECL-CRL-111', 'Criminal Law',                                10, '100', 'EL'],
    ['ECL-GPL-111', 'General Principles of Law',                   10, '100', 'EL'],
    ['ECL-ECN-111', 'Introduction to Microeconomics',              10, '100', 'EL'],
    ['ECL-ECN-122', 'Introduction to Macroeconomics',              10, '100', 'EL'],
    ['ECL-FBL-111', 'Foundational Business Law',                   10, '100', 'EL'],
    ['ECL-FBL-121', 'Foundational Business Law',                   10, '100', 'EL'],
    ['BUS-ENT-111', 'Fundamentals of Entrepreneurship',            10, '100', 'BM'],
    ['JMS-DET-111', 'Development Theory',                          10, '100', 'JMS'],
    ['JMS-ICM-111', 'Indigenous and Community Media',              10, '100', 'JMS'],
    ['ECL-ENL-111', 'Environmental Law',                           10, '100', 'EL'],
    ['ECL-FAC-211', 'Fundamentals of Accounting',                  10, '200', 'EL'],
    ['ECL-CEL-211', 'Commercial and Employment Law',               10, '200', 'EL'],
    ['ECL-WLS-211', 'Wills and Succession',                        10, '200', 'EL'],
    ['ECL-BUE-211', 'Business Economics',                          10, '200', 'EL'],
    ['ECL-GEL-211', 'Gender and the Law',                          10, '200', 'EL'],
    ['ECL-INS-211', 'Insurance Law',                               10, '200', 'EL'],
    ['ECL-RCM-211', 'Regulatory Compliance Management',            10, '200', 'EL'],
    ['ECL-LBO-221', 'Law of Business Organisations',               10, '200', 'EL'],
    ['ECL-LDL-221', 'Land Law',                                    10, '200', 'EL'],
    ['ECL-PRL-221', 'Private International Law',                   10, '200', 'EL'],
    ['ECL-COG-221', 'Corporate Governance',                        10, '200', 'EL'],
    ['ECL-HRL-221', 'Human Rights Law',                            10, '200', 'EL'],
    ['ECL-JUR-221', 'Jurisprudence',                               10, '200', 'EL'],
    ['ECL-COM-121', 'Commercial Law',                              10, '100', 'EL'],
    ['ECL-PIL-121', 'Public International Law',                    10, '100', 'EL'],
    ['ECL-IRL-121', 'Industrial Relations Law',                    10, '100', 'EL'],
    ['ECL-CPL-121', 'Competition Law',                             10, '100', 'EL'],
    ['ECL-FSL-121', 'Financial Services Law',                      10, '100', 'EL'],
    ['ECL-LAW-322', 'Corporate Law II',                            10, '300', 'EL'],
    ['ECL-COL-121', 'Commercial Law',                              10, '100', 'EL'],
    ['ECL-CLA-221', 'Corporate Law',                               10, '200', 'EL'],
    ['ECL-LUW-221', 'Land Law I',                                  10, '200', 'EL'],
    ['ECL-LFT-221', 'Law for Tourism',                             10, '200', 'EL'],
    ['ECL-MLP-221', 'Media Law, Policy and Regulation',            10, '200', 'EL'],
    ['ECL-DMR-221', 'Digital Media Regulation',                    10, '200', 'EL'],
    ['ECL-EHE-421', 'Environmental Health Economics',              10, '400', 'EL'],
    ['ECL-ENE-421', 'Environmental Economics',                     10, '400', 'EL'],
    ['ECL-PRE-121', 'Principles of Economics',                     10, '100', 'EL'],
    ['ECL-LAW-425', 'Case Law',                                    10, '400', 'EL'],
    ['ECL-ENE-421', 'Environmental Economics',                     10, '400', 'EL'],
    ['ECL-BUS-ECO-111', 'Micro-Economics',                         10, '100', 'EL'],

    // ── ARC (Architecture) ────────────────────────────────
    ['ARC-HTA-111', 'History and Theory of Architecture I',        10, '100', 'ARC'],
    ['ARC-HTA-122', 'History and Theory of Architecture II',       10, '100', 'ARC'],
    ['ARC-HTA-213', 'History and Theory of Architecture III',      10, '200', 'ARC'],
    ['ARC-HTA-224', 'History and Theory of Architecture IV',       10, '200', 'ARC'],
    ['ARC-HTA-315', 'History and Theory of Architecture V',        10, '300', 'ARC'],
    ['ARC-COT-211', 'Construction Technology I',                   10, '200', 'ARC'],
    ['ARC-COT-222', 'Construction Technology II',                  10, '200', 'ARC'],
    ['ARC-COT-313', 'Construction Technology III',                 10, '300', 'ARC'],
    ['ARC-EDS-211', 'Environmental Design and Services I',         10, '200', 'ARC'],
    ['ARC-EDS-222', 'Environmental Science and Design II',         10, '200', 'ARC'],
    ['ARC-EDS-313', 'Environmental Design and Services III',       10, '300', 'ARC'],
    ['ARC-CMM-313', 'Construction Materials & Methods III',        10, '300', 'ARC'],
    ['ARC-CMM-324', 'Construction Materials & Methods IV',         10, '300', 'ARC'],
    ['ARC-CMM-415', 'Construction Materials & Methods V',          10, '400', 'ARC'],
    ['ARC-CMM-426', 'Construction Materials & Methods VI',         10, '400', 'ARC'],
    ['ARC-BUS-311', 'Building Services Engineering',               10, '300', 'ARC'],
    ['ARC-BUS-322', 'Building Services II',                        10, '300', 'ARC'],
    ['ARC-BES-311', 'Built Environment and Society',               10, '300', 'ARC'],
    ['ARC-STR-412', 'Structural Design II',                        10, '400', 'ARC'],
    ['ARC-HHS-411', 'Housing and Human Settlements',               10, '400', 'ARC'],
    ['ARC-RCC-411', 'Restoration, Conversion and Conservation',    10, '400', 'ARC'],
    ['ARC-UPD-411', 'Urban Studies, Planning and Design',          10, '400', 'ARC'],
    ['ARC-IND-421', 'Interior Design',                             10, '400', 'ARC'],
    ['ARC-LAD-421', 'Landscape Design',                            10, '400', 'ARC'],
    ['ARC-CDR-111', 'Construction Drawing',                        10, '100', 'ARC'],
    ['ARC-CDR-121', 'Construction Drawing',                        10, '100', 'ARC'],
    ['ARC-ESD-323', 'Environmental Science & Design III',          10, '300', 'ARC'],
    ['ARC-DMM-121', 'Drawing and Model Making',                    10, '100', 'ARC'],

    // ── LQS (Quantity Surveying & Land Economy) ───────────
    ['LQS-QQS-111', 'Introduction to Quantity Surveying',          10, '100', 'QSLE'],
    ['LQS-QQS-122', 'Quantities II',                               10, '100', 'QSLE'],
    ['LQS-CMM-111', 'Construction Methods & Materials I',          10, '100', 'QSLE'],
    ['LQS-CMM-122', 'Construction Methods & Materials II',         10, '100', 'QSLE'],
    ['LQS-CMM-213', 'Construction Materials and Methods III',      10, '200', 'QSLE'],
    ['LQS-CMM-222', 'Construction Materials and Methods IV',       10, '200', 'QSLE'],
    ['LQS-CMM-325', 'Construction Methods & Materials IV',         10, '300', 'QSLE'],
    ['LQS-QOH-111', 'Quantities I',                                10, '100', 'QSLE'],
    ['LQS-QOH-212', 'Quantities II',                               10, '200', 'QSLE'],
    ['LQS-QOH-213', 'Quantities III',                              10, '200', 'QSLE'],
    ['LQS-QOH-224', 'Quantities IV',                               10, '200', 'QSLE'],
    ['LQS-CMM-211', 'Construction Materials and Methods III',      10, '200', 'QSLE'],
    ['LQS-QSP-211', 'Quantity Surveying Practice I',               10, '200', 'QSLE'],
    ['LQS-QSP-222', 'Quantity Surveying Practice II',              10, '200', 'QSLE'],
    ['LQS-QSP-311', 'Quantity Surveying Practice III',             10, '300', 'QSLE'],
    ['LQS-QSP-322', 'Quantity Surveying Practice II',              10, '300', 'QSLE'],
    ['LQS-CEC-311', 'Construction Economics I',                    10, '300', 'QSLE'],
    ['LQS-CEC-412', 'Construction Economics II',                   10, '400', 'QSLE'],
    ['LQS-ACM-311', 'Advanced Construction Methods',               10, '300', 'QSLE'],
    ['LQS-ACM-412', 'Advanced Construction Methods II',            10, '400', 'QSLE'],
    ['LQS-MBW-313', 'Measurement of Building Works IV',            10, '300', 'QSLE'],
    ['LQS-MBW-414', 'Measurement of Building Works V',             10, '400', 'QSLE'],
    ['LQS-QIT-311', 'Quantity Surveying Information Technology',   10, '300', 'QSLE'],
    ['LQS-QIT-321', 'Quantity Surveying Software Packages',        10, '300', 'QSLE'],
    ['LQS-QIT-411', 'Quantity Surveying IT',                       10, '400', 'QSLE'],
    ['LQS-QIT-423', 'Quantity Surveying Information Technology',   10, '400', 'QSLE'],
    ['LQS-COM-221', 'Construction Management',                     10, '200', 'QSLE'],
    ['LQS-COM-421', 'Construction Management I',                   10, '400', 'QSLE'],
    ['LQS-FCM-411', 'Financial Corporate Management 1',            10, '400', 'QSLE'],
    ['LQS-COA-421', 'Construction Administration and Law I',       10, '400', 'QSLE'],
    ['LQS-MEW-321', 'Measurement of Engineering Works',            10, '300', 'QSLE'],
    ['LQS-MEW-422', 'Measurement of Engineering Works II',         10, '400', 'QSLE'],
    ['LQS-MEW-512', 'Measurement of Engineering Works III',        10, '500', 'QSLE'],
    ['LQS-MEW-522', 'Measurement of Engineering Works III',        10, '500', 'QSLE'],
    ['LQS-EST-312', 'Estimating and Tendering',                    10, '300', 'QSLE'],
    ['LQS-EST-513', 'Estimation and Tendering',                    10, '500', 'QSLE'],
    ['LQS-PRP-421', 'Professional Practice I',                     10, '400', 'QSLE'],
    ['LQS-PRP-522', 'Professional Practice II',                    10, '500', 'QSLE'],
    ['LQS-STR-221', 'Structures',                                  10, '200', 'QSLE'],
    ['LQS-STR-221', 'Theory of Structures I',                      10, '200', 'QSLE'],
    ['LQS-PEC-521', 'Property Economics',                          10, '500', 'QSLE'],
    ['LQS-PMG-522', 'Project Management',                          10, '500', 'QSLE'],
    ['LQS-SMG-521', 'Strategic Management',                        10, '500', 'QSLE'],
    ['LQS-IQS-111', 'Introduction to Quantity Surveying',          10, '100', 'QSLE'],
    ['LQS-IQS-121', 'Introduction to Quantity Surveying',          10, '100', 'QSLE'],
    ['LQS-BUT-111', 'Building Technology',                         10, '100', 'QSLE'],
    ['LQS-IRE-111', 'Introduction to Real Estate',                 10, '100', 'QSLE'],
    ['LQS-PVA-311', 'Property Valuation I',                        10, '300', 'QSLE'],
    ['LQS-PVA-422', 'Property Valuation II',                       10, '400', 'QSLE'],
    ['LQS-PRD-211', 'Property Development I',                      10, '200', 'QSLE'],
    ['LQS-PRD-422', 'Property Development II',                     10, '400', 'QSLE'],
    ['LQS-PFI-311', 'Property Finance',                            10, '300', 'QSLE'],
    ['LQS-PFI-411', 'Property Investment and Finance',             10, '400', 'QSLE'],
    ['LQS-PTA-311', 'Property Taxation',                           10, '300', 'QSLE'],
    ['LQS-EAM-411', 'Estate Agency and Marketing',                 10, '400', 'QSLE'],
    ['LQS-LAD-311', 'Land Administration',                         10, '300', 'QSLE'],
    ['LQS-STA-411', 'Rating and Statutory Valuation I',            10, '400', 'QSLE'],
    ['LQS-LEC-411', 'Land Economics I',                            10, '400', 'QSLE'],
    ['LQS-LEC-422', 'Land Economics II',                           10, '400', 'QSLE'],
    ['LQS-PPR-411', 'Professional Practice I',                     10, '400', 'QSLE'],
    ['LQS-PDE-511', 'Land and Development (Property Dev)',         10, '500', 'QSLE'],
    ['LQS-AVL-511', 'Applied Valuation',                           10, '500', 'QSLE'],
    ['LQS-PMG-511', 'Property Management',                         10, '500', 'QSLE'],
    ['LQS-PMK-521', 'Property Marketing',                          10, '500', 'QSLE'],
    ['LQS-HEC-521', 'Housing Economics',                           10, '500', 'QSLE'],
    ['LQS-AVL-522', 'Applied Valuation',                           10, '500', 'QSLE'],
    ['LQS-PMG-522', 'Property Management',                         10, '500', 'QSLE'],
    ['LQS-PFA-521', 'Property Financial Analysis',                 10, '500', 'QSLE'],
    ['LQS-PIF-422', 'Property Investment and Finance',             10, '400', 'QSLE'],
    ['LQS-STV-422', 'Statutory Valuation II',                      10, '400', 'QSLE'],
    ['LQS-BDD-421', 'Building Defects Diagnosis',                  10, '400', 'QSLE'],
    ['LQS-PVA-422', 'Property Valuation II',                       10, '400', 'QSLE'],
    ['LQS-CQC-111', 'Construction Quality Management',             10, '100', 'QSLE'],
    ['LQS-CAC-111', 'Construction Accounting',                     10, '100', 'QSLE'],

    // ── LSP (Land Surveying & Physical Planning) ──────────
    ['LSP-SUR-111', 'Introduction to Land Surveying',              10, '100', 'PPLS'],
    ['LSP-IPB-111', 'Introduction to Planning and Building',       10, '100', 'PPLS'],
    ['LSP-GNS-121', 'Introduction to GNSS',                        10, '100', 'PPLS'],
    ['LSP-SUR-122', 'Land Surveying II',                           10, '100', 'PPLS'],
    ['LSP-SUR-121', 'Surveying I',                                 10, '100', 'PPLS'],
    ['LSP-SUR-212', 'Surveying II',                                10, '200', 'PPLS'],
    ['LSP-ILM-121', 'Introduction to Land Administration',         10, '100', 'PPLS'],
    ['LSP-CAR-211', 'Cartography I',                               10, '200', 'PPLS'],
    ['LSP-CAR-411', 'Cartography II',                              10, '400', 'PPLS'],
    ['LSP-GDS-211', 'Fundamentals of Geodesy',                     10, '200', 'PPLS'],
    ['LSP-GDS-411', 'Geodetic Surveying',                          10, '400', 'PPLS'],
    ['LSP-PHO-211', 'Photogrammetry I',                            10, '200', 'PPLS'],
    ['LSP-PHO-222', 'Photogrammetry II',                           10, '200', 'PPLS'],
    ['LSP-PHO-411', 'Photogrammetry II',                           10, '400', 'PPLS'],
    ['LSP-GIS-221', 'Geographical Information Systems I',          10, '200', 'PPLS'],
    ['LSP-GIS-321', 'Geographical Information Systems I',          10, '300', 'PPLS'],
    ['LSP-GIS-411', 'Geographical Information Systems II',         10, '400', 'PPLS'],
    ['LSP-GIS-421', 'GIS and Remote Sensing',                      10, '400', 'PPLS'],
    ['LSP-PSU-221', 'Planning for Sustainable Utility Infra',      10, '200', 'PPLS'],
    ['LSP-RDP-221', 'Regional Development Planning',               10, '200', 'PPLS'],
    ['LSP-UDP-221', 'Urbanization and Urban Development Policy',   10, '200', 'PPLS'],
    ['LSP-RES-311', 'Remote Sensing',                              10, '300', 'PPLS'],
    ['LSP-ISO-121', 'Introduction to Sociology',                   10, '100', 'PPLS'],
    ['LSP-PST-121', 'Planning Process and Survey Techniques',      10, '100', 'PPLS'],
    ['LSP-GRS-221', 'GIS and Remote Sensing',                      10, '200', 'PPLS'],
    ['LSP-SPA-422', 'Spatial Analysis',                            10, '400', 'PPLS'],
    ['LSP-SMP-421', 'Space Geodesy',                               10, '400', 'PPLS'],
    ['LSP-DLS-422', 'Data Analysis by Least Squares',              10, '400', 'PPLS'],
    ['LSP-CAS-422', 'Cadastral Surveying Project',                 10, '400', 'PPLS'],
    ['LSP-ENS-221', 'Engineering Surveying',                       10, '200', 'PPLS'],
    ['LSP-ENS-421', 'Engineering Surveying (Optional)',            10, '400', 'PPLS'],
    ['LSP-ENS-522', 'Advanced Engineering Surveying',              10, '500', 'PPLS'],
    ['LSP-PGE-521', 'Physical Geodesy',                            10, '500', 'PPLS'],
    ['LSP-SSM-521', 'Spatial Statistics and Modeling',             10, '500', 'PPLS'],
    ['LSP-EPP-221', 'Ethics and Professional Practice',            10, '200', 'PPLS'],
    ['LSP-ENS-521', 'Advanced Engineering Surveying',              10, '500', 'PPLS'],
    ['LSP-CDP-211', 'Community Development Planning',              10, '200', 'PPLS'],
    ['LSP-PDC-211', 'Planning Law and Development Control',        10, '200', 'PPLS'],
    ['LSP-PPD-211', 'Population Dynamics',                         10, '200', 'PPLS'],
    ['LSP-DRM-211', 'Intro to Disaster Risk Management',           10, '200', 'PPLS'],
    ['LSP-CDP-211', 'Community Development Planning',              10, '200', 'PPLS'],
    ['LSP-BLS-321', 'Cadastral Surveying',                         10, '300', 'PPLS'],
    ['LSP-EPP-221', 'Ethics and Professional Practice',            10, '200', 'PPLS'],
    ['LSP-INS-311', 'Introduction to Surveying',                   10, '300', 'PPLS'],
    ['LSP-LAS-211', 'Introduction to Land Surveying',              10, '200', 'PPLS'],
    ['LSP-MSU-321', 'Mine Surveying',                              10, '300', 'PPLS'],
    ['LSP-HSP-311', 'Health and Safety Practices',                 10, '300', 'PPLS'],
    ['LSP-CAR-211', 'Cartography 1',                               10, '200', 'PPLS'],
    ['LSP-HYS-511', 'Hydrographic Surveying',                      10, '500', 'PPLS'],
    ['LSP-LSM-411', 'Land Surveying Measurement Techniques',       10, '400', 'PPLS'],
    ['LSP-FGS-311', 'Fundamentals of Geodesy',                     10, '300', 'PPLS'],

    // ── BUS extra for LQS mapping above ────────────────

    // ── CS (Computer Science) ─────────────────────────────
    ['CIS-PRO-111', 'Programming I',                               10, '100', 'CS'],
    ['CIS-PRO-122', 'Programming II',                              10, '100', 'CS'],
    ['CIS-PRO-313', 'Programming III',                             10, '300', 'CS'],
    ['CIS-PRO-211', 'Programming I',                               10, '200', 'CS'],
    ['CIS-CYS-111', 'Cybersecurity I',                             10, '100', 'CS'],
    ['CIS-CYS-122', 'Cybersecurity II',                            10, '100', 'CS'],
    ['CIS-FCN-111', 'Fundamentals of Computer Networks',           10, '100', 'CS'],
    ['CIS-CHS-121', 'Computer Hardware Systems I',                 10, '100', 'CS'],
    ['CIS-CHS-212', 'Computer Hardware Systems II',                10, '200', 'CS'],
    ['CIS-CHS-313', 'Computer Hardware Systems III',               10, '300', 'CS'],
    ['CIS-INS-111', 'Information Systems',                         10, '100', 'CS'],
    ['CIS-ICT-111', 'Introduction to ICT',                         10, '100', 'CS'],
    ['CIS-ICT-121', 'Introduction to ICT',                         10, '100', 'CS'],
    ['CIS-ISA-321', 'Information Systems Audit',                   10, '300', 'CS'],
    ['CIS-OPS-221', 'Operating System',                            10, '200', 'CS'],
    ['CIS-OPS-311', 'Operating Systems I',                         10, '300', 'CS'],
    ['CIS-OPS-322', 'Operating Systems II',                        10, '300', 'CS'],
    ['CIS-DMS-221', 'Database Management Systems',                 10, '200', 'CS'],
    ['CIS-DMS-321', 'Database Management Systems',                 10, '300', 'CS'],
    ['CIS-DMS-421', 'Database Management Systems',                 10, '400', 'CS'],
    ['CIS-DSA-221', 'Data Structures and Algorithms',              10, '200', 'CS'],
    ['CIS-DSA-311', 'Data Structures and Algorithms',              10, '300', 'CS'],
    ['CIS-DSA-321', 'Data Structures and Algorithms',              10, '300', 'CS'],
    ['CIS-SWR-121', 'Switching and Routing',                       10, '100', 'CS'],
    ['CIS-SSA-121', 'Secure Systems Analysis and Design I',        10, '100', 'CS'],
    ['CIS-GIS-221', 'Geographical Information Systems',            10, '200', 'CS'],
    ['CIS-SAD-221', 'Systems Analysis and Design',                 10, '200', 'CS'],
    ['CIS-WEP-211', 'Web Programming',                             10, '200', 'CS'],
    ['CIS-WEB-221', 'Web Programming',                             10, '200', 'CS'],
    ['CIS-AST-221', 'Applied Statistics',                          10, '200', 'CS'],
    ['CIS-SEA-321', 'Server Administration',                       10, '300', 'CS'],
    ['CIS-MSD-321', 'Mobile Solutions Development',                10, '300', 'CS'],
    ['CIS-CSS-321', 'Computer Systems Security',                   10, '300', 'CS'],
    ['CIS-ISE-111', 'Introduction to Software Engineering',        10, '100', 'CS'],
    ['CIS-ISE-321', 'Introduction to Software Engineering',        10, '300', 'CS'],
    ['CIS-CCS-121', 'Cloud Computing and Services',                10, '100', 'CS'],
    ['CIS-ETI-121', 'Emerging Technologies in Info Systems',       10, '100', 'CS'],
    ['CIS-CGR-311', 'Computer Graphics',                           10, '300', 'CS'],
    ['CIS-DAD-311', 'Database Administration',                     10, '300', 'CS'],
    ['CIS-INN-211', 'Interconnecting Networks',                    10, '200', 'CS'],
    ['CIS-CAC-211', 'Computerized Accounting',                     10, '200', 'CS'],
    ['CIS-IT-121', 'Introduction to ICT',                          10, '100', 'CS'],
    ['CIS-IMG-421', 'Computer Graphics',                           10, '400', 'CS'],
    ['CIS-SAM-411', 'Server Administration I',                     10, '400', 'CS'],
    ['CIS-SAM-422', 'Server Administration II',                    10, '400', 'CS'],
    ['CIS-ISA-321', 'Information Systems Audit',                   10, '300', 'CS'],
    ['CIS-KMS-221', 'Knowledge Management Systems',                10, '200', 'CS'],
    ['CIT-CSC-111', 'Computer Skills for Communicators',           10, '100', 'CS'],
    ['CIT-CSC-411', 'Human-Computer Interaction',                  10, '400', 'CS'],
    ['CIT-HCI-411', 'Human-Computer Interaction',                  10, '400', 'CS'],
    ['CIT-ITC-111', 'Introduction to ICT',                         10, '100', 'CS'],
    ['CIT-ICT-111', 'Introduction to ICT',                         10, '100', 'CS'],
    ['CIT-IMG-421', 'Computer Graphics',                           10, '400', 'CS'],
    ['CIT-SEO-311', 'Search Engine Optimisation',                  10, '300', 'CS'],
    ['CIT-ISM-311', 'Information Systems for Strategic Mgmt',      10, '300', 'CS'],
    ['CIT-DAM-411', 'Database Administration',                     10, '400', 'CS'],
    ['CIT-GIS-411', 'Geographic Information Systems',              10, '400', 'CS'],
    ['CIT-AIT-411', 'Artificial Intelligence',                     10, '400', 'CS'],
    ['CIT-PRG-411', 'Java Programming I',                          10, '400', 'CS'],

    // ── MEC (Mechanical Engineering) ──────────────────────
    ['MEC-END-111', 'Engineering Drawing I',                       10, '100', 'MEC'],
    ['MEC-END-121', 'Engineering Drawing II',                      10, '100', 'MEC'],
    ['MEC-END-213', 'Engineering Drawing III',                     10, '200', 'MEC'],
    ['MEC-END-122', 'Engineering Drawing II',                      10, '100', 'MEC'],
    ['MEC-MES-111', 'Mechanical Science',                          10, '100', 'MEC'],
    ['MEC-MES-121', 'Mechanical Science',                          10, '100', 'MEC'],
    ['MEC-VTP-111', 'Vehicle Technology and Practice I',           10, '100', 'MEC'],
    ['MEC-VTP-222', 'Vehicle Technology and Practice II',          10, '200', 'MEC'],
    ['MEC-VTP-323', 'Vehicle Technology and Practice III',         10, '300', 'MEC'],
    ['MEC-THF-211', 'Thermo-Fluids',                               10, '200', 'MEC'],
    ['MEC-ENM-121', 'Engineering Materials I',                     10, '100', 'MEC'],
    ['MEC-ENM-212', 'Engineering Materials II',                    10, '200', 'MEC'],
    ['MEC-ENM-222', 'Engineering Materials II',                    10, '200', 'MEC'],
    ['MEC-STD-211', 'Statics and Dynamics',                        10, '200', 'MEC'],
    ['MEC-STD-221', 'Statics and Dynamics',                        10, '200', 'MEC'],
    ['MEC-STD-311', 'Statics and Dynamics',                        10, '300', 'MEC'],
    ['MEC-FLM-221', 'Fluid Mechanics',                             10, '200', 'MEC'],
    ['MEC-FLM-311', 'Fluid Mechanics I',                           10, '300', 'MEC'],
    ['MEC-FLM-412', 'Fluid Mechanics II',                          10, '400', 'MEC'],
    ['MEC-FLM-222', 'Fluid Mechanics',                             10, '200', 'MEC'],
    ['MEC-STM-311', 'Strength of Materials',                       10, '300', 'MEC'],
    ['MEC-ENT-311', 'Engineering Thermodynamics I',                10, '300', 'MEC'],
    ['MEC-ENT-412', 'Engineering Thermodynamics II',               10, '400', 'MEC'],
    ['MEC-COS-411', 'Control Systems',                             10, '400', 'MEC'],
    ['MEC-COS-511', 'Control Systems II',                          10, '500', 'MEC'],
    ['MEC-SOM-411', 'Solid Mechanics',                             10, '400', 'MEC'],
    ['MEC-FEA-511', 'Finite Element Analysis',                     10, '500', 'MEC'],
    ['MEC-FLE-511', 'Fleet Management',                            10, '500', 'MEC'],
    ['MEC-ETI-511', 'Engine Testing and Instrumentation',          10, '500', 'MEC'],
    ['MEC-LSM-511', 'Logistics and Distribution Management',       10, '500', 'MEC'],
    ['MEC-COA-511', 'Computer Applications',                       10, '500', 'MEC'],
    ['MEC-EMA-511', 'Energy Management and Audit',                 10, '500', 'MEC'],
    ['MEC-PET-511', 'Power Economics and Trade',                   10, '500', 'MEC'],
    ['MEC-OPR-511', 'Operations Research',                         10, '500', 'MEC'],
    ['MEC-HMT-511', 'Heat and Mass Transfer',                      10, '500', 'MEC'],
    ['MEC-PPE-511', 'Power Plant Engineering',                     10, '500', 'MEC'],
    ['MEC-REE-321', 'Renewable Energy I',                          10, '300', 'MEC'],
    ['MEC-REE-522', 'Renewable Energy II',                         10, '500', 'MEC'],
    ['MEC-DNM-521', 'Distribution Networks and Machines',          10, '500', 'MEC'],
    ['MEC-REI-521', 'Rural Energy Interventions',                  10, '500', 'MEC'],
    ['MEC-RAC-521', 'Refrigeration and Air Conditioning',          10, '500', 'MEC'],
    ['MEC-ENS-521', 'Engineering and Society',                     10, '500', 'MEC'],
    ['MEC-PMR-521', 'Plant Maintenance and Reliability',           10, '500', 'MEC'],
    ['MEC-VIB-521', 'Mechanical Vibrations',                       10, '500', 'MEC'],
    ['MEC-PMM-521', 'Production and Manufacturing Management',     10, '500', 'MEC'],
    ['MEC-ACE-321', 'Automotive Chassis Engineering',              10, '300', 'MEC'],
    ['MEC-MEI-321', 'Measurements and Instrumentation',            10, '300', 'MEC'],
    ['MEC-DYN-321', 'Dynamics',                                    10, '300', 'MEC'],
    ['MEC-VEE-221', 'Vehicle Electrical and Electronic Systems I', 10, '200', 'MEC'],
    ['MEC-END-321', 'Engineering Design',                          10, '300', 'MEC'],
    ['MEC-END-411', 'Engineering Design',                          10, '400', 'MEC'],
    ['MEC-ETC-221', 'Electrical Technology',                       10, '200', 'MEC'],
    ['MEC-EPM-321', 'Electrical Power and Machines',               10, '300', 'MEC'],
    ['MEC-ENS-521', 'Engineering and Society',                     10, '500', 'MEC'],
    ['MEC-PRM-411', 'Project Management',                          10, '400', 'MEC'],
    ['MEC-QMT-511', 'Quality Management',                          10, '500', 'MEC'],
    ['MEC-MBE-521', 'Business Management and Entrepreneurship',    10, '500', 'MEC'],
    ['MEC-SME-511', 'Strategic Management for Engineers',          10, '500', 'MEC'],
    ['MEC-MAS-521', 'Manufacturing Systems',                       10, '500', 'MEC'],
    ['MEC-MTP-121', 'Manufacturing Technology and Practice I',     10, '100', 'MEC'],
    ['MEC-MTP-221', 'Manufacturing Technology & Processes I',      10, '200', 'MEC'],
    ['MEC-ENS-222', 'Engineering Science II',                      10, '200', 'MEC'],
    ['MEC-THF-221', 'Thermo-Fluids',                               10, '200', 'MEC'],
    ['MEC-POM-311', 'Principles of Management',                    10, '300', 'MEC'],
    ['MEC-STD-221', 'Statics and Dynamics',                        10, '200', 'MEC'],
    ['MEC-MIC-221', 'Measurements, Instrumentation and Control',   10, '200', 'MEC'],
    ['MEC-FMT-321', 'Fleet Management',                            10, '300', 'MEC'],
    ['MEC-ENM-121', 'Engineering Materials I',                     10, '100', 'MEC'],
    ['MEC-MET-121', 'Metal Technology I',                          10, '100', 'MEC'],
    ['MEC-MET-212', 'Metal Technology II',                         10, '200', 'MEC'],
    ['MEC-MET-311', 'Metal Technology III',                        10, '300', 'MEC'],
    ['MEC-MET-314', 'Mechanical Technology IV',                    10, '300', 'MEC'],
    ['MEC-WET-121', 'Welding Technology I',                        10, '100', 'MEC'],
    ['MEC-WET-222', 'Welding Technology II',                       10, '200', 'MEC'],
    ['MEC-WET-321', 'Welding Technology III',                      10, '300', 'MEC'],
    ['MEC-WDT-121', 'Wood Technology I',                           10, '100', 'MEC'],
    ['MEC-WDT-212', 'Wood Technology II',                          10, '200', 'MEC'],
    ['MEC-WDT-223', 'Wood Technology III',                         10, '200', 'MEC'],
    ['MEC-MEC-121', 'Introduction to Metal Technology',            10, '100', 'MEC'],
    ['MEC-MEC-211', 'Mechanics',                                   10, '200', 'MEC'],
    ['MEC-EPM-321', 'Electrical Power and Machines',               10, '300', 'MEC'],
    ['MEC-BME-521', 'Business Management and Entrepreneurship',    10, '500', 'MEC'],
    ['MEC-MEC-521', 'Mechatronics',                                10, '500', 'MEC'],
    ['MEC-VTP-121', 'Vehicle Technology I',                        10, '100', 'MEC'],
    ['MEC-VEE-211', 'Vehicle Electrical & Electronic Systems',     10, '200', 'MEC'],
    ['MEC-STM-311', 'Strength of Materials',                       10, '300', 'MEC'],

    // ── ELE (Electrical Engineering) ──────────────────────
    ['ELE-ELS-121', 'Electrical Science',                          10, '100', 'ELE'],
    ['ELE-ANE-121', 'Analogue Electronics I',                      10, '100', 'ELE'],
    ['ELE-ANE-211', 'Analogue Electronics I',                      10, '200', 'ELE'],
    ['ELE-ANE-221', 'Analogue Electronics I',                      10, '200', 'ELE'],
    ['ELE-ANE-312', 'Analogue Electronics II',                     10, '300', 'ELE'],
    ['ELE-ANE-321', 'Analytic and Diagnostic Equipment',           10, '300', 'ELE'],
    ['ELE-DIE-221', 'Digital Electronics I',                       10, '200', 'ELE'],
    ['ELE-DIE-312', 'Digital Electronics II',                      10, '300', 'ELE'],
    ['ELE-ELC-211', 'Electrical Circuits',                         10, '200', 'ELE'],
    ['ELE-EEM-211', 'Electrical Engineering Materials',            10, '200', 'ELE'],
    ['ELE-ELE-211', 'Electromagnetics',                            10, '200', 'ELE'],
    ['ELE-ELM-311', 'Electrical Machines I',                       10, '300', 'ELE'],
    ['ELE-ELM-322', 'Electrical Machines II',                      10, '300', 'ELE'],
    ['ELE-EMF-311', 'Electrical Machines Fundamentals',            10, '300', 'ELE'],
    ['ELE-SIS-311', 'Signals and Systems',                         10, '300', 'ELE'],
    ['ELE-COH-111', 'Computer Hardware',                           10, '100', 'ELE'],
    ['ELE-ECF-111', 'Electric Circuits Fundamentals',              10, '100', 'ELE'],
    ['ELE-EFC-111', 'Electric Circuits Fundamentals',              10, '100', 'ELE'],
    ['ELE-EES-421', 'Electrical Engineering Science',              10, '400', 'ELE'],
    ['ELE-EPG-121', 'Electrical Power Generation',                 10, '100', 'ELE'],
    ['ELE-EPG-411', 'Electrical Power Generation',                 10, '400', 'ELE'],
    ['ELE-MIT-411', 'Microprocessor Technology',                   10, '400', 'ELE'],
    ['ELE-OSE-411', 'Operating Systems for Engineers',             10, '400', 'ELE'],
    ['ELE-DSP-411', 'Digital Signal Processing',                   10, '400', 'ELE'],
    ['ELE-SOE-411', 'Software Engineering',                        10, '400', 'ELE'],
    ['ELE-PRM-411', 'Project Management',                          10, '400', 'ELE'],
    ['ELE-COA-411', 'Computer Applications',                       10, '400', 'ELE'],
    ['ELE-AAD-511', 'Algorithm Analysis and Design',               10, '500', 'ELE'],
    ['ELE-DBS-521', 'Database Systems',                            10, '500', 'ELE'],
    ['ELE-EMS-511', 'Embedded Systems',                            10, '500', 'ELE'],
    ['ELE-COD-511', 'Computer Organisation and Design',            10, '500', 'ELE'],
    ['ELE-DCS-511', 'Data Communication Systems',                  10, '500', 'ELE'],
    ['ELE-ESA-521', 'Electrical and Electronic Systems',           10, '500', 'ELE'],
    ['ELE-OSA-321', 'Operating Systems: Unix and Windows Admin',   10, '300', 'ELE'],
    ['ELE-DAS-321', 'Database Systems',                            10, '300', 'ELE'],
    ['ELE-DMA-321', 'Desktop and Mobile Application Development',  10, '300', 'ELE'],
    ['ELE-DSP-321', 'Microprocessor Interfacing and Programming',  10, '300', 'ELE'],
    ['ELE-ELC-121', 'Electrical Circuits',                         10, '100', 'ELE'],
    ['ELE-IES-121', 'Electrical & Electronic Circuits',            10, '100', 'ELE'],
    ['ELE-PED-211', 'Principles of Engineering Design',            10, '200', 'ELE'],
    ['ELE-ELE-411', 'Electromagnetics',                            10, '400', 'ELE'],
    ['ELE-PSP-321', 'Power System Protection',                     10, '300', 'ELE'],
    ['ELE-PPS-321', 'Photo Voltaic Power Systems',                 10, '300', 'ELE'],
    ['ELE-PTD-321', 'Power Transmission and Distribution Systems', 10, '300', 'ELE'],
    ['ELE-POE-511', 'Power Electronics',                           10, '500', 'ELE'],
    ['ELE-PSA-511', 'Power Systems Analysis',                      10, '500', 'ELE'],
    ['ELE-PLC-511', 'Programmable Logic Controllers',              10, '500', 'ELE'],
    ['ELE-COS-511', 'Control Systems II',                          10, '500', 'ELE'],
    ['ELE-MEE-512', 'Medical Electronics II',                      10, '500', 'ELE'],
    ['ELE-TEL-321', 'Telecommunications I',                        10, '300', 'ELE'],
    ['ELE-MIP-321', 'Microprocessor Interfacing and Programming',  10, '300', 'ELE'],
    ['ELE-TEL-321', 'Telecommunications I',                        10, '300', 'ELE'],
    ['ELE-ELT-223', 'Electrical Technology III',                   10, '200', 'ELE'],
    ['ELE-EMA-221', 'Electrical Machines and Actuators',           10, '200', 'ELE'],
    ['ELE-EMC-221', 'Electricity and Magnetism',                   10, '200', 'ELE'],
    ['ELE-MEI-221', 'Medical Instrumentation I',                   10, '200', 'ELE'],
    ['ELE-MEI-221', 'Medical Instrumentation',                     10, '200', 'ELE'],
    ['ELE-MEI-311', 'Medical Instrumentation II',                  10, '300', 'ELE'],
    ['ELE-MEI-322', 'Medical Imaging II',                          10, '300', 'ELE'],
    ['ELE-MEI-321', 'Measurements and Instrumentation',            10, '300', 'ELE'],
    ['ELE-MEI-321', 'Medical Instrumentation II',                  10, '300', 'ELE'],
    ['ELE-BIO-211', 'Biomaterials',                                10, '200', 'ELE'],
    ['ELE-BIP-411', 'Bio-Image Processing',                        10, '400', 'ELE'],
    ['ELE-COS-411', 'Control Systems',                             10, '400', 'ELE'],
    ['ELE-REM-411', 'Research Methods',                            10, '400', 'ELE'],
    ['ELE-QHP-211', 'Quantitative Human Physiology',               10, '200', 'ELE'],
    ['ELE-MDL-211', 'Medical Devices Lab I',                       10, '200', 'ELE'],
    ['ELE-ACS-311', 'Electromechanical Actuators',                 10, '300', 'ELE'],
    ['ELE-WIN-211', 'Wireless Networks',                           10, '200', 'ELE'],
    ['ELE-PSA-511', 'Power Systems Analysis',                      10, '500', 'ELE'],
    ['ELE-MEI-511', 'Medical Informatics',                         10, '500', 'ELE'],
    ['ELE-PMR-511', 'Plant Maintenance and Reliability',           10, '500', 'ELE'],
    ['ELE-ENP-511', 'Environmental Protection',                    10, '500', 'ELE'],
    ['ELE-BIF-511', 'Bio-Fluids',                                  10, '500', 'ELE'],
    ['ELE-HT-511', 'Health Care Technology Management',            10, '500', 'ELE'],
    ['ELE-ELT-221', 'Electrical Technology II',                    10, '200', 'ELE'],
    ['ELE-PED-211', 'Principles of Engineering Design',            10, '200', 'ELE'],
    ['ELE-ELP-221', 'Electrical Plant',                            10, '200', 'ELE'],
    ['ELE-DIE-221', 'Digital Electronics',                         10, '200', 'ELE'],
    ['ELE-INE-321', 'Industrial Electronics',                      10, '300', 'ELE'],
    ['ELE-TLI-321', 'Transmission Line Installation',              10, '300', 'ELE'],
    ['ELE-ELD-121', 'Electrical Drawing',                          10, '100', 'ELE'],
    ['ELE-OCS-521', 'Optical Communication Systems',               10, '500', 'ELE'],
    ['ELE-MTS-521', 'Mobile Telecommunication Systems',            10, '500', 'ELE'],
    ['ELE-OCS-521', 'Optical Communication Systems',               10, '500', 'ELE'],
    ['ELE-TRB-521', 'TV and Radio Broadcasting Systems',           10, '500', 'ELE'],
    ['ELE-ANC-321', 'Analogue Communication',                      10, '300', 'ELE'],
    ['ELE-DIC-321', 'Digital Communication',                       10, '300', 'ELE'],
    ['ELE-TES-511', 'Telephony Systems',                           10, '500', 'ELE'],
    ['ELE-TCS-511', 'Telecommunications Systems Fundamentals',     10, '500', 'ELE'],
    ['ELE-PRA-411', 'Propagation and Antennas',                    10, '400', 'ELE'],
    ['ELE-SCS-511', 'Satellite Communication Systems',             10, '500', 'ELE'],
    ['ELE-DCS-511', 'Data Communication Systems',                  10, '500', 'ELE'],
    ['ELE-TEL-321', 'Telecommunications I',                        10, '300', 'ELE'],
    ['ELE-BEL-121', 'Basic Electronics',                           10, '100', 'ELE'],
    ['ELE-PIC-321', 'Process Instrumentation and Control',         10, '300', 'ELE'],
    ['ELE-ENS-121', 'Energy Sources',                              10, '100', 'ELE'],
    ['ELE-ENL-121', 'Energy Sources',                              10, '100', 'ELE'],
    ['ELE-BAS-121', 'Basic Electronics',                           10, '100', 'ELE'],
    ['ELE-SES-211', 'Solar Energy Systems',                        10, '200', 'ELE'],
    ['ELE-ME-211', 'Measurement and Instrumentation',              10, '200', 'ELE'],
    ['ELE-RTS-521', 'Real Time Systems',                           10, '500', 'ELE'],
    ['ELE-INE-321', 'Industrial Electronics',                      10, '300', 'ELE'],
    ['ELE-DCN-321', 'Data Communication Networks',                 10, '300', 'ELE'],
    ['ELE-DBS-521', 'Database Systems',                            10, '500', 'ELE'],
    ['ELE-COI-511', 'Computational Intelligence',                  10, '500', 'ELE'],
    ['ELE-ELC-121', 'Electrical Circuits',                         10, '100', 'ELE'],
    ['ELE-EES-421', 'Electrical Engineering Science',              10, '400', 'ELE'],
    ['ELE-MAI-411', 'Measurement and Instrumentation',             10, '400', 'ELE'],
    ['ELE-PED-211', 'Principles of Engineering Design',            10, '200', 'ELE'],
    ['ELE-ELC-211', 'Electrical Circuits',                         10, '200', 'ELE'],
    ['ELE-ESI-121', 'Electrical Science I',                        10, '100', 'ELE'],
    ['ELE-ECF-111', 'Electric Circuits Fundamentals',              10, '100', 'ELE'],

    // ── CIV (Civil Engineering) ───────────────────────────
    ['CIV-TOS-211', 'Theory of Structures I',                      10, '200', 'CIV'],
    ['CIV-TOS-311', 'Theory of Structures',                        10, '300', 'CIV'],
    ['CIV-STR-211', 'Structural Analysis I',                       10, '200', 'CIV'],
    ['CIV-STR-311', 'Structural Analysis I',                       10, '300', 'CIV'],
    ['CIV-STR-412', 'Structural Analysis II',                      10, '400', 'CIV'],
    ['CIV-STR-513', 'Structural Analysis III',                     10, '500', 'CIV'],
    ['CIV-STR-524', 'Structural Analysis IV',                      10, '500', 'CIV'],
    ['CIV-STR-321', 'Structural Design I',                         10, '300', 'CIV'],
    ['CIV-STD-412', 'Structural Design II',                        10, '400', 'CIV'],
    ['CIV-STD-513', 'Structural Design III',                       10, '500', 'CIV'],
    ['CIV-STD-524', 'Structural Design IV',                        10, '500', 'CIV'],
    ['CIV-STR-321', 'Structural Design I',                         10, '300', 'CIV'],
    ['CIV-FLM-211', 'Fluid Mechanics I',                           10, '200', 'CIV'],
    ['CIV-FLM-311', 'Fluid Mechanics',                             10, '300', 'CIV'],
    ['CIV-HYD-411', 'Hydraulics 1',                                10, '400', 'CIV'],
    ['CIV-HYD-512', 'Hydraulics II',                               10, '500', 'CIV'],
    ['CIV-GEO-311', 'Engineering Geology',                         10, '300', 'CIV'],
    ['CIV-GEO-321', 'Geotechnical Engineering',                    10, '300', 'CIV'],
    ['CIV-TRA-411', 'Transportation Studies',                      10, '400', 'CIV'],
    ['CIV-TRA-511', 'Highway Engineering 1',                       10, '500', 'CIV'],
    ['CIV-TRA-522', 'Highway Engineering II',                      10, '500', 'CIV'],
    ['CIV-HMM-511', 'Highway Maintenance and Management',          10, '500', 'CIV'],
    ['CIV-TPP-511', 'Transportation Planning',                     10, '500', 'CIV'],
    ['CIV-FEA-511', 'Finite Element Analysis',                     10, '500', 'CIV'],
    ['CIV-CNM-511', 'Construction Management',                     10, '500', 'CIV'],
    ['CIV-FDE-511', 'Foundation Engineering',                      10, '500', 'CIV'],
    ['CIV-CEQ-311', 'Civil Engineering Quantities',                10, '300', 'CIV'],
    ['CIV-CEO-311', 'Civil Engineering Quantities',                10, '300', 'CIV'],
    ['CIV-ENM-121', 'Engineering Materials',                       10, '100', 'CIV'],
    ['CIV-ENS-121', 'Engineering Science',                         10, '100', 'CIV'],
    ['CIV-CTE-121', 'Civil Technology',                            10, '100', 'CIV'],
    ['CIV-COM-121', 'Construction Materials',                      10, '100', 'CIV'],
    ['CIV-WST-121', 'Water and Sanitation Technology',             10, '100', 'CIV'],
    ['CIV-STA-221', 'Structural Analysis',                         10, '200', 'CIV'],
    ['CIV-SME-221', 'Soil Mechanics',                              10, '200', 'CIV'],
    ['CIV-QST-221', 'Quantity Surveying Techniques',               10, '200', 'CIV'],
    ['CIV-WSU-221', 'Water Supply',                                10, '200', 'CIV'],
    ['CIV-RST-221', 'Road Construction Technology',                10, '200', 'CIV'],
    ['CIV-CSU-321', 'Construction Surveying',                      10, '300', 'CIV'],
    ['CIV-CPM-322', 'Construction Project Management',             10, '300', 'CIV'],
    ['CIV-SMA-321', 'Site Management',                             10, '300', 'CIV'],
    ['CIV-SWM-321', 'Solid Waste and Wastewater Management',       10, '300', 'CIV'],
    ['CIV-STR-321', 'Structural Design I',                         10, '300', 'CIV'],
    ['CIV-RSA-521', 'Road Safety',                                 10, '500', 'CIV'],
    ['CIV-TRA-522', 'Highway Engineering II',                      10, '500', 'CIV'],
    ['CIV-WRM-521', 'Water Resource Management',                   10, '500', 'CIV'],
    ['CIV-WAT-521', 'Wastewater Engineering',                      10, '500', 'CIV'],
    ['CIV-PRM-521', 'Project Management',                          10, '500', 'CIV'],
    ['CIV-MEM-211', 'Mechanics of Materials',                      10, '200', 'CIV'],
    ['CIV-MEC-211', 'Mechanics of Materials',                      10, '200', 'CIV'],
    ['CIV-OHS-111', 'Occupational Safety and Health',              10, '100', 'CIV'],
    ['CIV-ICT-111', 'Introduction to Computers',                   10, '100', 'CIV'],
    ['CIV-FLM-211', 'Fluid Mechanics',                             10, '200', 'CIV'],
    ['CIV-STA-221', 'Structural Analysis',                         10, '200', 'CIV'],
    ['CIV-RST-211', 'Road Construction Technology',                10, '200', 'CIV'],
    ['CIV-PRP-211', 'Project Planning',                            10, '200', 'CIV'],

    // ── MIN (Mining Engineering) ──────────────────────────
    ['MEN-GGS-211', 'Geological and Geochemical Sampling',         10, '200', 'MIN'],
    ['MEN-PRE-211', 'Petrology for Engineers',                     10, '200', 'MIN'],
    ['MEN-MIM-311', 'Mining Methods',                              10, '300', 'MIN'],
    ['MEN-DAB-311', 'Drilling and Blasting',                       10, '300', 'MIN'],
    ['MEN-GMM-311', 'Geology and Mineral Resources of Malawi',     10, '300', 'MIN'],
    ['MEN-GTE-311', 'Geotechnical Engineering',                    10, '300', 'MIN'],
    ['MEN-GIS-311', 'Geographic Information System',               10, '300', 'MIN'],
    ['MEN-GST-411', 'Geo-Statistics',                              10, '400', 'MIN'],
    ['MEN-MEE-411', 'Mineral Economics & Evaluation',              10, '400', 'MIN'],
    ['MEN-MEG-411', 'Mining Engineering',                          10, '400', 'MIN'],
    ['MEN-MGE-411', 'Mining Geology',                              10, '400', 'MIN'],
    ['MEN-RME-411', 'Rock Mechanics',                              10, '400', 'MIN'],
    ['MEN-STG-411', 'Structural Geology',                          10, '400', 'MIN'],
    ['MEN-SME-512', 'Soil Mechanics II',                           10, '500', 'MIN'],
    ['MEN-EGO-511', 'Engineering Geology I',                       10, '500', 'MIN'],
    ['MEN-EGY-511', 'Environmental Geology',                       10, '500', 'MIN'],
    ['MEN-RGE-511', 'Resource Geology',                            10, '500', 'MIN'],
    ['MEN-CGE-511', 'Computer Applications in Geological Eng',     10, '500', 'MIN'],
    ['MEN-EGY-521', 'Environmental Geology',                       10, '500', 'MIN'],
    ['MEN-GRE-121', 'Geology for Resource Engineers',              10, '100', 'MIN'],
    ['MEN-CET-221', 'Chemical Engineering Thermodynamics',         10, '200', 'MIN'],
    ['MEN-HYG-321', 'Hydrogeology',                                10, '300', 'MIN'],
    ['MEN-GCH-321', 'Geochemistry',                                10, '300', 'MIN'],
    ['MEN-CGE-321', 'Computing for Geological Engineers',          10, '300', 'MIN'],
    ['MEN-DRE-321', 'Drilling Engineering',                        10, '300', 'MIN'],
    ['MEN-GPH-321', 'Geophysics',                                  10, '300', 'MIN'],
    ['MEN-PGR-321', 'Photo Geology & Remote Sensing',              10, '300', 'MIN'],
    ['MEN-DRT-521', 'Drilling Techniques',                         10, '500', 'MIN'],
    ['MEN-EGE-522', 'Engineering Geology II',                      10, '500', 'MIN'],
    ['MEN-GFT-221', 'Geological Field Techniques',                 10, '200', 'MIN'],
    ['MEN-SUM-221', 'Sustainable Mining',                          10, '200', 'MIN'],
    ['MEN-MPM-321', 'Mineral Processing Methods',                  10, '300', 'MIN'],
    ['MEN-UMV-321', 'Underground Mine Ventilation',                10, '300', 'MIN'],
    ['MEN-MSU-321', 'Mine Surveying',                              10, '300', 'MIN'],
    ['MEN-SMD-521', 'Surface Mine Design',                         10, '500', 'MIN'],
    ['MEN-CMM-521', 'Coal Mining Methods',                         10, '500', 'MIN'],
    ['MEN-UMD-521', 'Underground Mine Design',                     10, '500', 'MIN'],
    ['MEN-MPT-321', 'Materials Performance and Testing',           10, '300', 'MIN'],
    ['MEN-MSC-321', 'Materials Structures Characterisation',       10, '300', 'MIN'],
    ['MEN-CDE-321', 'Concentration and Dewatering',                10, '300', 'MIN'],
    ['MEN-FTC-321', 'Foundry Technology',                          10, '300', 'MIN'],
    ['MEN-MEE-521', 'Metallurgy and Environment',                  10, '500', 'MIN'],
    ['MEN-PRE-521', 'Process Engineering',                         10, '500', 'MIN'],
    ['MEN-PYM-521', 'Pyrometallurgy',                              10, '500', 'MIN'],

    // ── PBS (Physics & Biochemical Sciences) ──────────────
    ['PBS-BIO-111', 'Introductory Biology',                        10, '100', 'PBS'],
    ['PBS-BIO-122', 'Biology II (Anatomy)',                        10, '100', 'PBS'],
    ['PBS-CHE-111', 'Chemistry I',                                 10, '100', 'PBS'],
    ['PBS-CHE-112', 'Chemistry I',                                 10, '100', 'PBS'],
    ['PBS-CHE-121', 'Chemistry II',                                10, '100', 'PBS'],
    ['PBS-CHE-122', 'Chemistry II',                                10, '100', 'PBS'],
    ['PBS-CHE-211', 'Chemistry III',                               10, '200', 'PBS'],
    ['PBS-CHE-213', 'Chemistry III',                               10, '200', 'PBS'],
    ['PBS-PHY-111', 'Physics I',                                   10, '100', 'PBS'],
    ['PBS-PHY-121', 'Physics',                                     10, '100', 'PBS'],
    ['PBS-PHY-122', 'Physics II',                                  10, '100', 'PBS'],
    ['PBS-HOW-121', 'Heat, Oscillation and Waves',                 10, '100', 'PBS'],
    ['PBS-MEC-111', 'Mechanics',                                   10, '100', 'PBS'],
    ['PBS-LAM-111', 'Laboratory Management I',                     10, '100', 'PBS'],
    ['PBS-ELM-211', 'Electricity and Magnetism',                   10, '200', 'PBS'],
    ['PBS-BCH-121', 'Biochemistry I',                              10, '100', 'PBS'],
    ['PBS-BCH-211', 'Biochemistry',                                10, '200', 'PBS'],
    ['PBS-BCH-222', 'Biochemistry II',                             10, '200', 'PBS'],
    ['PBS-MIC-121', 'Introduction to Microbiology',                10, '100', 'PBS'],
    ['PBS-MIC-211', 'Introductory Microbiology',                   10, '200', 'PBS'],
    ['PBS-MOB-121', 'Molecular Biology',                           10, '100', 'PBS'],
    ['PBS-ECO-211', 'Ecology',                                     10, '200', 'PBS'],
    ['PBS-ENC-221', 'Environmental Chemistry I',                   10, '200', 'PBS'],
    ['PBS-ENC-312', 'Environmental Chemistry II',                  10, '300', 'PBS'],
    ['PBS-ENC-323', 'Environmental Chemistry III',                 10, '300', 'PBS'],
    ['PBS-ENC-413', 'Environmental Chemistry III',                 10, '400', 'PBS'],
    ['PBS-ANC-221', 'Analytical Chemistry I',                      10, '200', 'PBS'],
    ['PBS-ANC-312', 'Analytical Chemistry II',                     10, '300', 'PBS'],
    ['PBS-ANC-311', 'Analytical Chemistry II',                     10, '300', 'PBS'],
    ['PBS-IPT-221', 'Industrial Process Technology I',             10, '200', 'PBS'],
    ['PBS-IPT-312', 'Industrial Process Technology II',            10, '300', 'PBS'],
    ['PBS-FCH-211', 'Food Chemistry',                              10, '200', 'PBS'],
    ['PBS-FMB-221', 'Food Microbiology',                           10, '200', 'PBS'],
    ['PBS-FPP-221', 'Food Processing and Preservation',            10, '200', 'PBS'],
    ['PBS-FPP-311', 'Food Processing and Preservation',            10, '300', 'PBS'],
    ['PBS-INU-221', 'Introductory Nutrition',                      10, '200', 'PBS'],
    ['PBS-FOT-311', 'Food Toxicology',                             10, '300', 'PBS'],
    ['PBS-FFN-321', 'Functional Foods and Nutraceuticals',         10, '300', 'PBS'],
    ['PBS-FET-421', 'Food Engineering Technology',                 10, '400', 'PBS'],
    ['PBS-FVP-421', 'Fruits and Vegetable Processing',             10, '400', 'PBS'],
    ['PBS-MPT-421', 'Meat Processing Technology',                  10, '400', 'PBS'],
    ['PBS-FPS-421', 'Food Policy and Security',                    10, '400', 'PBS'],
    ['PBS-ICH-311', 'Industrial Chemistry',                        10, '300', 'PBS'],
    ['PBS-IMB-421', 'Industrial Microbiology',                     10, '400', 'PBS'],
    ['PBS-LMG-222', 'Laboratory Management II',                    10, '200', 'PBS'],
    ['PBS-LMG-313', 'Laboratory Management III',                   10, '300', 'PBS'],
    ['PBS-LMG-422', 'Laboratory Management II',                    10, '400', 'PBS'],
    ['PBS-WWT-411', 'Water and Wastewater Treatment',              10, '400', 'PBS'],
    ['PBS-WWT-421', 'Water and Wastewater Treatment',              10, '400', 'PBS'],
    ['PBS-GCH-421', 'Geochemistry',                                10, '400', 'PBS'],
    ['PBS-EMA-311', 'Environmental Monitoring and Assessment',     10, '300', 'PBS'],
    ['PBS-EES-311', 'Electrical and Electronics Servicing',        10, '300', 'PBS'],
    ['PBS-MET-311', 'Metrology',                                   10, '300', 'PBS'],
    ['PBS-MET-411', 'Metrology',                                   10, '400', 'PBS'],
    ['PBS-EXP-311', 'Experiments',                                 10, '300', 'PBS'],
    ['PBS-QMG-411', 'Quality Management',                          10, '400', 'PBS'],
    ['PBS-WWT-411', 'Water and Wastewater Treatment',              10, '400', 'PBS'],
    ['PBS-RET-311', 'Renewable Energy Technologies',               10, '300', 'PBS'],
    ['PBS-RET-412', 'Renewable Energy Technologies II',            10, '400', 'PBS'],
    ['PBS-EPP-311', 'Environmental Pollution Physics',             10, '300', 'PBS'],
    ['PBS-ATP-311', 'Atmospheric Physics',                         10, '300', 'PBS'],
    ['PBS-GEP-311', 'Geophysics',                                  10, '300', 'PBS'],
    ['PBS-TMD-221', 'Thermodynamics',                              10, '200', 'PBS'],
    ['PBS-QNP-221', 'Quantum and Nuclear Physics',                 10, '200', 'PBS'],
    ['PBS-NUS-321', 'Nuclear Security',                            10, '300', 'PBS'],
    ['PBS-ELE-322', 'Electronics II',                              10, '300', 'PBS'],
    ['PBS-EIA-421', 'Environmental Impact Assessment',             10, '400', 'PBS'],
    ['PBS-CRA-321', 'Climate Change, Risk and Adaptation',         10, '300', 'PBS'],
    ['PBS-OHS-321', 'Occupational Health and Safety',              10, '300', 'PBS'],
    ['PBS-ENS-111', 'Engineering Science',                         10, '100', 'PBS'],
    ['PBS-ENS-121', 'Engineering Science',                         10, '100', 'PBS'],
    ['PBS-ENS-222', 'Engineering Science II',                      10, '200', 'PBS'],
    ['PBS-ENS-221', 'Engineering Science',                         10, '200', 'PBS'],
    ['PBS-AMC-221', 'Applied Metallurgical Chemistry',             10, '200', 'PBS'],
    ['PBS-EMS-121', 'Environmental Management Systems',            10, '100', 'PBS'],
    ['PBS-HAP-111', 'Human Anatomy and Physiology',                10, '100', 'PBS'],
    ['PBS-HAP-121', 'Human Anatomy and Physiology I',              10, '100', 'PBS'],
    ['PBS-RAP-221', 'Radiology Physics',                           10, '200', 'PBS'],
    ['PBS-OSH-111', 'Occupational Safety and Health',              10, '100', 'PBS'],
    ['PBS-ENT-421', 'Environmental Toxicology',                    10, '400', 'PBS'],
    ['PBS-SWM-421', 'Solid Waste Management',                      10, '400', 'PBS'],
    ['PBS-EES-411', 'Environmental & Social Impact Assessment',    10, '400', 'PBS'],
    ['PBS-INE-411', 'Industrial Ethics',                           10, '400', 'PBS'],
    ['PBS-QMG-411', 'Quality Management',                          10, '400', 'PBS'],
    ['PBS-DST-411', 'Dairy Science and Technology',                10, '400', 'PBS'],
    ['PBS-NUT-412', 'Nutrition II',                                10, '400', 'PBS'],
    ['PBS-FLR-411', 'Food Laws and Regulations',                   10, '400', 'PBS'],
    ['PBS-CLT-311', 'Cereal and Legume Technology',                10, '300', 'PBS'],
    ['PBS-FOT-311', 'Food Toxicology',                             10, '300', 'PBS'],
    ['PBS-BOT-311', 'Biotechnology',                               10, '300', 'PBS'],
    ['PBS-FPD-311', 'Food Product Development',                    10, '300', 'PBS'],
    ['PBS-FOA-311', 'Food Analysis',                               10, '300', 'PBS'],
    ['PBS-ETI-311', 'Energy Technology and Industry I',            10, '300', 'PBS'],
    ['PBS-MET-211', 'Metrology',                                   10, '200', 'PBS'],
    ['PBS-DRW-222', 'Engineering Drawing II',                      10, '200', 'PBS'],
    ['PBS-PHY-113', 'Physics III',                                 10, '100', 'PBS'],
    ['PBS-EES-321', 'Electronics',                                 10, '300', 'PBS'],
    ['PBS-ELE-322', 'Electronics II',                              10, '300', 'PBS'],
    ['PBS-CHE-113', 'Chemistry I',                                 10, '100', 'PBS'],
    ['PBS-CHE-212', 'Chemistry II',                                10, '200', 'PBS'],
    ['PBS-CHE-213', 'Chemistry III',                               10, '200', 'PBS'],
    ['PBS-AMC-221', 'Applied Metallurgical Chemistry',             10, '200', 'PBS'],
    ['PBS-CRA-321', 'Climate Change, Risk and Adaptation',         10, '300', 'PBS'],

    // ── PEHS (Public & Environmental Health Sciences) ─────
    ['PEH-FOH-121', 'Fundamentals of Occupational Health & Safety',10, '100', 'PEHS'],
    ['PEH-BKH-111', 'Basic Knowledge in Health',                   10, '100', 'PEHS'],
    ['PEH-SBC-211', 'Social and Behavioural Sciences Epidemiology',10, '200', 'PEHS'],
    ['PEH-OCH-211', 'Occupational Hygiene I',                      10, '200', 'PEHS'],
    ['PEH-OSA-211', 'Occupational Safety',                         10, '200', 'PEHS'],
    ['PEH-FSM-211', 'Fire Safety Management',                      10, '200', 'PEHS'],
    ['PEH-OHT-311', 'Occupational Health Toxicology',              10, '300', 'PEHS'],
    ['PEH-RAM-311', 'Risk Assessment and Management',              10, '300', 'PEHS'],
    ['PEH-EPI-311', 'Epidemiology',                                10, '300', 'PEHS'],
    ['PEH-EIP-311', 'Environmental and Industrial Pollution C',    10, '300', 'PEHS'],
    ['PEH-BLC-211', 'Building Construction',                       10, '200', 'PEHS'],
    ['PEH-DEH-211', 'Drawing for Environmental Health',            10, '200', 'PEHS'],
    ['PEH-FBP-211', 'Food Borne Pathogens',                        10, '200', 'PEHS'],
    ['PEH-HPS-211', 'Health Psychology',                           10, '200', 'PEHS'],
    ['PEH-MHT-211', 'Meat Hygiene Theory',                         10, '200', 'PEHS'],
    ['PEH-BSH-221', 'Building Services and Health',                10, '200', 'PEHS'],
    ['PEH-NCD-221', 'Non-Communicable Diseases',                   10, '200', 'PEHS'],
    ['PEH-SAH-221', 'Sanitation and Hygiene',                      10, '200', 'PEHS'],
    ['PEH-SHI-221', 'Sociology of Health and Illness',             10, '200', 'PEHS'],
    ['PEH-WRM-311', 'Water Resources Management',                  10, '300', 'PEHS'],
    ['PEH-VEC-311', 'Vector Control',                              10, '300', 'PEHS'],
    ['PEH-EHE-311', 'Environmental Health Epidemiology',           10, '300', 'PEHS'],
    ['PEH-ENP-321', 'Environmental Pollution',                     10, '300', 'PEHS'],
    ['PEH-OHS-321', 'Occupational Health and Safety I',            10, '300', 'PEHS'],
    ['PEH-REM-321', 'Research Methods',                            10, '300', 'PEHS'],
    ['PEH-FSH-321', 'Food Safety and Hygiene',                     10, '300', 'PEHS'],
    ['PEH-WAS-321', 'Water Supply',                                10, '300', 'PEHS'],
    ['PEH-ENH-WTT-421', 'Waste Water Treatment',                   10, '400', 'PEHS'],
    ['PEH-ENH-CDR-421', 'Climate Change and Disaster Risk Mgmt',   10, '400', 'PEHS'],
    ['PEH-ENH-PRM-421', 'Project Management',                      10, '400', 'PEHS'],
    ['PEH-LRS-221', 'OSH Legislation, Regulation and Standards',   10, '200', 'PEHS'],
    ['PEH-OCH-222', 'Occupational Hygiene II',                     10, '200', 'PEHS'],
    ['PEH-ODI-221', 'Occupational Diseases',                       10, '200', 'PEHS'],
    ['PEH-AIA-221', 'Accident Investigation and Analysis',         10, '200', 'PEHS'],
    ['PEH-ERG-221', 'Ergonomics',                                  10, '200', 'PEHS'],
    ['PEH-ACA-211', 'Accident Causation and Analysis',             10, '200', 'PEHS'],
    ['PEH-OSH-111', 'Introduction to OSH',                         10, '100', 'PEHS'],
    ['PEH-OCH-121', 'Occupational Hygiene 1',                      10, '100', 'PEHS'],
    ['PEH-BCO-121', 'Communication Skills I',                      10, '100', 'PEHS'],
    ['PEH-MTC-121', 'Introduction to Medical Terminology',         10, '100', 'PEHS'],
    ['PEH-HIS-121', 'Intro to Health Information System',          10, '100', 'PEHS'],
    ['PEH-PEH-221', 'Intro to Public and Environmental Health Sci',10, '200', 'PEHS'],
    ['PEH-WHC-211', 'Workplace Hazards Identification and C',      10, '200', 'PEHS'],
    ['PEH-OHL-211', 'Occupational Hygiene Laboratory',             10, '200', 'PEHS'],

    // ── JMS (Journalism & Media Studies) ──────────────────
    ['JMS-PBS-111', 'Public Speaking',                             10, '100', 'JMS'],
    ['JMS-IMC-111', 'Introduction to Mass Communication',          10, '100', 'JMS'],
    ['JMS-LIT-111', 'Literature',                                  10, '100', 'JMS'],
    ['JMS-ITJ-111', 'Introduction to Journalism',                  10, '100', 'JMS'],
    ['JMS-PSY-121', 'Psychology',                                  10, '100', 'JMS'],
    ['JMS-SOC-121', 'Sociology',                                   10, '100', 'JMS'],
    ['JMS-PUS-111', 'Public Speaking',                             10, '100', 'JMS'],
    ['JMS-DME-111', 'Digital Media Ethics',                        10, '100', 'JMS'],
    ['JMS-ONB-111', 'Online Broadcasting: Radio',                  10, '100', 'JMS'],
    ['JMS-DED-111', 'Development & Evolution of Digital Media',    10, '100', 'JMS'],
    ['JMS-PUS-111', 'Online Journalism and Social Media',          10, '100', 'JMS'],
    ['JMS-MMS-111', 'Mass Media and Society',                      10, '100', 'JMS'],
    ['JMS-TVR-211', 'Television News Writing and Reporting',       10, '200', 'JMS'],
    ['JMS-RNW-211', 'Radio News Writing & Reporting',              10, '200', 'JMS'],
    ['JMS-NWP-211', 'News Writing for Print',                      10, '200', 'JMS'],
    ['JMS-MMS-211', 'Mass Media and Society',                      10, '200', 'JMS'],
    ['JMS-PST-211', 'Political Studies',                           10, '200', 'JMS'],
    ['JMS-DCM-311', 'Development Communication',                   10, '300', 'JMS'],
    ['JMS-EDT-311', 'Editing and Translation',                     10, '300', 'JMS'],
    ['JMS-IMC-311', 'Integrated Marketing Communication',           10, '300', 'JMS'],
    ['JMS-MCT-311', 'Media Criticism',                             10, '300', 'JMS'],
    ['JMS-TVP-311', 'Radio and Television Production',             10, '300', 'JMS'],
    ['JMS-SPW-311', 'Specialized Writing for Print',               10, '300', 'JMS'],
    ['JMS-DMA-311', 'Digital Marketing',                           10, '300', 'JMS'],
    ['JMS-DJO-311', 'Data Journalism',                             10, '300', 'JMS'],
    ['JMS-SWD-311', 'Specialised Writing for Digital Media',       10, '300', 'JMS'],
    ['JMS-MCR-311', 'Media Crisis',                                10, '300', 'JMS'],
    ['JMS-IRL-421', 'International Relations',                     10, '400', 'JMS'],
    ['JMS-BEJ-421', 'Business and Economics Journalism',           10, '400', 'JMS'],
    ['JMS-DMR-221', 'Digital Media Regulation',                    10, '200', 'JMS'],
    ['JMS-POC-221', 'Political Communication',                     10, '200', 'JMS'],
    ['JMS-PHJ-221', 'Photojournalism',                             10, '200', 'JMS'],
    ['JMS-ONJ-221', 'Online Journalism',                           10, '200', 'JMS'],
    ['JMS-MEI-221', 'Media Ethics and Issues',                     10, '200', 'JMS'],
    ['JMS-EDL-221', 'Copy, Edit, Design and Layout',               10, '200', 'JMS'],
    ['JMS-OBT-222', 'Online Broadcasting 2: Television',           10, '200', 'JMS'],
    ['JMS-WEP-121', 'Web Publishing',                              10, '100', 'JMS'],

    // ── AED (Applied Education) ───────────────────────────
    ['AED-TDR-111', 'Technical Drawing I',                         10, '100', 'AE'],
    ['AED-TDR-122', 'Technical Drawing II',                        10, '100', 'AE'],
    ['AED-TDR-213', 'Technical Drawing III',                       10, '200', 'AE'],
    ['AED-TDR-224', 'Technical Drawing IV',                        10, '200', 'AE'],
    ['AED-TDR-416', 'Technical Drawing',                           10, '400', 'AE'],
    ['AED-CUS-311', 'Curriculum Studies',                          10, '300', 'AE'],
    ['AED-SIE-311', 'Special Needs and Inclusive Education',       10, '300', 'AE'],
    ['AED-ENS-312', 'Engineering Science III',                     10, '300', 'AE'],
    ['AED-CAD-311', 'Computer Aided Drawing I',                    10, '300', 'AE'],
    ['AED-PHE-121', 'Philosophy of Education',                     10, '100', 'AE'],
    ['AED-PHE-211', 'Philosophy of Education',                     10, '200', 'AE'],
    ['AED-PED-121', 'Psychology of Education',                     10, '100', 'AE'],
    ['AED-PED-221', 'Psychology of Education',                     10, '200', 'AE'],
    ['AED-PSE-211', 'Psychology of Education',                     10, '200', 'AE'],
    ['AED-SED-221', 'Sociology of Education',                      10, '200', 'AE'],
    ['AED-IMT-321', 'Instructional Media and Technology',          10, '300', 'AE'],
    ['AED-RME-321', 'Research Methods I',                          10, '300', 'AE'],
    ['AED-TME-321', 'Testing, Measurement and Evaluation',         10, '300', 'AE'],
    ['AED-TMM-321', 'Teaching Methods for Maths and Sciences',     10, '300', 'AE'],
    ['AED-TMV-321', 'Teaching Methods for Vocational & Tech',      10, '300', 'AE'],
    ['AED-MET-212', 'Metal Technology II',                         10, '200', 'AE'],
    ['AED-MET-313', 'Metal Technology III',                        10, '300', 'AE'],
    ['AED-MET-121', 'Metal Technology I',                          10, '100', 'AE'],
    ['AED-MET-223', 'Mechanical Technology III',                   10, '200', 'AE'],
    ['AED-WDT-111', 'Wood Technology I',                           10, '100', 'AE'],
    ['AED-WDT-122', 'Wood Technology II',                          10, '100', 'AE'],
    ['AED-WDT-223', 'Wood Technology III',                         10, '200', 'AE'],
    ['AED-WDT-414', 'Wood Technology IV',                          10, '400', 'AE'],
    ['AED-WET-121', 'Welding Technology I',                        10, '100', 'AE'],
    ['AED-WET-222', 'Welding Technology II',                       10, '200', 'AE'],
    ['AED-HSE-111', 'History of Education',                        10, '100', 'AE'],
    ['AED-FBT-212', 'Fabrication Technology',                      10, '200', 'AE'],
    ['AED-ASE-421', 'Adult and Special Needs Education',           10, '400', 'AE'],
    ['AED-EAL-421', 'Educational Administration and Leadership',   10, '400', 'AE'],
    ['AED-SE-421', 'Adult and Special Needs Education',            10, '400', 'AE'],
    ['AED-TEAL-421', 'Educational Administration and Leadership',  10, '400', 'AE'],
    ['AED-ENM-121', 'Engineering Materials I',                     10, '100', 'AE'],
    ['AED-ENM-212', 'Engineering Materials II',                    10, '200', 'AE'],
    ['AED-ISN-111', 'Introduction to Special Needs Education',     10, '100', 'AE'],
    ['AED-WST-111', 'Workshop Technology I',                       10, '100', 'AE'],
    ['AED-MEP-311', 'Metallurgical Processing',                    10, '300', 'AE'],
    ['AED-PHE-121', 'Philosophy of Education',                     10, '100', 'AE'],
    ['AED-EAM-421', 'Education Administration and Management',     10, '400', 'AE'],
    ['AED-PHE-121', 'Philosophy of Education',                     10, '100', 'AE'],
    ['AED-TEAL-421', 'Educational Administration and Leadership',  10, '400', 'AE'],
    ['AED-ENS-221', 'Engineering Science II',                      10, '200', 'AE'],
    ['AED-WDT-122', 'Wood Technology II',                          10, '100', 'AE'],
    ['AED-MET-121', 'Metal Technology I',                          10, '100', 'AE'],
    ['AED-ASE-421', 'Adult and Special Needs Education',           10, '400', 'AE'],
    ['AED-EAM-421', 'Education Administration and Management',     10, '400', 'AE'],
];

// ─────────────────────────────────────────────
// 5. LECTURERS [staffNum, title, firstName, lastName, email, deptCode]
// ─────────────────────────────────────────────
const LECTURERS = [
    ['LEC001', 'Dr.',  'John',     'Banda',       'john.banda@mubas.mw',         'CS'  ],
    ['LEC002', 'Prof.', 'Mary',    'Phiri',       'mary.phiri@mubas.mw',         'CIV' ],
    ['LEC003', 'Dr.',  'David',    'Mwale',       'david.mwale@mubas.mw',        'BM'  ],
    ['LEC004', 'Dr.',  'Mercy',    'Chirwa',      'mercy.chirwa@mubas.mw',       'CS'  ],
    ['LEC005', 'Prof.', 'Peter',   'Kamanga',     'peter.kamanga@mubas.mw',      'CS'  ],
    ['LEC006', 'Dr.',  'Linda',    'Mbewe',       'linda.mbewe@mubas.mw',        'CS'  ],
    ['LEC007', 'Mr.',  'Yamikani', 'Phiri',       'yamikani.phiri@mubas.mw',     'CS'  ],
    ['LEC008', 'Dr.',  'Grace',    'Mhango',      'grace.mhango@mubas.mw',       'CS'  ],
    ['LEC009', 'Prof.', 'Isaac',   'Mvula',       'isaac.mvula@mubas.mw',        'CIV' ],
    ['LEC010', 'Dr.',  'Rose',     'Kalua',       'rose.kalua@mubas.mw',         'CIV' ],
    ['LEC011', 'Dr.',  'Samuel',   'Jere',        'samuel.jere@mubas.mw',        'CIV' ],
    ['LEC012', 'Ms.',  'Patricia', 'Nyirenda',    'patricia.nyirenda@mubas.mw',  'CIV' ],
    ['LEC013', 'Dr.',  'Thomas',   'Chikopa',     'thomas.chikopa@mubas.mw',     'CIV' ],
    ['LEC014', 'Mr.',  'Gift',     'Kamanga',     'gift.kamanga@mubas.mw',       'ELE' ],
    ['LEC015', 'Dr.',  'Suzgo',    'Nyirenda',    'suzgo.nyirenda@mubas.mw',     'ELE' ],
    ['LEC016', 'Dr.',  'Andrew',   'Chirwa',      'andrew.chirwa@mubas.mw',      'MEC' ],
    ['LEC017', 'Mr.',  'Blessings','Tembo',       'blessings.tembo@mubas.mw',    'MEC' ],
    ['LEC018', 'Prof.', 'Alfred',  'Chimwaza',    'alfred.chimwaza@mubas.mw',    'MIN' ],
    ['LEC019', 'Dr.',  'Ketrina',  'Mtambo',      'ketrina.mtambo@mubas.mw',     'MIN' ],
    ['LEC020', 'Dr.',  'Joseph',   'Nkhoma',      'joseph.nkhoma@mubas.mw',      'MATH'],
    ['LEC021', 'Mr.',  'Steven',   'Kadaleka',    'steven.kadaleka@mubas.mw',    'MATH'],
    ['LEC022', 'Dr.',  'Chikondi', 'Mpasa',       'chikondi.mpasa@mubas.mw',     'MATH'],
    ['LEC023', 'Dr.',  'Elizabeth','Kazembe',     'elizabeth.kazembe@mubas.mw',  'PBS' ],
    ['LEC024', 'Mr.',  'Michael',  'Lungu',       'michael.lungu@mubas.mw',      'PBS' ],
    ['LEC025', 'Dr.',  'Chimwemwe','Sibande',     'chimwemwe.sibande@mubas.mw',  'PEHS'],
    ['LEC026', 'Mrs.', 'Loveness', 'Chilomo',     'loveness.chilomo@mubas.mw',   'PEHS'],
    ['LEC027', 'Mr.',  'Tiwonge',  'Mvula',       'tiwonge.mvula@mubas.mw',      'AF'  ],
    ['LEC028', 'Dr.',  'Thokozani','Kumwenda',    'thokozani.kumwenda@mubas.mw', 'AF'  ],
    ['LEC029', 'Prof.', 'Pilirani','Nyasulu',     'pilirani.nyasulu@mubas.mw',   'AF'  ],
    ['LEC030', 'Dr.',  'Mavuto',   'Kanyenda',    'mavuto.kanyenda@mubas.mw',    'EL'  ],
    ['LEC031', 'Mr.',  'Yamikani', 'Chimwendo',   'yamikani.chimwendo@mubas.mw', 'EL'  ],
    ['LEC032', 'Dr.',  'Esnart',   'Munthali',    'esnart.munthali@mubas.mw',    'BM'  ],
    ['LEC033', 'Mr.',  'Stanley',  'Mponda',      'stanley.mponda@mubas.mw',     'BM'  ],
    ['LEC034', 'Dr.',  'Beatrice', 'Ndhlovu',     'beatrice.ndhlovu@mubas.mw',   'ARC' ],
    ['LEC035', 'Mr.',  'Chrispine','Kachingwe',   'chrispine.kachingwe@mubas.mw','ARC' ],
    ['LEC036', 'Dr.',  'Lucy',     'Nyondo',      'lucy.nyondo@mubas.mw',        'QSLE'],
    ['LEC037', 'Mr.',  'Francis',  'Chilundo',    'francis.chilundo@mubas.mw',   'QSLE'],
    ['LEC038', 'Dr.',  'Emmanuel', 'Kaunda',      'emmanuel.kaunda@mubas.mw',    'PPLS'],
    ['LEC039', 'Ms.',  'Tadala',   'Chirwa',      'tadala.chirwa@mubas.mw',      'PPLS'],
    ['LEC040', 'Dr.',  'Innocent', 'Mataya',      'innocent.mataya@mubas.mw',    'LCS' ],
    ['LEC041', 'Mr.',  'Ruth',     'Kaunda',      'ruth.kaunda@mubas.mw',        'LCS' ],
    ['LEC042', 'Dr.',  'Wisdom',   'Mwafulirwa',  'wisdom.mwafulirwa@mubas.mw',  'JMS' ],
    ['LEC043', 'Ms.',  'Chikondi', 'Banda',       'chikondi.banda@mubas.mw',     'JMS' ],
    ['LEC044', 'Dr.',  'Wilfred',  'Tembo',       'wilfred.tembo@mubas.mw',      'AE'  ],
    ['LEC045', 'Mr.',  'Donnex',   'Chitsonga',   'donnex.chitsonga@mubas.mw',   'AE'  ],
];

// ─────────────────────────────────────────────
// 6. ACADEMIC YEAR + SEMESTER (make 2026/2027 active)
// ─────────────────────────────────────────────
const ACTIVE_YEAR   = '2026/2027';
const ACTIVE_SEM    = 'Semester 1';   // Aug–Dec 2026

// ─────────────────────────────────────────────
// 7. FICTIONAL MALAWIAN NAMES
// ─────────────────────────────────────────────
const FIRST_NAMES_M = [
    'Chikondi','Mphatso','Yamikani','Tadala','Thoko','Blessings','Precious',
    'Kondwani','Mavuto','Limbani','Madalitso','Chisomo','Tiyamike','Ruth',
    'Gift','Innocent','Francis','Michael','Steven','Joseph','Andrew','Peter',
    'Wilfred','Alfred','Wisdom','Moses','Samuel','David','John','Emmanuel',
];
const FIRST_NAMES_F = [
    'Chimwemwe','Tadala','Loveness','Patricia','Grace','Mercy','Linda',
    'Rose','Elizabeth','Ketrina','Beatrice','Lucy','Ruth','Esnart','Tiwonge',
    'Pilirani','Chikondi','Tiyamike','Suzgo','Tawonga','Rachael','Naomi',
    'Memory','Faith','Happiness','Mary','Esther','Florence','Martha','Cecilia',
];
const LAST_NAMES = [
    'Banda','Phiri','Mwale','Chirwa','Kamanga','Mbewe','Mhango','Mvula','Kalua',
    'Jere','Nyirenda','Chikopa','Tembo','Chimwaza','Mtambo','Nkhoma','Kadaleka',
    'Mpasa','Kazembe','Lungu','Sibande','Chilomo','Kumwenda','Nyasulu','Kanyenda',
    'Chimwendo','Munthali','Mponda','Ndhlovu','Kachingwe','Nyondo','Chilundo',
    'Kaunda','Mataya','Mwafulirwa','Chitsonga','Msiska','Kanyika','Kawonga',
];

// ============================================
// SEED ENGINE
// ============================================

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pad = (n, w = 3) => String(n).padStart(w, '0');

async function getDeptMap(conn) {
    const [rows] = await conn.query('SELECT dept_id, code FROM Department');
    const m = {};
    rows.forEach(r => { m[r.code] = r.dept_id; });
    return m;
}
async function getSchoolMap(conn) {
    const [rows] = await conn.query('SELECT school_id, code FROM School');
    const m = {};
    rows.forEach(r => { m[r.code] = r.school_id; });
    return m;
}
async function getProgramMap(conn) {
    const [rows] = await conn.query('SELECT program_id, code FROM Program');
    const m = {};
    rows.forEach(r => { m[r.code] = r.program_id; });
    return m;
}

// ─────────────────────────────────────────────
// MAIN RUNNER
// ─────────────────────────────────────────────
async function run() {
    const conn = await db.getConnection();
    try {
        console.log('\n═══════════════════════════════════════════════════');
        console.log('  MUBAS DATA SEED');
        console.log('═══════════════════════════════════════════════════\n');

        await conn.beginTransaction();

        if (RESET) {
            console.log('🧨  RESET mode — clearing test data...');
            await conn.query('SET FOREIGN_KEY_CHECKS = 0');
            // Only delete things we're going to re-insert
            await conn.query('DELETE FROM GradeAudit');
            await conn.query('DELETE FROM Grade');
            await conn.query('DELETE FROM Enrollment');
            await conn.query('DELETE FROM Assessment');
            await conn.query('DELETE FROM ModuleOffering');
            await conn.query('DELETE FROM Curriculum');
            await conn.query('DELETE FROM ModuleGradeOverride');
            await conn.query('DELETE FROM Referral');
            await conn.query('DELETE FROM Carryover');
            await conn.query('DELETE FROM RepeatModule');
            await conn.query('DELETE FROM IncompleteGrade');
            await conn.query('DELETE FROM MissingExam');
            await conn.query('DELETE FROM Aegrotat');
            await conn.query('DELETE FROM Withdrawal');
            await conn.query('DELETE FROM ChangeProgram');
            await conn.query('DELETE FROM ExitAward');
            await conn.query('DELETE FROM PosthumousAward');
            await conn.query('DELETE FROM AcademicStanding');
            await conn.query('DELETE FROM Appeal');
            await conn.query('DELETE FROM ApprovalHistory');
            await conn.query('DELETE FROM Notification');
            await conn.query('DELETE FROM Module');
            await conn.query('DELETE FROM Program');
            await conn.query('DELETE FROM Student');
            await conn.query('DELETE FROM User WHERE role NOT IN ("Admin","VC","Senate")');
            await conn.query('DELETE FROM Lecturer');
            await conn.query('SET FOREIGN_KEY_CHECKS = 1');
            console.log('    ✓ Cleared\n');
        }

        // ── 1. Ensure schools exist ──
        console.log('📚  Schools...');
        for (const s of SCHOOLS) {
            await conn.query(
                `INSERT INTO School (school_id, university_id, name, code)
                 VALUES (?, 1, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code)`,
                [s.id, s.name, s.code]
            );
        }
        console.log(`    ✓ ${SCHOOLS.length} schools`);

        // ── 2. Departments ──
        console.log('🏛️   Departments...');
        const schoolMap = await getSchoolMap(conn);
        for (const d of DEPARTMENTS) {
            await conn.query(
                `INSERT INTO Department (school_id, name, code)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name), school_id = VALUES(school_id)`,
                [d.school_id, d.name, d.code]
            );
        }
        const deptMap = await getDeptMap(conn);
        console.log(`    ✓ ${DEPARTMENTS.length} departments`);

        // ── 3. Programs ──
        console.log('🎓  Programs...');
        const HONOURS_CODES = new Set([
            'BARC','BQS','BRE','BLS','BPP',
            'BAE','BBME','BCE','BECE','BEE','BETE','BGEN','BMEN','BMMP','BPEN','BIE','BME',
            'LLB','BTECH'
        ]);
        for (const [code, name, type, deptCode, duration] of PROGRAMS) {
            const deptId = deptMap[deptCode];
            if (!deptId) { console.warn(`    ⚠️  Missing dept ${deptCode} for program ${code}`); continue; }
            const isHonours = HONOURS_CODES.has(code) ? 1 : 0;
            await conn.query(
                `INSERT INTO Program (dept_id, code, name, type, level, duration_years, is_honours, total_credits_required)
                 VALUES (?, ?, ?, ?, 'Undergraduate', ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name), dept_id = VALUES(dept_id),
                                         is_honours = VALUES(is_honours)`,
                [deptId, code, name, type, duration, isHonours, duration * 120]
            );
        }
        const progMap = await getProgramMap(conn);
        console.log(`    ✓ ${Object.keys(progMap).length} programs`);

        // ── 4. Modules ──
        console.log('📖  Modules...');
        let moduleCount = 0;
        for (const [code, name, credits, level, deptCode] of MODULES) {
            const deptId = deptMap[deptCode];
            if (!deptId) { console.warn(`    ⚠️  Missing dept ${deptCode} for ${code}`); continue; }
            try {
                await conn.query(
                    `INSERT INTO Module (dept_id, code, name, credits, level)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE name = VALUES(name), credits = VALUES(credits)`,
                    [deptId, code, name, credits, level]
                );
                moduleCount++;
            } catch (e) {
                if (e.code !== 'ER_DUP_ENTRY') throw e;
            }
        }
        console.log(`    ✓ ${moduleCount} modules`);

        // ── 5. Lecturers ──
        console.log('👨‍🏫  Lecturers...');
        const defaultHash = await bcrypt.hash('password', 10);
        let lecCount = 0;
        for (const [staffNum, title, firstName, lastName, email, deptCode] of LECTURERS) {
            const deptId = deptMap[deptCode];
            if (!deptId) {
                console.warn(`    ⚠️  Skipping ${firstName} ${lastName} — unknown dept ${deptCode}`);
                continue;
            }

            const username = 'lecturer.' + firstName.toLowerCase() + '.' + lastName.toLowerCase();

            // Check-then-insert (or update password if exists)
            let userId;
            const [existingUser] = await conn.query(
                'SELECT user_id FROM User WHERE username = ? OR email = ?',
                [username, email]
            );
            if (existingUser.length > 0) {
                userId = existingUser[0].user_id;
                await conn.query(
                    'UPDATE User SET password_hash = ?, email = ?, role = ?, is_active = TRUE WHERE user_id = ?',
                    [defaultHash, email, 'Lecturer', userId]
                );
            } else {
                const [ins] = await conn.query(
                    `INSERT INTO User (username, email, password_hash, role, is_active)
                     VALUES (?, ?, ?, 'Lecturer', TRUE)`,
                    [username, email, defaultHash]
                );
                userId = ins.insertId;
            }

            // Upsert the Lecturer record
            const [existingLec] = await conn.query(
                'SELECT lecturer_id FROM Lecturer WHERE staff_number = ? OR user_id = ?',
                [staffNum, userId]
            );
            if (existingLec.length > 0) {
                await conn.query(
                    `UPDATE Lecturer SET dept_id = ?, title = ?, first_name = ?, last_name = ?,
                                         email = ?, position = 'Lecturer', status = 'Active'
                     WHERE lecturer_id = ?`,
                    [deptId, title, firstName, lastName, email, existingLec[0].lecturer_id]
                );
            } else {
                await conn.query(
                    `INSERT INTO Lecturer
                        (user_id, dept_id, staff_number, title, first_name, last_name, email,
                         position, date_joined, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'Lecturer', '2024-01-15', 'Active')`,
                    [userId, deptId, staffNum, title, firstName, lastName, email]
                );
            }
            lecCount++;
        }
        console.log(`    ✓ ${lecCount} lecturers`);

        // ── 6. Make 2026/2027 the active year ──
        console.log('📅  Academic year...');
        await conn.query('UPDATE AcademicYear SET is_current = FALSE');
        await conn.query('UPDATE Semester SET is_active = FALSE');

        let activeYearId;
        const [yearRow] = await conn.query(
            'SELECT academic_year_id FROM AcademicYear WHERE year_name = ?',
            [ACTIVE_YEAR]
        );
        if (yearRow.length > 0) {
            activeYearId = yearRow[0].academic_year_id;
            await conn.query(
                'UPDATE AcademicYear SET is_current = TRUE WHERE academic_year_id = ?',
                [activeYearId]
            );
        } else {
            const [ins] = await conn.query(
                `INSERT INTO AcademicYear (year_name, start_date, end_date, is_current)
                 VALUES (?, '2026-08-01', '2027-07-31', TRUE)`,
                [ACTIVE_YEAR]
            );
            activeYearId = ins.insertId;
        }

        let activeSemId;
        const [semRow] = await conn.query(
            `SELECT semester_id FROM Semester WHERE academic_year_id = ? AND name = ?`,
            [activeYearId, ACTIVE_SEM]
        );
        if (semRow.length > 0) {
            activeSemId = semRow[0].semester_id;
            await conn.query(
                'UPDATE Semester SET is_active = TRUE WHERE semester_id = ?',
                [activeSemId]
            );
        } else {
            const [ins] = await conn.query(
                `INSERT INTO Semester (academic_year_id, name, type, start_date, end_date, is_active)
                 VALUES (?, ?, 'First', '2026-08-16', '2026-12-14', TRUE)`,
                [activeYearId, ACTIVE_SEM]
            );
            activeSemId = ins.insertId;
        }
        console.log(`    ✓ ${ACTIVE_YEAR} ${ACTIVE_SEM} (id ${activeSemId}) active`);

        // ── 7. Module Offerings for the active semester ──
        console.log('📦  Offerings...');
        // Attach every module to the active semester if it doesn't already exist
        const [allModules] = await conn.query('SELECT module_id, credits FROM Module');
        const [allLecturers] = await conn.query('SELECT lecturer_id FROM Lecturer');

        let offCount = 0;
        for (const m of allModules) {
            const lecturer = rand(allLecturers).lecturer_id;
            try {
                const [r] = await conn.query(
                    `INSERT INTO ModuleOffering
                        (module_id, semester_id, lecturer_id, room, schedule, capacity, status, approval_status)
                     VALUES (?, ?, ?, ?, 'TBA', 60, 'Scheduled', 'Draft')`,
                    [m.module_id, activeSemId, lecturer, `R${randInt(100,399)}`]
                );
                if (r.affectedRows > 0) offCount++;
            } catch (e) {
                if (e.code !== 'ER_DUP_ENTRY') throw e;
            }
        }
        console.log(`    ✓ ${offCount} offerings created`);

        // ── 8. Seed some assessments + grades for one offering ──
        console.log('📝  Sample assessments & grades...');
        const [sampleOffering] = await conn.query(
            `SELECT offering_id FROM ModuleOffering WHERE semester_id = ? LIMIT 1`,
            [activeSemId]
        );
        if (sampleOffering.length > 0) {
            const offId = sampleOffering[0].offering_id;
            const assessmentDefs = [
                ['Quiz 1',       'Quiz',       20, 20],
                ['Assignment 1', 'Assignment', 30, 100],
                ['Final Exam',   'Final Exam', 50, 100],
            ];
            for (const [name, type, weight, max] of assessmentDefs) {
                await conn.query(
                    `INSERT IGNORE INTO Assessment
                        (offering_id, name, type, weight_percentage, max_score, due_date)
                     VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
                    [offId, name, type, weight, max]
                );
            }
            console.log(`    ✓ 3 assessments seeded on offering #${offId}`);
        }

        // ── 9. Generate students ──
        console.log('🧑‍🎓  Students...');
        const [progRows] = await conn.query('SELECT program_id, code, duration_years FROM Program');
        let stuCount = 0;
        const cohortYear = '26';
        const allProgramCodes = progRows.map(p => p.code);

        for (const prog of progRows) {
            const n = STUDENTS_PER_PROGRAM;
            for (let i = 1; i <= n; i++) {
                const gender = Math.random() > 0.5 ? 'Male' : 'Female';
                const firstName = gender === 'Male' ? rand(FIRST_NAMES_M) : rand(FIRST_NAMES_F);
                const lastName = rand(LAST_NAMES);
                const studentNumber = `${prog.code}/${cohortYear}/SS/${pad(i)}`;
                const email = `${prog.code.toLowerCase()}${cohortYear}.${pad(i)}@student.mubas.mw`;
                const username = `student.${prog.code.toLowerCase()}${cohortYear}.${pad(i)}`;

                try {
                    // Skip if student already exists
                    const [dup] = await conn.query(
                        'SELECT student_id FROM Student WHERE student_number = ? OR email = ?',
                        [studentNumber, email]
                    );
                    if (dup.length > 0) continue;

                    // Insert User
                    const [ins] = await conn.query(
                        `INSERT INTO User (username, email, password_hash, role, is_active)
                         VALUES (?, ?, ?, 'Student', TRUE)`,
                        [username, email, defaultHash]
                    );
                    const userId = ins.insertId;

                    // Get dept_id from program
                    const [deptRow] = await conn.query(
                        'SELECT dept_id FROM Program WHERE program_id = ?',
                        [prog.program_id]
                    );

                    await conn.query(
                        `INSERT INTO Student
                            (user_id, student_number, program_id, dept_id, first_name, last_name,
                             email, gender, enrollment_date, current_year_of_study, current_semester,
                             status, academic_standing)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-08-15', 1, 1, 'Active', 'Good Standing')`,
                        [userId, studentNumber, prog.program_id, deptRow[0].dept_id,
                         firstName, lastName, email, gender]
                    );
                    stuCount++;
                } catch (e) {
                    if (e.code !== 'ER_DUP_ENTRY') {
                        console.warn(`    ⚠️  Skipped ${studentNumber}: ${e.message}`);
                    }
                }
            }
        }
        console.log(`    ✓ ${stuCount} students (${STUDENTS_PER_PROGRAM} per program × ${allProgramCodes.length} programs)`);

        await conn.commit();

        console.log('\n═══════════════════════════════════════════════════');
        console.log('  ✅  SEED COMPLETE');
        console.log('═══════════════════════════════════════════════════');
        console.log(`  Schools       ${SCHOOLS.length}`);
        console.log(`  Departments   ${DEPARTMENTS.length}`);
        console.log(`  Programs      ${Object.keys(progMap).length}`);
        console.log(`  Modules       ${moduleCount}`);
        console.log(`  Lecturers     ${lecCount}`);
        console.log(`  Offerings     ${offCount}`);
        console.log(`  Students      ${stuCount}`);
        console.log(`  Active year   ${ACTIVE_YEAR} ${ACTIVE_SEM}`);
        console.log('\n  Login credentials (all password = "password"):');
        console.log('    Student  : student.bit26.001');
        console.log('    Lecturer : lecturer.john.banda');
        console.log('    HoD      : hod.banda  (existing)');
        console.log('    Dean     : dean.chirwa (existing)');
        console.log('    Senate   : senate     (existing)');
        console.log('    VC       : vc         (existing)');
        console.log('    Admin    : admin      (existing)');
        console.log('═══════════════════════════════════════════════════\n');

    } catch (err) {
        await conn.rollback();
        console.error('\n❌  SEED FAILED:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        conn.release();
        process.exit(0);
    }
}

run();