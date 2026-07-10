/**
 * Advanced PWA Shift Timer - Fullscreen "Big Clock" Overlay & Dialog flow.
 * Rich Glassmorphism, Glowing digital timer, SVG active status ring, pause/resume and push notifications.
 */

import { store } from '../../core/store.js';
import { bus } from '../../core/events.js';
import { db } from '../../core/db.js';
import { t } from '../../utils/strings.js';
import { getIcon } from '../../ui/icons.js';
import {
  startShiftTimer,
  pauseShiftTimer,
  resumeShiftTimer,
  stopShiftTimer,
  saveShift,
} from './shifts.js';
import { showToast, showModal, showDrawer } from '../../ui/components.js';
import { renderShiftForm } from './shift-form.js';
import { GPSTracker } from '../../core/gps-tracker.js';

let clockOverlayEl = null;
let updateInterval = null;

const PLAY_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle;"><path d="M21.4086 9.35258C23.5305 10.5065 23.5305 13.4935 21.4086 14.6474L8.59662 21.6145C6.53435 22.736 4 21.2763 4 18.9671L4 5.0329C4 2.72368 6.53435 1.26402 8.59661 2.38548L21.4086 9.35258Z" fill="currentColor"></path></svg>`;

const PAUSE_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle;"><path d="M2 6C2 4.11438 2 3.17157 2.58579 2.58579C3.17157 2 4.11438 2 6 2C7.88562 2 8.82843 2 9.41421 2.58579C10 3.17157 10 4.11438 10 6V18C10 19.8856 10 20.8284 9.41421 21.4142C8.82843 22 7.88562 22 6 22C4.11438 22 3.17157 22 2.58579 21.4142C2 20.8284 2 19.8856 2 18V6Z" fill="currentColor"></path><path opacity="0.5" d="M14 6C14 4.11438 14 3.17157 14.5858 2.58579C15.1716 2 16.1144 2 18 2C19.8856 2 20.8284 2 21.4142 2.58579C22 3.17157 22 4.11438 22 6V18C22 19.8856 22 20.8284 21.4142 21.4142C20.8284 22 19.8856 22 18 22C16.1144 22 15.1716 22 14.5858 21.4142C14 20.8284 14 19.8856 14 18V6Z" fill="currentColor"></path></svg>`;

const MINIMIZE_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle;"><path d="M20 4L14 10M14 10H17.75M14 10V6.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M4 20L10 14M10 14H6.25M10 14V17.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C21.5093 4.43821 21.8356 5.80655 21.9449 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg>`;

const GOT_ORDER_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle;" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>`;

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/**
 * Formats duration in ms to HH:MM:SS
 * @param {number} ms 
 * @returns {string}
 */
function formatTimeMs(ms) {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return [
    hrs.toString().padStart(2, '0'),
    mins.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0'),
  ].join(':');
}

/**
 * Prompts user to start a shift.
 * Asks for platform selection, target end-time, and notification permission.
 */
