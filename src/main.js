import { InstanceBase, InstanceStatus, Regex, combineRgb } from '@companion-module/base'

const C = {
  white: combineRgb(255, 255, 255), black: combineRgb(0, 0, 0), blue: combineRgb(32, 92, 210),
  green: combineRgb(0, 155, 85), red: combineRgb(205, 35, 35), yellow: combineRgb(245, 190, 25), gray: combineRgb(65, 70, 80),
}

export class BorgesTimerInstance extends InstanceBase {
  async init(config) {
    this.destroyed = false
    this.generation = 0
    this.controllers = new Set()
    this.config = config
    this.state = { running: false, display: '00:00', message: '', state: 'offline', warning: 'normal', remainingSeconds: 0, durationSeconds: 0, ndi: false }
    this.initDefinitions()
    this.startPolling()
    await this.pollNow()
  }

  async destroy() { this.destroyed = true; clearTimeout(this.pollTimer); this.controllers?.forEach(c => c.abort()) }
  async configUpdated(config) { this.controllers?.forEach(c => c.abort()); this.generation = (this.generation || 0) + 1; this.config = config; this.initDefinitions(); this.startPolling(); await this.pollNow() }

  getConfigFields() {
    return [
      { type: 'textinput', id: 'host', label: 'IP do computador com o Timer Pro', width: 8, default: 'localhost', regex: Regex.HOSTNAME },
      { type: 'number', id: 'port', label: 'Porta', width: 4, default: 8099, min: 1, max: 65535 },
      { type: 'textinput', id: 'pin', label: 'PIN do Timer Pro', width: 4, default: '2468' },
      { type: 'number', id: 'poll', label: 'Atualização (ms)', width: 4, default: 250, min: 100, max: 5000 },
    ]
  }

  baseUrl() { return `http://${this.config.host || 'localhost'}:${this.config.port || 8099}` }

