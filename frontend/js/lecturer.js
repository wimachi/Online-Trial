// ============================================
// MUBAS - LECTURER DASHBOARD (MODULES)
// Shows modules from the active semester.
// If none exist, falls back to the most recent semester they teach in.
// ============================================

let myScope = null;
let myOfferings = [];
let visibleOfferings = [];
let modulesData = [];
let usingFallback = false;
let fallbackSemesterLabel = '';

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = `Welcome, ${user.username || 'Lecturer'}`;
    document.getElementById('userRole').textContent = (user.role || 'Lecturer').toUpperCase();

    await Promise.all([loadScope(), loadOfferings()]);

    // 1. Try active semester first
    let filtered = myOfferings.filter(o => o.semester_is_active);

    // 2. If empty → fall back to most recent semester the lecturer teaches in
    if (filtered.length === 0 && myOfferings.length > 0) {
        usingFallback = true;

        // Group by semester_id and find the one with highest academic year + semester
        const bySemester = {};
        myOfferings.forEach(o => {
            const key = o.semester_id;
            if (!bySemester[key]) {
                bySemester[key] = {
                    semester_id: o.semester_id,
                    semester_name: o.semester_name,
                    year_name: o.year_name,
                    offerings: [],
                    yearRank: 0
                };
                // Rank by year name (e.g. "2026/2027" → 2026)
                const m = (o.year_name || '').match(/^(\d{4})/);
                bySemester[key].yearRank = m ? parseInt(m[1]) : 0;
            }
            bySemester[key].offerings.push(o);
        });

        // Sort: highest year first, then Semester 2 > Semester 1
        const ranked = Object.values(bySemester).sort((a, b) => {
            if (b.yearRank !== a.yearRank) return b.yearRank - a.yearRank;
            return (b.semester_name || '').localeCompare(a.semester_name || '');
        });

        if (ranked.length > 0) {
            filtered = ranked[0].offerings;
            fallbackSemesterLabel = `${ranked[0].semester_name} · ${ranked[0].year_name}`;
        }
    }

    visibleOfferings = filtered;

    renderHeader();
    buildModules();
    renderSummary();
    renderNotice();
    renderModuleGrid();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

async function loadScope() {
    try {
        const r = await apiRequest('/admin/my-scope');
        if (r.ok) myScope = await r.json();
    } catch (e) { console.error('Scope error:', e); }
}

async function loadOfferings() {
    try {
        const r = await apiRequest('/lecturer/my-offerings');
        if (r.ok) myOfferings = await r.json();
    } catch (e) { console.error('Offerings error:', e); }
}

function renderHeader() {
    if (!myScope) return;
    const initials = ((myScope.first_name || '')[0] || '') + ((myScope.last_name || '')[0] || '');
    document.getElementById('sideAvatar').textContent = initials || 'LC';
    document.getElementById('sideName').textContent =
        `${myScope.title || ''} ${myScope.first_name || ''} ${myScope.last_name || ''}`.trim() || myScope.username;
    const deptEl = document.getElementById('sideDept');
    if (deptEl && myScope.department_name) deptEl.textContent = myScope.department_name;
}

function buildModules() {
    const map = {};

    visibleOfferings.forEach(o => {
        const key = o.module_id;
        if (!map[key]) {
            map[key] = {
                module_id: o.module_id,
                module_code: o.module_code,
                module_name: o.module_name,
                credits: o.credits,
                level: o.level,
                semester_name: o.semester_name,
                year_name: o.year_name,
                classes: [],
                studentCount: 0,
                gradesEntered: 0,
                gradesPossible: 0
            };
        }
        map[key].classes.push(o);
        map[key].studentCount += (o.student_count || 0);
        map[key].gradesEntered += (o.grades_entered || 0);
        map[key].gradesPossible += ((o.student_count || 0) * (o.assessment_count || 0));
    });

    modulesData = Object.values(map).sort((a, b) =>
        a.module_code.localeCompare(b.module_code)
    );
}

