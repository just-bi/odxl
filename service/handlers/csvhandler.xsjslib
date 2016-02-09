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
	
	var csv = $.import("../xsjslib/csv.xsjslib");
	var params = $.import("../xsjslib/params.xsjslib");

	params.define({
		"fieldsep": {
			type: "VARCHAR",
			mandatory: false,
			value: ","
		},
		"enclosedby": {
			type: "VARCHAR",
			mandatory: false,
			value: "\""
		},
		"escapedby": {
			type: "VARCHAR",
			mandatory: false,
			value: "\""
		},
		"rowsep": {
			type: "VARCHAR",
			mandatory: false,
			value: "\r\n"
		},
		"nulls": {
			type: "VARCHAR",
			mandatory: false,
			value: ""
		}
	});
	
	function handleRequest(parameters, contentType, resultset){
		try {
			parameters = params.validate();
			var body = csv.writeResultsetAsCsv(resultset, parameters);
			return {
				body: body,
				headers: {
					"Content-Type": contentType
				}
			};
		}
		catch (e){
			throw e.toString() + " - " + e.linenumber + " " + JSON.stringify(e.stack, "", " ");
		}
	}
	
	exports.handleRequest = handleRequest;
	
}(this));