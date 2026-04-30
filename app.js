import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  push,
  update,
  remove,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBewtf3tVFlRh13WOGkk_dVA1DxvZVDp5I",
  authDomain: "al3arbicv.firebaseapp.com",
  databaseURL: "https://al3arbicv-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "al3arbicv",
  storageBucket: "al3arbicv.firebasestorage.app",
  messagingSenderId: "901851337200",
  appId: "1:901851337200:web:27dace691f0e75481c8d35"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);
const root = document.getElementById("app");

const todayIso = () => new Date().toISOString().slice(0, 10);
const state = {
  session: JSON.parse(localStorage.getItem("factory-session") || "null"),
  loginRole: "employee",
  view: "home",
  employees: {},
  announcements: {},
  requests: {},
  attendance: {},
  holidays: {},
  permissions: {},
  settings: {},
  departments: {},
  shifts: {},
  selectedDate: todayIso(),
  sidebarOpen: false
};

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const requestButton = target ? target.closest("[data-request-form]") : null;
  if (requestButton && state.session && state.session.role === "employee") {
    event.preventDefault();
    openRequestForm(requestButton.dataset.requestForm);
  }
  const myRequestsButton = target ? target.closest("[data-open-my-requests]") : null;
  if (myRequestsButton && state.session && state.session.role === "employee") {
    event.preventDefault();
    openMyRequestsModal();
  }
  const cancelRequestButton = target ? target.closest("[data-cancel-request]") : null;
  if (cancelRequestButton && state.session && state.session.role === "employee") {
    cancelPendingRequest(cancelRequestButton.dataset.cancelRequest);
  }
  const deleteRequestButton = target ? target.closest("[data-delete-request]") : null;
  if (deleteRequestButton && canDeleteRequests()) {
    softDeleteRequest(deleteRequestButton.dataset.deleteRequest);
  }
});

window.addEventListener("hashchange", handleHashRoute);

window.openFactoryRequest = (type) => openRequestForm(type);
window.openFactoryMyRequests = () => openMyRequestsModal();
window.factorySetView = (view) => {
  state.view = view;
  state.sidebarOpen = false;
  render();
};
window.factoryLogout = () => clearSession();
window.factoryToggleMenu = () => {
  state.sidebarOpen = !state.sidebarOpen;
  render();
};

