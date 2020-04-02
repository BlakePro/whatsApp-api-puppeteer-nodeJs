const puppeteerWhatsApp = require('./puppeteerWhatsApp');
const qrcode_terminal = require('qrcode-terminal');

//CREATE WHATSAPP PORT AND HEADLESS (DEBUG) CONFIGURATION
const headless = true;
const port = 8333;

//NEW WHATSAPP PUPPETEER
const WhatsApp = new puppeteerWhatsApp();

//INIT WEB SERVICE
WhatsApp.startWebService(port, headless);

//EVENTS
WhatsApp.on('CONSOLE', (response, status) => {
  console.log(response);
});

WhatsApp.on('TOKEN', qrcode => {
  qrcode_terminal.generate(qrcode, {small: true});
  console.log(qrcode);
});

WhatsApp.on('MESSAGE', (message) => {
  //console.log(message);
  WhatsApp.responseBot(message, WhatsApp);
});

/*
WhatsApp.on('MEDIA', media => {
  console.log(media);
});
*/
