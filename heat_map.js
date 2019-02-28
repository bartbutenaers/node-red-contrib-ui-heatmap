/**
 * Copyright 2019 Bart Butenaers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    var settings = RED.settings;

     function HTML(config) { 
        // The configuration is a Javascript object, which needs to be converted to a JSON string
        var configAsJson = JSON.stringify(config);

        // Make sure to set the width and height via CSS style (instead of the width and height html element attributes).
        // This way the dashboard can calculate the size of the div correctly.  See:
        // https://discourse.nodered.org/t/custom-ui-node-layout-problems/7731/21?u=bartbutenaers)
        // When you need to debug the heatmap.js library, just replace heatmap.min.js by heatmap.js
        var html = String.raw`
        <script src="heatmap/js/heatmap.min.js"></script>
        <div id="heatMapContainer_` + config.id + `" style="width:100%; height:100%;" ng-init='init(` + configAsJson + `)'></div>
        <canvas id="heatMapLegend_` + config.id + `" style="width:100%; height:20px;" ng-show="config.showLegend" height="20px;">
        `;
        
        return html;
    };

    function checkConfig(node, conf) {
        if (!conf || !conf.hasOwnProperty("group")) {
            node.error(RED._("heat-map.error.no-group"));
            return false;
        }
        return true;
    }
    
    var ui = undefined;
    
    function HeatMapNode(config) {
         try {
            var node = this;
            if(ui === undefined) {
                ui = RED.require("node-red-dashboard")(RED);
            }
            RED.nodes.createNode(this, config);

            if (checkConfig(node, config)) { 
                var html = HTML(config);
                var done = ui.addWidget({
                    node: node,
                    group: config.group,
                    width: config.width,
                    height: config.height,
                    format: html,
                    templateScope: "local",
                    emitOnlyNewValues: false,
                    forwardInputMessages: false,
                    storeFrontEndInputAsState: false,
                    convertBack: function (value) {
                        return value;
                    },
                    beforeEmit: function(msg, value) {
                        return { msg: msg };
                    },
                    beforeSend: function (msg, orig) {
                        if (orig) {
                            return orig.msg;
                        }
                    },
                    initController: function($scope, events) {
                        $scope.flag = true;
                
                        $scope.init = function (config) {
                            $scope.config = config;
                        }

                        $scope.$watch('msg', function(msg) {
                            if (!msg) {
                                // Ignore undefined msg
                                return;
                            }

                            if (msg.payload && Array.isArray(msg.payload) && msg.payload.length === $scope.config.rows * $scope.config.columns) {
                                var maxValue = 0;
                                var minValue = Number.MAX_VALUE;
                                var points = [];
                                var index = 0;
                                
                                var parentDiv = document.getElementById('heatMapContainer_' + $scope.config.id);
                               
                                // Create the heatmap canvas once.  Don't do that it the $scope.init, because at that moment the width and height are still 0 ... 
                                if (!$scope.heatMapInstance) {
                                    // https://github.com/pa7/heatmap.js/blob/4e64f5ae5754c84fea363f0fcf24bea4795405ff/build/heatmap.js#L23
                                    $scope.h337Config = {
                                        container: parentDiv,
                                        radius: parseInt($scope.config.radius || 40),
                                        backgroundColor: $scope.config.backgroundColor || '#ffffff',
                                        opacity: parseFloat($scope.config.opacity || 0.6),
                                        //minOpacity: parseFloat($scope.config.minOpacity || 0),
                                        //maxOpacity: parseFloat($scope.config.maxOpacity || 1),
                                        blur: parseFloat($scope.config.blur || 0.85),
                                        //gradient: { 0.25: "rgb(0,0,255)", 0.55: "rgb(0,255,0)", 0.85: "yellow", 1.0: "rgb(255,0,0)"},
                                        renderer: $scope.config.defaultRenderer || 'canvas2d',
                                        width: parentDiv.clientWidth,
                                        height: parentDiv.clientHeight,
                                        xField: 'x',
                                        yField: 'y',
                                        valueField: 'value', 
                                        plugins: {}
                                    }
                                
                                    $scope.heatMapInstance = h337.create($scope.h337Config);
                                }
                                
                                var columns = parseInt($scope.config.columns);
                                var rows = parseInt($scope.config.rows);
                                
                                // Calculate the width and height ratios, from the data matrix to the available canvas size.
                                // These ratio's are in fact the distance between the points ...
                                var ratioWidth  = parentDiv.clientWidth  / (columns + 1);
                                var ratioHeight = parentDiv.clientHeight / (rows + 1);
                                
                                // When the minimum/maximum values are specified in the config screen, those values should be used
                                if ($scope.config.minMax === true) {
                                    maxValue = parseFloat($scope.config.maximumValue);
                                    minValue = parseFloat($scope.config.minimumValue);
                                }

                                // Determine the coordinates of every specified value.
                                // See https://www.patrick-wied.at/static/heatmapjs/example-minimal-config.html
                                for (var column = 1; column <= columns; column++) {
                                    for (var row = 1; row <= rows; row++) {
                                        var val = msg.payload[index];

                                        // Calculate the minimum and maximum value, when not specified in the config screen
                                        if ($scope.config.minMax === false) {
                                            maxValue = Math.max(maxValue, val);
                                            minValue = Math.min(minValue, val);
                                        }

                                        // Calculate the coordinates of every value in the area of the parentDiv
                                        var point = {
                                            x: Math.floor(column * ratioWidth),
                                            y: Math.floor(row * ratioHeight),
                                            value: val
                                        }
                                    
                                        points.push(point);
                                    
                                        index++;
                                    }
                                }

                                // The data for the heat map should contain all the information we have calculated
                                var data = { min: minValue, max: maxValue, data: points };
                                                           
                                if ($scope.heatMapInstance._renderer._height === 0 || $scope.heatMapInstance._renderer._width === 0) {
                                    // Under certain circumstances (e.g. when the node is redeployed) the following situation will occur:
                                    // 1. A new $scope instance is created by AngularJs.
                                    // 2. As a result scope.heatMapInstance will be undefined, so we will create a new heatmap instance (using h337.create ...).
                                    // 3. However at that moment parentDiv.clientHeight is 0 ;-(
                                    // 4. So the $scope.heatMapInstance._renderer._height will become 0.
                                    // 5. When we call $scope.heatMapInstance.setData following error will occur:
                                    //    "app.min.js:148 DOMException: Failed to execute 'getImageData' on 'CanvasRenderingContext2D': The source height is 0"
                                    // 6. The problem will continue to exist, until a new heatmap instance is created 
                                    //   (since the $scope.heatMapInstance._renderer._height stays 0 until we call h337.create ...).
                                    // 7. The console log will be filled with these errors, and NO heatmaps are drawed anymore!
                                    //
                                    // I haven't been able to avoid this situation, but merely a workaround has been implemented:
                                    // 1. When we detect that the $scope.heatMapInstance._renderer._height is 0, we know that $scope.heatMapInstance.setData will fail.
                                    // 2. Therefore we will determine the current parentDiv size, and pass this information to the heatmap instance.
                                    // 3. As soon as a the height and width aren't 0 anymore, we can call $scope.heatMapInstance.setData again.
                                    //    It has no sense to call that function earlier, because it would fail anyway ...
                                    $scope.h337Config.width = parentDiv.clientWidth;
                                    $scope.h337Config.height = parentDiv.clientHeight;
      
                                    // Apply the updated configuration and repaint
                                    $scope.heatMapInstance.configure($scope.h337Config);

                                    console.log("The heatmap height is being corrected");
                                }
                                
                                // Refresh the heatmap content by setting new values (only when the height and width are not 0)
                                if ($scope.heatMapInstance._renderer._height !== 0 && $scope.heatMapInstance._renderer._width !== 0) { 
                                    $scope.heatMapInstance.setData(data);
                                }
                                else {
                                    console.log("The heatmap is skipped due to invalid canvas size");
                                }
                                
                                // Show the numeric input values on top of the heatmap
                                if ($scope.config.showValues === true) {
                                    // Get a reference to the heatmap canvas, which has just been drawn in setData
                                    var heatmapContext = parentDiv.firstElementChild.getContext('2d');
                                    
                                    heatmapContext.font = "10px Arial";
                                    heatmapContext.textAlign = "center"; 
                                    heatmapContext.textBaseline = "middle"; 
                                    
                                    // Draw now the values in the canvas, on top of the heatmap points
                                    for (var i = 0; i < points.length; i++) {
                                        var point = points[i];
                                        var roundedValue = point.value.toFixed($scope.config.valuesDecimals || 0);
                                        heatmapContext.fillText(roundedValue, point.x, point.y);
                                    }
                                }
                                                        
                                // Show the legend, containing numeric values between minimum and maximum.
                                // The number of values that need to be displayed, has been specified in the config screen.
                                if ($scope.config.showLegend === true) {
                                    var legendCanvas = document.getElementById('heatMapLegend_' + $scope.config.id);
                                    
                                    // Make sure the canvas size (width & height) match the size it is displayed on the screen (clientWidth & clientHeight).
                                    // Indeed a canvas has 2 sizes:
                                    // 1. The dimension of the pixels in the canvas (it's backing store or drawingBuffer) : set via DOM element attributes.
                                    //    This will set the size of the coordinate system that the canvas API will use.
                                    // 2. The display size : set via CSS style attributes.
                                    //    This will be the actual size of the canvas element, that will be drawn on the page.
                                    // Otherwise the numbers would be drawn at incorrect locations on the screen ...
                                    /*if (legendCanvas.width !== legendCanvas.clientWidth || legendCanvas.height !== legendCanvas.clientHeight) {
                                        legendCanvas.width = legendCanvas.clientWidth;
                                        legendCanvas.height = legendCanvas.clientHeight;
                                    }*/
                                    
                                    ratioWidth = 1;
                                    
                                    if (legendCanvas.clientWidth > 0) {
                                        ratioWidth = legendCanvas.width / legendCanvas.clientWidth;
                                    }

                                    var legendContext = legendCanvas.getContext("2d");
                                    
                                    legendContext.clearRect(0, 0, legendCanvas.clientWidth, legendCanvas.clientHeight);
                                    
                                    legendContext.font = "18px Arial";
                                    legendContext.textAlign = "center"; 
                                    legendContext.textBaseline = "top";
                                    
                                    var legendCount = parseInt($scope.config.legendCount) || 2;
                                    
                                    var margin = 40;
                                    
                                    // Show as many values as the user has specified.
                                    for (var j = 0; j < legendCount; j++) {
                                        // Calculate a fraction between 0 and 1
                                        var fraction = j / (legendCount - 1);
                                        
                                        // Calculate the numeric value, by interpolation between the minValue and maxValue
                                        var value = (maxValue - minValue) * fraction + minValue;
                                        
                                        // Calculate the color, by interpolation between blue ( rgb(0, 0, 255) ) and red ( rgb(255, 0 , 0) )
                                        var red   = (255 -   0) * fraction +   0;
                                        var green = (0   -   0) * fraction +   0;
                                        var blue  = (0   - 255) * fraction + 255;
                                        
                                        legendContext.fillStyle = "rgb(" + red + "," + green + "," + blue + ")";
                                        
                                        var x = ((legendCanvas.clientWidth - 2 * margin) * fraction + margin) * ratioWidth;
                                        
                                        var roundedValue = value.toFixed($scope.config.legendDecimals || 0);
                                        legendContext.fillText(roundedValue, x, 5);
                                    }
                                }
                            }
                        });
                     
                        $scope.change = function() {
                            // The data will be stored in the model on the scope
                            $scope.send({payload: $scope.textContent});
                        };

                        $scope.enterkey = function(keyEvent){
                            if (keyEvent.which === 13) {
                                $scope.send({payload: $scope.textContent});
                            }
                        };
                    }
                });
            }
        }
        catch (e) {
            console.log(e);
        }
		
        node.on("close", function() {
            if (done) {
                done();
            }
        });
    }

    RED.nodes.registerType("heat-map", HeatMapNode);
	
    // Make all the static resources from this node public available (i.e. heatmap.js or heatmap.min.js files).
    RED.httpNode.get('/ui/heatmap/js/*',  RED.auth.needsPermission('heatmap.read'), function(req, res){
        var options = {
            root: __dirname + '/lib/',
            dotfiles: 'deny'
        };
       
        // Send the requested file to the client (in this case it will be heatmap.min.js)
        res.sendFile(req.params[0], options)
    });
}
