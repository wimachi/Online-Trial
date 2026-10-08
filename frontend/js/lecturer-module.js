// ============================================
// MUBAS - LECTURER MODULE VIEW (CLASSES)
// ============================================

let myOfferings = [];
let moduleClasses = [];
let moduleInfo = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = `Welcome, ${user.username || 'Lecturer'}`;

    const params = new URLSearchParams(window.location.search);
    const moduleId = parseInt(params.get('module'));

    if (!moduleId) {
        document.getElementById('loading').textContent = 'Missing module. Go back and pick a module.';
        return;
    }

    await loadOfferings();

    // Filter to this module AND active semester only
    moduleClasses = myOfferings.filter(o =>
        o.module_id === moduleId && o.semester_is_active
    );

    if (moduleClasses.length === 0) {
        document.getElementById('loading').textContent = 'No active classes for this module.';
        return;
    }

    moduleInfo = {
        module_id: moduleId,
        module_code: moduleClasses[0].module_code,
        module_name: moduleClasses[0].module_name,
        credits: moduleClasses[0].credits,
        level: moduleClasses[0].level,
        semester_name: moduleClasses[0].semester_name,
        year_name: moduleClasses[0].year_name
    };

    // Sort classes: year → program code
    moduleClasses.sort((a, b) => {
        if (a.year_of_study !== b.year_of_study) return a.year_of_study - b.year_of_study;
        return (a.program_code || '').localeCompare(b.program_code || '');
    });

    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    renderHeader();
    renderClassGrid();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

async function loadOfferings() {
    try {
        const r = await apiRequest('/lecturer/my-offerings');
        if (r.ok) myOfferings = await r.json();
    } catch (e) { console.error('Offerings error:', e); }
}

function renderHeader() {
    document.getElementById('moduleCode').textContent = moduleInfo.module_code;
    document.getElementById('moduleName').textContent = moduleInfo.module_name;
    document.getElementById('moduleSubtitle').textContent =
        `${moduleInfo.credits} credits · Level ${moduleInfo.level || '—'} · ${moduleInfo.semester_name} · ${moduleInfo.year_name}`;

    const totalStudents = moduleClasses.reduce((s, o) => s + (o.student_count || 0), 0);
    const totalGrades = moduleClasses.reduce((s, o) => s + (o.grades_entered || 0), 0);
    const totalPossible = moduleClasses.reduce(
        (s, o) => s + ((o.student_count || 0) * (o.assessment_count || 0)), 0
    );

    document.getElementById('moduleStats').innerHTML = `
        <div><strong style="font-size:18px;">${moduleClasses.length}</strong> class${moduleClasses.length !== 1 ? 'es' : ''}</div>
        <div style="font-size:11px;opacity:0.85;margin-top:2px;">${totalStudents} students · ${totalGrades}/${totalPossible} grades</div>
    `;
}

function renderClassGrid() {
    const container = document.getElementById('classesGrid');
    let html = '';

    moduleClasses.forEach(o => {
        const possible = (o.student_count || 0) * (o.assessment_count || 0);
        const progress = possible > 0
            ? Math.round((o.grades_entered / possible) * 100)
            : 0;

        const url = `/lecturer-gradebook.html?offering=${o.offering_id}`;

        html += `
            <a href="${url}" style="text-decoration:none;color:inherit;">
                <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:22px;box-shadow:0 1px 3px rgba(15,23,42,0.06);transition:all 0.2s;cursor:pointer;display:flex;flex-direction:column;gap:14px;height:100%;"
                    onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 20px rgba(15,23,42,0.1)';this.style.borderColor='#003366';"
                    onmouseout="this.style.transform='none';this.style.boxShadow='0 1px 3px rgba(15,23,42,0.06)';this.style.borderColor='#e2e8f0';">

                    <div>
                        <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">
                            <div>
                                <div style="font-size:17px;font-weight:800;color:#003366;letter-spacing:-0.02em;">
                                    ${o.program_code}
                                </div>
                                <div style="font-size:13px;color:#0f172a;font-weight:600;margin-top:2px;">
                                    Year ${o.year_of_study} · ${o.semester_name}
                                </div>
                            </div>
                            <span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;flex-shrink:0;">
                                ACTIVE
                            </span>
                        </div>
                        <div style="font-size:12px;color:#64748b;margin-top:4px;">
                            ${o.program_name} · ${o.year_name}
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:14px 0;border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;">
                        <div>
                            <div style="font-size:20px;font-weight:700;color:#003366;">${o.student_count}</div>
                            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;letter-spacing:0.05em;">Students</div>
                        </div>
                        <div>
                            <div style="font-size:20px;font-weight:700;color:#003366;">${o.assessment_count}</div>
                            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;letter-spacing:0.05em;">Assess.</div>
                        </div>
                        <div>
                            <div style="font-size:20px;font-weight:700;color:#003366;">${o.credits}</div>
                            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;letter-spacing:0.05em;">Credits</div>
                        </div>
                    </div>

                    <div>
                        <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:4px;">
                            <span>Grades entered</span>
                            <strong>${o.grades_entered} / ${possible} (${progress}%)</strong>
                        </div>
                        <div style="height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden;">
                            <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,#003366,#0066cc);transition:width 0.4s;"></div>
                        </div>
                    </div>

                    <div style="display:flex;justify-content:flex-end;">
                        <span style="display:inline-flex;align-items:center;gap:6px;color:#003366;font-weight:600;font-size:13px;">
                            Open gradebook
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </span>
                    </div>
                </div>
            </a>
        `;
    });

    container.innerHTML = html;
}