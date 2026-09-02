const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

const PAYMENT_METHODS = {
  cash: '현금',
  card: '카드',
  ulsanpay: '울산페이',
};

// 시간표에서만 쓰는 간략 표기 (지정 안 된 유형은 PAYMENT_TYPES 전체 이름 사용)
const SCHEDULE_VOUCHER_LABELS = {
  developmental: '발달재활',
  infant: '영유아',
  'edu-therapy': '치료지원',
  'edu-afterschool': '방과 후',
  sports: '스포츠',
};

const PAYMENT_TYPE_OPTIONS = ['developmental', 'infant', 'edu-therapy', 'edu-afterschool', 'edu-umter', 'sports'];

const DEVELOPMENTAL_SUBTYPES = {
  ga: { label: '가형', copay: 20000 },
  na: { label: '나형', copay: 40000 },
  ra: { label: '라형', copay: 60000 },
  ma: { label: '마형', copay: 80000 },
  da: { label: '다형', copay: 0 },
};

// 1~5회차: 회당 본인부담금 / 6회차: 6회차 1회분 본인부담금 (출처: 바우처 계산.xlsx)
const DEVELOPMENTAL_PER_SESSION_COPAY = {
  psychomotor: { ga: 4000, na: 7500, ra: 11500, ma: 15500, da: 0 },
  language: { ga: 3840, na: 7200, ra: 11040, ma: 14880, da: 0 },
};
const DEVELOPMENTAL_SIXTH_SESSION_COPAY = {
  psychomotor: { ga: 0, na: 2500, ra: 2500, ma: 2500, da: 0 },
  language: { ga: 800, na: 4000, ra: 4800, ma: 5600, da: 0 },
};

function getDevelopmentalCopay(subject, sub, sessionCount) {
  const perSession = DEVELOPMENTAL_PER_SESSION_COPAY[subject]?.[sub] ?? 0;
  const sixth = DEVELOPMENTAL_SIXTH_SESSION_COPAY[subject]?.[sub] ?? 0;
  const normalSessions = Math.min(sessionCount, 5);
  let copay = perSession * normalSessions;
  if (sessionCount >= 6) copay += sixth;
  return copay;
}

// 1~5회차: 회당 정부지원금(바우처 차감) / 6회차: 6회차 1회분 정부지원금 (출처: 바우처 계산.xlsx)
const DEVELOPMENTAL_PER_SESSION_VOUCHER = {
  psychomotor: { ga: 46000, na: 42500, ra: 38500, ma: 34500, da: 0 },
  language: { ga: 44160, na: 40800, ra: 36960, ma: 33120, da: 0 },
};
const DEVELOPMENTAL_SIXTH_SESSION_VOUCHER = {
  psychomotor: { ga: 10000, na: 7500, ra: 7500, ma: 7500, da: 0 },
  language: { ga: 19200, na: 16000, ra: 15200, ma: 14400, da: 0 },
};

function getDevelopmentalVoucherDeduction(subject, sub, sessionCount) {
  const perSession = DEVELOPMENTAL_PER_SESSION_VOUCHER[subject]?.[sub] ?? 0;
  const sixth = DEVELOPMENTAL_SIXTH_SESSION_VOUCHER[subject]?.[sub] ?? 0;
  const normalSessions = Math.min(sessionCount, 5);
  let deduction = perSession * normalSessions;
  if (sessionCount >= 6) deduction += sixth;
  return deduction;
}

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

