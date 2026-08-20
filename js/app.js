const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN = '신승오';
const TEACHERS = ['신승오', '이희웅', '김윤수', '김다현', '김지영'];
const DEFAULT_PASSWORD = '0000';

const SUBJECTS = {
  psychomotor: { label: '심리운동', rate: 50000 },
  language: { label: '언어재활', rate: 48000 },
};

const DAYS = [
  { value: 0, label: '일' },
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
];

const PAYMENT_TYPES = {
  none: '일반',
  developmental: '발달바우처',
  infant: '영유아 바우처',
  'edu-therapy': '교육청 치료지원',
  'edu-afterschool': '교육청 방과 후',
  'edu-umter': '교육청 움터',
  sports: '스포츠바우처',
};

const PAYMENT_TYPE_OPTIONS = ['developmental', 'infant', 'edu-therapy', 'edu-afterschool', 'edu-umter', 'sports'];

const DEVELOPMENTAL_SUBTYPES = {
  ga: { label: '가형', copay: 20000, voucherAmount: 240000 },
  na: { label: '나형', copay: 40000, voucherAmount: 220000 },
  ra: { label: '라형', copay: 60000, voucherAmount: 200000 },
  ma: { label: '마형', copay: 80000, voucherAmount: 180000 },
  da: { label: '다형', copay: 0, voucherAmount: 0 },
};

const INFANT_SUBTYPES = {
  grade1: { label: '1등급', copay: 16000 },
  grade2: { label: '2등급', copay: 32000 },
};

const EXTRA_6TH = {
  psychomotor: 40000,
  language: 28000,
};

const EDU_VOUCHER_AMOUNTS = {
  'edu-therapy': 160000,
  'edu-afterschool': 120000,
};

const SPORTS_VOUCHER_AMOUNT = 110000;

const PAYMENT_ACCOUNTS = {
  copayDevelopmental: '경남은행 207-0064-8191-02 신승오(울산언어심리운동센터)',
  copayInfant: '경남은행 207-0077-8558-02 신승오(울산언어심리운동센터)',
  additional: '경남은행 01044946380 신승오 · 울산페이 QR코드 · 신용카드 납부 가능',
};

function getCopayAccountNote(child) {
  const hasDevelopmental = child.paymentTypes?.includes('developmental');
  const hasInfant = child.paymentTypes?.includes('infant');
  if (hasDevelopmental && hasInfant) {
    return `발달: ${PAYMENT_ACCOUNTS.copayDevelopmental} / 영유아: ${PAYMENT_ACCOUNTS.copayInfant}`;
  }
  if (hasInfant) return PAYMENT_ACCOUNTS.copayInfant;
  return PAYMENT_ACCOUNTS.copayDevelopmental;
}

const SESSION_KEY = 'attendance-manager-session';

function defaultData() {
  const passwords = {};
  TEACHERS.forEach((t) => { passwords[t] = DEFAULT_PASSWORD; });
  return { children: [], attendance: {}, monthlyFees: {}, teacherPasswords: passwords };
}

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function setSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function isAdmin() {
  return currentUser?.name === ADMIN;
}

function getVisibleChildren() {
  if (!currentUser) return [];
  if (isAdmin()) return data.children;
  return data.children.filter((c) => c.teacher === currentUser.name);
}

function formatCurrency(n) {
  return Number(n).toLocaleString('ko-KR') + '원';
}

