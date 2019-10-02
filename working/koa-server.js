'use strict'

const ao = require('appoptics-apm'); // eslint-disable-line no-unused-vars
const Koa = require('koa');
const Router = require('koa-router')
const bodyParser = require('koa-bodyparser')

const app = new Koa();
const router = new Router()

// logger

app
  .use(async (ctx, next) => {
    const start = Date.now()
    console.log('+logger')
    await next();
    const rt = ctx.response.get('X-Response-Time');
    const et = Date.now() - start
    console.log(`${ctx.method} ${ctx.url} ${ctx.status} - ${et}:${rt}`);
  })
  .use(async (ctx, next) => {
    console.log('+timer')
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set('X-Response-Time', `${ms}ms`);
    console.log('-timer')
  })
  .use(bodyParser())

router
  .get('/', (ctx, next) => {
    console.log('+get /')
    ctx.body = 'i am root'
    next()
    console.log('-get /')
  })
  .get('/config', (ctx, next) => {
    console.log('+get /config')
    ctx.body = 'i will be a config'
    next()
    console.log('-get /config')
  })
  .get('/config/bruce', (ctx, next) => {
    ctx.body = {message: 'i am the config of fire'}
    next()
  })
  .get('/direct', (ctx, next) => {
    ctx.body = 'i am the god of fire\n'
    next()
  })

const todos = new Router()

todos.get('/', (ctx, next) => ctx.body = 'get.todos (get-all)')
todos.post('/', (ctx, next) => ctx.body = `post.todos (${ctx.request.body.title})`)
todos.put('/:id/:z?', (ctx, next) => {console.log(ctx.params); ctx.body = `put.todos.${ctx.params.id}`})

router.use('/api/todos', todos.routes(), todos.allowedMethods())

app.use(router.routes())
// response

//app.use(async ctx => {
//  console.log('response')
//  ctx.body = 'Hello World';
//});

app.listen(3000);
