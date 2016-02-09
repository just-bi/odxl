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
	
	var connection;
	/**
	*	Opens the connection and makes sure autocommit is disabled.
	*	We require this becuase typically our interaction with the 
	*	db spans multiple statements
	*	
	*	@function openConnection
	*/
	function openConnection(){
		connection = $.hdb.getConnection();  
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
			rs = getConnection().executeQuery(sql);
			return rs;
		}
		catch (e) {
			error.raise("queryParameterizedCalculationView", arguments, sql, e);
		}
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
		var rs = getConnection().executeQuery(query);
		var n = rs.length, i, row, value;
		for (i = 0; i < n; i++) {
			row = rs[i]; 
			value = row[columnName];
			list[value] = value; 
		}
		return list;
	}
	
	function getColumnAssignment(columnAssignments, columnName){
		var columnAssignment = columnAssignments[columnName];
		switch (typeof columnAssignment) {
			case "undefined":
				columnAssignment = null;
				//fallthrough
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
	
	function executeQuery(sql){
		try{
			var connection = getConnection();
			var resultset = connection.executeQuery(sql);
			return resultset;
		}
		catch (e){
			error.raise("executeQuery", arguments, "", e);
		}
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
	}

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