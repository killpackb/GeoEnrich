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


define(['dojo/_base/declare', 'jimu/BaseWidget', 'esri/toolbars/draw', 'esri/symbols/SimpleMarkerSymbol', 'esri/graphic', 'esri/Color', 'dojo/dom', 'dojo/on',
        'esri/geometry/webMercatorUtils', 'esri/layers/FeatureLayer', 'dojo/_base/lang', 'dojo/_base/array', 'dojox/data/CsvStore', 'dojox/encoding/base64',
        'esri/geometry/Point', 'esri/geometry/Multipoint', 'esri/InfoTemplate', 'esri/tasks/QueryTask', 'esri/tasks/query', 'esri/SpatialReference'
    ],
    function(declare, BaseWidget, Draw, SimpleMarkerSymbol, Graphic, Color, dom, on, webMercatorUtils, FeatureLayer, lang, arrayUtils, CsvStore, base64,
        Point, Multipoint, InfoTemplate, QueryTask, Query, SpatialReference) {
        //To create a widget, you need to derive from BaseWidget.
        var tb, markerSymbol, map, featureLayer, c, pieChart, queryFields, layerLoaded, fFields;
        var latFieldStrings = ["lat", "latitude", "y", "ycenter","POINT_Y"];
        var longFieldStrings = ["lon", "long", "longitude", "x", "xcenter","POINT_X"];

        return declare([BaseWidget], {
    
            baseClass: 'jimu-widget-wireless',
            name: 'wireless',

            postCreate: function() {
                this.inherited(arguments);
                //console.log('postCreate')
            },

            _goRouteSimple: function() {

                tb.activate("point");

            },

            startup: function() {
                this.inherited(arguments);
                map = this.map;
                currentCode = 0;
                var qT = new QueryTask(this.config.mainURL);
                queryFields = ((Object.prototype.toString.call(this.config.queryFields) === '[object Array]'))
                  ? this.config.queryFields
                  : this.config.queryFields.split(",");
                var q = new Query();
                q.spatialRelationship = Query.SPATIAL_REL_INTERSECTS;
                q.outFields = queryFields;
                q.returnGeometry = false;
                q.outSpatialReference = map.spatialReference;
                q.where = "1=1";
                markerSymbol = new SimpleMarkerSymbol();
                markerSymbol.style = SimpleMarkerSymbol.STYLE_CIRCLE;
                layerLoaded = false;

                require([
                    "dojox/charting/Chart",
                    "dojox/charting/plot2d/Pie",
                    "dojox/charting/action2d/Tooltip",
                    "dojox/charting/action2d/MoveSlice",
                    "dojox/charting/action2d/Magnify",
                    "dojox/charting/themes/PlotKit/green",
                    "dojo/domReady!"
                ], function(Chart, Pie, Tooltip, MoveSlice, Magnify, PlotKitGreen) {

                    pieChart = new Chart("b_chart", {
                        title: "Signal Strength Distribution",
                        titlePos: "top",
                        titleGap: 25,
                        titleFont: "normal normal normal 12pt Century Gothic",
                        titleFontColor: "black"
                    });
                    pieChart.setTheme(PlotKitGreen);
                    pieChart.addPlot("default", {
                        type: "Pie",
                        fontColor: "#000",
                        font: "normal normal normal 12pt Century Gothic",
                        labelOffset: 20,
                        labels: true

                    });

                    new MoveSlice(pieChart, "default");
                    new Tooltip(pieChart, "default");

                });

                tb = new Draw(this.map);
                tb.on("draw-end", function addGraphic(evt) {
                    map.graphics.add(new Graphic(evt.geometry, markerSymbol));
                    tb.deactivate();
                    map.enableMapNavigation();
                });

                var c = dom.byId(this.id);
                on(c, "dragover", function(event) {
                    event.preventDefault();
                });

                on(c, "dragenter", function(event) {
                    event.preventDefault();
                });

                on(c, "drop", function handleDrop(event) {
                    event.preventDefault();
                    var dataTransfer = event.dataTransfer,
                        files = dataTransfer.files,
                        types = dataTransfer.types;
                    var file = files[0];
                    //console.log("type = ", file.type);
                    handleCSV(file);

                    function handleCSV(file) {
                        console.log("Processing CSV: ", file, ", ", file.name, ", ", file.type, ", ", file.size);
                        if (file.data) {
                            var decoded = bytesToString(base64.decode(file.data));
                            processCSVData(decoded);
                        } else {
                            var reader = new FileReader();
                            reader.onload = function() {
                                //console.log("Finished reading CSV data");
                                processCSVData(reader.result);
                            };
                            reader.readAsText(file);
                        }
                    }

                    function processCSVData(data) {
                        var newLineIndex = data.indexOf("\n");
                        var firstLine = lang.trim(data.substr(0, newLineIndex));
                        var separator = getSeparator(firstLine);
                        var csvStore = new CsvStore({
                            data: data,
                            separator: separator
                        });

                        csvStore.fetch({
                            onComplete: function(items) {
                                var objectId = 0;
                                var featureCollection = generateFeatureCollectionTemplateCSV(csvStore, items);
                                var popupInfo = generateDefaultPopupInfo(featureCollection);
                                var infoTemplate = new InfoTemplate(buildInfoTemplate(popupInfo));
                                var latField, longField;
                                var fieldNames = csvStore.getAttributes(items[0]);
                                //fieldNames.push(f);
                                // fieldNames.push("Service");
                                fieldNames = fieldNames.concat(queryFields);

                                arrayUtils.forEach(fieldNames, function(fieldName) {
                                    var matchId;
                                    matchId = arrayUtils.indexOf(latFieldStrings,
                                        fieldName.toLowerCase());
                                    if (matchId !== -1) {
                                        latField = fieldName;
                                    }

                                    matchId = arrayUtils.indexOf(longFieldStrings,
                                        fieldName.toLowerCase());
                                    if (matchId !== -1) {
                                        longField = fieldName;
                                    }
                                });

                                arrayUtils.forEach(items, function(item) {
                                    var attrs = fieldNames,
                                        attributes = {};
                                    // Read all the attributes for  this record/item
                                    arrayUtils.forEach(attrs, function(attr) {
                                        var value = Number(csvStore.getValue(item, attr));
                                        attributes[attr] = isNaN(value) ? csvStore.getValue(item, attr) : value;
                                    });

                                    attributes["__OBJECTID"] = objectId;
                                    objectId++;

                                    var latitude = parseFloat(attributes[latField]);
                                    var longitude = parseFloat(attributes[longField]);

                                    if (isNaN(latitude) || isNaN(longitude)) {
                                        return;
                                    }

                                    var geometry = webMercatorUtils
                                        .geographicToWebMercator(new Point(longitude, latitude, map.spatialReference)); //map.spatialReference
                                    var feature = {
                                        "geometry": geometry.toJson(),
                                        "attributes": attributes
                                    };
                                    featureCollection.featureSet.features.push(feature);
                                });

                                if (layerLoaded) {
                                    map.removeLayer(featureLayer);
                                }
                                featureLayer = new FeatureLayer(featureCollection, {
                                    infoTemplate: infoTemplate,
                                    id: 'csvLayer'
                                });
                                featureLayer.__popupInfo = popupInfo;

                                document.getElementById("loading").style.visibility = "visible";
                                queryCoverage(featureLayer);

                            },
                            onError: function(error) {
                                console.error("Error fetching items from CSV store: ", error);
                            }
                        });
                    }

                    function getSeparator(string) {
                        var separators = [",", "      ", ";", "|"];
                        var maxSeparatorLength = 0;
                        var maxSeparatorValue = "";
                        arrayUtils.forEach(separators, function(separator) {
                            var length = string.split(separator).length;
                            if (length > maxSeparatorLength) {
                                maxSeparatorLength = length;
                                maxSeparatorValue = separator;
                            }
                        });
                        return maxSeparatorValue;
                    }

                    function generateFeatureCollectionTemplateCSV(store, items) {

                        var featureCollection = {
                            "layerDefinition": null,
                            "featureSet": {
                                "features": [],
                                "geometryType": "esriGeometryPoint"
                            }
                        };

                        featureCollection.layerDefinition = {
                            "geometryType": "esriGeometryPoint",
                            "objectIdField": "__OBJECTID",
                            "type": "Feature Layer",
                            "typeIdField": "",
                            "fields": [{
                                "name": "__OBJECTID",
                                "alias": "__OBJECTID",
                                "type": "esriFieldTypeOID",
                                "editable": false,
                                "domain": null
                            }],
                            "types": [],
                            "capabilities": "Query"
                        };

                        var fields = store.getAttributes(items[0]);
                        //fields.push(f);
                        //fields.push("Service");
                        fields = fields.concat(queryFields);
                        arrayUtils.forEach(fields, function(field) {
                            var value = store.getValue(items[0], field);
                            var parsedValue = Number(value);
                            if (isNaN(parsedValue)) { //check first value and see if it is a number
                                featureCollection.layerDefinition.fields.push({
                                    "name": field,
                                    "alias": field,
                                    "type": "esriFieldTypeString",
                                    "editable": true,
                                    "domain": null
                                });
                            } else {
                                featureCollection.layerDefinition.fields.push({
                                    "name": field,
                                    "alias": field,
                                    "type": "esriFieldTypeDouble",
                                    "editable": true,
                                    "domain": null
                                });
                            }
                        });
                        fFields = fields;
                        return featureCollection;
                    }

                    function generateDefaultPopupInfo(featureCollection) {
                        var fields = featureCollection.layerDefinition.fields;
                        var decimal = {
                            'esriFieldTypeDouble': 1,
                            'esriFieldTypeSingle': 1
                        };
                        var integer = {
                            'esriFieldTypeInteger': 1,
                            'esriFieldTypeSmallInteger': 1
                        };
                        var dt = {
                            'esriFieldTypeDate': 1
                        };
                        var displayField = null;
                        var fieldInfos = arrayUtils.map(fields,
                            lang.hitch(this, function(item) {
                                if (item.name.toUpperCase() === "NAME") {
                                    displayField = item.name;
                                }
                                var visible = (item.type !== "esriFieldTypeOID" &&
                                    item.type !== "esriFieldTypeGlobalID" &&
                                    item.type !== "esriFieldTypeGeometry");
                                var format = null;
                                if (visible) {
                                    var f = item.name.toLowerCase();
                                    var hideFieldsStr = ",stretched value,fnode_,tnode_,lpoly_,rpoly_,poly_,subclass,subclass_,rings_ok,rings_nok,";
                                    if (hideFieldsStr.indexOf("," + f + ",") > -1 ||
                                        f.indexOf("objectid") > -1 || 
                                        f.indexOf("_i") == f.length - 2) {
                                        visible = false;
                                    }
                                    if (item.type in integer) {
                                        format = {
                                            places: 0,
                                            digitSeparator: true
                                        };
                                    } else if (item.type in decimal) {
                                        format = {
                                            places: 2,
                                            digitSeparator: true
                                        };
                                    } else if (item.type in dt) {
                                        format = {
                                            dateFormat: 'shortDateShortTime'
                                        };
                                    }
                                }

                                return lang.mixin({}, {
                                    fieldName: item.name,
                                    label: item.alias,
                                    isEditable: false,
                                    tooltip: "",
                                    visible: visible,
                                    format: format,
                                    stringFieldOption: 'textbox'
                                });
                            }));

                        var popupInfo = {
                            title: displayField ? '{' + displayField + '}' : '',
                            fieldInfos: fieldInfos,
                            description: null,
                            showAttachments: false,
                            mediaInfos: []
                        };
                        return popupInfo;
                    }

                    function buildInfoTemplate(popupInfo) {
                        var json = {
                            content: "<table>"
                        };

                        arrayUtils.forEach(popupInfo.fieldInfos, function(field) {
                            if (field.visible) {
                                json.content += "<tr><td valign='top'>" + field.label +
                                    ": <\/td><td valign='top'>${" + field.fieldName + "}<\/td><\/tr>";
                            }
                        });
                        json.content += "<\/table>";
                        return json;
                    }

                    function zoomToData(featureLayer) {

                        // Zoom to the collective extent of the data
                        var multipoint = new Multipoint(map.spatialReference);

                        arrayUtils.forEach(featureLayer.graphics, function(graphic) {
                            var geometry = graphic.geometry;
                            if (geometry) {
                                multipoint.addPoint({
                                    x: geometry.x,
                                    y: geometry.y
                                });
                            }
                        });

                        if (multipoint.points.length > 0) {
                            //map.setExtent(multipoint.getExtent().expand(1.25), true);
                        }
                        map.addLayer(featureLayer);
                        layerLoaded = true;
                        //map.setZoom(8);
                    }

                    function queryCoverage(featureLayer1) {
                        c = 0;
                        var sNone = 0;
                        var data_list = [];
                        for (var i = 0; i < featureLayer1.graphics.length; i++) {

                            q.geometry = featureLayer1.graphics[i].geometry;
                            qT.execute(q, function(results) {

                                if (results.features.length > 0) {
                                    var a;
                                    a = featureLayer1.graphics[c].attributes;
                                    for (var i = 0; i < queryFields.length; i++) {

                                        var val = results.features[0].attributes[queryFields[i]];

                                        if (!val.isNaN) {
                                            val = parseFloat(val);
                                        }

                                        a[queryFields[i]] = val

                                    };

                                    featureLayer1.graphics[c].attributes = a;

                                    var aTmp = featureLayer1.graphics[c].attributes;
                                    delete aTmp.__OBJECTID;

                                    data_list.push(aTmp);

                                    var markerSymbol = new SimpleMarkerSymbol();
                                    markerSymbol.style = SimpleMarkerSymbol.STYLE_CIRCLE;
                                    markerSymbol.setSize(10);
                                    markerSymbol.setColor(new Color("#006600"));
                                    featureLayer1.graphics[c].symbol = markerSymbol;

                                } else {

                                    var markerSymbol = new SimpleMarkerSymbol();
                                    markerSymbol.style = SimpleMarkerSymbol.STYLE_CIRCLE;
                                    markerSymbol.setSize(5);
                                    markerSymbol.setColor(new Color("#CC3300"));
                                    featureLayer1.graphics[c].symbol = markerSymbol;
                                    var a = featureLayer1.graphics[c].attributes;

                                    var aTmp = a;
                                    delete aTmp.__OBJECTID;
                                    data_list.push(aTmp);

                                    // a[f] = 0;
                                    // a["Service"] = "None";
                                    sNone++;

                                }
                                c = c + 1;
                                if (c >= featureLayer1.graphics.length) {
                                    zoomToData(featureLayer);
                                    document.getElementById("loading").style.visibility = "hidden";
                                    var f1;
                                    for (var i = 0; i < fFields.length; i++) {
                                        if (i == 0) {
                                            f1 = fFields[i]
                                        } else {
                                            f1 = f1 + "," + fFields[i];
                                        }
                                    };
                                    //console.log(data_list)
                                    var sC = ConvertToCSV(data_list);
                                    var encodedUri = encodeURI(f1 + "\r\n" + sC);
                                    var a = document.createElement('a');
                                    a.href = 'data:attachment/csv,' + encodedUri;
                                    a.target = '_blank';
                                    a.download = 'SFL_GeoEnriched.csv';
                                    document.body.appendChild(a);
                                    a.click();

                                    function ConvertToCSV(objArray) {
                                        var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
                                        var str = '';

                                        for (var i = 0; i < array.length - 1; i++) {
                                            var line = '';
                                            for (var index in array[i]) {
                                                if (line != '') line += ','

                                                line += array[i][index];

                                            }

                                            str += line + '\r\n';
                                        }

                                        return str;
                                    }

                                }
                            });
                        }
                    }
                });
            },

            onOpen: function() {
                //console.log('onOpen');
            },

            onClose: function() {
                //console.log('onClose');
            },

            onMinimize: function() {
                //console.log('onMinimize');
            },

            onMaximize: function() {
                //console.log('onMaximize');
            },

            onSignIn: function(credential) {
                /* jshint unused:false*/
                //console.log('onSignIn');
            },

            onSignOut: function() {
                //console.log('onSignOut');
            }
        });
    });