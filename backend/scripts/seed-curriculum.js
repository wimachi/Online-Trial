// ============================================
// MUBAS - CURRICULUM SEED
// Maps each program → its modules → year → semester
// Derived from the 2026 exam timetable class codes
//
// Run:  node scripts/seed-curriculum.js
// ============================================

require('dotenv').config();
const db = require('../config/database');

// ─────────────────────────────────────────────
// YEAR 1 / SEMESTER 1 CURRICULUM MAP
// { programCode: [moduleCode, moduleCode, ...] }
// ─────────────────────────────────────────────
const YEAR_1_SEM_1 = {
    // ─── Built Environment ─────────────────────────────
    BARC: ['LNC-EAP-111','MTS-CAT-111','ARC-HTA-111','PBS-MEC-111'],
    BQS:  ['LNC-EAP-111','MTS-CAT-111','ECL-BUS-ECO-111','LQS-CMM-111','LQS-IQS-111'],
    BRE:  ['LNC-EAP-111','MTS-CAT-111','ECL-BUS-ECO-111','LQS-BUT-111','LQS-IRE-111'],
    BLS:  ['LNC-EAP-111','MTS-CAT-111','LSP-SUR-111','PBS-MEC-111'],
    BPP:  ['LNC-EAP-111','MTS-CAT-111','ECL-BUS-ECO-111','LSP-SUR-111','LSP-IPB-111'],

    // ─── Business & Economics ──────────────────────────
    BAC:  ['LNC-EAP-111','MTS-BUN-111','ECL-ECN-111','ACF-FAC-111','ECL-FBL-111'],
    BAF:  ['LNC-EAP-111','MTS-BUN-111','ECL-ECN-111','ACF-FAC-111','ECL-FBL-111'],
    BCTA: ['LNC-EAP-111','MTS-BUM-111','ECL-ECN-111','BUS-OBE-111','ACF-FAC-111','ECL-GPL-111'],
    BIA:  ['LNC-EAP-111','MTS-BUN-111','ECL-ECN-111','ACF-FAC-111','ECL-FBL-111'],
    BIRM: ['LNC-EAP-111','MTS-BUN-111','ECL-ECN-111','ACF-FAC-111','ECL-FBL-111'],
    BAM:  ['LNC-EAP-111','MTS-BUN-111','ECL-ECN-111','BUS-POM-111','ACF-FAC-111'],
    BBA:  ['LNC-EAP-111','MTS-BUN-111','ECL-ECN-111','BUS-POM-111','ACF-FAC-111'],
    BCEC: ['LNC-EAP-111','MTS-BUN-111','ECL-ECN-111','BUS-POM-111','ACF-FAC-111'],
    BCERE:['LNC-EAP-111','MTS-BUN-111','ECL-ECN-111','BUS-POM-111','ACF-FAC-111'],
    BCME: ['LNC-EAP-111','MTS-BUN-111','ECL-ECN-111','ACF-FAC-111','BUS-ENT-111'],
    BCTM: ['LNC-EAP-111','MTS-BUN-111','ECL-ECN-111','ACF-FAC-111','ECL-FBL-111'],
    BPSCM:['LNC-EAP-111','MTS-BUM-111','ECL-ECN-111','ECL-GPL-111','ACF-FAC-111'],
    LLB:  ['ECL-TOT-111','ECL-CON-111','ECL-ITL-111','ECL-ADL-111','ECL-COL-111'],

    // ─── Engineering ───────────────────────────────────
    BAE:  ['LNC-EAP-111','MEC-END-111','MEC-MES-111','MEC-VTP-111','MTS-ALT-111','PBS-CHE-111'],
    BBME: ['LNC-EAP-111','MEC-END-111','MEC-MES-111','MTS-ALT-111','PBS-CHE-111'],
    BCE:  ['LNC-EAP-111','MEC-END-111','MEC-MES-111','MTS-ALT-111','PBS-PHY-111','PBS-CHE-111'],
    BECE: ['LNC-EAP-111','MEC-END-111','MEC-MES-111','MTS-ALT-111','PBS-CHE-111','ELE-COH-111'],
    BEE:  ['LNC-EAP-111','MEC-END-111','MEC-MES-111','MTS-ALT-111','PBS-CHE-111'],
    BETE: ['LNC-EAP-111','MEC-END-111','MEC-MES-111','MTS-ALT-111','PBS-CHE-111'],
    BGEN: ['LNC-EAP-111','MEC-END-111','MEC-MES-111','MTS-ALT-111','PBS-PHY-111','PBS-CHE-111'],
    BMEN: ['LNC-EAP-111','MEC-END-111','MEC-MES-111','MTS-ALT-111','PBS-PHY-111','PBS-CHE-111'],
    BMMP: ['LNC-EAP-111','MEC-END-111','MEC-MES-111','MTS-ALT-111','PBS-PHY-111','PBS-CHE-111'],
    BPEN: ['LNC-EAP-111','MEC-END-111','MEC-MES-111','MTS-ALT-111','PBS-PHY-111','PBS-CHE-111'],
    BIE:  ['LNC-EAP-111','MEC-END-111','MEC-MES-111','MTS-ALT-111','PBS-CHE-111'],
    BME:  ['LNC-EAP-111','MEC-END-111','MEC-MES-111','MTS-ALT-111','PBS-CHE-111'],

    // ─── SECOMS ────────────────────────────────────────
    BAJ:   ['LNC-EAP-111','JMS-PBS-111','JMS-IMC-111','JMS-LIT-111','JMS-ITJ-111'],
    BDJOU: ['LNC-EAP-111','JMS-PUS-111','JMS-IMC-111','JMS-LIT-111','JMS-ITJ-111'],
    BBC:   ['LNC-EAP-111','LNC-LIT-111','LNC-MAC-111','LNC-COT-111','LNC-ORC-111','CIT-CSC-111'],
    BDC:   ['LNC-EAP-111','JMS-IMC-111','JMS-ICM-111','JMS-DET-111','CIT-CSC-111'],
    BPR:   ['LNC-EAP-111','LNC-MAC-111','LNC-COT-111','LNC-IPR-111','LNC-ORC-111','LNC-MER-111'],
    BSBCC: ['LNC-EAP-111','PEH-BKH-111','LNC-PSY-111','LNC-ISB-111','CIT-CSC-111'],
    BSNIE: ['LNC-EAP-111','MTS-CAT-111','AED-ISN-111','CIS-INS-111','PBS-HAP-111'],
    BTECH: ['LNC-EAP-111','MTS-CAT-111','AED-WST-111','AED-TDR-111'],
    EBCS:  ['LNC-EAP-111','ECL-BUS-ECO-111','MTS-CAT-111','CIS-INS-111','ACF-FIA-111'],
    TED:   ['LNC-EAP-111','MTS-CAT-111','PBS-MEC-111','AED-TDR-111','AED-WDT-111'],

    // ─── Science & Technology ──────────────────────────
    BCS:  ['LNC-EAP-111','MTS-CAT-111','CIS-CYS-111','CIS-PRO-111','CIS-FCN-111'],
    BIS:  ['LNC-EAP-111','ECL-BUS-ECO-111','MTS-CAT-111','CIS-PRO-111','CIS-FCN-111'],
    BIT:  ['LNC-EAP-111','ELE-ECF-111','MTS-CAT-111','CIS-PRO-111','CIS-FCN-111'],
    BSE:  ['LNC-EAP-111','MTS-CAT-111','CIS-CYS-111','CIS-PRO-111','CIS-ISE-111','CIS-FCN-111'],
    BEMT: ['LNC-EAP-111','PBS-LAM-111','MTS-CAT-111','PBS-BIO-111','PBS-MEC-111','PBS-CHE-111'],
    BFST: ['LNC-EAP-111','PBS-LAM-111','MTS-CAT-111','PBS-BIO-111','PBS-MEC-111','PBS-CHE-111'],
    BIEP: ['LNC-EAP-111','PBS-LAM-111','MTS-CAT-111','PBS-BIO-111','PBS-MEC-111','PBS-CHE-111'],
    BILT: ['LNC-EAP-111','PBS-LAM-111','MTS-CAT-111','PBS-BIO-111','PBS-MEC-111','PBS-CHE-111'],
    BOSH: ['LNC-EAP-111','MTS-CAT-111','PBS-BIO-111','PBS-PHY-111','PBS-CHE-111'],
    BEH:  ['LNC-EAP-111','MTS-CAT-111','PBS-BIO-111','PBS-PHY-111','PBS-CHE-111'],
};

