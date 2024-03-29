/**
 * KlbChat-Mcp 2.3.7
 * @package     Touch-Chat
 * @subpackage  view.Main
 * @license     http://www.gnu.org/licenses/agpl.html AGPL Version 3
 * @author      Development team ICS Corporation, Denys Zherebyatyev <kolobizok@gmail.com>
 * @copyright   Copyright (c) 2017 ICS GmbH (www.icstime.com)
 *
 */

Ext.ns('Ext.ux', 'Ext.ux.file');

/**
 * upload file record
 */

Ext.define('Ext.ux.file.Upload.file', {
    extend: 'Ext.data.Model',
    fields: [
        {name: 'id', type: 'string', system: true},
        {name: 'uploadKey', type: 'string', system: true},
        {name: 'name', type: 'string', system: true},
        {name: 'partId', system: true},
        {name: 'size', type: 'number', system: true},
        {name: 'type', type: 'string', system: true},
        {name: 'status', type: 'string', system: true},
        {name: 'progress', type: 'number', system: true},
        {name: 'form', system: true},
        {name: 'input', system: true},
        {name: 'request', system: true},
        {name: 'path', system: true},
        {name: 'tempFile', system: true}
    ]
});

Ext.apply("Ext.ux.file.Upload.file", {
    getFileData:function(file) {
        return Ext.copyTo({}, file.data, ['tempFile', 'name', 'path', 'size', 'type','partId']);
    }
});

/**
 * a simple file upload
 * objects of this class represent a single file uplaod
 *
 * @namespace   Ext.ux.file
 * @class       Ext.ux.file.Upload
 * @extends     Ext.ex.util.Observable
 *
 * @constructor
 * @param       Object config
 */
