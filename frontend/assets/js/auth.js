const PLV_EMAIL_RE     = /^[a-zA-Z0-9_.+-]+@plv\.edu\.ph$/i;
const STUDENT_ID_RE    = /^\d{2}-\d{4}$/;
const COURSE_SECTION_RE = /^[A-Z]{4} (10|[1-9])-(10|[1-9])$/;

document.addEventListener("DOMContentLoaded", () => {
  if (Auth.isLoggedIn()) {
    window.location.href = "dashboard.html";
    return;
  }


  const loginSection    = document.getElementById("loginSection");
  const registerSection = document.getElementById("registerSection");
  const toRegisterLink  = document.getElementById("toRegister");
  const toLoginLink     = document.getElementById("toLogin");

  toRegisterLink.addEventListener("click", (e) => {
    e.preventDefault();
    loginSection.style.display    = "none";
    registerSection.style.display = "block";
    clearErrors();
  });

  toLoginLink.addEventListener("click", (e) => {
    e.preventDefault();
    registerSection.style.display = "none";
    loginSection.style.display    = "block";
    clearErrors();
  });

  const studentIdInput = document.getElementById("regStudentId");
  if (studentIdInput) {
    studentIdInput.addEventListener("input", () => {
      const val = studentIdInput.value;
      const hint = document.getElementById("studentIdHint");
      if (!hint) return;
      if (!val) { hint.textContent = ""; return; }
      hint.textContent = STUDENT_ID_RE.test(val)
        ? "✓ Valid format"
        : "Format: XX-XXXX  (e.g. 21-0001)";
      hint.style.color = STUDENT_ID_RE.test(val) ? "#059669" : "#d97706";
    });
  }

  const csInput = document.getElementById("regCourseSection");
  if (csInput) {
    csInput.addEventListener("input", () => {
      const val = csInput.value.toUpperCase();
      csInput.value = val;
      const hint = document.getElementById("courseSectionHint");
      if (!hint) return;
      if (!val) { hint.textContent = ""; return; }
      hint.textContent = COURSE_SECTION_RE.test(val)
        ? "✓ Valid format"
        : "Format: AAAA X-X  (e.g. BSIT 1-1, BSED 3-10)";
      hint.style.color = COURSE_SECTION_RE.test(val) ? "#059669" : "#d97706";
    });
  }

  document.getElementById("loginBtn").addEventListener("click", async () => {
    clearErrors();
    const email    = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    const errors = {};
    if (!email)    errors.email    = "Email is required.";
    else if (!PLV_EMAIL_RE.test(email))
                   errors.email    = "Must be a PLV email (e.g. juandelacruz@plv.edu.ph).";
    if (!password) errors.password = "Password is required.";

    if (Object.keys(errors).length) {
      showErrors("loginError", errors);
      return;
    }

    setLoading("loginBtn", true, "Logging in…");
    try {
      const res = await API.login(email, password);
      Auth.setToken(res.data.access_token);
      localStorage.setItem("plv_refresh_token", res.data.refresh_token);
      Auth.setUser(res.data.user);
      window.location.href = "dashboard.html";
    } catch (err) {
      showError("loginError", err.error || "Login failed. Please try again.");
    } finally {
      setLoading("loginBtn", false, "Log In");
    }
  });

  document.getElementById("registerBtn").addEventListener("click", async () => {
    clearErrors();

    const name          = document.getElementById("regName").value.trim();
    const email         = document.getElementById("regEmail").value.trim().toLowerCase();
    const student_id    = document.getElementById("regStudentId").value.trim();
    const course_section = document.getElementById("regCourseSection").value.trim().toUpperCase();
    const password      = document.getElementById("regPassword").value;
    const errors = {};
    if (!name)
      errors.name = "Name is required.";

    if (!email)
      errors.email = "School email is required.";
    else if (!PLV_EMAIL_RE.test(email))
      errors.email = "Must be a valid PLV email (e.g. juandelacruz@plv.edu.ph).";

    if (!student_id)
      errors.student_id = "Student ID is required.";
    else if (!STUDENT_ID_RE.test(student_id))
      errors.student_id = "Format must be XX-XXXX (e.g. 21-0001).";

    if (!course_section)
      errors.course_section = "Course/Section is required.";
    else if (!COURSE_SECTION_RE.test(course_section))
      errors.course_section = "Format must be AAAA X-X (e.g. BSIT 1-1, BSED 3-10).";

    if (!password)
      errors.password = "Password is required.";
    else if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password))
      errors.password = "Min 8 characters, 1 uppercase letter, 1 number.";

    if (Object.keys(errors).length) {
      showErrors("registerError", errors);
      return;
    }

    setLoading("registerBtn", true, "Registering…");
    try {
      await API.register({ name, email, student_id, course_section, password });
      const res = await API.login(email, password);
      Auth.setToken(res.data.access_token);
      localStorage.setItem("plv_refresh_token", res.data.refresh_token);
      Auth.setUser(res.data.user);
      window.location.href = "dashboard.html";
    } catch (err) {
      if (err.errors) {
        showErrors("registerError", err.errors);
      } else {
        showError("registerError", err.error || "Registration failed.");
      }
    } finally {
      setLoading("registerBtn", false, "Register");
    }
  });

  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = "block"; }
  }

  function showErrors(containerId, errorsObj) {
    const msgs = Object.values(errorsObj).join(" • ");
    showError(containerId, msgs);
  }

  function clearErrors() {
    document.querySelectorAll(".form-error").forEach(el => {
      el.textContent = "";
      el.style.display = "none";
    });
    document.querySelectorAll(".field-hint").forEach(el => {
      el.textContent = "";
    });
  }

  function setLoading(btnId, loading, label) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled    = loading;
    btn.textContent = label;
  }
});