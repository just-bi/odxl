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
	/**
	 * List of valid values for the OData $format query parameter.
	 * The values map to a mime-type. See contentTypes
	 */
	exports.formats = {
		"xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"csv":	"text/csv",
		"ods": 	"application/vnd.oasis.opendocument.spreadsheet",
		"zip":  "application/zip"
	};
	
	/**
	 * Maps content types to handlers.
	 * The odxl service uses this to load and execute the appropriate output handler to deliver data in the response.
	 */
	exports.contentTypes = {
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "handlers/xlsxhandler.xsjslib",
		"text/csv": "handlers/csvhandler.xsjslib",
		"application/vnd.oasis.opendocument.spreadsheet": "handlers/odshandler.xsjslib",
		"application/zip": "handlers/xlsxhandler.xsjslib"
	};
}(this));