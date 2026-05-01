var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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
const todayIso = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
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
  payroll: {},
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
  if (state.session && state.session.role === "employee" && !employeeCanAccessView(view)) {
    toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0641\u062A\u062D \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645", "error");
    return;
  }
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
  { id: "leave", title: "\u0637\u0644\u0628 \u0625\u062C\u0627\u0632\u0629", icon: "calendar-days" },
  { id: "departure", title: "\u0637\u0644\u0628 \u0645\u063A\u0627\u062F\u0631\u0629", icon: "clock-arrow-up" },
  { id: "advance", title: "\u0637\u0644\u0628 \u0633\u0644\u0641\u0629", icon: "wallet-cards" },
  { id: "complaint", title: "\u0637\u0644\u0628 \u0634\u0643\u0648\u0649", icon: "message-square-warning" },
  { id: "resignation", title: "\u0637\u0644\u0628 \u0627\u0633\u062A\u0642\u0627\u0644\u0629", icon: "door-open" },
  { id: "custom", title: "\u0637\u0644\u0628 \u0645\u062E\u0635\u0635", icon: "clipboard-pen" }
];
const requestTitles = Object.fromEntries(requestTypes.map((item) => [item.id, item.title]));
const statusLabels = {
  all: "\u0627\u0644\u0643\u0644",
  pending: "\u0642\u064A\u062F \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631",
  approved: "\u0645\u0648\u0627\u0641\u0642 \u0639\u0644\u064A\u0647",
  rejected: "\u0645\u0631\u0641\u0648\u0636",
  cancelled: "\u0645\u0644\u063A\u064A",
  deleted: "\u0645\u062D\u0630\u0648\u0641"
};
const defaultShifts = {
  morning: { label: "\u0634\u0641\u062A \u0635\u0628\u0627\u062D\u064A", start: "07:00", end: "16:00" },
  evening: { label: "\u0634\u0641\u062A \u0645\u0633\u0627\u0626\u064A", start: "16:00", end: "01:00" }
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
    name: "\u0627\u0644\u0625\u0646\u062A\u0627\u062C",
    managerId: "1001",
    assistantId: "",
    employeeIds: { "1001": true }
  },
  maintenance: {
    name: "\u0627\u0644\u0635\u064A\u0627\u0646\u0629",
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
    fullName: "\u0623\u062D\u0645\u062F \u0645\u062D\u0645\u0648\u062F \u0633\u0627\u0644\u0645 \u0627\u0644\u062D\u062F\u064A\u062F\u064A",
    birthDate: "1992-06-18",
    hireDate: "2021-03-01",
    nationality: "\u0623\u0631\u062F\u0646\u064A",
    contractEnd: "2027-12-31",
    previousLeave: 4,
    newLeave: 21,
    usedLeave: 3,
    jobTitle: "\u0645\u0634\u0631\u0641 \u0625\u0646\u062A\u0627\u062C",
    department: "\u0627\u0644\u062F\u0631\u0641\u0644\u0629",
    shift: "morning",
    phone: "0791234567",
    altPhone: ""
  },
  "1002": {
    id: "1002",
    password: "1234",
    role: "employee",
    fullName: "\u0644\u064A\u062B \u062E\u0627\u0644\u062F \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646 \u0627\u0644\u0646\u062C\u0627\u0631",
    birthDate: "1988-11-04",
    hireDate: "2019-08-12",
    nationality: "\u0623\u0631\u062F\u0646\u064A",
    contractEnd: "2026-09-30",
    previousLeave: 7,
    newLeave: 21,
    usedLeave: 9,
    jobTitle: "\u0641\u0646\u064A \u0635\u064A\u0627\u0646\u0629",
    department: "\u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0645\u064A\u0643\u0627\u0646\u064A\u0643\u064A\u0629",
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
    fullName: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645",
    jobTitle: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0648\u0627\u0631\u062F \u0627\u0644\u0628\u0634\u0631\u064A\u0629"
  }
};
const demoAnnouncements = {
  welcome: {
    title: "\u0627\u062C\u062A\u0645\u0627\u0639 \u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064A",
    body: "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0644\u062A\u0632\u0627\u0645 \u0628\u062D\u0636\u0648\u0631 \u0627\u062C\u062A\u0645\u0627\u0639 \u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0641\u064A \u0628\u062F\u0627\u064A\u0629 \u0627\u0644\u0648\u0631\u062F\u064A\u0629.",
    type: "public",
    date: todayIso(),
    createdAt: Date.now()
  },
  private1001: {
    title: "\u062A\u0646\u0628\u064A\u0647 \u062E\u0627\u0635",
    body: "\u064A\u0631\u062C\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u0643\u062A\u0628 \u0634\u0624\u0648\u0646 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0642\u0628\u0644 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u062F\u0648\u0627\u0645.",
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
    records[iso] = isWeekend ? {
      date: iso,
      status: "absent",
      shiftStart: "08:00",
      shiftEnd: "17:00",
      checkIn: "",
      checkOut: "",
      notes: "\u063A\u064A\u0627\u0628"
    } : {
      date: iso,
      status: index % 4 === 1 ? "late" : "present",
      shiftStart: "08:00",
      shiftEnd: "17:00",
      checkIn: index % 4 === 1 ? "08:24" : "07:55",
      checkOut: "17:05",
      notes: index % 4 === 1 ? "\u062A\u0623\u062E\u064A\u0631 \u0635\u0628\u0627\u062D\u064A" : ""
    };
  }
  return {
    "1001": records,
    "1002": Object.fromEntries(
      Object.entries(records).map(([date, record], index) => [
        date,
        __spreadProps(__spreadValues({}, record), {
          status: index % 5 === 0 ? "absent" : record.status,
          checkIn: index % 5 === 0 ? "" : record.checkIn,
          checkOut: index % 5 === 0 ? "" : record.checkOut,
          notes: index % 5 === 0 ? "\u063A\u064A\u0627\u0628 \u0628\u062F\u0648\u0646 \u062A\u0633\u062C\u064A\u0644" : record.notes
        })
      ])
    )
  };
}
function buildDemoHolidays() {
  const date = (/* @__PURE__ */ new Date()).getFullYear() + "-05-01";
  const holidays = {};
  holidays[date] = {
    date,
    name: "\u0639\u064A\u062F \u0627\u0644\u0639\u0645\u0627\u0644",
    notes: "\u0639\u0637\u0644\u0629 \u0631\u0633\u0645\u064A\u0629"
  };
  return holidays;
}
const demoPermissions = {
  productionManager: {
    title: "\u0645\u062F\u064A\u0631 \u0642\u0633\u0645 \u0627\u0644\u0625\u0646\u062A\u0627\u062C",
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
  const payrollSnap = await get(ref(db, "payroll"));
  if (!payrollSnap.exists()) {
    await set(ref(db, "payroll"), { profiles: {}, slips: {}, advanceDelays: {} });
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
  onValue(ref(db, "payroll"), (snap) => {
    state.payroll = snap.val() || { profiles: {}, slips: {}, advanceDelays: {} };
    render();
  });
  onValue(ref(db, "settings"), (snap) => {
    state.settings = __spreadValues(__spreadValues({}, defaultSettings), snap.val() || {});
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
  if (!value) return "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F";
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
        <div class="brand-mark"><i data-lucide="factory"></i><span>\u0625\u062F\u0627\u0631\u0629 \u0645\u0635\u0646\u0639 \u0627\u0644\u062D\u062F\u064A\u062F</span></div>
        <div class="login-tabs">
          <button class="${state.loginRole === "employee" ? "active" : ""}" data-login-role="employee">\u0648\u0627\u062C\u0647\u0629 \u0627\u0644\u0645\u0648\u0638\u0641</button>
          <button class="${state.loginRole === "admin" ? "active" : ""}" data-login-role="admin">\u0648\u0627\u062C\u0647\u0629 \u0627\u0644\u0645\u0633\u0624\u0648\u0644</button>
        </div>
        <form id="login-form" class="grid">
          <div class="field">
            <label for="employee-id">\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0638\u0641</label>
            <input id="employee-id" required autocomplete="username" value="${state.loginRole === "admin" ? "9001" : "1001"}" />
          </div>
          <div class="field">
            <label for="password">\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631</label>
            <input id="password" type="password" required autocomplete="current-password" value="${state.loginRole === "admin" ? "admin" : "1234"}" />
          </div>
          <button class="primary-button" type="submit"><i data-lucide="log-in"></i>\u062F\u062E\u0648\u0644</button>
          <p class="hint">\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629: \u0627\u0644\u0645\u0648\u0638\u0641 1001 / 1234\u060C \u0627\u0644\u0645\u0633\u0624\u0648\u0644 9001 / admin.</p>
        </form>
      </section>
      <section class="factory-hero">
        <div>
          <h1>\u0646\u0638\u0627\u0645 \u062A\u0634\u063A\u064A\u0644 \u0625\u062F\u0627\u0631\u064A \u0644\u0645\u0635\u0646\u0639 \u062D\u062F\u064A\u062F \u0643\u0628\u064A\u0631</h1>
          <p>\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646\u060C \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A\u060C \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0634\u062E\u0635\u064A\u0629\u060C \u0648\u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F\u0627\u062A \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629 \u0641\u064A \u0648\u0627\u062C\u0647\u0629 \u0648\u0627\u062D\u062F\u0629 \u0645\u062A\u0631\u0627\u0628\u0637\u0629 \u0645\u0639 Firebase.</p>
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
      toast("\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0638\u0641 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", "error");
      return;
    }
    if (state.loginRole === "employee") {
      state.employees[id] = __spreadValues({ id }, user);
    }
    setSession({ id, role: state.loginRole, user: __spreadValues({ id }, user) });
  });
}
function renderShell(title, subtitle, nav, body) {
  const user = currentUser();
  return `
    <main class="app-shell ${state.sidebarOpen ? "menu-open" : ""}">
      <aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
        <button class="icon-button sidebar-close" data-menu-close aria-label="\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062C\u0627\u0646\u0628\u064A\u0629">
          <i data-lucide="x"></i>
        </button>
        <div class="brand-mark"><i data-lucide="factory"></i><span>\u0645\u0635\u0646\u0639 \u0627\u0644\u062D\u062F\u064A\u062F</span></div>
        <div class="user-chip">
          <strong>${user.fullName || "\u0645\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0646\u0638\u0627\u0645"}</strong>
          <span>${userRoleLine(user)}</span>
        </div>
        <nav class="nav">${nav}</nav>
        <button class="logout-button" data-logout onclick="window.factoryLogout()"><i data-lucide="log-out"></i>\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C</button>
      </aside>
      <section class="content">
        <header class="topbar">
          <button class="icon-button menu-toggle" data-menu-toggle aria-label="\u0641\u062A\u062D \u0627\u0644\u0642\u0627\u0626\u0645\u0629">
            <i data-lucide="menu"></i>
          </button>
          <div>
            <h1>${title}</h1>
            <p>${subtitle}</p>
          </div>
          <div class="hint">\u0627\u0644\u064A\u0648\u0645: ${formatDate(todayIso())}</div>
        </header>
        ${body}
      </section>
    </main>
  `;
}
function currentUser() {
  if (!state.session) return {};
  return state.session.role === "admin" ? state.session.user || demoAdmins[state.session.id] || { id: state.session.id, fullName: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0646\u0638\u0627\u0645" } : state.employees[state.session.id] || state.session.user || {};
}
function userRoleLine(user) {
  if (state.session && state.session.role === "admin") {
    return user.jobTitle || "\u0645\u0633\u0624\u0648\u0644";
  }
  const department = getEmployeeDepartment(user.id).name;
  return [user.jobTitle || "\u0645\u0648\u0638\u0641", department].filter(Boolean).join(" - ");
}
function rolesForEmployee(employeeId) {
  return Object.entries(state.permissions).map(([id, role]) => __spreadValues({ id }, role)).filter((role) => role.employeeId === employeeId);
}
const departmentPermissionNames = [
  "manageDepartment",
  "viewDepartmentEmployees",
  "sendDepartmentNotices",
  "reviewRequests",
  "viewAttendance",
  "editAttendance",
  "changeDepartmentShifts",
  "editDepartmentEmployees",
  "deleteRequests"
];
const permissionDefinitions = [
  ["viewSystemDashboard", "\u0639\u0631\u0636 \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645 \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629"],
  ["viewAttendance", "\u0639\u0631\u0636 \u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u062F\u0648\u0627\u0645"],
  ["editAttendance", "\u062A\u0633\u062C\u064A\u0644 \u0623\u0648 \u062A\u0639\u062F\u064A\u0644 \u062F\u0648\u0627\u0645 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646"],
  ["reviewRequests", "\u0645\u0631\u0627\u062C\u0639\u0629 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0642\u0633\u0645"],
  ["deleteRequests", "\u062D\u0630\u0641 \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0645\u0639 \u0625\u0628\u0642\u0627\u0626\u0647\u0627 \u0645\u0642\u0641\u0644\u0629 \u0641\u064A \u0627\u0644\u0633\u062C\u0644"],
  ["viewDepartmentEmployees", "\u0639\u0631\u0636 \u0645\u0648\u0638\u0641\u064A \u0627\u0644\u0642\u0633\u0645"],
  ["sendDepartmentNotices", "\u0625\u0631\u0633\u0627\u0644 \u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0644\u0645\u0648\u0638\u0641\u064A \u0627\u0644\u0642\u0633\u0645"],
  ["changeDepartmentShifts", "\u062A\u063A\u064A\u064A\u0631 \u0634\u0641\u062A \u0645\u0648\u0638\u0641\u064A \u0627\u0644\u0642\u0633\u0645"],
  ["editDepartmentEmployees", "\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0648\u0638\u0641\u064A \u0627\u0644\u0642\u0633\u0645"],
  ["manageDepartment", "\u0625\u062F\u0627\u0631\u0629 \u0642\u0633\u0645\u0647 \u0628\u0627\u0644\u0643\u0627\u0645\u0644"],
  ["manageAnnouncements", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A"],
  ["manageEmployees", "\u0625\u062F\u0627\u0631\u0629 \u0643\u0644 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646"],
  ["manageDepartments", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u0642\u0633\u0627\u0645"],
  ["manageShifts", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0634\u0641\u062A\u0627\u062A"],
  ["manageWorkSettings", "\u0625\u062F\u0627\u0631\u0629 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062F\u0648\u0627\u0645"],
  ["manageHolidays", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0637\u0644 \u0627\u0644\u0631\u0633\u0645\u064A\u0629"],
  ["manageAccounting", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629 \u0648\u0627\u0644\u0631\u0648\u0627\u062A\u0628"],
  ["publishPayslips", "\u0646\u0634\u0631 \u0642\u0633\u0627\u0626\u0645 \u0627\u0644\u0631\u0627\u062A\u0628"],
  ["managePermissions", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A"]
];
function permissionAllows(permissions = {}, permissionName) {
  return Boolean(
    permissions[permissionName] || permissions.manageDepartment && departmentPermissionNames.includes(permissionName)
  );
}
function employeeHasPermission(permissionName, departmentId = "") {
  const user = currentUser();
  if (state.session && state.session.role === "admin") return true;
  return rolesForEmployee(user.id).some((role) => {
    const scopeMatches = !departmentId || !role.departmentId || role.departmentId === departmentId;
    return scopeMatches && permissionAllows(role.permissions, permissionName);
  });
}
function employeeHasGlobalPermission(permissionName) {
  const user = currentUser();
  if (state.session && state.session.role === "admin") return true;
  return rolesForEmployee(user.id).some((role) => !role.departmentId && permissionAllows(role.permissions, permissionName));
}
const employeeAdminViews = {
  "admin-dashboard": "viewSystemDashboard",
  "admin-requests": "reviewRequests",
  "admin-attendance": "viewAttendance",
  "admin-work-settings": "manageWorkSettings",
  "admin-shifts": "manageShifts",
  "admin-departments": "manageDepartments",
  "admin-accounting": "manageAccounting",
  "admin-holidays": "manageHolidays",
  "admin-permissions": "managePermissions",
  "admin-announcements": "manageAnnouncements",
  "admin-employees": "manageEmployees"
};
function employeeCanAccessView(view) {
  if (!employeeAdminViews[view]) return true;
  if (view === "admin-accounting") {
    return employeeHasGlobalPermission("manageAccounting") || employeeHasGlobalPermission("publishPayslips");
  }
  return employeeHasGlobalPermission(employeeAdminViews[view]);
}
function canPublishPayslips() {
  return state.session && (state.session.role === "admin" || employeeHasGlobalPermission("publishPayslips") || employeeHasGlobalPermission("manageAccounting"));
}
function canManageAccounting() {
  return state.session && (state.session.role === "admin" || employeeHasGlobalPermission("manageAccounting"));
}
function canDeleteRequests() {
  return state.session && (state.session.role === "admin" || employeeHasPermission("deleteRequests"));
}
function canReviewRequest(request) {
  if (state.session && state.session.role === "admin") return true;
  const departmentId = employeeDepartmentId(request.employeeId);
  return Boolean(departmentId && employeeHasPermission("reviewRequests", departmentId));
}
function canDeleteRequest(request) {
  if (state.session && state.session.role === "admin") return true;
  const departmentId = employeeDepartmentId(request.employeeId);
  return Boolean(departmentId && employeeHasPermission("deleteRequests", departmentId));
}
function roleHasDepartmentAccess(role) {
  return departmentPermissionNames.some((name) => permissionAllows(role.permissions, name));
}
function manageableDepartmentIds(employeeId = currentUser().id) {
  const departmentRoles = rolesForEmployee(employeeId).filter(roleHasDepartmentAccess);
  const roleDepartments = departmentRoles.some((role) => !role.departmentId) ? Object.keys(state.departments) : departmentRoles.map((role) => role.departmentId).filter(Boolean);
  return [...new Set(roleDepartments)];
}
function departmentEmployeeIds(departmentId) {
  return Object.keys(state.departments[departmentId] && state.departments[departmentId].employeeIds || {});
}
function employeeDepartmentId(employeeId) {
  return getEmployeeDepartment(employeeId).id || "";
}
function canManageEmployeeInDepartment(employeeId, permissionName) {
  const departmentId = employeeDepartmentId(employeeId);
  return Boolean(departmentId && manageableDepartmentIds().includes(departmentId) && employeeHasPermission(permissionName, departmentId));
}
function employeeNav() {
  const items = [
    ["home", "layout-dashboard", "\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629"],
    ["profile", "user-round", "\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A"],
    ["requests", "clipboard-list", "\u0627\u0644\u0637\u0644\u0628\u0627\u062A"],
    ["attendance", "calendar-clock", "\u0627\u0644\u062D\u0636\u0648\u0631 \u0648\u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641"],
    ["portal", "key-round", "\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0648\u0638\u0641"]
  ];
  if (manageableDepartmentIds().length) {
    items.splice(4, 0, ["department-management", "briefcase-business", "\u0625\u062F\u0627\u0631\u0629 \u0642\u0633\u0645\u064A"]);
  }
  const adminItems = [
    ["admin-dashboard", "chart-no-axes-combined", "\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645", "viewSystemDashboard"],
    ["admin-requests", "clipboard-check", "\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646", "reviewRequests"],
    ["admin-attendance", "calendar-clock", "\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u062F\u0648\u0627\u0645", "viewAttendance"],
    ["admin-work-settings", "settings-2", "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062F\u0648\u0627\u0645", "manageWorkSettings"],
    ["admin-shifts", "calendar-range", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0634\u0641\u062A\u0627\u062A", "manageShifts"],
    ["admin-departments", "building-2", "\u0627\u0644\u0623\u0642\u0633\u0627\u0645", "manageDepartments"],
    ["admin-accounting", "receipt-text", "\u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629 \u0648\u0627\u0644\u0631\u0648\u0627\u062A\u0628", "manageAccounting"],
    ["admin-holidays", "calendar-x", "\u0627\u0644\u0639\u0637\u0644 \u0627\u0644\u0631\u0633\u0645\u064A\u0629", "manageHolidays"],
    ["admin-permissions", "shield-check", "\u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A", "managePermissions"],
    ["admin-announcements", "megaphone", "\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A", "manageAnnouncements"],
    ["admin-employees", "users-round", "\u0627\u0644\u0645\u0648\u0638\u0641\u0648\u0646", "manageEmployees"]
  ];
  adminItems.forEach(([view, icon, label, permission]) => {
    if (employeeHasGlobalPermission(permission)) items.push([view, icon, label]);
  });
  return items.map(([view, icon, label]) => `<button class="${state.view === view ? "active" : ""}" data-view="${view}" onclick="window.factorySetView('${view}')"><i data-lucide="${icon}"></i>${label}</button>`).join("");
}
function adminNav() {
  const items = [
    ["admin-dashboard", "chart-no-axes-combined", "\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645"],
    ["admin-requests", "clipboard-check", "\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646"],
    ["admin-attendance", "calendar-clock", "\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u062F\u0648\u0627\u0645"],
    ["admin-work-settings", "settings-2", "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062F\u0648\u0627\u0645"],
    ["admin-shifts", "calendar-range", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0634\u0641\u062A\u0627\u062A"],
    ["admin-departments", "building-2", "\u0627\u0644\u0623\u0642\u0633\u0627\u0645"],
    ["admin-accounting", "receipt-text", "\u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629 \u0648\u0627\u0644\u0631\u0648\u0627\u062A\u0628"],
    ["admin-holidays", "calendar-x", "\u0627\u0644\u0639\u0637\u0644 \u0627\u0644\u0631\u0633\u0645\u064A\u0629"],
    ["admin-permissions", "shield-check", "\u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A"],
    ["admin-announcements", "megaphone", "\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A"],
    ["admin-employees", "users-round", "\u0627\u0644\u0645\u0648\u0638\u0641\u0648\u0646"]
  ];
  return items.map(([view, icon, label]) => `<button class="${state.view === view ? "active" : ""}" data-view="${view}" onclick="window.factorySetView('${view}')"><i data-lucide="${icon}"></i>${label}</button>`).join("");
}
function renderEmployeeApp() {
  if (!employeeCanAccessView(state.view)) {
    state.view = "home";
  }
  const titles = {
    home: ["\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", "\u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u062D\u0633\u0628 \u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u062D\u062F\u062F"],
    profile: ["\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A", "\u0628\u064A\u0627\u0646\u0627\u062A\u0643 \u0627\u0644\u0634\u062E\u0635\u064A\u0629 \u0648\u0627\u0644\u0648\u0638\u064A\u0641\u064A\u0629 \u0648\u0631\u0635\u064A\u062F \u0627\u0644\u0625\u062C\u0627\u0632\u0627\u062A"],
    requests: ["\u0627\u0644\u0637\u0644\u0628\u0627\u062A", "\u062A\u0642\u062F\u064A\u0645 \u0648\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629"],
    attendance: ["\u0627\u0644\u062D\u0636\u0648\u0631 \u0648\u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641", "\u0633\u062C\u0644 \u062D\u0636\u0648\u0631\u0643 \u0648\u0627\u0646\u0635\u0631\u0627\u0641\u0643 \u0648\u062D\u0627\u0644\u0629 \u0623\u064A\u0627\u0645 \u0627\u0644\u062F\u0648\u0627\u0645"],
    "department-management": ["\u0625\u062F\u0627\u0631\u0629 \u0642\u0633\u0645\u064A", "\u0645\u062A\u0627\u0628\u0639\u0629 \u0645\u0648\u0638\u0641\u064A \u0627\u0644\u0642\u0633\u0645 \u0648\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0648\u0627\u0644\u062A\u0646\u0628\u064A\u0647\u0627\u062A \u062D\u0633\u0628 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A"],
    "admin-dashboard": ["\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645", "\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629 \u062D\u0633\u0628 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0645\u0645\u0646\u0648\u062D\u0629"],
    "admin-requests": ["\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646", "\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u062D\u0633\u0628 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629"],
    "admin-attendance": ["\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u062F\u0648\u0627\u0645", "\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u062F\u0648\u0627\u0645 \u062D\u0633\u0628 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629"],
    "admin-work-settings": ["\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062F\u0648\u0627\u0645", "\u0625\u062F\u0627\u0631\u0629 \u0642\u0648\u0627\u0639\u062F \u0627\u0644\u062F\u0648\u0627\u0645 \u0648\u0627\u0644\u0625\u0636\u0627\u0641\u064A"],
    "admin-shifts": ["\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0634\u0641\u062A\u0627\u062A", "\u0625\u0636\u0627\u0641\u0629 \u0648\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0634\u0641\u062A\u0627\u062A"],
    "admin-departments": ["\u0627\u0644\u0623\u0642\u0633\u0627\u0645", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0648\u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646"],
    "admin-accounting": ["\u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629 \u0648\u0627\u0644\u0631\u0648\u0627\u062A\u0628", "\u0627\u062D\u062A\u0633\u0627\u0628 \u0627\u0644\u0631\u0648\u0627\u062A\u0628 \u0648\u0642\u0633\u0627\u0626\u0645 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646"],
    "admin-holidays": ["\u0627\u0644\u0639\u0637\u0644 \u0627\u0644\u0631\u0633\u0645\u064A\u0629", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0637\u0644 \u0627\u0644\u0631\u0633\u0645\u064A\u0629"],
    "admin-permissions": ["\u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A", "\u0645\u0646\u062D \u0648\u062A\u0639\u062F\u064A\u0644 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645"],
    "admin-announcements": ["\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A", "\u0646\u0634\u0631 \u0648\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A"],
    "admin-employees": ["\u0627\u0644\u0645\u0648\u0638\u0641\u0648\u0646", "\u0625\u0636\u0627\u0641\u0629 \u0648\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646"],
    portal: ["\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0648\u0638\u0641", "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0628 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631"]
  };
  const [title, subtitle] = titles[state.view] || titles.home;
  const bodyRenderer = {
    home: renderEmployeeHome,
    profile: renderProfile,
    requests: renderRequests,
    attendance: renderEmployeeAttendance,
    "department-management": renderDepartmentManagement,
    "admin-dashboard": renderAdminDashboard,
    "admin-requests": renderAdminRequests,
    "admin-attendance": renderAdminAttendance,
    "admin-work-settings": renderAdminWorkSettings,
    "admin-shifts": renderAdminShifts,
    "admin-departments": renderAdminDepartments,
    "admin-accounting": renderAdminAccounting,
    "admin-holidays": renderAdminHolidays,
    "admin-permissions": renderAdminPermissions,
    "admin-announcements": renderAdminAnnouncements,
    "admin-employees": renderAdminEmployees,
    portal: renderPortal
  }[state.view] || renderEmployeeHome;
  const body = bodyRenderer();
  return renderShell(title, subtitle, employeeNav(), body);
}
function renderEmployeeHome() {
  const user = currentUser();
  const todayRecord = state.attendance[user.id] && state.attendance[user.id][todayIso()] ? state.attendance[user.id][todayIso()] : {};
  const holiday = state.holidays[todayIso()];
  const selectedDate = state.selectedDate || todayIso();
  const announcements = Object.values(state.announcements).filter((item) => item.date === selectedDate).filter((item) => item.type === "public" || item.employeeId === user.id).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return `
    <section class="section attendance-punch">
      <div class="section-header">
        <div>
          <h2>\u0627\u0644\u062D\u0636\u0648\u0631 \u0648\u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641</h2>
          <p class="live-clock" data-live-clock>${formatDate(todayIso())} - ${(/* @__PURE__ */ new Date()).toLocaleTimeString("ar-JO")}</p>
        </div>
        <span class="attendance-pill ${holiday ? "holiday" : todayRecord.status || "none"}">${holiday ? "\u0639\u0637\u0644\u0629 \u0631\u0633\u0645\u064A\u0629" : attendanceStatusLabel(todayRecord.status)}</span>
      </div>
      <div class="grid three">
        ${infoItem("\u0627\u0644\u0634\u0641\u062A", shiftLabel(user.shift))}
        ${infoItem("\u0648\u0642\u062A \u0627\u0644\u062D\u0636\u0648\u0631", todayRecord.checkIn || "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u062A\u0633\u062C\u064A\u0644")}
        ${infoItem("\u0648\u0642\u062A \u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641", todayRecord.checkOut || "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u062A\u0633\u062C\u064A\u0644")}
      </div>
      <div class="actions" style="margin-top:16px">
        <button class="primary-button" data-attendance-action="checkIn"><i data-lucide="log-in"></i>\u062A\u0633\u062C\u064A\u0644 \u062D\u0636\u0648\u0631</button>
        <button class="secondary-button" data-attendance-action="checkOut"><i data-lucide="log-out"></i>\u062A\u0633\u062C\u064A\u0644 \u0627\u0646\u0635\u0631\u0627\u0641</button>
      </div>
    </section>
    <section class="section">
      <div class="section-header">
        <div>
          <h2>\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629</h2>
          <p>\u064A\u062A\u0645 \u0639\u0631\u0636 \u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0627\u0644\u064A\u0648\u0645 \u0628\u0634\u0643\u0644 \u0627\u0641\u062A\u0631\u0627\u0636\u064A \u0648\u064A\u0645\u0643\u0646\u0643 \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u062A\u0627\u0631\u064A\u062E.</p>
        </div>
        <div class="field inline-field">
          <label for="announcement-date">\u0627\u0644\u062A\u0627\u0631\u064A\u062E</label>
          <input id="announcement-date" type="date" value="${selectedDate}" />
        </div>
      </div>
      <div class="announcement-list">
        ${announcements.length ? announcements.map(renderAnnouncement).join("") : `<div class="empty">\u0644\u0627 \u062A\u0648\u062C\u062F \u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0644\u0647\u0630\u0627 \u0627\u0644\u062A\u0627\u0631\u064A\u062E.</div>`}
      </div>
    </section>
  `;
}
function renderAnnouncement(item) {
  const isPrivate = item.type === "private";
  const meta = item.publisherName || item.publishedByName ? `\u0646\u0634\u0631 \u0628\u0648\u0627\u0633\u0637\u0629 ${item.publisherName || item.publishedByName} - ${formatDateTime(item.createdAt || item.publishedAt)}` : formatDate(item.date);
  return `
    <article class="announcement ${isPrivate ? "private" : "public"}">
      <span class="badge-icon"><i data-lucide="${isPrivate ? "triangle-alert" : "megaphone"}"></i></span>
      <h3>${isPrivate ? "\u062A\u0646\u0628\u064A\u0647 \u062E\u0627\u0635: " : "\u0625\u0639\u0644\u0627\u0646 \u0639\u0627\u0645: "}${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.body)}</p>
      <p class="hint">${meta}</p>
    </article>
  `;
}
function renderProfile() {
  const employee = currentUser();
  return `
    <section class="section">
      <div class="section-header"><h2>\u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0634\u062E\u0635\u064A\u0629</h2></div>
      <div class="info-list">
        ${infoItem("\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u0631\u0628\u0627\u0639\u064A", employee.fullName)}
        ${infoItem("\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u064A\u0644\u0627\u062F", formatDate(employee.birthDate))}
        ${infoItem("\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0639\u064A\u064A\u0646", formatDate(employee.hireDate))}
        ${infoItem("\u0627\u0644\u062C\u0646\u0633\u064A\u0629", employee.nationality)}
        ${infoItem("\u062A\u0627\u0631\u064A\u062E \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0639\u0642\u062F", formatDate(employee.contractEnd))}
      </div>
    </section>
    <section class="section">
      <div class="section-header"><h2>\u0631\u0635\u064A\u062F \u0627\u0644\u0625\u062C\u0627\u0632\u0627\u062A</h2></div>
      <div class="grid four">
        ${infoItem("\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0633\u0627\u0628\u0642", employee.previousLeave || 0)}
        ${infoItem("\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u062C\u062F\u064A\u062F", employee.newLeave || 0)}
        ${infoItem("\u0627\u0644\u0623\u064A\u0627\u0645 \u0627\u0644\u0645\u0633\u062A\u0647\u0644\u0643\u0629", employee.usedLeave || 0)}
        ${infoItem("\u0627\u0644\u0631\u0635\u064A\u062F \u062D\u062A\u0649 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u064A\u0648\u0645", leaveBalance(employee))}
      </div>
    </section>
    <section class="section">
      <div class="section-header"><h2>\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0639\u0645\u0644</h2></div>
      <div class="info-list">
        ${infoItem("\u0627\u0644\u0645\u0633\u0645\u0649 \u0627\u0644\u0648\u0638\u064A\u0641\u064A", employee.jobTitle)}
        ${infoItem("\u0627\u0644\u0642\u0633\u0645", getEmployeeDepartment(employee.id).name || "\u063A\u064A\u0631 \u0645\u0648\u0632\u0639")}
        ${infoItem("\u0627\u0644\u0634\u0641\u062A", shiftLabel(employee.shift))}
      </div>
    </section>
    <section class="section">
      <div class="section-header"><h2>\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0627\u062A\u0635\u0627\u0644</h2></div>
      <form id="contact-form" class="grid two">
        <div class="field">
          <label>\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0623\u0631\u062F\u0646\u064A</label>
          <input name="phone" value="${employee.phone || ""}" required placeholder="07XXXXXXXX" />
        </div>
        <div class="field">
          <label>\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0628\u062F\u064A\u0644</label>
          <input name="altPhone" value="${employee.altPhone || ""}" placeholder="\u0627\u062E\u062A\u064A\u0627\u0631\u064A" />
        </div>
        <button class="primary-button" type="submit"><i data-lucide="save"></i>\u062D\u0641\u0638 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u062A\u0635\u0627\u0644</button>
      </form>
    </section>
  `;
}
function infoItem(label, value) {
  return `<div class="info-item"><span>${label}</span><strong>${escapeHtml(String(value !== void 0 && value !== null ? value : "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"))}</strong></div>`;
}
function renderRequests() {
  return `
    <section class="section">
      <div class="section-header">
        <h2>\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0637\u0644\u0628\u0627\u062A</h2>
        <button class="secondary-button" data-open-my-requests><i data-lucide="search"></i>\u0637\u0644\u0628\u0627\u062A\u064A</button>
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
        <h2>\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u064A\u0648\u0645</h2>
        <span class="attendance-pill ${todayRecord.status || "none"}">${attendanceStatusLabel(todayRecord.status)}</span>
      </div>
      <div class="grid two">
        ${infoItem("\u0627\u0644\u0634\u0641\u062A \u0627\u0644\u062D\u0627\u0644\u064A", shiftLabel(employee.shift))}
        ${infoItem("\u0628\u062F\u0627\u064A\u0629 \u0627\u0644\u062F\u0648\u0627\u0645", todayRecord.shiftStart || getEmployeeShift(employee.id).start)}
        ${infoItem("\u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u062F\u0648\u0627\u0645", todayRecord.shiftEnd || getEmployeeShift(employee.id).end)}
        ${infoItem("\u0648\u0642\u062A \u0627\u0644\u062D\u0636\u0648\u0631", todayRecord.checkIn || "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u062A\u0633\u062C\u064A\u0644")}
        ${infoItem("\u0648\u0642\u062A \u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641", todayRecord.checkOut || "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u062A\u0633\u062C\u064A\u0644")}
      </div>
      <div class="actions" style="margin-top:16px">
        <button class="primary-button" data-attendance-action="checkIn"><i data-lucide="log-in"></i>\u062A\u0633\u062C\u064A\u0644 \u062D\u0636\u0648\u0631</button>
        <button class="secondary-button" data-attendance-action="checkOut"><i data-lucide="log-out"></i>\u062A\u0633\u062C\u064A\u0644 \u0627\u0646\u0635\u0631\u0627\u0641</button>
      </div>
    </section>
    <section class="section">
      <div class="section-header"><h2>\u0633\u062C\u0644 \u0627\u0644\u062D\u0636\u0648\u0631</h2></div>
      ${renderAttendanceTable(records, false)}
    </section>
  `;
}
function renderDepartmentManagement() {
  const departmentIds = manageableDepartmentIds();
  if (!departmentIds.length) {
    return `<section class="section"><div class="empty">\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0642\u0633\u0627\u0645 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0635\u0644\u0627\u062D\u064A\u0627\u062A\u0643 \u0627\u0644\u062D\u0627\u0644\u064A\u0629.</div></section>`;
  }
  const activeDepartmentId = sessionStorage.getItem("manager-department") || departmentIds[0];
  const departmentId = departmentIds.includes(activeDepartmentId) ? activeDepartmentId : departmentIds[0];
  const department = state.departments[departmentId] || {};
  const employeeIds = departmentEmployeeIds(departmentId);
  const departmentEmployees = employeeIds.map((id) => state.employees[id]).filter(Boolean);
  const departmentRequests = filterRequests({ status: "all" }).filter((request) => employeeIds.includes(request.employeeId));
  const attendanceRows = employeeIds.flatMap(
    (employeeId) => attendanceRecordsFor(employeeId, todayIso().slice(0, 7)).map((record) => normalizeAttendanceRecord(__spreadProps(__spreadValues({}, record), { employeeId })))
  );
  const canViewEmployees = employeeHasPermission("viewDepartmentEmployees", departmentId);
  const canSendNotices = employeeHasPermission("sendDepartmentNotices", departmentId);
  const canReviewRequests = employeeHasPermission("reviewRequests", departmentId);
  const canViewAttendance = employeeHasPermission("viewAttendance", departmentId);
  const canChangeShifts = employeeHasPermission("changeDepartmentShifts", departmentId);
  const canEditAttendance = employeeHasPermission("editAttendance", departmentId);
  const canEditEmployees = employeeHasPermission("editDepartmentEmployees", departmentId);
  return `
    <section class="section">
      <div class="section-header">
        <h2>${escapeHtml(department.name || "\u0642\u0633\u0645")}</h2>
        <form id="manager-department-switch" class="toolbar">
          <div class="field">
            <label>\u0627\u0644\u0642\u0633\u0645</label>
            <select name="departmentId">
              ${departmentIds.map((id) => `<option value="${id}" ${id === departmentId ? "selected" : ""}>${escapeHtml(state.departments[id] && state.departments[id].name ? state.departments[id].name : id)}</option>`).join("")}
            </select>
          </div>
          <button class="secondary-button" type="submit"><i data-lucide="refresh-cw"></i>\u0639\u0631\u0636</button>
        </form>
      </div>
      <div class="metric-strip">
        <div class="metric"><span>\u0645\u0648\u0638\u0641\u0648 \u0627\u0644\u0642\u0633\u0645</span><strong>${departmentEmployees.length}</strong></div>
        <div class="metric"><span>\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0642\u0633\u0645</span><strong>${departmentRequests.length}</strong></div>
        <div class="metric late"><span>\u062A\u0623\u062E\u064A\u0631 \u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631</span><strong>${attendanceRows.filter((record) => record.status === "late").length}</strong></div>
        <div class="metric absent"><span>\u063A\u064A\u0627\u0628 \u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631</span><strong>${attendanceRows.filter((record) => record.status === "absent").length}</strong></div>
      </div>
    </section>
    ${canSendNotices ? `
      <section class="section">
        <div class="section-header"><h2>\u0625\u0634\u0639\u0627\u0631 \u0645\u0648\u0638\u0641\u064A \u0627\u0644\u0642\u0633\u0645</h2></div>
        <form id="department-notice-form" class="grid">
          <div class="field"><label>\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0625\u0634\u0639\u0627\u0631</label><input name="title" required placeholder="\u062A\u0646\u0628\u064A\u0647 \u0642\u0633\u0645 ${escapeAttr(department.name || "")}" /></div>
          ${textareaField("body", "\u0646\u0635 \u0627\u0644\u0625\u0634\u0639\u0627\u0631", true)}
          <button class="primary-button" type="submit"><i data-lucide="send"></i>\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0625\u0634\u0639\u0627\u0631</button>
        </form>
      </section>
    ` : ""}
    ${canChangeShifts ? `
      <section class="section">
        <div class="section-header"><h2>\u062A\u063A\u064A\u064A\u0631 \u0634\u0641\u062A \u0645\u0648\u0638\u0641 \u0641\u064A \u0627\u0644\u0642\u0633\u0645</h2></div>
        <form id="department-shift-form" class="grid two">
          <div class="field">
            <label>\u0627\u0644\u0645\u0648\u0638\u0641</label>
            <select name="employeeId" required>
              ${departmentEmployees.map((employee) => `<option value="${employee.id}">${employee.id} - ${escapeHtml(employee.fullName)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>\u0627\u0644\u0634\u0641\u062A \u0627\u0644\u062C\u062F\u064A\u062F</label>
            <select name="shift" required>
              ${Object.entries(getShifts()).map(([id, shift]) => `<option value="${id}">${escapeHtml(shift.label)} (${shift.start} - ${shift.end})</option>`).join("")}
            </select>
          </div>
          <button class="primary-button" type="submit"><i data-lucide="calendar-range"></i>\u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0634\u0641\u062A \u0648\u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u0645\u0648\u0638\u0641</button>
        </form>
      </section>
    ` : ""}
    <section class="section">
      <div class="section-header"><h2>\u0645\u0648\u0638\u0641\u0648 \u0627\u0644\u0642\u0633\u0645</h2></div>
      ${canViewEmployees ? `
        <div class="info-list">
          ${departmentEmployees.map((employee) => `
            <div class="info-item">
              <span>${employee.id}</span>
              <strong>${escapeHtml(employee.fullName)} - ${escapeHtml(employee.jobTitle || "")} - ${shiftLabel(employee.shift)}</strong>
              ${canEditEmployees ? `<button class="secondary-button" data-edit-employee="${employee.id}"><i data-lucide="pencil"></i>\u062A\u0639\u062F\u064A\u0644</button>` : ""}
            </div>
          `).join("")}
        </div>
      ` : `<div class="empty">\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0639\u0631\u0636 \u0645\u0648\u0638\u0641\u064A \u0627\u0644\u0642\u0633\u0645.</div>`}
    </section>
    <section class="section">
      <div class="section-header"><h2>\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0642\u0633\u0645</h2></div>
      ${canReviewRequests ? renderRequestsTable(departmentRequests, true) : `<div class="empty">\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0645\u0631\u0627\u062C\u0639\u0629 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0642\u0633\u0645.</div>`}
    </section>
    <section class="section">
      <div class="section-header">
        <h2>\u062F\u0648\u0627\u0645 \u0627\u0644\u0642\u0633\u0645 \u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631</h2>
        ${canEditAttendance && departmentEmployees[0] ? `<button class="secondary-button" data-open-attendance-editor="${departmentEmployees[0].id}"><i data-lucide="calendar-plus"></i>\u062A\u0633\u062C\u064A\u0644 \u0623\u0648 \u062A\u0639\u062F\u064A\u0644 \u064A\u0648\u0645</button>` : ""}
      </div>
      ${canViewAttendance ? renderAttendanceTable(attendanceRows.sort((a, b) => String(b.date).localeCompare(String(a.date))), true) : `<div class="empty">\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0639\u0631\u0636 \u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u062F\u0648\u0627\u0645.</div>`}
    </section>
  `;
}
function attendanceRecordsFor(employeeId, month = "") {
  return Object.values(state.attendance[employeeId] || {}).filter((record) => !month || String(record.date || "").startsWith(month)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
function normalizeAttendanceRecord(record) {
  const shift = getEmployeeShift(record.employeeId);
  const normalized = __spreadProps(__spreadValues({}, record), {
    shiftStart: record.shiftStart || shift.start,
    shiftEnd: record.shiftEnd || shift.end
  });
  if (isNoDeductionDay(normalized.date) && !normalized.checkIn && !normalized.checkOut) {
    return __spreadProps(__spreadValues({}, normalized), { status: "holiday", notes: normalized.notes || "\u064A\u0648\u0645 \u0644\u0627 \u064A\u062E\u0635\u0645" });
  }
  if (!normalized.checkIn && !normalized.checkOut && !isNoDeductionDay(normalized.date)) {
    return __spreadProps(__spreadValues({}, normalized), { status: "absent" });
  }
  if (normalized.checkIn) {
    return __spreadProps(__spreadValues({}, normalized), { status: isLateTime(normalized.checkIn, normalized.shiftStart) ? "late" : "present" });
  }
  return normalized;
}
function renderAttendanceTable(records, adminMode) {
  const normalizedRecords = records.map(normalizeAttendanceRecord);
  if (!normalizedRecords.length) return `<div class="empty">\u0644\u0627 \u062A\u0648\u062C\u062F \u0633\u062C\u0644\u0627\u062A \u062D\u0636\u0648\u0631 \u0636\u0645\u0646 \u0647\u0630\u0627 \u0627\u0644\u0646\u0637\u0627\u0642.</div>`;
  return `
    <div class="table-wrap">
      <table class="attendance-table">
        <thead>
          <tr>
            ${adminMode ? "<th>\u0627\u0644\u0645\u0648\u0638\u0641</th>" : ""}
            <th>\u0627\u0644\u062A\u0627\u0631\u064A\u062E</th>
            <th>\u0627\u0644\u062D\u0627\u0644\u0629</th>
            <th>\u0628\u062F\u0627\u064A\u0629 \u0627\u0644\u062F\u0648\u0627\u0645</th>
            <th>\u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u062F\u0648\u0627\u0645</th>
            <th>\u0627\u0644\u062D\u0636\u0648\u0631</th>
            <th>\u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641</th>
            <th>\u0627\u0644\u0633\u0627\u0639\u0627\u062A \u0627\u0644\u0645\u062D\u062A\u0633\u0628\u0629</th>
            <th>\u0645\u0644\u0627\u062D\u0638\u0627\u062A</th>
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
  return isOfficialHoliday(record.date) || record.status === "holiday" ? "holiday" : record.status || "present";
}
function attendanceStatusLabel(status, date = "") {
  if (date && isOfficialHoliday(date) || status === "holiday") return "\u0639\u0637\u0644\u0629 \u0631\u0633\u0645\u064A\u0629";
  return {
    present: "\u062D\u0627\u0636\u0631",
    late: "\u0645\u062A\u0623\u062E\u0631",
    absent: "\u063A\u0627\u0626\u0628",
    none: "\u0644\u0645 \u064A\u0633\u062C\u0644"
  }[status || "none"] || "\u0644\u0645 \u064A\u0633\u062C\u0644";
}
function isOfficialHoliday(date) {
  return Boolean(state.holidays[date]);
}
function isFriday(date) {
  return new Date(date).getDay() === 5;
}
function isNoDeductionDay(date) {
  const settings = getSettings();
  return settings.fridayNoDeduction && isFriday(date) || settings.officialHolidayNoDeduction && isOfficialHoliday(date);
}
function getSettings() {
  return __spreadValues(__spreadValues({}, defaultSettings), state.settings || {});
}
function shiftLabel(shiftId = "morning") {
  const allShifts = getShifts();
  return allShifts[shiftId] ? allShifts[shiftId].label : allShifts.morning ? allShifts.morning.label : "\u0634\u0641\u062A";
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
function payrollProfile(employeeId) {
  const profile = ((state.payroll || {}).profiles || {})[employeeId] || {};
  return {
    baseSalary: Number(profile.baseSalary || 0),
    socialSecurity: Number(profile.socialSecurity || 0),
    allowances: profile.allowances || {},
    notes: profile.notes || ""
  };
}
function monthKeyFromDate(value) {
  return String(value || "").slice(0, 7);
}
function monthDays(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex, 0).getDate();
}
function dayRate(employeeId, month) {
  return payrollProfile(employeeId).baseSalary / monthDays(month);
}
function hourlyRate(employeeId, month) {
  const shift = getEmployeeShift(employeeId);
  const dailyHours = durationHours(shift.start || "07:00", shift.end || "16:00") || 8;
  return dayRate(employeeId, month) / dailyHours;
}
function parseMoneyValue(value) {
  const normalized = String(value || "0").replace(/[^\d.-]/g, "");
  return Number(normalized || 0);
}
function moneyValue(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
function isDateBetween(date, start, end) {
  return date >= start && date <= end;
}
function approvedLeaveForDate(employeeId, date) {
  return Object.values(state.requests || {}).find(
    (request) => request.employeeId === employeeId && request.type === "leave" && request.status === "approved" && request.details && isDateBetween(date, request.details.startDate, request.details.endDate)
  );
}
function payrollOvertime(record, employeeId, month) {
  if (!record.checkIn || !record.checkOut) return { normalHours: 0, holidayHours: 0, normalAmount: 0, holidayAmount: 0 };
  const settings = getSettings();
  const rate = hourlyRate(employeeId, month);
  if (isOfficialHoliday(record.date) || isFriday(record.date)) {
    const holidayHours = durationHours(record.checkIn, record.checkOut);
    return {
      normalHours: 0,
      holidayHours,
      normalAmount: 0,
      holidayAmount: moneyValue(holidayHours * rate * Number(settings.holidayOvertimeRate || 1.5))
    };
  }
  const shift = getEmployeeShift(employeeId);
  const overtimeAfter = record.overtimeAfter || shift.overtimeAfter || getSettings().overtimeAfter || shift.end;
  const extraStart = Math.max(timeToMinutes(record.checkIn), normalizeShiftMinute(timeToMinutes(overtimeAfter), timeToMinutes(record.checkIn)));
  let endMinutes = timeToMinutes(record.checkOut);
  const checkInMinutes = timeToMinutes(record.checkIn);
  if (endMinutes < checkInMinutes) endMinutes += 24 * 60;
  const normalHours = Math.max(0, (endMinutes - extraStart) / 60);
  return {
    normalHours,
    holidayHours: 0,
    normalAmount: moneyValue(normalHours * rate * Number(settings.overtimeRate || 1.25)),
    holidayAmount: 0
  };
}
function payrollAbsenceDeduction(record, employeeId, month) {
  if (record.status !== "absent" || isNoDeductionDay(record.date)) return { amount: 0, reason: "" };
  const leave = approvedLeaveForDate(employeeId, record.date);
  if (leave && leave.details && leave.details.leaveType === "\u0645\u062D\u0633\u0648\u0645\u0629") {
    return { amount: moneyValue(dayRate(employeeId, month)), reason: "\u0625\u062C\u0627\u0632\u0629 \u0645\u062D\u0633\u0648\u0645\u0629 \u0645\u0639\u062A\u0645\u062F\u0629" };
  }
  if (leave) return { amount: 0, reason: "\u0625\u062C\u0627\u0632\u0629 \u0645\u0639\u062A\u0645\u062F\u0629" };
  return { amount: moneyValue(dayRate(employeeId, month) * 2), reason: "\u063A\u064A\u0627\u0628 \u062F\u0648\u0646 \u0625\u0630\u0646" };
}
function approvedAdvancesForEmployee(employeeId) {
  return Object.entries(state.requests || {}).map(([id, request]) => __spreadValues({ id }, request)).filter((request) => request.employeeId === employeeId && request.type === "advance" && request.status === "approved");
}
function advanceInstallmentForMonth(request, month) {
  const details = request.details || {};
  const startMonth = monthKeyFromDate(details.deductionStart || details.advanceDate);
  if (!startMonth || month < startMonth) return 0;
  const installments = Math.max(1, Number(details.installments || 1));
  const start = /* @__PURE__ */ new Date(startMonth + "-01");
  const current = /* @__PURE__ */ new Date(month + "-01");
  const index = (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth();
  if (index < 0 || index >= installments) return 0;
  if (((state.payroll.advanceDelays || {})[request.id] || {})[month]) return 0;
  return moneyValue(parseMoneyValue(details.amount) / installments);
}
function payrollManualAdjustments(employeeId, month) {
  return (((state.payroll.slips || {})[employeeId] || {})[month] || {}).manualItems || {};
}
function payrollOverrides(employeeId, month) {
  return (((state.payroll.slips || {})[employeeId] || {})[month] || {}).overrides || {};
}
function applyPayrollOverrides(items, overrides) {
  return items.map((item) => {
    const override = overrides[item.id] || {};
    return __spreadProps(__spreadValues({}, item), {
      label: override.label || item.label,
      amount: override.amount !== void 0 ? Number(override.amount || 0) : item.amount,
      hidden: Boolean(override.hidden)
    });
  }).filter((item) => !item.hidden);
}
function computePayroll(employeeId, month) {
  const employee = state.employees[employeeId] || {};
  const profile = payrollProfile(employeeId);
  const records = attendanceRecordsFor(employeeId, month).map((record) => normalizeAttendanceRecord(__spreadProps(__spreadValues({}, record), { employeeId })));
  const allowances = Object.entries(profile.allowances || {}).map(([id, item]) => ({ id, type: "earning", kind: "earning", label: item.label || id, amount: Number(item.amount || 0), automatic: true }));
  const overtimeRows = records.map((record) => payrollOvertime(record, employeeId, month));
  const overtimeAmount = moneyValue(overtimeRows.reduce((sum, item) => sum + item.normalAmount, 0));
  const holidayWorkAmount = moneyValue(overtimeRows.reduce((sum, item) => sum + item.holidayAmount, 0));
  const normalOvertimeHours = roundHours(overtimeRows.reduce((sum, item) => sum + item.normalHours, 0));
  const holidayHours = roundHours(overtimeRows.reduce((sum, item) => sum + item.holidayHours, 0));
  const absenceRows = records.map((record) => payrollAbsenceDeduction(record, employeeId, month)).filter((item) => item.amount);
  const absenceDeduction = moneyValue(absenceRows.reduce((sum, item) => sum + item.amount, 0));
  const advances = approvedAdvancesForEmployee(employeeId).map((request) => ({ request, amount: advanceInstallmentForMonth(request, month) })).filter((item) => item.amount);
  const advanceDeduction = moneyValue(advances.reduce((sum, item) => sum + item.amount, 0));
  const manualItems = Object.entries(payrollManualAdjustments(employeeId, month)).map(([id, item]) => __spreadProps(__spreadValues({ id }, item), { amount: Number(item.amount || 0) }));
  const overrides = payrollOverrides(employeeId, month);
  const earnings = applyPayrollOverrides([
    { id: "baseSalary", kind: "earning", label: "\u0627\u0644\u0631\u0627\u062A\u0628 \u0627\u0644\u0623\u0633\u0627\u0633\u064A", amount: profile.baseSalary, automatic: true },
    ...allowances,
    { id: "overtime", kind: "earning", label: `\u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0625\u0636\u0627\u0641\u064A (${normalOvertimeHours} \u0633\u0627\u0639\u0629)`, amount: overtimeAmount, automatic: true },
    { id: "holidayWork", kind: "earning", label: `\u0625\u0643\u0631\u0627\u0645\u064A\u0629 \u0627\u0644\u0639\u0637\u0644 \u0627\u0644\u0631\u0633\u0645\u064A\u0629/\u0627\u0644\u062C\u0645\u0639\u0629 (${holidayHours} \u0633\u0627\u0639\u0629)`, amount: holidayWorkAmount, automatic: true },
    ...manualItems.filter((item) => item.kind === "earning").map((item) => __spreadProps(__spreadValues({}, item), { automatic: false }))
  ], overrides);
  const deductions = applyPayrollOverrides([
    { id: "socialSecurity", kind: "deduction", label: "\u0627\u0644\u0636\u0645\u0627\u0646 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A", amount: profile.socialSecurity, automatic: true },
    { id: "absence", kind: "deduction", label: `\u062E\u0635\u0645 \u0627\u0644\u063A\u064A\u0627\u0628 (${absenceRows.length} \u064A\u0648\u0645)`, amount: absenceDeduction, automatic: true },
    { id: "advance", kind: "deduction", label: `\u0627\u0644\u0633\u0644\u0641 (${advances.length})`, amount: advanceDeduction, automatic: true },
    ...manualItems.filter((item) => item.kind === "deduction").map((item) => __spreadProps(__spreadValues({}, item), { automatic: false }))
  ], overrides);
  const totalIncome = moneyValue(earnings.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const totalDeductions = moneyValue(deductions.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const savedSlip = ((state.payroll.slips || {})[employeeId] || {})[month] || {};
  return {
    employeeId,
    employeeName: employee.fullName || employeeId,
    month,
    status: savedSlip.status || "draft",
    publishedAt: savedSlip.publishedAt || "",
    profile,
    earnings,
    deductions,
    advances,
    absenceRows,
    totalIncome,
    totalDeductions,
    netSalary: moneyValue(totalIncome - totalDeductions)
  };
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
  }).format(/* @__PURE__ */ new Date());
}
function isLateTime(time, shiftStart = "08:00") {
  return timeToMinutes(time) > timeToMinutes(shiftStart) + Number(getSettings().lateGraceMinutes || 0);
}
function timeToMinutes(value = "00:00") {
  const [hours, minutes] = String(value).split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}
function renderPortal() {
  const employee = currentUser();
  const activePortalCard = sessionStorage.getItem("portal-card") || "payslip";
  const payslipYear = sessionStorage.getItem("payslip-year") || String((/* @__PURE__ */ new Date()).getFullYear());
  const payslipMonth = sessionStorage.getItem("payslip-month") || String((/* @__PURE__ */ new Date()).getMonth() + 1).padStart(2, "0");
  const month = `${payslipYear}-${payslipMonth}`;
  const savedSlip = ((state.payroll.slips || {})[employee.id] || {})[month] || {};
  const payslip = savedSlip.status === "published" ? savedSlip.snapshot || computePayroll(employee.id, month) : null;
  return `
    <section class="section">
      <div class="portal-grid">
        <button class="portal-tile ${activePortalCard === "payslip" ? "active" : ""}" data-portal-card="payslip">
          <i data-lucide="receipt-text"></i>
          <span>\u0642\u0633\u064A\u0645\u0629 \u0627\u0644\u0631\u0627\u062A\u0628</span>
        </button>
        <button class="portal-tile ${activePortalCard === "password" ? "active" : ""}" data-portal-card="password">
          <i data-lucide="key-round"></i>
          <span>\u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631</span>
        </button>
      </div>
    </section>
    ${activePortalCard === "payslip" ? `
      <section class="section">
        <div class="section-header"><h2>\u0642\u0633\u064A\u0645\u0629 \u0627\u0644\u0631\u0627\u062A\u0628</h2></div>
        <form id="payslip-filter-form" class="toolbar">
          <div class="field"><label>\u0627\u0644\u0633\u0646\u0629</label><input name="year" type="number" min="2026" max="2035" value="${payslipYear}" /></div>
          <div class="field"><label>\u0627\u0644\u0634\u0647\u0631</label><select name="month">${Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((item) => `<option value="${item}" ${item === payslipMonth ? "selected" : ""}>${item}</option>`).join("")}</select></div>
          <button class="secondary-button" type="submit"><i data-lucide="search"></i>\u0639\u0631\u0636 \u0627\u0644\u0642\u0633\u064A\u0645\u0629</button>
        </form>
        ${payslip ? renderPayrollReport(payslip, false) : `<div class="empty">\u0644\u0645 \u064A\u062A\u0645 \u0646\u0634\u0631 \u0642\u0633\u064A\u0645\u0629 \u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631 \u0628\u0639\u062F.</div>`}
      </section>
    ` : `
      <section class="section">
        <div class="section-header"><h2>\u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631</h2></div>
        <form id="password-form" class="grid two">
          <div class="field">
            <label>\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629</label>
            <input name="oldPassword" type="password" required />
          </div>
          <div class="field">
            <label>\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629</label>
            <input name="newPassword" type="password" required minlength="4" />
          </div>
          <button class="primary-button" type="submit"><i data-lucide="key-round"></i>\u062A\u062D\u062F\u064A\u062B \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631</button>
        </form>
      </section>
    `}
  `;
}
function bindCommon() {
  document.querySelectorAll("[data-menu-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      state.sidebarOpen = !state.sidebarOpen;
      render();
    });
  });
  document.querySelectorAll("[data-menu-close]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      state.sidebarOpen = false;
      render();
    });
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.session && state.session.role === "employee" && !employeeCanAccessView(button.dataset.view)) {
        toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0641\u062A\u062D \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645", "error");
        return;
      }
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
      toast("\u064A\u062C\u0628 \u0625\u062F\u062E\u0627\u0644 \u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0623\u0631\u062F\u0646\u064A \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0628\u0635\u064A\u063A\u0629 07XXXXXXXX", "error");
      return;
    }
    await update(ref(db, `employees/${state.session.id}`), data);
    toast("\u062A\u0645 \u062D\u0641\u0638 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u062A\u0635\u0627\u0644");
  });
  const passwordForm = document.getElementById("password-form");
  if (passwordForm) passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    const employee = currentUser();
    if (employee.password !== data.oldPassword) {
      toast("\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", "error");
      return;
    }
    await update(ref(db, `employees/${state.session.id}`), { password: data.newPassword });
    event.target.reset();
    toast("\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631");
  });
  const payslipFilterForm = document.getElementById("payslip-filter-form");
  if (payslipFilterForm) payslipFilterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    sessionStorage.setItem("payslip-year", data.year || String((/* @__PURE__ */ new Date()).getFullYear()));
    sessionStorage.setItem("payslip-month", data.month || "01");
    render();
  });
  document.querySelectorAll("[data-portal-card]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("portal-card", button.dataset.portalCard);
      render();
    });
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
    if (!employeeHasPermission("sendDepartmentNotices", departmentId)) {
      toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0625\u0631\u0633\u0627\u0644 \u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0644\u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645", "error");
      return;
    }
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
        publisherName: currentUser().fullName || "\u0645\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0646\u0638\u0627\u0645"
      })));
      event.target.reset();
      toast("\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0625\u0634\u0639\u0627\u0631 \u0644\u0645\u0648\u0638\u0641\u064A \u0627\u0644\u0642\u0633\u0645");
    } catch (error) {
      console.error(error);
      toast("\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0625\u0634\u0639\u0627\u0631", "error");
    }
  });
  const departmentShiftForm = document.getElementById("department-shift-form");
  if (departmentShiftForm) departmentShiftForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const departmentId = sessionStorage.getItem("manager-department") || manageableDepartmentIds()[0];
    if (!employeeHasPermission("changeDepartmentShifts", departmentId)) {
      toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u063A\u064A\u064A\u0631 \u0634\u0641\u062A\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645", "error");
      return;
    }
    const data = Object.fromEntries(new FormData(event.target).entries());
    if (!departmentEmployeeIds(departmentId).includes(data.employeeId)) {
      toast("\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u062A\u0627\u0628\u0639 \u0644\u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645", "error");
      return;
    }
    try {
      await update(ref(db, `employees/${data.employeeId}`), { shift: data.shift });
      await push(ref(db, "announcements"), {
        title: "\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0634\u0641\u062A",
        body: `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0634\u0641\u062A\u0643 \u0625\u0644\u0649 ${shiftLabel(data.shift)} \u0645\u0646 \u0642\u0628\u0644 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0642\u0633\u0645.`,
        type: "private",
        employeeId: data.employeeId,
        date: todayIso(),
        createdAt: Date.now(),
        publisherId: state.session.id,
        publisherName: currentUser().fullName || "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0642\u0633\u0645"
      });
      event.target.reset();
      toast("\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0634\u0641\u062A \u0648\u0625\u0631\u0633\u0627\u0644 \u0625\u0634\u0639\u0627\u0631 \u0644\u0644\u0645\u0648\u0638\u0641");
    } catch (error) {
      console.error(error);
      toast("\u062A\u0639\u0630\u0631 \u062A\u063A\u064A\u064A\u0631 \u0634\u0641\u062A \u0627\u0644\u0645\u0648\u0638\u0641", "error");
    }
  });
  const attendanceEditorButton = document.querySelector("[data-open-attendance-editor]");
  if (attendanceEditorButton) attendanceEditorButton.addEventListener("click", (event) => {
    const employeeId = event.currentTarget.dataset.openAttendanceEditor;
    if (!canManageEmployeeInDepartment(employeeId, "editAttendance")) {
      toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u062F\u0648\u0627\u0645 \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0638\u0641", "error");
      return;
    }
    openAttendanceEditor(employeeId);
  });
  document.querySelectorAll("[data-edit-employee]").forEach((button) => {
    button.addEventListener("click", () => {
      const employeeId = button.dataset.editEmployee;
      if (!canManageEmployeeInDepartment(employeeId, "editDepartmentEmployees")) {
        toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0638\u0641", "error");
        return;
      }
      openDepartmentEmployeeEditor(employeeId);
    });
  });
  if (employeeAdminViews[state.view] && employeeCanAccessView(state.view)) {
    bindPermittedAdminActions();
  }
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
  const next = __spreadProps(__spreadValues({}, current), {
    employeeId,
    date,
    shiftStart: current.shiftStart || shift.start,
    shiftEnd: current.shiftEnd || shift.end
  });
  if (action === "checkIn") {
    next.checkIn = now;
    next.status = isLateTime(now, next.shiftStart) ? "late" : "present";
    next.notes = next.status === "late" ? "\u062A\u0623\u062E\u064A\u0631 \u0641\u064A \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062D\u0636\u0648\u0631" : next.notes || "";
  } else {
    next.checkOut = now;
    next.status = next.checkIn && isLateTime(next.checkIn, next.shiftStart) ? "late" : next.status === "absent" ? "present" : next.status || "present";
  }
  try {
    await set(ref(db, `attendance/${employeeId}/${date}`), next);
    toast(action === "checkIn" ? "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062D\u0636\u0648\u0631" : "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641");
  } catch (error) {
    console.error(error);
    toast("\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0633\u062C\u0644 \u0627\u0644\u062D\u0636\u0648\u0631. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0635\u0644\u0627\u062D\u064A\u0627\u062A Firebase.", "error");
  }
}
function isJordanPhone(value) {
  return /^07[789]\d{7}$/.test(String(value || "").trim());
}
function startLiveClock() {
  const clock = document.querySelector("[data-live-clock]");
  if (!clock) return;
  const updateClock = () => {
    clock.textContent = `${formatDate(todayIso())} - ${(/* @__PURE__ */ new Date()).toLocaleTimeString("ar-JO", { hour12: false })}`;
  };
  updateClock();
  clearInterval(window.factoryClockTimer);
  window.factoryClockTimer = setInterval(updateClock, 1e3);
}
function openMyRequestsModal() {
  const employeeId = state.session.id;
  openModal(`
    <h2>\u0637\u0644\u0628\u0627\u062A\u064A</h2>
    <form id="my-requests-filter" class="toolbar">
      <div class="field">
        <label>\u0627\u0644\u0633\u0646\u0629</label>
        <select name="year">
          <option value="2026">2026</option>
          <option value="2027">2027</option>
        </select>
      </div>
      <div class="field">
        <label>\u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628</label>
        <select name="status">
          ${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
        </select>
      </div>
      <button class="primary-button" type="submit"><i data-lucide="table"></i>\u0639\u0631\u0636 \u0627\u0644\u0646\u062A\u0627\u0626\u062C</button>
    </form>
    <div id="my-requests-results">${renderRequestsTable(filterRequests({ employeeId, year: "2026", status: "all" }), false)}</div>
  `);
  document.getElementById("my-requests-filter").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    document.getElementById("my-requests-results").innerHTML = renderRequestsTable(filterRequests(__spreadValues({ employeeId }, data)), false);
    hydrateIcons();
  });
}
function filterRequests({ employeeId, year, status }) {
  return Object.entries(state.requests).map(([id, item]) => __spreadValues({ id }, item)).filter((item) => !employeeId || item.employeeId === employeeId).filter((item) => !year || String(item.createdAtDate || item.date || "").startsWith(year)).filter((item) => status === "all" || !status || item.status === status).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}