function formatDateKR(date) {
  const d = new Date(date);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]}요일)`;
}

function getDayLabels(days) {
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAYS.find((day) => day.value === d)?.label)
    .join(', ');
}

function countSessionsInMonth(year, month, days) {
  if (!days?.length) return 0;
  const daySet = new Set(days);
  const lastDay = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    if (daySet.has(new Date(year, month - 1, d).getDay())) count++;
  }
  return count;
}

function getCopayAmount(child) {
  let total = 0;
  if (child.paymentTypes?.includes('developmental') && child.developmentalSub) {
    total += DEVELOPMENTAL_SUBTYPES[child.developmentalSub]?.copay ?? 0;
  }
  if (child.paymentTypes?.includes('infant') && child.infantSub) {
    total += INFANT_SUBTYPES[child.infantSub]?.copay ?? 0;
  }
  return total;
}

function needsCopayField(child) {
  return child.paymentTypes?.includes('developmental') || child.paymentTypes?.includes('infant');
}

/**
 * 발달바우처가 단독 선택된 경우: 총 금액은 청구하지 않고 6·7회차 이상 추가금만 추가납부액.
 * 발달바우처 + 다른 바우처(교육청/스포츠 등)가 함께 선택된 경우: 다른 바우처들의 차감액을
 * 총 금액에서 뺀 값 + 6·7회차 추가금. (발달바우처 자체 차감액은 정보 표시용, 청구액엔 반영 안 함)
 * 발달바우처 없이 다른 바우처만 있는 경우: 총 금액 - 바우처 차감액. 본인부담금은 항상 별도.
 */
function calculateMonthlyFee(child, sessionCount) {
  const subject = SUBJECTS[child.subject];
  if (!subject) {
    return { baseTotal: 0, voucherDeduction: 0, extra6Amount: 0, extra7Amount: 0, extraAmount: 0, additionalPayment: 0, copay: 0, breakdown: [], rate: 0 };
  }

  const rate = subject.rate;
  const baseTotal = sessionCount * rate;
  const breakdown = [`총 금액: ${sessionCount}회 × ${formatCurrency(rate)} = ${formatCurrency(baseTotal)}`];

  const types = child.paymentTypes || [];
  const isDevelopmental = types.includes('developmental');

  let developmentalDeduction = 0;
  let otherDeduction = 0;
  let extra6Amount = 0;
  let extra7Amount = 0;

  if (isDevelopmental && child.developmentalSub) {
    const sub = DEVELOPMENTAL_SUBTYPES[child.developmentalSub];
    if (sub) {
      developmentalDeduction = sub.voucherAmount;
      if (developmentalDeduction > 0) {
        breakdown.push(`발달바우처 ${sub.label} 차감(참고): -${formatCurrency(developmentalDeduction)}`);
      }
    }
    if (sessionCount >= 6) {
      extra6Amount = EXTRA_6TH[child.subject] ?? 0;
      breakdown.push(`6회차 추가금: +${formatCurrency(extra6Amount)}`);
    }
    if (sessionCount >= 7) {
      const extraSessions = sessionCount - 6;
      extra7Amount = extraSessions * rate;
      breakdown.push(`7회차 이후 ${extraSessions}회 × ${formatCurrency(rate)} = +${formatCurrency(extra7Amount)}`);
    }
  }

  if (types.includes('edu-therapy')) {
    otherDeduction += EDU_VOUCHER_AMOUNTS['edu-therapy'];
    breakdown.push(`교육청 치료지원 차감: -${formatCurrency(EDU_VOUCHER_AMOUNTS['edu-therapy'])}`);
  }
  if (types.includes('edu-afterschool')) {
    otherDeduction += EDU_VOUCHER_AMOUNTS['edu-afterschool'];
    breakdown.push(`교육청 방과 후 차감: -${formatCurrency(EDU_VOUCHER_AMOUNTS['edu-afterschool'])}`);
  }
  if (types.includes('sports')) {
    otherDeduction += SPORTS_VOUCHER_AMOUNT;
    breakdown.push(`스포츠바우처 차감: -${formatCurrency(SPORTS_VOUCHER_AMOUNT)}`);
  }

  const extraAmount = extra6Amount + extra7Amount;
  const voucherDeduction = developmentalDeduction + otherDeduction;
  const baseContribution = (isDevelopmental && otherDeduction === 0) ? 0 : Math.max(0, baseTotal - otherDeduction);
  const additionalPayment = baseContribution + extraAmount;
  const copay = getCopayAmount(child);

  if (copay > 0) {
    breakdown.push(`본인부담금 (별도 납부): ${formatCurrency(copay)}`);
  }

  breakdown.push(`→ 추가금 납부액: ${formatCurrency(additionalPayment)}`);

  return { baseTotal, voucherDeduction, extra6Amount, extra7Amount, extraAmount, additionalPayment, copay, breakdown, rate };
}

function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function debounce(fn, delay = 600) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function rowToChild(row) {
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date || '',
    classTime: row.class_time || '',
    teacher: row.teacher,
    subject: row.subject,
    paymentTypes: row.payment_types || [],
    developmentalSub: row.developmental_sub || '',
    infantSub: row.infant_sub || '',
    days: row.days || [],
  };
}

function childToRow(child) {
  return {
    name: child.name,
    birth_date: child.birthDate || null,
    class_time: child.classTime || null,
    teacher: child.teacher,
    subject: child.subject,
    payment_types: child.paymentTypes,
    developmental_sub: child.paymentTypes.includes('developmental') ? (child.developmentalSub || null) : null,
    infant_sub: child.paymentTypes.includes('infant') ? (child.infantSub || null) : null,
    days: child.days,
  };
}

let data = defaultData();
let currentUser = getSession();
let editingChildId = null;
let feeViewYear = new Date().getFullYear();
let feeViewMonth = new Date().getMonth() + 1;

const loadingScreen = document.getElementById('loadingScreen');
const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const childModal = document.getElementById('childModal');
const childForm = document.getElementById('childForm');

async function init() {
  populateLoginSelect();
  populateFormSelects();
  renderDayCheckboxes();
  bindEvents();

  try {
    await loadAllData();
  } catch (err) {
    console.error(err);
    alert('데이터를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침 해주세요.');
  }

  loadingScreen.classList.add('hidden');

  if (currentUser) {
    showApp();
  } else {
    showLogin();
  }
}

async function loadAllData() {
  const [childrenRes, attendanceRes, feesRes, pwRes] = await Promise.all([
    supabaseClient.from('children').select('*'),
    supabaseClient.from('attendance').select('*'),
    supabaseClient.from('monthly_fees').select('*'),
    supabaseClient.from('teacher_passwords').select('*'),
  ]);

  const firstError = childrenRes.error || attendanceRes.error || feesRes.error || pwRes.error;
  if (firstError) throw firstError;

  data.children = (childrenRes.data || []).map(rowToChild);

  data.attendance = {};
  (attendanceRes.data || []).forEach((row) => {
    if (!data.attendance[row.date]) data.attendance[row.date] = {};
    data.attendance[row.date][row.child_id] = { status: row.status, reason: row.reason || '' };
  });

  data.monthlyFees = {};
  (feesRes.data || []).forEach((row) => {
    if (!data.monthlyFees[row.month_key]) data.monthlyFees[row.month_key] = {};
    data.monthlyFees[row.month_key][row.child_id] = {
      sessionCount: row.session_count,
      additionalDepositDate: row.additional_deposit_date || '',
      copayDepositDate: row.copay_deposit_date || '',
      notes: row.notes || '',
    };
  });

  data.teacherPasswords = {};
  TEACHERS.forEach((t) => { data.teacherPasswords[t] = DEFAULT_PASSWORD; });
  (pwRes.data || []).forEach((row) => { data.teacherPasswords[row.teacher] = row.password; });
}

function showLogin() {
  loginScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

function showApp() {
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  document.getElementById('userLabel').textContent =
    `${currentUser.name}${isAdmin() ? ' (관리자)' : ''}`;
  document.getElementById('tabSettings').classList.toggle('hidden', !isAdmin());
  renderAll();
}

function populateLoginSelect() {
  const sel = document.getElementById('loginUsername');
  sel.innerHTML = '<option value="">선택</option>';
  TEACHERS.forEach((t) => {
    sel.innerHTML += `<option value="${t}">${t}</option>`;
  });
}

function populateFormSelects() {
  const teacherSel = document.getElementById('teacherSelect');
  teacherSel.innerHTML = '<option value="">선택</option>';
  TEACHERS.forEach((t) => {
    teacherSel.innerHTML += `<option value="${t}">${t}</option>`;
  });
  const subjectSel = childForm.querySelector('[name="subject"]');
  subjectSel.innerHTML = '<option value="">선택</option>';
  Object.entries(SUBJECTS).forEach(([k, v]) => {
    subjectSel.innerHTML += `<option value="${k}">${v.label}</option>`;
  });
}

function renderDayCheckboxes(container = document.getElementById('dayCheckboxes'), selected = []) {
  container.innerHTML = DAYS.map(
    (d) => `
    <label class="day-check">
      <input type="checkbox" name="days" value="${d.value}" ${selected.includes(d.value) ? 'checked' : ''}>
      ${d.label}
    </label>`
  ).join('');
}

function renderPaymentTypeCheckboxes(container = document.getElementById('paymentTypeCheckboxes'), selected = []) {
  container.innerHTML = PAYMENT_TYPE_OPTIONS.map(
    (key) => `
    <label class="day-check">
      <input type="checkbox" name="paymentTypes" value="${key}" ${selected.includes(key) ? 'checked' : ''}>
      ${PAYMENT_TYPES[key]}
    </label>`
  ).join('');
}

function bindEvents() {
  loginForm.addEventListener('submit', handleLogin);
  document.getElementById('btnLogout').addEventListener('click', handleLogout);

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.getElementById('btnNewChild').addEventListener('click', () => openChildModal());
  document.getElementById('closeModal').addEventListener('click', closeChildModal);
  document.getElementById('cancelModal').addEventListener('click', closeChildModal);
  childForm.addEventListener('submit', handleChildSubmit);

  document.getElementById('paymentTypeCheckboxes').addEventListener('change', (e) => {
    if (e.target.name !== 'paymentTypes') return;
    if (e.target.value === 'developmental' && !e.target.checked) {
      childForm.querySelectorAll('[name="developmentalSub"]').forEach((r) => { r.checked = false; });
    }
    if (e.target.value === 'infant' && !e.target.checked) {
      childForm.querySelectorAll('[name="infantSub"]').forEach((r) => { r.checked = false; });
    }
    updateVoucherSubFields();
  });

  document.getElementById('prevMonth').addEventListener('click', () => {
    feeViewMonth--;
    if (feeViewMonth < 1) { feeViewMonth = 12; feeViewYear--; }
    renderFees();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    feeViewMonth++;
    if (feeViewMonth > 12) { feeViewMonth = 1; feeViewYear++; }
    renderFees();
  });
}

function handleLogin(e) {
  e.preventDefault();
  const fd = new FormData(loginForm);
  const username = fd.get('username');
  const password = fd.get('password');

  if (!TEACHERS.includes(username)) {
    alert('등록되지 않은 선생님입니다.');
    return;
  }

  const stored = data.teacherPasswords[username];
  if (password !== stored) {
    alert('비밀번호가 올바르지 않습니다.');
    return;
  }

  currentUser = { name: username };
  setSession(currentUser);
  showApp();
}

function handleLogout() {
  currentUser = null;
  clearSession();
  loginForm.reset();
  showLogin();
}

function switchTab(name) {
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  panels.forEach((p) => p.classList.toggle('active', p.id === name));
  if (name === 'attendance') renderAttendance();
  if (name === 'children') renderChildren();
  if (name === 'fees') renderFees();
  if (name === 'settings') renderPasswordSettings();
}

function renderAll() {
  renderAttendance();
  renderChildren();
  renderFees();
  if (isAdmin()) renderPasswordSettings();
}

function updateVoucherSubFields() {
  const checkedTypes = [...childForm.querySelectorAll('[name="paymentTypes"]:checked')].map((el) => el.value);

  const devField = document.getElementById('developmentalSubField');
  const devOptions = document.getElementById('developmentalSubOptions');
  if (checkedTypes.includes('developmental')) {
    const current = childForm.querySelector('[name="developmentalSub"]:checked')?.value;
    devField.hidden = false;
    devOptions.innerHTML = renderRadioGroup('developmentalSub', DEVELOPMENTAL_SUBTYPES, current, true);
  } else {
    devField.hidden = true;
    devOptions.innerHTML = '';
  }

  const infField = document.getElementById('infantSubField');
  const infOptions = document.getElementById('infantSubOptions');
  if (checkedTypes.includes('infant')) {
    const current = childForm.querySelector('[name="infantSub"]:checked')?.value;
    infField.hidden = false;
    infOptions.innerHTML = renderRadioGroup('infantSub', INFANT_SUBTYPES, current, true);
  } else {
    infField.hidden = true;
    infOptions.innerHTML = '';
  }
}

function renderRadioGroup(name, subtypes, selected, showCopay) {
  return Object.entries(subtypes)
    .map(
      ([k, v]) => `
      <label class="radio-option">
        <input type="radio" name="${name}" value="${k}" ${selected === k ? 'checked' : ''}>
        ${v.label}${showCopay && v.copay !== undefined ? ` (${formatCurrency(v.copay)})` : ''}
      </label>`
    )
    .join('');
}

function openChildModal(child = null) {
  editingChildId = child?.id ?? null;
  document.getElementById('modalTitle').textContent = child ? '아이 정보 수정' : '새 아이 등록';
  childForm.reset();

  const teacherSel = document.getElementById('teacherSelect');
  if (child) {
    childForm.querySelector('[name="name"]').value = child.name;
    childForm.querySelector('[name="birthDate"]').value = child.birthDate || '';
    childForm.querySelector('[name="classTime"]').value = child.classTime || '14:00';
    teacherSel.value = child.teacher;
    childForm.querySelector('[name="subject"]').value = child.subject;
    renderPaymentTypeCheckboxes(document.getElementById('paymentTypeCheckboxes'), child.paymentTypes || []);
    renderDayCheckboxes(document.getElementById('dayCheckboxes'), child.days || []);
  } else {
    renderPaymentTypeCheckboxes(document.getElementById('paymentTypeCheckboxes'), []);
    renderDayCheckboxes(document.getElementById('dayCheckboxes'), []);
    if (!isAdmin()) {
      teacherSel.value = currentUser.name;
    }
  }

  teacherSel.disabled = !isAdmin();

  updateVoucherSubFields();
  if (child?.developmentalSub) {
    const radio = childForm.querySelector(`[name="developmentalSub"][value="${child.developmentalSub}"]`);
    if (radio) radio.checked = true;
  }
  if (child?.infantSub) {
    const radio = childForm.querySelector(`[name="infantSub"][value="${child.infantSub}"]`);
    if (radio) radio.checked = true;
  }

  childModal.showModal();
}

function closeChildModal() {
  childModal.close();
  editingChildId = null;
  document.getElementById('teacherSelect').disabled = false;
}

async function handleChildSubmit(e) {
  e.preventDefault();
  const fd = new FormData(childForm);
  const days = [...childForm.querySelectorAll('[name="days"]:checked')].map((el) => Number(el.value));

  if (!days.length) {
    alert('수업 요일을 하나 이상 선택해 주세요.');
    return;
  }

  const paymentTypes = [...childForm.querySelectorAll('[name="paymentTypes"]:checked')].map((el) => el.value);
  const developmentalSub = fd.get('developmentalSub') || '';
  const infantSub = fd.get('infantSub') || '';

  if (paymentTypes.includes('developmental') && !developmentalSub) {
    alert('발달바우처 형별을 선택해 주세요.');
    return;
  }
  if (paymentTypes.includes('infant') && !infantSub) {
    alert('영유아 바우처 등급을 선택해 주세요.');
    return;
  }

  let teacher = fd.get('teacher');
  if (!isAdmin()) teacher = currentUser.name;

  const child = {
    name: fd.get('name').trim(),
    birthDate: fd.get('birthDate') || '',
    classTime: fd.get('classTime') || '',
    teacher,
    subject: fd.get('subject'),
    paymentTypes,
    developmentalSub: paymentTypes.includes('developmental') ? developmentalSub : '',
    infantSub: paymentTypes.includes('infant') ? infantSub : '',
    days,
  };

  const submitBtn = childForm.querySelector('.modal-footer .btn-primary');
  submitBtn.disabled = true;

  try {
    if (editingChildId) {
      const existing = data.children.find((c) => c.id === editingChildId);
      if (existing && !isAdmin() && existing.teacher !== currentUser.name) {
        alert('수정 권한이 없습니다.');
        return;
      }
      const { error } = await supabaseClient
        .from('children')
        .update(childToRow(child))
        .eq('id', editingChildId);
      if (error) throw error;

      const idx = data.children.findIndex((c) => c.id === editingChildId);
      if (idx >= 0) data.children[idx] = { ...child, id: editingChildId };
    } else {
      const { data: inserted, error } = await supabaseClient
        .from('children')
        .insert(childToRow(child))
        .select()
        .single();
      if (error) throw error;
      data.children.push(rowToChild(inserted));
    }

    closeChildModal();
    renderChildren();
    renderAttendance();
    renderFees();
  } catch (err) {
    console.error(err);
    alert('저장 중 오류가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');
  } finally {
    submitBtn.disabled = false;
  }
}

async function deleteChild(id) {
  const child = data.children.find((c) => c.id === id);
  if (!child) return;
  if (!isAdmin() && child.teacher !== currentUser.name) {
    alert('삭제 권한이 없습니다.');
    return;
  }
  if (!confirm('이 아이 정보를 삭제할까요?')) return;

  const { error } = await supabaseClient.from('children').delete().eq('id', id);
  if (error) {
    console.error(error);
    alert('삭제 중 오류가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');
    return;
  }

  data.children = data.children.filter((c) => c.id !== id);
  renderChildren();
  renderAttendance();
  renderFees();
}

function renderChildren() {
  const list = document.getElementById('childrenList');
  const children = getVisibleChildren();

  if (!children.length) {
    list.innerHTML = '<p class="empty-msg">등록된 아이가 없습니다. 새 아이를 등록해 주세요.</p>';
    return;
  }

  list.innerHTML = children
    .map((c) => {
      const paymentLabel = c.paymentTypes?.length
        ? c.paymentTypes.map((t) => PAYMENT_TYPES[t] || t).join(' + ')
        : PAYMENT_TYPES.none;
      const subLabels = [];
      if (c.paymentTypes?.includes('developmental') && c.developmentalSub) {
        subLabels.push(DEVELOPMENTAL_SUBTYPES[c.developmentalSub]?.label);
      }
      if (c.paymentTypes?.includes('infant') && c.infantSub) {
        subLabels.push(INFANT_SUBTYPES[c.infantSub]?.label);
      }
      const voucherLabel = subLabels.length ? ` · ${subLabels.join(', ')}` : '';
      return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="child-name">${esc(c.name)}</div>
            <div class="child-meta">
              ${c.birthDate ? esc(c.birthDate) + ' · ' : ''}
              ${getDayLabels(c.days)} ${c.classTime || ''} ·
              ${esc(c.teacher)} · ${SUBJECTS[c.subject]?.label}
            </div>
            <div class="child-meta">${paymentLabel}${voucherLabel}</div>
          </div>
          <div class="card-actions">
            <button class="btn btn-sm" data-edit="${c.id}">수정</button>
            <button class="btn btn-sm btn-danger" data-delete="${c.id}">삭제</button>
          </div>
        </div>
      </div>`;
    })
    .join('');

  list.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const child = data.children.find((c) => c.id === btn.dataset.edit);
      if (child) openChildModal(child);
    });
  });
  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteChild(btn.dataset.delete));
  });
}

