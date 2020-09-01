'use strict'
const EventEmitter = require('events')
const puppeteer = require('puppeteer')
const moduleRaid = require('./raidWhatsApp')
const { WindowStore, WindowUtils } = require('./storeWhatsApp')
const httpProxy = require('http-proxy')
const { getFreePorts, isFreePort } = require('node-port-check')
const yaqrcode = require('yaqrcode')
const fetch = require('node-fetch')
const qrcode_terminal = require('qrcode-terminal')
const moment = require('moment');

// DEFINE PORT WEBSERVICE
const argv = process.argv.slice(2);
console.log(argv);

if(typeof argv[0] === 'undefined')var port = 8333;
else var port = parseInt((argv[0]).replace('PORT=', ''));

if(typeof argv[1] === 'undefined')var headless = true;
else var headless = Boolean((argv[1]).replace('HEADLESS=', ''));

if(typeof argv[2] === 'undefined')var debug = true;
else var debug = Boolean((argv[2]).replace('DEBUG=', ''));

// DEFINE CONST WHATSAPP WEB
const APP_HEADLESS = headless
const APP_HOST = '0.0.0.0'
const APP_PORT = port;
const APP_SERVER = 'http://localhost:' + APP_PORT
const APP_URI = 'https://web.whatsapp.com'
const APP_KEEP_PHONE_CONNECTED_SELECTOR = '[data-tab]'
const APP_QR_VALUE_SELECTOR = '[data-ref]'
const APP_LANGUAGE = 'en'
const APP_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36'
const APP_DEBUG = debug

// PUPPETEER WHATSAPP CLASS
class PuppeteerWhatsApp extends EventEmitter {
  constructor () {
    super()
    this.browser = null
    this.page = null
  }

