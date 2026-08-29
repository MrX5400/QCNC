import { GrblSetting, GrblState, Point3D } from '../types/cnc';
import { DEFAULT_GRBL_SETTINGS } from './grblSettingsData';

export type LogListener = (msg: { type: 'send' | 'recv' | 'info' | 'error'; text: string; time: string }) => void;
export type StateListener = (state: GrblState) => void;
export type StreamProgressListener = (progress: { currentLine: number; totalLines: number; percent: number; isStreaming: boolean; isPaused: boolean }) => void;

class GrblService {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;
  private isSimulated: boolean = false;
  private isConnected: boolean = false;

  private statusPollInterval: any = null;
  private simulationInterval: any = null;

  private logListeners: Set<LogListener> = new Set();
  private stateListeners: Set<StateListener> = new Set();
  private streamListeners: Set<StreamProgressListener> = new Set();
  private settingsListeners: Set<(settings: GrblSetting[]) => void> = new Set();

  private currentState: GrblState = {
    status: 'Disconnected',
    mpos: { x: 0, y: 0, z: 0 },
    wpos: { x: 0, y: 0, z: 0 },
    wco: { x: 0, y: 0, z: 0 },
    feedrate: 0,
    spindleSpeed: 0,
    bufferPlanner: 15,
    bufferRx: 128,
    lineExecuting: 0,
    overrides: { feed: 100, rapid: 100, spindle: 100 },
    pins: '',
  };

  private currentSettings: Map<string, string> = new Map();

  // Streaming Queue
  private streamQueue: string[] = [];
  private currentStreamIndex: number = 0;
  private isStreaming: boolean = false;
  private isPaused: boolean = false;
  private isAwaitingOk: boolean = false;
  private currentStreamLine: number = 0;

  // Simulator state
  private isSimulated: boolean = false;
  private simulationInterval: any = null;
  private simRafId: number | null = null;
  private lastSimTime: number = 0;
  private simTargetPos: Point3D = { x: 0, y: 0, z: 0 };
  private simFeedrate: number = 1000;

  constructor() {
    // Populate default settings map
    DEFAULT_GRBL_SETTINGS.forEach(s => this.currentSettings.set(s.id, s.value));
  }

  // --- Listener Registration ---
  public onLog(fn: LogListener) {
    this.logListeners.add(fn);
    return () => this.logListeners.delete(fn);
  }

  public onState(fn: StateListener) {
    this.stateListeners.add(fn);
    fn(this.currentState);
    return () => this.stateListeners.delete(fn);
  }

  public onStreamProgress(fn: StreamProgressListener) {
    this.streamListeners.add(fn);
    return () => this.streamListeners.delete(fn);
  }

  public onSettings(fn: (settings: GrblSetting[]) => void) {
    this.settingsListeners.add(fn);
    return () => this.settingsListeners.delete(fn);
  }

  private notifyLog(type: 'send' | 'recv' | 'info' | 'error', text: string) {
    const time = new Date().toLocaleTimeString();
    this.logListeners.forEach(l => l({ type, text, time }));
  }

  private notifyState() {
    this.stateListeners.forEach(l => l({ ...this.currentState }));
  }

  private notifyProgress() {
    const total = this.streamQueue.length;
    const current = this.currentStreamIndex;
    const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    this.streamListeners.forEach(l => l({
      currentLine: current,
      totalLines: total,
      percent,
      isStreaming: this.isStreaming,
      isPaused: this.isPaused,
    }));
  }

  // --- Connection Management ---

  public isSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public async connectSerial(baudRate: number = 115200): Promise<boolean> {
    if (!this.isSerialSupported()) {
      this.notifyLog('error', 'Web Serial API wird von diesem Browser nicht unterstützt. Verwende den Simulations-Modus.');
      return false;
    }

    try {
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate });
      this.isConnected = true;
      this.isSimulated = false;

      this.notifyLog('info', `Verbunden mit seriellem Port @ ${baudRate} Baud`);
      this.currentState.status = 'Idle';
      this.notifyState();

