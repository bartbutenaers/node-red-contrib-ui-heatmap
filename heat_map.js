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

        var html = String.raw`
        <script src="heatmap/js/heatmap.min.js"></script>
        <div id="heatMapContainer` + config.id + `" width="100%" height="100%" ng-init='init(` + configAsJson + `)'>
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
    
    // See https://gist.github.com/maxwells/8251275
    function findColorBetween(left, right, percentage) {
        newColor = {};
        components = ["r", "g", "b"];
        for (var i = 0; i < components.length; i++) {
            c = components[i];
            newColor[c] = Math.round(left[c] + (right[c] - left[c]) * percentage / 100);
        }
        return new Color(newColor);
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
                            
                            var parentDiv = document.getElementById('heatMapContainer' + config.id)
                            
                            $scope.heatMapInstance = h337.create({
                                container: parentDiv
                            });
                        }

                        $scope.$watch('msg', function(msg) {
                            if (!msg) {
                                // Ignore undefined msg
                                return;
                            }
                            
                            debugger;

                            if (msg.payload && Array.isArray(msg.payload) && msg.payload.length === $scope.config.rows * $scope.config.columns) {
                                var maxValue = 0;
                                var minValue = Number.MAX_VALUE;
                                var points = [];
                                var index = 0;
                                
                                var parentDiv = document.getElementById('heatMapContainer' + $scope.config.id);
                                
                                var columns = parseInt($scope.config.columns);
                                var rows = parseInt($scope.config.rows);
                                
                                // Calculate the width and height ratios, from the data matrix to the available canvas size
                                var ratioWidth  = parentDiv.width  / columns;
                                var ratioHeight = parentDiv.height / rows;
                                
                                // When the minimum/maximum values are specified in the config screen, those values should be used
                                if ($scope.config.minMax === true) {
                                    maxValue = $scope.config.maximum;
                                    minValue = $scope.config.minimum;
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

                                // Refresh the heatmap content, by setting new values
                                $scope.heatMapInstance.setData(data);
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
	
    // Make all the static resources from this node public available (i.e. heatmap.js library).
    RED.httpAdmin.get('/ui/heatmap/js/*', function(req, res){
        debugger;
        var options = {
            root: __dirname + '/lib/',
            dotfiles: 'deny'
        };
       
        // Send the requested file to the client (in this case it will be heatmap.min.js)
        res.sendFile(req.params[0], options)
    });
}
