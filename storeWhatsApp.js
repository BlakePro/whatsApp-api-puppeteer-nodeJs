'use strict';
//https://github.com/pedroslopez/whatsapp-web.js/blob/master/src/util/Injected.js
/*
  Modified
    -ADD TAG MODULE - 27 MAR - 2020

*/
// Exposes the internal Store to the WhatsApp Web client
exports.WindowStore = (moduleRaidStr) => {
  eval('var moduleRaid = ' + moduleRaidStr);
  // eslint-disable-next-line no-undef
  window.mR = moduleRaid();
  window.Store = window.mR.findModule('Chat')[1].default;
  window.Store.AppState = window.mR.findModule('STREAM')[0].default;
  window.Store.Conn = window.mR.findModule('Conn')[0].default;
  window.Store.CryptoLib = window.mR.findModule('decryptE2EMedia')[0];
  window.Store.Wap = window.mR.findModule('Wap')[0].default;
  window.Store.SendSeen = window.mR.findModule('sendSeen')[0];
  window.Store.SendClear = window.mR.findModule('sendClear')[0];
  window.Store.SendDelete = window.mR.findModule('sendDelete')[0];
  window.Store.genId = window.mR.findModule((module) => module.default && typeof module.default === 'function' && module.default.toString().match(/crypto/))[0].default;
  window.Store.SendMessage = window.mR.findModule('addAndSendMsgToChat')[0];
  window.Store.MsgKey = window.mR.findModule((module) => module.default && module.default.fromString)[0].default;
  window.Store.Invite = window.mR.findModule('sendJoinGroupViaInvite')[0];
  window.Store.OpaqueData = window.mR.findModule('getOrCreateOpaqueDataForPath')[0];
  window.Store.MediaPrep = window.mR.findModule('MediaPrep')[0];
  window.Store.MediaObject = window.mR.findModule('getOrCreateMediaObject')[0];
  window.Store.MediaUpload = window.mR.findModule('uploadMedia')[0];
  window.Store.Cmd = window.mR.findModule('Cmd')[0].default;
  window.Store.tag = window.mR.findModule('tag')[0].default;
  window.Store.MediaTypes = window.mR.findModule('msgToMediaType')[0];
  window.Store.UserConstructor = window.mR.findModule((module) => (module.default && module.default.prototype && module.default.prototype.isServer && module.default.prototype.isUser) ? module.default : null)[0].default;
  window.Store.Validators = window.mR.findModule('findLinks')[0];
  window.Store.Sticker = window.mR.findModule('Sticker')[0];
  window.Store.UploadUtils = window.mR.findModule('UploadUtils')[0];
  window.Store.WidFactory = window.mR.findModule('createWid')[0];
};