      this.startReading();
      this.startPolling();
      return true;
    } catch (err: any) {
      this.notifyLog('error', `Verbindungsfehler: ${err.message || err}`);
      return false;
    }
  }

  public connectSimulation() {
    this.disconnect();
    this.isSimulated = true;
    this.isConnected = true;
    this.currentState.status = 'Idle';
    this.notifyState();

    this.notifyLog('info', '--- GRBL 1.1h Software-Simulator gestartet (Offline-Modus) ---');
    this.notifyLog('recv', "Grbl 1.1h ['$' for help]");

    // Start simulation loop for motion & status reports
    this.lastSimTime = performance.now();
    const simLoop = (now: number) => {
      const dt = (now - this.lastSimTime) / 1000.0;
      this.lastSimTime = now;
      this.tickSimulation(dt);
      this.simRafId = requestAnimationFrame(simLoop);
    };
    this.simRafId = requestAnimationFrame(simLoop);

    return true;
  }

  public async disconnect() {
    if (this.statusPollInterval) clearInterval(this.statusPollInterval);
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    if (this.simRafId) cancelAnimationFrame(this.simRafId);
    this.statusPollInterval = null;
    this.simulationInterval = null;
    this.simRafId = null;

    if (this.reader) {
      try { await this.reader.cancel(); } catch {}
      this.reader = null;
    }
    if (this.writer) {
      try { await this.writer.close(); } catch {}
      this.writer = null;
    }
    if (this.port) {
      try { await this.port.close(); } catch {}
      this.port = null;
    }

    this.isConnected = false;
    this.isSimulated = false;
    this.isStreaming = false;
    this.isPaused = false;
    this.currentState.status = 'Disconnected';
    this.notifyState();
    this.notifyLog('info', 'Verbindung getrennt.');
  }

  public getCurrentState(): GrblState {
    return {
      ...this.currentState,
      mpos: { ...this.currentState.mpos },
      wpos: { ...this.currentState.wpos },
      wco: { ...this.currentState.wco },
      overrides: { ...this.currentState.overrides },
    };
  }

  public getConnectionInfo() {
    return {
      connected: this.isConnected,
      simulated: this.isSimulated,
      status: this.currentState.status,
    };
  }

  // --- Read Loop (Hardware Serial) ---
  private async startReading() {
    if (!this.port) return;
    const textDecoder = new TextDecoderStream();
    this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    let buffer = '';
    try {
      while (this.isConnected && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) this.handleIncomingLine(trimmed);
          }
        }
      }
    } catch (err: any) {
      this.notifyLog('error', `Serieller Lese-Fehler: ${err.message}`);
    }
  }

  // --- Real-time GRBL Status Polling ---
  private startPolling() {
    this.statusPollInterval = setInterval(() => {
      if (this.isConnected && !this.isSimulated) {
        this.sendRaw('?');
      }
    }, 200);
  }

  // --- Send Commands ---
  public async send(command: string): Promise<void> {
    const trimmed = command.trim();
    if (!trimmed) return;

    this.notifyLog('send', trimmed);

    // Immediate Real-Time Commands in GRBL
    if (trimmed === '?' || trimmed === '!' || trimmed === '~' || trimmed === '\x18') {
      await this.sendRaw(trimmed);
      return;
    }

    if (this.isSimulated) {
      this.handleSimulatedCommand(trimmed);
      return;
    }

    await this.sendRaw(trimmed + '\n');
  }

  public async sendRaw(data: string) {
    if (this.isSimulated) {
      if (data === '?') {
        // Return simulated status response
        this.emitSimulatedStatus();
      } else if (data === '!') {
        this.currentState.status = 'Hold';
        this.notifyState();
        this.notifyLog('recv', '<Hold:0|MPos:...>');
      } else if (data === '~') {
        this.currentState.status = this.isStreaming ? 'Run' : 'Idle';
        this.notifyState();
      } else if (data === '\x18') {
        this.currentState.status = 'Alarm';
        this.notifyState();
        this.notifyLog('recv', "Grbl 1.1h ['$' for help]\n[MSG:'$H'|'$X' to unlock]");
      }
      return;
    }

    if (!this.port || !this.port.writable) return;
    try {
      const textEncoder = new TextEncoder();
      const writer = this.port.writable.getWriter();
      await writer.write(textEncoder.encode(data));
      writer.releaseLock();
    } catch (err: any) {
      this.notifyLog('error', `Schreibfehler: ${err.message}`);
    }
  }

  // --- Parse Incoming GRBL Line ---
  private handleIncomingLine(line: string) {
    this.notifyLog('recv', line);

    // Status Report: <Idle|MPos:0.000,0.000,0.000|FS:0,0|WCO:0.000,0.000,0.000>
    if (line.startsWith('<') && line.endsWith('>')) {
      this.parseStatusReport(line);
      return;
    }

    // Setting response: $100=80.000
    if (line.startsWith('$')) {
      const match = line.match(/^\$(\d+)\s*=\s*(.+)$/);
      if (match) {
        const id = `$${match[1]}`;
        const val = match[2].trim();
        this.currentSettings.set(id, val);
        this.broadcastSettings();
      }
    }

    // Stream Ok Handshake
    if (line.toLowerCase().startsWith('ok')) {
      if (this.isStreaming && !this.isPaused) {
        this.isAwaitingOk = false;
        if (this.currentStreamIndex >= this.streamQueue.length) {
          this.isStreaming = false;
          this.isPaused = false;
          this.currentState.status = 'Idle';
          this.notifyState();
          this.notifyProgress();
          this.notifyLog('info', '✓ Job erfolgreich abgeschlossen!');
        } else {
          this.streamNextLine();
        }
      }
    } else if (line.startsWith('error:')) {
      this.notifyLog('error', `GRBL Fehler: ${line}`);
      if (this.isStreaming) {
        this.isAwaitingOk = false;
        if (this.currentStreamIndex >= this.streamQueue.length) {
          this.isStreaming = false;
          this.isPaused = false;
          this.currentState.status = 'Idle';
          this.notifyState();
          this.notifyProgress();
        } else {
          this.streamNextLine();
        }
      }
    } else if (line.startsWith('ALARM:')) {
      this.currentState.status = 'Alarm';
      this.notifyState();
      this.pauseStream();
    }
  }

  private parseStatusReport(report: string) {
    const content = report.slice(1, -1);
    const parts = content.split('|');
    const statusPart = parts[0];

    // Status State
    const validStates: GrblState['status'][] = ['Idle', 'Run', 'Hold', 'Jog', 'Alarm', 'Door', 'Check', 'Home', 'Sleep'];
    for (const st of validStates) {
      if (statusPart.startsWith(st)) {
        this.currentState.status = st;
        break;
      }
    }

    for (let i = 1; i < parts.length; i++) {
      const p = parts[i];
      if (p.startsWith('MPos:')) {
        const coords = p.slice(5).split(',').map(Number);
        this.currentState.mpos = { x: coords[0] || 0, y: coords[1] || 0, z: coords[2] || 0 };
        // Recalculate WPos = MPos - WCO
        this.currentState.wpos = {
          x: this.currentState.mpos.x - this.currentState.wco.x,
          y: this.currentState.mpos.y - this.currentState.wco.y,
          z: this.currentState.mpos.z - this.currentState.wco.z,
        };
      } else if (p.startsWith('WPos:')) {
        const coords = p.slice(5).split(',').map(Number);
        this.currentState.wpos = { x: coords[0] || 0, y: coords[1] || 0, z: coords[2] || 0 };
        this.currentState.mpos = {
          x: this.currentState.wpos.x + this.currentState.wco.x,
          y: this.currentState.wpos.y + this.currentState.wco.y,
          z: this.currentState.wpos.z + this.currentState.wco.z,
        };
      } else if (p.startsWith('WCO:')) {
        const coords = p.slice(4).split(',').map(Number);
        this.currentState.wco = { x: coords[0] || 0, y: coords[1] || 0, z: coords[2] || 0 };
      } else if (p.startsWith('FS:')) {
        const fs = p.slice(3).split(',').map(Number);
        this.currentState.feedrate = fs[0] || 0;
        this.currentState.spindleSpeed = fs[1] || 0;
      } else if (p.startsWith('Bf:')) {
        const bf = p.slice(3).split(',').map(Number);
        this.currentState.bufferPlanner = bf[0] || 15;
        this.currentState.bufferRx = bf[1] || 128;
      } else if (p.startsWith('Ov:')) {
        const ov = p.slice(3).split(',').map(Number);
        this.currentState.overrides = {
          feed: ov[0] || 100,
          rapid: ov[1] || 100,
          spindle: ov[2] || 100,
        };
      } else if (p.startsWith('Pn:')) {
        this.currentState.pins = p.slice(3);
      }
    }

    this.notifyState();
  }

  // --- GRBL Settings ---
  public async requestAllSettings() {
    if (this.isSimulated) {
      DEFAULT_GRBL_SETTINGS.forEach(s => {
        const val = this.currentSettings.get(s.id) || s.value;
        this.notifyLog('recv', `${s.id}=${val}`);
      });
      this.notifyLog('recv', 'ok');
      this.broadcastSettings();
      return;
    }
    await this.send('$$');
  }

  public async updateSetting(id: string, value: string) {
    this.currentSettings.set(id, value);
    await this.send(`${id}=${value}`);
    this.broadcastSettings();
  }

  private broadcastSettings() {
    const list: GrblSetting[] = DEFAULT_GRBL_SETTINGS.map(item => ({
      ...item,
      value: this.currentSettings.get(item.id) || item.value,
    }));
    this.settingsListeners.forEach(l => l(list));
  }

  // --- G-Code Streaming Engine ---
  public startStream(gcodeLines: string[]) {
    if (gcodeLines.length === 0) return;
    this.streamQueue = gcodeLines.filter(l => l.trim() && !l.trim().startsWith(';'));
    this.currentStreamIndex = 0;
    this.isStreaming = true;
    this.isPaused = false;
    this.isAwaitingOk = false;
    this.currentState.status = 'Run';
    this.notifyState();
    this.notifyLog('info', `Job gestartet: ${this.streamQueue.length} Befehlszeilen werden gesendet.`);
    this.notifyProgress();

    this.streamNextLine();
  }

  public pauseStream() {
    if (!this.isStreaming) return;
    this.isPaused = true;
    this.currentState.status = 'Hold';
    this.sendRaw('!');
    this.notifyState();
    this.notifyProgress();
    this.notifyLog('info', 'Job pausiert (Feed Hold).');
  }

  public resumeStream() {
    if (!this.isStreaming || !this.isPaused) return;
    this.isPaused = false;
    this.isAwaitingOk = false;
    this.currentState.status = 'Run';
    this.sendRaw('~');
    this.notifyState();
    this.notifyProgress();
    this.notifyLog('info', 'Job fortgesetzt (Cycle Start).');
    this.streamNextLine();
  }

  public stopStream() {
    this.isStreaming = false;
    this.isPaused = false;
    this.streamQueue = [];
    this.currentStreamIndex = 0;
    this.currentState.status = 'Idle';
    this.sendRaw('\x18'); // Soft reset
    this.notifyState();
    this.notifyProgress();
    this.notifyLog('info', 'Job gestoppt und Reset gesendet.');
  }

  private streamNextLine() {
    if (!this.isStreaming || this.isPaused || this.isAwaitingOk) return;

    if (this.currentStreamIndex >= this.streamQueue.length) {
      this.isStreaming = false;
      this.isPaused = false;
      this.isAwaitingOk = false;
      this.currentState.status = 'Idle';
      this.notifyState();
      this.notifyProgress();
      this.notifyLog('info', '✓ Job erfolgreich abgeschlossen!');
      return;
    }

    const line = this.streamQueue[this.currentStreamIndex];
    this.currentStreamIndex++;
    this.currentState.lineExecuting = this.currentStreamIndex;
    this.isAwaitingOk = true;
    this.notifyProgress();

    this.send(line);
  }

  // --- Real-time Jogging ---
  public async jog(axis: 'X' | 'Y' | 'Z', distance: number, feedrate: number = 1000) {
    if (this.currentState.status === 'Alarm') {
      this.notifyLog('error', 'Maschine befindet sich im Alarm-Zustand. Führe $X (Unlock) oder $H (Homing) aus.');
      return;
    }
    const cmd = `$J=G91 G21 ${axis}${distance > 0 ? '+' : ''}${distance.toFixed(3)} F${feedrate}`;
    await this.send(cmd);
  }

  public async startContinuousJog(axis: 'X' | 'Y' | 'Z', direction: number, feedrate: number = 2000) {
    if (this.currentState.status === 'Alarm') {
      this.notifyLog('error', 'Maschine im Alarm-Zustand!');
      return;
    }
    // Large travel distance for smooth continuous motion until released
    const largeDistance = direction > 0 ? 1000 : -1000;
    const cmd = `$J=G91 G21 ${axis}${largeDistance > 0 ? '+' : ''}${largeDistance.toFixed(1)} F${feedrate}`;
    await this.send(cmd);
  }

  public async startContinuousDiagonalJog(dirX: number, dirY: number, feedrate: number = 2000) {
    if (this.currentState.status === 'Alarm') return;
    const distX = dirX > 0 ? 1000 : -1000;
    const distY = dirY > 0 ? 1000 : -1000;
    const cmd = `$J=G91 G21 X${distX > 0 ? '+' : ''}${distX.toFixed(1)} Y${distY > 0 ? '+' : ''}${distY.toFixed(1)} F${feedrate}`;
    await this.send(cmd);
  }

  public async stopContinuousJog() {
    // GRBL Jog Cancel realtime command: 0x85
    await this.sendRaw('\x85');
    if (this.isSimulated) {
      // In simulation mode, immediately halt movement target to current position
      this.simTargetPos = { ...this.currentState.wpos };
    }
  }

  public async setWorkZero(axis?: 'X' | 'Y' | 'Z') {
    if (!axis) {
      await this.send('G10 L20 P1 X0 Y0 Z0');
    } else {
      await this.send(`G10 L20 P1 ${axis}0`);
    }
  }

  public async returnToZero(safeLiftZ: number = 3) {
    if (this.currentState.status === 'Alarm') {
      this.notifyLog('error', 'Maschine im Alarm-Zustand! Bitte zuerst entsperren ($X) oder Homing ($H) durchführen.');
      return;
    }
    // 1. Tool-Sicherheit: Laser aus / Stift heben vor Eilgang
    await this.send('M5');
    if (safeLiftZ > 0) {
      await this.send(`G90 G0 Z${safeLiftZ.toFixed(2)} F1500`);
    }
    // 2. Zu Werkstück-Nullpunkt (0,0) fahren
    await this.send('G90 G0 X0.000 Y0.000 F2500');
    this.notifyLog('info', 'Fahre zu Werkstück-Nullpunkt (X0 Y0)...');
  }

  public async home() {
    await this.send('$H');
  }

  public async unlock() {
    await this.send('$X');
  }

  public async softReset() {
    await this.sendRaw('\x18');
  }

  // --- Software Simulator Logic ---
  private handleSimulatedCommand(cmd: string) {
    const upper = cmd.toUpperCase().trim();

    if (upper === '$$') {
      this.requestAllSettings();
      return;
    }
    if (upper === '$H') {
      this.notifyLog('info', 'Simuliere Referenzfahrt ($H)...');
      setTimeout(() => {
        this.currentState.mpos = { x: 0, y: 0, z: 0 };
        this.currentState.wpos = { x: 0, y: 0, z: 0 };
        this.currentState.status = 'Idle';
        this.notifyState();
        this.notifyLog('recv', 'ok');
      }, 500);
      return;
    }
    if (upper === '$X') {
      this.currentState.status = 'Idle';
      this.notifyState();
      this.notifyLog('recv', '[MSG:Caution: Unlocked]');
      this.notifyLog('recv', 'ok');
      return;
    }

    if (upper.startsWith('G10 L20')) {
      if (upper.includes('X0')) this.currentState.wco.x = this.currentState.mpos.x;
      if (upper.includes('Y0')) this.currentState.wco.y = this.currentState.mpos.y;
      if (upper.includes('Z0')) this.currentState.wco.z = this.currentState.mpos.z;
      this.currentState.wpos = {
        x: this.currentState.mpos.x - this.currentState.wco.x,
        y: this.currentState.mpos.y - this.currentState.wco.y,
        z: this.currentState.mpos.z - this.currentState.wco.z,
      };
      this.notifyState();
      this.notifyLog('recv', 'ok');
      return;
    }

    if (
      upper.startsWith('$J=') ||
      upper.startsWith('G0') ||
      upper.startsWith('G00') ||
      upper.startsWith('G1') ||
      upper.startsWith('G01') ||
      upper.startsWith('G90') ||
      upper.startsWith('G91') ||
      upper.includes('X') ||
      upper.includes('Y') ||
      upper.includes('Z')
    ) {
      // Parse coordinates
      const xMatch = cmd.match(/X([+-]?[\d.]+)/i);
      const yMatch = cmd.match(/Y([+-]?[\d.]+)/i);
      const zMatch = cmd.match(/Z([+-]?[\d.]+)/i);
      const fMatch = cmd.match(/F([\d.]+)/i);

      if (fMatch) this.simFeedrate = parseFloat(fMatch[1]);

      const isRelative = upper.includes('G91');
      if (xMatch) {
        const val = parseFloat(xMatch[1]);
        this.simTargetPos.x = isRelative ? this.currentState.wpos.x + val : val;
      }
      if (yMatch) {
        const val = parseFloat(yMatch[1]);
        this.simTargetPos.y = isRelative ? this.currentState.wpos.y + val : val;
      }
      if (zMatch) {
        const val = parseFloat(zMatch[1]);
        this.simTargetPos.z = isRelative ? this.currentState.wpos.z + val : val;
      }

      // In simulation mode, respond with 'ok' and stream next
      setTimeout(() => {
        this.notifyLog('recv', 'ok');
        if (this.isStreaming && !this.isPaused) {
          this.isAwaitingOk = false;
          this.streamNextLine();
        }
      }, 15);
      return;
    }

    // Parse spindle/laser commands
    const sMatch = cmd.match(/S([\d.]+)/i);
    if (sMatch) this.currentState.spindleSpeed = parseFloat(sMatch[1]);
    
    if (upper.includes('M3') || upper.includes('M4')) {
       // Spindle on
       if (sMatch) this.currentState.spindleSpeed = parseFloat(sMatch[1]);
       else if (this.currentState.spindleSpeed === 0) this.currentState.spindleSpeed = 1000;
    }
    if (upper.includes('M5')) {
       this.currentState.spindleSpeed = 0;
    }
    
    if (sMatch || upper.includes('M3') || upper.includes('M4') || upper.includes('M5')) {
       this.notifyState();
    }

    // Default immediate OK
    setTimeout(() => {
      this.notifyLog('recv', 'ok');
      if (this.isStreaming && !this.isPaused) {
        this.isAwaitingOk = false;
        this.streamNextLine();
      }
    }, 10);
  }

  private tickSimulation(dt: number = 0.016) {
    if (!this.isSimulated || !this.isConnected) return;

    // Smoothly step position towards simTargetPos
    const dx = this.simTargetPos.x - this.currentState.wpos.x;
    const dy = this.simTargetPos.y - this.currentState.wpos.y;
    const dz = this.simTargetPos.z - this.currentState.wpos.z;
    const dist = Math.hypot(dx, dy, dz);

    if (dist > 0.005) {
      // Feedrate is in mm/min, so mm/sec is feedrate / 60
      const speedMmPerSec = this.simFeedrate / 60.0;
      // Step distance is speed * dt
      const step = Math.min(dist, speedMmPerSec * dt);
      
      this.currentState.wpos.x += (dx / dist) * step;
      this.currentState.wpos.y += (dy / dist) * step;
      this.currentState.wpos.z += (dz / dist) * step;
      this.currentState.mpos = {
        x: this.currentState.wpos.x + this.currentState.wco.x,
        y: this.currentState.wpos.y + this.currentState.wco.y,
        z: this.currentState.wpos.z + this.currentState.wco.z,
      };
      this.currentState.feedrate = this.simFeedrate;
      this.currentState.status = 'Run';
      this.notifyState();
    } else if (dist <= 0.005 && dist > 0) {
      this.currentState.wpos.x = this.simTargetPos.x;
      this.currentState.wpos.y = this.simTargetPos.y;
      this.currentState.wpos.z = this.simTargetPos.z;
      this.currentState.mpos = {
        x: this.currentState.wpos.x + this.currentState.wco.x,
        y: this.currentState.wpos.y + this.currentState.wco.y,
        z: this.currentState.wpos.z + this.currentState.wco.z,
      };
      this.currentState.feedrate = 0;
      this.currentState.status = 'Idle';
      this.notifyState();
    }
  }

  private emitSimulatedStatus() {
    const { wpos, feedrate, spindleSpeed, overrides } = this.currentState;
    const statusStr = `<${this.currentState.status}|WPos:${wpos.x.toFixed(3)},${wpos.y.toFixed(3)},${wpos.z.toFixed(3)}|FS:${feedrate},${spindleSpeed}|Ov:${overrides.feed},${overrides.rapid},${overrides.spindle}>`;
    this.parseStatusReport(statusStr);
  }
}

export const grbl = new GrblService();
