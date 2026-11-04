/* Scratch runner: only the named parts. Deleted before the end. */
const parts = process.argv.slice(2)
const queue = []
const test = (name, fn) => queue.push({ name, fn })
for (const p of parts) (await import(new URL('./' + p + '.mjs', import.meta.url))).run(test)
let pass = 0, fail = 0
for (const t of queue) {
  try { await t.fn(); pass++ } catch (e) { fail++; console.log('FAIL  ' + t.name + '\n      ' + String(e.message).split('\n').slice(0, 6).join('\n      ')) }
}
console.log(`${pass} passed, ${fail} failed`)
