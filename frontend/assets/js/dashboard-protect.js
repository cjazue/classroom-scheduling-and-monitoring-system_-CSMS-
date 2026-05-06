document.addEventListener("DOMContentLoaded", () => {
  const user = requireAuth();
  if (!user) return;

  const expectedRole = document.body.dataset.role;
  if (expectedRole && user.role !== expectedRole) {
    window.location.href = getDashboardPath(user.role);
  }
});