export async function openStartShiftWizard() {
  const platforms = store.get('platforms') || [];
  if (platforms.length === 0) {
    showToast({ type: 'warning', message: 'Please add/activate a platform in Settings first!', duration: 3000 });
    return;
  }

  // Get active vehicles
  const vehicles = (await db.vehicles.toArray()).filter(v => v.active !== false && v.syncDeletedAt == null);

  if (vehicles.length > 1) {
    // Step 1: Multiple vehicles -> Select Vehicle
    const vehicleDrawer = showDrawer({
      title: 'Select Active Vehicle',
      content: `
        <div class="shift-wizard-wrap">
          <p class="shift-wizard-lead">Which vehicle are you driving for this active shift?</p>
          <div class="wizard-vehicle-grid" style="display: grid; grid-template-columns: 1fr; gap: var(--space-3); margin-bottom: var(--space-6);">
            ${vehicles.map(v => {
              let iconEmoji = '🚗';
              if (String(v.type) === 'ev') iconEmoji = '⚡';
              else if (String(v.type) === 'bicycle' || String(v.type) === 'ebike') iconEmoji = '🚲';
              
              return `
                <button type="button" class="btn btn-secondary btn-block wizard-platform-btn" data-vehicle-id="${esc(v.id)}" style="display: flex; align-items: center; justify-content: flex-start; gap: var(--space-3); text-align: left; padding: var(--space-4);">
                  <span style="font-size: 20px;">${iconEmoji}</span>
                  <div style="flex: 1;">
                    <span style="font-weight: 700; display: block; color: var(--color-text-primary);">${esc(v.name || 'Unnamed Vehicle')}</span>
                    <span style="font-size: 11px; color: var(--color-text-secondary); text-transform: uppercase; font-weight: 700;">${esc(v.make || '')} ${esc(v.model || '')} (${esc(v.type || 'gas')})</span>
                  </div>
                  ${getIcon('chevron-right', 16)}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `,
      snapPoints: [0.6, 0.9],
    });

    vehicleDrawer.body.querySelectorAll('[data-vehicle-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const vehicleId = btn.getAttribute('data-vehicle-id');
        vehicleDrawer.close();
        openPlatformStep(vehicleId);
      });
    });
  } else {
    // Single or no active vehicle, skip to Platform step
    const singleVehicleId = vehicles[0] ? String(vehicles[0].id) : null;
    openPlatformStep(singleVehicleId);
  }
}

/**
 * Step 1b: Select platform
 * @param {string|null} vehicleId
 */
function openPlatformStep(vehicleId) {
  const platforms = store.get('platforms') || [];
  const drawer = showDrawer({
    title: 'Select Active Platform',
    content: `
      <div class="shift-wizard-wrap">
        <p class="shift-wizard-lead">Choose a platform to start tracking your active shift:</p>
        <div class="wizard-platform-grid" style="display: grid; grid-template-columns: 1fr; gap: var(--space-3); margin-bottom: var(--space-6);">
          ${platforms.map(p => `
            <button type="button" class="btn btn-secondary btn-block wizard-platform-btn" data-platform-id="${esc(p.id)}" style="display: flex; align-items: center; justify-content: flex-start; gap: var(--space-3); text-align: left; padding: var(--space-4);">
              <span class="platform-color-indicator" style="width: 12px; height: 12px; border-radius: 50%; background: ${esc(p.color || '#10b981')};"></span>
              <span style="font-weight: 600; flex: 1;">${esc(p.name)}</span>
              ${getIcon('chevron-right', 16)}
            </button>
          `).join('')}
        </div>
      </div>
    `,
    snapPoints: [0.6, 0.9],
  });

  drawer.body.querySelectorAll('[data-platform-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const platformId = btn.getAttribute('data-platform-id');
      drawer.close();
      openTargetTimeStep(platformId, vehicleId);
    });
  });
}

/**
 * Step 2: Ask about target working time & notification permission
 * @param {string} platformId 
 * @param {string|null} vehicleId
 */
function openTargetTimeStep(platformId, vehicleId) {
  const platform = (store.get('platforms') || []).find(p => p.id === platformId);
  const platformName = platform ? platform.name : platformId;

  const drawer = showDrawer({
    title: `Shift target for ${platformName}`,
    content: `
      <div class="shift-wizard-wrap" style="padding: var(--space-2) 0;">
        <p class="shift-wizard-lead" style="margin-bottom: var(--space-4);">Do you want to work until a fixed time?</p>
        
        <div class="wizard-choices-row" style="display: flex; justify-content: center; gap: var(--space-3); margin-bottom: var(--space-5);">
          <button type="button" class="btn btn-primary" id="wizard-btn-notarget" style="padding: var(--space-4) var(--space-6); min-width: 140px;">
            No, just track
          </button>
          <button type="button" class="btn btn-secondary" id="wizard-btn-yestarget" style="padding: var(--space-4) var(--space-6); min-width: 140px;">
            Yes, set time
          </button>
        </div>

        <div id="target-customization-section" style="display: none; animation: fadeIn 0.3s ease-out;">
          <label class="form-label" style="margin-bottom: var(--space-2); display: block;">Select Target Duration:</label>
          <div class="preset-duration-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); margin-bottom: var(--space-4);">
            <button type="button" class="btn btn-secondary btn-xs preset-dur-btn" data-hours="1">1h</button>
            <button type="button" class="btn btn-secondary btn-xs preset-dur-btn" data-hours="2">2h</button>
            <button type="button" class="btn btn-secondary btn-xs preset-dur-btn" data-hours="4">4h</button>
            <button type="button" class="btn btn-secondary btn-xs preset-dur-btn" data-hours="8">8h</button>
          </div>

          <div style="margin-bottom: var(--space-5);">
            <label class="form-label" style="margin-bottom: var(--space-2); display: block;">Or Custom End Time:</label>
            <input type="time" class="form-input" id="wizard-custom-time" style="width: 100%;">
          </div>

          <div class="notification-request-card" style="background: rgba(var(--color-primary-rgb), 0.08); border: 1px solid rgba(var(--color-primary-rgb), 0.15); border-radius: var(--border-radius-md); padding: var(--space-4); margin-bottom: var(--space-5);">
            <label style="display: flex; align-items: flex-start; gap: var(--space-3); cursor: pointer; margin: 0;">
              <input type="checkbox" id="wizard-enable-notifications" checked style="margin-top: 3px;">
              <div>
                <span style="font-weight: 600; display: block; color: var(--color-primary);">Allow Device Notifications</span>
                <span class="text-secondary" style="font-size: 12px; display: block; margin-top: 2px;">Receive a push notification prompt when your target time is reached.</span>
              </div>
            </label>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: var(--space-3); border-top: 1px solid var(--color-border); padding-top: var(--space-4);">
          <button type="button" class="btn btn-ghost" id="wizard-btn-cancel">Cancel</button>
          <button type="button" class="btn btn-primary" id="wizard-btn-start" style="min-width: 130px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;"><path d="M21.4086 9.35258C23.5305 10.5065 23.5305 13.4935 21.4086 14.6474L8.59662 21.6145C6.53435 22.736 4 21.2763 4 18.9671L4 5.0329C4 2.72368 6.53435 1.26402 8.59661 2.38548L21.4086 9.35258Z" fill="currentColor"></path></svg>
            <span>Start Shift</span>
          </button>
        </div>
      </div>
    `,
    snapPoints: [0.65, 0.95],
  });

  const section = drawer.body.querySelector('#target-customization-section');
  const btnNo = drawer.body.querySelector('#wizard-btn-notarget');
  const btnYes = drawer.body.querySelector('#wizard-btn-yestarget');
  const btnCancel = drawer.body.querySelector('#wizard-btn-cancel');
  const btnStart = drawer.body.querySelector('#wizard-btn-start');
  const customTimeInput = drawer.body.querySelector('#wizard-custom-time');
  const notifyCheck = drawer.body.querySelector('#wizard-enable-notifications');

  let targetMode = false;
  let targetTimeIso = null;

  // Preset quick times
  const presets = drawer.body.querySelectorAll('.preset-dur-btn');
  presets.forEach(p => {
    p.addEventListener('click', () => {
      presets.forEach(x => x.classList.remove('btn-primary'));
      presets.forEach(x => x.classList.add('btn-secondary'));
      p.classList.remove('btn-secondary');
      p.classList.add('btn-primary');

      const hrs = Number(p.getAttribute('data-hours'));
      const d = new Date();
      d.setHours(d.getHours() + hrs);
      customTimeInput.value = d.toTimeString().slice(0, 5);
      
      // Update target ISO
      targetTimeIso = d.toISOString();
    });
  });

  customTimeInput.addEventListener('change', () => {
    presets.forEach(x => x.classList.remove('btn-primary'));
    presets.forEach(x => x.classList.add('btn-secondary'));
    
    const [h, m] = customTimeInput.value.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() < Date.now()) {
      // Custom time tomorrow
      d.setDate(d.getDate() + 1);
    }
    targetTimeIso = d.toISOString();
  });

  btnNo.addEventListener('click', () => {
    targetMode = false;
    btnNo.className = 'btn btn-primary';
    btnYes.className = 'btn btn-secondary';
    section.style.display = 'none';
  });

  btnYes.addEventListener('click', () => {
    targetMode = true;
    btnYes.className = 'btn btn-primary';
    btnNo.className = 'btn btn-secondary';
    section.style.display = 'block';

    // Set 2 hours default
    const p2 = drawer.body.querySelector('.preset-dur-btn[data-hours="2"]');
    if (p2) p2.click();
  });

  btnCancel.addEventListener('click', () => drawer.close());

  btnStart.addEventListener('click', async () => {
    // Notifications preferred but not required — prompt if not yet asked, warn if denied
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      if (Notification.permission === 'denied') {
        showToast({
          type: 'warning',
          message: '🔔 Notifications are blocked — live shift alerts won\'t work. Enable them in site settings for the best experience.',
          duration: 6000,
        });
        // Fall through — shift still starts
      } else {
        // 'default' — ask once
        try { await Notification.requestPermission(); } catch {}
      }
    }

    let finalTargetIso = null;
    if (targetMode) {
      if (!targetTimeIso) {
        showToast({ type: 'warning', message: 'Please select or enter a target end time!', duration: 2500 });
        return;
      }
      finalTargetIso = targetTimeIso;
    }

    try {
      await startShiftTimer(platformId, finalTargetIso, vehicleId);
      showToast({ type: 'success', message: 'Shift started! Timer is running.', duration: 2000 });
      drawer.close();

      // Launch full-screen Big Clock overlay immediately!
      setTimeout(() => openBigClockOverlay(), 100);
    } catch (err) {
      console.warn('[bigclock] failed to start timer', err);
      showToast({ type: 'error', message: 'Failed to start shift!', duration: 2500 });
    }
  });
}

/**
 * Opens the high-fidelity fullscreen Big Clock View overlay
 */
export function openBigClockOverlay() {
  if (clockOverlayEl) return;

  const timer = store.get('activeShiftTimer');
  if (!timer) {
    showToast({ type: 'info', message: 'No active shift is currently running!', duration: 2000 });
    return;
  }

  const platforms = store.get('platforms') || [];
  const platform = platforms.find(p => p.id === timer.platformId);
  const platformName = platform ? platform.name : (timer.platformId || 'Active Shift');
  const platformColor = platform ? (platform.color || '#10b981') : '#10b981';

  clockOverlayEl = document.createElement('div');
  clockOverlayEl.className = 'big-clock-overlay';
  clockOverlayEl.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: color-mix(in srgb, var(--color-bg) 96%, transparent);
    backdrop-filter: blur(25px);
    -webkit-backdrop-filter: blur(25px);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--color-text-primary);
    padding: var(--space-6);
    box-sizing: border-box;
    animation: bigClockFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  clockOverlayEl.innerHTML = `
    <style>
      @keyframes bigClockFadeIn {
        from { opacity: 0; transform: scale(1.03); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes pulseGlow {
        0%, 100% { filter: drop-shadow(0 0 20px rgba(var(--color-primary-rgb, 16, 185, 129), 0.1)); }
        50% { filter: drop-shadow(0 0 40px rgba(var(--color-primary-rgb, 16, 185, 129), 0.3)); }
      }
      @keyframes pulsePauseGlow {
        0%, 100% { filter: drop-shadow(0 0 20px rgba(245, 158, 11, 0.1)); }
        50% { filter: drop-shadow(0 0 35px rgba(245, 158, 11, 0.25)); }
      }
      @keyframes rotateInfinite {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>

    <div class="big-clock-dashboard">
      <!-- Top header details -->
      <div style="margin-bottom: var(--space-4);">
        <span class="big-clock-tag">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${esc(platformColor)}; box-shadow: 0 0 10px ${esc(platformColor)}; animation: ${timer.pausedAt ? 'none' : 'pulse 1.8s infinite'};"></span>
          ${esc(platformName)} Active Shift
        </span>
      </div>

      <!-- Center circular dial -->
      <div class="circular-timer-container">
        <svg class="circular-timer-svg" width="280" height="280">
          <circle cx="140" cy="140" r="124" stroke="var(--color-border)" stroke-width="6" fill="transparent"></circle>
          <circle id="bigclock-progress-ring" cx="140" cy="140" r="124" stroke="${esc(platformColor)}" stroke-width="6" fill="transparent" stroke-linecap="round" stroke-dasharray="779" stroke-dashoffset="0" style="transition: stroke-dashoffset 0.35s ease, stroke 0.35s ease;"></circle>
        </svg>
        
        <!-- Inner text clock -->
        <div style="display: flex; flex-direction: column; align-items: center; z-index: 2;">
          <span class="text-secondary" style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--color-text-muted);" id="bigclock-state-label">Active Time</span>
          <div class="big-clock-time" id="bigclock-digital-time">00:00:00</div>
          <div id="bigclock-distance" style="font-family: var(--font-body); font-size: 16px; font-weight: 700; color: var(--color-text-secondary); margin-top: 4px; display: none;">0.00 km</div>
          
          <span class="text-secondary" style="font-size: 12px; color: var(--color-text-secondary); font-weight: 500;" id="bigclock-target-eta"></span>
        </div>
      </div>

      <!-- Target progress footer bar -->
      <div id="bigclock-target-bar-wrap" style="width: 100%; max-width: 320px; display: none; margin-bottom: var(--space-6); text-align: center;">
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: var(--space-2); color: var(--color-text-secondary);">
          <span>Shift Goal Progress</span>
          <span id="bigclock-target-pct-label">0%</span>
        </div>
        <div style="width: 100%; height: 6px; background: var(--color-surface-raised); border-radius: 10px; overflow: hidden; border: 1px solid var(--color-border);">
          <div id="bigclock-target-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, ${esc(platformColor)} 0%, var(--color-brand) 100%); transition: width 0.5s ease;"></div>
        </div>
      </div>

      <!-- Control actions grid -->
      <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-3); width: 100%; max-width: 320px; margin: var(--space-2) auto 0 auto;">
        
        <!-- Got First Order Button -->
        <button type="button" class="btn btn-big-firstorder" id="bigclock-btn-firstorder" style="width: 100%; display: none;">
          ${GOT_ORDER_ICON_SVG} <span>Got First Order</span>
        </button>

        <div style="display: flex; align-items: center; justify-content: center; gap: var(--space-3); width: 100%;">
          <!-- Pause/Resume button -->
          <button type="button" class="btn flex-1" id="bigclock-btn-pause"></button>

          <!-- Minimize button -->
          <button type="button" class="btn btn-secondary btn-big-minimize flex-1" id="bigclock-btn-minimize">
            ${MINIMIZE_ICON_SVG} <span>Minimize</span>
          </button>
        </div>

        <!-- End Shift button -->
        <button type="button" class="btn btn-danger btn-big-stop" id="bigclock-btn-end" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; height: 42px; border-radius: 8px;">
          ${getIcon('square', 14)} Stop & Save Shift
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(clockOverlayEl);

  const ring = clockOverlayEl.querySelector('#bigclock-progress-ring');
  const stateLabel = clockOverlayEl.querySelector('#bigclock-state-label');
  const digitalTime = clockOverlayEl.querySelector('#bigclock-digital-time');
  const etaText = clockOverlayEl.querySelector('#bigclock-target-eta');
  const targetBarWrap = clockOverlayEl.querySelector('#bigclock-target-bar-wrap');
  const targetPctLabel = clockOverlayEl.querySelector('#bigclock-target-pct-label');
  const targetFill = clockOverlayEl.querySelector('#bigclock-target-fill');
  const pauseBtn = clockOverlayEl.querySelector('#bigclock-btn-pause');
  const minimizeBtn = clockOverlayEl.querySelector('#bigclock-btn-minimize');
  const endBtn = clockOverlayEl.querySelector('#bigclock-btn-end');
  const firstOrderBtn = clockOverlayEl.querySelector('#bigclock-btn-firstorder');

  // Trigger animations
  const svgContainer = clockOverlayEl.querySelector('.circular-timer-container');

  const updateClockUI = () => {
    const currentTimer = store.get('activeShiftTimer');
    if (!currentTimer) {
      closeBigClockOverlay();
      return;
    }

    const isPaused = Boolean(currentTimer.pausedAt);
    
    // Calculate total elapsed ms
    let elapsed = currentTimer.elapsedMs || 0;
    if (!isPaused && currentTimer.startTime) {
      elapsed += Date.now() - new Date(currentTimer.startTime).getTime();
    }

    digitalTime.textContent = formatTimeMs(elapsed);

    // Show or hide First Order button
    if (firstOrderBtn) {
      if (GPSTracker.isFirstOrderReceived() || isPaused) {
        firstOrderBtn.style.display = 'none';
      } else {
        firstOrderBtn.style.display = 'flex';
      }
    }

    const distanceKm = GPSTracker.getAccumulatedDistance();
    const deadKm = GPSTracker.getDeadDistance();
    const distanceEl = clockOverlayEl.querySelector('#bigclock-distance');
    if (distanceEl) {
      if (distanceKm > 0.01) {
        const user = store.get('user');
        const unit = user && user.locale && typeof user.locale.distanceUnit === 'string' ? user.locale.distanceUnit : 'km';
        const dist = unit === 'mi' ? distanceKm / 1.60934 : distanceKm;
        const dead = unit === 'mi' ? deadKm / 1.60934 : deadKm;

        if (GPSTracker.isFirstOrderReceived()) {
          distanceEl.innerHTML = `
            <div style="font-size: 16px; font-weight: 700; color: var(--color-text-primary); text-shadow: 0 0 8px rgba(255,255,255,0.05);">${dist.toFixed(2)} ${unit} total</div>
            <div style="font-size: 11px; font-weight: 600; color: var(--color-text-secondary); opacity: 0.75; margin-top: 2px;">Active: ${(dist - dead).toFixed(2)} ${unit} • Dead: ${dead.toFixed(2)} ${unit}</div>
          `;
        } else {
          distanceEl.innerHTML = `
            <div style="font-size: 16px; font-weight: 700; color: #f59e0b; text-shadow: 0 0 10px rgba(245,158,11,0.1);">${dist.toFixed(2)} ${unit}</div>
            <span style="font-size: 9px; font-weight: 800; background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; margin-top: 3px; display: inline-block; border: 1px solid rgba(245,158,11,0.25);">Dead Miles 💀</span>
          `;
        }
        distanceEl.style.display = 'block';
      } else {
        distanceEl.style.display = 'none';
      }
    }

    // Apply colors and states
    if (isPaused) {
      stateLabel.textContent = 'Shift Paused';
      stateLabel.style.color = 'var(--color-warning)';
      digitalTime.style.color = 'var(--color-text-muted)';
      ring.setAttribute('stroke', 'var(--color-warning)');
      svgContainer.style.animation = 'pulsePauseGlow 4s ease-in-out infinite';
      pauseBtn.className = 'btn btn-big-resume flex-1';
      pauseBtn.innerHTML = `${PLAY_ICON_SVG} <span>Resume</span>`;
    } else if (!GPSTracker.isFirstOrderReceived()) {
      stateLabel.textContent = 'Waiting for Order';
      stateLabel.style.color = '#f59e0b';
      digitalTime.style.color = 'var(--color-text-primary)';
      ring.setAttribute('stroke', '#f59e0b');
      svgContainer.style.animation = 'pulsePauseGlow 4s ease-in-out infinite';
      pauseBtn.className = 'btn btn-big-pause flex-1';
      pauseBtn.innerHTML = `${PAUSE_ICON_SVG} <span>Pause</span>`;
    } else {
      stateLabel.textContent = 'Shift Active';
      stateLabel.style.color = esc(platformColor);
      digitalTime.style.color = 'var(--color-text-primary)';
      ring.setAttribute('stroke', esc(platformColor));
      svgContainer.style.animation = 'pulseGlow 4s ease-in-out infinite';
      pauseBtn.className = 'btn btn-big-pause flex-1';
      pauseBtn.innerHTML = `${PAUSE_ICON_SVG} <span>Pause</span>`;
    }

    // Handle Target Time
    if (currentTimer.targetTime) {
      targetBarWrap.style.display = 'block';
      
      const startTimeMs = new Date(currentTimer.initialStartTime || currentTimer.startTime).getTime();
      const targetTimeMs = new Date(currentTimer.targetTime).getTime();
      const totalGoalDuration = targetTimeMs - startTimeMs;
      
      if (totalGoalDuration > 0) {
        const pct = Math.min(100, Math.floor((elapsed / totalGoalDuration) * 100));
        targetPctLabel.textContent = `${pct}%`;
        targetFill.style.width = `${pct}%`;

        // SVG progress ring dashoffset (dasharray = 779)
        const offset = 779 - (779 * pct) / 100;
        ring.style.strokeDashoffset = String(offset);

        // Display ETA time left
        const timeLeftMs = Math.max(0, targetTimeMs - Date.now());
        const leftSecs = Math.floor(timeLeftMs / 1000);
        const leftHrs = Math.floor(leftSecs / 3600);
        const leftMins = Math.floor((leftSecs % 3600) / 60);
        
        let etaString = 'Target reached';
        if (timeLeftMs > 0) {
          etaString = leftHrs > 0 ? `${leftHrs}h ${leftMins}m left` : `${leftMins}m left`;
        }
        etaText.textContent = `Goal: working until ${new Date(currentTimer.targetTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} (${etaString})`;
      }
    } else {
      targetBarWrap.style.display = 'none';
      etaText.textContent = '';
      
      // Fallback rotation for active, or solid line
      if (isPaused) {
        ring.style.strokeDashoffset = '0';
        ring.style.animation = '';
      } else {
        // Continuous rotation dashboard indicator
        ring.style.strokeDashoffset = '195'; // 3/4 fill
        ring.style.animation = 'rotateInfinite 10s linear infinite';
        ring.style.transformOrigin = 'center';
      }
    }
  };

  // Click bindings
  if (firstOrderBtn) {
    firstOrderBtn.addEventListener('click', () => {
      GPSTracker.markFirstOrderReceived();
      showToast({ type: 'success', message: '🎉 First order received! Active miles tracking started.', duration: 3000 });
      updateClockUI();
    });
  }

  pauseBtn.addEventListener('click', async () => {
    const currentTimer = store.get('activeShiftTimer');
    if (!currentTimer) return;
    if (currentTimer.pausedAt) {
      await resumeShiftTimer();
      showToast({ type: 'success', message: 'Shift resumed!', duration: 1500 });
    } else {
      await pauseShiftTimer();
      showToast({ type: 'info', message: 'Shift paused!', duration: 1500 });
    }
    updateClockUI();
  });

  minimizeBtn.addEventListener('click', () => {
    closeBigClockOverlay();
    showToast({ type: 'info', message: 'Shift minimized. Timer running in background.', duration: 2500 });
  });

  endBtn.addEventListener('click', async () => {
    try {
      const prefill = await stopShiftTimer();
      closeBigClockOverlay();
      if (!prefill) return;

      const formApi = renderShiftForm({
        mode: 'full',
        initial: prefill,
        submitLabel: t('common.save'),
        allowWeeklyEntry: false,
      });
      const handle = showModal({
        title: t('shifts.endShift'),
        content: formApi.el,
        actions: [],
      });

      formApi.el.querySelector('form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await saveShift(formApi.getValue());
          showToast({ type: 'success', message: t('shifts.savedToast'), duration: 1800 });
          handle.close();
        } catch (err) {
          console.warn('[bigclock] save stopped timer failed', err);
          showToast({ type: 'error', message: 'Failed to save shift!', duration: 2500 });
        }
      });
    } catch (err) {
      console.warn('[bigclock] stop timer failed', err);
    }
  });

  // Start updater
  updateClockUI();
  updateInterval = setInterval(updateClockUI, 1000);
}

/**
 * Collapses and cleans up the fullscreen Big Clock overlay
 */
export function closeBigClockOverlay() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  if (clockOverlayEl) {
    clockOverlayEl.style.animation = 'bigClockFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) reverse';
    setTimeout(() => {
      if (clockOverlayEl) {
        clockOverlayEl.remove();
        clockOverlayEl = null;
      }
    }, 220);
  }
}
