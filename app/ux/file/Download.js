/*
 * CLK 2.3.8
 * 
 * @license     http://www.gnu.org/licenses/agpl.html AGPL Version 3
 * @author      Philipp Schüle <p.schuele@metaways.de>
 * @copyright   Copyright (c) 2007-2011 Metaways Infosystems GmbH (http://www.metaways.de)
 *
 */
 
Ext.ns('Ext.ux.file');

/**
 * @namespace   Ext.ux.file
 * @class       Ext.ux.file.Download
 * @extends     Ext.ux.util.Observable
 */
//Ext.ux.file.Download = function(config) {
//    config = config || {};
//    Ext.apply(this, config);
//    
//    Ext.ux.file.Download.superclass.constructor.call(this);
    
//    this.addEvents({
//        'success': true,
//        'fail': true,
//        'abort': true
//    });
//};
Ext.define('Ext.ux.file.Download', {
    mixins: ['Ext.mixin.Observable'],

    constructor: function (config) {
        config = config || {};
        Ext.apply(this, config);        
        this.mixins.observable.constructor.call(this, config);        
    },

    url: Clk.requestUrl ,
    method: 'POST',
    params: null,
    timeout: 1800000, // 30 minutes
    
    /**
     * @private 
     */
    form: null,
    transactionId: null,
    
    /**
     * start download
     */
    start: function() {
        this.form = Ext.getBody().createChild({
            tag:'form',
            method: this.method,
            cls:'x-hidden'
        });

        var con = new Ext.data.Connection({
            // firefox specific problem -> see http://www.extjs.com/forum/archive/index.php/t-44862.html
            //  "It appears that this is because the "load" is completing once the initial download dialog is displayed, 
            //  but the frame is then destroyed before the "save as" dialog is shown."
            //
            // TODO check if we can handle firefox event 'onSaveAsSubmit' (or something like that)
            //
            debugUploads: Ext.isGecko
        });

        this.transactionId = con.request({
            isUpload: true,
            form: this.form,
            params: this.params,
            scope: this,
            success: this.onSuccess,
            failure: this.onFailure,
            url: this.url,
            timeout: this.timeout
        });
    },
    
    /**
     * abort download
     */
    abort: function() {
        Klb.system.Ajax.abort(this.transactionId);
        this.form.remove();
        this.fireEvent('abort', this);
    },
    
    /**
     * @private
     * 
     */
    onSuccess: function() {
        this.form.remove();
        this.fireEvent('success', this);
    },
    
    /**
     * @private
     * 
     */
    onFailure: function() {
        this.form.remove();
        this.fireEvent('fail', this);
    }
    
});
