'use strict';
const EventEmitter = require('events');
const puppeteer = require('puppeteer');
const moduleRaid = require('./raidWhatsApp');
const {WindowStore, WindowUtils} = require('./storeWhatsApp');
const httpProxy = require('http-proxy');
const {getFreePorts, isFreePort} = require('node-port-check');
const yaqrcode = require('yaqrcode');
const fetch = require('node-fetch');

//DEFINE CONST WHATSAPP WEB
const APP_HOST = '0.0.0.0';
const APP_URI = 'https://web.whatsapp.com';
const APP_KEEP_PHONE_CONNECTED_SELECTOR = '[data-asset-intro-image="true"]';
const APP_QR_VALUE_SELECTOR = '[data-ref]';
const APP_LANGUAGE = 'es';
const APP_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36';

//PUPPETEER WHATSAPP CLASS
class PuppeteerWhatsApp extends EventEmitter{

  constructor(){
    super();
    this.browser = null;
    this.page = null;
  }

  async start(token, headless, bot_url, webhook_url){
    const time_start = Date.now();

    if(typeof token === 'undefined' || token == '')token = 'new';

    if(typeof headless === 'boolean')var headless_chromium = headless;
    else var headless_chromium = true;

    if(typeof bot_url === 'string' && (bot_url).trim() != '' && this.isUrl(bot_url))var bot_url = (bot_url).trim();
    else var bot_url = null;

    if(typeof webhook_url === 'string' && (webhook_url).trim() != '' && this.isUrl(webhook_url))var webhook_url = (webhook_url).trim();
    else var webhook_url = null;

    const db_token = this.getDatabaseToken();

    //NEW PUPPETEER
    const browser = await puppeteer.launch({
      headless: headless_chromium,
      ignoreHTTPSErrors: true,
      args: [
        '--enable-sync', '--enable-background-networking', '--no-sandbox', '--disable-setuid-sandbox', '--no-experiments',
        '--disable-gpu', '--renderer', '--no-service-autorun', '--no-experiments',
        '--no-default-browser-check', '--disable-webgl', '--disable-threaded-animation',
        '--disable-threaded-scrolling', '--disable-in-process-stack-traces', '--disable-histogram-customizer',
        '--disable-gl-extensions', '--disable-extensions', '--disable-composited-antialiasing',
        '--disable-canvas-aa', '--disable-3d-apis', '--disable-accelerated-2d-canvas',
        '--disable-accelerated-jpeg-decoding', '--disable-accelerated-mjpeg-decode', '--disable-app-list-dismiss-on-blur',
        '--disable-accelerated-video-decode', '--num-raster-threads=1', '--mute-audio', '--disable-dev-shm-usage'
      ]
    });
    this.browser = browser;

    //CREATE PUPPETEER
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    const pages_created = await browser.pages();

    //CLOSE BLANK PAGE
    pages_created[0].close();
    this.page = pages_created[1];

    this.emit('CONSOLE', 'INIT TOKEN ' + token, true);

    //USER AGENT, EXTRA HEADER, REQUEST INTERCEPTION
    await page.setUserAgent(APP_USER_AGENT);
    await page.setExtraHTTPHeaders({'Accept-Language': APP_LANGUAGE});
    await page.setRequestInterception(true);

    //PUPPETEER CONSOLE
    await page.on('console', msg => {
      for(let arg of msg.args()){
       arg.jsonValue().then(v => console.log(v)).catch(error => console.log(msg));
      }
    });

    //PUPPETEER ERROR
    await page.on('error', msg => console.log(msg));

    //BLOCK RESOURCES TO LOAD FAST
    await page.on('request', request => {
      if([/*'stylesheet', */'image', 'font', 'media'].indexOf(request.resourceType()) !== -1)request.abort();
      else request.continue();
    });

    //TOKEN SESSION
    var data_token_db = db_token.get('token').find({name: token}).value();
    if(typeof data_token_db !== 'undefined' && typeof data_token_db.localstorage !== 'undefined' &&  data_token_db.localstorage != null){
      this.emit('CONSOLE', 'READ SAVED TOKEN', true);
      const data_token = data_token_db.localstorage;

      //INJECT TOKEN SESSION IN WHATSAPP WEB
      if(data_token != ''){
        this.emit('CONSOLE', 'VALIDATING TOKEN', true);
        const session = await JSON.parse(data_token);
        await page.evaluateOnNewDocument(session => {
          localStorage.clear();
          localStorage.setItem("WABrowserId", session.WABrowserId);
          localStorage.setItem("WASecretBundle", session.WASecretBundle);
          localStorage.setItem("WAToken1", session.WAToken1);
          localStorage.setItem("WAToken2", session.WAToken2);
        }, session);
      }
    }else this.emit('CONSOLE', 'CREATE NEW TOKEN', true);

    //GOTO URL
    this.emit('CONSOLE', 'EVALUATING', true);
    await page.goto(APP_URI, {waitUntil: "networkidle2", timeout: 9000});

    //VALID INJECT TOKEN SESSION
    try{
      await page.waitForSelector(APP_QR_VALUE_SELECTOR, {timeout: 3500});
      const qr_code = await page.evaluate(`document.querySelector("` + APP_QR_VALUE_SELECTOR + `").getAttribute("data-ref")`);
      if(typeof qr_code === 'undefined' || qr_code === null){
        this.emit('CONSOLE', 'NO TOKEN SELECTOR EXISTS', false);
        this.emit('API', {action: 'error', value: 'No token whatsapp selector', data: null, status: false});
        this.page.close();
      }else{
        this.emit('TOKEN', qr_code);
        var qr_base64 = yaqrcode(qr_code, {size: 300});
        this.emit('API', {action: 'token', value: 'Scan token', data: qr_base64, status: true});
      }
    }catch(e){/*console.log(e);*/}

    //EVALUATE INJECTED TOKEN SESSION
    this.emit('CONSOLE', 'WAITING TOKEN', true);
    const is_token = await page.waitForSelector(APP_KEEP_PHONE_CONNECTED_SELECTOR, {timeout: 30000}).then(res => {
      this.emit('CONSOLE', 'VALID TOKEN', true);
      return true;
    }).catch(e => {
      db_token.get('token').find({name: token}).assign({localstorage: null, endpoint: null, bot_url: null, webhook_url: null}).write();
      this.emit('CONSOLE', 'INVALID TOKEN', false);
      this.emit('API', {action: 'error', value: 'Invalid token', data: null, status: false});
      this.browser.close();
      return false;
    })

    if(is_token === true){

      this.emit('CONSOLE', 'INJECTING', true);

      //SAVE TOKEN LOCALSTORAGE TO JSON
      await page.evaluate(res => JSON.stringify(window.localStorage)).then(localStorage => {
        this.emit('CONSOLE', 'TOKEN SAVED', true);
        db_token.get('token').remove({name: token}).write();
        db_token.get('token').push({name: token, endpoint: null, localstorage: localStorage, bot_url: bot_url, webhook_url: webhook_url}).write();
      });

      //ADD MODULERAID - INJECT
      await page.evaluate(WindowStore, moduleRaid.toString());

      //CHECK INJECTION
      const store_def = await page.waitForFunction('window.Store.Msg !== undefined')
      .then(e => {
        this.emit('CONSOLE', 'INJECTED', true);
        return true;
      }).catch(e => {
        this.emit('CONSOLE', 'NOT INJECTED', false);
        this.emit('API', {action: 'error', value: 'Imposible start whatsapp', data: null, status: false});
        return false;
      });

      await page.evaluate(WindowUtils);
      await page.evaluate(() => window.Store.Conn.serialize())
      .then(get_me => {
        var time = (Date.now() - time_start)/1000;
        this.emit('CONSOLE', 'WHATSAPP LOADED IN ' + time + ' SEC', true);
      });

      //ENDPOINT
      const bw_endpoint = await browser.wsEndpoint();
      const ws_endpoint = await this.setWebSocket(bw_endpoint, token);
      this.emit('CONSOLE', 'ENDPOINT ' + ws_endpoint, true);
      db_token.get('token').find({name: token}).assign({endpoint: ws_endpoint}).write();

      //REGISTER EVENTS
      await page.exposeFunction('onAddMessage', message => this.emit('MESSAGE', message));

      await page.exposeFunction('onAddMedia', message => this.emit('MEDIA', message));

      //ADD MESSAGES EVENT
      this.emit('CONSOLE', 'READING MESSAGES', true);
      await page.evaluate((token) => {
        setTimeout(() => {
          window.Store.Msg.on('add', (new_message) => {
            if(typeof new_message.isNewMsg === 'undefined')return;
            var message = new_message.serialize();
            if(message.isNewMsg == false || message.id.fromMe == true || message.id.remote == 'status@broadcast')return;
            message.apiToken = token;
            if(message.type == 'chat')onAddMessage(message);
            else onAddMedia(message);
            return;
          });
        }, 4500);
      }, token);

      setTimeout(() => {
        this.getMe(page).then(me => {
          var end_time =  (Date.now() - time_start)/1000;
          var value = 'WhatsApp ready in ' + end_time + ' sec.';
          this.emit('CONSOLE', value, true);
          this.emit('API', {action: 'ready', value: value, data: me, status: true});
        });
      }, 2500);

    }else{
      await browser.close();
    }
  }

