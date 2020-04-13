const puppeteerWhatsApp = require('./puppeteerWhatsApp');

//CREATE WHATSAPP PORT AND HEADLESS (DEBUG) CONFIGURATION
const headless = true;
const port = 8333;

//NEW WHATSAPP PUPPETEER
const WhatsApp = new puppeteerWhatsApp();

//START WEB SERVICE
WhatsApp.startWebService(port, headless);