  // CHECKED
  async start (token, bot, webhook) {
    try {
      const time_start = Date.now()

      if (typeof token === 'undefined' || token == '')token = 'new'

      if (typeof bot === 'string' && (bot).trim() != '' && this.isUrl(bot)) var bot = (bot).trim()
      else var bot = null

      if (typeof webhook === 'string' && (webhook).trim() != '' && this.isUrl(webhook)) var webhook = (webhook).trim()
      else var webhook = null

      const db_token = this.getDatabaseToken()

      const puppeteer_args = [
        // '--full-memory-crash-report'
        '--disable-dev-shm-usage',
        '--enable-sync', '--enable-background-networking', '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-gpu', '--renderer', '--no-service-autorun', '--no-experiments',
        '--no-default-browser-check', '--disable-webgl', '--disable-threaded-animation',
        '--disable-threaded-scrolling', '--disable-in-process-stack-traces', '--disable-histogram-customizer',
        '--disable-gl-extensions', '--disable-extensions', '--disable-composited-antialiasing',
        '--disable-canvas-aa', '--disable-3d-apis', '--disable-accelerated-2d-canvas',
        '--disable-accelerated-jpeg-decoding', '--disable-accelerated-mjpeg-decode', '--disable-app-list-dismiss-on-blur',
        '--disable-accelerated-video-decode', '--mute-audio'
      ];

      if(APP_HEADLESS){
        puppeteer_args.push('--unlimited-storage');
        puppeteer_args.push('--force-gpu-mem-available-mb');
      }else{
        puppeteer_args.push('--auto-open-devtools-for-tabs');
      }
      //console.log(puppeteer_args);

      // NEW PUPPETEER
      const browser = await puppeteer.launch({
        headless: APP_HEADLESS,
        ignoreHTTPSErrors: true,
        defaultViewport: null,
        args: puppeteer_args
      })
      this.browser = browser

      // CREATE PUPPETEER INCOGNITO
      const context = await browser.createIncognitoBrowserContext()
      const page = await context.newPage()

      // CREATE PUPPETEER NORMAL
      // const page = await browser.newPage();

      // CLOSE BLANK PAGE
      const pages_created = await browser.pages()
      pages_created[0].close()
      this.page = pages_created[1]

      console.log('INIT TOKEN ' + token)

      // USER AGENT, EXTRA HEADER, REQUEST INTERCEPTION
      await page.setUserAgent(APP_USER_AGENT)
      await page.setExtraHTTPHeaders({ 'Accept-Language': APP_LANGUAGE })
      await page.setRequestInterception(true)

      // PUPPETEER CONSOLE
      await page.on('console', msg => {
        for (const arg of msg.args()) {
          arg.jsonValue().then(v => console.log(v)).catch(error => console.log(msg))
        }
      })

      // PUPPETEER ERROR
      await page.on('error', error => {
        console.log('function error')
        var str_error = error.toString()
        if (typeof str_error === 'string') {
          const error_search = str_error.search('Page crashed');
          const type_error = str_error.substring(0, 30).trim()
          console.log('ERROR TYPE: ' + type_error)
          if (error_search > 0) {
            page.reload()
          }
        }
      })

      await page.on('load', () => {
        console.log('ONLOAD')
        page.evaluate(res => JSON.stringify(window.sessionStorage)).then(sessionStorage => {
          const session = JSON.parse(sessionStorage)
          if (typeof session.TK !== 'undefined' && session.TK != '' && session.TK != null) {
            const token_name = session.TK
            var data_token = db_token.get('token').find({ name: token_name }).value()
            if (typeof data_token !== 'undefined' && typeof data_token.localstorage !== 'undefined' && data_token.localstorage != null) {
              console.log('AUTOSTART TOKEN')
              var send = {
                method: 'post',
                body: JSON.stringify({ bot: data_token.bot, webhook: data_token.webhook }),
                headers: { 'Content-Type': 'application/json' }
              }
              const uri_fetch = APP_SERVER + '/api/' + token_name + '/start'
              fetch(uri_fetch, send)
              page.close()
            }
          } else console.log('TOKEN INITAL')
        })
      })

      // PUPPETEER PAGE ERROR
      await page.on('pageerror', e => {
        this.getLog('pageerror', e)
      })

      // BLOCK RESOURCES TO LOAD FAST
      await page.on('request', request => {
        if ([/* 'stylesheet', */'image', 'font', 'media'].indexOf(request.resourceType()) !== -1)request.abort()
        else request.continue()
      })

      // TOKEN SESSION
      var data_token_db = db_token.get('token').find({ name: token }).value()
      if (typeof data_token_db !== 'undefined' && typeof data_token_db.localstorage !== 'undefined' && data_token_db.localstorage != null) {
        console.log('READ SAVED TOKEN')
        const data_token = data_token_db.localstorage

        // INJECT TOKEN SESSION IN WHATSAPP WEB
        if (data_token != '') {
          console.log('VALIDATING TOKEN')
          const session = JSON.parse(data_token)
          await page.evaluateOnNewDocument(session => {
            localStorage.clear()
            localStorage.setItem('WABrowserId', session.WABrowserId)
            localStorage.setItem('WASecretBundle', session.WASecretBundle)
            localStorage.setItem('WAToken1', session.WAToken1)
            localStorage.setItem('WAToken2', session.WAToken2)
          }, session)
        }
      } else console.log('CREATE NEW TOKEN')

      // GOTO URL
      try {
        console.log('EVALUATING')
        await page.goto(APP_URI, { waitUntil: 'networkidle2', timeout: 10000 })
      } catch (e) {
        if (APP_DEBUG) {
          console.log('NETWORKIDLE')
          /* console.log(e) */
        }
      }

      // VALID INJECT TOKEN SESSION
      console.log('WAITING TOKEN')
      try {
        await page.waitForSelector(APP_QR_VALUE_SELECTOR, { timeout: 2300 })
        const qr_code = await page.evaluate('document.querySelector("' + APP_QR_VALUE_SELECTOR + '").getAttribute("data-ref")')
        if (typeof qr_code === 'undefined' || qr_code === null) {
          console.log('NO TOKEN SELECTOR EXISTS')
          this.emit('API', { action: 'error', value: 'No token whatsapp selector', data: null, status: false })
          this.page.close()
        } else {
          var qr_base64 = yaqrcode(qr_code, { size: 300 })
          this.emit('API', { action: 'token', value: 'Scan token', data: qr_base64, status: true })
          qrcode_terminal.generate(qr_code, { small: true })
        }
      } catch (e) {
        if (APP_DEBUG) {
          console.log('NO SCAN SELECTOR')
          // console.log(e);
        }
      }

      // EVALUATE INJECTED TOKEN SESSION
      const is_token = await page.waitForSelector(APP_KEEP_PHONE_CONNECTED_SELECTOR, { timeout: 42000 }).then(res => {
        console.log('VALID TOKEN')
        return true
      }).catch(e => {
        console.log('INVALID TOKEN')
        this.emit('API', { action: 'error', value: 'Invalid token', data: null, status: false })
        this.browser.close()
        return false
      })

      if (is_token === true) {
        console.log('INJECTING')

        // SAVE TOKEN LOCALSTORAGE TO JSON
        await page.evaluate(res => JSON.stringify(window.localStorage)).then(localStorage => {
          console.log('TOKEN SAVED')
          db_token.get('token').remove({ name: token }).write()
          db_token.get('token').push({ name: token, endpoint: null, localstorage: localStorage, bot: bot, webhook: webhook }).write()
        })

        // ADD MODULERAID - INJECT
        await page.evaluate(WindowStore, moduleRaid.toString())

        // CHECK INJECTION
        const store_def = await page.waitForFunction('window.Store.Msg !== undefined')
          .then(e => {
            console.log('INJECTED')
            return true
          }).catch(e => {
            console.log('NOT INJECTED')
            this.emit('API', { action: 'error', value: 'Imposible start whatsapp', data: null, status: false })
            return false
          })

        // ENDPOINT
        const bw_endpoint = await browser.wsEndpoint()
        const ws_endpoint = await this.setWebSocket(bw_endpoint, token)
        console.log('ENDPOINT ' + ws_endpoint)
        db_token.get('token').find({ name: token }).assign({ endpoint: ws_endpoint }).write()

        await page.evaluate(WindowUtils)
        await page.evaluate((bw_endpoint, ws_endpoint, token) => {
          window.App.BW = bw_endpoint
          window.App.WS = ws_endpoint
          window.App.TK = token
          sessionStorage.setItem('BW', bw_endpoint)
          sessionStorage.setItem('WS', ws_endpoint)
          sessionStorage.setItem('TK', token)
          return window.Store.Conn.serialize()
        }, bw_endpoint, ws_endpoint, token)
          .then(get_me => {
            var time = (Date.now() - time_start) / 1000
            console.log('WHATSAPP LOADED IN ' + time + ' SEC')
          })

        // REGISTER EVENTS
        await page.exposeFunction('onAddMessage', (message) => {
          this.responseBot(message, this);
        })

        // await page.exposeFunction('onAddMedia', message => this.emit('MEDIA', message));

        // STATE PAGE CHANGE
        await page.exposeFunction('onChangeState', () => {
          try {
            this.getStatePage(page).then(json => {
              if (typeof json.state !== 'undefined') {
                const stream = json.stream
                const state = json.state
                if (typeof json.ws !== 'undefined' && json.ws != '') {
                  const ws = json.ws
                  if (stream == 'disconnected' && state == 'conflict') {
                    this.getWebSocketPage(ws).then(json_page => {
                      if (json_page != null && typeof json_page === 'object' && typeof json_page.page !== 'undefined' && json_page.page != null) {
                        var browser = json_page.browser
                        browser.close()
                        return false
                      }
                    })
                  }
                }
              }
            })
          } catch (e) {
            this.getLog('exposeFunction(onChangeState)', e)
          }
        })

        // ADD MESSAGES EVENT
        console.log('READING MESSAGES')

        await page.evaluate((token) => {
          setTimeout(() => {
            // EMMITER EVENT APP STATE
            window.Store.AppState.on('change', () => onChangeState())
            // EMMITER EVENTS MESSAGES ADD
            window.Store.Msg.on('add', (new_message) => {
              const message = new_message.serialize()
              if (typeof message.type === 'undefined' || typeof message.isNewMsg === 'undefined' || message.isNewMsg == false || message.broadcast == true || message.id.remote == 'status@broadcast' || message.id.fromMe == true)return
              else{
                if(message.type == 'chat' || message.type == 'location'){
                  message.apiToken = token
                  onAddMessage(message)
                }else return
              }
            })
          }, 4500)
        }, token)

        var end_time = (Date.now() - time_start) / 1000
        var value = 'READY ' + token + ' IN ' + end_time + ' SEC.'
        console.log(value)
        this.emit('API', { action: 'ready', value: value, status: true })
      } else await browser.close()
    } catch (e) {
      this.getLog('start', e)
    }
  }