function renderSummary() {
    const moduleCount = modulesData.length;
    const classCount = visibleOfferings.length;
    const studentCount = visibleOfferings.reduce((s, o) => s + (o.student_count || 0), 0);

    const totalGrades = visibleOfferings.reduce((s, o) => s + (o.grades_entered || 0), 0);
    const totalPossible = visibleOfferings.reduce(
        (s, o) => s + ((o.student_count || 0) * (o.assessment_count || 0)), 0
    );
    const progress = totalPossible > 0 ? Math.round((totalGrades / totalPossible) * 100) : 0;

    document.getElementById('statModules').textContent = moduleCount;
    document.getElementById('statClasses').textContent = classCount;
    document.getElementById('statStudents').textContent = studentCount;
    document.getElementById('statProgress').textContent = progress + '%';

    // Change the summary labels if we're in fallback mode
    const labelMods = document.querySelector('#statModules + .label');
    if (labelMods) labelMods.textContent = usingFallback ? 'Latest semester' : 'This semester';
}

// Show an info notice if we're falling back to a past semester
function renderNotice() {
    if (!usingFallback) return;

    const grid = document.getElementById('modulesGrid');
    const notice = document.createElement('div');
    notice.style.cssText = 'grid-column:1/-1;padding:14px 18px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;font-size:13px;color:#78350f;margin-bottom:6px;';
    notice.innerHTML = `
        <strong>No active-semester offerings found.</strong>
        Showing modules from the most recent semester you taught: <strong>${fallbackSemesterLabel}</strong>.
    `;
    grid.parentNode.insertBefore(notice, grid);
}

function renderModuleGrid() {
    const container = document.getElementById('modulesGrid');

    if (modulesData.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:60px 20px;color:#888;grid-column:1/-1;background:white;border-radius:12px;">
                <div style="font-size:48px;margin-bottom:12px;">📭</div>
                <div style="font-weight:600;color:#475569;margin-bottom:6px;">No modules assigned yet</div>
                <div style="font-size:13px;">Once you are assigned as a lecturer on a module offering, it will appear here.</div>
            </div>
        `;
        return;
    }

    let html = '';
    modulesData.forEach(m => {
        const progress = m.gradesPossible > 0
            ? Math.round((m.gradesEntered / m.gradesPossible) * 100)
            : 0;

        const classCount = m.classes.length;
        const url = `/lecturer-module.html?module=${m.module_id}`;

        html += `
            <a href="${url}" style="text-decoration:none;color:inherit;">
                <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:22px;box-shadow:0 1px 3px rgba(15,23,42,0.06);transition:all 0.2s;cursor:pointer;display:flex;flex-direction:column;gap:14px;height:100%;"
                    onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 20px rgba(15,23,42,0.1)';this.style.borderColor='#003366';"
                    onmouseout="this.style.transform='none';this.style.boxShadow='0 1px 3px rgba(15,23,42,0.06)';this.style.borderColor='#e2e8f0';">

                    <div>
                        <div style="font-size:12px;font-weight:800;color:#003366;letter-spacing:0.05em;">
                            ${m.module_code}
                        </div>
                        <div style="font-size:17px;font-weight:700;color:#0f172a;margin-top:4px;line-height:1.3;">
                            ${m.module_name}
                        </div>
                        <div style="font-size:12px;color:#64748b;margin-top:6px;">
                            ${m.credits} credits · ${m.semester_name} · ${m.year_name}
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px 0;border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;">
                        <div>
                            <div style="font-size:22px;font-weight:700;color:#003366;">${classCount}</div>
                            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;letter-spacing:0.05em;">Class${classCount !== 1 ? 'es' : ''}</div>
                        </div>
                        <div>
                            <div style="font-size:22px;font-weight:700;color:#003366;">${m.studentCount}</div>
                            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;letter-spacing:0.05em;">Students</div>
                        </div>
                    </div>

                    <div>
                        <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:4px;">
                            <span>Grading progress</span>
                            <strong>${m.gradesEntered} / ${m.gradesPossible} (${progress}%)</strong>
                        </div>
                        <div style="height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden;">
                            <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,#003366,#0066cc);transition:width 0.4s;"></div>
                        </div>
                    </div>

                    <div style="display:flex;justify-content:flex-end;">
                        <span style="display:inline-flex;align-items:center;gap:6px;color:#003366;font-weight:600;font-size:13px;">
                            View classes
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </span>
                    </div>
                </div>
            </a>
        `;
    });

    container.innerHTML = html;
}