///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

var _self;
var _select;
var _store;
var _currentURL;
var _currentFields;

define([
        'dojo/_base/declare',
        'dijit/_WidgetsInTemplateMixin',
        'jimu/BaseWidgetSetting',
        'dojo/_base/lang',
        'dojo/on',
        'jimu/dijit/Message',
        'dojox/form/CheckedMultiSelect',
        'dojo/data/ObjectStore',
        'dojo/store/Memory'
    ],

    function(
        declare, _WidgetsInTemplateMixin, BaseWidgetSetting,
        lang,on, Message, Select, ObjectStore, Memory) {
        return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
            baseClass: 'jimu-widget-GeoEnrich-setting',

            startup: function() {
               _self = this;

                this.inherited(arguments);

                if (!_currentURL) {
                    this.config.mainURL = _currentURL;  
                }

                _self.textURL.set('value', _currentURL);
                this.setConfig(this.config);

                if (!_currentFields) {
                    this.config.queryFields = _currentFields;
                }

                this.own(on(this.textURL, 'change',
                    lang.hitch(this, this._onSelectChange)));
                this.own(on(this.goButton, 'click',
                    lang.hitch(this, this._onSelectChange)));

                _store = new Memory({
                    data: ['Not Set']
                });

               var os = new ObjectStore({
                    objectStore: _store
                });
  
                _select = new Select({
                    id: 'fieldSelect',
                    store: os,
                    readOnly: false,
                    multiple: true,
                    style: 'visibility:hidden'
                }, 'fieldList');
                _select.startup();

                _select.on('change', function() {
                    _self.queryFields = this.get('value');
                    _currentFields = this.get('value');
                    console.log('Setting:' + _self.config.queryFields);
                });

            },

            setConfig: function(config) {
                this.config = config;
            },

            getConfig: function() {
                this.config.mainURL = this.textURL.value;
                this.config.queryFields = _currentFields;
                return _self.config;
            },

            _checkURL: function(url){

                 require(['esri/request',
                          'dojo/domReady!'
                        ],
                        function(esriRequest) {
                            if (url.length === 0) {
                                _self._URLError('Enter a Valid Service URL');
                                return;
                            }
                            try {
                                var requestHandle = esriRequest({
                                    'url': url,
                                    'content': {
                                        'f': 'json'
                                    },
                                    'callbackParamName': 'callback'
                                });

                                requestHandle.then(_self._requestSucceeded, _self._requestFailed);

                            }catch(e){

                                 _self._URLError('');
                            }
                });

            },

            _requestFailed: function(error, io) { 
                console.error(error);                       
                _self._URLError('');
            },

          _requestSucceeded: function(response, io) {
                
                _self.mainUrl = this.textURL.value;
                _currentURL = this.textURL.value;

                if (response.hasOwnProperty('geometryType')) {
                    if (response.geometryType !== 'esriGeometryPolygon'){
                        _self._URLError('Must be a Polygon Feature Service');
                        return;
                    }
                }

                require(['dojo/_base/array',
                         'dojo/domReady!'
                        ],
                        function(array) {
                            if (response.hasOwnProperty('fields')) {
                                var fieldInfo = array.map(response.fields, function(f) {

                                    if (f.type === 'esriFieldTypeSmallInteger' ||
                                        f.type === 'esriFieldTypeInteger' ||
                                        f.type === 'esriFieldTypeSingle' ||
                                        f.type === 'esriFieldTypeDouble' ||
                                        f.type === 'esriFieldTypeString' ||
                                        f.type === 'esriFieldTypeDate') {
                                        if (f.name || f.alias) {
                                            return {
                                                'id': f.name,
                                                'label': f.name
                                            };
                                        }
                                    }
                                });

                                _self._generateFieldsHTML(fieldInfo);

                            } else {
                                 _self._URLError('Cannot Retreive Fields. Requires Polygon Feature Service.');
                            }
                });
            },

            _generateFieldsHTML: function(fieldInfo) {
               
                var fInfo = [];
                var ii = 0;
                for (var i = 0; i < fieldInfo.length; i++) {
                    if (fieldInfo[i]) {
                        fInfo[ii] = fieldInfo[i];
                        ii++;
                    }
                }

                _store.data = fInfo;

                var os = new ObjectStore({
                    objectStore: _store
                });

                _select.setStore(os);

                if (_currentFields) {
                     _select.set ('value',_currentFields);
                }

                require(['dojo','dojo/dom','dojo/dom-style'],
                      function(dojo,dom,domStyle) {
                         domStyle.set(dom.byId('fldLabel'), 'visibility', 'visible');
                         dojo.style(_select.domNode, {visibility:'visible'});
                });
            },

             _URLError: function(e) {

                    require(['dojo/dom','dijit','dojo/dom-style','dojo'],
                      function(dom,dijit,domStyle,dojo) {

                        if (e===''){
                            e = 'Invalid URL';
                        }
                        //replace with Message
                        var textBox = dijit.byId('textURL');
                        var oV = textBox.validator;
                        textBox.validator = function() {return false;};
                        textBox.validate();  
                        textBox.validator = oV;
                        dijit.showTooltip(
                            e, 
                            textBox.domNode, 
                            textBox.get('tooltipPosition'),
                            !textBox.isLeftToRight()
                        );
                         domStyle.set(dom.byId('fldLabel'), 'visibility', 'hidden');
                         dojo.style(_select.domNode, {visibility:'hidden'});

                    });
                },

            _onSelectChange: function() {

                if (this.textURL.value) {
                    _self._checkURL(this.textURL.value);
                }
            }

        });
    });