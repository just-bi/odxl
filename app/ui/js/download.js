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

function clear(){
	setODataUrl("");
	clearColumnSelection();
	clearVariables();
}

var schemaSelector = document.getElementById("selectSchemas");
function schemaSelectionChanged(){
	clearSelector(tableSelector);
	clear();
	getTableData();
}
schemaSelector.onchange = schemaSelectionChanged;

function populateSchemaSelector(data){
	populateSelectorWithData(schemaSelector, data, "SCHEMA_NAME");
}

var tableSelector = document.getElementById("selectTables");
function tableSelectionChanged(){
	clear();
	getColumnData();
	getVariables();
}
tableSelector.onchange = tableSelectionChanged;

function populateTableSelector(data){
	populateSelectorWithData(tableSelector, data, "OBJECT_NAME");
	displayTableSelector(true);
}

function displayTableSelector(display) {
	var tr = tableSelector.parentNode.parentNode;
	tr.style.display = Boolean(display) ? "" : "none";
}
displayTableSelector(false);

var columnsTable = document.getElementById("columnsTable");
var variablesTable = document.getElementById("variablesTable");
var odataUrl = document.getElementById("odataUrl");
odataUrl.onchange = updateDownloadLinks;

var tableControls = document.getElementById("tableControls");
var workbookSheets = document.getElementById("workbookSheets");

var downloadCsvLink = document.getElementById("downloadCsvLink");
var downloadSheetLink = document.getElementById("downloadSheetLink");

var addToWorkbookButton = document.getElementById("addToWorkbookButton");
addToWorkbookButton.onclick = addToWorkbook;
var downloadWorkbookButton = document.getElementById("downloadWorkbookButton");
downloadWorkbookButton.onclick = downloadWorkbook;

var topInput = document.getElementById("top");
topInput.onchange = buildODataQuery;
var skipInput = document.getElementById("skip");
skipInput.onchange = buildODataQuery;

var fileNameInput = document.getElementById("fileName");
fileNameInput.onchange = buildODataQuery;

function updateDownloadWorkbookButtonState(){
	var hasSheets = workbookSheets.tBodies[0].rows.length !== 0;
	var display = hasSheets ? "" : "none";
	downloadWorkbookButton.style.display = display;
	workbookSheets.tHead.style.display = display;
}

function displayTableControls(display){
	var tableControls = document.getElementById("tableControls");
	tableControls.style.display = Boolean(display) ? "" : "none";
}
displayTableControls(false);

function getSchemaData(){
	getOData("schemas", populateSchemaSelector);
}

function getTableData(){
	displayTableSelector(false);
	var predicate = "";
	var schemaName = getCurrentSchemaName();
	if (!schemaName) {
		return;
	}
	predicate = "p_schema_name='" + schemaName + "'";
	var query = "tables(" + predicate + ")/Results?$orderby=OBJECT_NAME";
	getOData(query, populateTableSelector);
}

function getVariables(){
	var schemaName = getCurrentSchemaName();
	if (!schemaName || schemaName !== "_SYS_BIC") {
		return;
	}
	var tableName = getCurrentTableName();
	if (!tableName) {
		return;
	}
	var predicate = "p_table_name='" + tableName + "'";
	var query = "variables(" + predicate + ")/Results?$orderby=ORDER";
	getOData(query, populateVariables);
}

function populateVariables(data){
	var i, n = data.length, item;
	if (n === 0) {
		return;
	}
	var rows = variablesTable.rows;
	var row, cell, cells;

	row = variablesTable.insertRow(rows.length);
	row.className = "header";
	cells = row.cells;

	cell = row.insertCell(cells.length);
	cell.innerHTML = "Variable";

	cell = row.insertCell(cells.length);
	cell.innerHTML = "Data Type";

	cell = row.insertCell(cells.length);
	cell.innerHTML = "Input Type";

	cell = row.insertCell(cells.length);
	cell.innerHTML = "Value";
	
	for (i = 0; i < n; i++) {
		item = data[i];
		row = variablesTable.insertRow(rows.length);
		
		row.title = item.DESCRIPTION;
		cells = row.cells;

		cell = row.insertCell(cells.length);
		cell.innerHTML = item.VARIABLE_NAME;
		row.setAttribute("data-VARIABLE_NAME", item.VARIABLE_NAME);
		
		cell = row.insertCell(cells.length);
		cell.innerHTML = item.DATA_TYPE_NAME;		
		row.setAttribute("data-DATA_TYPE_NAME", item.DATA_TYPE_NAME);

		cell = row.insertCell(cells.length);
		cell.innerHTML = item.SELECTION_TYPE;
		row.setAttribute("data-SELECTION_TYPE", item.SELECTION_TYPE);

		createInput(row, item);
	}
	
}