  responseBot(message, WhatsApp){
    new Promise((resolve, reject) => {
      var time = new Date();
      if(typeof message === 'object' && typeof message.apiToken !== 'undefined' && typeof message.from !== 'undefined'){
        console.log(message);
        const token = message.apiToken;
        const WhatsAppDB = WhatsApp.getDatabaseToken();
        const data_token = WhatsAppDB.get('token').find({name: token}).value();

        if(typeof data_token === 'undefined' || typeof data_token.endpoint === 'undefined'){
          console.log({response: 'Not defined token', status: false});
          return false;
        }else{
          if(typeof data_token.bot_url !== 'undefined' && data_token.bot_url != null){
            console.log(data_token.endpoint);

            WhatsApp.getWebSocketPage(data_token.endpoint).then(json_page => {
              if(typeof json_page === 'object'){
                var page = json_page.page;
                var browser = json_page.browser;
                if(page != null){
                  var bot_url = data_token.bot_url;
                  console.log(bot_url);
                  var from = message.from;
                  var send = {
                    method: 'post',
                    body: JSON.stringify({token: token, message: message.body, data: JSON.stringify(message)}),
                    headers: {'Content-Type': 'application/json'}
                  };

                  fetch(bot_url, send).then(res => res.json()).then(parsed => {
                    if(typeof parsed === 'object' && parsed.status == true && typeof parsed.message !== 'undefined'){
                      var bot_message = parsed.message;
                      console.log('sendMessage');
                      console.log(token);
                      console.log(from);
                      console.log(bot_message);
                      WhatsApp.sendMessage(page, from, bot_message);
                      //WhatsApp.sendMediaToID(from, parsed.caption, parsed.base64, parsed.filename);
                    }
                  })
                }
              }
            })
          }
        }
      }
    })
  }