// ============================================
// ENGINE
// ============================================

async function run() {
    const conn = await db.getConnection();
    try {
        console.log('\n═══════════════════════════════════════════════════');
        console.log('  MUBAS CURRICULUM SEED (Year 1 / Semester 1)');
        console.log('═══════════════════════════════════════════════════\n');

        await conn.beginTransaction();

        // ── Load program + module lookups ──
        const [programRows] = await conn.query('SELECT program_id, code FROM Program');
        const programMap = {};
        programRows.forEach(p => { programMap[p.code] = p.program_id; });

        const [moduleRows] = await conn.query('SELECT module_id, code FROM Module');
        const moduleMap = {};
        moduleRows.forEach(m => { moduleMap[m.code] = m.module_id; });

        console.log(`📋  Loaded ${programRows.length} programs and ${moduleRows.length} modules\n`);

        // ── Seed curriculum ──
        let inserted = 0;
        let skippedExisting = 0;
        const unmatchedPrograms = [];
        const unmatchedModules = new Set();

        for (const [programCode, moduleCodes] of Object.entries(YEAR_1_SEM_1)) {
            const programId = programMap[programCode];
            if (!programId) {
                unmatchedPrograms.push(programCode);
                continue;
            }

            for (const moduleCode of moduleCodes) {
                const moduleId = moduleMap[moduleCode];
                if (!moduleId) {
                    unmatchedModules.add(moduleCode);
                    continue;
                }

                // Check if already exists (curriculum has no unique constraint)
                const [existing] = await conn.query(
                    `SELECT curriculum_id FROM Curriculum
                     WHERE program_id = ? AND module_id = ?
                       AND year_of_study = 1 AND semester = 1`,
                    [programId, moduleId]
                );

                if (existing.length > 0) {
                    skippedExisting++;
                    continue;
                }

                await conn.query(
                    `INSERT INTO Curriculum
                        (program_id, module_id, academic_year, semester, year_of_study, is_core)
                     VALUES (?, ?, 1, 1, 1, TRUE)`,
                    [programId, moduleId]
                );
                inserted++;
            }
        }

        await conn.commit();

        // ── Report ──
        console.log('═══════════════════════════════════════════════════');
        console.log('  ✅  CURRICULUM SEED COMPLETE');
        console.log('═══════════════════════════════════════════════════');
        console.log(`  Programs mapped      ${Object.keys(YEAR_1_SEM_1).length}`);
        console.log(`  Curriculum rows new  ${inserted}`);
        console.log(`  Already present      ${skippedExisting}`);

        if (unmatchedPrograms.length > 0) {
            console.log(`\n  ⚠️  Unknown programs in map (${unmatchedPrograms.length}):`);
            unmatchedPrograms.forEach(c => console.log(`      - ${c}`));
        }
        if (unmatchedModules.size > 0) {
            console.log(`\n  ⚠️  Unknown module codes (${unmatchedModules.size}):`);
            Array.from(unmatchedModules).sort().forEach(c => console.log(`      - ${c}`));
        }

        console.log('\n═══════════════════════════════════════════════════\n');

    } catch (err) {
        await conn.rollback();
        console.error('\n❌  CURRICULUM SEED FAILED:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        conn.release();
        process.exit(0);
    }
}

run();