function renderAttendance() {
  const today = new Date();
  const todayDow = today.getDay();
  const key = dateKey(today);

  document.getElementById('todayLabel').textContent = formatDateKR(today);

  const todayChildren = getVisibleChildren().filter((c) => c.days.includes(todayDow));
  const list = document.getElementById('attendanceList');
  const empty = document.getElementById('attendanceEmpty');

  if (!todayChildren.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  if (!data.attendance[key]) data.attendance[key] = {};

  list.innerHTML = todayChildren
    .map((c) => {
      const record = data.attendance[key][c.id] || { status: '', reason: '' };
      const isAbsent = record.status === 'absent';
      return `
      <div class="card" data-child="${c.id}">
        <div class="child-name">${esc(c.name)}</div>
        <div class="child-meta">${c.classTime || ''} · ${esc(c.teacher)} · ${SUBJECTS[c.subject]?.label}</div>
        <div class="attendance-row" style="margin-top:.75rem">
          <div class="status-btns">
            <button class="status-btn ${record.status === 'present' ? 'active-present' : ''}" data-status="present">출석</button>
            <button class="status-btn ${record.status === 'absent' ? 'active-absent' : ''}" data-status="absent">결석</button>
          </div>
          <input class="absence-reason" placeholder="결석 사유" value="${esc(record.reason)}"
            ${isAbsent ? '' : 'disabled'}>
        </div>
      </div>`;
    })
    .join('');

  const saveReasonDebounced = debounce(async (cid, reason) => {
    const { error } = await supabaseClient
      .from('attendance')
      .upsert({ child_id: cid, date: key, status: data.attendance[key][cid]?.status || 'absent', reason }, { onConflict: 'child_id,date' });
    if (error) {
      console.error(error);
      alert('결석 사유 저장 중 오류가 발생했습니다.');
    }
  }, 600);

  list.querySelectorAll('.card').forEach((card) => {
    const cid = card.dataset.child;
    card.querySelectorAll('[data-status]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const status = btn.dataset.status;
        const reason = status === 'absent' ? (data.attendance[key][cid]?.reason || '') : '';

        const { error } = await supabaseClient
          .from('attendance')
          .upsert({ child_id: cid, date: key, status, reason }, { onConflict: 'child_id,date' });
        if (error) {
          console.error(error);
          alert('출석 저장 중 오류가 발생했습니다.');
          return;
        }

        data.attendance[key][cid] = { status, reason };
        renderAttendance();
      });
    });
    const reasonInput = card.querySelector('.absence-reason');
    reasonInput?.addEventListener('input', () => {
      if (!data.attendance[key][cid]) data.attendance[key][cid] = { status: 'absent', reason: '' };
      data.attendance[key][cid].reason = reasonInput.value;
      saveReasonDebounced(cid, reasonInput.value);
    });
  });
}