function handleHashRoute() {
  const requestMatch = location.hash.match(/^#request-(.+)$/);
  const requestType = requestMatch ? requestMatch[1] : "";
  if (requestType && state.session && state.session.role === "employee") {
    openRequestForm(requestType);
    history.replaceState(null, "", location.pathname + location.search);
  }
}

const requestTypes = [
  { id: "leave", title: "طلب إجازة", icon: "calendar-days" },
  { id: "departure", title: "طلب مغادرة", icon: "clock-arrow-up" },
  { id: "advance", title: "طلب سلفة", icon: "wallet-cards" },
  { id: "complaint", title: "طلب شكوى", icon: "message-square-warning" },
  { id: "resignation", title: "طلب استقالة", icon: "door-open" },
  { id: "custom", title: "طلب مخصص", icon: "clipboard-pen" }
];

const requestTitles = Object.fromEntries(requestTypes.map((item) => [item.id, item.title]));
const statusLabels = {
  all: "الكل",
  pending: "قيد الانتظار",
  approved: "موافق عليه",
  rejected: "مرفوض",
  cancelled: "ملغي",
  deleted: "محذوف"
};

const defaultShifts = {
  morning: { label: "شفت صباحي", start: "07:00", end: "16:00" },
  evening: { label: "شفت مسائي", start: "16:00", end: "01:00" }
};

const defaultSettings = {
  workStart: "07:00",
  workEnd: "16:00",
  overtimeAfter: "16:00",
  overtimeRate: 1.25,
  holidayOvertimeRate: 1.5,
  lateGraceMinutes: 10,
  absenceDeductionDays: 1,
  fridayNoDeduction: true,
  officialHolidayNoDeduction: true
};

const demoDepartments = {
  production: {
    name: "الإنتاج",
    managerId: "1001",
    assistantId: "",
    employeeIds: { "1001": true }
  },
  maintenance: {
    name: "الصيانة",
    managerId: "1002",
    assistantId: "",
    employeeIds: { "1002": true }
  }
};

const demoEmployees = {
  "1001": {
    id: "1001",
    password: "1234",
    role: "employee",
    fullName: "أحمد محمود سالم الحديدي",
    birthDate: "1992-06-18",
    hireDate: "2021-03-01",
    nationality: "أردني",
    contractEnd: "2027-12-31",
    previousLeave: 4,
    newLeave: 21,
    usedLeave: 3,
    jobTitle: "مشرف إنتاج",
    department: "الدرفلة",
    shift: "morning",
    phone: "0791234567",
    altPhone: ""
  },
  "1002": {
    id: "1002",
    password: "1234",
    role: "employee",
    fullName: "ليث خالد عبدالرحمن النجار",
    birthDate: "1988-11-04",
    hireDate: "2019-08-12",
    nationality: "أردني",
    contractEnd: "2026-09-30",
    previousLeave: 7,
    newLeave: 21,
    usedLeave: 9,
    jobTitle: "فني صيانة",
    department: "الصيانة الميكانيكية",
    shift: "evening",
    phone: "0779876543",
    altPhone: ""
  }
};

const demoAdmins = {
  "9001": {
    id: "9001",
    password: "admin",
    role: "admin",
    fullName: "مدير النظام",
    jobTitle: "مسؤول الموارد البشرية"
  }
};

const demoAnnouncements = {
  welcome: {
    title: "اجتماع السلامة الأسبوعي",
    body: "يرجى الالتزام بحضور اجتماع السلامة في بداية الوردية.",
    type: "public",
    date: todayIso(),
    createdAt: Date.now()
  },
  private1001: {
    title: "تنبيه خاص",
    body: "يرجى مراجعة مكتب شؤون الموظفين قبل نهاية الدوام.",
    type: "private",
    employeeId: "1001",
    date: todayIso(),
    createdAt: Date.now() + 1
  }
};

function buildDemoAttendance() {
  const base = new Date(todayIso());
  const records = {};
  for (let index = 0; index < 14; index += 1) {
    const date = new Date(base);
    date.setDate(base.getDate() - index);
    const iso = date.toISOString().slice(0, 10);
    const weekday = date.getDay();
    const isWeekend = weekday === 5;
    records[iso] = isWeekend
      ? {
          date: iso,
          status: "absent",
          shiftStart: "08:00",
          shiftEnd: "17:00",
          checkIn: "",
          checkOut: "",
          notes: "غياب"
        }
      : {
          date: iso,
          status: index % 4 === 1 ? "late" : "present",
          shiftStart: "08:00",
          shiftEnd: "17:00",
          checkIn: index % 4 === 1 ? "08:24" : "07:55",
          checkOut: "17:05",
          notes: index % 4 === 1 ? "تأخير صباحي" : ""
        };
  }
  return {
    "1001": records,
    "1002": Object.fromEntries(
      Object.entries(records).map(([date, record], index) => [
        date,
        {
          ...record,
          status: index % 5 === 0 ? "absent" : record.status,
          checkIn: index % 5 === 0 ? "" : record.checkIn,
          checkOut: index % 5 === 0 ? "" : record.checkOut,
          notes: index % 5 === 0 ? "غياب بدون تسجيل" : record.notes
        }
      ])
    )
  };
}

function buildDemoHolidays() {
  const date = new Date().getFullYear() + "-05-01";
  const holidays = {};
  holidays[date] = {
    date,
    name: "عيد العمال",
    notes: "عطلة رسمية"
  };
  return holidays;
}

const demoPermissions = {
  productionManager: {
    title: "مدير قسم الإنتاج",
    employeeId: "1001",
    permissions: {
      viewAttendance: true,
      reviewRequests: true,
      manageAnnouncements: false,
      manageEmployees: false,
      manageHolidays: false,
      managePermissions: false,
      manageDepartment: true
    }
  }
};

async function ensureSeedData() {
  const employeesSnap = await get(ref(db, "employees"));
  if (!employeesSnap.exists()) {
    await set(ref(db, "employees"), demoEmployees);
  }
  const adminsSnap = await get(ref(db, "admins"));
  if (!adminsSnap.exists()) {
    await set(ref(db, "admins"), demoAdmins);
  }
  const announcementsSnap = await get(ref(db, "announcements"));
  if (!announcementsSnap.exists()) {
    await set(ref(db, "announcements"), demoAnnouncements);
  }
  const attendanceSnap = await get(ref(db, "attendance"));
  if (!attendanceSnap.exists()) {
    await set(ref(db, "attendance"), buildDemoAttendance());
  }
  const holidaysSnap = await get(ref(db, "holidays"));
  if (!holidaysSnap.exists()) {
    await set(ref(db, "holidays"), buildDemoHolidays());
  }
  const permissionsSnap = await get(ref(db, "permissions"));
  if (!permissionsSnap.exists()) {
    await set(ref(db, "permissions"), demoPermissions);
  }
  const settingsSnap = await get(ref(db, "settings"));
  if (!settingsSnap.exists()) {
    await set(ref(db, "settings"), defaultSettings);
  }
  const departmentsSnap = await get(ref(db, "departments"));
  if (!departmentsSnap.exists()) {
    await set(ref(db, "departments"), demoDepartments);
  }
  const shiftsSnap = await get(ref(db, "shifts"));
  if (!shiftsSnap.exists()) {
    await set(ref(db, "shifts"), defaultShifts);
  }
}

function subscribeData() {
  onValue(ref(db, "employees"), (snap) => {
    state.employees = snap.val() || {};
    render();
  });
  onValue(ref(db, "announcements"), (snap) => {
    state.announcements = snap.val() || {};
    render();
  });
  onValue(ref(db, "requests"), (snap) => {
    state.requests = snap.val() || {};
    render();
  });
  onValue(ref(db, "attendance"), (snap) => {
    state.attendance = snap.val() || {};
    render();
  });
  onValue(ref(db, "holidays"), (snap) => {
    state.holidays = snap.val() || {};
    render();
  });
  onValue(ref(db, "permissions"), (snap) => {
    state.permissions = snap.val() || {};
    render();
  });
  onValue(ref(db, "settings"), (snap) => {
    state.settings = { ...defaultSettings, ...(snap.val() || {}) };
    render();
  });
  onValue(ref(db, "departments"), (snap) => {
    state.departments = snap.val() || {};
    render();
  });
  onValue(ref(db, "shifts"), (snap) => {
    state.shifts = snap.val() || defaultShifts;
    render();
  });
}

function setSession(session) {
  state.session = session;
  localStorage.setItem("factory-session", JSON.stringify(session));
  state.view = session.role === "admin" ? "admin-dashboard" : "home";
  render();
}

function clearSession() {
  localStorage.removeItem("factory-session");
  state.session = null;
  state.view = "home";
  render();
}

function hydrateIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function money(value) {
  return new Intl.NumberFormat("ar-JO", { style: "currency", currency: "JOD" }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "غير محدد";
  return new Intl.DateTimeFormat("ar-JO", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return formatDate(todayIso());
  return new Intl.DateTimeFormat("ar-JO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function leaveBalance(employee) {
  return Number(employee.previousLeave || 0) + Number(employee.newLeave || 0) - Number(employee.usedLeave || 0);
}

function toast(message, type = "success") {
  const oldToast = document.querySelector(".toast");
  if (oldToast) oldToast.remove();
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function render() {
  if (!state.session) {
    root.innerHTML = renderLogin();
    bindLogin();
  } else if (state.session.role === "admin") {
    root.innerHTML = renderAdminApp();
    bindAdmin();
  } else {
    root.innerHTML = renderEmployeeApp();
    bindEmployee();
  }
  hydrateIcons();
}

function renderLogin() {
  return `
    <main class="login-shell">
      <section class="login-panel">
        <div class="brand-mark"><i data-lucide="factory"></i><span>إدارة مصنع الحديد</span></div>
        <div class="login-tabs">
          <button class="${state.loginRole === "employee" ? "active" : ""}" data-login-role="employee">واجهة الموظف</button>
          <button class="${state.loginRole === "admin" ? "active" : ""}" data-login-role="admin">واجهة المسؤول</button>
        </div>
        <form id="login-form" class="grid">
          <div class="field">
            <label for="employee-id">رقم الموظف</label>
            <input id="employee-id" required autocomplete="username" value="${state.loginRole === "admin" ? "9001" : "1001"}" />
          </div>
          <div class="field">
            <label for="password">كلمة السر</label>
            <input id="password" type="password" required autocomplete="current-password" value="${state.loginRole === "admin" ? "admin" : "1234"}" />
          </div>
          <button class="primary-button" type="submit"><i data-lucide="log-in"></i>دخول</button>
          <p class="hint">بيانات تجريبية: الموظف 1001 / 1234، المسؤول 9001 / admin.</p>
        </form>
      </section>
      <section class="factory-hero">
        <div>
          <h1>نظام تشغيل إداري لمصنع حديد كبير</h1>
          <p>طلبات الموظفين، الإعلانات، الملفات الشخصية، والاعتمادات الإدارية في واجهة واحدة مترابطة مع Firebase.</p>
        </div>
      </section>
    </main>
  `;
}

function bindLogin() {
  document.querySelectorAll("[data-login-role]").forEach((button) => {
    button.addEventListener("click", () => {
      state.loginRole = button.dataset.loginRole;
      render();
    });
  });
  document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = document.getElementById("employee-id").value.trim();
    const password = document.getElementById("password").value;
    const collection = state.loginRole === "admin" ? "admins" : "employees";
    const snap = await get(ref(db, `${collection}/${id}`));
    const user = snap.val();
    if (!user || user.password !== password) {
      toast("رقم الموظف أو كلمة السر غير صحيحة", "error");
      return;
    }
    if (state.loginRole === "employee") {
      state.employees[id] = { id, ...user };
    }
    setSession({ id, role: state.loginRole, user: { id, ...user } });
  });
}

function renderShell(title, subtitle, nav, body) {
  const user = currentUser();
  return `
    <main class="app-shell ${state.sidebarOpen ? "menu-open" : ""}">
      <aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
        <div class="brand-mark"><i data-lucide="factory"></i><span>مصنع الحديد</span></div>
        <div class="user-chip">
          <strong>${user.fullName || "مستخدم النظام"}</strong>
          <span>${userRoleLine(user)}</span>
        </div>
        <nav class="nav">${nav}</nav>
        <button class="logout-button" data-logout onclick="window.factoryLogout()"><i data-lucide="log-out"></i>تسجيل الخروج</button>
      </aside>
      <section class="content">
        <header class="topbar">
          <button class="icon-button menu-toggle" onclick="window.factoryToggleMenu()" aria-label="${state.sidebarOpen ? "إغلاق القائمة" : "فتح القائمة"}">
            <i data-lucide="${state.sidebarOpen ? "panel-right-close" : "menu"}"></i>
          </button>
          <div>
            <h1>${title}</h1>
            <p>${subtitle}</p>
          </div>
          <div class="hint">اليوم: ${formatDate(todayIso())}</div>
        </header>
        ${body}
      </section>
    </main>
  `;
}

function currentUser() {
  if (!state.session) return {};
  return state.session.role === "admin"
    ? state.session.user || demoAdmins[state.session.id] || { id: state.session.id, fullName: "مسؤول النظام" }
    : state.employees[state.session.id] || state.session.user || {};
}

function userRoleLine(user) {
  if (state.session && state.session.role === "admin") {
    return user.jobTitle || "مسؤول";
  }
  const department = getEmployeeDepartment(user.id).name;
  return [user.jobTitle || "موظف", department].filter(Boolean).join(" - ");
}

function rolesForEmployee(employeeId) {
  return Object.entries(state.permissions)
    .map(([id, role]) => ({ id, ...role }))
    .filter((role) => role.employeeId === employeeId);
}

function employeeHasPermission(permissionName) {
  const user = currentUser();
  return rolesForEmployee(user.id).some((role) => role.permissions && role.permissions[permissionName]);
}

function canDeleteRequests() {
  return state.session && (state.session.role === "admin" || employeeHasPermission("deleteRequests"));
}

function manageableDepartmentIds(employeeId = currentUser().id) {
  const roleDepartments = rolesForEmployee(employeeId)
    .filter((role) => role.permissions && role.permissions.manageDepartment)
    .map((role) => role.departmentId)
    .filter(Boolean);
  const managedDepartments = Object.entries(state.departments)
    .filter(([, department]) => department.managerId === employeeId || department.assistantId === employeeId)
    .map(([id]) => id);
  return [...new Set([...roleDepartments, ...managedDepartments])];
}

function departmentEmployeeIds(departmentId) {
  return Object.keys((state.departments[departmentId] && state.departments[departmentId].employeeIds) || {});
}

function employeeNav() {
  const items = [
    ["home", "layout-dashboard", "الرئيسية"],
    ["profile", "user-round", "الملف الشخصي"],
    ["requests", "clipboard-list", "الطلبات"],
    ["attendance", "calendar-clock", "الحضور والانصراف"],
    ["portal", "key-round", "بوابة الموظف"]
  ];
  if (employeeHasPermission("manageDepartment")) {
    items.splice(4, 0, ["department-management", "briefcase-business", "إدارة قسمي"]);
  }
  return items
    .map(([view, icon, label]) => `<button class="${state.view === view ? "active" : ""}" data-view="${view}" onclick="window.factorySetView('${view}')"><i data-lucide="${icon}"></i>${label}</button>`)
    .join("");
}

function adminNav() {
  const items = [
    ["admin-dashboard", "chart-no-axes-combined", "لوحة التحكم"],
    ["admin-requests", "clipboard-check", "طلبات الموظفين"],
    ["admin-attendance", "calendar-clock", "تقارير الدوام"],
    ["admin-work-settings", "settings-2", "إعدادات الدوام"],
    ["admin-shifts", "calendar-range", "إدارة الشفتات"],
    ["admin-departments", "building-2", "الأقسام"],
    ["admin-holidays", "calendar-x", "العطل الرسمية"],
    ["admin-permissions", "shield-check", "الصلاحيات"],
    ["admin-announcements", "megaphone", "الإعلانات"],
    ["admin-employees", "users-round", "الموظفون"]
  ];
  return items
    .map(([view, icon, label]) => `<button class="${state.view === view ? "active" : ""}" data-view="${view}" onclick="window.factorySetView('${view}')"><i data-lucide="${icon}"></i>${label}</button>`)
    .join("");
}

function renderEmployeeApp() {
  const titles = {
    home: ["الرئيسية", "إعلانات الإدارة حسب التاريخ المحدد"],
    profile: ["الملف الشخصي", "بياناتك الشخصية والوظيفية ورصيد الإجازات"],
    requests: ["الطلبات", "تقديم ومتابعة الطلبات الإدارية"],
    attendance: ["الحضور والانصراف", "سجل حضورك وانصرافك وحالة أيام الدوام"],
    "department-management": ["إدارة قسمي", "متابعة موظفي القسم والطلبات والتنبيهات حسب الصلاحيات"],
    portal: ["بوابة الموظف", "إعدادات الحساب وكلمة السر"]
  };
  const [title, subtitle] = titles[state.view] || titles.home;
  const bodyRenderer = {
    home: renderEmployeeHome,
    profile: renderProfile,
    requests: renderRequests,
    attendance: renderEmployeeAttendance,
    "department-management": renderDepartmentManagement,
    portal: renderPortal
  }[state.view] || renderEmployeeHome;
  const body = bodyRenderer();
  return renderShell(title, subtitle, employeeNav(), body);
}

function renderEmployeeHome() {
  const user = currentUser();
  const todayRecord = state.attendance[user.id] && state.attendance[user.id][todayIso()] ? state.attendance[user.id][todayIso()] : {};
  const holiday = state.holidays[todayIso()];

  return `
    <section class="section attendance-punch">
      <div class="section-header">
        <div>
          <h2>الحضور والانصراف</h2>
          <p class="live-clock" data-live-clock>${formatDate(todayIso())} - ${new Date().toLocaleTimeString("ar-JO")}</p>
        </div>
        <span class="attendance-pill ${holiday ? "holiday" : (todayRecord.status || "none")}">${holiday ? "عطلة رسمية" : attendanceStatusLabel(todayRecord.status)}</span>
      </div>
      <div class="grid four">
        ${infoItem("الشفت", shiftLabel(user.shift))}
        ${infoItem("وقت الحضور", todayRecord.checkIn || "لم يتم التسجيل")}
        ${infoItem("وقت الانصراف", todayRecord.checkOut || "لم يتم التسجيل")}
        ${infoItem("الساعات المحتسبة", todayRecord.checkIn && todayRecord.checkOut ? `${calculatePayableHours(todayRecord).payableHours} ساعة` : "تظهر بعد الانصراف")}
      </div>
      <div class="actions" style="margin-top:16px">
        <button class="primary-button" data-attendance-action="checkIn"><i data-lucide="log-in"></i>تسجيل حضور</button>
        <button class="secondary-button" data-attendance-action="checkOut"><i data-lucide="log-out"></i>تسجيل انصراف</button>
      </div>
    </section>
  `;
}

function renderAnnouncement(item) {
  const isPrivate = item.type === "private";
  const meta = item.publisherName || item.publishedByName
    ? `نشر بواسطة ${item.publisherName || item.publishedByName} - ${formatDateTime(item.createdAt || item.publishedAt)}`
    : formatDate(item.date);
  return `
    <article class="announcement ${isPrivate ? "private" : "public"}">
      <span class="badge-icon"><i data-lucide="${isPrivate ? "triangle-alert" : "megaphone"}"></i></span>
      <h3>${isPrivate ? "تنبيه خاص: " : "إعلان عام: "}${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.body)}</p>
      <p class="hint">${meta}</p>
    </article>
  `;
}

function renderProfile() {
  const employee = currentUser();
  return `
    <section class="section">
      <div class="section-header"><h2>المعلومات الشخصية</h2></div>
      <div class="info-list">
        ${infoItem("اسم الموظف الرباعي", employee.fullName)}
        ${infoItem("تاريخ الميلاد", formatDate(employee.birthDate))}
        ${infoItem("تاريخ التعيين", formatDate(employee.hireDate))}
        ${infoItem("الجنسية", employee.nationality)}
        ${infoItem("تاريخ انتهاء العقد", formatDate(employee.contractEnd))}
      </div>
    </section>
    <section class="section">
      <div class="section-header"><h2>رصيد الإجازات</h2></div>
      <div class="grid four">
        ${infoItem("الرصيد السابق", employee.previousLeave || 0)}
        ${infoItem("الرصيد الجديد", employee.newLeave || 0)}
        ${infoItem("الأيام المستهلكة", employee.usedLeave || 0)}
        ${infoItem("الرصيد حتى تاريخ اليوم", leaveBalance(employee))}
      </div>
    </section>
    <section class="section">
      <div class="section-header"><h2>معلومات العمل</h2></div>
      <div class="info-list">
        ${infoItem("المسمى الوظيفي", employee.jobTitle)}
        ${infoItem("القسم", getEmployeeDepartment(employee.id).name || "غير موزع")}
        ${infoItem("الشفت", shiftLabel(employee.shift))}
      </div>
    </section>
    <section class="section">
      <div class="section-header"><h2>معلومات الاتصال</h2></div>
      <form id="contact-form" class="grid two">
        <div class="field">
          <label>رقم هاتف أردني</label>
          <input name="phone" value="${employee.phone || ""}" required placeholder="07XXXXXXXX" />
        </div>
        <div class="field">
          <label>رقم هاتف بديل</label>
          <input name="altPhone" value="${employee.altPhone || ""}" placeholder="اختياري" />
        </div>
        <button class="primary-button" type="submit"><i data-lucide="save"></i>حفظ بيانات الاتصال</button>
      </form>
    </section>
  `;
}

function infoItem(label, value) {
  return `<div class="info-item"><span>${label}</span><strong>${escapeHtml(String(value !== undefined && value !== null ? value : "غير محدد"))}</strong></div>`;
}

function renderRequests() {
  return `
    <section class="section">
      <div class="section-header">
        <h2>متابعة الطلبات</h2>
        <button class="secondary-button" data-open-my-requests><i data-lucide="search"></i>طلباتي</button>
      </div>
      <div class="request-grid">
        ${requestTypes.map((item) => `
          <a class="request-tile" href="#request-${item.id}" data-request-form="${item.id}">
            <i data-lucide="${item.icon}"></i>
            <span>${item.title}</span>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

function renderEmployeeAttendance() {
  const employee = currentUser();
  const records = attendanceRecordsFor(employee.id);
  const todayRecord = state.attendance[employee.id] && state.attendance[employee.id][todayIso()] ? state.attendance[employee.id][todayIso()] : {};
  return `
    <section class="section">
      <div class="section-header">
        <h2>تسجيل اليوم</h2>
        <span class="attendance-pill ${todayRecord.status || "none"}">${attendanceStatusLabel(todayRecord.status)}</span>
      </div>
      <div class="grid two">
        ${infoItem("الشفت الحالي", shiftLabel(employee.shift))}
        ${infoItem("بداية الدوام", todayRecord.shiftStart || getEmployeeShift(employee.id).start)}
        ${infoItem("نهاية الدوام", todayRecord.shiftEnd || getEmployeeShift(employee.id).end)}
        ${infoItem("وقت الحضور", todayRecord.checkIn || "لم يتم التسجيل")}
        ${infoItem("وقت الانصراف", todayRecord.checkOut || "لم يتم التسجيل")}
      </div>
      <div class="actions" style="margin-top:16px">
        <button class="primary-button" data-attendance-action="checkIn"><i data-lucide="log-in"></i>تسجيل حضور</button>
        <button class="secondary-button" data-attendance-action="checkOut"><i data-lucide="log-out"></i>تسجيل انصراف</button>
      </div>
    </section>
    <section class="section">
      <div class="section-header"><h2>سجل الحضور</h2></div>
      ${renderAttendanceTable(records, false)}
    </section>
  `;
}

function renderDepartmentManagement() {
  const departmentIds = manageableDepartmentIds();
  if (!departmentIds.length) {
    return `<section class="section"><div class="empty">لا توجد أقسام مرتبطة بصلاحياتك الحالية.</div></section>`;
  }
  const activeDepartmentId = sessionStorage.getItem("manager-department") || departmentIds[0];
  const departmentId = departmentIds.includes(activeDepartmentId) ? activeDepartmentId : departmentIds[0];
  const department = state.departments[departmentId] || {};
  const employeeIds = departmentEmployeeIds(departmentId);
  const departmentEmployees = employeeIds.map((id) => state.employees[id]).filter(Boolean);
  const departmentRequests = filterRequests({ status: "all" })
    .filter((request) => employeeIds.includes(request.employeeId));
  const attendanceRows = employeeIds.flatMap((employeeId) =>
    attendanceRecordsFor(employeeId, todayIso().slice(0, 7)).map((record) => normalizeAttendanceRecord({ ...record, employeeId }))
  );
  return `
    <section class="section">
      <div class="section-header">
        <h2>${escapeHtml(department.name || "قسم")}</h2>
        <form id="manager-department-switch" class="toolbar">
          <div class="field">
            <label>القسم</label>
            <select name="departmentId">
              ${departmentIds.map((id) => `<option value="${id}" ${id === departmentId ? "selected" : ""}>${escapeHtml(state.departments[id] && state.departments[id].name ? state.departments[id].name : id)}</option>`).join("")}
            </select>
          </div>
          <button class="secondary-button" type="submit"><i data-lucide="refresh-cw"></i>عرض</button>
        </form>
      </div>
      <div class="metric-strip">
        <div class="metric"><span>موظفو القسم</span><strong>${departmentEmployees.length}</strong></div>
        <div class="metric"><span>طلبات القسم</span><strong>${departmentRequests.length}</strong></div>
        <div class="metric late"><span>تأخير هذا الشهر</span><strong>${attendanceRows.filter((record) => record.status === "late").length}</strong></div>
        <div class="metric absent"><span>غياب هذا الشهر</span><strong>${attendanceRows.filter((record) => record.status === "absent").length}</strong></div>
      </div>
    </section>
    <section class="section">
      <div class="section-header"><h2>إشعار موظفي القسم</h2></div>
      <form id="department-notice-form" class="grid">
        <div class="field"><label>عنوان الإشعار</label><input name="title" required placeholder="تنبيه قسم ${escapeAttr(department.name || "")}" /></div>
        ${textareaField("body", "نص الإشعار", true)}
        <button class="primary-button" type="submit"><i data-lucide="send"></i>إرسال الإشعار</button>
      </form>
    </section>
    <section class="section">
      <div class="section-header"><h2>موظفو القسم</h2></div>
      <div class="info-list">
        ${departmentEmployees.map((employee) => infoItem(employee.id, `${employee.fullName} - ${employee.jobTitle || ""}`)).join("")}
      </div>
    </section>
    <section class="section">
      <div class="section-header"><h2>طلبات القسم</h2></div>
      ${employeeHasPermission("reviewRequests") ? renderRequestsTable(departmentRequests, true) : `<div class="empty">ليست لديك صلاحية مراجعة طلبات القسم.</div>`}
    </section>
    <section class="section">
      <div class="section-header"><h2>دوام القسم هذا الشهر</h2></div>
      ${employeeHasPermission("viewAttendance") ? renderAttendanceTable(attendanceRows.sort((a, b) => String(b.date).localeCompare(String(a.date))), true) : `<div class="empty">ليست لديك صلاحية عرض تقارير الدوام.</div>`}
    </section>
  `;
}

function attendanceRecordsFor(employeeId, month = "") {
  return Object.values(state.attendance[employeeId] || {})
    .filter((record) => !month || String(record.date || "").startsWith(month))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function normalizeAttendanceRecord(record) {
  const shift = getEmployeeShift(record.employeeId);
  const normalized = {
    ...record,
    shiftStart: record.shiftStart || shift.start,
    shiftEnd: record.shiftEnd || shift.end
  };
  if (isNoDeductionDay(normalized.date) && !normalized.checkIn && !normalized.checkOut) {
    return { ...normalized, status: "holiday", notes: normalized.notes || "يوم لا يخصم" };
  }
  if (!normalized.checkIn && !normalized.checkOut && !isNoDeductionDay(normalized.date)) {
    return { ...normalized, status: "absent" };
  }
  if (normalized.checkIn) {
    return { ...normalized, status: isLateTime(normalized.checkIn, normalized.shiftStart) ? "late" : "present" };
  }
  return normalized;
}

function renderAttendanceTable(records, adminMode) {
  const normalizedRecords = records.map(normalizeAttendanceRecord);
  if (!normalizedRecords.length) return `<div class="empty">لا توجد سجلات حضور ضمن هذا النطاق.</div>`;
  return `
    <div class="table-wrap">
      <table class="attendance-table">
        <thead>
          <tr>
            ${adminMode ? "<th>الموظف</th>" : ""}
            <th>التاريخ</th>
            <th>الحالة</th>
            <th>بداية الدوام</th>
            <th>نهاية الدوام</th>
            <th>الحضور</th>
            <th>الانصراف</th>
            <th>الساعات المحتسبة</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${normalizedRecords.map((record) => `
            <tr class="attendance-row ${attendanceRowClass(record)}">
              ${adminMode ? `<td>${escapeHtml(employeeName(record.employeeId))}</td>` : ""}
              <td>${formatDate(record.date)}</td>
              <td><span class="attendance-pill ${attendanceRowClass(record)}">${attendanceStatusLabel(record.status, record.date)}</span></td>
              <td>${record.shiftStart || "08:00"}</td>
              <td>${record.shiftEnd || "17:00"}</td>
              <td>${record.checkIn || "-"}</td>
              <td>${record.checkOut || "-"}</td>
              <td>${record.checkIn && record.checkOut ? calculatePayableHours(record).payableHours : "-"}</td>
              <td>${escapeHtml(record.notes || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function attendanceRowClass(record) {
  return isOfficialHoliday(record.date) || record.status === "holiday" ? "holiday" : (record.status || "present");
}

function attendanceStatusLabel(status, date = "") {
  if ((date && isOfficialHoliday(date)) || status === "holiday") return "عطلة رسمية";
  return {
    present: "حاضر",
    late: "متأخر",
    absent: "غائب",
    none: "لم يسجل"
  }[status || "none"] || "لم يسجل";
}

function isOfficialHoliday(date) {
  return Boolean(state.holidays[date]);
}

function isFriday(date) {
  return new Date(date).getDay() === 5;
}

function isNoDeductionDay(date) {
  const settings = getSettings();
  return (settings.fridayNoDeduction && isFriday(date)) || (settings.officialHolidayNoDeduction && isOfficialHoliday(date));
}

function getSettings() {
  return { ...defaultSettings, ...(state.settings || {}) };
}

function shiftLabel(shiftId = "morning") {
  const allShifts = getShifts();
  return allShifts[shiftId] ? allShifts[shiftId].label : (allShifts.morning ? allShifts.morning.label : "شفت");
}

function getEmployeeShift(employeeId) {
  const employee = state.employees[employeeId] || currentUser();
  const allShifts = getShifts();
  return allShifts[employee.shift || "morning"] || allShifts.morning || defaultShifts.morning;
}

function getShifts() {
  return Object.keys(state.shifts || {}).length ? state.shifts : defaultShifts;
}

function calculatePayableHours(record) {
  const settings = getSettings();
  const actual = durationHours(record.checkIn, record.checkOut);
  if (isOfficialHoliday(record.date)) {
    return { actualHours: actual, payableHours: roundHours(actual * Number(settings.holidayOvertimeRate || 1.5)) };
  }
  const shiftStart = record.shiftStart || settings.workStart;
  const shiftEnd = record.shiftEnd || settings.workEnd;
  const regular = overlapHours(record.checkIn, record.checkOut, shiftStart, shiftEnd);
  const overtime = Math.max(0, actual - regular);
  return { actualHours: actual, payableHours: roundHours(regular + overtime * Number(settings.overtimeRate || 1.25)) };
}

function durationHours(start, end) {
  const startMinutes = timeToMinutes(start);
  let endMinutes = timeToMinutes(end);
  if (endMinutes < startMinutes) endMinutes += 24 * 60;
  return Math.max(0, (endMinutes - startMinutes) / 60);
}

function overlapHours(start, end, shiftStart, shiftEnd) {
  const startMinutes = timeToMinutes(start);
  let endMinutes = timeToMinutes(end);
  if (endMinutes < startMinutes) endMinutes += 24 * 60;
  const shiftStartMinutes = normalizeShiftMinute(timeToMinutes(shiftStart), startMinutes);
  let shiftEndMinutes = normalizeShiftMinute(timeToMinutes(shiftEnd), shiftStartMinutes);
  if (shiftEndMinutes <= shiftStartMinutes) shiftEndMinutes += 24 * 60;
  const overlap = Math.max(0, Math.min(endMinutes, shiftEndMinutes) - Math.max(startMinutes, shiftStartMinutes));
  return overlap / 60;
}

function normalizeShiftMinute(value, anchor) {
  if (value + 24 * 60 <= anchor) return value + 24 * 60;
  return value;
}

function roundHours(value) {
  return Math.round(value * 100) / 100;
}

function getCurrentTimeString() {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Amman"
  }).format(new Date());
}

function isLateTime(time, shiftStart = "08:00") {
  return timeToMinutes(time) > timeToMinutes(shiftStart) + Number(getSettings().lateGraceMinutes || 0);
}

function timeToMinutes(value = "00:00") {
  const [hours, minutes] = String(value).split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function renderPortal() {
  return `
    <section class="section">
      <div class="section-header"><h2>تغيير كلمة السر</h2></div>
      <form id="password-form" class="grid two">
        <div class="field">
          <label>كلمة السر الحالية</label>
          <input name="oldPassword" type="password" required />
        </div>
        <div class="field">
          <label>كلمة السر الجديدة</label>
          <input name="newPassword" type="password" required minlength="4" />
        </div>
        <button class="primary-button" type="submit"><i data-lucide="key-round"></i>تحديث كلمة السر</button>
      </form>
    </section>
  `;
}

function bindCommon() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      render();
    });
  });
  const logoutButton = document.querySelector("[data-logout]");
  if (logoutButton) logoutButton.addEventListener("click", clearSession);
}

function bindEmployee() {
  bindCommon();
  startLiveClock();
  const announcementDate = document.getElementById("announcement-date");
  if (announcementDate) announcementDate.addEventListener("change", (event) => {
    state.selectedDate = event.target.value;
    render();
  });
  const contactForm = document.getElementById("contact-form");
  if (contactForm) contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    if (!isJordanPhone(data.phone) && !isJordanPhone(data.altPhone)) {
      toast("يجب إدخال رقم هاتف أردني واحد على الأقل بصيغة 07XXXXXXXX", "error");
      return;
    }
    await update(ref(db, `employees/${state.session.id}`), data);
    toast("تم حفظ بيانات الاتصال");
  });
  const passwordForm = document.getElementById("password-form");
  if (passwordForm) passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    const employee = currentUser();
    if (employee.password !== data.oldPassword) {
      toast("كلمة السر الحالية غير صحيحة", "error");
      return;
    }
    await update(ref(db, `employees/${state.session.id}`), { password: data.newPassword });
    event.target.reset();
    toast("تم تحديث كلمة السر");
  });
  document.querySelectorAll("[data-attendance-action]").forEach((button) => {
    button.addEventListener("click", () => submitAttendanceAction(button.dataset.attendanceAction));
  });
  bindRequestTableActions();
  const managerSwitch = document.getElementById("manager-department-switch");
  if (managerSwitch) managerSwitch.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    sessionStorage.setItem("manager-department", data.departmentId || "");
    render();
  });
  const departmentNoticeForm = document.getElementById("department-notice-form");
  if (departmentNoticeForm) departmentNoticeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const departmentId = sessionStorage.getItem("manager-department") || manageableDepartmentIds()[0];
    const employeeIds = departmentEmployeeIds(departmentId);
    const data = Object.fromEntries(new FormData(event.target).entries());
    try {
      await Promise.all(employeeIds.map((employeeId) => push(ref(db, "announcements"), {
        title: data.title,
        body: data.body,
        type: "private",
        employeeId,
        date: todayIso(),
        createdAt: Date.now(),
        publisherId: state.session.id,
        publisherName: currentUser().fullName || "مستخدم النظام"
      })));
      event.target.reset();
      toast("تم إرسال الإشعار لموظفي القسم");
    } catch (error) {
      console.error(error);
      toast("تعذر إرسال الإشعار", "error");
    }
  });
}