  // CHECKED
  getLog (name, e) {
    if (APP_DEBUG) {
      console.log('function ' +  name)
      console.log(moment().format('YYYY-MM-DD HH:mm:ss'));
      console.log(e)
    }
  }

  // CHECKED
  responseBot (message, WhatsApp) {
    try {
      new Promise((resolve, reject) => {
        var time = new Date()
        if (typeof message === 'object' && typeof message.apiToken !== 'undefined' && typeof message.from !== 'undefined') {
          if( APP_DEBUG )console.log(message);
          const token = message.apiToken
          const WhatsAppDB = WhatsApp.getDatabaseToken()
          const data_token = WhatsAppDB.get('token').find({ name: token }).value()
          if (typeof data_token === 'undefined' || typeof data_token.endpoint === 'undefined') {
            console.log({ response: 'Not defined token', status: false })
            return false
          } else {
            // BOT MESSAGE
            new Promise((resolve, reject) => {
              //console.log(data_token);
              if (typeof data_token.bot !== 'undefined' && data_token.bot != null) {
                //console.log(data_token);
                WhatsApp.getWebSocketPage(data_token.endpoint).then(json_page => {
                  if (typeof json_page === 'object' && typeof json_page.page !== 'undefined' && json_page.page != null) {
                    var page = json_page.page
                    var bot = data_token.bot
                    var from = message.from
                    var send = {
                      method: 'post',
                      body: JSON.stringify({ token: token, message: message.body, data: JSON.stringify(message) }),
                      headers: { 'Content-Type': 'application/json' }
                    }
                    fetch(bot, send).then(res => res.json()).then(parsed => {
                      if (typeof parsed === 'object' && parsed.status == true && typeof parsed.message !== 'undefined') {
                        var bot_message = parsed.message
                        var options = {}
                        if (typeof parsed.options !== 'undefined')var options = parsed.options;
                        WhatsApp.sendMessage(page, from, bot_message, options)
                      }
                    })
                  }
                })
              }
            })

            // WEBHOOK
            new Promise((resolve, reject) => {
              if (typeof data_token.webhook !== 'undefined' && data_token.webhook != null) {
                var webhook = data_token.webhook
                try {
                  var send = { method: 'post', body: JSON.stringify(message), headers: { 'Content-Type': 'application/json' } }
                  fetch(webhook, send).catch(e => { return false })
                } catch (e) { if (APP_DEBUG)console.log(e) }
              }
            })
          }
        }
      })
    } catch (e) {
      this.getLog('responseBot', e)
      return false
    }
  }