function getFeeRecord(childId) {
  const mk = monthKey(feeViewYear, feeViewMonth);
  if (!data.monthlyFees[mk]) data.monthlyFees[mk] = {};
  if (!data.monthlyFees[mk][childId]) {
    const child = data.children.find((c) => c.id === childId);
    const auto = child ? countSessionsInMonth(feeViewYear, feeViewMonth, child.days) : 0;
    data.monthlyFees[mk][childId] = {
      sessionCount: auto,
      copayDepositDate: '',
      additionalDepositDate: '',
      notes: '',
    };
  }
  return data.monthlyFees[mk][childId];
}

async function persistFeeRecord(childId) {
  const mk = monthKey(feeViewYear, feeViewMonth);
  const rec = getFeeRecord(childId);
  const { error } = await supabaseClient.from('monthly_fees').upsert(
    {
      child_id: childId,
      month_key: mk,
      session_count: rec.sessionCount,
      additional_deposit_date: rec.additionalDepositDate || null,
      copay_deposit_date: rec.copayDepositDate || null,
      notes: rec.notes || '',
    },
    { onConflict: 'child_id,month_key' }
  );
  if (error) {
    console.error(error);
    alert('수업료 정보 저장 중 오류가 발생했습니다.');
  }
}

const persistFeeRecordDebounced = debounce(persistFeeRecord, 600);