async function submitAttendanceAction(action) {
  const employeeId = state.session.id;
  const date = todayIso();
  const shift = getEmployeeShift(employeeId);
  const current = state.attendance[employeeId] && state.attendance[employeeId][date] ? state.attendance[employeeId][date] : {
    date,
    shiftStart: shift.start,
    shiftEnd: shift.end,
    status: "present",
    notes: ""
  };
  const now = getCurrentTimeString();
  const next = {
    ...current,
    employeeId,
    date,
    shiftStart: current.shiftStart || shift.start,
    shiftEnd: current.shiftEnd || shift.end
  };
  if (action === "checkIn") {
    next.checkIn = now;
    next.status = isLateTime(now, next.shiftStart) ? "late" : "present";
    next.notes = next.status === "late" ? "تأخير في تسجيل الحضور" : (next.notes || "");
  } else {
    next.checkOut = now;
    next.status = next.checkIn && isLateTime(next.checkIn, next.shiftStart) ? "late" : (next.status === "absent" ? "present" : next.status || "present");
  }
  try {
    await set(ref(db, `attendance/${employeeId}/${date}`), next);
    toast(action === "checkIn" ? "تم تسجيل الحضور" : "تم تسجيل الانصراف");
  } catch (error) {
    console.error(error);
    toast("تعذر حفظ سجل الحضور. تحقق من صلاحيات Firebase.", "error");
  }
}