  // CHECKED
  isUrl (url) {
    try {
      const data_url = new URL(url)
      if (typeof data_url !== 'undefined' && typeof data_url.host !== 'undefined' && data_url.host != '') return true
      else return false
    } catch (e) {
      this.getLog('isUrl', e)
      return false
    }
  }

  // CHECKED
  getDatabaseToken () {
    var db = null
    try {
      var low = require('lowdb')
      var FileSync = require('lowdb/adapters/FileSync')
      var path = require('path')
      var adapter = new FileSync(path.join(__dirname, 'dbTokenWhatsApp.json'))
      var db = low(adapter)
      db.defaults({ token: [] }).write()
    } catch (e) {
      this.getLog('getDatabaseToken', e)
    }
    return db
  }

  // CHECKED
  getTimeSend (no) {
    var to_time = 3582
    try {
      if (typeof no === 'number' && no > 0) {
        var max = 3500
        var number_op = Math.ceil(no / max)
        switch (number_op) {
          case 1: to_time = 3551; break
          case 2: to_time = 3478; break
          case 3: to_time = 2936; break
          case 4: to_time = 2582; break
          case 5: to_time = 2433; break
          case 6: to_time = 2791; break
          default: to_time = 3304; break
        }
      }
    } catch (e) {
      this.getLog('getTimeSend', e)
    }
    return to_time
  }

