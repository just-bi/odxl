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

	var error = $.import("error.xsjslib");

	var dbInterface = getDefaultDatabaseInterface();
	function getDefaultDatabaseInterface(){
		if ($.hdb) {
			return "hdb";
		}
		else
		if ($.db) {
			return "db";
		}
		else {
			error.raise("getDefaultDatabaseInterface", null, "No database interface found!");
		}
		return null;
	}

	function setDatabaseInterface(dbi){
		var interfaces = {
			"hdb": true,
			"db": true
		};
		if (interfaces[dbi] === undefined) {
			error.raise("setDatabaseInterface", null, "Unknown database interface name " + dbi);
		}
		if ($[dbi] === undefined) {
			error.raise("setDatabaseInterface", null, "Database interface " + dbi + " not available.");
		}
		dbInterface = dbi;
	}

	function getDatabaseInterface(dbi){
		if (dbi === undefined){
			dbi = dbInterface;
		}
		return $[dbi];
	}

	var connection;
	/**
	*	Opens the connection and makes sure autocommit is disabled.
	*	We require this becuase typically our interaction with the
	*	db spans multiple statements
	*
	*	@function openConnection
	*/
	function openConnection(){
		var dbi = getDatabaseInterface(dbi);
		connection = dbi.getConnection();
		connection.setAutoCommit(false);
	}

	function rollbackTransaction(){
		if (connection) {
			connection.rollback();
			connection.setAutoCommit(false);
		}
	}

	function commitTransaction(){
		if (connection) {
			connection.commit();
			connection.setAutoCommit(false);
		}
	}

	function getConnection(){
		if (connection === undefined) {
			openConnection();
		}
		return connection;
	}
	/**
	*	Closes the connection
	*
	*	@function closeConnection
	*/
	function closeConnection(){
		if (!connection) {
			return false;
		}
		connection.close();
		connection = undefined;
		return true;
	}

	function makeObjectName(namesObject){
		var fullName, contextName, packageName;
		switch (typeof namesObject) {
			case "string":
				namesObject = {
					objectName: namesObject
				};
				break;
			case "object":
				break;
			default:
				error.raise(
					"makeObjectName",
					arguments,
					"Invalid name object."
				);
		}
		fullName = namesObject.objectName;

		contextName = namesObject.contextName;
		if (contextName) {
			fullName = contextName + "." + fullName;
		}

		packageName = namesObject.packageName;

		if (namesObject.subPackageName) {
			packageName += "." + namesObject.subPackageName;
		}
		fullName = packageName + "::" + fullName;

		fullName = "\"" + fullName + "\"";
		return fullName;
	}

	/**
	*	Create a fully qualified table name from the names in the nameObject parameter.
	*	The namesObject parameter has the following keys:
	*
	*	- packageName: the name of the package in the .hdbdd file
	*	- contextName: the context in the .hdbdd file
	*	- schemaName: the database schema name
	*	- tableName: the actual unqualified table name.
	*
	*	All these items, except the tableName, will be defaulted with defaults if not specified.
	*
	*	Alternatively, you can also pass a single string representing the unqalified tablename.
	*	In that case, defaults will be used for all other name parts.
	*
	*	@function makeTableName
	*	@param {object|string} namesObject Either a bag of different types of names that together make up a fully qualified table name, or a string representing a plain unqualified table name.
	*	@return {string} A single string that represents a fully qualified table name.
	*/
	function makeTableName(namesObject){
		var fullName, schemaName;

		if (typeof namesObject === "string"){
			namesObject = {
				objectName: namesObject
			};
		}

		fullName = makeObjectName(namesObject);

		schemaName = namesObject.schemaName;
		schemaName = "\"" + schemaName + "\"";

		fullName = schemaName + "." + fullName;
		return fullName;
	}

	function makeProcedureName(namesObject){
		var fullName;

		if (typeof namesObject === "string"){
			namesObject = {
				objectName: namesObject
			};
		}
		fullName = makeObjectName(namesObject);
		return fullName;
	}

	function createCalcViewPlaceholder(name, value) {
		name = name.replace(/'/g, "''");
		value = String(value).replace(/'/g, "''");
		return "'PLACEHOLDER' = ('$$" + name + "$$', '" + value + "')";
	}

	function createCalcViewPlaceholders(parameters) {
		var placeHolders = [];
		var name, calcViewPlaceHolder, value;
		for (name in parameters) {
			if (parameters.hasOwnProperty(name)) {
				value = parameters[name];
				calcViewPlaceHolder = createCalcViewPlaceholder(name, value);
				placeHolders.push(calcViewPlaceHolder);
			}
		}
		return "(" + placeHolders.join(", ") + ")";
	}

	var DBResultSet;
	(DBResultSet = function(resultset){
		this.resultset = resultset;
	}).prototype = {
		iterate: function(callback, scope){
			var resultset = this.resultset;
			var metadata = resultset.getMetaData();
			var extractor, extractors = [], n = metadata.getColumnCount(), i, col;
			for (i = 1; i <= n; i++) {
				extractor = {name: metadata.getColumnName(i)};
				extractors[i] = extractor;
				switch (metadata.getColumnType(i)){
					case 1: 	//TINYINT
					case 2: 	//SMALLINT
					case 3: 	//INT
					case 4: 	//BIGINT
						extractor.func = resultset.getInteger;
						break;
					case 5: 	//DECIMAL
						extractor.func = resultset.getDecimal;
						break;
					case 6: 	//REAL
						extractor.func = resultset.getReal;
						break;
					case 7: 	//DOUBLE
						extractor.func = resultset.getDouble;
						break;
					case 8: 	//CHAR
					case 9: 	//VARCHAR
						extractor.func = resultset.getString;
						break;
					case 10:	//NCHAR
					case 11:	//NVARCHAR
						extractor.func = resultset.getNString;
						break;
					case 12:	//BINARY
					case 13:	//VARBINARY
						extractor.func = resultset.getBString;
						break;
					case 14:	//DATE
						extractor.func = resultset.getDate;
						break;
					case 15:	//TIME
						extractor.func = resultset.getTime;
						break;
					case 16:	//TIMESTAMP
						extractor.func = resultset.getTimestamp;
						break;
					case 25:	//CLOB
						extractor.func = resultset.getClob;
						break;
					case 26:	//NCLOB
						extractor.func = resultset.getNClob;
						break;
					case 27:	//BLOB
						extractor.func = resultset.getBlob;
						break;
					case 47:	//SMALLDECIMAL
						extractor.func = resultset.getDecimal;
						break;
					case 51:	//TEXT
					case 52:	//SHORTTEXT
					case 55:	//ALPHANUM
						extractor.func = resultset.getText;
						break;
					case 62:	//SECONDDATE
						extractor.func = resultset.getSecondDate;
						break;
					case 45:	//TABLE
            /* falls through */
					default:
						error.raise("iterate", null, "Don't know which extractor to use for data type: " + metadata.getDataTypeName(i));
				}
			}
			var row, rownum = 0;
			while (resultset.next()){
				row = {};
				for (i = 1; i <= n; i++) {
					extractor = extractors[i];
					row[extractor.name] = extractor.func.call(resultset, i);
				}
				callback.call(scope || null, rownum, row);
				rownum += 1;
			}
			resultset.close();
		},
		getColumnMetadata: function(){
			var metadata = this.resultset.getMetaData();
			var ret = [], n = metadata.getColumnCount(), i, col;
			for (i = 1; i < n; i++) {
				col = {
					catalogName: metadata.getCatalogName(i),
					displaySize: metadata.getColumnDisplaySize(i),
					label: metadata.getColumnLabel(i),
					name: metadata.getColumnName(i),
					type: metadata.getColumnType(i),
					typeName: metadata.getColumnTypeName(i),
					precision: metadata.getPrecision(i),
					scale: metadata.getScale(i),
					tableName: metadata.getTableName(i),
					isNullable: true
				};
				ret.push(col);
			}
			return ret;
		}
	};

	var HDBResultSet;
	(HDBResultSet = function(resultset){
		this.resultset = resultset;
	}).prototype = {
		iterate: function(callback, scope){
			var resultset = this.resultset;
			var rownum = 0, iterator = resultset.getIterator();
			while (iterator.next()) {
				callback.call(scope || null, rownum, iterator.value());
				rownum += 1;
			}
		},
		getColumnMetadata: function(){
			return this.resultset.metadata.columns;
		}
	};

	function hdbQuery(sql, parameters){
		var connection = getConnection();
		var args = [sql];

		if (parameters) {
			var i, n = parameters.length;
			for (i = 0; i < n; i++) {
				args.push(parameters[i].value);
			}
		}

		var resultset = connection.executeQuery.apply(connection, args);
		var hdbResultSet = new HDBResultSet(resultset);
		return hdbResultSet;
	}

	function dbQuery(sql, parameters){
		var connection = getConnection();
		var statement = connection.prepareStatement(sql);
		if (parameters) {
			var i, parameter, n = parameters.length;
			for (i = 0; i < n; i++) {
				parameter = parameters[i];
				if (parameter === undefined || parameter.value === null) {
					statement.setNull(i);
					continue;
				}
				switch (parameters[i].type){
					case 1: 	//TINYINT
						statement.setTinyInt(i, parameter.value);
						break;
					case 2: 	//SMALLINT
						statement.setSmallInt(i, parameter.value);
						break;
					case 3: 	//INT
						statement.setInteger(i, parameter.value);
						break;
					case 4: 	//BIGINT
						statement.setBigInt(i, parameter.value);
						break;
					case 47:	//SMALLDECIMAL
					case 5: 	//DECIMAL
						statement.setDecimal(i, parameter.value);
						break;
					case 6: 	//REAL
						statement.setReal(i, parameter.value);
						break;
					case 7: 	//DOUBLE
						statement.setDouble(i, parameter.value);
						break;
					case 8: 	//CHAR
					case 9: 	//VARCHAR
						statement.setString(i, parameter.value);
						break;
					case 10:	//NCHAR
					case 11:	//NVARCHAR
						statement.setNString(i, parameter.value);
						break;
					case 12:	//BINARY
					case 13:	//VARBINARY
						statement.setBString(i, parameter.value);
						break;
					case 14:	//DATE
						statement.setDate(i, parameter.value);
						break;
					case 15:	//TIME
						statement.setTime(i, parameter.value);
						break;
					case 16:	//TIMESTAMP
						statement.setTimestamp(i, parameter.value);
						break;
					case 25:	//CLOB
						statement.setClob(i, parameter.value);
						break;
					case 26:	//NCLOB
						statement.setNClob(i, parameter.value);
						break;
					case 27:	//BLOB
						statement.setBlob(i, parameter.value);
						break;
					case 51:	//TEXT
					case 52:	//SHORTTEXT
					case 55:	//ALPHANUM
						statement.setText(i, parameter.value);
						break;
					case 62:	//SECONDDATE
					case 45:	//TABLE
            /* falls through */
					default:
						error.raise("iterate", null, "Don't know which extractor to use for data type: " + metadata.getDataTypeName(i));
				}
			}
		}
		var resultset = statement.executeQuery();
		var dbResultset = new DBResultSet(resultset);
		return dbResultset;
	}

	function executeQuery(sql, parameters){
		var interfaces = {
			"db": dbQuery,
			"hdb": hdbQuery
		};
		var func = interfaces[dbInterface];
		if (func === undefined) {
			error.raise("executeQuery", null, "No implementation found for database interface " + dbInterface);
		}
		var resultset = func.call(null, sql, parameters);
		return resultset;
	}

	function queryParameterizedCalculationView(nameObject, parameters){
		var sql;
		try {
			var rs = null;
			if ((typeof nameObject) === "string") {
				nameObject = {
					tableName: nameObject
				};
			}

			var tableName = "\"_SYS_BIC\"." +
			                "\"" +
							nameObject.packageName + "."  +
							nameObject.subPackageName + "/" +
							nameObject.tableName +
			                "\""
			;
			sql = "SELECT * FROM " + tableName;
			if (parameters) {
				sql += "\n" + createCalcViewPlaceholders(parameters);
			}
			rs = executeQuery(sql);
			return rs;
		}
		catch (e) {
			error.raise("queryParameterizedCalculationView", arguments, sql, e);
		}
		return null;
	}
	/**
	*	Utility to get all values from a particular column from table into an object.
	*
	*	@function getRowList
	*	@param namesObject {object} Information to create table and column name. See makeTableName()
	*	@return an object with column values as both keys and values.
	*/
	function getRowList(namesObject){
		var list = {};
		var fullTableName = makeTableName(namesObject);
		var columnName = namesObject.columnName;
		var query = " SELECT DISTINCT " + columnName +
					" FROM   " + fullTableName
		;
		var value, rs = executeQuery(query);
		rs.iterate(function(rownum, row){
			value = row[columnName];
			list[value] = value;
		});
		return list;
	}

	function getColumnAssignment(columnAssignments, columnName){
		var columnAssignment = columnAssignments[columnName];
		switch (typeof columnAssignment) {
			case "undefined":
				columnAssignment = null;
				/* falls through */
			case "object":
				if (columnAssignment === null) {
					columnAssignment = {expression: "NULL"};
				}
				break;
			default:
				columnAssignment = {value: columnAssignment};
		}
		return columnAssignment;
	}
	/**
	*	Create the SQL for a INSERT INTO <table>(<columns...>) VALUES (<expressions and parameters>) statement
	*
	*	@function createInsertValuesStatement
	*   @param {object|string} namesObject
	*   @param {object|string} columnAssignments
	*   @return {string} the SQL statement text
	*/
	function createInsertValuesStatement(namesObject, columnAssignments){
		try {
			var tableName = makeTableName(namesObject);

			var columns = [], parameters = [];
			var columnName, columnAssignment;
			for (columnName in columnAssignments) {
				if (columnAssignments.hasOwnProperty(columnName)) {
					columns.push(columnName);
					columnAssignment = getColumnAssignment(columnAssignments, columnName);
					if (columnAssignment.expression !== undefined) {
						parameters.push(columnAssignment.expression);
					}
					else
					if (columnAssignment.value !== undefined) {
						parameters.push("?");
					}
				}
			}

			columns 	= "(" + columns.join(",") + ")";
			parameters	= "(" + parameters.join(",") + ")";

			var sql = 	"insert "			+
						"into " + tableName	+
			 			columns				+
			 			"values" 			+
			 			parameters
			;
			return sql;
		}
		catch (e) {
			error.raise("createInsertValuesStatement", null, "");
		}
		return null;
	}

	/*
	*	A place to cache procedures. This is used by callProcedure()
	*	and should not be accessed directly.
	*
	*	@var procedureCache
	*/
	var procedureCache = {};

	/**
	*	A function to call a database stored procedure.
	*
	*	@function callProcedure
	*	@param namesObject {object |string} name of the procedure.
	*	@param parametersObject {object} Name/value pairs to use as procedure parameters.
	*	@return {$.hdb.ProcedureResult} A procedure result. Resultsets and output parameters can be retrieved from here.
	*/
	function callProcedure(namesObject, parametersObject){
		var schemaName = namesObject.schemaName;

		var schema = procedureCache[schemaName];
		if (!schema) {
			schema = {};
			procedureCache[schemaName] = schema;
		}
		var procName = makeProcedureName(namesObject);

		var proc = schema[procName];
		var connection = getConnection();
		if (!proc) {
			proc = connection.loadProcedure(schemaName, procName);
			schema[procName] = proc;
		}

		var result;
		result = proc.call(connection, parametersObject);

		return result;
	}

	//https://help.sap.com/saphelp_hanaplatform/helpdata/en/20/9f5020751910148fd8fe88aa4d79d9/content.htm
	function checkIdentifier(identifier, quote){
		var match = /^\"[^\"]+\"|[_A-Za-z][A-Za-z0-9_#$]*$/.exec(identifier);
		if (match){
			if (quote && identifier.charAt(0) !== "\"") {
				identifier = "\"" + identifier + "\"";
			}
		}
		else {
			error.raise("checkIdentifier", identifier, "Identifier " + identifier + " is not valid.");
		}
		return identifier;
	}

	/**
	*	Insert one row of values and/or expressions into a table.
	*
	*	@function executeInsertValues
	*	@param namesObject {object | string} Table name or name object.
	*	@param columnAssignments {object} Object mapping column names to values or SQL expressions
	*	@return {int} the number of rows inserted. Should be 1.
	*/
	function executeInsertValues(namesObject, columnAssignments) {
		try {
			var values = [];
			var columnAssignment, columnName;
			for (columnName in columnAssignments) {
				if (columnAssignments.hasOwnProperty(columnName)){
					columnAssignment = getColumnAssignment(columnAssignments, columnName);

					if (columnAssignment.value !== undefined) {
						values.push(columnAssignment.value);
					}
				}
			}
			var sql = createInsertValuesStatement(namesObject, columnAssignments);
			values.unshift(sql);
			var numRows = getConnection().executeUpdate.apply(connection, values);
			return numRows;
		}
		catch (e){
			error.raise("executeInsertValues", arguments, "", e);
		}
		return null;
	}

	exports.setDatabaseInterface = setDatabaseInterface;
	exports.getDefaultDatabaseInterface = getDefaultDatabaseInterface;
	exports.openConnection = openConnection;
	exports.getConnection = getConnection;
	exports.rollbackTransaction = rollbackTransaction;
	exports.commitTransaction = commitTransaction;
	exports.closeConnection = closeConnection;
	exports.getRowList = getRowList;
	exports.getColumnAssignment = getColumnAssignment;
	exports.callProcedure = callProcedure;
	exports.executeQuery = executeQuery;
	exports.executeInsertValues = executeInsertValues;
	exports.queryParameterizedCalculationView = queryParameterizedCalculationView;
	exports.makeTableName = makeTableName;
	exports.checkIdentifier = checkIdentifier;
	exports.createCalcViewPlaceholders = createCalcViewPlaceholders;

}(this));
