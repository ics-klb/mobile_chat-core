Ext.define('KlbCore.controller.NavController', {
    extend: 'Ext.app.Controller',

    config: {
        refs: {
            mainView: {
                autoCreate: true,
                selector: 'mainview',
                xtype: 'mainview'
            },
            addTicketButton: 'mainview #addTicketButton',
            titleField: 'ticketview #titleField',
            importanceField: 'mainview #importanceField',
            statusField: 'mainview #statusField',
            descriptionField: 'ticketview #descriptionField'
        },

        control: {
            "mainview #ticketList": {
                disclose: 'onTicketDisclose',
                show: 'onTicketListShow'
            },
            "mainview #addTicketButton": {
                tap: 'onAddTicketTap'
            },
            "mainview #saveTicketButton": {
                tap: 'onSaveTap'
            }
        }
    },

    onTicketDisclose: function(list, record, target, index, e, eOpts) {
        var mainView = this.getMainView(),
            addTicketButton = this.getAddTicketButton();

        mainView.push({
            xtype: 'ticketview',
            title: record.get('title')
        });

        this.getTitleField().setValue(record.get('title'));
        this.getDescriptionField().setValue(record.get('description'));
        this.getImportanceField().setValue(record.get('importance'));
        this.getStatusField().setValue(record.get('status'));

        mainView.setRecord(record);

        addTicketButton.hide();
    },

    onAddTicketTap: function(button, e, eOpts) {
        var mainView = this.getMainView(),
            addTicketButton = this.getAddTicketButton();

        mainView.push({
            xtype: 'ticketview',
            title: 'New ticket'
        });

        addTicketButton.hide();
    },

    onTicketListShow: function(component, eOpts) {
        this.getAddTicketButton().show();
    },

    onSaveTap: function(button, e, eOpts) {
        var mainView = this.getMainView(),
            record = mainView.getRecord(),
            store = Ext.getStore('ticketStore'),
            title = this.getTitleField().getValue(),
            description = this.getDescriptionField().getValue(),
            importance = this.getImportanceField().getValue(),
            status = this.getStatusField().getValue(),
            properties = {
                title: title,
                description: description,
                importance: importance,
                status: status
            };

        if (record) {
            record.set(properties);
            mainView.setRecord(null);
        } else {
            store.add(properties);
        }

        mainView.pop();
    }

});