  // CHECKED
  async setWebSocket (ws_endpoint, token) {
    var port = null
    try {
      var port = await getFreePorts(1, APP_HOST).then(res => res[0])
      const is_open = await isFreePort(port, APP_HOST).then(open => open[2])
      if (is_open) {
        await httpProxy.createServer({ target: ws_endpoint, ws: true, localAddress: APP_HOST }).listen(port)
      }
    } catch (e) {
      this.getLog('setWebSocket', e)
    }
    return 'ws://' + APP_HOST + ':' + port
  }

  // CHECKED
  async getWebSocketPage (ws_url) {
    try {
      const browser = await puppeteer.connect({ browserWSEndpoint: ws_url, ignoreHTTPSErrors: true })
      const pages_created = await browser.pages()
      return { browser: browser, page: pages_created[0], endpoint: ws_url, type: 'success' }
    } catch (e) {
      this.getLog('getWebSocketPage', e)
      return { browser: null, page: null, endpoint: e.target.url, type: e.type }
    }
  }

  // NOT GROUP SEND MESSAGE
  async sendMessageToID (page, id, message, options = {}) {
    try {
      return await page.evaluate((message, id, options) => {
        try {
          if (typeof id === 'string' && id != '') {
            const get_id = window.Store.Chat.get(id)
            if (typeof get_id.id !== 'undefined' && typeof get_id.id.server !== 'undefined' && get_id.id.server == 'c.us') {
              window.App.sendSeen(id)
              const number = id.replace(/\D+/g, '')
              const replaceNumber = (message, number) => message.replace(/{number}/g, number)
              try{
                var noption = JSON.parse(options);
              }catch(e){
                var noption = JSON.parse(JSON.stringify(options));
              }
              if (typeof message === 'string' && message != '') {
                var message = replaceNumber(message, number)
                window.App.sendMessage(get_id, message, noption)
                return { number: number, message: message, status_code: 200 }
              } else if (Array.isArray(message) && message.length > 0) {
                message.forEach((data_message) => {
                  if (typeof data_message === 'string' && data_message != '') {
                    var message = replaceNumber(data_message, number)
                    window.App.sendMessage(get_id, data_message, noption)
                    return { number: number, message: data_message, status_code: 200 }
                  }
                })
              }
            } else return { number: null, message: 'NaN', status_code: 404 }
          } else return { number: null, message: 'NaN', status_code: 404 }
        } catch (e) {
          return { number: null, message: 'Error', status_code: 504 }
        }
      }, message, id, options)
    } catch (e) {
      this.getLog('sendMessageToID', e)
      return { number: null, message: 'Close', status_code: 501 }
    }
  }

  // CHECKED
  async getMe (page) {
    try {
      return await page.evaluate(() => {
        var me = window.Store.Conn.serialize()
        var id = me.me._serialized
        me.picture = window.Store.ProfilePicThumb.get(id).serialize()
        return me
      })
    } catch (e) {
      this.getLog('getMe', e)
      return {}
    }
  }

  // CHECKED
  async getContact (page, id) {
    try {
      return await page.evaluate((id) => {
        if (typeof id === 'undefined' || id == '') return window.Store.Contact.serialize()
        else return window.Store.Contact.get(id).serialize()
      }, id)
    } catch (e) {
      this.getLog('getContact', e)
      return {}
    }
  }

  // CHECKED
  async getProfilePicThumb (page, id) {
    try {
      return await page.evaluate((id) => {
        if (typeof id === 'undefined' || id == '') return window.Store.ProfilePicThumb.serialize()
        else return window.Store.ProfilePicThumb.get(id).serialize()
      }, id)
    } catch (e) {
      this.getLog('getProfilePicThumb', e)
      return {}
    }
  }