function renderRequestsTable(items, adminMode) {
  if (!items.length) return `<div class="empty">\u0644\u0627 \u062A\u0648\u062C\u062F \u0637\u0644\u0628\u0627\u062A \u0645\u0637\u0627\u0628\u0642\u0629.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>\u0627\u0644\u062A\u0627\u0631\u064A\u062E</th>
            ${adminMode ? "<th>\u0627\u0644\u0645\u0648\u0638\u0641</th>" : ""}
            <th>\u0646\u0648\u0639 \u0627\u0644\u0637\u0644\u0628</th>
            <th>\u0627\u0644\u062D\u0627\u0644\u0629</th>
            <th>\u0639\u0631\u0636</th>
            <th>\u0625\u062C\u0631\u0627\u0621\u0627\u062A</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td>${formatDate(item.createdAtDate || item.date)}</td>
              ${adminMode ? `<td>${escapeHtml(employeeName(item.employeeId))}</td>` : ""}
              <td>${requestTitles[item.type] || item.customName || "\u0637\u0644\u0628"}</td>
              <td><span class="status ${item.deleted ? "deleted" : item.status}">${item.deleted ? statusLabels.deleted : statusLabels[item.status]}</span></td>
              <td><button class="icon-button" title="\u0639\u0631\u0636 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644" data-view-request="${item.id}"><i data-lucide="eye"></i></button></td>
              ${!adminMode ? `<td>${!item.deleted && item.status === "pending" ? `<button class="danger-button" data-cancel-request="${item.id}"><i data-lucide="ban"></i>\u0625\u0644\u063A\u0627\u0621</button>` : ""}</td>` : ""}
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
    return `<span class="hint">\u0645\u0642\u0641\u0644 \u0628\u0639\u062F \u0627\u0644\u062D\u0630\u0641</span>`;
  }
  if (!canReviewRequest(item)) {
    return `<span class="hint">\u0628\u062F\u0648\u0646 \u0635\u0644\u0627\u062D\u064A\u0629 \u0625\u062C\u0631\u0627\u0621</span>`;
  }
  return `
    <div class="actions">
      <button class="secondary-button" data-status-request="${item.id}" data-status-value="approved"><i data-lucide="check"></i>\u0645\u0648\u0627\u0641\u0642\u0629</button>
      <button class="danger-button" data-status-request="${item.id}" data-status-value="rejected"><i data-lucide="x"></i>\u0631\u0641\u0636</button>
      <button class="secondary-button" data-status-request="${item.id}" data-status-value="cancelled"><i data-lucide="ban"></i>\u0625\u0644\u063A\u0627\u0621</button>
      ${canDeleteRequest(item) ? `<button class="danger-button" data-delete-request="${item.id}"><i data-lucide="archive-x"></i>\u062D\u0630\u0641</button>` : ""}
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
    toast("\u064A\u0645\u0643\u0646 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0637\u0644\u0628 \u0641\u0642\u0637 \u0625\u0630\u0627 \u0643\u0627\u0646 \u0642\u064A\u062F \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631", "error");
    return;
  }
  try {
    await update(ref(db, `requests/${id}`), {
      status: "cancelled",
      cancelledAt: Date.now(),
      cancelledBy: state.session.id
    });
    toast("\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0637\u0644\u0628");
    const results = document.getElementById("my-requests-results");
    if (results) {
      results.innerHTML = renderRequestsTable(filterRequests({ employeeId: state.session.id, year: "2026", status: "all" }), false);
      hydrateIcons();
    }
  } catch (error) {
    console.error(error);
    toast("\u062A\u0639\u0630\u0631 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0637\u0644\u0628", "error");
  }
}
async function softDeleteRequest(id) {
  const request = state.requests[id];
  if (!request) {
    toast("\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", "error");
    return;
  }
  if (!canDeleteRequest(request)) {
    toast("\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062D\u0630\u0641 \u0627\u0644\u0637\u0644\u0628\u0627\u062A", "error");
    return;
  }
  if (request.deleted) {
    toast("\u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628 \u0645\u062D\u0630\u0648\u0641 \u0648\u0645\u0642\u0641\u0644 \u0645\u0633\u0628\u0642\u064B\u0627", "error");
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
    toast("\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0637\u0644\u0628 \u0648\u0623\u0635\u0628\u062D \u0645\u0642\u0641\u0644\u064B\u0627 \u0641\u064A \u0627\u0644\u0633\u062C\u0644");
  } catch (error) {
    console.error(error);
    toast("\u062A\u0639\u0630\u0631 \u062D\u0630\u0641 \u0627\u0644\u0637\u0644\u0628", "error");
  }
}
function openRequestDetails(id) {
  const request = state.requests[id];
  if (!request) return;
  const detailRows = Object.entries(request.details || {}).filter(([, value]) => value !== "" && value !== void 0 && value !== null).map(([key, value]) => infoItem(detailLabel(key), String(value))).join("");
  openModal(`
    <h2>\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0637\u0644\u0628</h2>
    <div class="grid two">
      ${infoItem("\u0627\u0644\u0645\u0648\u0638\u0641", employeeName(request.employeeId))}
      ${infoItem("\u0646\u0648\u0639 \u0627\u0644\u0637\u0644\u0628", requestTitles[request.type] || request.customName)}
      ${infoItem("\u0627\u0644\u062D\u0627\u0644\u0629", request.deleted ? statusLabels.deleted : statusLabels[request.status])}
      ${infoItem("\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0631\u0633\u0627\u0644", formatDate(request.createdAtDate))}
    </div>
    <div class="section" style="margin-top:16px">
      <h3>\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0637\u0644\u0628</h3>
      <div class="info-list" style="margin-top:12px">${detailRows}</div>
      ${request.attachmentUrl ? `<p><a class="secondary-button" href="${request.attachmentUrl}" target="_blank" rel="noreferrer"><i data-lucide="paperclip"></i>\u0639\u0631\u0636 \u0627\u0644\u0645\u0631\u0641\u0642</a></p>` : ""}
      ${request.adminReason ? `<p class="hint">\u0633\u0628\u0628 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u0625\u062F\u0627\u0631\u064A: ${escapeHtml(request.adminReason)}</p>` : ""}
      ${request.deleted ? `<p class="hint">\u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628 \u0645\u062D\u0630\u0648\u0641 \u0648\u0645\u0642\u0641\u0644 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u062C\u0631\u0627\u0621 \u0623\u064A \u062A\u063A\u064A\u064A\u0631 \u0639\u0644\u064A\u0647.</p>` : ""}
    </div>
  `);
}
function detailLabel(key) {
  return {
    startDate: "\u0645\u0646 \u062A\u0627\u0631\u064A\u062E",
    endDate: "\u0625\u0644\u0649 \u062A\u0627\u0631\u064A\u062E",
    leaveType: "\u0646\u0648\u0639 \u0627\u0644\u0625\u062C\u0627\u0632\u0629",
    days: "\u0645\u062F\u0629 \u0627\u0644\u0625\u062C\u0627\u0632\u0629 \u0628\u0627\u0644\u0623\u064A\u0627\u0645",
    notes: "\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A",
    reason: "\u0627\u0644\u0633\u0628\u0628",
    date: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E",
    fromTime: "\u0645\u0646 \u0648\u0642\u062A",
    toTime: "\u0625\u0644\u0649 \u0648\u0642\u062A",
    departureType: "\u0646\u0648\u0639 \u0627\u0644\u0645\u063A\u0627\u062F\u0631\u0629",
    hours: "\u0645\u062F\u0629 \u0627\u0644\u0645\u063A\u0627\u062F\u0631\u0629",
    advanceDate: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0633\u0644\u0641\u0629",
    deductionStart: "\u062A\u0627\u0631\u064A\u062E \u0628\u062F\u0621 \u0627\u0644\u062E\u0635\u0645",
    advanceType: "\u0646\u0648\u0639 \u0627\u0644\u0633\u0644\u0641\u0629",
    amount: "\u0627\u0644\u0645\u0628\u0644\u063A",
    installments: "\u0639\u062F\u062F \u0627\u0644\u0623\u0642\u0633\u0627\u0637",
    complaintDate: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0634\u0643\u0648\u0649",
    complaintDetails: "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0634\u0643\u0648\u0649",
    resignationDate: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u0642\u0627\u0644\u0629",
    requestName: "\u0627\u0633\u0645 \u0627\u0644\u0637\u0644\u0628",
    requestDate: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0637\u0644\u0628",
    requestDetails: "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0637\u0644\u0628"
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
        <h3>\u0645\u0639\u0627\u064A\u0646\u0629 \u0627\u0644\u0637\u0644\u0628</h3>
        <div id="request-preview">${renderLivePreview(type, {}, employee)}</div>
      </div>
      <button class="primary-button" type="button" data-send-request><i data-lucide="send"></i>\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628</button>
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
      ${field("startDate", "date", "\u0645\u0648\u0639\u062F \u0627\u0644\u0625\u062C\u0627\u0632\u0629 \u0645\u0646", true)}
      ${field("endDate", "date", "\u0645\u0648\u0639\u062F \u0627\u0644\u0625\u062C\u0627\u0632\u0629 \u0625\u0644\u0649", true)}
      ${selectField("leaveType", "\u0646\u0648\u0639 \u0627\u0644\u0625\u062C\u0627\u0632\u0629", ["\u0633\u0646\u0648\u064A\u0629", "\u0645\u0631\u0636\u064A\u0629", "\u0645\u062D\u0633\u0648\u0645\u0629"], true)}
      ${textareaField("notes", "\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A", false)}
      ${textareaField("reason", "\u0627\u0644\u0633\u0628\u0628", true)}
    `;
  }
  if (type === "departure") {
    return `
      ${field("date", "date", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u063A\u0627\u062F\u0631\u0629", true)}
      ${field("fromTime", "time", "\u0648\u0642\u062A \u0627\u0644\u0645\u063A\u0627\u062F\u0631\u0629 \u0645\u0646", true)}
      ${field("toTime", "time", "\u0648\u0642\u062A \u0627\u0644\u0645\u063A\u0627\u062F\u0631\u0629 \u0625\u0644\u0649", true)}
      ${selectField("departureType", "\u0646\u0648\u0639 \u0627\u0644\u0645\u063A\u0627\u062F\u0631\u0629", ["\u062A\u0623\u062E\u064A\u0631 \u0635\u0628\u0627\u062D\u064A", "\u0645\u063A\u0627\u062F\u0631\u0629 \u0634\u062E\u0635\u064A\u0629", "\u0645\u063A\u0627\u062F\u0631\u0629 \u0645\u0628\u0643\u0631\u0629", "\u0645\u063A\u0627\u062F\u0631\u0629 \u0645\u062D\u0633\u0648\u0645\u0629"], true)}
      ${textareaField("notes", "\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A", false)}
      ${textareaField("reason", "\u0627\u0644\u0633\u0628\u0628", false)}
    `;
  }
  if (type === "advance") {
    return `
      ${field("advanceDate", "date", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0633\u0644\u0641\u0629", true)}
      ${field("deductionStart", "date", "\u062A\u0627\u0631\u064A\u062E \u0628\u062F\u0621 \u0627\u0644\u062E\u0635\u0645", true)}
      ${selectField("advanceType", "\u0646\u0648\u0639 \u0627\u0644\u0633\u0644\u0641\u0629", ["\u0641\u0648\u0631\u064A\u0629", "\u0633\u0644\u0641\u0629 \u0637\u0648\u064A\u0644\u0629 \u0627\u0644\u0623\u062C\u0644"], true)}
      ${field("amount", "number", "\u0645\u0628\u0644\u063A \u0627\u0644\u0633\u0644\u0641\u0629", true, "0", "0.01")}
      ${field("installments", "number", "\u0639\u062F\u062F \u0627\u0644\u0623\u0642\u0633\u0627\u0637", true, "1", "1")}
      ${textareaField("notes", "\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A", false)}
      ${textareaField("reason", "\u0627\u0644\u0633\u0628\u0628", false)}
    `;
  }
  if (type === "complaint") {
    return `
      ${field("complaintDate", "date", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0634\u0643\u0648\u0649", true)}
      ${textareaField("complaintDetails", "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0634\u0643\u0648\u0649", true)}
    `;
  }
  if (type === "resignation") {
    return `
      ${field("resignationDate", "date", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u0642\u0627\u0644\u0629", true)}
      ${textareaField("reason", "\u0633\u0628\u0628 \u0627\u0644\u0627\u0633\u062A\u0642\u0627\u0644\u0629", true)}
    `;
  }
  return `
    ${field("requestName", "text", "\u0627\u0633\u0645 \u0627\u0644\u0637\u0644\u0628", true)}
    ${field("requestDate", "date", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0637\u0644\u0628", true)}
    ${textareaField("requestDetails", "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0637\u0644\u0628", true)}
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
      ${infoItem("\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0638\u0641", employee.fullName)}
      ${infoItem("\u0646\u0648\u0639 \u0627\u0644\u0637\u0644\u0628", requestTitles[type] || data.requestName || "\u0637\u0644\u0628")}
      ${Object.entries(derived).filter(([, value]) => value).slice(0, 8).map(([key, value]) => infoItem(detailLabel(key), value)).join("")}
    </div>
  `;
}
function deriveRequestDetails(type, data) {
  const details = __spreadValues({}, data);
  delete details.attachment;
  if (type === "leave" && data.startDate && data.endDate) {
    details.days = String(Math.max(1, Math.round((new Date(data.endDate) - new Date(data.startDate)) / 864e5) + 1));
  }
  if (type === "departure" && data.fromTime && data.toTime) {
    const [fh, fm] = data.fromTime.split(":").map(Number);
    const [th, tm] = data.toTime.split(":").map(Number);
    const minutes = th * 60 + tm - (fh * 60 + fm);
    details.hours = minutes > 0 ? `${Math.floor(minutes / 60)} \u0633\u0627\u0639\u0629 \u0648 ${minutes % 60} \u062F\u0642\u064A\u0642\u0629` : "";
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
    submitButton.innerHTML = `<i data-lucide="loader-circle"></i>\u062C\u0627\u0631\u064A \u0627\u0644\u0625\u0631\u0633\u0627\u0644`;
    hydrateIcons();
  }
  const data = Object.fromEntries(new FormData(form).entries());
  const employee = currentUser();
  try {
    if (type === "leave" && data.leaveType === "\u0633\u0646\u0648\u064A\u0629") {
      const days = Number(deriveRequestDetails(type, data).days || 0);
      if (leaveBalance(employee) < days) {
        toast("\u0644\u0627 \u064A\u0648\u062C\u062F \u0631\u0635\u064A\u062F \u0625\u062C\u0627\u0632\u0627\u062A \u0633\u0646\u0648\u064A\u0629 \u0643\u0627\u0641 \u0644\u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628", "error");
        return;
      }
    }
    if (type === "advance" && Number(data.amount || 0) > 100 && !String(data.reason || "").trim()) {
      toast("\u0627\u0644\u0633\u0628\u0628 \u0625\u062C\u0628\u0627\u0631\u064A \u0625\u0630\u0627 \u0643\u0627\u0646 \u0645\u0628\u0644\u063A \u0627\u0644\u0633\u0644\u0641\u0629 \u0623\u0643\u062B\u0631 \u0645\u0646 100", "error");
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
    toast("\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628 \u0628\u0646\u062C\u0627\u062D");
  } catch (error) {
    console.error(error);
    toast("\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u062A\u0635\u0627\u0644 Firebase \u0648\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.", "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = `<i data-lucide="send"></i>\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628`;
      hydrateIcons();
    }
  }
}
function renderAdminApp() {
  const titles = {
    "admin-dashboard": ["\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645", "\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0648\u0627\u0644\u0637\u0644\u0628\u0627\u062A"],
    "admin-requests": ["\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646", "\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0648\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0623\u0648 \u0627\u0644\u0631\u0641\u0636 \u0623\u0648 \u0627\u0644\u0625\u0644\u063A\u0627\u0621"],
    "admin-attendance": ["\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u062F\u0648\u0627\u0645", "\u0645\u062A\u0627\u0628\u0639\u0629 \u062D\u0636\u0648\u0631 \u0648\u0627\u0646\u0635\u0631\u0627\u0641 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0648\u062A\u0645\u064A\u064A\u0632 \u0627\u0644\u062A\u0623\u062E\u064A\u0631 \u0648\u0627\u0644\u063A\u064A\u0627\u0628"],
    "admin-work-settings": ["\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062F\u0648\u0627\u0645", "\u062A\u062D\u062F\u064A\u062F \u0633\u0627\u0639\u0627\u062A \u0627\u0644\u062F\u0648\u0627\u0645 \u0648\u0627\u0644\u0625\u0636\u0627\u0641\u064A \u0648\u0627\u0644\u062E\u0635\u0648\u0645\u0627\u062A \u0648\u0623\u064A\u0627\u0645 \u0639\u062F\u0645 \u0627\u0644\u062E\u0635\u0645"],
    "admin-shifts": ["\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0634\u0641\u062A\u0627\u062A", "\u0625\u0636\u0627\u0641\u0629 \u0648\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0634\u0641\u062A\u0627\u062A \u0648\u0639\u0631\u0636 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u062D\u0633\u0628 \u0643\u0644 \u0634\u0641\u062A"],
    "admin-departments": ["\u0627\u0644\u0623\u0642\u0633\u0627\u0645", "\u062A\u0646\u0638\u064A\u0645 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u062D\u0633\u0628 \u0627\u0644\u0642\u0633\u0645 \u0648\u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064A\u0646 \u0648\u0627\u0644\u0645\u0633\u0627\u0639\u062F\u064A\u0646"],
    "admin-accounting": ["\u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629 \u0648\u0627\u0644\u0631\u0648\u0627\u062A\u0628", "\u0627\u062D\u062A\u0633\u0627\u0628 \u0631\u0648\u0627\u062A\u0628 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0648\u0646\u0634\u0631 \u0642\u0633\u0627\u0626\u0645 \u0627\u0644\u0631\u0627\u062A\u0628"],
    "admin-holidays": ["\u0627\u0644\u0639\u0637\u0644 \u0627\u0644\u0631\u0633\u0645\u064A\u0629", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u064A\u0627\u0645 \u0627\u0644\u062A\u064A \u0644\u0627 \u062A\u0639\u062F \u063A\u064A\u0627\u0628\u064B\u0627 \u0648\u0627\u062D\u062A\u0633\u0627\u0628 \u0639\u0645\u0644\u0647\u0627 \u0628\u0646\u0633\u0628\u0629 150%"],
    "admin-permissions": ["\u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A", "\u0645\u0646\u062D \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0645\u062D\u062F\u062F\u0629 \u0644\u0645\u062F\u064A\u0631\u064A \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0648\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u064A\u0646"],
    "admin-announcements": ["\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A", "\u0646\u0634\u0631 \u0648\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0627\u0644\u062E\u0627\u0635\u0629"],
    "admin-employees": ["\u0627\u0644\u0645\u0648\u0638\u0641\u0648\u0646", "\u0625\u0636\u0627\u0641\u0629 \u0648\u062A\u0639\u062F\u064A\u0644 \u0648\u062D\u0630\u0641 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646"]
  };
  const [title, subtitle] = titles[state.view] || titles["admin-dashboard"];
  const bodyRenderer = {
    "admin-dashboard": renderAdminDashboard,
    "admin-requests": renderAdminRequests,
    "admin-attendance": renderAdminAttendance,
    "admin-work-settings": renderAdminWorkSettings,
    "admin-shifts": renderAdminShifts,
    "admin-departments": renderAdminDepartments,
    "admin-accounting": renderAdminAccounting,
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
      <div class="metric"><span>\u0627\u0644\u0645\u0648\u0638\u0641\u0648\u0646</span><strong>${employeesCount}</strong></div>
      <div class="metric"><span>\u0643\u0644 \u0627\u0644\u0637\u0644\u0628\u0627\u062A</span><strong>${requests.length}</strong></div>
      <div class="metric"><span>\u0627\u0644\u0645\u0648\u0627\u0641\u0642 \u0639\u0644\u064A\u0647\u0627</span><strong>${requests.filter((item) => item.status === "approved").length}</strong></div>
      <div class="metric"><span>\u0642\u064A\u062F \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631</span><strong>${requests.filter((item) => item.status === "pending").length}</strong></div>
    </section>
  `;
}
function renderAdminRequests() {
  return `
    <section class="section">
      <div class="section-header"><h2>\u062C\u0645\u064A\u0639 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646</h2></div>
      ${renderRequestsTable(filterRequests({ status: "all" }), true)}
    </section>
  `;
}
function renderAdminAttendance() {
  const employees = Object.values(state.employees).sort((a, b) => a.id.localeCompare(b.id));
  const selectedEmployeeId = sessionStorage.getItem("attendance-employee") || (employees[0] ? employees[0].id : "") || "";
  const selectedMonth = sessionStorage.getItem("attendance-month") || todayIso().slice(0, 7);
  const records = selectedEmployeeId ? attendanceRecordsFor(selectedEmployeeId, selectedMonth).map((record) => normalizeAttendanceRecord(__spreadProps(__spreadValues({}, record), { employeeId: selectedEmployeeId }))) : [];
  const presentCount = records.filter((record) => record.status === "present").length;
  const lateCount = records.filter((record) => record.status === "late").length;
  const absentCount = records.filter((record) => record.status === "absent").length;
  return `
    <section class="section">
      <div class="section-header"><h2>\u0641\u0644\u062A\u0631\u0629 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u062F\u0648\u0627\u0645</h2></div>
      <form id="attendance-filter-form" class="toolbar">
        <div class="field">
          <label>\u0627\u0644\u0645\u0648\u0638\u0641</label>
          <select name="employeeId">
            ${employees.map((employee) => `<option value="${employee.id}" ${employee.id === selectedEmployeeId ? "selected" : ""}>${employee.id} - ${escapeHtml(employee.fullName)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>\u0627\u0644\u0634\u0647\u0631</label>
          <input name="month" type="month" value="${selectedMonth}" />
        </div>
        <button class="primary-button" type="submit"><i data-lucide="search"></i>\u0639\u0631\u0636 \u0627\u0644\u062A\u0642\u0631\u064A\u0631</button>
      </form>
      <div class="metric-strip attendance-summary">
        <div class="metric"><span>\u0623\u064A\u0627\u0645 \u0627\u0644\u062D\u0636\u0648\u0631</span><strong>${presentCount}</strong></div>
        <div class="metric late"><span>\u0623\u064A\u0627\u0645 \u0627\u0644\u062A\u0623\u062E\u064A\u0631</span><strong>${lateCount}</strong></div>
        <div class="metric absent"><span>\u0623\u064A\u0627\u0645 \u0627\u0644\u063A\u064A\u0627\u0628</span><strong>${absentCount}</strong></div>
        <div class="metric"><span>\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0633\u062C\u0644\u0627\u062A</span><strong>${records.length}</strong></div>
      </div>
    </section>
    <section class="section">
      <div class="section-header">
        <h2>\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u062F\u0648\u0627\u0645</h2>
        <button class="secondary-button" data-open-attendance-editor="${selectedEmployeeId}"><i data-lucide="calendar-plus"></i>\u062A\u0633\u062C\u064A\u0644 \u0623\u0648 \u062A\u0639\u062F\u064A\u0644 \u064A\u0648\u0645</button>
      </div>
      ${renderAttendanceTable(records, true)}
    </section>
  `;
}
function renderAdminHolidays() {
  const holidays = Object.values(state.holidays).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return `
    <section class="section">
      <div class="section-header"><h2>\u0625\u0636\u0627\u0641\u0629 \u0639\u0637\u0644\u0629 \u0631\u0633\u0645\u064A\u0629</h2></div>
      <form id="holiday-form" class="grid two">
        <div class="field"><label>\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0639\u0637\u0644\u0629</label><input name="date" type="date" required /></div>
        <div class="field"><label>\u0627\u0633\u0645 \u0627\u0644\u0639\u0637\u0644\u0629</label><input name="name" required placeholder="\u0645\u062B\u0627\u0644: \u0639\u064A\u062F \u0627\u0644\u0639\u0645\u0627\u0644" /></div>
        ${textareaField("notes", "\u0645\u0644\u0627\u062D\u0638\u0627\u062A", false)}
        <button class="primary-button" type="submit"><i data-lucide="calendar-plus"></i>\u062D\u0641\u0638 \u0627\u0644\u0639\u0637\u0644\u0629</button>
      </form>
    </section>
    <section class="section">
      <div class="section-header"><h2>\u0627\u0644\u0639\u0637\u0644 \u0627\u0644\u0645\u0633\u062C\u0644\u0629</h2></div>
      ${holidays.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>\u0627\u0644\u062A\u0627\u0631\u064A\u062E</th><th>\u0627\u0644\u0639\u0637\u0644\u0629</th><th>\u0645\u0644\u0627\u062D\u0638\u0627\u062A</th><th>\u0625\u062C\u0631\u0627\u0621\u0627\u062A</th></tr></thead>
            <tbody>
              ${holidays.map((holiday) => `<tr class="attendance-row holiday"><td>${formatDate(holiday.date)}</td><td>${escapeHtml(holiday.name)}</td><td>${escapeHtml(holiday.notes || "")}</td><td><button class="danger-button" data-delete-holiday="${holiday.date}"><i data-lucide="trash-2"></i>\u062D\u0630\u0641</button></td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">\u0644\u0627 \u062A\u0648\u062C\u062F \u0639\u0637\u0644 \u0631\u0633\u0645\u064A\u0629 \u0645\u0633\u062C\u0644\u0629.</div>`}
    </section>
  `;
}
function renderAdminWorkSettings() {
  const settings = getSettings();
  const allShifts = getShifts();
  return `
    <section class="section">
      <div class="section-header"><h2>\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u062F\u0648\u0627\u0645 \u0648\u0627\u0644\u0625\u0636\u0627\u0641\u064A \u0648\u0627\u0644\u062E\u0635\u0645</h2></div>
      <form id="work-settings-form" class="grid two">
        <div class="field"><label>\u0648\u0642\u062A \u0628\u062F\u0621 \u0627\u0644\u062F\u0648\u0627\u0645 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A</label><input name="workStart" type="time" value="${settings.workStart}" required /></div>
        <div class="field"><label>\u0648\u0642\u062A \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u062F\u0648\u0627\u0645 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A</label><input name="workEnd" type="time" value="${settings.workEnd}" required /></div>
        <div class="field"><label>\u0628\u062F\u0621 \u0627\u062D\u062A\u0633\u0627\u0628 \u0627\u0644\u0625\u0636\u0627\u0641\u064A \u0628\u0639\u062F</label><input name="overtimeAfter" type="time" value="${settings.overtimeAfter}" required /></div>
        <div class="field"><label>\u0642\u064A\u0645\u0629 \u0633\u0627\u0639\u0629 \u0627\u0644\u0625\u0636\u0627\u0641\u064A</label><input name="overtimeRate" type="number" step="0.01" min="1" value="${settings.overtimeRate}" required /></div>
        <div class="field"><label>\u0642\u064A\u0645\u0629 \u0633\u0627\u0639\u0629 \u0627\u0644\u0639\u0637\u0644\u0629 \u0627\u0644\u0631\u0633\u0645\u064A\u0629</label><input name="holidayOvertimeRate" type="number" step="0.01" min="1" value="${settings.holidayOvertimeRate}" required /></div>
        <div class="field"><label>\u0633\u0645\u0627\u062D\u064A\u0629 \u0627\u0644\u062A\u0623\u062E\u064A\u0631 \u0628\u0627\u0644\u062F\u0642\u0627\u0626\u0642</label><input name="lateGraceMinutes" type="number" min="0" value="${settings.lateGraceMinutes}" required /></div>
        <div class="field"><label>\u062E\u0635\u0645 \u0627\u0644\u063A\u064A\u0627\u0628 \u0628\u0627\u0644\u0623\u064A\u0627\u0645</label><input name="absenceDeductionDays" type="number" step="0.25" min="0" value="${settings.absenceDeductionDays}" required /></div>
        <label class="check-card"><input type="checkbox" name="fridayNoDeduction" value="true" ${settings.fridayNoDeduction ? "checked" : ""} /><span>\u064A\u0648\u0645 \u0627\u0644\u062C\u0645\u0639\u0629 \u0644\u0627 \u064A\u062E\u0635\u0645 \u0625\u0630\u0627 \u063A\u0627\u0628 \u0627\u0644\u0645\u0648\u0638\u0641</span></label>
        <label class="check-card"><input type="checkbox" name="officialHolidayNoDeduction" value="true" ${settings.officialHolidayNoDeduction ? "checked" : ""} /><span>\u0627\u0644\u0639\u0637\u0644 \u0627\u0644\u0631\u0633\u0645\u064A\u0629 \u0644\u0627 \u062A\u062E\u0635\u0645 \u0625\u0630\u0627 \u063A\u0627\u0628 \u0627\u0644\u0645\u0648\u0638\u0641</span></label>
        <button class="primary-button" type="submit"><i data-lucide="save"></i>\u062D\u0641\u0638 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062F\u0648\u0627\u0645</button>
      </form>
    </section>
    <section class="section">
      <h3>\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0627\u062D\u062A\u0633\u0627\u0628 \u0627\u0644\u062D\u0627\u0644\u064A\u0629</h3>
      <p class="hint">\u0627\u0644\u0625\u0636\u0627\u0641\u064A \u0627\u0644\u0639\u0627\u062F\u064A = ${settings.overtimeRate} \u0644\u0643\u0644 \u0633\u0627\u0639\u0629\u060C \u0648\u0627\u0644\u0639\u0645\u0644 \u0641\u064A \u0627\u0644\u0639\u0637\u0644 \u0627\u0644\u0631\u0633\u0645\u064A\u0629 = ${settings.holidayOvertimeRate} \u0644\u0643\u0644 \u0633\u0627\u0639\u0629. \u062E\u0635\u0645 \u0627\u0644\u063A\u064A\u0627\u0628 = ${settings.absenceDeductionDays} \u064A\u0648\u0645\u060C \u0645\u0639 \u0627\u0633\u062A\u062B\u0646\u0627\u0621 \u0627\u0644\u0623\u064A\u0627\u0645 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u0623\u0639\u0644\u0627\u0647.</p>
    </section>
    <section class="section">
      <div class="section-header"><h2>\u0623\u0648\u0642\u0627\u062A \u0627\u0644\u062F\u0648\u0627\u0645 \u062D\u0633\u0628 \u0627\u0644\u0634\u0641\u062A</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>\u0627\u0644\u0634\u0641\u062A</th><th>\u0627\u0644\u0628\u062F\u0627\u064A\u0629</th><th>\u0627\u0644\u0646\u0647\u0627\u064A\u0629</th><th>\u0628\u062F\u0621 \u0627\u0644\u0625\u0636\u0627\u0641\u064A</th></tr></thead>
          <tbody>
            ${Object.values(allShifts).map((shift) => `<tr><td>${escapeHtml(shift.label)}</td><td>${shift.start}</td><td>${shift.end}</td><td>${shift.overtimeAfter || shift.end}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
function renderAdminShifts() {
  const allShifts = Object.entries(getShifts()).map(([id, shift]) => __spreadValues({ id }, shift));
  return `
    <section class="section">
      <div class="section-header"><h2>\u0625\u0636\u0627\u0641\u0629 \u0623\u0648 \u062A\u0639\u062F\u064A\u0644 \u0634\u0641\u062A</h2></div>
      <form id="shift-form" class="grid two">
        <div class="field"><label>\u0645\u0639\u0631\u0641 \u0627\u0644\u0634\u0641\u062A</label><input name="id" required placeholder="morning" /></div>
        <div class="field"><label>\u0627\u0633\u0645 \u0627\u0644\u0634\u0641\u062A</label><input name="label" required placeholder="\u0634\u0641\u062A \u0635\u0628\u0627\u062D\u064A" /></div>
        <div class="field"><label>\u0648\u0642\u062A \u0627\u0644\u0628\u062F\u0627\u064A\u0629</label><input name="start" type="time" required /></div>
        <div class="field"><label>\u0648\u0642\u062A \u0627\u0644\u0646\u0647\u0627\u064A\u0629</label><input name="end" type="time" required /></div>
        <div class="field"><label>\u0628\u062F\u0621 \u0627\u0644\u0625\u0636\u0627\u0641\u064A</label><input name="overtimeAfter" type="time" /></div>
        <button class="primary-button" type="submit"><i data-lucide="save"></i>\u062D\u0641\u0638 \u0627\u0644\u0634\u0641\u062A</button>
      </form>
    </section>
    <section class="section">
      <div class="section-header"><h2>\u0627\u0644\u0634\u0641\u062A\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u064A\u0629</h2></div>
      <div class="grid two">
        ${allShifts.map((shift) => {
    const employees = Object.values(state.employees).filter((employee) => (employee.shift || "morning") === shift.id);
    return `
            <div class="info-item shift-card">
              <span>${escapeHtml(shift.label)}</span>
              <strong>${shift.start} - ${shift.end}</strong>
              <p class="hint">\u0628\u062F\u0621 \u0627\u0644\u0625\u0636\u0627\u0641\u064A: ${shift.overtimeAfter || shift.end}</p>
              <div class="inline-list">${employees.length ? employees.map((employee) => `<span class="inline-chip">${escapeHtml(employee.fullName)}</span>`).join("") : `<span class="hint">\u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u0648\u0638\u0641\u0648\u0646</span>`}</div>
              <div class="actions" style="margin-top:12px">
                <button class="secondary-button" data-edit-shift="${shift.id}"><i data-lucide="pencil"></i>\u062A\u0639\u062F\u064A\u0644</button>
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
  const departments = Object.entries(state.departments).map(([id, department]) => __spreadValues({ id }, department));
  const editingDepartmentId = sessionStorage.getItem("editing-department") || "";
  const editingDepartment = editingDepartmentId ? state.departments[editingDepartmentId] || {} : {};
  const editingEmployeeIds = editingDepartment.employeeIds || {};
  return `
    <section class="section">
      <div class="section-header"><h2>\u0625\u0636\u0627\u0641\u0629 \u0623\u0648 \u062A\u0639\u062F\u064A\u0644 \u0642\u0633\u0645</h2></div>
      <form id="department-form" class="grid two">
        <div class="field"><label>\u0645\u0639\u0631\u0641 \u0627\u0644\u0642\u0633\u0645</label><input name="id" required ${editingDepartmentId ? "readonly" : ""} value="${escapeAttr(editingDepartmentId)}" placeholder="production" /></div>
        <div class="field"><label>\u0627\u0633\u0645 \u0627\u0644\u0642\u0633\u0645</label><input name="name" required value="${escapeAttr(editingDepartment.name || "")}" placeholder="\u0627\u0644\u0625\u0646\u062A\u0627\u062C" /></div>
        <div class="field">
          <label>\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0642\u0633\u0645</label>
          <select name="managerId"><option value="">\u0628\u062F\u0648\u0646</option>${employeeOptions(employees, editingDepartment.managerId || "")}</select>
        </div>
        <div class="field">
          <label>\u0645\u0633\u0627\u0639\u062F \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0642\u0633\u0645</label>
          <select name="assistantId"><option value="">\u0628\u062F\u0648\u0646</option>${employeeOptions(employees, editingDepartment.assistantId || "")}</select>
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>\u0645\u0648\u0638\u0641\u0648 \u0627\u0644\u0642\u0633\u0645</label>
          <div class="employee-check-grid">
            ${employees.map((employee) => `<label class="check-card"><input type="checkbox" name="employeeIds" value="${employee.id}" ${editingEmployeeIds[employee.id] ? "checked" : ""} /><span>${employee.id} - ${escapeHtml(employee.fullName)}</span></label>`).join("")}
          </div>
        </div>
        ${textareaField("message", "\u0625\u0634\u0639\u0627\u0631 \u0627\u062E\u062A\u064A\u0627\u0631\u064A \u0644\u0645\u0648\u0638\u0641\u064A \u0627\u0644\u0642\u0633\u0645", false)}
        <button class="primary-button" type="submit"><i data-lucide="save"></i>\u062D\u0641\u0638 \u0627\u0644\u0642\u0633\u0645 \u0648\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0625\u0634\u0639\u0627\u0631</button>
        ${editingDepartmentId ? `<button class="secondary-button" type="button" data-cancel-department-edit><i data-lucide="x"></i>\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062A\u0639\u062F\u064A\u0644</button>` : ""}
      </form>
    </section>
    <section class="section">
      <div class="section-header"><h2>\u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0627\u0644\u062D\u0627\u0644\u064A\u0629</h2></div>
      ${departments.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>\u0627\u0644\u0642\u0633\u0645</th><th>\u0627\u0644\u0645\u0633\u0624\u0648\u0644</th><th>\u0627\u0644\u0645\u0633\u0627\u0639\u062F</th><th>\u0639\u062F\u062F \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646</th><th>\u0627\u0644\u0645\u0648\u0638\u0641\u0648\u0646</th><th>\u0625\u062C\u0631\u0627\u0621\u0627\u062A</th></tr></thead>
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
                            <button class="mini-danger" data-remove-department-employee="${department.id}" data-employee-id="${employeeId}" title="\u0625\u0632\u0627\u0644\u0629 \u0645\u0646 \u0627\u0644\u0642\u0633\u0645">\xD7</button>
                          </span>
                        `).join("") : "-"}
                      </div>
                    </td>
                    <td class="actions">
                      <button class="secondary-button" data-edit-department="${department.id}"><i data-lucide="pencil"></i>\u062A\u0639\u062F\u064A\u0644</button>
                      <button class="danger-button" data-delete-department="${department.id}"><i data-lucide="trash-2"></i>\u062D\u0630\u0641 \u0627\u0644\u0642\u0633\u0645</button>
                    </td>
                  </tr>
                `;
  }).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0642\u0633\u0627\u0645 \u0628\u0639\u062F.</div>`}
    </section>
  `;
}
function renderAdminAccounting() {
  const employees = Object.values(state.employees).sort((a, b) => a.id.localeCompare(b.id));
  const selectedEmployeeId = sessionStorage.getItem("payroll-employee") || (employees[0] ? employees[0].id : "") || "";
  const selectedMonth = sessionStorage.getItem("payroll-month") || todayIso().slice(0, 7);
  const payroll = selectedEmployeeId ? computePayroll(selectedEmployeeId, selectedMonth) : null;
  const profile = selectedEmployeeId ? payrollProfile(selectedEmployeeId) : {};
  return `
    <section class="section">
      <div class="section-header"><h2>\u0641\u0644\u062A\u0631\u0629 \u0643\u0634\u0641 \u0627\u0644\u0631\u0627\u062A\u0628</h2></div>
      <form id="payroll-filter-form" class="toolbar">
        <div class="field">
          <label>\u0627\u0644\u0645\u0648\u0638\u0641</label>
          <select name="employeeId">
            ${employees.map((employee) => `<option value="${employee.id}" ${employee.id === selectedEmployeeId ? "selected" : ""}>${employee.id} - ${escapeHtml(employee.fullName)}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>\u0627\u0644\u0634\u0647\u0631</label><input name="month" type="month" value="${selectedMonth}" /></div>
        <button class="primary-button" type="submit"><i data-lucide="calculator"></i>\u0627\u062D\u062A\u0633\u0627\u0628</button>
      </form>
    </section>
    ${payroll ? `
      <section class="section">
        <div class="section-header">
          <div>
            <h2>\u0645\u0644\u0641 \u0631\u0627\u062A\u0628 \u0627\u0644\u0645\u0648\u0638\u0641</h2>
            <p>${escapeHtml(payroll.employeeName)} - ${selectedMonth}</p>
          </div>
          <span class="status ${payroll.status === "published" ? "approved" : "pending"}">${payroll.status === "published" ? "\u0645\u0646\u0634\u0648\u0631\u0629" : "\u0645\u0633\u0648\u062F\u0629"}</span>
        </div>
        ${canManageAccounting() ? `<form id="payroll-profile-form" class="grid two">
          <input type="hidden" name="employeeId" value="${selectedEmployeeId}" />
          <div class="field"><label>\u0627\u0644\u0631\u0627\u062A\u0628 \u0627\u0644\u0623\u0633\u0627\u0633\u064A</label><input name="baseSalary" type="number" step="0.01" min="0" value="${profile.baseSalary || 0}" /></div>
          <div class="field"><label>\u0627\u0644\u0636\u0645\u0627\u0646 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u064A \u0627\u0644\u0634\u0647\u0631\u064A</label><input name="socialSecurity" type="number" step="0.01" min="0" value="${profile.socialSecurity || 0}" /></div>
          <div class="field"><label>\u0628\u062F\u0644 \u0646\u0638\u0627\u0641\u0629</label><input name="cleaningAllowance" type="number" step="0.01" min="0" value="${profile.allowances && profile.allowances.cleaning ? profile.allowances.cleaning.amount : 0}" /></div>
          <div class="field"><label>\u0628\u062F\u0644 \u0645\u0647\u0646 \u062E\u0637\u0631\u0629</label><input name="hazardAllowance" type="number" step="0.01" min="0" value="${profile.allowances && profile.allowances.hazard ? profile.allowances.hazard.amount : 0}" /></div>
          <button class="primary-button" type="submit"><i data-lucide="save"></i>\u062D\u0641\u0638 \u0645\u0644\u0641 \u0627\u0644\u0631\u0627\u062A\u0628</button>
        </form>` : `<div class="empty">\u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0646\u0634\u0631 \u0627\u0644\u0642\u0633\u0627\u0626\u0645 \u0641\u0642\u0637 \u062F\u0648\u0646 \u062A\u0639\u062F\u064A\u0644 \u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0631\u0648\u0627\u062A\u0628.</div>`}
      </section>
      <section class="section">
        <div class="section-header">
          <h2>\u0643\u0634\u0641 \u0627\u0644\u0631\u0627\u062A\u0628 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A</h2>
          ${canPublishPayslips() ? `<button class="primary-button" data-publish-payslip="${selectedEmployeeId}" data-month="${selectedMonth}"><i data-lucide="send"></i>\u0646\u0634\u0631 \u0627\u0644\u0642\u0633\u064A\u0645\u0629 \u0644\u0644\u0645\u0648\u0638\u0641</button>` : ""}
        </div>
        ${renderPayrollReport(payroll, true)}
      </section>
      ${canManageAccounting() ? `<section class="section">
        <div class="section-header"><h2>\u0625\u0636\u0627\u0641\u0629 \u062A\u0639\u062F\u064A\u0644 \u064A\u062F\u0648\u064A</h2></div>
        <form id="payroll-manual-form" class="grid two">
          <input type="hidden" name="employeeId" value="${selectedEmployeeId}" />
          <input type="hidden" name="month" value="${selectedMonth}" />
          <div class="field"><label>\u0627\u0633\u0645 \u0627\u0644\u062D\u0642\u0644</label><input name="label" required placeholder="\u0645\u062B\u0627\u0644: \u0625\u0643\u0631\u0627\u0645\u064A\u0629 \u0645\u062F\u064A\u0631" /></div>
          <div class="field"><label>\u0627\u0644\u0642\u064A\u0645\u0629</label><input name="amount" type="number" step="0.01" required /></div>
          <div class="field"><label>\u0627\u0644\u0646\u0648\u0639</label><select name="kind"><option value="earning">\u0625\u0636\u0627\u0641\u0629 +</option><option value="deduction">\u0627\u0642\u062A\u0637\u0627\u0639 -</option></select></div>
          <button class="secondary-button" type="submit"><i data-lucide="plus"></i>\u0625\u0636\u0627\u0641\u0629 \u0639\u0644\u0649 \u0627\u0644\u0643\u0634\u0641</button>
        </form>
      </section>` : ""}
      <section class="section">
        <div class="section-header"><h2>\u0627\u0644\u0633\u0644\u0641 \u0627\u0644\u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631</h2></div>
        ${payroll.advances.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>\u0627\u0644\u0633\u0644\u0641\u0629</th><th>\u0642\u064A\u0645\u0629 \u0627\u0644\u0642\u0633\u0637</th><th>\u0625\u062C\u0631\u0627\u0621</th></tr></thead>
              <tbody>
                ${payroll.advances.map((item) => `<tr><td>${escapeHtml(item.request.details.advanceType || "\u0633\u0644\u0641\u0629")}</td><td>${money(item.amount)}</td><td><button class="secondary-button" data-delay-advance="${item.request.id}" data-month="${selectedMonth}"><i data-lucide="calendar-clock"></i>\u062A\u0623\u062C\u064A\u0644 \u0644\u0644\u0634\u0647\u0631 \u0627\u0644\u0642\u0627\u062F\u0645</button></td></tr>`).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">\u0644\u0627 \u062A\u0648\u062C\u062F \u0633\u0644\u0641 \u0645\u0633\u062A\u062D\u0642\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631.</div>`}
      </section>
    ` : `<section class="section"><div class="empty">\u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u0648\u0638\u0641\u0648\u0646 \u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0631\u0648\u0627\u062A\u0628.</div></section>`}
  `;
}
function renderPayrollReport(payroll, adminMode = false) {
  const earnings = payroll.earnings || [];
  const deductions = payroll.deductions || [];
  const absenceRows = payroll.absenceRows || [];
  return `
    <div class="payroll-report">
      ${renderPayrollItems("\u0627\u0644\u062F\u062E\u0644", earnings, adminMode)}
      ${renderPayrollItems("\u0627\u0644\u0627\u0642\u062A\u0637\u0627\u0639\u0627\u062A", deductions, adminMode)}
      <div class="payroll-totals">
        ${infoItem("\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062F\u062E\u0644", money(payroll.totalIncome))}
        ${infoItem("\u0635\u0627\u0641\u064A \u0627\u0644\u0627\u0642\u062A\u0637\u0627\u0639\u0627\u062A", money(payroll.totalDeductions))}
        ${infoItem("\u0635\u0627\u0641\u064A \u0627\u0644\u0631\u0627\u062A\u0628", money(payroll.netSalary))}
      </div>
    </div>
    ${absenceRows.length ? `<p class="hint">\u062A\u0645 \u0627\u062D\u062A\u0633\u0627\u0628 \u062E\u0635\u0648\u0645\u0627\u062A \u0627\u0644\u063A\u064A\u0627\u0628 \u062A\u0644\u0642\u0627\u0626\u064A\u064B\u0627: ${absenceRows.map((item) => item.reason).join("\u060C ")}</p>` : ""}
  `;
}
function renderPayrollItems(title, items, adminMode) {
  return `
    <div class="payroll-block">
      <h3>${title}</h3>
      <div class="table-wrap payroll-table-wrap">
        <table class="payroll-table">
          <tbody>
            ${items.map((item) => `<tr>
              <td>${escapeHtml(item.label)}</td>
              <td>${money(item.amount)}</td>
              ${adminMode ? `<td class="actions">
                <button class="secondary-button compact-button" data-edit-payroll-item="${item.id}" data-kind="${item.kind || ""}"><i data-lucide="pencil"></i>\u062A\u0639\u062F\u064A\u0644</button>
                <button class="danger-button compact-button" data-delete-payroll-item="${item.id}" data-kind="${item.kind || ""}"><i data-lucide="trash-2"></i>\u062D\u0630\u0641</button>
              </td>` : ""}
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function employeeOptions(employees, selectedId) {
  return employees.map((employee) => `<option value="${employee.id}" ${employee.id === selectedId ? "selected" : ""}>${employee.id} - ${escapeHtml(employee.fullName)}</option>`).join("");
}
function departmentOptions(selectedId = "") {
  return Object.entries(state.departments).map(([id, department]) => `<option value="${id}" ${id === selectedId ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("");
}
function getEmployeeDepartment(employeeId) {
  const found = Object.entries(state.departments).find(([, department]) => department.employeeIds && department.employeeIds[employeeId]);
  if (!found) return { id: "", name: "" };
  return { id: found[0], name: found[1].name || found[0] };
}
function renderAdminPermissions() {
  const employees = Object.values(state.employees).sort((a, b) => a.id.localeCompare(b.id));
  const permissionRows = Object.entries(state.permissions).map(([id, role]) => __spreadValues({ id }, role));
  const editingPermissionId = sessionStorage.getItem("editing-permission") || "";
  const editingPermission = editingPermissionId ? state.permissions[editingPermissionId] || {} : {};
  const editingFlags = editingPermission.permissions || {};
  return `
    <section class="section">
      <div class="section-header"><h2>\u0645\u0646\u062D \u0635\u0644\u0627\u062D\u064A\u0627\u062A</h2></div>
      <form id="permission-form" class="grid two">
        <div class="field"><label>\u0627\u0633\u0645 \u0627\u0644\u062F\u0648\u0631</label><input name="title" required value="${escapeAttr(editingPermission.title || "")}" placeholder="\u0645\u062B\u0627\u0644: \u0645\u062F\u064A\u0631 \u0642\u0633\u0645 \u0627\u0644\u0625\u0646\u062A\u0627\u062C" /></div>
        <div class="field">
          <label>\u0627\u0644\u0645\u0648\u0638\u0641</label>
          <select name="employeeId" required>
            ${employees.map((employee) => `<option value="${employee.id}" ${employee.id === editingPermission.employeeId ? "selected" : ""}>${employee.id} - ${escapeHtml(employee.fullName)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>\u0646\u0637\u0627\u0642 \u0627\u0644\u0642\u0633\u0645</label>
          <select name="departmentId">
            <option value="">\u0643\u0644 \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u062D\u0633\u0628 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629</option>
            ${departmentOptions(editingPermission.departmentId || "")}
          </select>
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>\u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A</label>
          <div class="employee-check-grid">
            ${permissionDefinitions.map(([name, label]) => permissionCheckbox(name, label, editingFlags[name])).join("")}
          </div>
        </div>
        <button class="primary-button" type="submit"><i data-lucide="shield-check"></i>${editingPermissionId ? "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A" : "\u062D\u0641\u0638 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A"}</button>
        ${editingPermissionId ? `<button class="secondary-button" type="button" data-cancel-permission-edit><i data-lucide="x"></i>\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062A\u0639\u062F\u064A\u0644</button>` : ""}
      </form>
    </section>
    <section class="section">
      <div class="section-header"><h2>\u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u064A\u0629</h2></div>
      ${permissionRows.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>\u0627\u0644\u062F\u0648\u0631</th><th>\u0627\u0644\u0645\u0648\u0638\u0641</th><th>\u0627\u0644\u0646\u0637\u0627\u0642</th><th>\u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A</th><th>\u0625\u062C\u0631\u0627\u0621\u0627\u062A</th></tr></thead>
            <tbody>
              ${permissionRows.map((role) => `<tr>
                <td>${escapeHtml(role.title)}</td>
                <td>${escapeHtml(employeeName(role.employeeId))}</td>
                <td>${escapeHtml(role.departmentId ? state.departments[role.departmentId] && state.departments[role.departmentId].name ? state.departments[role.departmentId].name : role.departmentId : "\u062D\u0633\u0628 \u0627\u0644\u062F\u0648\u0631")}</td>
                <td>${formatPermissions(role.permissions || {})}</td>
                <td class="actions">
                  <button class="secondary-button" data-edit-permission="${role.id}"><i data-lucide="pencil"></i>\u062A\u0639\u062F\u064A\u0644</button>
                  <button class="danger-button" data-delete-permission="${role.id}"><i data-lucide="trash-2"></i>\u062D\u0630\u0641</button>
                </td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">\u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0645\u062E\u0635\u0635\u0629.</div>`}
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
  const labels = Object.fromEntries(permissionDefinitions);
  return Object.entries(permissions).filter(([, value]) => value).map(([key]) => labels[key] || key).join("\u060C ") || "\u0628\u062F\u0648\u0646 \u0635\u0644\u0627\u062D\u064A\u0627\u062A";
}
function renderAdminAnnouncements() {
  const rows = Object.entries(state.announcements).map(([id, item]) => __spreadValues({ id }, item)).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return `
    <section class="section">
      <div class="section-header"><h2>\u0625\u0639\u0644\u0627\u0646 \u062C\u062F\u064A\u062F</h2></div>
      <form id="announcement-form" class="grid two">
        ${field("title", "text", "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0625\u0639\u0644\u0627\u0646", true)}
        ${field("date", "date", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0639\u0644\u0627\u0646", true)}
        ${selectField("type", "\u0646\u0648\u0639 \u0627\u0644\u0625\u0639\u0644\u0627\u0646", ["public", "private"], true)}
        <div class="field">
          <label>\u0627\u0644\u0645\u0648\u0638\u0641 \u0644\u0644\u0625\u0639\u0644\u0627\u0646 \u0627\u0644\u062E\u0627\u0635</label>
          <select name="employeeId">
            <option value="">\u0628\u062F\u0648\u0646</option>
            ${Object.values(state.employees).map((employee) => `<option value="${employee.id}">${employee.id} - ${escapeHtml(employee.fullName)}</option>`).join("")}
          </select>
        </div>
        ${textareaField("body", "\u0646\u0635 \u0627\u0644\u0625\u0639\u0644\u0627\u0646", true)}
        <button class="primary-button" type="submit"><i data-lucide="send"></i>\u0646\u0634\u0631 \u0627\u0644\u0625\u0639\u0644\u0627\u0646</button>
      </form>
    </section>
    <section class="section">
      <div class="section-header"><h2>\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u064A\u0629</h2></div>
      <div class="alert-list">
        ${rows.length ? rows.map((item) => `
          ${renderAnnouncement(item)}
          <div class="actions">
            <button class="secondary-button" data-edit-announcement="${item.id}"><i data-lucide="pencil"></i>\u062A\u0639\u062F\u064A\u0644</button>
            <button class="danger-button" data-delete-announcement="${item.id}"><i data-lucide="trash-2"></i>\u062D\u0630\u0641</button>
          </div>
        `).join("") : `<div class="empty">\u0644\u0627 \u062A\u0648\u062C\u062F \u0625\u0639\u0644\u0627\u0646\u0627\u062A.</div>`}
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
        <h2>\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646</h2>
        <button class="primary-button" data-add-employee><i data-lucide="user-plus"></i>\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0638\u0641</button>
      </div>
      <form id="employee-filter-form" class="toolbar">
        <div class="field">
          <label>\u0627\u0644\u0642\u0633\u0645</label>
          <select name="department">
            <option value="all">\u0643\u0644 \u0627\u0644\u0623\u0642\u0633\u0627\u0645</option>
            ${departments.map((department) => `<option value="${escapeAttr(department)}" ${department === selectedDepartment ? "selected" : ""}>${escapeHtml(department)}</option>`).join("")}
          </select>
        </div>
        <button class="secondary-button" type="submit"><i data-lucide="filter"></i>\u062A\u0635\u0641\u064A\u0629</button>
      </form>
      <div class="table-wrap">
        <table>
          <thead><tr><th>\u0627\u0644\u0631\u0642\u0645</th><th>\u0627\u0644\u0627\u0633\u0645</th><th>\u0627\u0644\u0642\u0633\u0645</th><th>\u0627\u0644\u0645\u0633\u0645\u0649</th><th>\u0627\u0644\u0634\u0641\u062A</th><th>\u0627\u0644\u0647\u0627\u062A\u0641</th><th>\u0625\u062C\u0631\u0627\u0621\u0627\u062A</th></tr></thead>
          <tbody>
            ${filteredRows.map((employee) => `
              <tr>
                <td>${employee.id}</td>
                <td>${escapeHtml(employee.fullName)}</td>
                <td>${escapeHtml(getEmployeeDepartment(employee.id).name || "\u063A\u064A\u0631 \u0645\u0648\u0632\u0639")}</td>
                <td>${escapeHtml(employee.jobTitle || "")}</td>
                <td>${shiftLabel(employee.shift)}</td>
                <td>${escapeHtml(employee.phone || "")}</td>
                <td class="actions">
                  <button class="secondary-button" data-edit-employee="${employee.id}"><i data-lucide="pencil"></i>\u062A\u0639\u062F\u064A\u0644</button>
                  <button class="danger-button" data-delete-employee="${employee.id}"><i data-lucide="trash-2"></i>\u062D\u0630\u0641</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
function bindPermittedAdminActions() {
  bindAdmin();
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
  const payrollFilterForm = document.getElementById("payroll-filter-form");
  if (payrollFilterForm) payrollFilterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    sessionStorage.setItem("payroll-employee", data.employeeId || "");
    sessionStorage.setItem("payroll-month", data.month || todayIso().slice(0, 7));
    render();
  });
  const payrollProfileForm = document.getElementById("payroll-profile-form");
  if (payrollProfileForm) payrollProfileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canManageAccounting()) {
      toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u0645\u0644\u0641 \u0627\u0644\u0631\u0627\u062A\u0628", "error");
      return;
    }
    const data = Object.fromEntries(new FormData(event.target).entries());
    const payload = {
      baseSalary: Number(data.baseSalary || 0),
      socialSecurity: Number(data.socialSecurity || 0),
      allowances: {
        cleaning: { label: "\u0628\u062F\u0644 \u0646\u0638\u0627\u0641\u0629", amount: Number(data.cleaningAllowance || 0) },
        hazard: { label: "\u0628\u062F\u0644 \u0645\u0647\u0646 \u062E\u0637\u0631\u0629", amount: Number(data.hazardAllowance || 0) }
      }
    };
    await set(ref(db, `payroll/profiles/${data.employeeId}`), payload);
    toast("\u062A\u0645 \u062D\u0641\u0638 \u0645\u0644\u0641 \u0627\u0644\u0631\u0627\u062A\u0628");
  });
  const payrollManualForm = document.getElementById("payroll-manual-form");
  if (payrollManualForm) payrollManualForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canManageAccounting()) {
      toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0625\u0636\u0627\u0641\u0629 \u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0631\u0627\u062A\u0628", "error");
      return;
    }
    const data = Object.fromEntries(new FormData(event.target).entries());
    const id = String(Date.now());
    await set(ref(db, `payroll/slips/${data.employeeId}/${data.month}/manualItems/${id}`), {
      label: data.label,
      amount: Number(data.amount || 0),
      kind: data.kind
    });
    event.target.reset();
    toast("\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0639\u0644\u0649 \u0627\u0644\u0643\u0634\u0641");
  });
  document.querySelectorAll("[data-delete-payroll-item]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!canManageAccounting()) {
        toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062D\u0630\u0641 \u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0627\u0644\u0631\u0627\u062A\u0628", "error");
        return;
      }
      const employeeId = sessionStorage.getItem("payroll-employee") || "";
      const month = sessionStorage.getItem("payroll-month") || todayIso().slice(0, 7);
      await set(ref(db, `payroll/slips/${employeeId}/${month}/overrides/${button.dataset.deletePayrollItem}`), { hidden: true });
      toast("\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0628\u0646\u062F \u0645\u0646 \u0643\u0634\u0641 \u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631");
    });
  });
  document.querySelectorAll("[data-edit-payroll-item]").forEach((button) => {
    button.addEventListener("click", () => openPayrollItemEditor(button.dataset.editPayrollItem));
  });
  document.querySelectorAll("[data-delay-advance]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!canManageAccounting()) {
        toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0623\u062C\u064A\u0644 \u062E\u0635\u0645 \u0627\u0644\u0633\u0644\u0641\u0629", "error");
        return;
      }
      await set(ref(db, `payroll/advanceDelays/${button.dataset.delayAdvance}/${button.dataset.month}`), true);
      toast("\u062A\u0645 \u062A\u0623\u062C\u064A\u0644 \u0642\u0633\u0637 \u0627\u0644\u0633\u0644\u0641\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631");
    });
  });
  document.querySelectorAll("[data-publish-payslip]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!canPublishPayslips()) {
        toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0646\u0634\u0631 \u0642\u0633\u0627\u0626\u0645 \u0627\u0644\u0631\u0627\u062A\u0628", "error");
        return;
      }
      const employeeId = button.dataset.publishPayslip;
      const month = button.dataset.month;
      const payroll = computePayroll(employeeId, month);
      const publishedSnapshot = __spreadProps(__spreadValues({}, payroll), { status: "published", publishedAt: Date.now() });
      await update(ref(db, `payroll/slips/${employeeId}/${month}`), {
        status: "published",
        publishedAt: publishedSnapshot.publishedAt,
        publishedBy: state.session.id,
        snapshot: publishedSnapshot
      });
      toast("\u062A\u0645 \u0646\u0634\u0631 \u0642\u0633\u064A\u0645\u0629 \u0627\u0644\u0631\u0627\u062A\u0628 \u0644\u0644\u0645\u0648\u0638\u0641");
    });
  });
  const holidayForm = document.getElementById("holiday-form");
  if (holidayForm) holidayForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    try {
      await set(ref(db, `holidays/${data.date}`), data);
      event.target.reset();
      toast("\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0639\u0637\u0644\u0629 \u0627\u0644\u0631\u0633\u0645\u064A\u0629");
    } catch (error) {
      console.error(error);
      toast("\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u0639\u0637\u0644\u0629 \u0627\u0644\u0631\u0633\u0645\u064A\u0629", "error");
    }
  });
  document.querySelectorAll("[data-delete-holiday]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await remove(ref(db, `holidays/${button.dataset.deleteHoliday}`));
        toast("\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0639\u0637\u0644\u0629 \u0627\u0644\u0631\u0633\u0645\u064A\u0629");
      } catch (error) {
        console.error(error);
        toast("\u062A\u0639\u0630\u0631 \u062D\u0630\u0641 \u0627\u0644\u0639\u0637\u0644\u0629 \u0627\u0644\u0631\u0633\u0645\u064A\u0629", "error");
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
      toast("\u062A\u0645 \u062D\u0641\u0638 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062F\u0648\u0627\u0645");
    } catch (error) {
      console.error(error);
      toast("\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062F\u0648\u0627\u0645", "error");
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
          title: `\u0625\u0634\u0639\u0627\u0631 \u0642\u0633\u0645 ${data.name}`,
          body: data.message,
          type: "private",
          employeeId,
          date: todayIso(),
          createdAt: Date.now(),
          publisherId: state.session.id,
          publisherName: currentUser().fullName || "\u0645\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0646\u0638\u0627\u0645"
        })));
      }
      form.reset();
      sessionStorage.removeItem("editing-department");
      toast("\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0642\u0633\u0645");
    } catch (error) {
      console.error(error);
      toast("\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u0642\u0633\u0645", "error");
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
        toast("\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0642\u0633\u0645");
      } catch (error) {
        console.error(error);
        toast("\u062A\u0639\u0630\u0631 \u062D\u0630\u0641 \u0627\u0644\u0642\u0633\u0645", "error");
      }
    });
  });
  document.querySelectorAll("[data-remove-department-employee]").forEach((button) => {
    button.addEventListener("click", async () => {
      const departmentId = button.dataset.removeDepartmentEmployee;
      const employeeId = button.dataset.employeeId;
      try {
        await remove(ref(db, `departments/${departmentId}/employeeIds/${employeeId}`));
        toast("\u062A\u0645\u062A \u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0645\u0648\u0638\u0641 \u0645\u0646 \u0627\u0644\u0642\u0633\u0645");
      } catch (error) {
        console.error(error);
        toast("\u062A\u0639\u0630\u0631 \u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0645\u0648\u0638\u0641 \u0645\u0646 \u0627\u0644\u0642\u0633\u0645", "error");
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
      permissions: permissionDefinitions.reduce((permissions, [name]) => {
        permissions[name] = data[name] === "true";
        return permissions;
      }, {})
    };
    try {
      const editingPermissionId = sessionStorage.getItem("editing-permission") || "";
      if (editingPermissionId && editingPermissionId !== roleId) {
        await remove(ref(db, `permissions/${editingPermissionId}`));
      }
      await set(ref(db, `permissions/${roleId}`), payload);
      sessionStorage.removeItem("editing-permission");
      event.target.reset();
      toast(editingPermissionId ? "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A" : "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A");
    } catch (error) {
      console.error(error);
      toast("\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A", "error");
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
      toast("\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0634\u0641\u062A");
    } catch (error) {
      console.error(error);
      toast("\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u0634\u0641\u062A", "error");
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
        toast("\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629");
      } catch (error) {
        console.error(error);
        toast("\u062A\u0639\u0630\u0631 \u062D\u0630\u0641 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629", "error");
      }
    });
  });
  const announcementForm = document.getElementById("announcement-form");
  if (announcementForm) announcementForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    if (data.type === "private" && !data.employeeId) {
      toast("\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u0648\u0638\u0641 \u0644\u0644\u0625\u0639\u0644\u0627\u0646 \u0627\u0644\u062E\u0627\u0635", "error");
      return;
    }
    await push(ref(db, "announcements"), __spreadProps(__spreadValues({}, data), {
      createdAt: Date.now(),
      publisherId: state.session.id,
      publisherName: currentUser().fullName || "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0646\u0638\u0627\u0645"
    }));
    event.target.reset();
    toast("\u062A\u0645 \u0646\u0634\u0631 \u0627\u0644\u0625\u0639\u0644\u0627\u0646");
  });
  document.querySelectorAll("[data-delete-announcement]").forEach((button) => {
    button.addEventListener("click", async () => {
      await remove(ref(db, `announcements/${button.dataset.deleteAnnouncement}`));
      toast("\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0625\u0639\u0644\u0627\u0646");
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
      toast("\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0648\u0638\u0641");
    });
  });
}
function openAttendanceEditor(employeeId) {
  if (state.session && state.session.role !== "admin" && !canManageEmployeeInDepartment(employeeId, "editAttendance")) {
    toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u062F\u0648\u0627\u0645 \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0638\u0641", "error");
    return;
  }
  const todayRecord = state.attendance[employeeId] && state.attendance[employeeId][todayIso()] ? state.attendance[employeeId][todayIso()] : {};
  openModal(`
    <h2>\u062A\u0633\u062C\u064A\u0644 \u0623\u0648 \u062A\u0639\u062F\u064A\u0644 \u064A\u0648\u0645 \u062F\u0648\u0627\u0645</h2>
    <form id="attendance-editor-form" class="grid two">
      <div class="field"><label>\u0627\u0644\u0645\u0648\u0638\u0641</label><input value="${escapeAttr(employeeName(employeeId))}" readonly /></div>
      <div class="field"><label>\u0627\u0644\u062A\u0627\u0631\u064A\u062E</label><input name="date" type="date" required value="${todayRecord.date || todayIso()}" /></div>
      <div class="field">
        <label>\u0627\u0644\u062D\u0627\u0644\u0629</label>
        <select name="status" required>
          <option value="present">\u062D\u0627\u0636\u0631</option>
          <option value="late">\u0645\u062A\u0623\u062E\u0631</option>
          <option value="absent">\u063A\u0627\u0626\u0628</option>
        </select>
      </div>
      <div class="field"><label>\u0628\u062F\u0627\u064A\u0629 \u0627\u0644\u062F\u0648\u0627\u0645</label><input name="shiftStart" type="time" value="${todayRecord.shiftStart || "08:00"}" /></div>
      <div class="field"><label>\u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u062F\u0648\u0627\u0645</label><input name="shiftEnd" type="time" value="${todayRecord.shiftEnd || "17:00"}" /></div>
      <div class="field"><label>\u0648\u0642\u062A \u0627\u0644\u062D\u0636\u0648\u0631</label><input name="checkIn" type="time" value="${todayRecord.checkIn || ""}" /></div>
      <div class="field"><label>\u0648\u0642\u062A \u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641</label><input name="checkOut" type="time" value="${todayRecord.checkOut || ""}" /></div>
      ${textareaField("notes", "\u0645\u0644\u0627\u062D\u0638\u0627\u062A", false)}
      <button class="primary-button" type="submit"><i data-lucide="save"></i>\u062D\u0641\u0638 \u0633\u062C\u0644 \u0627\u0644\u062F\u0648\u0627\u0645</button>
    </form>
  `);
  const statusSelect = document.querySelector('#attendance-editor-form [name="status"]');
  statusSelect.value = todayRecord.status || "present";
  document.querySelector('#attendance-editor-form [name="notes"]').value = todayRecord.notes || "";
  document.getElementById("attendance-editor-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    const payload = __spreadProps(__spreadValues({}, data), { employeeId });
    try {
      await set(ref(db, `attendance/${employeeId}/${data.date}`), payload);
      closeModal();
      toast("\u062A\u0645 \u062D\u0641\u0638 \u0633\u062C\u0644 \u0627\u0644\u062F\u0648\u0627\u0645");
    } catch (error) {
      console.error(error);
      toast("\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0633\u062C\u0644 \u0627\u0644\u062F\u0648\u0627\u0645. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0635\u0644\u0627\u062D\u064A\u0627\u062A Firebase.", "error");
    }
  });
}
function openStatusModal(id, status) {
  const request = state.requests[id];
  if (!request) {
    toast("\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", "error");
    return;
  }
  if (!canReviewRequest(request)) {
    toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0645\u0631\u0627\u062C\u0639\u0629 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628", "error");
    return;
  }
  if (request && request.deleted) {
    toast("\u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628 \u0645\u062D\u0630\u0648\u0641 \u0648\u0645\u0642\u0641\u0644 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u062A\u0647", "error");
    return;
  }
  openModal(`
    <h2>\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628 \u0625\u0644\u0649: ${statusLabels[status]}</h2>
    <form id="status-form" class="grid">
      ${textareaField("adminReason", "\u0633\u0628\u0628 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u0625\u062F\u0627\u0631\u064A", false)}
      <button class="primary-button" type="submit"><i data-lucide="save"></i>\u062D\u0641\u0638</button>
    </form>
  `);
  document.getElementById("status-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    try {
      await applyRequestStatus(id, status, data.adminReason || "");
      closeModal();
      toast("\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628");
    } catch (error) {
      console.error(error);
      toast(error.message || "\u062A\u0639\u0630\u0631 \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628", "error");
    }
  });
}
function openPayrollItemEditor(itemId) {
  const employeeId = sessionStorage.getItem("payroll-employee") || "";
  const month = sessionStorage.getItem("payroll-month") || todayIso().slice(0, 7);
  const payroll = computePayroll(employeeId, month);
  const item = [...payroll.earnings || [], ...payroll.deductions || []].find((entry) => entry.id === itemId);
  if (!item) return;
  openModal(`
    <h2>\u062A\u0639\u062F\u064A\u0644 \u0628\u0646\u062F \u0627\u0644\u0631\u0627\u062A\u0628</h2>
    <form id="payroll-item-form" class="grid two">
      <div class="field"><label>\u0627\u0633\u0645 \u0627\u0644\u0628\u0646\u062F</label><input name="label" required value="${escapeAttr(item.label)}" /></div>
      <div class="field"><label>\u0627\u0644\u0642\u064A\u0645\u0629</label><input name="amount" type="number" step="0.01" required value="${Number(item.amount || 0)}" /></div>
      <button class="primary-button" type="submit"><i data-lucide="save"></i>\u062D\u0641\u0638 \u0627\u0644\u062A\u0639\u062F\u064A\u0644</button>
    </form>
  `);
  document.getElementById("payroll-item-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canManageAccounting()) {
      toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u0628\u0646\u0648\u062F \u0627\u0644\u0631\u0627\u062A\u0628", "error");
      return;
    }
    const data = Object.fromEntries(new FormData(event.target).entries());
    await set(ref(db, `payroll/slips/${employeeId}/${month}/overrides/${itemId}`), {
      label: data.label,
      amount: Number(data.amount || 0),
      hidden: false
    });
    closeModal();
    toast("\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0628\u0646\u062F \u0627\u0644\u0631\u0627\u062A\u0628");
  });
}
async function applyRequestStatus(id, status, adminReason) {
  const request = state.requests[id];
  if (!request) throw new Error("\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
  if (request.deleted || request.locked) throw new Error("\u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628 \u0645\u062D\u0630\u0648\u0641 \u0648\u0645\u0642\u0641\u0644 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u062A\u0647");
  const updates = {};
  updates["requests/" + id + "/status"] = status;
  updates["requests/" + id + "/adminReason"] = adminReason;
  updates["requests/" + id + "/reviewedAt"] = Date.now();
  updates["requests/" + id + "/reviewedBy"] = state.session.id;
  if (status === "approved" && request.type === "leave" && request.details && request.details.leaveType === "\u0633\u0646\u0648\u064A\u0629") {
    const employee = state.employees[request.employeeId] || {};
    const days = Number(request.details.days || 0);
    if (leaveBalance(employee) < days) {
      throw new Error("\u0631\u0635\u064A\u062F \u0627\u0644\u0625\u062C\u0627\u0632\u0627\u062A \u0644\u0627 \u064A\u0643\u0641\u064A \u0644\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628");
    }
    updates["employees/" + request.employeeId + "/usedLeave"] = Number(employee.usedLeave || 0) + days;
  }
  if (status === "approved" && request.type === "advance") {
    updates["requests/" + id + "/advanceSent"] = true;
    updates["requests/" + id + "/advanceSentAt"] = Date.now();
  }
  await update(ref(db), updates);
}
function openAnnouncementEditor(id) {
  const item = state.announcements[id];
  if (!item) return;
  openModal(`
    <h2>\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0625\u0639\u0644\u0627\u0646</h2>
    <form id="edit-announcement-form" class="grid two">
      <div class="field"><label>\u0627\u0644\u0639\u0646\u0648\u0627\u0646</label><input name="title" required value="${escapeAttr(item.title)}" /></div>
      <div class="field"><label>\u0627\u0644\u062A\u0627\u0631\u064A\u062E</label><input name="date" type="date" required value="${item.date || todayIso()}" /></div>
      ${selectField("type", "\u0646\u0648\u0639 \u0627\u0644\u0625\u0639\u0644\u0627\u0646", ["public", "private"], true)}
      <div class="field"><label>\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0638\u0641</label><input name="employeeId" value="${item.employeeId || ""}" /></div>
      <div class="field" style="grid-column: 1 / -1"><label>\u0627\u0644\u0646\u0635</label><textarea name="body" required>${escapeHtml(item.body)}</textarea></div>
      <button class="primary-button" type="submit"><i data-lucide="save"></i>\u062D\u0641\u0638</button>
    </form>
  `);
  document.querySelector('[name="type"]').value = item.type;
  document.getElementById("edit-announcement-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await update(ref(db, `announcements/${id}`), Object.fromEntries(new FormData(event.target).entries()));
    closeModal();
    toast("\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0625\u0639\u0644\u0627\u0646");
  });
}
function openEmployeeEditor(id = "") {
  const employee = id ? state.employees[id] : {};
  openModal(`
    <h2>${id ? "\u062A\u0639\u062F\u064A\u0644 \u0645\u0648\u0638\u0641" : "\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0638\u0641"}</h2>
    <form id="employee-form" class="grid two">
      <div class="field"><label>\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0638\u0641</label><input name="id" required ${id ? "readonly" : ""} value="${employee.id || ""}" /></div>
      <div class="field"><label>\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631</label><input name="password" required value="${employee.password || "1234"}" /></div>
      <div class="field"><label>\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u0631\u0628\u0627\u0639\u064A</label><input name="fullName" required value="${escapeAttr(employee.fullName || "")}" /></div>
      ${fieldWithValue("birthDate", "date", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u064A\u0644\u0627\u062F", employee.birthDate)}
      ${fieldWithValue("hireDate", "date", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0639\u064A\u064A\u0646", employee.hireDate)}
      <div class="field"><label>\u0627\u0644\u062C\u0646\u0633\u064A\u0629</label><input name="nationality" value="${escapeAttr(employee.nationality || "\u0623\u0631\u062F\u0646\u064A")}" /></div>
      ${fieldWithValue("contractEnd", "date", "\u062A\u0627\u0631\u064A\u062E \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0639\u0642\u062F", employee.contractEnd)}
      <div class="field"><label>\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0633\u0627\u0628\u0642</label><input name="previousLeave" type="number" value="${employee.previousLeave || 0}" /></div>
      <div class="field"><label>\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u062C\u062F\u064A\u062F</label><input name="newLeave" type="number" value="${employee.newLeave !== void 0 && employee.newLeave !== null ? employee.newLeave : 14}" /></div>
      <div class="field"><label>\u0627\u0644\u0623\u064A\u0627\u0645 \u0627\u0644\u0645\u0633\u062A\u0647\u0644\u0643\u0629</label><input name="usedLeave" type="number" value="${employee.usedLeave || 0}" /></div>
      <div class="field"><label>\u0627\u0644\u0645\u0633\u0645\u0649 \u0627\u0644\u0648\u0638\u064A\u0641\u064A</label><input name="jobTitle" value="${escapeAttr(employee.jobTitle || "")}" /></div>
      <div class="field"><label>\u0627\u0644\u0642\u0633\u0645</label><input value="${escapeAttr(getEmployeeDepartment(employee.id).name || "\u064A\u062D\u062F\u062F \u0645\u0646 \u0634\u0627\u0634\u0629 \u0627\u0644\u0623\u0642\u0633\u0627\u0645")}" readonly /></div>
      <div class="field">
        <label>\u0627\u0644\u0634\u0641\u062A</label>
        <select name="shift">
          ${Object.entries(getShifts()).map(([id2, shift]) => `<option value="${id2}" ${id2 === (employee.shift || "morning") ? "selected" : ""}>${shift.label} (${shift.start} - ${shift.end})</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>\u0631\u0642\u0645 \u0647\u0627\u062A\u0641</label><input name="phone" value="${employee.phone || ""}" /></div>
      <div class="field"><label>\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0628\u062F\u064A\u0644</label><input name="altPhone" value="${employee.altPhone || ""}" /></div>
      <button class="primary-button" type="submit"><i data-lucide="save"></i>\u062D\u0641\u0638 \u0627\u0644\u0645\u0648\u0638\u0641</button>
    </form>
  `);
  document.getElementById("employee-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    if (!isJordanPhone(data.phone) && !isJordanPhone(data.altPhone)) {
      toast("\u064A\u062C\u0628 \u0625\u062F\u062E\u0627\u0644 \u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0623\u0631\u062F\u0646\u064A \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644", "error");
      return;
    }
    data.role = "employee";
    const oldShift = employee.shift || "morning";
    ["previousLeave", "newLeave", "usedLeave"].forEach((key) => data[key] = Number(data[key] || 0));
    await set(ref(db, `employees/${data.id}`), data);
    if (id && oldShift !== data.shift) {
      await push(ref(db, "announcements"), {
        title: "\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0634\u0641\u062A",
        body: `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0634\u0641\u062A\u0643 \u0625\u0644\u0649 ${shiftLabel(data.shift)}.`,
        type: "private",
        employeeId: data.id,
        date: todayIso(),
        createdAt: Date.now(),
        publisherId: state.session.id,
        publisherName: currentUser().fullName || "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0646\u0638\u0627\u0645"
      });
    }
    closeModal();
    toast("\u062A\u0645 \u062D\u0641\u0638 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641");
  });
}
function openDepartmentEmployeeEditor(id) {
  const employee = state.employees[id];
  if (!employee) return;
  openModal(`
    <h2>\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0648\u0638\u0641 \u0645\u0646 \u0627\u0644\u0642\u0633\u0645</h2>
    <form id="department-employee-form" class="grid two">
      <div class="field"><label>\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0638\u0641</label><input value="${escapeAttr(employee.id)}" readonly /></div>
      <div class="field"><label>\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0638\u0641</label><input value="${escapeAttr(employee.fullName || "")}" readonly /></div>
      <div class="field"><label>\u0627\u0644\u0645\u0633\u0645\u0649 \u0627\u0644\u0648\u0638\u064A\u0641\u064A</label><input name="jobTitle" value="${escapeAttr(employee.jobTitle || "")}" /></div>
      <div class="field"><label>\u0631\u0642\u0645 \u0647\u0627\u062A\u0641</label><input name="phone" value="${employee.phone || ""}" /></div>
      <div class="field"><label>\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0628\u062F\u064A\u0644</label><input name="altPhone" value="${employee.altPhone || ""}" /></div>
      <button class="primary-button" type="submit"><i data-lucide="save"></i>\u062D\u0641\u0638 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0648\u0638\u0641 \u0627\u0644\u0642\u0633\u0645</button>
    </form>
  `);
  document.getElementById("department-employee-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canManageEmployeeInDepartment(id, "editDepartmentEmployees")) {
      toast("\u0644\u064A\u0633\u062A \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0638\u0641", "error");
      return;
    }
    const data = Object.fromEntries(new FormData(event.target).entries());
    if (!isJordanPhone(data.phone) && !isJordanPhone(data.altPhone)) {
      toast("\u064A\u062C\u0628 \u0625\u062F\u062E\u0627\u0644 \u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0623\u0631\u062F\u0646\u064A \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644", "error");
      return;
    }
    try {
      await update(ref(db, `employees/${id}`), data);
      closeModal();
      toast("\u062A\u0645 \u062D\u0641\u0638 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0648\u0638\u0641 \u0627\u0644\u0642\u0633\u0645");
    } catch (error) {
      console.error(error);
      toast("\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641", "error");
    }
  });
}
function fieldWithValue(name, type, label, value) {
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${value || ""}" /></div>`;
}
function employeeName(id) {
  return state.employees[id] && state.employees[id].fullName ? state.employees[id].fullName : id || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F";
}
function openModal(html) {
  closeModal();
  const template = document.getElementById("modal-template");
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector(".modal-body").innerHTML = html;
  document.body.appendChild(node);
  node.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (event.target === node || target && target.closest(".modal-close")) closeModal();
  });
  bindRequestTableActions();
  hydrateIcons();
}
function closeModal() {
  const modalBackdrop = document.querySelector(".modal-backdrop");
  if (modalBackdrop) modalBackdrop.remove();
}
function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function escapeAttr(value = "") {
  return escapeHtml(value);
}
ensureSeedData().then(() => {
  subscribeData();
  render();
}).catch((error) => {
  console.error(error);
  root.innerHTML = `
      <main class="login-shell">
        <section class="login-panel">
          <div class="brand-mark"><i data-lucide="factory"></i><span>\u0625\u062F\u0627\u0631\u0629 \u0645\u0635\u0646\u0639 \u0627\u0644\u062D\u062F\u064A\u062F</span></div>
          <h1>\u062A\u0639\u0630\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A</h1>
          <p class="hint">\u062A\u0623\u0643\u062F \u0645\u0646 \u0625\u0639\u062F\u0627\u062F\u0627\u062A Firebase \u0648\u0642\u0648\u0627\u0639\u062F Realtime Database \u0648 Storage.</p>
          <pre>${escapeHtml(error.message)}</pre>
        </section>
      </main>
    `;
  hydrateIcons();
});
