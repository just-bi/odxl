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

var xmlWriter = $.import("xmlwriter.xsjslib");

var XLSX_NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
var XLSX_NS_RELS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
var XLSX_NS_CONTENT_TYPES = "http://schemas.openxmlformats.org/package/2006/content-types";

//find the excel column letter
//http://stackoverflow.com/questions/181596/how-to-convert-a-column-number-eg-127-into-an-excel-column-eg-aa
function xlsxIntToColumnLetter(c){
	var l = "", m, r = c;
	do {
		m = (r-1) % 26;
		l = String.fromCharCode(65 + m) + l;
		r = (r - m) / 26;
	} while (r >= 1);
	return l;
}

var XlsxWorksheet;
XlsxWorksheet = function(conf){
	if (conf.workbook) {
		this.workbook = conf.workbook;
	}
	this.name = conf.name;
	this.xmlWriter = new xmlWriter.XmlWriter();
};
XlsxWorksheet.prototype = {
	XLSX_NS_MAIN: XLSX_NS_MAIN,
	XLSX_NS_RELS: XLSX_NS_RELS,
	getWorkbook: function(){
		return this.workbook;
	},
	getName: function(){
		return this.name;
	},
	getWriter: function(){
		return this.xmlWriter;
	},
	asXml: function(){
		return this.xmlWriter.asXml();
	},
	getIndex: function(){
		var workbook = this.workbook;
		var index = workbook.getSheetIndex(this);
		return index;
	},
	pack: function(){
		var workbook = this.workbook;
		var result = workbook.packSheet(this);
		this.xmlWriter.clear();
		return result;
	},
	open: function(){
		var xw = this.getWriter();

		xw.writeXmlDeclaration();
		xw.openElement("worksheet");
		xw.declareNs("", XLSX_NS_MAIN);
		xw.openElement("sheetData", XLSX_NS_MAIN);
	},
	close: function(){
		var xw = this.getWriter();
		xw.closeElement();	//sheetData
		xw.closeElement();	//worksheet			
	},
	writeResultset: function(resultset, xlsxWorksheet, rowIndex) {
		var xw = this.getWriter();
		var wb = this.getWorkbook();

		if (rowIndex === undefined) {
			rowIndex = 1;
		}
		
		var i, columnMetadata,
			columnsMetadata = resultset.metadata.columns, 
			n = columnsMetadata.length, 
			columnLetter, columnType, columnName,
			excelType, excelStyle, sharedStringIndex
		;
		//write a header row
		xw.openElement("row", XLSX_NS_MAIN);
		xw.writeAttribute("r", rowIndex);

		var rowWriter = [];
		rowWriter.push("var wb = ws.getWorkbook(), ns = wb.XLSX_NS_MAIN, xw = ws.getWriter(), v;");		
		rowWriter.push("xw.openElement(\"row\", ns);");
		rowWriter.push("xw.writeAttribute(\"r\", rowIndex);");
		
		for (i = 0; i < n; i++) {
			columnLetter = xlsxIntToColumnLetter(i + 1);
			columnMetadata = columnsMetadata[i];
			columnName = columnMetadata.name;
			columnType = columnMetadata.type;
				
			xw.openElement("c", XLSX_NS_MAIN);
			xw.writeAttributes({
				r: columnLetter + rowIndex,
				s: 0,
				t: "s",
			});
			
			rowWriter.push("");
			rowWriter.push("v = resultset[\"" + columnName + "\"];");
			rowWriter.push("if (v !== null) {");
			rowWriter.push("  xw.openElement(\"c\", ns);");			

			excelStyle = null;
			switch (columnType) {
				case 1:		//tinyint
				case 2: 	//smallint
				case 3: 	//integer
				case 4:		//bigint
				case 5: 	//decimal
				case 6: 	//real
				case 7: 	//double
				case 47: 	//smalldecimal
					//excel number type
					excelType = "n";	
					break;
				case 12:	//binary
				case 13:	//varbinary
				case 27:	//blob
				case 51:	//text
				case 75:	//ST_POINT
					rowWriter.push("  v = String.fromCharCode.apply(null, new Uint16Array(v));");
					//fallthrough
				case 8: 	//char
				case 9:	 	//varchar
				case 10:	//nchar
				case 11:	//nvarchar
				case 25:	//clob
				case 26:	//nclob
				case 53:	//shorttext
				case 54:	//alphanum
					//excel shared string type.
					excelType = "s";	
					rowWriter.push("  v = wb.getSharedStringIndex(v);");
					break;
				case 14:	//date
				case 15:	//date
				case 16:	//timestamp
				case 17:	//seconddate
					excelType = "d";
					excelStyle = 1;
					rowWriter.push("  v = v.toISOString();");
					//pinch off the second and subsecond parts
					//rowWriter.push("  v = v.substr(0, v.length - 8) + \"Z\"");
					break;
				default:
					throw "Unrecognized column type " + columnType + " for column " + columnName;
			}

			rowWriter.push("  xw.writeAttributes({");
			rowWriter.push("    r: \"" + columnLetter + "\" + rowIndex,");
			if (excelStyle) {
				rowWriter.push("    s: \"" + excelStyle + "\",");			
			}
			rowWriter.push("    t: \"" + excelType + "\"");			
			rowWriter.push("  });");			
			
			xw.openElement("v", XLSX_NS_MAIN);			
			rowWriter.push("  xw.openElement(\"v\", ns);");			
			
			sharedStringIndex = wb.getSharedStringIndex(columnMetadata.label || columnName);
			xw.writeText(sharedStringIndex);
			rowWriter.push("  xw.writeText(v);");			
			
			xw.closeElement(); //v
			rowWriter.push("  xw.closeElement(); //v");
			xw.closeElement(); //c
			rowWriter.push("  xw.closeElement(); //c");

			rowWriter.push("} //if (v !== null)");				
			
		}
		xw.closeElement(); //row
		rowWriter.push("xw.closeElement(); //row");	//r
		
		rowWriter = rowWriter.join("\n");
		rowWriter = new Function("ws", "resultset", "rowIndex", rowWriter);
		
		var row, iterator = resultset.getIterator();
		while (iterator.next()){
			rowIndex += 1;
			row = iterator.value();
			rowWriter.call(null, xlsxWorksheet, row, rowIndex);
		}
	}		
};