function isJordanPhone(value) {
  return /^07[789]\d{7}$/.test(String(value || "").trim());
}

function startLiveClock() {
  const clock = document.querySelector("[data-live-clock]");
  if (!clock) return;
  const updateClock = () => {
    clock.textContent = `${formatDate(todayIso())} - ${new Date().toLocaleTimeString("ar-JO", { hour12: false })}`;
  };
  updateClock();
  clearInterval(window.factoryClockTimer);
  window.factoryClockTimer = setInterval(updateClock, 1000);
}

function openMyRequestsModal() {
  const employeeId = state.session.id;
  openModal(`
    <h2>طلباتي</h2>
    <form id="my-requests-filter" class="toolbar">
      <div class="field">
        <label>السنة</label>
        <select name="year">
          <option value="2026">2026</option>
          <option value="2027">2027</option>
        </select>
      </div>
      <div class="field">
        <label>حالة الطلب</label>
        <select name="status">
          ${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
        </select>
      </div>
      <button class="primary-button" type="submit"><i data-lucide="table"></i>عرض النتائج</button>
    </form>
    <div id="my-requests-results">${renderRequestsTable(filterRequests({ employeeId, year: "2026", status: "all" }), false)}</div>
  `);
  document.getElementById("my-requests-filter").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    document.getElementById("my-requests-results").innerHTML = renderRequestsTable(filterRequests({ employeeId, ...data }), false);
    hydrateIcons();
  });
}

