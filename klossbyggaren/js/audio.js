export class AudioManager {
    constructor() {
        this.ctx = null;
        this.enabled = false;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
    }

    playBreak() {
        if (!this.enabled) return;
        const now = this.ctx.currentTime;
        const noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const source = this.ctx.createBufferSource(); source.buffer = noise;
        const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now); filter.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        const gain = this.ctx.createGain(); gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        source.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
        source.start();
    }

    playPlace() {
        if (!this.enabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.05);
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.connect(gain); gain.connect(this.ctx.destination); osc.start(); osc.stop(now + 0.05);
    }

    playStep() {
        if (!this.enabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(80, now);
        gain.gain.setValueAtTime(0.03, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain); gain.connect(this.ctx.destination); osc.start(); osc.stop(now + 0.05);
    }

    playJump() {
        if (!this.enabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(gain); gain.connect(this.ctx.destination); osc.start(); osc.stop(now + 0.1);
    }

    playSplash() {
        if (!this.enabled) return;
        const now = this.ctx.currentTime;
        const noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
        const data = noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const source = this.ctx.createBufferSource(); source.buffer = noise;
        const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1500, now); filter.frequency.exponentialRampToValueAtTime(300, now + 0.15);
        const gain = this.ctx.createGain(); gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        source.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
        source.start();
    }

    playAnimal() {
        // Helt tyst per användarens önskemål
    }
}