  // CHECKED
  async getChat (page, id) {
    try {
      return await page.evaluate((id) => {
        if (typeof id === 'undefined' || id == '') return window.Store.Chat.serialize()
        else return window.Store.Chat.get(id).serialize()
      }, id)
    } catch (e) {
      this.getLog('getChat', e)
      return {}
    }
  }

  // CHECKED
  async getChatStats (page) {
    try {
      return await page.evaluate(() => {
        var chats = window.Store.Chat.serialize()
        var no_chats = chats.length
        var no_unread = 0
        chats.forEach((chat) => {
          if (typeof chat.unreadCount !== 'undefined' && chat.unreadCount > 0)++no_unread
        })
        return { chat: no_chats, unread: no_unread }
      })
    } catch (e) {
      this.getLog('getChatStats', e)
      return { chat: 0, unread: 0 }
    }
  }

  // CHECKED
  async getChatUnread (page) {
    try {
      return await page.evaluate(() => {
        var chats = window.Store.Chat.serialize()
        if (typeof chats === 'object' && chats.length > 0) {
          var chats_unread = []
          chats.forEach((chat) => {
            if (typeof chat.unreadCount !== 'undefined' && typeof chat.msgs !== 'undefined') {
              var number = chat.id._serialized
              var unread = chat.unreadCount
              var msg = chat.msgs
              if (unread > 0) {
                var msg_unread = msg.slice(-unread)
                chats_unread.push({ number: number, unread: unread, message: msg_unread })
              }
            }
          })
          return chats_unread
        }
      })
    } catch (e) {
      this.getLog('getChatUnread', e)
      return {}
    }
  }

  // CHECKED
  async loadEarlierMsgstById (page, id) {
    try {
      return await page.evaluate((id, APP_DEBUG) => {
        if (id != '') {
          try {
            window.Store.Chat.get(id).loadEarlierMsgs()
            return true
          } catch (e) { if (APP_DEBUG)console.log(e) }
        }
        return false
      }, id, APP_DEBUG)
    } catch (e) {
      this.getLog('loadEarlierMsgstById', e)
      return false
    }
  }

  // CHECKED
  async setContactSeen (page, id) {
    try {
      return await page.evaluate((id, APP_DEBUG) => {
        if (id != '') {
          try {
            window.App.sendSeen(id)
            return true
          } catch (e) { if (APP_DEBUG)console.log(e) };
        }
        return false
      }, id, APP_DEBUG)
    } catch (e) {
      this.getLog('setContactSeen', e)
      return false
    }
  }

  // CHECKED
  async setLogout (page) {
    try {
      return await page.evaluate((APP_DEBUG) => {
        try {
          window.Store.tag.sendCurrentLogout()
          window.Store.tag.logout()
          return true
        } catch (e) { if (APP_DEBUG)console.log(e) };
        return false
      }, APP_DEBUG)
    } catch (e) {
      this.getLog('setLogout', e)
      return false
    }
  }

  // CHECKED
  async sendMessage (page, id, message, options = {}) {
    try {
      if (typeof id === 'string' && id != '') var id = [id]
      if (typeof id === 'object' && id.length > 0) {
        var no_ids = id.length
        var to_time = this.getTimeSend(no_ids)
        var time = 1097
        id.forEach((from) => {
          setTimeout(() => {
            new Promise((resolve, reject) => {
              this.sendMessageToID(page, from, message, options)
            })
          }, time)
          time += to_time
        })
        return no_ids
      }
    } catch (e) {
      this.getLog('sendMessage', e)
      return 0
    }
  }

  async createTask (token, number, message) {
  }

  // CHECKED
  async sendBroadcast (page, token, message, options) {
    try {
      if (typeof options.unread === 'undefined') var unread = false
      else var unread = true
      const to_number = await this.getIdNumbers(page, unread)
      if (to_number.length > 0 && typeof message !== 'undefined' && message.trim() != '') {
        var no_chats = to_number.length
        var status_code = 200
        var send_message = message + '\n\n#{number}'
        this.createTask(token, to_number, send_message)
        this.sendMessage(page, to_number, send_message, options)
      } else {
        var status_code = 300
        var no_chats = 0
      }
      return { chats: no_chats, message: message, status_code: status_code }
    } catch (e) {
      this.getLog('sendBroadcast', e)
      return { chats: 0, message: null, status_code: 501 }
    }
  }

