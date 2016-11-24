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
(function(){

	var config = $.import("config.xsjslib");
	var error = $.import("xsjslib/error.xsjslib");
	var params = $.import("xsjslib/params.xsjslib");
	var sql = $.import("xsjslib/sql.xsjslib");
	var zip = $.import("xsjslib/zip.xsjslib");
	var querybuilder = $.import("xsjslib/querybuilder.xsjslib");

	sql.setDatabaseInterface(config.databaseInterface || sql.getDefaultDatabaseInterface());
	zip.setZipInterface(config.zipInterface || zip.getDefaultZipInterface());
	var httpStatus;

	function parseRequestPredicates(predicateString){
		var match, predicates = {}, name, value;
		var re = /(\s*,\s*)?("[^"]+"|[A-Za-z_][A-Za-z_#$]*)\s*=\s*('([^']|'')+'|[^\),]*)/g;
		while (true) {
			match = re.exec(predicateString);
			if (!match) {
				break;
			}
			name = match[2];
			value = match[3];
			if (value.charAt(0) === "'") {
				value = value.substr(1, value.length - 2);
			}
			predicates[name] = value;
		}
		return predicates;
	}

	function parseGetRequest(queryPath){
		var req = {};
		if (queryPath === undefined) {
			queryPath = $.request.queryPath;
		}
		if (!queryPath) {
			httpStatus = $.net.http.BAD_REQUEST;
			error.raise("parseGetRequest", null, "querypath must be specified");
		}
		//            1: schema                       /2: table                       3: key                                                                                                               http method
		var match = /^("[^"]+"|[A-Za-z_][A-Za-z_#$]*)\/("[^"]+"|[A-Za-z_][A-Za-z_#$]*)(\(\s*("[^"]+"|[A-Za-z_][A-Za-z_#$]*)\s*=\s*([^\),]*)(\s*,\s*("[^"]+"|[A-Za-z_][A-Za-z_#$]*)\s*=\s*([^\),]*))*\s*\))?( *HTTP\/\d+\.\d+)?$/.exec(queryPath);
		if (!match) {
			httpStatus = $.net.http.BAD_REQUEST;
			error.raise("parseGetRequest", null, "Invalid querypath " + queryPath + " does not match schema/table pattern.");
		}
		req.schemaName = match[1];
		req.tableName = match[2];

		var predicateString = match[3];
		if (predicateString) {
			predicateString = predicateString.substr(1, predicateString.length - 2);	//pinch off the left and right parenthesis.
			var predicates = parseRequestPredicates(predicateString);
			req.predicates = predicates;
		}
		return req;
	}

	function getData(req, parameters){
		var query = querybuilder.buildQuery(req, parameters);
		//throw query;
		sql.openConnection();
		var resultset;
		try {
			resultset = sql.executeQuery(query);
		}
		catch (e) {
			var string = e.toString(), match;
			match = /SQL error. NR: (\d+)/.exec(string);
			if (match) {
				var code = parseInt(match[1], 10);
				switch (code) {
					case 258:
						httpStatus = 403;
						error.raise("getData", null, "Insufficient privileges", e);
						break;
					case 259:
						httpStatus = 404;	//FIXME: is this a desired response? Would 400 BAD REQUEST be more appropriate?
						error.raise("getData", null, "Invalid table name", e);
						break;
					case 260:
						httpStatus = 404;	//FIXME: is this a desired response? Would 400 BAD REQUEST be more appropriate?
						error.raise("getData", null, "Invalid column name", e);
						break;
					case 362:
						httpStatus = 404;	//FIXME: is this a desired response? Would 400 BAD REQUEST be more appropriate?
						error.raise("getData", null, "Invalid schema name", e);
						break;
					default:
						throw e;
				}
			}
			else {
				throw e;
			}
		}
		return resultset;
	}

	function getContentType(parameters){
		var contentType;
		var format = parameters.$format;
		if (format === undefined) {
			contentType = $.request.headers.get("accept");
		}
		else {
			contentType = config.formats[format];
		}
		if (contentType === undefined) {
			httpStatus = $.net.http.NOT_ACCEPTABLE;
			error.raise("getContentType", null, "Can't find suitable content type for format.");
		}
		return contentType;
	}

	function getContentTypeHandler(contentType){
		var contentTypeHandler = config.contentTypes[contentType];
		if (contentTypeHandler === undefined) {
			httpStatus = $.net.http.NOT_ACCEPTABLE;
			error.raise("getContentTypeHandler", null, "No handler found for content type: " + contentType + ".");
		}
		try {
			contentTypeHandler = $.import(contentTypeHandler);
			if (contentTypeHandler === undefined) {
				throw "Contenthandler not defined";
			}
		}
		catch (e){
			//httpStatus = $.net.http.INTERNAL_SERVER_ERROR;
			httpStatus = $.net.http.BAD_REQUEST;
			error.raise("getContentTypeHandler", null, "Error importing content type handler " + contentTypeHandler + " for contentType " + contentType + ".", e);
		}
		return contentTypeHandler;
	}

	function createGetReponse(resultset, parameters){
		var contentType = getContentType(parameters);
		var contentTypeHandler = getContentTypeHandler(contentType);
		var response = contentTypeHandler.handleRequest(parameters, contentType, resultset);
		var headers = response.headers;
		if (!headers) {
			headers = response.headers = {};
		}
		if (!headers["Content-Type"]){
			headers["Content-Type"] = contentType;
		}
		return response;
	}

	function handleGetRequest(parameters){
		var req = parseGetRequest();
		var resultset = getData(req, parameters);
		var response = createGetReponse(resultset, parameters);
		httpStatus = 200;
		return response;
	}

	function handlePostRequest(parameters) {
		var queryPath = $.request.queryPath;
		if (queryPath !== "$batch") {
			error.raise("handlePostRequest", arguments, "POST request must be a $batch request, found: " + queryPath);
		}
		var contentType;
		contentType = $.request.contentType;
		var match = /multipart\/mixed; *boundary=(.+)/.exec(contentType);
		if (!match) {
			error.raise("handlePostRequest", arguments, "Content Type must be multipart/mixed and specify a boundary.");
		}

		contentType = getContentType(parameters);
		var contentTypeHandler = getContentTypeHandler(contentType);
		if (contentTypeHandler.handleBatchStart === undefined || contentTypeHandler.handleBatchPart === undefined || contentTypeHandler.handleBatchEnd === undefined) {
			throw "$batch requests not supported by content handler for " + contentType;
		}

		var data, batchContext;
		batchContext = contentTypeHandler.handleBatchStart(parameters, contentType);

		var entity, i, entities = $.request.entities, n = entities.length;
		var query, getRequest, getParameters;
		for (i = 0; i < n; i++){
			entity = entities[i].body.asString();
			match = /GET\s(.+)/.exec(entity);
			if (!match) {
				throw "Invalid entity " + i + ": " + entity;
			}
			match = match[1].split("?");
			queryPath = match[0];

			getRequest = parseGetRequest(queryPath);
			if (match.length > 1){
				match.shift();
				query = match.join("?");
			}
			else {
				query = {};
			}
			getParameters = params.validate("GET", query);

			data = getData(getRequest, getParameters);
			contentTypeHandler.handleBatchPart(batchContext, getParameters, data);
		}

		var body = contentTypeHandler.handleBatchEnd(batchContext);
		httpStatus = 200;
		return {
			headers: {
				"Content-Type": contentType
			},
			body: body
		};
	}

	function checkUnsupportedQueryOptions(parameters){
		if (parameters.$inlinecount) {
			httpStatus = $.net.http.BAD_REQUEST;
			error.raise("handleRequest", null, "OData system query option $inlinecount is not supported.");
		}
		if (parameters.$expand) {
			httpStatus = $.net.http.BAD_REQUEST;
			error.raise("handleRequest", null, "OData system query option $expand is not supported.");
		}
	}

	function handleRequest(methods, parameters){
		var method = $.request.headers.get('~request_method').toUpperCase();
		var httpMethodHandler = methods[method];
		if (!httpMethodHandler) {
			httpStatus = $.net.http.METHOD_NOT_ALLOWED;
			error.raise(
				"handleRequest",
				arguments,
				"No handler found for method " + method
			);
		}
		parameters = params.validate(method, parameters);
		checkUnsupportedQueryOptions(parameters);
		var handlerResult = httpMethodHandler(parameters);
		var downloadFile = parameters.download;
		if (downloadFile) {
			handlerResult.headers["Content-Disposition"] = "attachment; filename=" + downloadFile;
		}
		return handlerResult;
	}

	params.define({
		"$orderby": {
			type: "VARCHAR",
			mandatory: false
		},
		"$top": {
			type: "INTEGER",
			mandatory: false
		},
		"$skip": {
			type: "INTEGER",
			mandatory: false
		},
		"$filter": {
			type: "VARCHAR",
			mandatory: false
		},
		//not implemented
		"$expand": {
			type: "VARCHAR",
			mandatory: false
		},
		"$format": {
			type: "VARCHAR",
			mandatory: false
		},
		"$select": {
			type: "VARCHAR",
			mandatory: false
		},
		//not implemented
		"$inlinecount": {
			type: "VARCHAR",
			mandatory: false
		},
		//Custom option to allow download of entity (content disposition header)
		//value for the download param is the preferred file name.
		"download": {
			type: "VARCHAR",
			mandatory: false
		},
		"header": {
			type: "VARCHAR",
			mandatory: false,
			value: "true"
		}
	});

	function main(){
		try {
			var response = handleRequest({
				"GET": handleGetRequest,
				"POST": handlePostRequest
			});
			var header, value, headers = response.headers;
			for (header in headers) {
				if (headers.hasOwnProperty(header)) {
					value = headers[header];
					$.response.headers.set(header, value);
				}
			}
			if (response.body) {
				$.response.setBody(response.body);
			}
			if (response.status) {
				httpStatus = response.status;
			}
		}
		catch (e) {
			if (!httpStatus) {
				httpStatus = $.net.http.BAD_REQUEST;
				$.response.contentType = "text/plain";
				$.response.setBody(e.toString());
			}
			$.response.setBody(e.toString());
		}
		finally {
			sql.closeConnection();
			$.response.status = httpStatus || $.net.http.BAD_REQUEST;
		}
	}

	main();
}());
