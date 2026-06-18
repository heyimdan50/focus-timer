const defaults = {
    focus: 25,
    short: 5,
    long: 15,
    sound: true,
};

const labels = {
    focus: 'Time to focus',
    short: 'Take a short break',
    long: 'Take a long break',
};

const RING = 628; // circumference of the progress ring

let settings = loadSettings();
let mode = 'focus';
let remaining = settings.focus * 60;
let total = remaining;
let running = false;
let ticker = null;
let completed = 0;

const els = {
    time: document.getElementById('time'),
    label: document.getElementById('label'),
    toggle: document.getElementById('toggle'),
    reset: document.getElementById('reset'),
    skip: document.getElementById('skip'),
    dots: document.getElementById('dots'),
    ring: document.querySelector('.ring-fill'),
    modes: document.querySelectorAll('.mode'),
    panel: document.getElementById('panel'),
    settingsOpen: document.getElementById('settingsOpen'),
    save: document.getElementById('saveSettings'),
    focusLen: document.getElementById('focusLen'),
    shortLen: document.getElementById('shortLen'),
    longLen: document.getElementById('longLen'),
    soundOn: document.getElementById('soundOn'),
};

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('focus-timer'));
        return saved ? { ...defaults, ...saved } : { ...defaults };
    } catch {
        return { ...defaults };
    }
}

function saveSettings() {
    localStorage.setItem('focus-timer', JSON.stringify(settings));
}

function format(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function render() {
    els.time.textContent = format(remaining);
    els.label.textContent = labels[mode];
    els.toggle.textContent = running ? 'Pause' : 'Start';
    els.ring.style.strokeDashoffset = RING - (remaining / total) * RING;
    document.title = running ? `${format(remaining)} - Focus Timer` : 'Focus Timer';

    els.modes.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));

    const filled = mode === 'long' ? 4 : completed % 4;
    els.dots.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot' + (i < filled ? ' done' : '');
        els.dots.appendChild(dot);
    }
}

function setMode(next) {
    mode = next;
    remaining = settings[mode] * 60;
    total = remaining;
    stop();
    render();
}

function start() {
    if (running) return;
    running = true;
    ticker = setInterval(tick, 1000);
    render();
}

function stop() {
    running = false;
    clearInterval(ticker);
    render();
}

function tick() {
    remaining -= 1;
    if (remaining <= 0) {
        finishSession();
        return;
    }
    render();
}

function finishSession() {
    stop();
    if (settings.sound) beep();
    notify();

    if (mode === 'focus') {
        completed += 1;
        setMode(completed % 4 === 0 ? 'long' : 'short');
    } else {
        setMode('focus');
    }
}

function beep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
    } catch {
        // audio not available, ignore
    }
}

function notify() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification(mode === 'focus' ? 'Break over' : 'Session done', {
        body: labels[mode === 'focus' ? 'short' : 'focus'],
    });
}

els.toggle.addEventListener('click', () => {
    if (running) {
        stop();
    } else {
        start();
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
});

els.reset.addEventListener('click', () => setMode(mode));
els.skip.addEventListener('click', finishSession);

els.modes.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

els.settingsOpen.addEventListener('click', () => {
    els.focusLen.value = settings.focus;
    els.shortLen.value = settings.short;
    els.longLen.value = settings.long;
    els.soundOn.checked = settings.sound;
    els.panel.hidden = !els.panel.hidden;
});

els.save.addEventListener('click', () => {
    settings.focus = clamp(+els.focusLen.value, 1, 90, 25);
    settings.short = clamp(+els.shortLen.value, 1, 30, 5);
    settings.long = clamp(+els.longLen.value, 1, 60, 15);
    settings.sound = els.soundOn.checked;
    saveSettings();
    els.panel.hidden = true;
    setMode(mode);
});

function clamp(value, min, max, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.round(value)));
}

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') {
        e.preventDefault();
        els.toggle.click();
    } else if (e.key.toLowerCase() === 'r') {
        setMode(mode);
    }
});

render();
