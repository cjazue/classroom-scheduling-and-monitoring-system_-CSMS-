document.addEventListener("DOMContentLoaded", () => {
  if (Auth.isLoggedIn()) {
    window.location.href = Auth.isAdmin() ? "Admindashboard.html" : "dashboard.html";
    return;
  }

  const loginForm = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginBtn");
  if (!loginBtn) return;

  const toggle = document.getElementById("togglePassword");
  const passEl = document.getElementById("loginPassword");
  if (toggle && passEl) {
    toggle.addEventListener("change", () => {
      passEl.type = toggle.checked ? "text" : "password";
    });
  }

  async function handleLogin() {
    clearErrors();

    const emailEl = document.getElementById("loginEmail");
    if (!emailEl || !passEl) return;

    const email = (emailEl.value || "").trim();
    const password = passEl.value || "";

    const errors = {};
    if (!email) errors.email = "Email is required.";
    if (!password) errors.password = "Password is required.";

    if (Object.keys(errors).length) {
      showErrors("loginError", errors);
      return;
    }

    setLoading("loginBtn", true, "Logging in...");
    try {
      // Backend returns: { success, message, data: { access_token, refresh_token, user } }
      const res = await API.login(email, password);
      const accessToken = res?.data?.access_token;
      const refreshToken = res?.data?.refresh_token;
      const user = res?.data?.user;
      if (!accessToken || !refreshToken || !user) throw { error: "Login failed: invalid server response." };
      Auth.setToken(accessToken);
      localStorage.setItem("plv_refresh_token", refreshToken);
      Auth.setUser(user);


      window.location.href = Auth.isAdmin() ? "Admindashboard.html" : "dashboard.html";
    } catch (err) {
      const msg = err?.error || err?.message || "Invalid email or password.";
      showError("loginError", msg);
    } finally {
      setLoading("loginBtn", false, "Log In");
    }
  }

  loginBtn.addEventListener("click", handleLogin);
  if (loginForm) loginForm.addEventListener("submit", handleLogin);

  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = msg;
      el.style.display = "block";
    }
  }

  function showErrors(containerId, errorsObj) {
    const msgs = Object.values(errorsObj).join(" - ");
    showError(containerId, msgs);
  }

  function clearErrors() {
    document.querySelectorAll(".form-error").forEach(el => {
      el.textContent = "";
      el.style.display = "none";
    });
  }

  function setLoading(btnId, loading, label) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = !!loading;
    btn.textContent = label;
  }
});