  // CHECKED
  async getIdNumbers (page, unread) {
    try {
      return await page.evaluate((unread) => {
        var to_number = []
        try {
          var chats = window.Store.Chat.serialize()
          if (typeof chats === 'object' && chats.length > 0) {
            var no_chats = chats.length
            chats.forEach((chat) => {
              if (typeof chat.msgs !== 'undefined' && typeof chat.id._serialized !== 'undefined' && typeof chat.id.server !== 'undefined' && typeof chat.unreadCount !== 'undefined' && chat.id.server == 'c.us') {
                var number = chat.id._serialized
                if (unread == true) {
                  if (chat.unreadCount > 0)to_number.push(number)
                } else to_number.push(number)
              }
            })
          }
        } catch (e) {};
        return to_number
      }, unread)
    } catch (e) {
      this.getLog('getNumbers', e)
      return []
    }
  }

  // CHECKED
  async setDestroy (browser, page, token) {
    try {
      var is_live = await page.evaluate((token) => {
        var ls = JSON.parse(JSON.stringify(window.localStorage))
        if (typeof ls['last-wid'] === 'undefined') {
          console.log('DESTROY ' + token)
          return true
        } else return false
      }, token)
      if (is_live) {
        console.log('CLOSE PUPPETER')
        await browser.close()
      }
    } catch (e) {
      this.getLog('setDestroy', e)
      return null
    }
  }

  // CHECKED
  async getStatePage (page) {
    try {
      return await page.evaluate((APP_DEBUG) => {
        var json = {}
        try {
          json = {
            bw: window.App.BW,
            ws: window.App.WS,
            tk: window.App.TK,
            stream: (window.Store.AppState.__x_stream).toLowerCase(),
            state: (window.Store.AppState.__x_state).toLowerCase()
          }
        } catch (e) { if (APP_DEBUG)console.log(e) }
        return json
      }, APP_DEBUG)
    } catch (e) {
      this.getLog('getStatePage', e)
      return {}
    }
  }

  // CHECKED
  async getNavigatorStorage (page) {
    try {
      return await page.evaluate(() => {
        return navigator.storage.estimate()
      })
    } catch (e) {
      this.getLog('getNavigatorStorage', e)
      return {}
    }
  }