function clearVariables(){
	clearTableRows(variablesTable);
}

function getColumnData(){
	var predicate = "";
	var schemaName = getCurrentSchemaName();
	if (!schemaName) {
		return;
	}
	predicate = "p_schema_name='" + schemaName + "'";

	var tableName = getCurrentTableName();
	if (!tableName) {
		return;
	}
	predicate += ",";
	predicate += "p_table_name='" + tableName + "'";

	var query = "columns(" + predicate + ")/Results?$orderby=POSITION";
	getOData(query, populateColumns);
}

function getCurrentTableName(){
	var value = getSelectedValue(tableSelector);
	return value;
}

function getCurrentSchemaName(){
	var value = getSelectedValue(schemaSelector);
	return value;
}

function updateTableControlsVisibility(){
	var tableName = getCurrentTableName();
	var display = Boolean(tableName) ? "block" : "none";
	tableControls.style.display = display;
	updateDownloadWorkbookButtonState();
}

function clearTableRows(table){
	while (table.tBodies[0].rows.length) {
		table.deleteRow(table.rows.length - 1);
	}
}

function clearColumnSelection(){
	clearTableRows(columnsTable);
}

function clearWorkbooksheets(){
	clearTableRows(workbookSheets);
	updateDownloadWorkbookButtonState();
}

function setODataUrl(text){
	odataUrl.value = text;
	displayTableControls(text && text.length);
	updateDownloadLinks();
}
	
