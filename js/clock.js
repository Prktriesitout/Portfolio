/**
 * Windows XP System Tray Clock
 * Displays visitor's current local time in h:mm AM/PM format
 * Sets full date as tooltip on hover and updates every second without drift.
 */

window.XP = window.XP || {};

(function () {
  function formatTime(date) {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${formattedMinutes} ${ampm}`;
  }

  function formatDateTooltip(date) {
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString(undefined, options);
  }

  function updateClock() {
    const clockEl = document.getElementById('tray-clock');
    if (!clockEl) return;

    const now = new Date();
    clockEl.textContent = formatTime(now);
    clockEl.title = formatDateTooltip(now);
  }

  function initClock() {
    updateClock();
    // Update every second to ensure accuracy
    setInterval(updateClock, 1000);
  }

  window.XP.initClock = initClock;
})();