const CLASS_DURATION_MIN = 40;
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function getAgeString(birthDate) {
  if (!birthDate) return '';
  const bd = new Date(birthDate);
  const now = new Date();
  let years = now.getFullYear() - bd.getFullYear();
  let months = now.getMonth() - bd.getMonth();
  if (now.getDate() < bd.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  return `만 ${years}세 ${months}개월`;
}

function addMinutesToTime(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor((total % 1440) / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

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
  return { children: [], attendance: {}, monthlyFees: {}, teachers: [] };
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
  return !!data.teachers.find((t) => t.name === currentUser?.name)?.isAdmin;
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

function getDayTimeLabel(child) {
  return (child.days || [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => {
      const label = DAYS.find((day) => day.value === d)?.label;
      const time = (child.dayTimes?.[d] || '').slice(0, 5);
      return time ? `${label} ${time}` : label;
    })
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

function getCopayAmount(child, sessionCount) {
  let total = 0;
  if (child.paymentTypes?.includes('developmental') && child.developmentalSub) {
    total += getDevelopmentalCopay(child.subject, child.developmentalSub, sessionCount);
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
 * 추가납부액 = 총 금액 − 발달바우처 지원금 − 발달바우처 본인부담금 − (교육청/스포츠 등 다른 바우처 차감액 합계)
 * 발달바우처가 없으면 앞의 두 항은 0. 결과가 마이너스가 될 수 있으며 그대로 표시한다.
 * 6·7회차 추가금은 이 계산식에 이미 포함되어 있어 별도로 더하지 않고, 안내용 항목으로만 표시한다.
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
  let developmentalCopay = 0;
  let otherDeduction = 0;
  let extra6Amount = 0;
  let extra7Amount = 0;

  if (isDevelopmental && child.developmentalSub) {
    const sub = DEVELOPMENTAL_SUBTYPES[child.developmentalSub];
    developmentalDeduction = getDevelopmentalVoucherDeduction(child.subject, child.developmentalSub, sessionCount);
    developmentalCopay = getDevelopmentalCopay(child.subject, child.developmentalSub, sessionCount);
    if (developmentalDeduction > 0) {
      breakdown.push(`발달바우처 ${sub?.label ?? ''} 차감: -${formatCurrency(developmentalDeduction)}`);
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
  const copay = getCopayAmount(child, sessionCount);
  const additionalPayment = baseTotal - developmentalDeduction - developmentalCopay - otherDeduction;

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
  let dayTimes = row.day_times || null;
  let days;
  if (dayTimes && Object.keys(dayTimes).length) {
    days = Object.keys(dayTimes).map(Number);
  } else {
    // 요일별 시간(day_times)이 없는 옛 데이터: days + 단일 class_time에서 변환
    days = row.days || [];
    dayTimes = {};
    days.forEach((d) => { dayTimes[d] = row.class_time || '14:00'; });
  }
  // "15:00:00"(초 포함, DB time 타입)과 "15:00"(초 없음, <input type="time">)이
  // 서로 다른 값으로 취급되지 않도록 항상 "HH:MM"으로 통일
  Object.keys(dayTimes).forEach((d) => {
    if (dayTimes[d]) dayTimes[d] = dayTimes[d].slice(0, 5);
  });
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date || '',
    teacher: row.teacher,
    subject: row.subject,
    paymentTypes: row.payment_types || [],
    developmentalSub: row.developmental_sub || '',
    infantSub: row.infant_sub || '',
    days,
    dayTimes,
    createdAt: row.created_at || null,
  };
}

function childToRow(child) {
  const days = Object.keys(child.dayTimes || {}).map(Number);
  return {
    name: child.name,
    birth_date: child.birthDate || null,
    teacher: child.teacher,
    subject: child.subject,
    payment_types: child.paymentTypes,
    developmental_sub: child.paymentTypes.includes('developmental') ? (child.developmentalSub || null) : null,
    infant_sub: child.paymentTypes.includes('infant') ? (child.infantSub || null) : null,
    days,
    day_times: child.dayTimes || {},
    class_time: days.length ? child.dayTimes[days[0]] : null,
  };
}

let data = defaultData();
let currentUser = getSession();
let editingChildId = null;
let feeViewYear = new Date().getFullYear();
let feeViewMonth = new Date().getMonth() + 1;
let attViewYear = new Date().getFullYear();
let attViewMonth = new Date().getMonth() + 1;
let historyChildId = null;
let historyYear = new Date().getFullYear();
let extraChildIdsByDate = {};
let childrenSortMode = 'recent';
let attendanceViewDate = new Date();
let feesExcludedIds = new Set();

const loadingScreen = document.getElementById('loadingScreen');
const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const childModal = document.getElementById('childModal');
const childForm = document.getElementById('childForm');
const childHistoryModal = document.getElementById('childHistoryModal');

async function init() {
  populateLoginSelect();
  populateFormSelects();
  renderDayTimeRows();
  bindEvents();

  try {
    await loadAllData();
  } catch (err) {
    console.error(err);
    alert('데이터를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침 해주세요.');
  }

  populateLoginSelect();
  populateFormSelects();

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
      additionalAmount: row.additional_amount ?? null,
      additionalPaid: row.additional_paid || false,
      additionalPaymentMethod: row.additional_payment_method || '',
      copayDepositDate: row.copay_deposit_date || '',
      copayAmount: row.copay_amount ?? null,
      copayPaid: row.copay_paid || false,
      notes: row.notes || '',
    };
  });

  data.teachers = (pwRes.data || []).map((row) => ({
    name: row.teacher,
    password: row.password,
    isAdmin: row.is_admin || false,
  }));
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
  data.teachers.forEach((t) => {
    sel.innerHTML += `<option value="${esc(t.name)}">${esc(t.name)}</option>`;
  });
}

function populateFormSelects() {
  const teacherSel = document.getElementById('teacherSelect');
  teacherSel.innerHTML = '<option value="">선택</option>';
  data.teachers.forEach((t) => {
    teacherSel.innerHTML += `<option value="${esc(t.name)}">${esc(t.name)}</option>`;
  });
  const subjectSel = childForm.querySelector('[name="subject"]');
  subjectSel.innerHTML = '<option value="">선택</option>';
  Object.entries(SUBJECTS).forEach(([k, v]) => {
    subjectSel.innerHTML += `<option value="${k}">${v.label}</option>`;
  });
}

function renderDayTimeRows(container = document.getElementById('dayTimeRows'), dayTimes = {}) {
  const scheduleDays = DAYS.slice(1); // 월~토 (일요일 제외)
  container.innerHTML = scheduleDays
    .map((d) => {
      const checked = dayTimes[d.value] !== undefined;
      const time = dayTimes[d.value] || '14:00';
      return `
      <div class="day-time-row">
        <label class="day-check">
          <input type="checkbox" class="day-time-checkbox" data-day="${d.value}" ${checked ? 'checked' : ''}>
          ${d.label}
        </label>
        <input type="time" class="day-time-input" data-day="${d.value}" value="${time}" step="600" ${checked ? '' : 'disabled'}>
      </div>`;
    })
    .join('');
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
  document.getElementById('btnAddTeacher').addEventListener('click', handleAddTeacher);

  document.getElementById('attDatePrev').addEventListener('click', () => {
    attendanceViewDate = new Date(attendanceViewDate);
    attendanceViewDate.setDate(attendanceViewDate.getDate() - 1);
    renderAttendance();
  });
  document.getElementById('attDateNext').addEventListener('click', () => {
    attendanceViewDate = new Date(attendanceViewDate);
    attendanceViewDate.setDate(attendanceViewDate.getDate() + 1);
    renderAttendance();
  });
  document.getElementById('attDateToday').addEventListener('click', () => {
    attendanceViewDate = new Date();
    renderAttendance();
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.getElementById('btnNewChild').addEventListener('click', () => openChildModal());
  document.getElementById('childrenSortSelect').addEventListener('change', (e) => {
    childrenSortMode = e.target.value;
    renderChildren();
  });

  document.getElementById('btnFeesSelectAll').addEventListener('click', () => {
    feesExcludedIds.clear();
    renderFees();
  });
  document.getElementById('btnFeesSelectNone').addEventListener('click', () => {
    feesExcludedIds = new Set(getVisibleChildren().map((c) => c.id));
    renderFees();
  });

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

  document.getElementById('dayTimeRows').addEventListener('change', (e) => {
    if (!e.target.classList.contains('day-time-checkbox')) return;
    const row = e.target.closest('.day-time-row');
    const timeInput = row.querySelector('.day-time-input');
    timeInput.disabled = !e.target.checked;
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

  document.getElementById('attPrevMonth').addEventListener('click', () => {
    attViewMonth--;
    if (attViewMonth < 1) { attViewMonth = 12; attViewYear--; }
    renderMonthlyAttendance();
  });
  document.getElementById('attNextMonth').addEventListener('click', () => {
    attViewMonth++;
    if (attViewMonth > 12) { attViewMonth = 1; attViewYear++; }
    renderMonthlyAttendance();
  });

  document.getElementById('btnPrintAttendance').addEventListener('click', () => {
    document.getElementById('attPrintTitle').textContent = getAttendanceReportTitle();
    setPrintPageSize('landscape');
    window.print();
  });
  document.getElementById('btnExportAttendanceExcel').addEventListener('click', exportMonthlyAttendanceExcel);

  document.getElementById('btnPrintSchedule').addEventListener('click', () => {
    document.getElementById('schedulePrintTitle').textContent = `${currentUser?.name || ''} 시간표 (월~토)`;
    setPrintPageSize('portrait');
    window.print();
  });

  document.getElementById('closeHistoryModal').addEventListener('click', closeChildHistoryModal);
  document.getElementById('closeHistoryModalFooter').addEventListener('click', closeChildHistoryModal);
  document.getElementById('historyPrevYear').addEventListener('click', () => {
    historyYear--;
    renderChildHistory();
  });
  document.getElementById('historyNextYear').addEventListener('click', () => {
    historyYear++;
    renderChildHistory();
  });
}

function openChildHistoryModal(childId) {
  historyChildId = childId;
  historyYear = new Date().getFullYear();
  renderChildHistory();
  childHistoryModal.showModal();
}

function closeChildHistoryModal() {
  childHistoryModal.close();
  historyChildId = null;
}

function getMonthlyFeeAmounts(childId, year, month) {
  const child = data.children.find((c) => c.id === childId);
  if (!child) return { additional: 0, copay: 0 };
  const mk = monthKey(year, month);
  const rec = data.monthlyFees[mk]?.[childId];
  const sessionCount = rec?.sessionCount ?? countSessionsInMonth(year, month, child.days);
  const fee = calculateMonthlyFee(child, sessionCount);
  const additional = rec?.additionalAmount ?? fee.additionalPayment;
  const copay = rec?.copayAmount ?? fee.copay;
  return { additional, copay };
}

function renderChildHistory() {
  const child = data.children.find((c) => c.id === historyChildId);
  if (!child) return;

  document.getElementById('historyModalTitle').textContent = `${child.name} 납부 내역`;
  document.getElementById('historyYearLabel').textContent = `${historyYear}년`;

  let totalAdditional = 0;
  let totalCopay = 0;

  const rows = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((m) => {
      const { additional, copay } = getMonthlyFeeAmounts(historyChildId, historyYear, m);
      totalAdditional += additional;
      totalCopay += copay;
      return `
        <tr>
          <td>${m}월</td>
          <td class="amount">${formatCurrency(additional)}</td>
          <td class="amount">${formatCurrency(copay)}</td>
          <td class="amount">${formatCurrency(additional + copay)}</td>
        </tr>`;
    })
    .join('');

  document.getElementById('historyTableWrap').innerHTML = `
    <div class="payment-table-wrap">
      <table class="payment-table">
        <thead><tr><th>월</th><th>추가금</th><th>본인부담금</th><th>합계</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="history-total-row">
            <td>합계</td>
            <td class="amount">${formatCurrency(totalAdditional)}</td>
            <td class="amount">${formatCurrency(totalCopay)}</td>
            <td class="amount">${formatCurrency(totalAdditional + totalCopay)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function setPrintPageSize(orientation) {
  let styleEl = document.getElementById('dynamicPrintPageStyle');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamicPrintPageStyle';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `@page { size: A4 ${orientation}; margin: 10mm; }`;
}

function getAttendanceReportTitle() {
  const mm = String(attViewMonth).padStart(2, '0');
  return `${attViewYear}년 ${mm}월 출석부-${currentUser?.name || ''}`;
}

function exportMonthlyAttendanceExcel() {
  const { rows, dateList, grandTotal } = computeMonthlyAttendanceData(attViewYear, attViewMonth);
  if (!rows.length) return;

  const title = getAttendanceReportTitle();
  const totalCols = dateList.length + 1;

  const aoa = [];
  aoa.push([title, ...Array(dateList.length).fill('')]);
  aoa.push(['이름', ...dateList]);
  aoa.push(['', ...dateList.map((d) => WEEKDAY_LABELS[new Date(attViewYear, attViewMonth - 1, d).getDay()])]);

  rows.forEach(({ child: c, presentCount, cells, paymentStatus }) => {
    const rowVals = cells.map((cell) => {
      if (cell.type === 'noclass') return '';
      if (cell.type === 'empty') return '-';
      const makeupSuffix = cell.isMakeup ? '(보강)' : '';
      if (cell.type === 'present') return `출석${makeupSuffix}`;
      return (cell.reason ? `결석(${cell.reason})` : '결석') + makeupSuffix;
    });
    const statusText = paymentStatus === 'unpaid' ? ' - 미납' : paymentStatus === 'paid' ? ' - 납부완료' : '';
    aoa.push([`${c.name} (${presentCount}회)${statusText}`, ...rowVals]);
  });

  aoa.push([`합계 (${grandTotal}회)`, ...Array(dateList.length).fill('')]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const headerRowIdx = [1, 2];
  const totalRowIdx = aoa.length - 1;

  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }];
  ws['!cols'] = [{ wch: 16 }, ...dateList.map(() => ({ wch: 6 }))];

  const thinBorder = { style: 'thin', color: { rgb: '000000' } };
  const border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      const isTitle = r === 0;
      const isHeader = headerRowIdx.includes(r);
      const isTotal = r === totalRowIdx;
      ws[addr].s = {
        border,
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        font: { bold: isTitle || isHeader || isTotal, sz: isTitle ? 13 : 11 },
        fill: isHeader ? { fgColor: { rgb: 'F1F5F9' } } : isTotal ? { fgColor: { rgb: 'FEF3C7' } } : undefined,
      };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '출석부');
  XLSX.writeFile(wb, `${title}.xlsx`);
}

function handleLogin(e) {
  e.preventDefault();
  const fd = new FormData(loginForm);
  const username = fd.get('username');
  const password = fd.get('password');

  const teacher = data.teachers.find((t) => t.name === username);
  if (!teacher) {
    alert('등록되지 않은 선생님입니다.');
    return;
  }

  if (password !== teacher.password) {
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

async function handleAddTeacher() {
  const nameInput = document.getElementById('newTeacherName');
  const adminCheckbox = document.getElementById('newTeacherIsAdmin');
  const name = nameInput.value.trim();

  if (!name) {
    alert('선생님 이름을 입력해 주세요.');
    return;
  }
  if (data.teachers.some((t) => t.name === name)) {
    alert('이미 등록된 이름입니다.');
    return;
  }

  const isAdminChecked = adminCheckbox.checked;
  const btn = document.getElementById('btnAddTeacher');
  btn.disabled = true;
  const { error } = await supabaseClient
    .from('teacher_passwords')
    .insert({ teacher: name, password: DEFAULT_PASSWORD, is_admin: isAdminChecked });
  btn.disabled = false;

  if (error) {
    console.error(error);
    alert('추가 중 오류가 발생했습니다.');
    return;
  }

  data.teachers.push({ name, password: DEFAULT_PASSWORD, isAdmin: isAdminChecked });
  nameInput.value = '';
  adminCheckbox.checked = false;
  populateLoginSelect();
  populateFormSelects();
  renderPasswordSettings();
}

function switchTab(name) {
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  panels.forEach((p) => p.classList.toggle('active', p.id === name));
  if (name === 'attendance') renderAttendance();
  if (name === 'schedule') renderSchedule();
  if (name === 'children') renderChildren();
  if (name === 'fees') renderFees();
  if (name === 'monthlyAttendance') renderMonthlyAttendance();
  if (name === 'settings') renderPasswordSettings();
}

function renderAll() {
  renderAttendance();
  renderSchedule();
  renderChildren();
  renderFees();
  renderMonthlyAttendance();
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
  document.getElementById('modalTitle').textContent = child ? '대상자 정보 수정' : '새 대상자 등록';
  childForm.reset();

  const teacherSel = document.getElementById('teacherSelect');
  if (child) {
    childForm.querySelector('[name="name"]').value = child.name;
    childForm.querySelector('[name="birthDate"]').value = child.birthDate || '';
    teacherSel.value = child.teacher;
    childForm.querySelector('[name="subject"]').value = child.subject;
    renderPaymentTypeCheckboxes(document.getElementById('paymentTypeCheckboxes'), child.paymentTypes || []);
    renderDayTimeRows(document.getElementById('dayTimeRows'), child.dayTimes || {});
  } else {
    renderPaymentTypeCheckboxes(document.getElementById('paymentTypeCheckboxes'), []);
    renderDayTimeRows(document.getElementById('dayTimeRows'), {});
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
  const dayTimes = {};
  childForm.querySelectorAll('.day-time-checkbox:checked').forEach((cb) => {
    const day = Number(cb.dataset.day);
    const timeInput = childForm.querySelector(`.day-time-input[data-day="${day}"]`);
    dayTimes[day] = timeInput.value || '14:00';
  });

  if (!Object.keys(dayTimes).length) {
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
    teacher,
    subject: fd.get('subject'),
    paymentTypes,
    developmentalSub: paymentTypes.includes('developmental') ? developmentalSub : '',
    infantSub: paymentTypes.includes('infant') ? infantSub : '',
    dayTimes,
    days: Object.keys(dayTimes).map(Number),
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
  if (!confirm('이 대상자 정보를 삭제할까요?')) return;

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

function sortChildren(children) {
  const sorted = children.slice();
  if (childrenSortMode === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  } else {
    sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }
  return sorted;
}

function renderChildren() {
  const list = document.getElementById('childrenList');
  const children = sortChildren(getVisibleChildren());

  if (!children.length) {
    list.innerHTML = '<p class="empty-msg">등록된 대상자가 없습니다. 새 대상자를 등록해 주세요.</p>';
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
            <div class="child-name child-name-link" data-history="${c.id}">${esc(c.name)}</div>
            <div class="child-meta">
              ${c.birthDate ? `${esc(c.birthDate)} (${getAgeString(c.birthDate)}) · ` : ''}
              ${getDayTimeLabel(c)} ·
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
  list.querySelectorAll('[data-history]').forEach((el) => {
    el.addEventListener('click', () => openChildHistoryModal(el.dataset.history));
  });
}

function renderAttendance() {
  const viewDate = attendanceViewDate;
  const todayDow = viewDate.getDay();
  const key = dateKey(viewDate);
  const isToday = dateKey(new Date()) === key;

  document.getElementById('todayLabel').textContent = formatDateKR(viewDate) + (isToday ? ' (오늘)' : '');

  if (!data.attendance[key]) data.attendance[key] = {};
  if (!extraChildIdsByDate[key]) extraChildIdsByDate[key] = [];
  const extraIds = extraChildIdsByDate[key];

  const visible = getVisibleChildren();
  const scheduled = visible
    .filter((c) => c.days.includes(todayDow))
    .sort((a, b) => (a.dayTimes?.[todayDow] || '').localeCompare(b.dayTimes?.[todayDow] || ''));
  const scheduledIds = new Set(scheduled.map((c) => c.id));

  // 그날 출석 기록이 이미 있는(보강으로 추가됐던) 대상자는 새로고침 후에도 계속 보이도록 유지
  Object.keys(data.attendance[key]).forEach((cid) => {
    if (!scheduledIds.has(cid) && !extraIds.includes(cid) && visible.some((c) => c.id === cid)) {
      extraIds.push(cid);
    }
  });

  const extraChildren = extraIds.map((cid) => visible.find((c) => c.id === cid)).filter(Boolean);
  const todayChildren = [...scheduled, ...extraChildren];

  const list = document.getElementById('attendanceList');
  const empty = document.getElementById('attendanceEmpty');
  const makeupSelect = document.getElementById('makeupChildSelect');

  const todayIds = new Set(todayChildren.map((c) => c.id));
  const makeupOptions = visible
    .filter((c) => !todayIds.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  makeupSelect.innerHTML =
    '<option value="">+ 보강 인원 추가</option>' +
    makeupOptions.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  makeupSelect.value = '';
  makeupSelect.onchange = () => {
    const cid = makeupSelect.value;
    if (!cid) return;
    extraChildIdsByDate[key].push(cid);
    renderAttendance();
  };

  if (!todayChildren.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = todayChildren
    .map((c) => {
      const record = data.attendance[key][c.id] || { status: '', reason: '' };
      const isAbsent = record.status === 'absent';
      const isMakeup = !scheduledIds.has(c.id);
      return `
      <div class="card" data-child="${c.id}">
        <div class="child-name">${esc(c.name)}${isMakeup ? ' <span class="badge makeup-badge">보강</span>' : ''}</div>
        <div class="child-meta">${(c.dayTimes?.[todayDow] || '').slice(0, 5)} · ${esc(c.teacher)} · ${SUBJECTS[c.subject]?.label}</div>
        <div class="attendance-row" style="margin-top:.75rem">
          <div class="status-btns">
            <button class="status-btn ${record.status === 'present' ? 'active-present' : ''}" data-status="present">출석</button>
            <button class="status-btn ${record.status === 'absent' ? 'active-absent' : ''}" data-status="absent">결석</button>
          </div>
          <input class="absence-reason" placeholder="결석 사유" value="${esc(record.reason)}"
            ${isAbsent ? '' : 'disabled'}>
          ${isMakeup ? '<button type="button" class="btn btn-sm btn-danger remove-makeup">제외</button>' : ''}
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

    card.querySelector('.remove-makeup')?.addEventListener('click', async () => {
      if (data.attendance[key][cid]) {
        if (!confirm('이미 체크된 출석 기록도 함께 삭제할까요?')) return;
        const { error } = await supabaseClient.from('attendance').delete().eq('child_id', cid).eq('date', key);
        if (error) {
          console.error(error);
          alert('삭제 중 오류가 발생했습니다.');
          return;
        }
        delete data.attendance[key][cid];
      }
      extraChildIdsByDate[key] = extraChildIdsByDate[key].filter((id) => id !== cid);
      renderAttendance();
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
      additionalDepositDate: '',
      additionalAmount: null,
      additionalPaid: false,
      additionalPaymentMethod: '',
      copayDepositDate: '',
      copayAmount: null,
      copayPaid: false,
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
      additional_amount: rec.additionalAmount ?? null,
      additional_paid: rec.additionalPaid || false,
      additional_payment_method: rec.additionalPaymentMethod || null,
      copay_deposit_date: rec.copayDepositDate || null,
      copay_amount: rec.copayAmount ?? null,
      copay_paid: rec.copayPaid || false,
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
  const checkboxWrap = document.getElementById('feesChildCheckboxes');
  const allChildren = getVisibleChildren();

  if (!allChildren.length) {
    checkboxWrap.innerHTML = '';
    list.innerHTML = '<p class="empty-msg">등록된 대상자가 없습니다.</p>';
    return;
  }

  checkboxWrap.innerHTML = allChildren
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .map(
      (c) => `
      <label class="day-check">
        <input type="checkbox" class="fees-child-checkbox" value="${c.id}" ${feesExcludedIds.has(c.id) ? '' : 'checked'}>
        ${esc(c.name)}
      </label>`
    )
    .join('');
  checkboxWrap.querySelectorAll('.fees-child-checkbox').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) feesExcludedIds.delete(cb.value);
      else feesExcludedIds.add(cb.value);
      renderFees();
    });
  });

  const children = allChildren.filter((c) => !feesExcludedIds.has(c.id));

  if (!children.length) {
    list.innerHTML = '<p class="empty-msg">선택된 대상자가 없습니다. 위에서 대상자를 선택해 주세요.</p>';
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
      if (fee.additionalPayment !== 0) {
        const isNegative = fee.additionalPayment < 0;
        paymentRows.push(`
          <tr>
            <td>추가납부액</td>
            <td class="amount amount-strong${isNegative ? ' amount-negative' : ''}">${formatCurrency(fee.additionalPayment)}</td>
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
        <div class="child-name child-name-link" data-history="${c.id}">${esc(c.name)}</div>
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
            <input type="number" class="additional-amount" value="${feeRec.additionalAmount ?? fee.additionalPayment}" placeholder="추가납부액">
            <select class="additional-method">
              <option value="">결제 수단</option>
              ${Object.entries(PAYMENT_METHODS)
                .map(([k, v]) => `<option value="${k}" ${feeRec.additionalPaymentMethod === k ? 'selected' : ''}>${v}</option>`)
                .join('')}
            </select>
            <label class="paid-check">
              <input type="checkbox" class="additional-paid" ${feeRec.additionalPaid ? 'checked' : ''}>
              납부 확인
            </label>
          </div>
          ${showCopay && fee.copay > 0 ? `
          <div class="fee-input-row">
            <label>본인부담금 입금일</label>
            <input type="date" class="copay-date" value="${feeRec.copayDepositDate || ''}">
            <input type="number" class="copay-amount" value="${feeRec.copayAmount ?? fee.copay}" placeholder="본인부담금">
            <label class="paid-check">
              <input type="checkbox" class="copay-paid" ${feeRec.copayPaid ? 'checked' : ''}>
              납부 확인
            </label>
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

    card.querySelector('[data-history]')?.addEventListener('click', () => openChildHistoryModal(cid));

    card.querySelector('.session-count')?.addEventListener('change', async (e) => {
      getFeeRecord(cid).sessionCount = Math.max(0, Number(e.target.value) || 0);
      await persistFeeRecord(cid);
      renderFees();
    });

    card.querySelector('.additional-date')?.addEventListener('change', async (e) => {
      getFeeRecord(cid).additionalDepositDate = e.target.value;
      await persistFeeRecord(cid);
    });

    card.querySelector('.additional-amount')?.addEventListener('change', async (e) => {
      getFeeRecord(cid).additionalAmount = Number(e.target.value) || 0;
      await persistFeeRecord(cid);
    });

    card.querySelector('.additional-method')?.addEventListener('change', async (e) => {
      getFeeRecord(cid).additionalPaymentMethod = e.target.value;
      await persistFeeRecord(cid);
    });

    card.querySelector('.additional-paid')?.addEventListener('change', async (e) => {
      getFeeRecord(cid).additionalPaid = e.target.checked;
      await persistFeeRecord(cid);
    });

    card.querySelector('.copay-date')?.addEventListener('change', async (e) => {
      getFeeRecord(cid).copayDepositDate = e.target.value;
      await persistFeeRecord(cid);
    });

    card.querySelector('.copay-amount')?.addEventListener('change', async (e) => {
      getFeeRecord(cid).copayAmount = Number(e.target.value) || 0;
      await persistFeeRecord(cid);
    });

    card.querySelector('.copay-paid')?.addEventListener('change', async (e) => {
      getFeeRecord(cid).copayPaid = e.target.checked;
      await persistFeeRecord(cid);
    });

    card.querySelector('.fee-notes')?.addEventListener('input', (e) => {
      getFeeRecord(cid).notes = e.target.value;
      persistFeeRecordDebounced(cid);
    });
  });
}

function renderSchedule() {
  document.getElementById('scheduleTitle').textContent = `${currentUser?.name || ''} 시간표 (월~토)`;
  const wrap = document.getElementById('scheduleTableWrap');
  const children = getVisibleChildren().filter((c) => c.dayTimes && Object.keys(c.dayTimes).length);
  const scheduleDays = DAYS.slice(1); // 월~토 (일요일 제외)

  if (!children.length) {
    wrap.innerHTML = '<p class="empty-msg">등록된 수업 시간이 없습니다.</p>';
    return;
  }

  const times = [...new Set(children.flatMap((c) => Object.values(c.dayTimes).filter(Boolean)))].sort();

  const rows = times
    .map((t) => {
      const end = addMinutesToTime(t, CLASS_DURATION_MIN);
      const cells = scheduleDays
        .map((d) => {
          const kids = children.filter((c) => c.dayTimes[d.value] === t);
          const content = kids
            .map((c) => {
              const voucherTags = c.paymentTypes?.length
                ? c.paymentTypes
                    .map((pt) => `<span class="voucher-tag voucher-tag-${pt}">${esc(SCHEDULE_VOUCHER_LABELS[pt] || PAYMENT_TYPES[pt] || pt)}</span>`)
                    .join('')
                : `<span class="voucher-tag">${esc(PAYMENT_TYPES.none)}</span>`;
              return `
              <div class="schedule-child">
                ${esc(c.name)}
                <span class="schedule-meta">${voucherTags}</span>
              </div>`;
            })
            .join('');
          const gridClass = kids.length >= 2 ? 'schedule-cell-grid two-col' : 'schedule-cell-grid';
          return `<td><div class="${gridClass}">${content}</div></td>`;
        })
        .join('');
      return `<tr><th>${t.slice(0, 5)}~${end}</th>${cells}</tr>`;
    })
    .join('');

  wrap.innerHTML = `
    <div class="payment-table-wrap">
      <table class="schedule-table">
        <thead><tr><th>시간</th>${scheduleDays.map((d) => `<th>${d.label}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function getPaymentStatus(child, year, month) {
  const mk = monthKey(year, month);
  const feeRec = data.monthlyFees[mk]?.[child.id];
  const sessionCount = feeRec?.sessionCount ?? countSessionsInMonth(year, month, child.days);
  const fee = calculateMonthlyFee(child, sessionCount);

  const needsAdditional = fee.additionalPayment > 0;
  const needsCopay = needsCopayField(child) && fee.copay > 0;
  if (!needsAdditional && !needsCopay) return null;

  const additionalOk = !needsAdditional || !!feeRec?.additionalPaid;
  const copayOk = !needsCopay || !!feeRec?.copayPaid;
  return additionalOk && copayOk ? 'paid' : 'unpaid';
}

function computeMonthlyAttendanceData(year, month) {
  const children = getVisibleChildren();
  const lastDay = new Date(year, month, 0).getDate();
  const dateList = Array.from({ length: lastDay }, (_, i) => i + 1);

  let grandTotal = 0;
  const rows = children.map((c) => {
    let presentCount = 0;
    const cells = dateList.map((d) => {
      const dow = new Date(year, month - 1, d).getDay();
      const isScheduled = c.days.includes(dow);
      const key = dateKey(new Date(year, month - 1, d));
      const record = data.attendance[key]?.[c.id];
      if (!record || !record.status) return { type: isScheduled ? 'empty' : 'noclass' };
      const isMakeup = !isScheduled;
      if (record.status === 'present') {
        presentCount++;
        return { type: 'present', isMakeup };
      }
      return { type: 'absent', reason: record.reason || '', isMakeup };
    });
    grandTotal += presentCount;
    const paymentStatus = getPaymentStatus(c, year, month);
    return { child: c, presentCount, cells, paymentStatus };
  });

  return { rows, dateList, grandTotal };
}

function renderMonthlyAttendance() {
  document.getElementById('attMonthLabel').textContent = `${attViewYear}년 ${attViewMonth}월`;
  const wrap = document.getElementById('monthlyAttendanceTableWrap');
  const { rows, dateList, grandTotal } = computeMonthlyAttendanceData(attViewYear, attViewMonth);

  if (!rows.length) {
    wrap.innerHTML = '<p class="empty-msg">등록된 대상자가 없습니다.</p>';
    return;
  }

  const headerDates = dateList.map((d) => `<th>${d}</th>`).join('');
  const headerDays = dateList
    .map((d) => {
      const dow = new Date(attViewYear, attViewMonth - 1, d).getDay();
      return `<th class="weekday-th">${WEEKDAY_LABELS[dow]}</th>`;
    })
    .join('');

  const bodyRows = rows
    .map(({ child: c, presentCount, cells, paymentStatus }) => {
      const cellsHtml = cells
        .map((cell) => {
          if (cell.type === 'noclass') return '<td class="att-noclass"></td>';
          if (cell.type === 'empty') return '<td class="att-empty">-</td>';
          const makeupMark = cell.isMakeup ? '<br><span class="att-makeup-mark">(보강)</span>' : '';
          if (cell.type === 'present') return `<td class="att-present">출석${makeupMark}</td>`;
          return `<td class="att-absent">결석${cell.reason ? `<br>${esc(cell.reason)}` : ''}${makeupMark}</td>`;
        })
        .join('');
      const badge = paymentStatus === 'unpaid'
        ? '<span class="att-payment-badge unpaid">미납</span>'
        : paymentStatus === 'paid'
          ? '<span class="att-payment-badge paid">납부완료</span>'
          : '';
      return `<tr><th class="att-name">${esc(c.name)}<span class="att-count">(${presentCount}회)</span>${badge}</th>${cellsHtml}</tr>`;
    })
    .join('');

  const totalRow = `<tr class="att-total-row"><th class="att-name">합계<span class="att-count">(${grandTotal}회)</span></th>${dateList.map(() => '<td></td>').join('')}</tr>`;

  wrap.innerHTML = `
    <div class="payment-table-wrap">
      <table class="schedule-table monthly-attendance-table">
        <thead>
          <tr><th>이름</th>${headerDates}</tr>
          <tr><th></th>${headerDays}</tr>
        </thead>
        <tbody>${bodyRows}${totalRow}</tbody>
      </table>
    </div>`;
}

function renderPasswordSettings() {
  if (!isAdmin()) return;
  const list = document.getElementById('passwordList');
  list.innerHTML = data.teachers
    .map(
      (t) => `
    <div class="card password-row" data-teacher="${esc(t.name)}">
      <div class="child-name">${esc(t.name)}${t.isAdmin ? ' <span class="badge">관리자</span>' : ''}</div>
      <div class="password-form">
        <input type="password" class="pw-input" pattern="[0-9]{4}" maxlength="4" inputmode="numeric"
          value="${esc(t.password || DEFAULT_PASSWORD)}" placeholder="4자리">
        <button type="button" class="btn btn-sm btn-primary pw-save">저장</button>
        ${t.name !== currentUser.name ? '<button type="button" class="btn btn-sm btn-danger teacher-delete">삭제</button>' : ''}
      </div>
    </div>`
    )
    .join('');

  list.querySelectorAll('.pw-save').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.password-row');
      const teacherName = row.dataset.teacher;
      const pw = row.querySelector('.pw-input').value;
      if (!/^\d{4}$/.test(pw)) {
        alert('비밀번호는 숫자 4자리여야 합니다.');
        return;
      }

      btn.disabled = true;
      const { error } = await supabaseClient
        .from('teacher_passwords')
        .update({ password: pw })
        .eq('teacher', teacherName);
      btn.disabled = false;

      if (error) {
        console.error(error);
        alert('저장 중 오류가 발생했습니다.');
        return;
      }

      const teacher = data.teachers.find((t) => t.name === teacherName);
      if (teacher) teacher.password = pw;
      alert(`${teacherName} 선생님 비밀번호가 변경되었습니다.`);
    });
  });

  list.querySelectorAll('.teacher-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.password-row');
      const teacherName = row.dataset.teacher;
      const hasChildren = data.children.some((c) => c.teacher === teacherName);
      const confirmMsg = hasChildren
        ? `${teacherName} 선생님을 삭제할까요? 담당하던 대상자 기록은 그대로 남지만, 더 이상 로그인할 수 없게 됩니다.`
        : `${teacherName} 선생님을 삭제할까요?`;
      if (!confirm(confirmMsg)) return;

      btn.disabled = true;
      const { error } = await supabaseClient.from('teacher_passwords').delete().eq('teacher', teacherName);
      btn.disabled = false;

      if (error) {
        console.error(error);
        alert('삭제 중 오류가 발생했습니다.');
        return;
      }

      data.teachers = data.teachers.filter((t) => t.name !== teacherName);
      populateLoginSelect();
      populateFormSelects();
      renderPasswordSettings();
    });
  });
}

init();