  async request(command, params = {}) {
    const generation = this.generation; const base = this.baseUrl()
    const qs = new URLSearchParams({ ...params, pin: this.config.pin ?? '2468' }).toString()
    const controller = new AbortController()
    this.controllers.add(controller)
    const timeout = setTimeout(() => controller.abort(), 1500)
    try {
    const response = await fetch(`${base}/${command}${qs ? `?${qs}` : ''}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    if (data.ok === false) throw new Error(data.error || 'Comando rejeitado pelo Timer')
    if (generation !== this.generation || this.destroyed) return data
    if (data.apiVersion !== 1 || typeof data.running !== 'boolean' || typeof data.display !== 'string') throw new Error('Resposta incompatível com API v1')
    this.applyState(data)
    return data
    } finally { clearTimeout(timeout); this.controllers.delete(controller) }
  }

  async pollNow() {
    if (this.polling || this.destroyed) return
    this.polling = true
    const generation = this.generation
    try { await this.request('state') }
    catch (e) { if (generation === this.generation && !this.destroyed) this.offline(e) }
    finally { this.polling = false }
  }

  offline(e) {
    this.updateStatus(InstanceStatus.ConnectionFailure, e.message)
    this.state = { ...this.state, state: 'offline', running: false, warning: 'normal', ndi: false }
    this.setVariableValues({ state: 'offline', running: '0', warning: 'normal', ndi_status: 'offline', display: '--:--' })
    this.checkAllFeedbacks()
  }

  async send(command, params = {}) {
    const generation = this.generation
    try { return await this.request(command, params) }
    catch (e) { if (this.destroyed || generation !== this.generation) return; this.offline(e); this.log('warn', `Comando ${command}: ${e.message}`) }
  }

  applyState(data) {
    this.state = { ...this.state, ...data }
    this.updateStatus(InstanceStatus.Ok)
    this.setVariableValues({
      display: this.state.display,
      message: this.state.message || '',
      state: this.state.state,
      running: this.state.running ? '1' : '0',
      remaining_seconds: Math.round(this.state.remainingSeconds || 0),
      duration_seconds: Math.round(this.state.durationSeconds || 0),
      warning: this.state.warning || 'normal',
      ndi_status: this.state.ndi ? 'online' : 'offline',
    })
    this.checkAllFeedbacks()
  }

  startPolling() {
    clearTimeout(this.pollTimer)
    const generation = this.generation
    const next = async () => {
      await this.pollNow()
      if (!this.destroyed && generation === this.generation) this.pollTimer = setTimeout(next, Math.max(100, Number(this.config.poll) || 250))
    }
    this.pollTimer = setTimeout(next, Math.max(100, Number(this.config.poll) || 250))
  }

  initDefinitions() {
    this.setVariableDefinitions(Object.fromEntries([
      { variableId: 'display', name: 'Tempo exibido' }, { variableId: 'message', name: 'Mensagem exibida' },
      { variableId: 'state', name: 'Estado' }, { variableId: 'running', name: 'Rodando (1/0)' },
      { variableId: 'remaining_seconds', name: 'Segundos restantes' }, { variableId: 'duration_seconds', name: 'Duração total em segundos' },
      { variableId: 'warning', name: 'Nível de alerta' }, { variableId: 'ndi_status', name: 'Status NDI' },
    ].map(({ variableId, name }) => [variableId, { name }])))

    this.setActionDefinitions({
      start: { name: 'Iniciar', options: [], callback: () => this.send('start') },
      pause: { name: 'Pausar', options: [], callback: () => this.send('pause') },
      toggle: { name: 'Play/Pause', options: [], callback: () => this.send('toggle') },
      stop: { name: 'Parar e voltar ao tempo configurado', options: [], callback: () => this.send('stop') },
      reset: { name: 'Reiniciar no tempo configurado', options: [], callback: () => this.send('reset') },
      add_minute: { name: 'Aumentar 1 minuto', options: [], callback: () => this.send('plus1') },
      remove_minute: { name: 'Diminuir 1 minuto', options: [], callback: () => this.send('minus1') },
      add_10s: { name: 'Aumentar 10 segundos', options: [], callback: () => this.send('plus10') },
      remove_10s: { name: 'Diminuir 10 segundos', options: [], callback: () => this.send('minus10') },
      set_time: {
        name: 'Definir tempo', options: [
          { type: 'number', id: 'minutes', label: 'Minutos', default: 5, min: 0, max: 1440 },
          { type: 'number', id: 'seconds', label: 'Segundos', default: 0, min: 0, max: 59 },
          { type: 'checkbox', id: 'start', label: 'Iniciar imediatamente', default: false },
        ], callback: (a) => this.send('set', { seconds: Number(a.options.minutes || 0) * 60 + Number(a.options.seconds || 0), start: a.options.start ? 1 : 0 }),
      },
    })

    this.setFeedbackDefinitions({
      running: { name: 'Timer rodando', type: 'boolean', defaultStyle: { bgcolor: C.green, color: C.white }, options: [], callback: () => !!this.state.running },
      paused: { name: 'Timer pausado', type: 'boolean', defaultStyle: { bgcolor: C.yellow, color: C.black }, options: [], callback: () => this.state.state === 'paused' },
      finished: { name: 'Timer zerado/finalizado', type: 'boolean', defaultStyle: { bgcolor: C.red, color: C.white }, options: [], callback: () => (this.state.mode === 'countdown' && this.state.state === 'finished') },
      warning_yellow: { name: 'Alerta amarelo', type: 'boolean', defaultStyle: { bgcolor: C.yellow, color: C.black }, options: [], callback: () => this.state.mode === 'countdown' && this.state.warning === 'yellow' },
      warning_red: { name: 'Alerta vermelho', type: 'boolean', defaultStyle: { bgcolor: C.red, color: C.white }, options: [], callback: () => this.state.mode === 'countdown' && (this.state.warning === 'red' || (this.state.mode === 'countdown' && this.state.state === 'finished')) },
      online: { name: 'Timer conectado', type: 'boolean', defaultStyle: { bgcolor: C.green, color: C.white }, options: [], callback: () => this.state.state !== 'offline' },
    })

    const button = (name, text, actionId, bgcolor = C.blue, feedbacks = []) => ({
      type: 'simple', category: 'Controles', name, style: { text, size: '18', color: C.white, bgcolor },
      steps: [{ down: [{ actionId, options: {} }], up: [] }], feedbacks,
    })
    const timePreset = (minutes, autoStart = false) => ({
      type: 'simple', category: autoStart ? 'Tempos + iniciar' : 'Tempos predefinidos', name: `${minutes} minutos${autoStart ? ' e iniciar' : ''}`,
      style: { text: `${minutes}\nMIN`, size: '18', color: C.white, bgcolor: autoStart ? C.green : C.blue },
      steps: [{ down: [{ actionId: 'set_time', options: { minutes, seconds: 0, start: autoStart } }], up: [] }], feedbacks: [],
    })

    const presets = {
      start: button('Iniciar', '▶\nINICIAR', 'start', C.green, [{ feedbackId: 'running', options: {} }]),
      toggle: button('Play/Pause', '▶ / Ⅱ\nPLAY PAUSE', 'toggle', C.blue, [{ feedbackId: 'running', options: {} }, { feedbackId: 'paused', options: {} }]),
      pause: button('Pausar', 'Ⅱ\nPAUSAR', 'pause', C.yellow, [{ feedbackId: 'paused', options: {} }]),
      stop: button('Parar e voltar ao tempo configurado', '■\nSTOP', 'stop', C.red, [{ feedbackId: 'finished', options: {} }]),
      reset: button('Reiniciar', '↺\nRESET', 'reset', C.gray),
      plus1: button('Aumentar 1 minuto', '+1\nMIN', 'add_minute', C.green), minus1: button('Diminuir 1 minuto', '-1\nMIN', 'remove_minute', C.red),
      plus10: button('Aumentar 10 segundos', '+10\nSEG', 'add_10s', C.green), minus10: button('Diminuir 10 segundos', '-10\nSEG', 'remove_10s', C.red),
      display: { type: 'simple', category: 'Monitoramento', name: 'Display do timer', style: { text: `$(${this.label}:display)`, size: '24', color: C.white, bgcolor: C.black }, steps: [], feedbacks: [{ feedbackId: 'warning_yellow', options: {} }, { feedbackId: 'warning_red', options: {} }] },
      status: { type: 'simple', category: 'Monitoramento', name: 'Status do timer', style: { text: `$(${this.label}:state)`, size: '18', color: C.white, bgcolor: C.gray }, steps: [], feedbacks: [{ feedbackId: 'online', options: {} }] },
    }
    for (const minutes of [5, 10, 15, 20, 30, 45, 60]) {
      presets[`time${minutes}`] = timePreset(minutes)
      presets[`time${minutes}start`] = timePreset(minutes, true)
    }
    // Presets must carry the boolean feedback's style themselves. The definition's
    // defaultStyle applies when a user adds a feedback in the editor, not as a
    // substitute for a missing style in an imported preset.
    const feedbackStyles = {
      running: { bgcolor: C.green, color: C.white },
      paused: { bgcolor: C.yellow, color: C.black },
      finished: { bgcolor: C.red, color: C.white },
      warning_yellow: { bgcolor: C.yellow, color: C.black },
      warning_red: { bgcolor: C.red, color: C.white },
      online: { bgcolor: C.green, color: C.white },
    }
    for (const preset of Object.values(presets)) {
      preset.feedbacks = preset.feedbacks.map(feedback => ({
        ...feedback, style: { ...feedbackStyles[feedback.feedbackId] },
      }))
    }
    const groups = new Map()
    for (const [id, preset] of Object.entries(presets)) {
      const category = preset.category
      if (!groups.has(category)) groups.set(category, [])
      groups.get(category).push(id)
      delete preset.category
    }
    this.setPresetDefinitions([...groups].map(([name, definitions], i) => ({ id: `section${i}`, name, definitions })), presets)
  }
}