Ext.define('Ext.ux.file.Upload', {
    mixins: ['Ext.mixin.Observable'],

    constructor: function (config) {
        // The Observable constructor copies all of the properties of `config` on
        // to `this` using Ext.apply. Further, the `listeners` property is
        // processed to add listeners.

        Ext.apply(this, config);
        this.mixins.observable.constructor.call(this, config);

        this.on({
                 uploadcomplete: config.uploadcomplete || Ext.emptyFn,
                 uploadfailure:  config.uploadfailure  || Ext.emptyFn,
                 uploadprogress: config.uploadprogress || Ext.emptyFn,
                 uploadstart:    config.uploadstart    || Ext.emptyFn,
                 update:         config.update         || Ext.emptyFn
             });
 

        if (! this.file && this.fileSelector) {
            this.file = this.fileSelector.getFileList()[0];
        }

        this.fileSize = (this.file.size ? this.file.size : this.file.fileSize);

        this.maxChunkSize = this.maxPostSize - 16384;
        this.currentChunkSize = this.maxChunkSize;

        this.tempFiles = [];
    },

    /**
     * @cfg {Int} maxFileUploadSize the maximum file size for traditinal form updoads
     */
    maxFileUploadSize: 209715200, // 2 MB
    /**
     * @cfg {Int} maxPostSize the maximum post size used for html5 uploads
     */
    maxPostSize: 2097152, // 2 MB
    /**
     * @property maxChunkSize the maximum chunk size used for html5 uploads
     * @type Int
     */
    maxChunkSize: 102400,
    
    /**
     * @cfg {Int} minChunkSize the minimal chunk size used for html5 uploads
     */
    minChunkSize: 12400,

    /**
     *  max number of upload retries
     */
    MAX_RETRY_COUNT: 20,

    /**
     *  retry timeout in milliseconds
     */
    RETRY_TIMEOUT_MILLIS: 3000,

    /**
     *  retry timeout in milliseconds
     */
    CHUNK_TIMEOUT_MILLIS: 100,

    /**
     * @cfg {String} url the url we upload to
     */
    url: '/',

    /**
     * @cfg {Ext.ux.file.BrowsePlugin} fileSelector
     * a file selector
     */
    fileSelector: null,

    /**
     * coresponding file record
     */
    fileRecord: null,

    /**
     * currentChunk to upload
     */
    currentChunk: null,

    /**
     * uploadPath
     */
    uploadPath: '/',

    /**
     * file to upload
     */
    file: null,

    /**
     * is this upload paused
     */
    paused: false,

    /**
     * is this upload queued
     */
    queued: false,

    /**
     * collected tempforary files
     */
    tempFiles: new Array(),

    /**
     * did the last chunk upload fail
     */
    lastChunkUploadFailed: false,

    /**
     * current chunk to upload
     */
    currentChunk: null,

    /**
     * how many retries were made while trying to upload current chunk
     */
    retryCount: 0,

    /**
     * size of the current chunk
     */
    currentChunkSize: 0,

    /**
     * where the chunk begins in file (byte number)
     */
    currentChunkPosition: 0,

    /**
     * size of the file to upload
     */
    fileSize: 0,

    /**
     * creates a form where the upload takes place in
     * @private
     */
    createForm: function() {

        var form = Ext.getBody().createChild({
            tag:'form',  
            enctype: 'multipart/form-data',
            action: this.url,
            method: 'post',
            cls: 'x-hidden',
            id: Ext.id(),
            cn:[{
                tag: 'input',
                type: 'hidden',
                name: 'MAX_FILE_SIZE',
                value: this.maxFileUploadSize
            }]
        });
        return form;
    },

    /**
     * perform the upload
     *
     * @return {Ext.Record} Ext.ux.file.Upload.file
     */
    upload: function() {
        if ((
                (! Ext.isGecko && window.XMLHttpRequest && window.File && window.FileList) || // safari, chrome, ...?
                (Ext.isGecko && window.FileReader) // FF
        ) && this.file) {

            // free browse plugin
            this.getInput();

            if (this.isHtml5ChunkedUpload()) {

                // calculate optimal maxChunkSize
                // TODO: own method for chunked upload
                var chunkMax = this.maxChunkSize,
                    chunkMin = this.minChunkSize,
                    actualChunkSize = this.maxChunkSize;

                if(this.fileSize >  chunkMax) {
                    actualChunkSize = chunkMax;
                }
                else {
                    actualChunkSize = Math.max(chunkMin, Math.round(this.fileSize / 5) );
                }
                this.maxChunkSize = actualChunkSize;
 
                if(Klb.system.uploadManager && Klb.system.uploadManager.isBusy()) {
 
                    this.createFileRecord(true);
                    this.setQueued(true);
                }
                else {
                  
                    this.createFileRecord(false);
                    this.fireEvent('uploadstart', this);
                    this.fireEvent('update', 'uploadstart', this, this.fileRecord);
                    this.html5ChunkedUpload();
                }

                return this.fileRecord;

            } else {
                
 
                this.createFileRecord(false);
                this.fireEvent('uploadstart', this);
                this.fireEvent('update', 'uploadstart', this, this.fileRecord);
                this.html5upload();

                return this.fileRecord;
            }
        } else {
           
            return this.html4upload();
        }

    },

    /**
     * 2010-01-26 Current Browsers implemetation state of:
     *  http://www.w3.org/TR/FileAPI
     *
     *  Interface: File | Blob | FileReader | FileReaderSync | FileError
     *  FF       : yes  | no   | no         | no             | no
     *  safari   : yes  | no   | no         | no             | no
     *  chrome   : yes  | no   | no         | no             | no
     *
     *  => no json rpc style upload possible
     *  => no chunked uploads posible
     *
     *  But all of them implement XMLHttpRequest Level 2:
     *   http://www.w3.org/TR/XMLHttpRequest2/
     *  => the only way of uploading is using the XMLHttpRequest Level 2.
     */
    html5upload: function() {
 
        // TODO: move to upload method / checks max post size
        if(this.maxPostSize/1 < this.file.size/1 && !this.isHtml5ChunkedUpload()) {
            this.fileRecord.html5upload = true;
            this.onUploadFail(null, this.fileRecord, null);
            return this.fileRecord;
        }
 
        var defaultHeaders = {
            "Content-Type"      : "application/octet-stream",
            "X-Im-Request-Type" : "HTTP",
            "X-Requested-With"  : "XMLHttpRequest"
        };

        var xmlData = this.file;

        if(this.isHtml5ChunkedUpload()) {
            xmlData = this.currentChunk;
        }

        var conn = new Ext.data.Connection({
            url:   Ext.String.urlAppend(this.url, '&method=Im.upload'),
            timeout: 300000, // 5 mins
            defaultHeaders: defaultHeaders
        });
    
        var transaction = conn.request({
            headers: {
                "X-File-Name" : CryptoJS.enc.Base64.stringify( CryptoJS.enc.Utf8.parse(this.fileRecord.get('name')) ),  
                "X-File-Type" : this.fileRecord.get('type'),
                "X-File-Id"   : this.fileRecord.get('id'),
                "X-File-Size" : this.fileRecord.get('size')
            },
            xmlData: xmlData,
            success: this.onUploadSuccess,
            failure: this.onUploadFail,
            scope: this
        });
 
        return this.fileRecord;
    },

    /**
     * Starting chunked file upload
     *
     * @param {Boolean} whether this restarts a paused upload
     */
    html5ChunkedUpload: function() {
        this.prepareChunk();
        this.html5upload();
    },

    /**
     * resume this upload
     */
    resumeUpload: function() {
        this.setPaused(false);
        this.html5ChunkedUpload();
    },

    /**
     * calculation the next chunk size and slicing file
     */
    prepareChunk: function() {

        if(this.lastChunkUploadFailed) {
            this.currentChunkPosition = Math.max(0
                    , this.currentChunkPosition - this.currentChunkSize);

            this.currentChunkSize = Math.max(this.minChunkSize, this.currentChunkSize / 2);
        }
        else {
            this.currentChunkSize = Math.min(this.maxChunkSize, this.currentChunkSize * 2);
        }
        this.lastChunkUploadFailed = false;

        var nextChunkPosition = Math.min(this.fileSize, this.currentChunkPosition
                +  this.currentChunkSize);
        var newChunk = this.sliceFile(this.file, this.currentChunkPosition, nextChunkPosition);

        if(nextChunkPosition/1 == this.fileSize/1) {
            this.lastChunk = true;
        }

        this.currentChunkPosition = nextChunkPosition;
        this.currentChunk = newChunk;

    },

    /**
     * Setting final fileRecord states
     */
    finishUploadRecord: function(response) {
        try {
            var xmlroot = Klb.system.Im.str2xml(response.responseText);
            var responseObj = {};
            if ( xmlroot && xmlroot.thread.iq.uploaded ) {
                responseObj = xmlroot.thread.iq.uploaded.attributes;
                response.error = responseObj.error;
            } else {
                response.error = 1;
            }
        }
        catch(e) {
            console.log('finish Fail');
            return this.onUploadFail(null, this.fileRecord, null);
        }

        if(response.error == 0) {
            this.fileRecord.beginEdit();
            this.fileRecord.set('size',   responseObj.size);
            this.fileRecord.set('partId', responseObj.id);
            this.fileRecord.set('progress', 99);
            this.fileRecord.set('tempFile', '');
            this.fileRecord.commit(false);
            
            this.fireEvent('uploadcomplete', this, this.fileRecord);
            this.fireEvent('update', 'uploadcomplete', this, this.fileRecord);
        }
        else {
            this.fileRecord.beginEdit();
            this.fileRecord.set('status', 'failure');
            this.fileRecord.set('progress', -1);
            this.fileRecord.set('tempFile', '');
            this.fileRecord.commit(false);
            this.fireEvent('update', 'uploadfailure', this, this.fileRecord);
        }
    },


    /**
     * executed if a chunk or file got uploaded successfully
     */
    onUploadSuccess: function(response, fileRecord, options) {

        try {
            // var responseObj = Ext.util.JSON.decode(response.responseText);
            var xmlroot = Klb.system.Im.str2xml(response.responseText);
            var responseObj = {};
            if ( xmlroot && xmlroot.thread.iq.upload )
                 responseObj = xmlroot.thread.iq.upload.attributes;
        }
        catch(e) {
            console.log('Upload Fail');
            return this.onUploadFail(responseObj, options, fileRecord);
        }

        this.retryCount = 0;
        if(responseObj.status && responseObj.status !== 'success') {
            this.onUploadFail(responseObj, options, fileRecord);
        }
        this.fileRecord.beginEdit();
        this.fileRecord.set('tempFile', responseObj.tempFile);
        this.fileRecord.set('size',  this.currentChunkPosition ? this.currentChunkPosition : 0);
        this.fileRecord.commit(false);

        this.fireEvent('update', 'uploadprogress', this, this.fileRecord);
        if(! this.isHtml5ChunkedUpload()) {  
 
            this.finishUploadRecord(response);
        }
        else {

            this.addTempfile( this.fileRecord.get('tempFile') );
            var percent = parseInt(this.currentChunkPosition * 100 / this.fileSize/1);

            if(this.lastChunk) {
                percent = 98;
            }

            this.fileRecord.beginEdit();
            this.fileRecord.set('progress', percent);
            this.fileRecord.commit(false);

         if(this.lastChunk) {

                window.setTimeout((function() {
                    Klb.system.Ajax.request({
                        timeout: 10*60*1000, // Overriding Ajax timeout - important!
                        url:   this.url,
                        params: {
                            xfileid:   this.fileRecord.get('id'),
                            xfilesize: this.fileRecord.get('size'),
                            method:    'Im.upload.join'
                            // tempFilesData: this.tempFiles
                        },
                        success: this.finishUploadRecord.bind(this),
                        failure: this.finishUploadRecord.bind(this),
                        scope: this
                    });
                }).bind(this), this.CHUNK_TIMEOUT_MILLIS);

            }
            else {
                window.setTimeout((function() {
                    if(!this.isPaused()) {
                        this.prepareChunk();
                        this.html5upload();
                    }
                }).bind(this), this.CHUNK_TIMEOUT_MILLIS);
            }
        }

    },

    /**
     * executed if a chunk / file upload failed
     */
    onUploadFail: function(response, fileRecord, options) {
    
        if (this.isHtml5ChunkedUpload()) {

            this.lastChunkUploadFailed = true;
            this.retryCount++;

            if (this.retryCount > this.MAX_RETRY_COUNT) {

                this.fileRecord.beginEdit();
                this.fileRecord.set('status', 'failure');
                this.fileRecord.endEdit();

                this.fireEvent('update', 'uploadfailure', this, this.fileRecord);
            }
            else {
                window.setTimeout((function() {
                    this.prepareChunk();
                    this.html5upload();
                }).bind(this), this.RETRY_TIMEOUT_MILLIS);
            }
        }
        else {
            this.fileRecord.beginEdit();
            this.fileRecord.set('status', 'failure');
            this.fileRecord.endEdit();

            this.fireEvent('uploadfailure', this, this.fileRecord);
            this.fireEvent('update', 'uploadfailure', this, this.fileRecord);
        }
    },


    /**
     * uploads in a html4 fashion
     *
     * @return {Ext.data.Connection}
     */
    html4upload: function() {

        var form  = this.createForm();
        var input = this.getInput();
            form.appendChild(input);

        this.fileRecord = Ext.create('Ext.ux.file.Upload.file', {
            name: this.fileSelector.getFileName(),
            size: 0,
            type: this.fileSelector.getFileCls(),
            input: input,
            form: form,
            status: 'uploading',
            progress: 0
        });

        this.fireEvent('update', 'uploadprogress', this, this.fileRecord);
    
        if(this.maxFileUploadSize/1 < this.file.size/1) {
            this.fileRecord.html4upload = true;
            this.onUploadFail(null, this.fileRecord, null);
            return this.fileRecord;
        }

        Klb.system.Ajax.request({
            fileRecord: this.fileRecord,
            isUpload: true,
            method:'post',
            form: form,
            success: this.onUploadSuccess.bind(this, [this.fileRecord], true),
            failure: this.onUploadFail.bind(this, [this.fileRecord], true),
            scope: this,
            params: {
                    method: 'Im.upload',
                    requestType: 'HTTP'
            }
        });
       
        return this.fileRecord;
    },

    /**
     * creating initial fileRecord for this upload
     */
    createFileRecord: function(pending) {

        var status = "uploading";
        if(pending) {
            status = "pending";
        }

        this.fileRecord = Ext.create('Ext.ux.file.Upload.file', {
            id:   Klb.system.Im.newHash(),  // safari and chrome use the non std. fileX props
            name: this.file.name ? this.file.name : this.file.fileName,  // safari and chrome use the non std. fileX props
            type: (this.file.type ? this.file.type : this.file.fileType), // missing if safari and chrome
            size: 0,
            status: status,
            progress: 0,
            input: this.file,
            uploadKey: this.id
        });

        this.fireEvent('update', 'uploadprogress', this, this.fileRecord);

    },

    /**
     * adding temporary file to array
     *
     * @param tempfile to add
     */
    addTempfile: function(tempFile) {
        this.tempFiles.push(tempFile);
        return true;
    },

    /**
     * returns the temporary files
     *
     * @returns {Array} temporary files
     */
    getTempfiles: function() {
        return this.tempFiles;
    },

    /**
     * pause oder resume file upload
     *
     * @param paused {Boolean} set true to pause file upload
     */
    setPaused: function(paused) {
        this.paused = paused;

        var pausedState = 'paused';
        if(!this.paused) {
            pausedState = 'uploading';
        }

        this.fileRecord.beginEdit();
        this.fileRecord.set('status', pausedState);
        this.fileRecord.endEdit();
        this.fireEvent('update', 'uploadpaused', this, this.fileRecord);
    },

    /**
     * indicates whether this upload ist paused
     *
     * @returns {Boolean}
     */
    isPaused: function() {
        return this.paused;
    },

    /**
     * checks for the existance of a method of an object
     *
     * @param object    {Object}
     * @param property  {String} method name
     * @returns {Boolean}
     */
    isHostMethod: function (object, property) {
        var t = typeof object[property];
        return t == 'function' || (!!(t == 'object' && object[property])) || t == 'unknown';
    },

    /**
     * indicates whether the current browser supports der File.slice method
     *
     * @returns {Boolean}
     */
    isHtml5ChunkedUpload: function() {

        if(window.File == undefined) return false;
        if(this.isHostMethod(File.prototype, 'slice') || this.isHostMethod(File.prototype, 'mozSlice')
                || this.isHostMethod(File.prototype, 'webkitSlice')) {
            return this.fileSize > this.minChunkSize;
        }
        else {
            return false;
        }
    },

    // private
    getInput: function() {
        if (! this.input) {
            this.input = this.fileSelector.detachInputFile();
        }
    
        return this.input;
    },

    /**
     * slices the given file
     *
     * @param file  File object
     * @param start start position
     * @param end   end position
     * @param type  file type
     * @returns
     */
    sliceFile: function(file, start, end, type) {

        if(file.slice) {
            return file.slice(start, end);
        }
        else if(file.mozSlice) {
            return file.mozSlice(start, end, type);
        }
        else if(file.webkitSlice) {
            return file.webkitSlice(start, end);
        }
        else {
            return false;
        }

    },

    /**
     * sets dthe queued state of this upload
     *
     * @param queued {Boolean}
     */
    setQueued: function (queued) {
        this.queued = queued;

        var queuedState = 'queued';
        if(!this.queued) {
            queuedState = 'uploading';
        }

        this.fileRecord.beginEdit();
        this.fileRecord.set('status', queuedState);
        this.fileRecord.endEdit();

        this.fireEvent('update', 'uploadqueued', this, this.fileRecord);
    },

    /**
     * indicates whethe this upload is queued
     *
     * @returns {Boolean}
     */
    isQueued: function() {
        return this.queued;
    }

});
