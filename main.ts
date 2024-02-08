import { Hono } from 'hono/mod.ts'
import { serveStatic } from 'hono/middleware.ts'
import { streamSSE } from 'hono/helper/streaming/index.ts'

const db = await Deno.openKv()

const app = new Hono()

let i = 0

app.get('/', serveStatic({ path: './index.html' }))

app.post('/visit', async (c) => {
  const { country, city, flag } = await c.req.json()

  await db.atomic()
    .set(['lastVisit'], { country, city, flag, date: Date.now().toString() })
    .sum(['visits'], 1n)
    .commit()

  return c.json({ message: 'ok' })
})

app.get('/visit', (c) => {
  return streamSSE(c, async (stream) => {
    const watcher = db.watch([['lastVisit']])

    for await (const entry of watcher) {
      const { value } = entry[0]

      if (value != null) {
        await stream.writeSSE({ data: JSON.stringify(value), event: 'update', id: String(i++) })
      }
    }
  })
})

Deno.serve(app.fetch)