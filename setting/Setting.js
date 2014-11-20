///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
var fieldInfo, _config, _s;

define([
        'dojo/_base/declare',
        'dijit/_WidgetsInTemplateMixin',
        'jimu/BaseWidgetSetting',
        'dojo/_base/lang',
        'dojo/on',
        "dijit/form/Select"
    ],

    function(
        declare,
        _WidgetsInTemplateMixin,
        BaseWidgetSetting,
        lang,
        on) {
        return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
            //these two properties is defined in the BaseWidget
            baseClass: 'jimu-widget-scalebar-setting',

            startup: function() {
                this.inherited(arguments);
                if (!this.config.mainURL) {
                    this.config.mainURL = "";
                }
                this.setConfig(this.config);

                this.own(on(this.textURL, "change", lang.hitch(this, this.onSelectChange)));
                this.own(on(this.goButton, "click", lang.hitch(this, this.onSelectChange)));
                _s = null;
                //this.own(on(this.selectStype, "change", lang.hitch(this, this.onSelectChange)));
            },

            setConfig: function(config) {
                this.config = config;
                _config = config;
                if (config.mainURL) {
                    this.textURL.set('value', config.mainURL);
                }
            },

            onSelectChange: function() {
                if (this.textURL.value) {
                    this.config.mainUrl = this.textURL.value;

                    require(["dojo/dom", "dojo/on", "dojo/dom-class", "dojo/_base/json", "dojo/_base/array", "dojo/string", "esri/request", "dojo/domReady!"], function(dom, on, domClass, dojoJson, array, dojoString, esriRequest) {

                        getContent();

                        function getContent() {

                            var url = this.textURL.value;

                            if (url.length === 0) {
                                alert("Please enter a URL");
                                return;
                            }

                            var requestHandle = esriRequest({
                                "url": url,
                                "content": {
                                    "f": "json"
                                },
                                "callbackParamName": "callback"
                            });
                            requestHandle.then(requestSucceeded, requestFailed);
                        }

                        function requestSucceeded(response, io) {
                            var pad;
                            pad = dojoString.pad;

                            if (response.hasOwnProperty("fields")) {
                                fieldInfo = array.map(response.fields, function(f) {

                                    if (f.type === "esriFieldTypeSmallInteger" || f.type === "esriFieldTypeInteger" || f.type == "esriFieldTypeSingle" || f.type == "esriFieldTypeDouble" || f.type == "esriFieldTypeString" || f.type == "esriFieldTypeDate") {
                                        if (f.name || f.alias)
                                            return {
                                                "id": f.name,
                                                "label": f.name
                                            }
                                    }

                                });

                                generateFieldsHTML(fieldInfo);
                                //dom.byId("fieldArea").innerHTML = generateFieldsHTML (fieldInfo);
                            } else {
                                dom.byId("fieldArea").innerHTML = "No field info found. Please double-check the URL.";
                            }

                        }

                        function requestFailed(error, io) {

                            domClass.add(dom.byId("fieldArea"), "failure");
                            dojoJson.toJsonIndentStr = " ";
                            dom.byId("fieldArea").innerHTML = dojoJson.toJson(error, true);

                        }

                        function generateFieldsHTML(fieldInfo) {

                            var fInfo = []
                            var ii = 0;
                            //  h = "<select multiple='true' id='fieldsSel' name='fieldsSel' data-dojo-type='dojox.form.CheckedMultiSelect' style='width:600px' >" 
                            for (var i = 0; i < fieldInfo.length; i++) {
                                if (fieldInfo[i]) {
                                    fInfo[ii] = fieldInfo[i];
                                    ii++
                                }
                            };
                            // Fix this
                            fieldInfo = fInfo;
                            require(["dojox/form/CheckedMultiSelect",
                                "dojo/data/ObjectStore",
                                "dojo/store/Memory",
                                "dojo/_base/window",
                                "dojo/dom-construct",
                                "dojo/domReady!"
                            ], function(Select, ObjectStore, Memory, win, domConstruct) {

                                var store = new Memory({
                                    data: fieldInfo
                                });

                                var os = new ObjectStore({
                                    objectStore: store
                                });

                                if (_s === null) {
                                    _s = new Select({
                                        store: os,
                                        id: 'field' + String(Math.floor(Math.random() * 600) + 1),
                                        name: 'fields' + String(Math.floor(Math.random() * 600) + 1),
                                        multiple: true
                                    }, 'fields');
                                    _s.startup();

                                    _s.on("change", function() {
                                        _config.queryFields = this.get("value");
                                        console.log("Setting:" + _config.queryFields);
                                    })
                                } else {
                                    _s.setStore(os);
                                }

                            })


                        }
                    });

                }
            },

            getConfig: function() {
                return _config;
            },

        });
    });