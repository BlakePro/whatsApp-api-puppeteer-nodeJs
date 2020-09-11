# Unofficial API for WhatsApp + Bot + Webhook

## Table of Contents
* **[Api](#api)**
  - [Endpoints](#endpoints)
* **[Bot](#bot)**
  - [Endpoints](#bot)
* **[Install & Start](#start)**
  - [Install Dependencies](#dependencies)
  - [Run Webservice](#run)
  - [Run Webservice (background mode)](#runbackground)
* **[Install from scratch](#scratch)**
  - [Install Git](#git)
  - [Install Node](#node)
  - [Install Utilities from Puppeteer](#utilities)
  - [Clone GitHub Repo](#clone)


<a name="api"></a>
## Api
<a name="endpoints"></a>
**Endpoints**
| Endpoint        | Post           |
| -------------   | -------------  |
| stats           | empty          |
| state           | empty          |
| me              | empty          |
| contact         | number: string |
| photo           | number: string |
| chat            | empty          |
| unread          | empty          |
| seen            | number: string **(requiered)** |
| message         | number: string / list <br> message: string / list  |
| media           | number: string <br> message: string   |
| download        | option: json **(requiered)** <br> ```json  {"clientUrl": "", "mimetype": "", "mediaKey": "", "type": ""}```  |
| logout          | empty                               |
| storage         | empty                               |


<a name="start"></a>
## Install & Start

<a name="dependencies"></a>
**Install Dependencies**
```sh
sudo npm i
```

**Run WebService**
```sh
npm test PORT=8333 HEADLESS=false DEBUG=true
```

**Run WebService (background mode)**
```sh
npm start PORT=8333 HEADLESS=false DEBUG=true &
```

**Stop WebService (background mode)**
```sh
ps aux | grep indexWhatsApp.js
kill -9 PID_NUMBER
```

<a name="scratch"></a>
## Install from scratch

<a name="git"></a>
**1. Install Git**
```sh
sudo apt-get install git
```

<a name="node"></a>
**2. Install Node**
[https://github.com/nodesource/distributions] (Node Distribution)
```sh
curl -sL https://deb.nodesource.com/setup_current.x | sudo -E bash -
sudo apt-get install -y nodejs
```

<a name="utilities"></a>
**3. Install Utilities from Puppeteer**
```sh
sudo apt-get install gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

<a name="clone"></a>
**4. Clone GitHub Repo**
```sh
git clone https://github.com/BlakePro/WhatsAppWebApiNodeJS.git
```

**NOTE:** I can't guarantee you will not be blocked by using this method, although it has worked for me. WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe.

## Disclaimer

This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp or any of its subsidiaries or its affiliates. The official WhatsApp website can be found at https://whatsapp.com. "WhatsApp" as well as related names, marks, emblems and images are registered trademarks of their respective owners.