var XlsxWorkbook;
(XlsxWorkbook = function(){
	this.strings = [];
	this.sheets = [];
	this.xmlWriter = new xmlWriter.XmlWriter();
	this.zip = new $.util.Zip();
}).prototype = {
	XLSX_NS_MAIN: XLSX_NS_MAIN,
	XLSX_NS_RELS: XLSX_NS_RELS,
	XLSX_NS_CONTENT_TYPES: XLSX_NS_CONTENT_TYPES,
	getSharedStringIndex: function(string){
		var strings = this.strings;
		var index = strings.indexOf(string);
		if (index === -1) {
			index = strings.length;
			strings.push(string);
		}
		return index;
	},
	eachSheet: function(callback, scope){
		var sheets = this.sheets, sheet, i, n = sheets.length;
		for (i = 0; i < n; i++) {
			sheet = sheets[i];
			if (callback.call(scope || this, sheet, i)===false) {
				return false;
			}
		}
		return true;
	},
	getSheetIndexByName: function (name){
		var sheetIndex = -1;
		this.eachSheet(function(sheet, i){
			if (sheet.getName() === name) {
				sheetIndex = i;
				return false;
			}
		});
		return sheetIndex;
	},
	getSheetByName: function(name){
		var index = this.getSheetIndexByName(name);
		if (index === -1) {
			return 0;
		}
		return this.sheets[index];
	},
	getSheetIndex: function(sheet1){
		var index = -1;
		if (typeof sheet1 === "string") {
			sheet1 = this.getSheetByName(sheet1);
		}
 		this.eachSheet(function(sheet2, i){
			if (sheet1 === sheet2) {
				index = i;
				return false;
			}
		});
		return index;
	},
	addWorksheet: function(conf){
		if (!conf) {
			conf = {};
		}
		var sheets = this.sheets;
		var sheetName = conf.name || "Sheet " + (1 + sheets.length);
		var worksheet = new XlsxWorksheet({
			workbook: this,
			name: sheetName
		});
		sheets.push(worksheet);
		return worksheet;
	},
	generateRels: function(){
		var xw = this.xmlWriter;
		xw.clear();
		xw.writeXmlDeclaration();
		xw.openElement("Relationships");
		var ns = "http://schemas.openxmlformats.org/package/2006/relationships";
		xw.declareNs("", ns);
		xw.openElement("Relationship", ns);
		xw.writeAttributes({
			Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
			Target: "/xl/workbook.xml",
			Id: "rId1"
		});
		xw.closeElement();	//Relationship
		xw.closeElement();	//Relationships
		return xw.asXml();
	},
	generateContentTypesXml: function(){
		var xw = this.xmlWriter;
		xw.clear();
		xw.writeXmlDeclaration();
		xw.openElement("Types");
		xw.declareNs("", XLSX_NS_CONTENT_TYPES);

		//All .xml files
		xw.openElement("Default", XLSX_NS_CONTENT_TYPES);
		xw.writeAttributes({
			"Extension": "xml",
			"ContentType": "application/xml"
		});
		xw.closeElement();

		//All .rels files
		xw.openElement("Default", XLSX_NS_CONTENT_TYPES);
		xw.writeAttributes({
			"Extension": "rels",
			"ContentType": "application/vnd.openxmlformats-package.relationships+xml"
		});
		xw.closeElement();

		//workbook.xml
		xw.openElement("Override", XLSX_NS_CONTENT_TYPES);
		xw.writeAttributes({
			"PartName": "/xl/workbook.xml",
			"ContentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
		});
		xw.closeElement();
		
		//worksheets
		this.eachSheet(function(sheet, i){
			xw.openElement("Override", this.XLSX_NS_CONTENT_TYPES);
			xw.writeAttributes({
				"PartName": "/xl/worksheets/sheet" + (1+i) + ".xml",
				"ContentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"
			});
			xw.closeElement();
		});
		
		//styles.xml
		xw.openElement("Override", XLSX_NS_CONTENT_TYPES);
		xw.writeAttributes({
			"PartName": "/xl/styles.xml",
			"ContentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"
		});
		xw.closeElement();
		
		//shared strings
		if (this.hasSharedStrings()) {
			xw.openElement("Override", XLSX_NS_CONTENT_TYPES);
			xw.writeAttributes({
				"PartName": "/xl/sharedStrings.xml",
				"ContentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"
			});
			xw.closeElement();
		}
		
		//Types
		xw.closeElement();
		
		return xw.asXml();
	},
	generateWorkbookXml: function(){
		var xw = this.xmlWriter, ns = this.XLSX_NS_MAIN;
		xw.clear();
		xw.writeXmlDeclaration();

		xw.openElement("workbook");
		xw.declareNs("", ns);
		xw.declareNs("ns1", this.XLSX_NS_RELS);
		
		xw.openElement("sheets", ns);
		this.eachSheet(function(sheet, i){
			var id = i + 1;
			xw.openElement("sheet", ns);
			xw.writeAttributes({
				"name": sheet.getName(),
				"sheetId": id
			});
			xw.writeAttribute("id", "rId" + id, this.XLSX_NS_RELS);
			xw.closeElement();	//sheet
		}, this);
		xw.closeElement();	//sheets

		xw.closeElement();	//workbook
		return xw.asXml();
	},
	generateStylesXml: function(){
		var xw = this.xmlWriter, ns = this.XLSX_NS_MAIN;
		xw.clear();
		xw.writeXmlDeclaration();

		xw.openElement("styleSheet");
		xw.declareNs("", ns);

		//fonts
		xw.openElement("fonts", ns);
		xw.writeAttribute("count", 1);

		xw.openElement("font", ns);
		xw.closeElement();

		xw.closeElement();
		
		//fills
		xw.openElement("fills", ns);
		xw.writeAttribute("count", 1);

		xw.openElement("fill", ns);
		xw.closeElement();
		
		xw.closeElement();

		//borders
		xw.openElement("borders", ns);
		xw.writeAttribute("count", 1);

		xw.openElement("border", ns);
		xw.closeElement();

		xw.closeElement();

		//cellStyleXfs
		xw.openElement("cellStyleXfs", ns);
		xw.writeAttribute("count", 1);
		
		xw.openElement("xf", ns);
		xw.writeAttribute("numFmtId", 0);
		xw.closeElement();
		
		xw.closeElement();

		//cellXfs
		xw.openElement("cellXfs", ns);
		xw.writeAttribute("count", 1);
		
		xw.openElement("xf", ns);
		xw.writeAttribute("numFmtId", 0);
		xw.closeElement();

		xw.openElement("xf", ns);
		xw.writeAttribute("numFmtId", 14);
		xw.closeElement();
		
		xw.closeElement();
		
		//cellStyles
		//xw.openElement("cellStyles", ns);
		//xw.writeAttribute("count", 0);
		//xw.closeElement();

		//dxfs
		xw.openElement("dxfs", ns);
		xw.writeAttribute("count", 0);
		xw.closeElement();
		
		//tableStyles
		xw.openElement("tableStyles", ns);
		xw.writeAttribute("count", 0);
		xw.closeElement();

		xw.closeElement();	//workbook
		return xw.asXml();
	},
	generateWorkbookRels: function(){
		var xw = this.xmlWriter;
		xw.clear();
		xw.writeXmlDeclaration();
		xw.openElement("Relationships");
		var ns = "http://schemas.openxmlformats.org/package/2006/relationships";
		xw.declareNs("", ns);

		var id;
		//worksheets
		this.eachSheet(function(sheet, i){
			id = i + 1;
			xw.openElement("Relationship", ns);
			xw.writeAttributes({
				Id: "rId" + id,
				Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet",
				Target: "worksheets/sheet" + id + ".xml"
			});
			xw.closeElement();	//Relationship
		});
		
		//styles.xml
		xw.openElement("Relationship", ns);
		id += 1;
		xw.writeAttributes({
			Id: "rId" + id,
			Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles",
			Target: "styles.xml"
		});
		xw.closeElement();	//Relationship
		
		//sharedStrings.xml
		if (this.hasSharedStrings()) {
			xw.openElement("Relationship", ns);
			id += 1;
			xw.writeAttributes({
				Id: "rId" + id,
				Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings",
				Target: "sharedStrings.xml"
			});
			xw.closeElement();	//Relationship
		}
		
		xw.closeElement();	//Relationships
		return xw.asXml();
	},
	hasSharedStrings: function(){
		return this.strings.length > 0;
	},
	getSharedStringCount: function(){
		return this.strings.length;
	},
	eachSharedString: function(callback, scope){
		var i, string, strings = this.strings, n = this.getSharedStringCount();
		for (i = 0; i < n; i++) {
			if (callback.call(scope || this, strings[i]) === false) {
				return false;
			}
		}
		return true;
	},
	generateSharedStringsXml: function(){
		var xw = this.xmlWriter, ns = this.XLSX_NS_MAIN;
		xw.clear();

		xw.writeXmlDeclaration();

		xw.openElement("sst");
		xw.declareNs("", ns);
		var n = this.getSharedStringCount();
		xw.writeAttributes({
			count: n,
			uniqueCount: n
		});

		this.eachSharedString(function(string){
			xw.openElement("si", ns);
			xw.openElement("t", ns);
			xw.writeText(string);
			xw.closeElement();	//t
			xw.closeElement();	//si
		});
		
		xw.closeElement();	//sst
		return xw.asXml();
	},
	packSheet: function(sheet){
		if (sheet.getWorkbook() !== this) {
			throw "Sheet is not part of this workbook.";
		}
		var index = this.getSheetIndex(sheet);
		if (index === -1) {
			throw "Could not determine sheet index.";
		}
		var entry = "xl/worksheets/Sheet" + (index + 1) + ".xml";
		var zip = this.zip;
		if (zip[entry]) {
			return false;
		}
		zip[entry] = sheet.asXml();
		return true;
	},
	pack: function(){
		var zip = this.zip;
		
		this.eachSheet(function(sheet, i){
			this.packSheet(sheet);
		});

		zip["[Content_Types].xml"] = this.generateContentTypesXml();
		zip["_rels/.rels"] = this.generateRels();
		zip["xl/_rels/workbook.xml.rels"] = this.generateWorkbookRels();
		zip["xl/workbook.xml"] = this.generateWorkbookXml();
		zip["xl/styles.xml"] = this.generateStylesXml();

		if (this.hasSharedStrings()){ 
			zip["xl/sharedStrings.xml"] = this.generateSharedStringsXml();
		}
		return zip;
	}
};
	
exports.Workbook = XlsxWorkbook;

}(this));