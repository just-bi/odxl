/*
Copyright 2016 Just-BI BV, Roland Bouman (roland.bouman@just-bi.nl)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
(function(exports){

//default format for app OData calls.
var format = "$format=json";

//parse location to discover service paths
var location = window.location;
var path = location.pathname.split("/");

path.pop();	//snip off index.html
path.pop();	//snip off ui

//path of the client
var appPath = path.join("/");
//app OData service endpoint. Used to get list of schema, tables, columns etc. Not required to call ODXL
var appODataServiceEndpoint = location.protocol + "//" + location.host + appPath + "/services/odxl_user_objects.xsodata/";

path.pop();	//snip off app

//odxl service path
var servicePath = path.concat(["service"]).join("/");

//actual odxl service endpoint. This is the actual ODXL service.
var odxlServiceEndpoint = location.protocol + "//" + location.host + servicePath + "/odxl.xsjs";
exports.odxlServiceEndpoint = odxlServiceEndpoint;

exports.getOData = function getOData(query, callback, scope){
	var url = appODataServiceEndpoint + query;
	var xhr = new XMLHttpRequest();
	xhr.open("GET", url, true);
	xhr.setRequestHeader("Accept", "application/json");
	xhr.onload = function(){
		var data = JSON.parse(this.responseText);
		data = data.d.results;
		callback.call(scope || null, data);
	};
	xhr.send(null);
};

exports.clearSelector = function clearSelector(selector) {
	var options = selector.options;
	selector.selectedIndex = 0;
	while (options.length > 1) {
		selector.removeChild(options[options.length - 1]);
	}
};

exports.populateSelectorWithData = function populateSelectorWithData(selector, data, column){
	clearSelector(selector);
	var i, n = data.length, item, option;
	for (i = 0; i < n; i++){
		item = data[i];
		option = document.createElement("option");
		option.label = option.value = option.innerHTML = item[column];
		selector.appendChild(option);
	}
};

exports.getSelectedValue = function getSelectedValue(selector){
	var selectedIndex = selector.selectedIndex;
	if (selectedIndex === 0) {
		return null;
	}
	var value = selector.options[selectedIndex].value;
	return value;
};

exports.quoteIdentifierIfNecessary = function quoteIdentifierIfNecessary(identifier){
	if (!/^[A-Z_][A-Z_\d]+$/g.test(identifier)){
		identifier = "\"" + identifier + "\"";
	}
	return identifier;
};

exports.createOptionsSelector = function createOptionsSelector(options, onchangeHandler){
	var selector = document.createElement("SELECT");
	var option;

	selector.onchange = onchangeHandler;

	option = document.createElement("OPTION");
	selector.appendChild(option);

	for (var k in options) {
		option = document.createElement("OPTION");
		option.value = k;
		option.label = option.innerHTML = options[k];
		selector.appendChild(option);
	}

	return selector;
}

}(window));