function buildODataQuery(){
	var schemaName = getCurrentSchemaName();
	if (!schemaName) {
		setODataUrl("");
		return;
	}
	var tableName = getCurrentTableName();
	if (!tableName) {
		setODataUrl("");
		return;
	}
	var odataQuery = "\"" + schemaName + "\"\/\"" + tableName + "\"";
	var options = {};
	var rows, row, c, i, n;
	var j, m, cells, cell;

	rows = variablesTable.rows;
	n = rows.length;
	var variableName, dataTypeName, variables = [], input, value; 
	for (i = 1; i < n; i ++) {
		row = rows[i];
		variableName = row.getAttribute("data-VARIABLE_NAME");
		dataTypeName = row.getAttribute("data-DATA_TYPE_NAME");
		input = row.cells[3].firstChild;
		value = input.value;
		if (value === "") {
			value = "null";
		}
		else {
			switch (dataTypeName) {			
				case "CHAR":
				case "VARCHAR":
				case "NCHAR":
				case "NVARCHAR":
				case "TEXT":
					value = "'" + value.replace(/'/g, "''") + "'";
					break;
				default:
					break;
			}
		}
		variables.push(variableName + "=" + value);
	}
	if (variables.length) {
		odataQuery += "(" + variables.join(",") + ")"		
	}
	
	var selector, selectedIndex;	
	var columnName, columnNames = [];
	var select = [];
	var header = [], headerItem;
	var ordinal = {};
	var orderby = {};
	var ascdesc = {};
	var filter = {}, condition, conditionValue, conditionValueInput;

	rows = columnsTable.rows;
	n = rows.length
	for (i = 1, c = 0; i < n; i++, c++) {
	    headerItem = {};
	    header.push(headerItem);
		row = rows[i];
		columnName = row.getAttribute("data-COLUMN_NAME");
		columnNames[c] = columnName;
		cells = row.cells;
		m = cells.length;
		for (j = 0; j < m; j++) {
			cell = cells[j];
			switch (cell.className) {
				case "select":
					if (cell.firstChild.checked) {
						select.push(c);
					}
					break;
				case "columnName":
					break;
                case "columnLabel":
                    headerItem.label = cell.firstChild.value || columnName;
                    break;
				case "ordinal":
					selector = cell.firstChild;
					selectedIndex = selector.selectedIndex;
					if (selectedIndex !== 0) {
						ordinal[c] = selectedIndex;
					}
					break;
				case "orderby":
					selector = cell.firstChild;
					selectedIndex = selector.selectedIndex;
					if (selectedIndex !== 0) {
						orderby[c] = selectedIndex;
					}
					break;
				case "ascdesc":
					selector = cell.firstChild;
					selectedIndex = selector.selectedIndex;
					if (selectedIndex !== 0) {
						ascdesc[c] = selector.options[selectedIndex].value;
					}
					break;
				case "operator":
					selector = cell.firstChild;
					selectedIndex = selector.selectedIndex;
					if (selectedIndex !== 0) {
						condition = {
							"operator": selector.options[selectedIndex].value
						};
						filter[columnName] = condition;
					}
					break;
				case "value":
					condition = filter[columnName];
					conditionValueInput = cell.firstChild;
					conditionValue = conditionValueInput.value;
					if (condition) {
						if (condition.operator === "isnull" || condition.operator === "isnotnull"){
							conditionValueInput.value = "";
						}
						else
						if (conditionValue) {
							switch (conditionValueInput.type) {
								case "":
									break;
								case "text":
								case "date":
								case "datetime-local":
								case "time":
									conditionValue = "'" + conditionValue.replace(/'/g, "''") + "'";
									break;
							}
							condition.value = conditionValue;
						}
						else
						if (condition.operator !== "isnull" && condition.operator !== "isnotnull") {
							delete filter[columnName];
						}
					}
					break;
			}
		}
	}

	n = select.length;
	if (n) {
		select.sort(function(a, b){
			var aSort = ordinal[a] || m, bSort = ordinal[b] || m;
			if (aSort > bSort) {
				return 1;
			}
			else
			if (aSort < bSort){
				return -1;
			}
			if (a > b) {
				return 1;
			}
			else
			if (a < b) {
				return -1;
			}
			return 0;
		});
		for (i = 0; i < n; i++){
			select[i] = quoteIdentifierIfNecessary(columnNames[select[i]]);
		}
		options.$select = select.join(", ");
	}

	var $filter = "", op, value;
	for (columnName in filter) {
		condition = filter[columnName];
		if ($filter) {
			$filter += " and ";
		}
		op = condition.operator;
		if (op === "isnull" || op === "notisnull") {
			if (op === "isnull") {
				op = "eq";
			}
			else
			if (op === "isnotnull") {
				op = "neq";
		    }
			value = "null";
		}
		else {
			value = condition.value;
		}
		$filter += [
		  quoteIdentifierIfNecessary(columnName),
		  op, value
		].join(" ");
	}
	if ($filter) {
		options.$filter = $filter;
	}

	var k, v, orderbylist = [];
	for (k in orderby) {
		orderbylist.push({
			column: quoteIdentifierIfNecessary(columnNames[k]),
			ascdesc: ascdesc[k],
			sort1: orderby[k],
			sort2: ordinal[k],
			sort3: parseInt(k, 10)
		});
	}
	orderbylist.sort(function(a, b){
		if (a.sort1 > b.sort1) {
			return 1;
		}
		else
		if (a.sort1 < b.sort1) {
			return -1;
		}
		if (a.sort2 > b.sort2) {
			return 1;
		}
		else
		if (a.sort2 < b.sort2) {
			return -1;
		}
		if (a.sort3 > b.sort3) {
			return 1;
		}
		else
		if (a.sort3 < b.sort3) {
			return -1;
		}
		return 0;
	});
	var $orderby = [], item;
    n = orderbylist.length;
	for (i = 0; i < n; i++) {
		item = quoteIdentifierIfNecessary(orderbylist[i].column);
		if (orderbylist[i].ascdesc) {
			item += " " + orderbylist[i].ascdesc;
		}
		$orderby.push(item);
	}
	$orderby = $orderby.join(", ");
	if ($orderby) {
		options.$orderby = $orderby;
	}

	if (skipInput.value) {
		options.$skip = skipInput.value;
	}
	if (topInput.value) {
		options.$top= topInput.value;
	}
    options.header = JSON.stringify(header);

	var query = "";
	for (k in options) {
		v = options[k];
		if (query) {
			query += "&";
		}
		else {
			query += "?";
		}
		query += k + "=" + v;
	}
	odataQuery += query;
	setODataUrl(odataQuery);
}

function getFileName(extension, name){
	var fileName;
	fileName = name || fileNameInput.value;
	fileName = fileName || getCurrentTableName();
	return fileName + "." + extension;
}

function updateDownloadLinks(){
	var odataQuery = odataUrl.value;
	var url = odxlServiceEndpoint + "/" + odataQuery;
	var extension, fileName;

	extension = "csv";
	fileName = getFileName(extension);
	downloadCsvLink.href = url + "&$format=" + extension + "&download=" + fileName;
	downloadCsvLink.download = fileName;

	extension = "xlsx";
	fileName = getFileName(extension);
	downloadSheetLink.href = url + "&$format=" + extension + "&download=" + fileName;
	downloadSheetLink.download = fileName;
}

function createOrdinalSelector(n){
	var selector = document.createElement("SELECT");
	var option;

	selector.onchange = buildODataQuery;

	option = document.createElement("OPTION");
	selector.appendChild(option);

	var i;
	for (i = 1; i <= n; i++) {
		option = document.createElement("OPTION");
		option.value = option.label = option.innerHTML = i;
		selector.appendChild(option);
	}
	return selector;
};

var operators = {
  lt: "<",
  le: "<=",
  eq: "=",
  ne: "<>",
  gt: ">",
  ge: ">=",
  isnull: "is null",
  isnotnull: "is not null"
};
function createOperatorSelector(onchangeHandler){
	return createOptionsSelector(operators, buildODataQuery);
}

function createAscDescSelector(){
	var operators = {
	  asc: "asc",
	  desc: "desc"
	};
	return createOptionsSelector(operators, buildODataQuery);
}

function createValueInput(row, item){
	var cells = row.cells, cell;
	cell = row.insertCell(cells.length);
	cell.className = "value";
	var input = document.createElement("INPUT");
	var inputType, step, min, max;
	inputType = step = min = max = undefined;
	switch (item.DATA_TYPE_NAME) {
		//https://help.sap.com/saphelp_hanaplatform/helpdata/en/20/a1569875191014b507cf392724b7eb/content.htm#loio20a1569875191014b507cf392724b7eb___csql_data_types_1sql_data_types_introduction_datetime
		case "DATE":
			inputType = "date";
			break;
		case "TIME":
			inputType = "time";
			break;
		case "SECONDDATE":
		case "TIMESTAMP":
			inputType = "datetime-local";
			break;
		//https://help.sap.com/saphelp_hanaplatform/helpdata/en/20/a1569875191014b507cf392724b7eb/content.htm#loio20a1569875191014b507cf392724b7eb___csql_data_types_1sql_data_types_introduction_numeric
		case "TINYINT":
			inputType = "number"; step = 1; min = 0; max = 255;
			break;
		case "SMALLINT":
			inputType = "number"; step = 1; min = -32768; max = 32768;
			break;
		case "INTEGER":
			inputType = "number"; step = 1; min = -2147483648; max = 2147483647;
			break;
		case "BIGINT":
			inputType = "number"; step = 1; min = -9223372036854775808; max = 9223372036854775807;
			break;
		case "SMALLDECIMAL":
		case "DECIMAL":
		case "REAL":
		case "DOUBLE":
		case "FLOAT":
			inputType = "number";
			break;
		default:
			inputType = "text";
	}

	input.type = inputType;
	if (step !== undefined) {
		input.step = step;
	}
	if (min !== undefined) {
		input.min = min;
	}
	if (max !== undefined) {
		input.max = max;
	}
	input.onchange = function(){
		var operatorCell = row.cells[input.parentNode.cellIndex - 1];
		var operatorSelector = operatorCell.firstChild;
		if (input.value) {
			//if a value is entered, but there is currently no selected operator,
			//automatically set the operator to "=";
			if (!operatorSelector.selectedIndex) {
				operatorSelector.selectedIndex = 3;
			}
		}
		else {
			//if there is no value, blank out the operator.
			operatorSelector.selectedIndex = 0;
		}
		buildODataQuery();
	}
	cell.appendChild(input);	
}

function getColumnLabel(columnName){
  var parts = columnName.split(/_+/g);
  parts = parts.map(function(part){
    return part.charAt(0).toUpperCase() + part.substr(1).toLowerCase();
  });
  return parts.join(" ");
}

function populateColumns(data){
	var i, n = data.length, item, prop;
	var rows = columnsTable.rows, row, cells, cell;
	var checkbox, input, inputType, min, max, step, dataType, labelInput;

	row = columnsTable.insertRow(rows.length);
	row.className = "header";
	cells = row.cells;

	cell = row.insertCell(cells.length);
	cell.innerHTML = "Select?";

	cell = row.insertCell(cells.length);
	cell.innerHTML = "Column";

    cell = row.insertCell(cells.length);
    cell.innerHTML = "Label";
	
	cell = row.insertCell(cells.length);
	cell.innerHTML = "Type";

	cell = row.insertCell(cells.length);
	cell.innerHTML = "Position";

	cell = row.insertCell(cells.length);
	cell.innerHTML = "Order";

	cell = row.insertCell(cells.length);
	cell.innerHTML = "Asc/Desc";

	cell = row.insertCell(cells.length);
	cell.innerHTML = "Compare";

	cell = row.insertCell(cells.length);
	cell.innerHTML = "Value";

	for (i = 0; i < n; i++) {
		item = data[i];
		row = columnsTable.insertRow(rows.length);
		for (prop in item) {
			row.setAttribute("data-" + prop, item[prop]);
		}
		cells = row.cells;

		cell = row.insertCell(cells.length);
		cell.className = "select";
		checkbox = document.createElement("INPUT");
		checkbox.checked = true;
		checkbox.type = "checkbox";
		checkbox.onchange = checkbox.click = buildODataQuery;
		cell.appendChild(checkbox);

		cell = row.insertCell(cells.length);
		cell.className = "columnName";
		cell.innerHTML = item.COLUMN_NAME;
		
        cell = row.insertCell(cells.length);
        cell.className = "columnLabel";
        labelInput = document.createElement("INPUT");
        labelInput.value = getColumnLabel(item.COLUMN_NAME);
        cell.appendChild(labelInput);

		cell = row.insertCell(cells.length);
		cell.className = "dataType";
		dataType = item.DATA_TYPE_NAME;
		cell.innerHTML = dataType;

		cell = row.insertCell(cells.length);
		cell.className = "ordinal";
		cell.appendChild(createOrdinalSelector(n));

		cell = row.insertCell(cells.length);
		cell.className = "orderby";
		cell.appendChild(createOrdinalSelector(n));

		cell = row.insertCell(cells.length);
		cell.className = "ascdesc";
		cell.appendChild(createAscDescSelector());

		cell = row.insertCell(cells.length);
		cell.className = "operator";
		cell.appendChild(createOperatorSelector());

		createValueInput(row, item);
	}
	updateTableControlsVisibility();
	buildODataQuery();
}

function addToWorkbook(){
	var rows = workbookSheets.tBodies[0].rows;
	var row = workbookSheets.tBodies[0].insertRow(rows.length);
	var cells = row.cells;
	var cell;

	cell = row.insertCell(cells.length);
	var checkbox = document.createElement("INPUT");
	checkbox.type = "checkbox";
	checkbox.checked = true;
	checkbox.onclick = function removeFromWorkbook(){
		var checkbox = this;
		if (checkbox.checked) {
			return true;
		}
		var cell = checkbox.parentNode;
		var row = cell.parentNode;
		var table = row.parentNode.parentNode;
		table.deleteRow(row.rowIndex);
		if (table.tBodies[0].rows.length === 0) {
			updateDownloadWorkbookButtonState();
		}
		updateDownloadWorkbookButtonState();
	};
	cell.appendChild(checkbox);

	cell = row.insertCell(cells.length);
	var input = document.createElement("INPUT");
	input.value = getCurrentTableName();
	input.type = "text";
	cell.appendChild(input);

	cell = row.insertCell(cells.length);
	cell.innerHTML = odataUrl.value;
	updateDownloadWorkbookButtonState();
}

function downloadWorkbook(){
    var xhr = new XMLHttpRequest();
    xhr.open("POST", odxlServiceEndpoint + "/$batch?$format=xlsx", true);

    //http://www.html5rocks.com/en/tutorials/file/xhr2/
    //http://jsfiddle.net/koldev/cw7w5/
    xhr.responseType = "blob";
    xhr.onload = function(){
        var blob = this.response;
        if (this.status !== 200) {
          var fileReader = new FileReader();
          fileReader.addEventListener("loadend", function(){
            alert("Error: " + xhr.statusText + "\n" + fileReader.result);
          });
          fileReader.readAsText(blob);
          return;
        }
        url = window.URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.style = "display: none";
        a.href = url;
        a.download = getFileName("xlsx", fileNameInput.value || "ODXL Workbook");
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        clearWorkbooksheets();
    };


    var boundary = "boundary123";
    xhr.setRequestHeader("Content-Type", "multipart/mixed; boundary=" + boundary);

    var rows = workbookSheets.tBodies[0].rows, n = rows.length, i, row, cells;
    var body = [], sheetUri, sheetName;
    var sheetNamePattern = /^[^'\[\]/\\:?][^\[\]/\\:?]{0,30}$/;
    for (i = 0; i < n; i++) {
    	row = rows[i];
    	cells = row.cells;
        sheetName = cells[1].firstChild.value;
        if (!sheetNamePattern.test(sheetName)) {
          alert("Sheetname \"" + sheetName + "\" does not match pattern /" + sheetNamePattern.source + "/.");
          return;
        }
    	sheetUri = cells[2].textContent;
    	body.push("--" + boundary);
    	body.push("Content-Type: application/http");
    	body.push("Content-Transfer-Encoding: binary");
    	body.push("");
    	body.push("GET " + sheetUri + "&sheetname=" + sheetName);
    	body.push("");
    }
    body.push("--" + boundary + "--");
    body = body.join("\r\n");
    xhr.send(body);

}

updateTableControlsVisibility();
getSchemaData();

}(window));