  isUrl(url){
    var regex = new RegExp("^(http[s]?:\\/\\/(www\\.)?|ftp:\\/\\/(www\\.)?|www\\.){1}([0-9A-Za-z-\\.@:%_\+~#=]+)+((\\.[a-zA-Z]{2,3})+)(/(.)*)?(\\?(.)*)?");
    if(regex.test(url))return true;
    else return false;
  }

  getDatabaseToken(){
    var low = require('lowdb');
    var FileSync = require('lowdb/adapters/FileSync');
    var adapter = new FileSync('dbTokenWhatsApp.json');
    var db = low(adapter);
    db.defaults({token: []}).write();
    return db;
  }

  async setWebSocket(ws_endpoint, token){
    var port = await getFreePorts(1, APP_HOST).then(res => res[0]);
    const is_open = await isFreePort(port, APP_HOST).then(open => open[2]);
    if(is_open){
      await httpProxy.createServer({target: ws_endpoint, ws: true, localAddress: APP_HOST}).listen(port);
    }
    return 'ws://' + APP_HOST + ':' + port;
  }

  async getWebSocketPage(ws_url){
    try{
      const browser = await puppeteer.connect({browserWSEndpoint: ws_url, ignoreHTTPSErrors: true});
      const pages_created = await browser.pages();
      return {browser: browser, page: pages_created[0]}
    }catch(e){
      return null;
    }
  }