exports.WindowUtils = () => {
  window.App = {};
  window.App.getNumberId = async (id) => {
    let result = await window.Store.Wap.queryExist(id);
    if(result.jid === undefined)
      throw 'The number provided is not a registered whatsapp user';
    return result.jid;
  };

  window.App.syncContacts = async () => {
    await window.Store.Contact.sync()
    return true;
  }

  window.App.sendSeen = async (chatId) => {
    let chat = window.Store.Chat.get(chatId);
    if(chat !== undefined){
      await window.Store.SendSeen.sendSeen(chat, false);
      return true;
    }
    return false;
  };

  window.App.sendMessage = async (chat, content, options = {}) => {
    if(chat.id === 'status@broadcast') return false;
    var is_sticker = false;
    if (typeof options.type !== 'undefined')var type = options.type
    else var type = 'chat'

    let locationOptions = {};
    if (typeof options.location !== 'undefined') {
      locationOptions = {
        type: 'location',
        loc: options.location.name,
        lat: options.location.latitude,
        lng: options.location.longitude
      };
      delete options.location;
    }

    let attOptions = {};
    if (typeof options.attachment !== 'undefined') {
      //atob(decodeURIComponent(dataToBeDecoded));
      var arr_attachment = (options.attachment).split(',')
      var attachment = decodeURIComponent(arr_attachment[1]);
      var mimetype = (arr_attachment[0]).replace('data:', '');
      mimetype = mimetype.replace(';base64', '');

      if (options.caption)var filename = options.caption;
      else var filename = 'file';

      var att = {
        data: attachment,
        mimetype: mimetype,
        filename: filename
      }
      //console.log(mimetype);

      if(mimetype == 'image/webp'){
        att.type = 'sticker';
        delete options.filename;
        delete att.filename;
        is_sticker = true;
      }

      attOptions = await window.App.processMediaData(att, options.sendAudioAsVoice);
      delete options.attachment;
    }

    let quotedMsgOptions = {};
    if (typeof options.quoted !== 'undefined') {
      let quotedMessage = window.Store.Msg.get(options.quoted);
      if(quotedMessage.canReply()){
        quotedMsgOptions = quotedMessage.msgContextInfo(chat);
      }
      delete options.quoted;
    }

    if (options.mentionedJidList) {
      options.mentionedJidList = options.mentionedJidList.map(cId => window.Store.Contact.get(cId).id);
    }

    if (typeof options.preview !== 'undefined') {
      delete options.preview;
      var content = options.content;
      if(content != ''){
        if(options.content)delete options.content;
        const link = window.Store.Validators.findLink(content);
        if(link){
          const preview = await window.Store.Wap.queryLinkPreview(link.url);
          preview.preview = true;
          preview.subtype = 'url';
          options = { ...options, ...preview };
        }
      }
    }

    const newMsgId = new window.Store.MsgKey({
        from: window.Store.Conn.me,
        to: chat.id,
        id: window.Store.genId(),
    });

    const message = {
        ...options,
        id: newMsgId,
        ack: 0,
        body: content,
        from: window.Store.Conn.me,
        to: chat.id,
        local: true,
        self: 'out',
        t: parseInt(new Date().getTime() / 1000),
        isNewMsg: true,
        type: type,
        ...locationOptions,
        ...attOptions,
        ...quotedMsgOptions
    };
    if(is_sticker){
      if(message.body)delete message.body;
      if(message.caption)delete message.caption;
      if(message.type)message.type = 'sticker';
      if(message.mimetype)message.mimetype = 'image/webp';
    }
    //console.log(message)
    await window.Store.SendMessage.addAndSendMsgToChat(chat, message);
    return window.Store.Msg.get(newMsgId._serialized);
  };

  window.App.processMediaData = async (mediaInfo, forceVoice) => {
    const file = window.App.mediaInfoToFile(mediaInfo);
    const mData = await window.Store.OpaqueData.default.createFromData(file, file.type);
    const mediaPrep = window.Store.MediaPrep.prepRawMedia(mData, {});
    const mediaData = await mediaPrep.waitForPrep();
    const mediaObject = window.Store.MediaObject.getOrCreateMediaObject(mediaData.filehash);

    const mediaType = window.Store.MediaTypes.msgToMediaType({
        type: mediaData.type,
        isGif: mediaData.isGif
    });

    if (forceVoice && mediaData.type === 'audio') {
      mediaData.type = 'ptt';
    }

    if (!(mediaData.mediaBlob instanceof window.Store.OpaqueData.default)) {
      mediaData.mediaBlob = await window.Store.OpaqueData.default.createFromData(mediaData.mediaBlob, mediaData.mediaBlob.type);
    }

    mediaData.renderableUrl = mediaData.mediaBlob.url();
    mediaObject.consolidate(mediaData.toJSON());
    mediaData.mediaBlob.autorelease();

    const uploadedMedia = await window.Store.MediaUpload.uploadMedia({
      mimetype: mediaData.mimetype,
      mediaObject,
      mediaType
    });

    const mediaEntry = uploadedMedia.mediaEntry;
    if (!mediaEntry) {
      throw new Error('upload failed: media entry was not created');
    }

    mediaData.set({
      clientUrl: mediaEntry.mmsUrl,
      directPath: mediaEntry.directPath,
      mediaKey: mediaEntry.mediaKey,
      mediaKeyTimestamp: mediaEntry.mediaKeyTimestamp,
      filehash: mediaObject.filehash,
      uploadhash: mediaEntry.uploadHash,
      size: mediaObject.size,
      streamingSidecar: mediaEntry.sidecar,
      firstFrameSidecar: mediaEntry.firstFrameSidecar
    });

    return mediaData;
  };

  window.App.getChatModel = chat => {
    let res = chat.serialize();
    res.isGroup = chat.isGroup;
    res.formattedTitle = chat.formattedTitle;

    if(chat.groupMetadata){
      res.groupMetadata = chat.groupMetadata.serialize();
    }

    return res;
  };

  window.App.getChat = chatId => {
    const chat = window.Store.Chat.get(chatId);
    return window.App.getChatModel(chat);
  };

  window.App.getChats = () => {
    const chats = window.Store.Chat.models;
    return chats.map(chat => window.App.getChatModel(chat));
  };

  window.App.getContactModel = contact => {
    let res = contact.serialize();
    res.isBusiness = contact.isBusiness;

    if(contact.businessProfile){
      res.businessProfile = contact.businessProfile.serialize();
    }

    res.isMe = contact.isMe;
    res.isUser = contact.isUser;
    res.isGroup = contact.isGroup;
    res.isWAContact = contact.isWAContact;
    res.isMyContact = contact.isMyContact;
    res.userid = contact.userid;

    return res;
  };

  window.App.getContact = contactId => {
    const contact = window.Store.Contact.get(contactId);
    return window.App.getContactModel(contact);
  };

  window.App.getContacts = () => {
    const contacts = window.Store.Contact.models;
    return contacts.map(contact => window.App.getContactModel(contact));
  };

  window.App.mediaInfoToFile = ({ data, mimetype, filename }) => {
    const binaryData = atob(data);
    const buffer = new ArrayBuffer(binaryData.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binaryData.length; i++){
      view[i] = binaryData.charCodeAt(i);
    }
    const blob = new Blob([buffer], { type: mimetype });
    return new File([blob], filename, {
      type: mimetype,
      lastModified: Date.now()
    });
  };

  window.App.downloadBuffer = (url) => {
    return new Promise(function (resolve, reject){
      let xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.responseType = 'arraybuffer';
      xhr.onload = function(){
        if(xhr.status == 200){
          resolve(xhr.response);
        }else{
          reject({
            status: this.status,
            statusText: xhr.statusText
          });
        }
      };
      xhr.onerror = function(){
        reject({
          status: this.status,
          statusText: xhr.statusText
        });
      };
      xhr.send(null);
    });
  };

  window.App.readBlobAsync = (blob) => {
    return new Promise((resolve, reject) => {
      let reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  window.App.sendClearChat = async (chatId) => {
    let chat = window.Store.Chat.get(chatId);
    if(chat !== undefined){
      await window.Store.SendClear.sendClear(chat, false);
      return true;
    }
    return false;
  };

  window.App.sendDeleteChat = async (chatId) => {
    let chat = window.Store.Chat.get(chatId);
    if(chat !== undefined){
      await window.Store.SendDelete.sendDelete(chat);
      return true;
    }
    return false;
  };

  window.App.sendChatstate = async (state, chatId) => {
    switch(state){
    case 'typing':
      await window.Store.Wap.sendChatstateComposing(chatId);
    break;
    case 'recording':
      await window.Store.Wap.sendChatstateRecording(chatId);
    break;
    case 'stop':
      await window.Store.Wap.sendChatstatePaused(chatId);
      break;
    default:
      throw 'Invalid chatstate';
    }
    return true;
  };
};
