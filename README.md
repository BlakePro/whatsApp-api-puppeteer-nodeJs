#Unofficial API for WhatsApp + BOT

## Table of Contents
* **[Start](#start)**
  - [Install Dependencies](#dependencies)
  - [Run Webservice](#run)
  - [Run Webservice (background mode)](#runbackground)
* **[Install from scratch](#scratch)**
  - [Install Git](#git)
  - [Install Latest Node](#node)
  - [Install Utilities (Puppeteer)](#utilities)
  - [Clone GitHub Repo](#clone)

<a name="start"></a>
## Start

<a name="dependencies"></a>
**Install Dependencies**
```sh
sudo npm i
```

**Run Webservice**
```sh
npm test PORT=80 HEADLESS=false
```

**Run Webservice (background mode)**
```sh
npm start PORT=80 HEADLESS=false
```

<a name="scratch"></a>
## Install from scratch

<a name="git"></a>
**1. Install Git**
```sh
sudo apt-get install git
```

<a name="node"></a>
**2. Install Latest Node**
[https://github.com/nodesource/distributions](Node Distribution)
```sh
curl -sL https://deb.nodesource.com/setup_current.x | sudo -E bash -
sudo apt-get install -y nodejs
```

<a name="utilities"></a>
**3. Install Utilities (Puppeteer)**
```sh
sudo apt-get install gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

<a name="clone"></a>
**4. Clone GitHub Repo**
```sh
git clone
```

**NOTE:** I can't guarantee you will not be blocked by using this method, although it has worked for me. WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe.