  //CHECKED - DEPEND App
  async sendMessageToID(page, id, message){
    return await page.evaluate((id, message) => {
      try{
        window.App.sendSeen(id);
        const get_id = window.Store.Chat.get(id);
        console.log(typeof message);
        if(typeof message === 'string' && message != ''){
          window.App.sendMessage(get_id, message);
          return {number: id, status: true};
        }else if(Array.isArray(message) && message.length > 0){
          message.forEach((data_message) => {
            if(typeof data_message === 'string' && data_message != ''){
              window.App.sendMessage(get_id, data_message);
            }
          });
          return true;
        }
      }catch(e){/*console.log(e)*/}
      return false;
    }, id, message)
  }

  //CHECKED
  async getMe(page){
    return await page.evaluate(() => {
      try{return window.Store.Conn.serialize();}
      catch(e){/*console.log(e)*/};
      return {};
    })
  }

  //CHECKED
  async getContact(page, id){
    return await page.evaluate((id) => {
      try{
        if(typeof id === 'undefined' || id == '')return window.Store.Contact.serialize();
        else return window.Store.Contact.get(id).serialize();
      }catch(e){/*console.log(e)*/};
      return {};
    }, id)
  }

  //CHECKED
  async getProfilePicThumb(page, id){
    return await page.evaluate((id) => {
      try{
        if(typeof id === 'undefined' || id == '')return window.Store.ProfilePicThumb.serialize();
        else return window.Store.ProfilePicThumb.get(id).serialize();
      }catch(e){/*console.log(e)*/};
      return {};
    }, id)
  }

  //CHECKED
  async getChat(page, id){
    return await page.evaluate((id) => {
      try{
        if(typeof id === 'undefined' || id == '')return window.Store.Chat.serialize();
        else return window.Store.Chat.get(id).serialize();
      }catch(e){/*console.log(e)*/};
      return {};
    }, id)
  }

  async getChatUnread(page){
    return await page.evaluate(() => {
      try{
        var chats = window.Store.Chat.serialize();
        if(typeof chats === 'object' && chats.length > 0){
          var chats_unread = [];
          chats.forEach((chat) => {
            if(typeof  chat.unreadCount !== 'undefined'){
              var number = chat.id._serialized;
              var unread = chat.unreadCount;
              if(unread > 0){
                chats_unread.push({number: number, unread: unread});
              }
            }
          });
          return chats_unread;
        }
      }catch(e){/*console.log(e)*/};
      return [];
    })
  }

  //CHECKED
  async loadEarlierMsgstById(page, id){
    return await page.evaluate((id) => {
      if(id != ''){
        try{
          window.Store.Chat.get(id).loadEarlierMsgs();
          return true;
        }catch(e){/*console.log(e)*/}
      }
      return false;
    }, id)
  }

  //CHECKED
  async setContactSeen(page, id){
    return await page.evaluate((id) => {
      if(id != ''){
        try{
          window.App.sendSeen(id);
          return true;
        }catch(e){/*console.log(e)*/};
      }
      return false;
    }, id)
  }

  //CHECKED
  async setLogout(page){
    return await page.evaluate(() => {
      try{
        window.Store.tag.sendCurrentLogout();
        window.Store.tag.logout();
        return true;
      }catch(e){/*console.log(e)*/};
      return false;
    })
  }

  async sendMessage(page, id, message){
    if(typeof id === 'string' && id != '')var id = [id];
    if(typeof id === 'object' && id.length > 0){
      var time = 0;
      id.forEach((from) => {
        new Promise((resolve, reject) => {
          setTimeout(() => {
            this.sendMessageToID(page, from, message);
          }, time);
          time += 1633;
        });
      })
      return id.length;
    }
  }

  async setDestroy(browser, page, token){
    try{
      var is_live = await page.evaluate((token) => {
        var ls = JSON.parse(JSON.stringify(window.localStorage));
        if(typeof ls['last-wid'] === 'undefined'){
          console.log('DESTROY ' + token);
          return true;
        }else return false;
      }, token);
      if(is_live){
        console.log('CLOSE PUPPETER');
        await browser.close();
      }
    }catch(e){console.log(e)}
  }