function filterRequests({ employeeId, year, status }) {
  return Object.entries(state.requests)
    .map(([id, item]) => ({ id, ...item }))
    .filter((item) => !employeeId || item.employeeId === employeeId)
    .filter((item) => !year || String(item.createdAtDate || item.date || "").startsWith(year))
    .filter((item) => status === "all" || !status || item.status === status)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function renderRequestsTable(items, adminMode) {
  if (!items.length) return `<div class="empty">لا توجد طلبات مطابقة.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>التاريخ</th>
            ${adminMode ? "<th>الموظف</th>" : ""}
            <th>نوع الطلب</th>
            <th>الحالة</th>
            <th>عرض</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td>${formatDate(item.createdAtDate || item.date)}</td>
              ${adminMode ? `<td>${escapeHtml(employeeName(item.employeeId))}</td>` : ""}
              <td>${requestTitles[item.type] || item.customName || "طلب"}</td>
              <td><span class="status ${item.deleted ? "deleted" : item.status}">${item.deleted ? statusLabels.deleted : statusLabels[item.status]}</span></td>
              <td><button class="icon-button" title="عرض التفاصيل" data-view-request="${item.id}"><i data-lucide="eye"></i></button></td>
              ${!adminMode ? `<td>${!item.deleted && item.status === "pending" ? `<button class="danger-button" data-cancel-request="${item.id}"><i data-lucide="ban"></i>إلغاء</button>` : ""}</td>` : ""}
              ${adminMode ? `<td>${renderRequestActions(item)}</td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRequestActions(item) {
  if (item.deleted) {
    return `<span class="hint">مقفل بعد الحذف</span>`;
  }
  return `
    <div class="actions">
      <button class="secondary-button" data-status-request="${item.id}" data-status-value="approved"><i data-lucide="check"></i>موافقة</button>
      <button class="danger-button" data-status-request="${item.id}" data-status-value="rejected"><i data-lucide="x"></i>رفض</button>
      <button class="secondary-button" data-status-request="${item.id}" data-status-value="cancelled"><i data-lucide="ban"></i>إلغاء</button>
      ${canDeleteRequests() ? `<button class="danger-button" data-delete-request="${item.id}"><i data-lucide="archive-x"></i>حذف</button>` : ""}
    </div>
  `;
}

function bindRequestTableActions() {
  document.querySelectorAll("[data-view-request]").forEach((button) => {
    button.addEventListener("click", () => openRequestDetails(button.dataset.viewRequest));
  });
  document.querySelectorAll("[data-status-request]").forEach((button) => {
    button.addEventListener("click", () => openStatusModal(button.dataset.statusRequest, button.dataset.statusValue));
  });
  document.querySelectorAll("[data-delete-request]").forEach((button) => {
    button.addEventListener("click", () => softDeleteRequest(button.dataset.deleteRequest));
  });
}

async function cancelPendingRequest(id) {
  const request = state.requests[id];
  if (!request || request.employeeId !== state.session.id || request.status !== "pending") {
    toast("يمكن إلغاء الطلب فقط إذا كان قيد الانتظار", "error");
    return;
  }
  try {
    await update(ref(db, `requests/${id}`), {
      status: "cancelled",
      cancelledAt: Date.now(),
      cancelledBy: state.session.id
    });
    toast("تم إلغاء الطلب");
    const results = document.getElementById("my-requests-results");
    if (results) {
      results.innerHTML = renderRequestsTable(filterRequests({ employeeId: state.session.id, year: "2026", status: "all" }), false);
      hydrateIcons();
    }
  } catch (error) {
    console.error(error);
    toast("تعذر إلغاء الطلب", "error");
  }
}

async function softDeleteRequest(id) {
  const request = state.requests[id];
  if (!request) {
    toast("الطلب غير موجود", "error");
    return;
  }
  if (!canDeleteRequests()) {
    toast("لا تملك صلاحية حذف الطلبات", "error");
    return;
  }
  if (request.deleted) {
    toast("هذا الطلب محذوف ومقفل مسبقًا", "error");
    return;
  }
  try {
    await update(ref(db, `requests/${id}`), {
      deleted: true,
      locked: true,
      status: "deleted",
      deletedAt: Date.now(),
      deletedBy: state.session.id
    });
    toast("تم حذف الطلب وأصبح مقفلًا في السجل");
  } catch (error) {
    console.error(error);
    toast("تعذر حذف الطلب", "error");
  }
}

function openRequestDetails(id) {
  const request = state.requests[id];
  if (!request) return;
  const detailRows = Object.entries(request.details || {})
    .filter(([, value]) => value !== "" && value !== undefined && value !== null)
    .map(([key, value]) => infoItem(detailLabel(key), String(value)))
    .join("");
  openModal(`
    <h2>تفاصيل الطلب</h2>
    <div class="grid two">
      ${infoItem("الموظف", employeeName(request.employeeId))}
      ${infoItem("نوع الطلب", requestTitles[request.type] || request.customName)}
      ${infoItem("الحالة", request.deleted ? statusLabels.deleted : statusLabels[request.status])}
      ${infoItem("تاريخ الإرسال", formatDate(request.createdAtDate))}
    </div>
    <div class="section" style="margin-top:16px">
      <h3>بيانات الطلب</h3>
      <div class="info-list" style="margin-top:12px">${detailRows}</div>
      ${request.attachmentUrl ? `<p><a class="secondary-button" href="${request.attachmentUrl}" target="_blank" rel="noreferrer"><i data-lucide="paperclip"></i>عرض المرفق</a></p>` : ""}
      ${request.adminReason ? `<p class="hint">سبب الإجراء الإداري: ${escapeHtml(request.adminReason)}</p>` : ""}
      ${request.deleted ? `<p class="hint">هذا الطلب محذوف ومقفل ولا يمكن إجراء أي تغيير عليه.</p>` : ""}
    </div>
  `);
}

function detailLabel(key) {
  return {
    startDate: "من تاريخ",
    endDate: "إلى تاريخ",
    leaveType: "نوع الإجازة",
    days: "مدة الإجازة بالأيام",
    notes: "الملاحظات",
    reason: "السبب",
    date: "التاريخ",
    fromTime: "من وقت",
    toTime: "إلى وقت",
    departureType: "نوع المغادرة",
    hours: "مدة المغادرة",
    advanceDate: "تاريخ السلفة",
    deductionStart: "تاريخ بدء الخصم",
    advanceType: "نوع السلفة",
    amount: "المبلغ",
    installments: "عدد الأقساط",
    complaintDate: "تاريخ الشكوى",
    complaintDetails: "تفاصيل الشكوى",
    resignationDate: "تاريخ الاستقالة",
    requestName: "اسم الطلب",
    requestDate: "تاريخ الطلب",
    requestDetails: "تفاصيل الطلب"
  }[key] || key;
}

function openRequestForm(type) {
  const employee = currentUser();
  const title = requestTitles[type];
  openModal(`
    <h2>${title}</h2>
    <form id="request-form" class="grid two" enctype="multipart/form-data">
      ${renderRequestFields(type)}
      <div class="preview-box" style="grid-column: 1 / -1">
        <h3>معاينة الطلب</h3>
        <div id="request-preview">${renderLivePreview(type, {}, employee)}</div>
      </div>
      <button class="primary-button" type="button" data-send-request><i data-lucide="send"></i>إرسال الطلب</button>
    </form>
  `);
  const form = document.getElementById("request-form");
  form.addEventListener("input", () => {
    document.getElementById("request-preview").innerHTML = renderLivePreview(type, Object.fromEntries(new FormData(form).entries()), employee);
  });
  form.addEventListener("submit", (event) => submitRequest(event, type));
  form.querySelector("[data-send-request]").addEventListener("click", () => {
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  });
}

function renderRequestFields(type) {
  if (type === "leave") {
    return `
      ${field("startDate", "date", "موعد الإجازة من", true)}
      ${field("endDate", "date", "موعد الإجازة إلى", true)}
      ${selectField("leaveType", "نوع الإجازة", ["سنوية", "مرضية", "محسومة"], true)}
      ${textareaField("notes", "الملاحظات", false)}
      ${textareaField("reason", "السبب", true)}
    `;
  }
  if (type === "departure") {
    return `
      ${field("date", "date", "تاريخ المغادرة", true)}
      ${field("fromTime", "time", "وقت المغادرة من", true)}
      ${field("toTime", "time", "وقت المغادرة إلى", true)}
      ${selectField("departureType", "نوع المغادرة", ["تأخير صباحي", "مغادرة شخصية", "مغادرة مبكرة", "مغادرة محسومة"], true)}
      ${textareaField("notes", "الملاحظات", false)}
      ${textareaField("reason", "السبب", false)}
    `;
  }
  if (type === "advance") {
    return `
      ${field("advanceDate", "date", "تاريخ السلفة", true)}
      ${field("deductionStart", "date", "تاريخ بدء الخصم", true)}
      ${selectField("advanceType", "نوع السلفة", ["فورية", "سلفة طويلة الأجل"], true)}
      ${field("amount", "number", "مبلغ السلفة", true, "0", "0.01")}
      ${field("installments", "number", "عدد الأقساط", true, "1", "1")}
      ${textareaField("notes", "الملاحظات", false)}
      ${textareaField("reason", "السبب", false)}
    `;
  }
  if (type === "complaint") {
    return `
      ${field("complaintDate", "date", "تاريخ الشكوى", true)}
      ${textareaField("complaintDetails", "تفاصيل الشكوى", true)}
    `;
  }
  if (type === "resignation") {
    return `
      ${field("resignationDate", "date", "تاريخ الاستقالة", true)}
      ${textareaField("reason", "سبب الاستقالة", true)}
    `;
  }
  return `
    ${field("requestName", "text", "اسم الطلب", true)}
    ${field("requestDate", "date", "تاريخ الطلب", true)}
    ${textareaField("requestDetails", "تفاصيل الطلب", true)}
  `;
}

function field(name, type, label, required, min = "", step = "") {
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" ${required ? "required" : ""} ${min ? `min="${min}"` : ""} ${step ? `step="${step}"` : ""} /></div>`;
}

function selectField(name, label, options, required) {
  return `<div class="field"><label>${label}</label><select name="${name}" ${required ? "required" : ""}>${options.map((item) => `<option value="${item}">${item}</option>`).join("")}</select></div>`;
}

function textareaField(name, label, required) {
  return `<div class="field"><label>${label}</label><textarea name="${name}" ${required ? "required" : ""}></textarea></div>`;
}

function renderLivePreview(type, data, employee) {
  const derived = deriveRequestDetails(type, data);
  return `
    <div class="info-list">
      ${infoItem("اسم الموظف", employee.fullName)}
      ${infoItem("نوع الطلب", requestTitles[type] || data.requestName || "طلب")}
      ${Object.entries(derived).filter(([, value]) => value).slice(0, 8).map(([key, value]) => infoItem(detailLabel(key), value)).join("")}
    </div>
  `;
}

function deriveRequestDetails(type, data) {
  const details = { ...data };
  delete details.attachment;
  if (type === "leave" && data.startDate && data.endDate) {
    details.days = String(Math.max(1, Math.round((new Date(data.endDate) - new Date(data.startDate)) / 86400000) + 1));
  }
  if (type === "departure" && data.fromTime && data.toTime) {
    const [fh, fm] = data.fromTime.split(":").map(Number);
    const [th, tm] = data.toTime.split(":").map(Number);
    const minutes = (th * 60 + tm) - (fh * 60 + fm);
    details.hours = minutes > 0 ? `${Math.floor(minutes / 60)} ساعة و ${minutes % 60} دقيقة` : "";
  }
  if (type === "advance" && data.amount) {
    details.amount = money(data.amount);
  }
  return details;
}

async function submitRequest(event, type) {
  event.preventDefault();
  const form = event.target;
  const submitButton = form.querySelector("[data-send-request]");
  if (submitButton && submitButton.disabled) return;
  if (!form.reportValidity()) return;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = `<i data-lucide="loader-circle"></i>جاري الإرسال`;
    hydrateIcons();
  }
  const data = Object.fromEntries(new FormData(form).entries());
  const employee = currentUser();
  try {
    if (type === "leave" && data.leaveType === "سنوية") {
      const days = Number(deriveRequestDetails(type, data).days || 0);
      if (leaveBalance(employee) < days) {
        toast("لا يوجد رصيد إجازات سنوية كاف لهذا الطلب", "error");
        return;
      }
    }
    if (type === "advance" && Number(data.amount || 0) > 100 && !String(data.reason || "").trim()) {
      toast("السبب إجباري إذا كان مبلغ السلفة أكثر من 100", "error");
      return;
    }
    const payload = {
      employeeId: state.session.id,
      employeeName: employee.fullName,
      type,
      customName: data.requestName || "",
      status: "pending",
      details: deriveRequestDetails(type, data),
      attachmentUrl: "",
      createdAt: Date.now(),
      createdAtDate: todayIso()
    };
    await push(ref(db, "requests"), payload);
    closeModal();
    toast("تم إرسال الطلب بنجاح");
  } catch (error) {
    console.error(error);
    toast("تعذر إرسال الطلب. تحقق من اتصال Firebase وصلاحيات قاعدة البيانات.", "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = `<i data-lucide="send"></i>إرسال الطلب`;
      hydrateIcons();
    }
  }
}

function renderAdminApp() {
  const titles = {
    "admin-dashboard": ["لوحة التحكم", "نظرة عامة على الموظفين والطلبات"],
    "admin-requests": ["طلبات الموظفين", "مراجعة الطلبات والموافقة أو الرفض أو الإلغاء"],
    "admin-attendance": ["تقارير الدوام", "متابعة حضور وانصراف الموظفين وتمييز التأخير والغياب"],
    "admin-work-settings": ["إعدادات الدوام", "تحديد ساعات الدوام والإضافي والخصومات وأيام عدم الخصم"],
    "admin-shifts": ["إدارة الشفتات", "إضافة وتعديل الشفتات وعرض الموظفين حسب كل شفت"],
    "admin-departments": ["الأقسام", "تنظيم الموظفين حسب القسم وتحديد المسؤولين والمساعدين"],
    "admin-holidays": ["العطل الرسمية", "إدارة الأيام التي لا تعد غيابًا واحتساب عملها بنسبة 150%"],
    "admin-permissions": ["الصلاحيات", "منح صلاحيات محددة لمديري الأقسام والمستخدمين الإداريين"],
    "admin-announcements": ["الإعلانات", "نشر وإدارة الإعلانات العامة والخاصة"],
    "admin-employees": ["الموظفون", "إضافة وتعديل وحذف بيانات الموظفين"]
  };
  const [title, subtitle] = titles[state.view] || titles["admin-dashboard"];
  const bodyRenderer = {
    "admin-dashboard": renderAdminDashboard,
    "admin-requests": renderAdminRequests,
    "admin-attendance": renderAdminAttendance,
    "admin-work-settings": renderAdminWorkSettings,
    "admin-shifts": renderAdminShifts,
    "admin-departments": renderAdminDepartments,
    "admin-holidays": renderAdminHolidays,
    "admin-permissions": renderAdminPermissions,
    "admin-announcements": renderAdminAnnouncements,
    "admin-employees": renderAdminEmployees
  }[state.view] || renderAdminDashboard;
  const body = bodyRenderer();
  return renderShell(title, subtitle, adminNav(), body);
}

function renderAdminDashboard() {
  const employeesCount = Object.keys(state.employees).length;
  const requests = Object.values(state.requests);
  return `
    <section class="metric-strip">
      <div class="metric"><span>الموظفون</span><strong>${employeesCount}</strong></div>
      <div class="metric"><span>كل الطلبات</span><strong>${requests.length}</strong></div>
      <div class="metric"><span>الموافق عليها</span><strong>${requests.filter((item) => item.status === "approved").length}</strong></div>
      <div class="metric"><span>قيد الانتظار</span><strong>${requests.filter((item) => item.status === "pending").length}</strong></div>
    </section>
  `;
}

function renderAdminRequests() {
  return `
    <section class="section">
      <div class="section-header"><h2>جميع طلبات الموظفين</h2></div>
      ${renderRequestsTable(filterRequests({ status: "all" }), true)}
    </section>
  `;
}

function renderAdminAttendance() {
  const employees = Object.values(state.employees).sort((a, b) => a.id.localeCompare(b.id));
  const selectedEmployeeId = sessionStorage.getItem("attendance-employee") || (employees[0] ? employees[0].id : "") || "";
  const selectedMonth = sessionStorage.getItem("attendance-month") || todayIso().slice(0, 7);
  const records = selectedEmployeeId
    ? attendanceRecordsFor(selectedEmployeeId, selectedMonth).map((record) => normalizeAttendanceRecord({ ...record, employeeId: selectedEmployeeId }))
    : [];
  const presentCount = records.filter((record) => record.status === "present").length;
  const lateCount = records.filter((record) => record.status === "late").length;
  const absentCount = records.filter((record) => record.status === "absent").length;
  return `
    <section class="section">
      <div class="section-header"><h2>فلترة تقرير الدوام</h2></div>
      <form id="attendance-filter-form" class="toolbar">
        <div class="field">
          <label>الموظف</label>
          <select name="employeeId">
            ${employees.map((employee) => `<option value="${employee.id}" ${employee.id === selectedEmployeeId ? "selected" : ""}>${employee.id} - ${escapeHtml(employee.fullName)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>الشهر</label>
          <input name="month" type="month" value="${selectedMonth}" />
        </div>
        <button class="primary-button" type="submit"><i data-lucide="search"></i>عرض التقرير</button>
      </form>
      <div class="metric-strip attendance-summary">
        <div class="metric"><span>أيام الحضور</span><strong>${presentCount}</strong></div>
        <div class="metric late"><span>أيام التأخير</span><strong>${lateCount}</strong></div>
        <div class="metric absent"><span>أيام الغياب</span><strong>${absentCount}</strong></div>
        <div class="metric"><span>إجمالي السجلات</span><strong>${records.length}</strong></div>
      </div>
    </section>
    <section class="section">
      <div class="section-header">
        <h2>تقرير الدوام</h2>
        <button class="secondary-button" data-open-attendance-editor="${selectedEmployeeId}"><i data-lucide="calendar-plus"></i>تسجيل أو تعديل يوم</button>
      </div>
      ${renderAttendanceTable(records, true)}
    </section>
  `;
}

function renderAdminHolidays() {
  const holidays = Object.values(state.holidays).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return `
    <section class="section">
      <div class="section-header"><h2>إضافة عطلة رسمية</h2></div>
      <form id="holiday-form" class="grid two">
        <div class="field"><label>تاريخ العطلة</label><input name="date" type="date" required /></div>
        <div class="field"><label>اسم العطلة</label><input name="name" required placeholder="مثال: عيد العمال" /></div>
        ${textareaField("notes", "ملاحظات", false)}
        <button class="primary-button" type="submit"><i data-lucide="calendar-plus"></i>حفظ العطلة</button>
      </form>
    </section>
    <section class="section">
      <div class="section-header"><h2>العطل المسجلة</h2></div>
      ${holidays.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>التاريخ</th><th>العطلة</th><th>ملاحظات</th><th>إجراءات</th></tr></thead>
            <tbody>
              ${holidays.map((holiday) => `<tr class="attendance-row holiday"><td>${formatDate(holiday.date)}</td><td>${escapeHtml(holiday.name)}</td><td>${escapeHtml(holiday.notes || "")}</td><td><button class="danger-button" data-delete-holiday="${holiday.date}"><i data-lucide="trash-2"></i>حذف</button></td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">لا توجد عطل رسمية مسجلة.</div>`}
    </section>
  `;
}

function renderAdminWorkSettings() {
  const settings = getSettings();
  const allShifts = getShifts();
  return `
    <section class="section">
      <div class="section-header"><h2>قواعد الدوام والإضافي والخصم</h2></div>
      <form id="work-settings-form" class="grid two">
        <div class="field"><label>وقت بدء الدوام الافتراضي</label><input name="workStart" type="time" value="${settings.workStart}" required /></div>
        <div class="field"><label>وقت انتهاء الدوام الافتراضي</label><input name="workEnd" type="time" value="${settings.workEnd}" required /></div>
        <div class="field"><label>بدء احتساب الإضافي بعد</label><input name="overtimeAfter" type="time" value="${settings.overtimeAfter}" required /></div>
        <div class="field"><label>قيمة ساعة الإضافي</label><input name="overtimeRate" type="number" step="0.01" min="1" value="${settings.overtimeRate}" required /></div>
        <div class="field"><label>قيمة ساعة العطلة الرسمية</label><input name="holidayOvertimeRate" type="number" step="0.01" min="1" value="${settings.holidayOvertimeRate}" required /></div>
        <div class="field"><label>سماحية التأخير بالدقائق</label><input name="lateGraceMinutes" type="number" min="0" value="${settings.lateGraceMinutes}" required /></div>
        <div class="field"><label>خصم الغياب بالأيام</label><input name="absenceDeductionDays" type="number" step="0.25" min="0" value="${settings.absenceDeductionDays}" required /></div>
        <label class="check-card"><input type="checkbox" name="fridayNoDeduction" value="true" ${settings.fridayNoDeduction ? "checked" : ""} /><span>يوم الجمعة لا يخصم إذا غاب الموظف</span></label>
        <label class="check-card"><input type="checkbox" name="officialHolidayNoDeduction" value="true" ${settings.officialHolidayNoDeduction ? "checked" : ""} /><span>العطل الرسمية لا تخصم إذا غاب الموظف</span></label>
        <button class="primary-button" type="submit"><i data-lucide="save"></i>حفظ إعدادات الدوام</button>
      </form>
    </section>
    <section class="section">
      <h3>قاعدة الاحتساب الحالية</h3>
      <p class="hint">الإضافي العادي = ${settings.overtimeRate} لكل ساعة، والعمل في العطل الرسمية = ${settings.holidayOvertimeRate} لكل ساعة. خصم الغياب = ${settings.absenceDeductionDays} يوم، مع استثناء الأيام المحددة أعلاه.</p>
    </section>
    <section class="section">
      <div class="section-header"><h2>أوقات الدوام حسب الشفت</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>الشفت</th><th>البداية</th><th>النهاية</th><th>بدء الإضافي</th></tr></thead>
          <tbody>
            ${Object.values(allShifts).map((shift) => `<tr><td>${escapeHtml(shift.label)}</td><td>${shift.start}</td><td>${shift.end}</td><td>${shift.overtimeAfter || shift.end}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAdminShifts() {
  const allShifts = Object.entries(getShifts()).map(([id, shift]) => ({ id, ...shift }));
  return `
    <section class="section">
      <div class="section-header"><h2>إضافة أو تعديل شفت</h2></div>
      <form id="shift-form" class="grid two">
        <div class="field"><label>معرف الشفت</label><input name="id" required placeholder="morning" /></div>
        <div class="field"><label>اسم الشفت</label><input name="label" required placeholder="شفت صباحي" /></div>
        <div class="field"><label>وقت البداية</label><input name="start" type="time" required /></div>
        <div class="field"><label>وقت النهاية</label><input name="end" type="time" required /></div>
        <div class="field"><label>بدء الإضافي</label><input name="overtimeAfter" type="time" /></div>
        <button class="primary-button" type="submit"><i data-lucide="save"></i>حفظ الشفت</button>
      </form>
    </section>
    <section class="section">
      <div class="section-header"><h2>الشفتات الحالية</h2></div>
      <div class="grid two">
        ${allShifts.map((shift) => {
          const employees = Object.values(state.employees).filter((employee) => (employee.shift || "morning") === shift.id);
          return `
            <div class="info-item shift-card">
              <span>${escapeHtml(shift.label)}</span>
              <strong>${shift.start} - ${shift.end}</strong>
              <p class="hint">بدء الإضافي: ${shift.overtimeAfter || shift.end}</p>
              <div class="inline-list">${employees.length ? employees.map((employee) => `<span class="inline-chip">${escapeHtml(employee.fullName)}</span>`).join("") : `<span class="hint">لا يوجد موظفون</span>`}</div>
              <div class="actions" style="margin-top:12px">
                <button class="secondary-button" data-edit-shift="${shift.id}"><i data-lucide="pencil"></i>تعديل</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderAdminDepartments() {
  const employees = Object.values(state.employees).sort((a, b) => a.id.localeCompare(b.id));
  const departments = Object.entries(state.departments).map(([id, department]) => ({ id, ...department }));
  const editingDepartmentId = sessionStorage.getItem("editing-department") || "";
  const editingDepartment = editingDepartmentId ? state.departments[editingDepartmentId] || {} : {};
  const editingEmployeeIds = editingDepartment.employeeIds || {};
  return `
    <section class="section">
      <div class="section-header"><h2>إضافة أو تعديل قسم</h2></div>
      <form id="department-form" class="grid two">
        <div class="field"><label>معرف القسم</label><input name="id" required ${editingDepartmentId ? "readonly" : ""} value="${escapeAttr(editingDepartmentId)}" placeholder="production" /></div>
        <div class="field"><label>اسم القسم</label><input name="name" required value="${escapeAttr(editingDepartment.name || "")}" placeholder="الإنتاج" /></div>
        <div class="field">
          <label>مسؤول القسم</label>
          <select name="managerId"><option value="">بدون</option>${employeeOptions(employees, editingDepartment.managerId || "")}</select>
        </div>
        <div class="field">
          <label>مساعد مسؤول القسم</label>
          <select name="assistantId"><option value="">بدون</option>${employeeOptions(employees, editingDepartment.assistantId || "")}</select>
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>موظفو القسم</label>
          <div class="employee-check-grid">
            ${employees.map((employee) => `<label class="check-card"><input type="checkbox" name="employeeIds" value="${employee.id}" ${editingEmployeeIds[employee.id] ? "checked" : ""} /><span>${employee.id} - ${escapeHtml(employee.fullName)}</span></label>`).join("")}
          </div>
        </div>
        ${textareaField("message", "إشعار اختياري لموظفي القسم", false)}
        <button class="primary-button" type="submit"><i data-lucide="save"></i>حفظ القسم وإرسال الإشعار</button>
        ${editingDepartmentId ? `<button class="secondary-button" type="button" data-cancel-department-edit><i data-lucide="x"></i>إلغاء التعديل</button>` : ""}
      </form>
    </section>
    <section class="section">
      <div class="section-header"><h2>الأقسام الحالية</h2></div>
      ${departments.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>القسم</th><th>المسؤول</th><th>المساعد</th><th>عدد الموظفين</th><th>الموظفون</th><th>إجراءات</th></tr></thead>
            <tbody>
              ${departments.map((department) => {
                const employeeIds = Object.keys(department.employeeIds || {});
                return `
                  <tr>
                    <td>${escapeHtml(department.name)}</td>
                    <td>${employeeName(department.managerId)}</td>
                    <td>${department.assistantId ? employeeName(department.assistantId) : "-"}</td>
                    <td>${employeeIds.length}</td>
                    <td>
                      <div class="inline-list">
                        ${employeeIds.length ? employeeIds.map((employeeId) => `
                          <span class="inline-chip">
                            ${employeeName(employeeId)}
                            <button class="mini-danger" data-remove-department-employee="${department.id}" data-employee-id="${employeeId}" title="إزالة من القسم">×</button>
                          </span>
                        `).join("") : "-"}
                      </div>
                    </td>
                    <td class="actions">
                      <button class="secondary-button" data-edit-department="${department.id}"><i data-lucide="pencil"></i>تعديل</button>
                      <button class="danger-button" data-delete-department="${department.id}"><i data-lucide="trash-2"></i>حذف القسم</button>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">لا توجد أقسام بعد.</div>`}
    </section>
  `;
}

function employeeOptions(employees, selectedId) {
  return employees.map((employee) => `<option value="${employee.id}" ${employee.id === selectedId ? "selected" : ""}>${employee.id} - ${escapeHtml(employee.fullName)}</option>`).join("");
}

function departmentOptions(selectedId = "") {
  return Object.entries(state.departments)
    .map(([id, department]) => `<option value="${id}" ${id === selectedId ? "selected" : ""}>${escapeHtml(department.name)}</option>`)
    .join("");
}

function getEmployeeDepartment(employeeId) {
  const found = Object.entries(state.departments).find(([, department]) => department.employeeIds && department.employeeIds[employeeId]);
  if (!found) return { id: "", name: "" };
  return { id: found[0], name: found[1].name || found[0] };
}

function renderAdminPermissions() {
  const employees = Object.values(state.employees).sort((a, b) => a.id.localeCompare(b.id));
  const permissionRows = Object.entries(state.permissions).map(([id, role]) => ({ id, ...role }));
  const editingPermissionId = sessionStorage.getItem("editing-permission") || "";
  const editingPermission = editingPermissionId ? state.permissions[editingPermissionId] || {} : {};
  const editingFlags = editingPermission.permissions || {};
  return `
    <section class="section">
      <div class="section-header"><h2>منح صلاحيات</h2></div>
      <form id="permission-form" class="grid two">
        <div class="field"><label>اسم الدور</label><input name="title" required value="${escapeAttr(editingPermission.title || "")}" placeholder="مثال: مدير قسم الإنتاج" /></div>
        <div class="field">
          <label>الموظف</label>
          <select name="employeeId" required>
            ${employees.map((employee) => `<option value="${employee.id}" ${employee.id === editingPermission.employeeId ? "selected" : ""}>${employee.id} - ${escapeHtml(employee.fullName)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>نطاق القسم</label>
          <select name="departmentId">
            <option value="">كل الأقسام حسب الصلاحية</option>
            ${departmentOptions(editingPermission.departmentId || "")}
          </select>
        </div>
        ${permissionCheckbox("viewAttendance", "عرض تقارير الدوام", editingFlags.viewAttendance)}
        ${permissionCheckbox("reviewRequests", "مراجعة طلبات القسم", editingFlags.reviewRequests)}
        ${permissionCheckbox("manageDepartment", "إدارة قسمه بالكامل", editingFlags.manageDepartment)}
        ${permissionCheckbox("deleteRequests", "حذف الطلبات مع إبقائها مقفلة في السجل", editingFlags.deleteRequests)}
        ${permissionCheckbox("manageAnnouncements", "إدارة الإعلانات", editingFlags.manageAnnouncements)}
        ${permissionCheckbox("manageEmployees", "إدارة الموظفين", editingFlags.manageEmployees)}
        ${permissionCheckbox("manageHolidays", "إدارة العطل الرسمية", editingFlags.manageHolidays)}
        ${permissionCheckbox("managePermissions", "إدارة الصلاحيات", editingFlags.managePermissions)}
        <button class="primary-button" type="submit"><i data-lucide="shield-check"></i>${editingPermissionId ? "تحديث الصلاحيات" : "حفظ الصلاحيات"}</button>
        ${editingPermissionId ? `<button class="secondary-button" type="button" data-cancel-permission-edit><i data-lucide="x"></i>إلغاء التعديل</button>` : ""}
      </form>
    </section>
    <section class="section">
      <div class="section-header"><h2>الصلاحيات الحالية</h2></div>
      ${permissionRows.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>الدور</th><th>الموظف</th><th>النطاق</th><th>الصلاحيات</th><th>إجراءات</th></tr></thead>
            <tbody>
              ${permissionRows.map((role) => `<tr>
                <td>${escapeHtml(role.title)}</td>
                <td>${escapeHtml(employeeName(role.employeeId))}</td>
                <td>${escapeHtml(role.departmentId ? (state.departments[role.departmentId] && state.departments[role.departmentId].name ? state.departments[role.departmentId].name : role.departmentId) : "حسب الدور")}</td>
                <td>${formatPermissions(role.permissions || {})}</td>
                <td class="actions">
                  <button class="secondary-button" data-edit-permission="${role.id}"><i data-lucide="pencil"></i>تعديل</button>
                  <button class="danger-button" data-delete-permission="${role.id}"><i data-lucide="trash-2"></i>حذف</button>
                </td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">لا توجد صلاحيات مخصصة.</div>`}
    </section>
  `;
}

function permissionCheckbox(name, label, checked = false) {
  return `
    <label class="check-card">
      <input type="checkbox" name="${name}" value="true" ${checked ? "checked" : ""} />
      <span>${label}</span>
    </label>
  `;
}

function formatPermissions(permissions) {
  const labels = {
    viewAttendance: "عرض الدوام",
    reviewRequests: "مراجعة الطلبات",
    manageDepartment: "إدارة القسم",
    deleteRequests: "حذف الطلبات",
    manageAnnouncements: "الإعلانات",
    manageEmployees: "الموظفون",
    manageHolidays: "العطل",
    managePermissions: "الصلاحيات"
  };
  return Object.entries(permissions)
    .filter(([, value]) => value)
    .map(([key]) => labels[key] || key)
    .join("، ") || "بدون صلاحيات";
}

function renderAdminAnnouncements() {
  const rows = Object.entries(state.announcements)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return `
    <section class="section">
      <div class="section-header"><h2>إعلان جديد</h2></div>
      <form id="announcement-form" class="grid two">
        ${field("title", "text", "عنوان الإعلان", true)}
        ${field("date", "date", "تاريخ الإعلان", true)}
        ${selectField("type", "نوع الإعلان", ["public", "private"], true)}
        <div class="field">
          <label>الموظف للإعلان الخاص</label>
          <select name="employeeId">
            <option value="">بدون</option>
            ${Object.values(state.employees).map((employee) => `<option value="${employee.id}">${employee.id} - ${escapeHtml(employee.fullName)}</option>`).join("")}
          </select>
        </div>
        ${textareaField("body", "نص الإعلان", true)}
        <button class="primary-button" type="submit"><i data-lucide="send"></i>نشر الإعلان</button>
      </form>
    </section>
    <section class="section">
      <div class="section-header"><h2>الإعلانات الحالية</h2></div>
      <div class="alert-list">
        ${rows.length ? rows.map((item) => `
          ${renderAnnouncement(item)}
          <div class="actions">
            <button class="secondary-button" data-edit-announcement="${item.id}"><i data-lucide="pencil"></i>تعديل</button>
            <button class="danger-button" data-delete-announcement="${item.id}"><i data-lucide="trash-2"></i>حذف</button>
          </div>
        `).join("") : `<div class="empty">لا توجد إعلانات.</div>`}
      </div>
    </section>
  `;
}

function renderAdminEmployees() {
  const rows = Object.values(state.employees).sort((a, b) => a.id.localeCompare(b.id));
  const departments = Object.values(state.departments).map((department) => department.name).filter(Boolean);
  const selectedDepartment = sessionStorage.getItem("employee-department-filter") || "all";
  const filteredRows = rows.filter((employee) => selectedDepartment === "all" || getEmployeeDepartment(employee.id).name === selectedDepartment);
  return `
    <section class="section">
      <div class="section-header">
        <h2>قائمة الموظفين</h2>
        <button class="primary-button" data-add-employee><i data-lucide="user-plus"></i>إضافة موظف</button>
      </div>
      <form id="employee-filter-form" class="toolbar">
        <div class="field">
          <label>القسم</label>
          <select name="department">
            <option value="all">كل الأقسام</option>
            ${departments.map((department) => `<option value="${escapeAttr(department)}" ${department === selectedDepartment ? "selected" : ""}>${escapeHtml(department)}</option>`).join("")}
          </select>
        </div>
        <button class="secondary-button" type="submit"><i data-lucide="filter"></i>تصفية</button>
      </form>
      <div class="table-wrap">
        <table>
          <thead><tr><th>الرقم</th><th>الاسم</th><th>القسم</th><th>المسمى</th><th>الشفت</th><th>الهاتف</th><th>إجراءات</th></tr></thead>
          <tbody>
            ${filteredRows.map((employee) => `
              <tr>
                <td>${employee.id}</td>
                <td>${escapeHtml(employee.fullName)}</td>
                <td>${escapeHtml(getEmployeeDepartment(employee.id).name || "غير موزع")}</td>
                <td>${escapeHtml(employee.jobTitle || "")}</td>
                <td>${shiftLabel(employee.shift)}</td>
                <td>${escapeHtml(employee.phone || "")}</td>
                <td class="actions">
                  <button class="secondary-button" data-edit-employee="${employee.id}"><i data-lucide="pencil"></i>تعديل</button>
                  <button class="danger-button" data-delete-employee="${employee.id}"><i data-lucide="trash-2"></i>حذف</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function bindAdmin() {
  bindCommon();
  bindRequestTableActions();
  const attendanceFilterForm = document.getElementById("attendance-filter-form");
  if (attendanceFilterForm) attendanceFilterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    sessionStorage.setItem("attendance-employee", data.employeeId || "");
    sessionStorage.setItem("attendance-month", data.month || todayIso().slice(0, 7));
    render();
  });
  const attendanceEditorButton = document.querySelector("[data-open-attendance-editor]");
  if (attendanceEditorButton) attendanceEditorButton.addEventListener("click", (event) => {
    openAttendanceEditor(event.currentTarget.dataset.openAttendanceEditor);
  });
  const holidayForm = document.getElementById("holiday-form");
  if (holidayForm) holidayForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    try {
      await set(ref(db, `holidays/${data.date}`), data);
      event.target.reset();
      toast("تم حفظ العطلة الرسمية");
    } catch (error) {
      console.error(error);
      toast("تعذر حفظ العطلة الرسمية", "error");
    }
  });
  document.querySelectorAll("[data-delete-holiday]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await remove(ref(db, `holidays/${button.dataset.deleteHoliday}`));
        toast("تم حذف العطلة الرسمية");
      } catch (error) {
        console.error(error);
        toast("تعذر حذف العطلة الرسمية", "error");
      }
    });
  });
  const workSettingsForm = document.getElementById("work-settings-form");
  if (workSettingsForm) workSettingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    const payload = {
      workStart: data.workStart,
      workEnd: data.workEnd,
      overtimeAfter: data.overtimeAfter,
      overtimeRate: Number(data.overtimeRate || 1.25),
      holidayOvertimeRate: Number(data.holidayOvertimeRate || 1.5),
      lateGraceMinutes: Number(data.lateGraceMinutes || 0),
      absenceDeductionDays: Number(data.absenceDeductionDays || 0),
      fridayNoDeduction: data.fridayNoDeduction === "true",
      officialHolidayNoDeduction: data.officialHolidayNoDeduction === "true"
    };
    try {
      await set(ref(db, "settings"), payload);
      toast("تم حفظ إعدادات الدوام");
    } catch (error) {
      console.error(error);
      toast("تعذر حفظ إعدادات الدوام", "error");
    }
  });
  const departmentForm = document.getElementById("department-form");
  if (departmentForm) departmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());
    const employeeIds = {};
    new FormData(form).getAll("employeeIds").forEach((id) => {
      employeeIds[id] = true;
    });
    const payload = {
      name: data.name,
      managerId: data.managerId || "",
      assistantId: data.assistantId || "",
      employeeIds
    };
    try {
      await set(ref(db, `departments/${data.id}`), payload);
      await Promise.all(Object.keys(employeeIds).map((employeeId) => update(ref(db, `employees/${employeeId}`), { department: data.name })));
      if (String(data.message || "").trim()) {
        await Promise.all(Object.keys(employeeIds).map((employeeId) => push(ref(db, "announcements"), {
          title: `إشعار قسم ${data.name}`,
          body: data.message,
          type: "private",
          employeeId,
          date: todayIso(),
          createdAt: Date.now(),
          publisherId: state.session.id,
          publisherName: currentUser().fullName || "مستخدم النظام"
        })));
      }
      form.reset();
      sessionStorage.removeItem("editing-department");
      toast("تم حفظ القسم");
    } catch (error) {
      console.error(error);
      toast("تعذر حفظ القسم", "error");
    }
  });
  document.querySelectorAll("[data-edit-department]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("editing-department", button.dataset.editDepartment);
      render();
    });
  });
  const cancelDepartmentEditButton = document.querySelector("[data-cancel-department-edit]");
  if (cancelDepartmentEditButton) cancelDepartmentEditButton.addEventListener("click", () => {
    sessionStorage.removeItem("editing-department");
    render();
  });
  document.querySelectorAll("[data-delete-department]").forEach((button) => {
    button.addEventListener("click", async () => {
      const departmentId = button.dataset.deleteDepartment;
      try {
        await remove(ref(db, `departments/${departmentId}`));
        toast("تم حذف القسم");
      } catch (error) {
        console.error(error);
        toast("تعذر حذف القسم", "error");
      }
    });
  });
  document.querySelectorAll("[data-remove-department-employee]").forEach((button) => {
    button.addEventListener("click", async () => {
      const departmentId = button.dataset.removeDepartmentEmployee;
      const employeeId = button.dataset.employeeId;
      try {
        await remove(ref(db, `departments/${departmentId}/employeeIds/${employeeId}`));
        toast("تمت إزالة الموظف من القسم");
      } catch (error) {
        console.error(error);
        toast("تعذر إزالة الموظف من القسم", "error");
      }
    });
  });
  const permissionForm = document.getElementById("permission-form");
  if (permissionForm) permissionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    const roleId = data.title.trim().replace(/\s+/g, "-");
    const payload = {
      title: data.title,
      employeeId: data.employeeId,
      departmentId: data.departmentId || "",
      permissions: {
        viewAttendance: data.viewAttendance === "true",
        reviewRequests: data.reviewRequests === "true",
        manageDepartment: data.manageDepartment === "true",
        deleteRequests: data.deleteRequests === "true",
        manageAnnouncements: data.manageAnnouncements === "true",
        manageEmployees: data.manageEmployees === "true",
        manageHolidays: data.manageHolidays === "true",
        managePermissions: data.managePermissions === "true"
      }
    };
    try {
      const editingPermissionId = sessionStorage.getItem("editing-permission") || "";
      if (editingPermissionId && editingPermissionId !== roleId) {
        await remove(ref(db, `permissions/${editingPermissionId}`));
      }
      await set(ref(db, `permissions/${roleId}`), payload);
      sessionStorage.removeItem("editing-permission");
      event.target.reset();
      toast(editingPermissionId ? "تم تحديث الصلاحيات" : "تم حفظ الصلاحيات");
    } catch (error) {
      console.error(error);
      toast("تعذر حفظ الصلاحيات", "error");
    }
  });
  const shiftForm = document.getElementById("shift-form");
  if (shiftForm) shiftForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    const payload = {
      label: data.label,
      start: data.start,
      end: data.end,
      overtimeAfter: data.overtimeAfter || data.end
    };
    try {
      await set(ref(db, `shifts/${data.id}`), payload);
      event.target.reset();
      toast("تم حفظ الشفت");
    } catch (error) {
      console.error(error);
      toast("تعذر حفظ الشفت", "error");
    }
  });
  document.querySelectorAll("[data-edit-shift]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.editShift;
      const shift = getShifts()[id];
      const form = document.getElementById("shift-form");
      if (!shift || !form) return;
      form.elements.id.value = id;
      form.elements.label.value = shift.label || "";
      form.elements.start.value = shift.start || "";
      form.elements.end.value = shift.end || "";
      form.elements.overtimeAfter.value = shift.overtimeAfter || shift.end || "";
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelectorAll("[data-edit-permission]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("editing-permission", button.dataset.editPermission);
      render();
    });
  });
  const cancelPermissionEditButton = document.querySelector("[data-cancel-permission-edit]");
  if (cancelPermissionEditButton) cancelPermissionEditButton.addEventListener("click", () => {
    sessionStorage.removeItem("editing-permission");
    render();
  });
  document.querySelectorAll("[data-delete-permission]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await remove(ref(db, `permissions/${button.dataset.deletePermission}`));
        toast("تم حذف الصلاحية");
      } catch (error) {
        console.error(error);
        toast("تعذر حذف الصلاحية", "error");
      }
    });
  });
  const announcementForm = document.getElementById("announcement-form");
  if (announcementForm) announcementForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    if (data.type === "private" && !data.employeeId) {
      toast("اختر الموظف للإعلان الخاص", "error");
      return;
    }
    await push(ref(db, "announcements"), {
      ...data,
      createdAt: Date.now(),
      publisherId: state.session.id,
      publisherName: currentUser().fullName || "مسؤول النظام"
    });
    event.target.reset();
    toast("تم نشر الإعلان");
  });
  document.querySelectorAll("[data-delete-announcement]").forEach((button) => {
    button.addEventListener("click", async () => {
      await remove(ref(db, `announcements/${button.dataset.deleteAnnouncement}`));
      toast("تم حذف الإعلان");
    });
  });
  document.querySelectorAll("[data-edit-announcement]").forEach((button) => {
    button.addEventListener("click", () => openAnnouncementEditor(button.dataset.editAnnouncement));
  });
  const addEmployeeButton = document.querySelector("[data-add-employee]");
  if (addEmployeeButton) addEmployeeButton.addEventListener("click", () => openEmployeeEditor());
  document.querySelectorAll("[data-edit-employee]").forEach((button) => {
    button.addEventListener("click", () => openEmployeeEditor(button.dataset.editEmployee));
  });
  const employeeFilterForm = document.getElementById("employee-filter-form");
  if (employeeFilterForm) employeeFilterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    sessionStorage.setItem("employee-department-filter", data.department || "all");
    render();
  });
  document.querySelectorAll("[data-delete-employee]").forEach((button) => {
    button.addEventListener("click", async () => {
      await remove(ref(db, `employees/${button.dataset.deleteEmployee}`));
      toast("تم حذف الموظف");
    });
  });
}

function openAttendanceEditor(employeeId) {
  const todayRecord = state.attendance[employeeId] && state.attendance[employeeId][todayIso()] ? state.attendance[employeeId][todayIso()] : {};
  openModal(`
    <h2>تسجيل أو تعديل يوم دوام</h2>
    <form id="attendance-editor-form" class="grid two">
      <div class="field"><label>الموظف</label><input value="${escapeAttr(employeeName(employeeId))}" readonly /></div>
      <div class="field"><label>التاريخ</label><input name="date" type="date" required value="${todayRecord.date || todayIso()}" /></div>
      <div class="field">
        <label>الحالة</label>
        <select name="status" required>
          <option value="present">حاضر</option>
          <option value="late">متأخر</option>
          <option value="absent">غائب</option>
        </select>
      </div>
      <div class="field"><label>بداية الدوام</label><input name="shiftStart" type="time" value="${todayRecord.shiftStart || "08:00"}" /></div>
      <div class="field"><label>نهاية الدوام</label><input name="shiftEnd" type="time" value="${todayRecord.shiftEnd || "17:00"}" /></div>
      <div class="field"><label>وقت الحضور</label><input name="checkIn" type="time" value="${todayRecord.checkIn || ""}" /></div>
      <div class="field"><label>وقت الانصراف</label><input name="checkOut" type="time" value="${todayRecord.checkOut || ""}" /></div>
      ${textareaField("notes", "ملاحظات", false)}
      <button class="primary-button" type="submit"><i data-lucide="save"></i>حفظ سجل الدوام</button>
    </form>
  `);
  const statusSelect = document.querySelector('#attendance-editor-form [name="status"]');
  statusSelect.value = todayRecord.status || "present";
  document.querySelector('#attendance-editor-form [name="notes"]').value = todayRecord.notes || "";
  document.getElementById("attendance-editor-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    const payload = { ...data, employeeId };
    try {
      await set(ref(db, `attendance/${employeeId}/${data.date}`), payload);
      closeModal();
      toast("تم حفظ سجل الدوام");
    } catch (error) {
      console.error(error);
      toast("تعذر حفظ سجل الدوام. تحقق من صلاحيات Firebase.", "error");
    }
  });
}

function openStatusModal(id, status) {
  const request = state.requests[id];
  if (request && request.deleted) {
    toast("هذا الطلب محذوف ومقفل ولا يمكن تغيير حالته", "error");
    return;
  }
  openModal(`
    <h2>تحديث حالة الطلب إلى: ${statusLabels[status]}</h2>
    <form id="status-form" class="grid">
      ${textareaField("adminReason", "سبب الإجراء الإداري", false)}
      <button class="primary-button" type="submit"><i data-lucide="save"></i>حفظ</button>
    </form>
  `);
  document.getElementById("status-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    try {
      await applyRequestStatus(id, status, data.adminReason || "");
      closeModal();
      toast("تم تحديث حالة الطلب");
    } catch (error) {
      console.error(error);
      toast(error.message || "تعذر تحديث حالة الطلب", "error");
    }
  });
}

async function applyRequestStatus(id, status, adminReason) {
  const request = state.requests[id];
  if (!request) throw new Error("الطلب غير موجود");
  if (request.deleted || request.locked) throw new Error("هذا الطلب محذوف ومقفل ولا يمكن تغيير حالته");
  const updates = {};
  updates["requests/" + id + "/status"] = status;
  updates["requests/" + id + "/adminReason"] = adminReason;
  updates["requests/" + id + "/reviewedAt"] = Date.now();
  updates["requests/" + id + "/reviewedBy"] = state.session.id;
  if (status === "approved" && request.type === "leave" && request.details && request.details.leaveType === "سنوية") {
    const employee = state.employees[request.employeeId] || {};
    const days = Number(request.details.days || 0);
    if (leaveBalance(employee) < days) {
      throw new Error("رصيد الإجازات لا يكفي للموافقة على هذا الطلب");
    }
    updates["employees/" + request.employeeId + "/usedLeave"] = Number(employee.usedLeave || 0) + days;
  }
  await update(ref(db), updates);
}

function openAnnouncementEditor(id) {
  const item = state.announcements[id];
  if (!item) return;
  openModal(`
    <h2>تعديل الإعلان</h2>
    <form id="edit-announcement-form" class="grid two">
      <div class="field"><label>العنوان</label><input name="title" required value="${escapeAttr(item.title)}" /></div>
      <div class="field"><label>التاريخ</label><input name="date" type="date" required value="${item.date || todayIso()}" /></div>
      ${selectField("type", "نوع الإعلان", ["public", "private"], true)}
      <div class="field"><label>رقم الموظف</label><input name="employeeId" value="${item.employeeId || ""}" /></div>
      <div class="field" style="grid-column: 1 / -1"><label>النص</label><textarea name="body" required>${escapeHtml(item.body)}</textarea></div>
      <button class="primary-button" type="submit"><i data-lucide="save"></i>حفظ</button>
    </form>
  `);
  document.querySelector('[name="type"]').value = item.type;
  document.getElementById("edit-announcement-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await update(ref(db, `announcements/${id}`), Object.fromEntries(new FormData(event.target).entries()));
    closeModal();
    toast("تم تعديل الإعلان");
  });
}

function openEmployeeEditor(id = "") {
  const employee = id ? state.employees[id] : {};
  openModal(`
    <h2>${id ? "تعديل موظف" : "إضافة موظف"}</h2>
    <form id="employee-form" class="grid two">
      <div class="field"><label>رقم الموظف</label><input name="id" required ${id ? "readonly" : ""} value="${employee.id || ""}" /></div>
      <div class="field"><label>كلمة السر</label><input name="password" required value="${employee.password || "1234"}" /></div>
      <div class="field"><label>اسم الموظف الرباعي</label><input name="fullName" required value="${escapeAttr(employee.fullName || "")}" /></div>
      ${fieldWithValue("birthDate", "date", "تاريخ الميلاد", employee.birthDate)}
      ${fieldWithValue("hireDate", "date", "تاريخ التعيين", employee.hireDate)}
      <div class="field"><label>الجنسية</label><input name="nationality" value="${escapeAttr(employee.nationality || "أردني")}" /></div>
      ${fieldWithValue("contractEnd", "date", "تاريخ انتهاء العقد", employee.contractEnd)}
      <div class="field"><label>الرصيد السابق</label><input name="previousLeave" type="number" value="${employee.previousLeave || 0}" /></div>
      <div class="field"><label>الرصيد الجديد</label><input name="newLeave" type="number" value="${employee.newLeave !== undefined && employee.newLeave !== null ? employee.newLeave : 14}" /></div>
      <div class="field"><label>الأيام المستهلكة</label><input name="usedLeave" type="number" value="${employee.usedLeave || 0}" /></div>
      <div class="field"><label>المسمى الوظيفي</label><input name="jobTitle" value="${escapeAttr(employee.jobTitle || "")}" /></div>
      <div class="field"><label>القسم</label><input value="${escapeAttr(getEmployeeDepartment(employee.id).name || "يحدد من شاشة الأقسام")}" readonly /></div>
      <div class="field">
        <label>الشفت</label>
        <select name="shift">
          ${Object.entries(getShifts()).map(([id, shift]) => `<option value="${id}" ${id === (employee.shift || "morning") ? "selected" : ""}>${shift.label} (${shift.start} - ${shift.end})</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>رقم هاتف</label><input name="phone" value="${employee.phone || ""}" /></div>
      <div class="field"><label>رقم هاتف بديل</label><input name="altPhone" value="${employee.altPhone || ""}" /></div>
      <button class="primary-button" type="submit"><i data-lucide="save"></i>حفظ الموظف</button>
    </form>
  `);
  document.getElementById("employee-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    if (!isJordanPhone(data.phone) && !isJordanPhone(data.altPhone)) {
      toast("يجب إدخال رقم هاتف أردني واحد على الأقل", "error");
      return;
    }
    data.role = "employee";
    const oldShift = employee.shift || "morning";
    ["previousLeave", "newLeave", "usedLeave"].forEach((key) => data[key] = Number(data[key] || 0));
    await set(ref(db, `employees/${data.id}`), data);
    if (id && oldShift !== data.shift) {
      await push(ref(db, "announcements"), {
        title: "تعديل الشفت",
        body: `تم تعديل شفتك إلى ${shiftLabel(data.shift)}.`,
        type: "private",
        employeeId: data.id,
        date: todayIso(),
        createdAt: Date.now(),
        publisherId: state.session.id,
        publisherName: currentUser().fullName || "مسؤول النظام"
      });
    }
    closeModal();
    toast("تم حفظ بيانات الموظف");
  });
}

function fieldWithValue(name, type, label, value) {
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${value || ""}" /></div>`;
}

function employeeName(id) {
  return state.employees[id] && state.employees[id].fullName ? state.employees[id].fullName : id || "غير محدد";
}

function openModal(html) {
  closeModal();
  const template = document.getElementById("modal-template");
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector(".modal-body").innerHTML = html;
  document.body.appendChild(node);
  node.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (event.target === node || (target && target.closest(".modal-close"))) closeModal();
  });
  bindRequestTableActions();
  hydrateIcons();
}

function closeModal() {
  const modalBackdrop = document.querySelector(".modal-backdrop");
  if (modalBackdrop) modalBackdrop.remove();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}

ensureSeedData()
  .then(() => {
    subscribeData();
    render();
  })
  .catch((error) => {
    console.error(error);
    root.innerHTML = `
      <main class="login-shell">
        <section class="login-panel">
          <div class="brand-mark"><i data-lucide="factory"></i><span>إدارة مصنع الحديد</span></div>
          <h1>تعذر الاتصال بقاعدة البيانات</h1>
          <p class="hint">تأكد من إعدادات Firebase وقواعد Realtime Database و Storage.</p>
          <pre>${escapeHtml(error.message)}</pre>
        </section>
      </main>
    `;
    hydrateIcons();
  });