function renderFees() {
  document.getElementById('feeMonthLabel').textContent = `${feeViewYear}년 ${feeViewMonth}월`;
  const list = document.getElementById('feesList');
  const children = getVisibleChildren();

  if (!children.length) {
    list.innerHTML = '<p class="empty-msg">등록된 아이가 없습니다.</p>';
    return;
  }

  list.innerHTML = children
    .map((c) => {
      const autoCount = countSessionsInMonth(feeViewYear, feeViewMonth, c.days);
      const feeRec = getFeeRecord(c.id);
      const sessionCount = feeRec.sessionCount ?? autoCount;
      const fee = calculateMonthlyFee(c, sessionCount);
      const showCopay = needsCopayField(c);

      const paymentRows = [];
      if (fee.additionalPayment > 0) {
        paymentRows.push(`
          <tr>
            <td>추가납부액</td>
            <td class="amount">${formatCurrency(fee.additionalPayment)}</td>
            <td>${esc(PAYMENT_ACCOUNTS.additional)}</td>
          </tr>`);
      }
      if (showCopay && fee.copay > 0) {
        paymentRows.push(`
          <tr>
            <td>본인부담금</td>
            <td class="amount">${formatCurrency(fee.copay)}</td>
            <td>${esc(getCopayAccountNote(c))}</td>
          </tr>`);
      }
      const paymentTableHtml = paymentRows.length
        ? `
        <div class="payment-table-wrap">
          <table class="payment-table">
            <thead><tr><th>구분</th><th>금액</th><th>입금 계좌</th></tr></thead>
            <tbody>${paymentRows.join('')}</tbody>
          </table>
        </div>`
        : '<p class="empty-msg payment-table-empty">이번 달 별도 납부할 금액이 없습니다.</p>';

      return `
      <div class="card fee-card" data-fee-child="${c.id}">
        <div class="child-name">${esc(c.name)}</div>
        <div class="child-meta">
          ${getDayLabels(c.days)} · ${SUBJECTS[c.subject]?.label} ·
          ${esc(c.paymentTypes?.length ? c.paymentTypes.map((t) => PAYMENT_TYPES[t] || t).join(' + ') : PAYMENT_TYPES.none)}
          · ${esc(c.teacher)}
        </div>

        <div class="fee-input-row">
          <label>해당 월 수업 횟수</label>
          <span class="text-muted">(자동: ${autoCount}회)</span>
          <input type="number" class="session-count" min="0" max="31" value="${sessionCount}">
          <span>회</span>
        </div>

        <div class="fee-summary">
          <div class="fee-item">
            <div class="label">총 금액</div>
            <div class="value">${formatCurrency(fee.baseTotal)}</div>
          </div>
          ${fee.voucherDeduction > 0 ? `
          <div class="fee-item">
            <div class="label">바우처 차감</div>
            <div class="value fee-deduct">-${formatCurrency(fee.voucherDeduction)}</div>
          </div>` : ''}
          ${fee.extra6Amount > 0 ? `
          <div class="fee-item">
            <div class="label">6회차 추가금</div>
            <div class="value">+${formatCurrency(fee.extra6Amount)}</div>
          </div>` : ''}
          ${fee.extra7Amount > 0 ? `
          <div class="fee-item">
            <div class="label">7회차 이후 추가금</div>
            <div class="value">+${formatCurrency(fee.extra7Amount)}</div>
          </div>` : ''}
        </div>

        ${paymentTableHtml}

        <ul class="fee-breakdown">${fee.breakdown.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>

        <div class="deposit-section">
          <div class="fee-input-row">
            <label>추가금 입금일</label>
            <input type="date" class="additional-date" value="${feeRec.additionalDepositDate || ''}">
          </div>
          ${showCopay && fee.copay > 0 ? `
          <div class="fee-input-row">
            <label>본인부담금 입금일</label>
            <input type="date" class="copay-date" value="${feeRec.copayDepositDate || ''}">
          </div>` : ''}
        </div>

        <div class="fee-input-row">
          <label>비고</label>
          <textarea class="fee-notes" placeholder="보강 잔여 등">${esc(feeRec.notes || '')}</textarea>
        </div>
      </div>`;
    })
    .join('');

  list.querySelectorAll('[data-fee-child]').forEach((card) => {
    const cid = card.dataset.feeChild;

    card.querySelector('.session-count')?.addEventListener('change', async (e) => {
      getFeeRecord(cid).sessionCount = Math.max(0, Number(e.target.value) || 0);
      await persistFeeRecord(cid);
      renderFees();
    });

    card.querySelector('.additional-date')?.addEventListener('change', async (e) => {
      getFeeRecord(cid).additionalDepositDate = e.target.value;
      await persistFeeRecord(cid);
    });

    card.querySelector('.copay-date')?.addEventListener('change', async (e) => {
      getFeeRecord(cid).copayDepositDate = e.target.value;
      await persistFeeRecord(cid);
    });

    card.querySelector('.fee-notes')?.addEventListener('input', (e) => {
      getFeeRecord(cid).notes = e.target.value;
      persistFeeRecordDebounced(cid);
    });
  });
}