  //CHECKED
  async getNavigatorStorage(page){
    return await page.evaluate(() => {
      try{
        return navigator.storage.estimate();
      }catch(e){/*console.log(e)*/}
      return {};
    })
  }

  async startWebService(port, headless){
    if(typeof port === 'number'){
      const is_open = await isFreePort(port, APP_HOST).then(open => open[2]);
      if(is_open){
        const express = require('express');
        const bodyParser = require('body-parser');
        const cors = require('cors');
        const helmet = require('helmet');
        const http = require('http');
        const ws = express();
        const server = http.createServer(ws);
        ws.use(cors());
        ws.use(bodyParser.json());
        ws.use(bodyParser.urlencoded({extended: true}));
        ws.use(helmet());

        server.listen(port, () => {
          var data_address = server.address();
          console.log('START WEB SERVICE ON ' + data_address.address + data_address.port);
        });

        ws.post('/', (req, res) => {
          var json = {}
          const token = (req.body.token).trim();
          const action = (req.body.action).trim();

          if(token == '')res.json({response: 'Not allowed empty token', status: true});
          else if(action == '')res.json({response: 'Not allowed empty action', status: true});
          else{
            const WhatsApp = this;
            if(action == 'start'){

              if(typeof req.body.bot_url === 'string' && (req.body.bot_url).trim() != '' && WhatsApp.isUrl(req.body.bot_url))var bot_url = (req.body.bot_url).trim();
              else var bot_url = '';

              if(typeof req.body.webhook_url === 'string' && (req.body.webhook_url).trim() != '' && WhatsApp.isUrl(req.body.webhook_url))var webhook_url = (req.body.webhook_url).trim();
              else var webhook_url = '';

              WhatsApp.start(token, headless, bot_url, webhook_url);

              WhatsApp.on('API', json => {
                try{res.json(json)}
                catch(e){/*console.log(e);*/}
              });

            }else{
              const WhatsAppDB = WhatsApp.getDatabaseToken();
              const data_token = WhatsAppDB.get('token').find({name: token}).value();

              if(typeof data_token === 'undefined' || typeof data_token.endpoint === 'undefined'){
                res.json({response: 'Not defined token', status: false});
              }else{
                const number = req.body.number;
                const message = req.body.message;

                WhatsApp.getWebSocketPage(data_token.endpoint).then(json_page => {
                  var page = json_page.page;
                  var browser = json_page.browser;
                  if(page != null){
                    switch(action){
                      case 'me':
                        WhatsApp.getMe(page).then(response => res.json(response));
                      break;
                      case 'contact':
                        WhatsApp.getContact(page, number).then(response => res.json(response));
                      break;
                      case 'avatar':
                        WhatsApp.getProfilePicThumb(page, number).then(response => res.json(response));
                      break;
                      case 'chat':
                        WhatsApp.getChat(page).then(response => res.json(response));
                      break;
                      case 'unread':
                        WhatsApp.getChatUnread(page).then(response => res.json(response));
                      break;
                      case 'seen':
                        WhatsApp.setContactSeen(page, number).then(response => res.json(response));
                      break;
                      case 'message':
                        WhatsApp.sendMessage(page, number, message).then(response => res.json(response));
                      break;
                      case 'logout':
                        WhatsApp.setLogout(page).then(response => {
                          setTimeout(() => {
                            if(typeof browser !== null && typeof token !== 'undefined'){
                              WhatsAppDB.get('token').find({name: token}).assign({localstorage: null, endpoint: null, bot_url: null, webhook_url: null}).write();
                              WhatsApp.setDestroy(browser, page, token, port);
                            }
                          }, 1500);
                          res.json(response);
                        });
                      break;
                      //REVIEW
                      case 'getNavigatorStorage':
                        WhatsApp.getNavigatorStorage(page).then(response => res.json(response));
                      break;
                      case 'loadEarlierMsgstById':
                        WhatsApp.loadEarlierMsgstById(page, person).then(response => res.json(response));
                      break;
                      default:
                        res.json({response: 'Action not available: ' + action, status: false});
                      break;
                    }
                  }
                });
              }
            }
          }
        });
      }else{
        console.log('ALREADY LISTEN ON ' + APP_HOST + ':' + port);
      }
    }
  }
}

module.exports = PuppeteerWhatsApp;
