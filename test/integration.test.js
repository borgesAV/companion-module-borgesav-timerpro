import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
const { default: Module } = await import(process.env.BORGES_TEST_ENTRY || '../src/entry.js')

function instance() {
  const state = { values: {} }
  const context = { id: 'test', label: 'MEU_TIMER', _isInstanceContext: true,
    setVariableDefinitions: v => { state.variables = v },
    setVariableValues: v => Object.assign(state.values, v),
    setActionDefinitions: v => { state.actions = v },
    setFeedbackDefinitions: v => { state.feedbacks = v },
    setPresetDefinitions: (s, p) => { state.sections = s; state.presets = p },
    updateStatus: (...v) => { state.status = v }, checkAllFeedbacks() {}, log() {},
  }
  return { module: new Module(context), state }
}
const payload = { ok: true, apiVersion: 1, running: false, display: '05:00', state: 'paused', mode: 'countdown', remainingSeconds: 300, durationSeconds: 300, warning: 'normal', ndi: false, message: 'INTERVALO' }

test('API real HTTP: PIN, ações, presets, erro e recuperação', async t => {
  let response = { ...payload }, status = 200
  const requests = []
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost'); requests.push(url)
    res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(response))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { module: m, state } = instance()
  t.after(async () => { await m.destroy(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) })
  await m.init({ host: '127.0.0.1', port: server.address().port, pin: 'a& b', poll: 5000 })
  assert.equal(state.values.display, '05:00', JSON.stringify(state.status))
  assert.equal(requests[0].searchParams.get('pin'), 'a& b')
  assert.equal(state.variables.display.name, 'Tempo exibido')
  assert.equal(state.presets.display.style.text, '$(MEU_TIMER:display)')
  assert.ok(state.sections.length > 0)
  for (const preset of Object.values(state.presets)) assert.equal(preset.type, 'simple')
  for (const [id, path] of Object.entries({ start:'start', pause:'pause', toggle:'toggle', stop:'stop', reset:'reset', add_minute:'plus1', remove_minute:'minus1', add_10s:'plus10', remove_10s:'minus10' })) {
    await state.actions[id].callback(); assert.equal(requests.at(-1).pathname, '/' + path)
  }
  await state.actions.set_time.callback({ options: { minutes: 15, seconds: 30, start: true } })
  assert.equal(requests.at(-1).searchParams.get('seconds'), '930')
  assert.equal(requests.at(-1).searchParams.get('start'), '1')
  for (const preset of Object.values(state.presets)) for (const step of preset.steps) for (const action of step.down) assert.ok(state.actions[action.actionId])
  response = { ...payload, running: true, state: 'running' }; await m.pollNow()
  assert.equal(state.feedbacks.running.callback(), true)
  status = 401; await m.pollNow()
  assert.equal(state.values.state, 'offline'); assert.equal(state.values.running, '0')
  assert.equal(state.feedbacks.running.callback(), false); assert.equal(state.feedbacks.online.callback(), false)
  status = 200; response = { ok: false, error: 'Comando inválido' }; await m.send('bad')
  assert.equal(state.values.state, 'offline')
  response = { ...payload }; await m.pollNow(); assert.equal(state.values.state, 'paused')
  response = { ...payload, apiVersion: 999 }; await m.pollNow(); assert.equal(state.values.state, 'offline')
})

test('Consultas não sobrepõem e respostas antigas são descartadas', async () => {
  const { module: m, state } = instance()
  m.config = {}; m.controllers = new Set(); m.generation = 0; m.state = { ...payload }; m.initDefinitions()
  const originalFetch = globalThis.fetch
  let release, count = 0
  globalThis.fetch = () => { count++; return new Promise(resolve => { release = resolve }) }
  try {
    const first = m.pollNow(); await m.pollNow(); assert.equal(count, 1)
    m.generation++
    release({ ok: true, json: async () => ({ ...payload, display: 'STALE' }) })
    await first; assert.notEqual(state.values.display, 'STALE')
  } finally { globalThis.fetch = originalFetch; await m.destroy() }
})


test('Presets mantêm texto e contraste nos estados do timer', async () => {
  const { module: m, state } = instance()
  m.config = {}; m.state = { ...payload }; m.initDefinitions()
  try {
    for (const preset of Object.values(state.presets)) {
      for (const feedback of preset.feedbacks) {
        assert.equal(typeof feedback.style?.bgcolor, 'number')
        assert.equal(typeof feedback.style?.color, 'number')
        assert.notEqual(feedback.style.color, feedback.style.bgcolor)
        assert.equal(feedback.style.text, undefined, 'Feedback não apaga texto')
      }
    }
    for (const update of [
      { running:true, state:'running', warning:'normal' },
      { running:false, state:'paused', warning:'normal' },
      { running:true, state:'running', warning:'yellow' },
      { running:true, state:'running', warning:'red' },
      { running:false, state:'finished', warning:'red' },
    ]) {
      m.applyState({ ...payload, ...update })
      for (const id of ['start','toggle','pause','stop','display','status']) {
        const preset=state.presets[id]
        let style={ ...preset.style }
        for (const feedback of preset.feedbacks) {
          if(state.feedbacks[feedback.feedbackId].callback()) style={ ...style,...feedback.style }
        }
        assert.notEqual(style.color,style.bgcolor, `${id} ${update.state} sem contraste`)
        assert.equal(style.text,preset.style.text, `${id} perdeu legenda`)
      }
    }
  } finally { await m.destroy() }
})
