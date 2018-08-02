/*
Copyright 2016 - 2018 Just-BI BV, Roland Bouman (roland.bouman@just-bi.nl)

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
  
  var xlsx = $.import("../xsjslib/xlsx.xsjslib");
  var params = $.import("../xsjslib/params.xsjslib");
  params.define({
    //specify the name of the sheet where the data appears
    sheetname: {      
      type: "VARCHAR",
      mandatory: false
    },
    //comma separated list of "special" fields to be printed as a header before the dataset.
    metafields: {
      type: "VARCHAR",
      mandatory: false
      //value: "date,username,querypath,param.$filter"
    },
    //JSON object that maps column names to excel format strings.
    columnformats: {
      type: "VARCHAR",
      mandatory: false
    }
  });
  var metafieldDefs = {
    date: {
      style: 1,
      type: "d",
      func: function(){
        return (new Date()).toISOString();
      }
    },
    username: {
      type: "s",
      func: function(){
        return $.session.getUsername();
      }
    },
    querypath: {
      type: "s",
      func: function(){
        return $.request.queryPath;
      }
    }, 
    path: {
      type: "s",
      func: function(){
        return $.request.path;
      }
    }, 
    params: {
      type: "s",
      func: function(){
        var p = params.validate();
        return JSON.stringify(p);
      }
    }
  };
  
  function handleBatchStart(){
    var xlsxWorkbook = new xlsx.Workbook();
    return xlsxWorkbook;
  }
  
  function handleBatchEnd(batchContext){
    var archive = batchContext.pack();
    return archive;
  }
  
  function writeMetaFieldsToWorksheet(parameters, xlsxWorksheet){
    var wb = xlsxWorksheet.getWorkbook();
    var xw = xlsxWorksheet.getWriter();
    var metafieldDef, metafield, metafieldType, metafieldStyle, metafields = parameters.metafields;
    metafields = metafields.split(",");
    var i, n = metafields.length, field, label, value, sharedStringIndex, rowIndex, paramField, paramName;
    for (i = 0, rowIndex = 1; i < n; i++, rowIndex++) {
      metafield = metafields[i];
      metafield = metafield.split(" as ");
      field = metafield[0];
      label = metafield[1] || field;
      metafieldDef = metafieldDefs[field];
      if (metafieldDef === undefined) {
        if (field.indexOf("param.") === 0){
          //user wants a specific parameter
          paramField = field.split(".");
          paramField.shift();
          paramName = paramField.join(".");
          if (!params.isDefined(paramName)){
            throw "Invalid parameter metafield " + field + ": the parameter " + paramName + " is not defined.";
          }
          value = parameters[paramName];
          metafieldType = "s";
          metafieldStyle = 0;
        }
        else {
          throw "Unrecognized metafield: " + field + "." + JSON.stringify(metafieldDefs);
        }
      }
      else {
        value = metafieldDef.func();
        metafieldType = metafieldDef.type;
        metafieldStyle = metafieldDef.style;
      }
      xw.openElement("row", xlsxWorksheet.XLSX_NS_MAIN);
      xw.writeAttribute("r", rowIndex);

      xw.openElement("c", xlsxWorksheet.XLSX_NS_MAIN);
      xw.writeAttributes({
        r: "A" + rowIndex,
        s: 0,
        t: "s"
      });
      xw.openElement("v", xlsxWorksheet.XLSX_NS_MAIN);
      sharedStringIndex = wb.getSharedStringIndex(label);
      xw.writeText(sharedStringIndex);
      xw.closeElement();  //v
      xw.closeElement();  //c

      if (value) {
        xw.openElement("c", xlsxWorksheet.XLSX_NS_MAIN);
        xw.writeAttributes({
          r: "B" + rowIndex,
          t: metafieldType
        });
        if (metafieldStyle) {
          xw.writeAttribute("s", metafieldDef.style);
        }
        xw.openElement("v", xlsxWorksheet.XLSX_NS_MAIN);
        if (metafieldType === "s"){
          value = wb.getSharedStringIndex(value);
        }
        xw.writeText(value);
        xw.closeElement();  //v
        xw.closeElement();  //c
      }
      
      xw.closeElement();  //row
    }
    return i+1;
  }
    
  function generateWorksheet(xlsxWorkbook, parameters, resultset) {
    var sheetName = parameters.sheetname || "Sheet";
    var sheetNamePattern = /^[^'\[\]/\\:?][^\[\]/\\:?]{0,30}$/;
    if (!sheetNamePattern.test(sheetName)) {
      throw "Sheetname \"" + sheetName + "\" does not match pattern /" + sheetNamePattern.source + "/."; 
    }
    var name = sheetName, num = 0;
    while (xlsxWorkbook.getSheetIndexByName(name) !== -1) {
      name = sheetName + " " + (++num);
    }
    var xlsxWorksheet = xlsxWorkbook.addWorksheet({
      name: name
    });
    xlsxWorksheet.open();

    var rowIndex = 0;
    if (parameters.metafields !== undefined) {
      rowIndex = writeMetaFieldsToWorksheet(parameters, xlsxWorksheet);
    }
    rowIndex += 1;
    xlsxWorksheet.writeResultset(resultset, xlsxWorksheet, rowIndex);

    xlsxWorksheet.close();
    return xlsxWorksheet;
  } 
  
  function handleRequest(parameters, contentType, resultset){
    try {
      parameters = params.validate();
      var xlsxWorkbook = new xlsx.Workbook();
      generateWorksheet(xlsxWorkbook, parameters, resultset);
      var archive = xlsxWorkbook.pack();
      return {
        body: archive ,
        headers: {
          "Content-Type": contentType
        }
      };
    }
    catch (e){
      throw e.toString() + " - " + JSON.stringify(e.stack, "", " ");
    }
  }
  
  exports.handleBatchStart = handleBatchStart;
  exports.handleBatchPart = generateWorksheet;
  exports.handleBatchEnd = handleBatchEnd;
  exports.handleRequest = handleRequest;
  
}(this));