function renderPasswordSettings() {
  if (!isAdmin()) return;
  const list = document.getElementById('passwordList');
  list.innerHTML = TEACHERS.map(
    (t) => `
    <div class="card password-row" data-teacher="${t}">
      <div class="child-name">${esc(t)}${t === ADMIN ? ' <span class="badge">관리자</span>' : ''}</div>
      <div class="password-form">
        <input type="password" class="pw-input" pattern="[0-9]{4}" maxlength="4" inputmode="numeric"
          value="${esc(data.teacherPasswords[t] || DEFAULT_PASSWORD)}" placeholder="4자리">
        <button type="button" class="btn btn-sm btn-primary pw-save">저장</button>
      </div>
    </div>`
  ).join('');

  list.querySelectorAll('.pw-save').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.password-row');
      const teacher = row.dataset.teacher;
      const pw = row.querySelector('.pw-input').value;
      if (!/^\d{4}$/.test(pw)) {
        alert('비밀번호는 숫자 4자리여야 합니다.');
        return;
      }

      btn.disabled = true;
      const { error } = await supabaseClient
        .from('teacher_passwords')
        .update({ password: pw })
        .eq('teacher', teacher);
      btn.disabled = false;

      if (error) {
        console.error(error);
        alert('저장 중 오류가 발생했습니다.');
        return;
      }

      data.teacherPasswords[teacher] = pw;
      alert(`${teacher} 선생님 비밀번호가 변경되었습니다.`);
    });
  });
}

init();