  // CHECKED
  async startWebService () {
    try {
      if (typeof APP_PORT === 'number') {
        const is_open = await isFreePort(APP_PORT, APP_HOST).then(open => open[2])
        if (is_open) {
          const express = require('express')
          const bodyParser = require('body-parser')
          const cors = require('cors')
          const helmet = require('helmet')
          const http = require('http')
          const ws = express()
          const server = http.createServer(ws)
          ws.use(cors())
          ws.use(bodyParser.json({ limit: '40mb', extended: true }))
          ws.use(bodyParser.urlencoded({ limit: '40mb', extended: true }))
          ws.use(helmet())

          server.listen(APP_PORT, () => {
            //var data_address = server.address()
            //console.log('START WEB SERVICE ON ' + data_address.address + data_address.port)
            console.log('START WEBSERVICE ON ' + APP_SERVER)
            return ws
          })


          ws.all('*', (req, res, next) => {
            if (typeof req.url !== 'undefined' && (req.url).match(/api/)) return next()
            res.json({ response: 'Hello', status_code: 201 })
            return false
          })

          ws.all('/api', (req, res) => {
            res.json({ response: 'Api', status_code: 202 })
            return false
          })

          ws.post('/api/:token/:action', (req, res) => {
            if (typeof req.body === 'object' && typeof req.params.token === 'string' && typeof req.params.action === 'string') {

              const token = (req.params.token).trim()
              const action = (req.params.action).toLowerCase().trim()

              if (token == '')res.json({ response: 'Not allowed empty token', status_code: 401 })
              else if (action == '')res.json({ response: 'Not allowed empty action', status_code: 401 })
              else {
                const WhatsApp = this
                if (action == 'start') {
                  //console.log(req.body);
                  if (typeof req.body.bot === 'string' && (req.body.bot).trim() != '' && WhatsApp.isUrl(req.body.bot)) var bot = (req.body.bot).trim()
                  else var bot = ''

                  if (typeof req.body.webhook === 'string' && (req.body.webhook).trim() != '' && WhatsApp.isUrl(req.body.webhook)) var webhook = (req.body.webhook).trim()
                  else var webhook = ''

                  WhatsApp.start(token, bot, webhook)

                  WhatsApp.on('API', json => {
                    try { res.json(json) } catch (e) {
                      if (APP_DEBUG) {
                        // console.log('Already sent api to client');
                      }
                    }
                  })
                } else {
                  const WhatsAppDB = WhatsApp.getDatabaseToken()
                  const data_token = WhatsAppDB.get('token').find({ name: token }).value()
                  if (typeof data_token === 'undefined' || typeof data_token.endpoint === 'undefined' || data_token.endpoint == null || data_token.endpoint == '') {
                    res.json({ response: 'Not defined login', status_code: 403 })
                  } else {
                    // console.log(req.body);
                    const number = req.body.number
                    const message = req.body.message
                    var options = {}
                    if (typeof req.body.options !== 'undefined' && req.body.options != '') {
                      try {
                        var options = JSON.parse(req.body.options)
                      } catch (e) {
                        var options = JSON.parse(JSON.stringify(req.body.options));
                      }
                    }

                    WhatsApp.getWebSocketPage(data_token.endpoint).then(json_page => {
                      if (json_page != null && typeof json_page === 'object' && typeof json_page.page !== 'undefined' && json_page.page != null) {
                        var page = json_page.page
                        var browser = json_page.browser
                        switch (action) {
                          case 'stats':
                            WhatsApp.getChatStats(page).then(response => res.json(response))
                            break
                          case 'state':
                            WhatsApp.getStatePage(page).then(response => res.json(response))
                            break
                          case 'me':
                            WhatsApp.getMe(page).then(response => res.json(response))
                            break
                          case 'contact':
                            WhatsApp.getContact(page, number).then(response => res.json(response))
                            break
                          case 'photo':
                            WhatsApp.getProfilePicThumb(page, number).then(response => res.json(response))
                            break
                          case 'chat':
                            WhatsApp.getChat(page).then(response => res.json(response))
                            break
                          case 'unread':
                            WhatsApp.getChatUnread(page).then(response => res.json(response))
                            break
                          case 'seen':
                            WhatsApp.setContactSeen(page, number).then(response => res.json(response))
                            break
                          case 'message':
                            WhatsApp.sendMessage(page, number, message, options).then(response => res.json(response))
                            break
                          case 'broadcast':
                            WhatsApp.sendBroadcast(page, token, message, options).then(response => res.json(response))
                            break
                          case 'logout':
                            WhatsApp.setLogout(page).then(response => {
                              setTimeout(() => {
                                if (typeof browser !== null && typeof token !== 'undefined') {
                                  WhatsAppDB.get('token').find({ name: token }).assign({ localstorage: null, endpoint: null, bot: null, webhook: null }).write()
                                  WhatsApp.setDestroy(browser, page, token)
                                }
                              }, 1500)
                              res.json(response)
                            })
                            break
                          // REVIEW
                          case 'storage':
                            WhatsApp.getNavigatorStorage(page).then(response => res.json(response))
                            break
                          case 'load_message':
                            WhatsApp.loadEarlierMsgstById(page, number).then(response => res.json(response))
                            break
                          default:
                            res.json({ response: 'Action not available: ' + action, status_code: 404 })
                            break
                        }
                      } else {
                        WhatsAppDB.get('token').find({ name: token }).assign({ endpoint: null }).write()
                        res.json({ response: 'Invalid page token', status_code: 405 })
                        return false
                      }
                    })
                  }
                }
              }
            } else {
              res.json({ response: 'Invalid params', status_code: 406 })
              return false
            }
            return false
          })
        } else {
          console.log('ALREADY LISTEN ON ' + APP_SERVER)
          return false
        }
      }
    } catch (e) {
      this.getLog('startWebService', e)
    }
  }
}

module.exports = PuppeteerWhatsApp
