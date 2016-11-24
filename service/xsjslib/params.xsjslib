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

	var err = $.import("error.xsjslib");
    /**
	* Defines the url query string parameters expected by the service.
	*
	* The keys in this object are the internal parameter names.
	* These correspond to the "name" part of the name/value parts
	* that make up the "query" part of the url.
	*
	* Internal parameter names are always UPPER CASE;
	* Parameter names in te url query string are always lower case.
	*
	* The values mapped to the keys are parameterDef objects.
	* ParameterDef objects have these properties:
	* - type: database data type. Used to validate the value
	* - maxlength (optional): maximum string length
	* - minvalue (optional): minimum allowed value
	* - maxvalue (optional): maximum allowed value
	* - method (optional): the HTTP method(s) to which this parameter applies. If not specified, the parameter applies to all methods. If specified, it can be either a string (comma separated list of HTTP methods), or an array (containing each method as a string element)
	*
	* @var parameterDefs
	*/
	var parameterDefs = {};

	function getDefaultMethod(method){
		if (method === undefined) {
			method = $.request.headers.get('~request_method').toUpperCase();
		}
		return method;
	}

	function getDefaultParameters(parameters) {
		if (parameters === undefined) {
			parameters = $.request.parameters;
		}
		else {
			var name, value, p = [];
			if (typeof parameters === "string") {
				parameters = parameters.split("&");
				var i, n = parameters.length, paramObject, paramsObject = {};
				for (i = 0; i < n; i++) {
					paramObject = parameters[i];
					paramObject = paramObject.split("=");
					paramsObject[paramObject[0]] = paramObject[1];
				}
				parameters = paramsObject;
			}
			for (name in parameters) {
				if (parameters.hasOwnProperty(name)) {
					value = parameters[name];
					p.push({name: name, value: value});
				}
			}
			p.get = function(name){
				var i = 0, n = p.length, item;
				for (i = 0; i < n; i++){
					item = p[i];
					if (item.name === name) {
						return item.value;
					}
				}
				return null;
			};
			parameters = p;
		}
		return parameters;
	}

	function defineParameter(name, parameterDef){
		var n;
		switch (arguments.length) {
			case 1:
				if (typeof name !== "object") {
					err.raise("defineParameter", arguments, "Single argument version of defineParameter accepts only an object with parameter names as keys and parameter definitions as values.");
				}
				var defs = name, v;
				for (n in defs){
					if (defs.hasOwnProperty(n)) {
						v = defs[n];
						defineParameter(n, v);
					}
				}
				break;
			case 2:
				parameterDefs[name] = parameterDef;
				break;
			default:
				if (arguments.length % 2) {
					err.raise("defineParameter", arguments, "Multi-argument version of define Parameter accepts only name/parameterDef pairs");
				}
				var i;
				n = arguments.length;
				for (i = 0; i < n; i++) {
					defineParameter(arguments[i], arguments[++i]);
				}
		}
	}

	/**
	*	This is a helper for validateParameters().
	*
	*   This checks whether the parameter with the specified name applies to the specified HTTP method.
	*
	*   @function isParameterApplicableForMethod
	*   @param parameterName {string} Name of the parameter definition to examine
	*   @param method {string} HTTP method to search for
	*/
	function isParameterApplicableForMethod(parameterName, method){
		method = getDefaultMethod(method);

		var parameterDef = parameterDefs[parameterName];
		var parameterDefMethod = parameterDef.methods;


		if (parameterDefMethod === undefined) {
			//parameterDef does not specify any particular method;
			//this means it applies to all methods
			return true;
		}

		var parameterDefMethodType = typeof parameterDefMethod;
		//extract all methods
		var parameterDefMethods;
		if (parameterDefMethodType === "string") {
			parameterDefMethods = parameterDefMethod.split(",");
		}
		else
		if (parameterDefMethod.constructor === Array) {
			parameterDefMethods = parameterDefMethod;
		}
		else {
			err.raise(
				"isParameterApplicableForMethod",
				arguments,
				"Method property of parameter definition " + parameterName + " must be either a string or an array of strings."
			);
		}

		//check each method
		var i, n = parameterDefMethods.length;
		for (i = 0; i < n; i++) {
			parameterDefMethod = parameterDefMethods[i];

			if (typeof parameterDefMethod !== "string") {
				err.raise(
					"isParameterApplicableForMethod",
					arguments,
					"Method property of parameter definition " + parameterName + " must be either a string or an array of strings."
				);
			}
			parameterDefMethod = parameterDefMethod.trim();
			if (method === parameterDefMethod) {
				return true;
			}
		}

		//no matching method.
		return false;
	}
	/**
	*	This is a helper for validateParamters().
	*
	*	Validates a parameter from the query part of the url
	*	against its corresponding parameter definition
	*
	*	If the parameter is found to be invalid, and error is thrown.
	*	If the paramter is found to be valid, its (typed) value will be returned.
	*
	*	@function validateParameter
	*	@param parameterName {string} The name of the parameter to validate
	*	@return {scalar} Returns the (typed) value for this parameter.
	*/
	function validateParameter(parameterName, parameters){
		var parameterDef = parameterDefs[parameterName];
		var parameterValue = parameters.get(parameterName.toLowerCase()) || parameterDef.value;
		if (parameterDef.mandatory !== false && parameterValue === undefined) {
			err.raise(
				"validateParameter",
				arguments,
				"Parameter " + parameterName + " is mandatory."
			);
		}
		switch (parameterDef.type) {
			case "VARCHAR":
			case "NVARCHAR":
				break;
			case "INTEGER":
				if (parameterValue !== undefined) {
					if (/\d+/g.test(parameterValue)=== true) {
						parameterValue = parseInt(parameterValue, 10);
					}
					else {
						err.raise(
							"validateParameter",
							arguments,
							"Parameter " + parameterName + " should be an integer."
						);
					}
				}
				break;
			default:
		}
		if (parameterDef.minvalue !== undefined && parameterValue < parameterDef.minvalue) {
			err.raise(
				"validateParameter",
				arguments,
			    "Value " + parameterValue + " of parameter " + parameterName +
				" is smaller than the minimum value " + parameterDef.minvalue
			);
		}
		if (parameterDef.maxvalue !== undefined && parameterValue > parameterDef.maxvalue) {
			err.raise(
				"validateParameter",
				arguments,
				"Value " + parameterValue + " of parameter " + parameterName +
				" is larger than the maximum value " + parameterDef.maxvalue
			);
		}
		if (parameterDef.values !== undefined && parameterValue !== undefined) {
			var i, values = parameterDef.values, n = values.length, value;
			for (i = 0; i < n; i++) {
				value = values[i];
				if (value === parameterValue) {
					break;
				}
			}
			if (i >= n) {
				err.raise(
					"validateParameter",
					arguments,
					"Value for parameter " + parameterName + " must be one of: " + values.join(",") + "; Found: " + parameterValue
				);
			}
		}
		return parameterValue;
	}

	/**
	*	Function to validate url query string parameters.
	*	If validation succeeds, this returns an object representing the canonical parameters.
	*	Any service functionality that needs to access a paramter, should use that object
	*	rather than accessing $.request.parameters directly.
	*
	*	@function validateParameters
	*	@param the HTTP method
	*	@return {object} An object that maps canonical (upper case) parameternames to their validated typed value
	*/
	function validateParameters(method, parameters){
		method = getDefaultMethod(method);
		parameters = getDefaultParameters(parameters);
		var parameterName, parameterValue, parameterValues = {};

		for (parameterName in parameterDefs) {
			if (parameterDefs.hasOwnProperty(parameterName)) {
				if (!isParameterApplicableForMethod(parameterName, method)) {
					continue;
				}
				parameterValue = validateParameter(parameterName, parameters);
				parameterValues[parameterName] = parameterValue;
			}
		}
		return parameterValues;
	}

	function getParameterDefs(){
		var string = JSON.stringify(parameterDefs);
		var obj = JSON.parse(string);
		return obj;
	}

	exports.define = defineParameter;
	exports.isDefined = isParameterApplicableForMethod;
	exports.validate = validateParameters;
	exports.getDefs = getParameterDefs;

}(this));
