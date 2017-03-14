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

var Tokenizer = $.import("tokenizer.xsjslib").Tokenizer;

//file://just-biserver/RedirectedFolders/rbouman/My%20Documents/[MS-ODATA].pdf
//page 85
var optypes = {
  "ignore": {
    isOperator: false
  },
  "operand": {
    isOperator: false
  },
  "left": {
    isOperator: true,
    isLeft: true
  },
  "func": {
    isOperator: true,
    isLeft: true
  },
  "right": {
    isOperator: true
  },
  "binary": {
    isOperator: true
  },
  "unaryprefix": {
    isOperator: true
  },
  "unarypostfix": {
    isOperator: true
  },
  "notimplemented": {
    implemented: false
  }
};

var ODataFilterParser;
(ODataFilterParser = function(){
  this.tokenizer = new Tokenizer({
    tokens: this.tokenDefs,
    "exclude": "space"
  });
}).prototype = {
  tokenDefs: {
    "space": {
        "pattern": /\s+/,
        "type": optypes.ignore
    },
    "comma": {
      "pattern":  /,/,
      "precedence": 900,
      "type": optypes.binary,
      "dataType": "list",
      "operandDataTypesMustMatch": false
    },
    "unary": {
      "pattern": /not/,
      "precedence": 800,
      "type": optypes.unaryprefix,
      "dataType": "boolean",
      "operandDataType": "boolean"
    },
    "mulplicative": {
      "pattern": /mul|div|mod/,
      "precedence": 700,
      "type": optypes.binary,
      "dataType": "number",
      "operandDataType": "number"
    },
    "relational": {
      "pattern": /lt|gt|le|ge/,
      "precedence": 500,
      "type": optypes.binary,
      "dataType": "boolean"
    },
    "equality": {
      "pattern": /eq|ne/,
      "precedence": 400,
      "type": optypes.binary,
      "dataType": "boolean"
    },
    "and": {
      "pattern": /and/,
      "precedence": 300,
      "type": optypes.binary,
      "dataType": "boolean",
      "operandDataType": "boolean"
    },
    "or": {
      "pattern": /or/,
      "precedence": 200,
      "type": optypes.binary,
      "dataType": "boolean",
      "operandDataType": "boolean"
    },
    "boolliteral": {
      "pattern": /true|false/,
      "type": optypes.operand,
      "dataType": "boolean"
    },
    "nullliteral": {
      "pattern": /null/,
      "type": optypes.operand
    },
    "long": {
        "pattern": /([-]?[0-9]+)L/,
        "type": optypes.operand,
        "dataType": "number"
    },
    "number": {
      "pattern": /-?(0|[1-9]\d*)(\.\d+)?([eE][\+\-]?\d+)?/,
      "type": optypes.operand,
      "dataType": "number"
    },
    "string": {
      "pattern": /'([^']|'')*'/,
      "type": optypes.operand,
      "dataType": "string"
    },
    "funcSubstringOf": {
      "pattern": /substringof\s*\(/,
      "precedence": 0,
      "rightPrecedence": 1000,
      "type": optypes.func,
      "right": "rparen",
      "dataType": "boolean",
      "args": [
        {name: "substring", dataType: "string"},
        {name: "string", dataType: "string"}
      ]
    },
    "funcCheckWithSubstring": {
      "pattern": /(end|start)swith\s*\(/,
      "precedence": 0,
      "rightPrecedence": 1000,
      "type": optypes.func,
      "right": "rparen",
      "dataType": "boolean",
      "args": [
        {name: "substring", dataType: "string"},
        {name: "string", dataType: "string"}
      ]
    },
    "funcLength": {
      "pattern": /length\s*\(/,
      "precedence": 0,
      "rightPrecedence": 1000,
      "type": optypes.func,
      "right": "rparen",
      "dataType": "number",
      "args": [
        {name: "string", dataType: "string"}
      ]
    },
    "funcIndexOf": {
      "pattern": /indexof\s*\(/,
      "precedence": 0,
      "rightPrecedence": 1000,
      "type": optypes.func,
      "right": "rparen",
      "dataType": "number",
      "args": [
        {name: "string", dataType: "string"},
        {name: "substring", dataType: "string"}
      ]
    },
    "funcReplace": {
      "pattern": /replace\s*\(/,
      "precedence": 0,
      "rightPrecedence": 1000,
      "type": optypes.func,
      "right": "rparen",
      "dataType": "string",
      "args": [
        {name: "string", dataType: "string"},
        {name: "find", dataType: "string"},
        {name: "replace", dataType: "string"}
      ]
    },
    "funcSubstring": {
      "pattern": /substring\s*\(/,
      "precedence": 0,
      "rightPrecedence": 1000,
      "type": optypes.func,
      "right": "rparen",
      "dataType": "string",
      "args": [
        {name: "string", dataType: "string"},
        {name: "index", dataType: "number"},
        {name: "length", dataType: "number", optional: true}
      ]
    },
    "funcConvertCase": {
      "pattern": /to(lower|upper)\s*\(/,
      "precedence": 0,
      "rightPrecedence": 1000,
      "type": optypes.func,
      "right": "rparen",
      "dataType": "string",
      "args": [
        {name: "string", dataType: "string"}
      ]
    },
    "funcTrim": {
      "pattern": /trim\s*\(/,
      "precedence": 0,
      "rightPrecedence": 1000,
      "type": optypes.func,
      "right": "rparen",
      "dataType": "string",
      "args": [
        {name: "string", dataType: "string"}
      ]
    },
    "funcConcat": {
      "pattern": /concat\s*\(/,
      "precedence": 0,
      "rightPrecedence": 1000,
      "type": optypes.func,
      "right": "rparen",
      "dataType": "string",
      "args": [
        {name: "head", dataType: "string"},
        {name: "tail", dataType: "string"}
      ]
    },
    "funcDatetimePart": {
      "pattern": /(day|hour|minute|month|second|year)\s*\(/,
      "precedence": 0,
      "rightPrecedence": 1000,
      "type": optypes.func,
      "right": "rparen",
      "dataType": "number",
      "args": [
        {name: "datetime", dataType: "datetime"}
      ]
    },
    "funcRoundFloorCeiling": {
      "pattern": /(round|floor|ceiling)\s*\(/,
      "precedence": 0,
      "rightPrecedence": 1000,
      "type": optypes.func,
      "right": "rparen",
      "dataType": "number",
      "args": [
        {name: "number", dataType: "number"}
      ]
    },
    "funcNotImplemented": {
      "pattern": /[a-zA-Z][a-zA-Z0-9]*\s*\(/,
      "type": optypes.notimplemented,
      "rightPrecedence": 1000      
    },
    "additive": {
      "pattern": /add|sub/,
      "precedence": 600,
      "type": optypes.binary,
      "dataType": "number",
      "operandDataType": "number"
    },
    "lparen": {
      "pattern": /\(/,
      "precedence": 0,
      "rightPrecedence": 1000,
      "type": optypes.left,
      "right": "rparen"
    },
    "rparen": {
      "pattern":  /\)/,
      "precedence": 1,
      "leftPrecedence": 1000,
      "type": optypes.right
    },
    "identifier": {
      "pattern": /\"[^\"]+\"|[_A-Za-z][A-Za-z0-9_#$]*/,
      "type": optypes.operand
    }
  },
  cleanUpParseTreeNode: function(token){
    var node = {
      type: token.type,
      text: token.text,
      at: token.at
    };
    if (token._tokenDef) {
      switch (token._tokenDef.type){
        case optypes.left:
          node.operand = this.cleanUpParseTreeNode(token.rightOperand.leftOperand);
          break;
        case optypes.func:
          node.funcName = token.funcName;
          var args = token.args;
          var cleanArgs = [];
          var i, n = args.length;
          for (i = 0; i < n; i++) {
            cleanArgs[i] = this.cleanUpParseTreeNode(args[i]);
          }
          node.args = cleanArgs;
          break;
        case optypes.right:
          node.operand = this.cleanUpParseTreeNode(token.operand);
          break;
        case optypes.binary:
          node.leftOperand = this.cleanUpParseTreeNode(token.leftOperand);
          node.rightOperand = this.cleanUpParseTreeNode(token.rightOperand);
          break;
        case optypes.unaryprefix:
          node.rightOperand = this.cleanUpParseTreeNode(token.rightOperand);
          break;
        case optypes.unarypostfix:
          node.leftOperand = this.cleanUpParseTreeNode(token.leftOperand);
          break;
      }
    }
    else
    if (token.tokenDef) {
      if (token.tokenDef.type.isOperator) {
        throw "Unreduced operator at " + token.at + " (" + token.text + ").";
      }
    }
    return node;
  },
  tokenize: function(text){
    var firstToken = {
      type: "first",
      prev: null,
      next: null,
      tokenDef: {
        precedence: -1,
        type: optypes.left,
        right: "last"
      },
      prevOperator: null,
      nextOperator: null,
      lastToken: null
    };
    firstToken.lastToken = firstToken;
    var prevToken = firstToken;
    var prevOperator = firstToken;

    var tokenDefs = this.tokenDefs;
    var tokenizer = this.tokenizer;
    tokenizer.text(text);
    
    tokenizer.each(function(token){
      var tokenDef = tokenDefs[token.type];
      if (!tokenDef) {
        throw new Error("Unrecognized token at position " + token.at + ": " + token.text);
      }
      else
      if (tokenDef.type === optypes.notimplemented) {
        throw new Error("Feature not implemented at token \"" + token.text + " position " + token.at + ".");
      }
    
      token.tokenDef = tokenDef;
      
      prevToken.next = token;
      token.prev = prevToken;
      

      token.prevOperator = prevOperator;
      if (tokenDef.type.isOperator) {
        prevOperator.nextOperator = token;
        prevOperator = token;
      }
      firstToken.lastToken = token;
      prevToken = token;
    });
    
    var lastRealToken = firstToken.lastToken;
    var lastToken = {
      type: "last",
      prev: lastRealToken,
      next: null,
      tokenDef: {
        precedence: -2,
        type: optypes.right,
      },
      prevOperator: lastRealToken.tokenDef.type.isOperator ? lastRealToken : lastRealToken.prevOperator,
      nextOperator: null,
    };
    lastRealToken.next = lastToken;
    return firstToken;
  },
  reduceToOperand: function(prevOperator){
    var tokenDef = prevOperator.tokenDef;
    if (tokenDef.type === optypes.operand) {
      return;
    }
    prevOperator._tokenDef = tokenDef;
    prevOperator.tokenDef = {
      type: optypes.operand,
      dataType: tokenDef.dataType
    };
  },
  checkOperand: function(operator, operand){
    var operandTokenDef = operand.tokenDef;
    if (operandTokenDef.type !== optypes.operand) {
      throw "Token is not an operand for \"" + operator.text + "\" at position " + operator.at; 
    }
    var operatorTokenDef = operator.tokenDef;
    var operandDataType = operandTokenDef.dataType;
    var operatorOperandDataType = operatorTokenDef.operandDataType;
    if (operandDataType && operatorOperandDataType && operandDataType !== operatorOperandDataType) {
      throw "Datatype mismatch - operator \"" + operator.text + "\" at position " + operator.at + " requires operand with datatype " + operatorOperandDataType + "; operand \"" +  operand.text + "\" has datatype " + operandDataType; 
    }
  },
  checkFuncArgs: function(funcToken){
    var right = funcToken.rightOperand;
    var operand = right.leftOperand;
    var args = [];
    while (operand.type === "comma") {
      args.push(operand.leftOperand);
      operand = operand.rightOperand;
    }
    args.push(operand);
    funcToken.args = args;
    
    var argDefs = funcToken.tokenDef.args, argDef, arg, argDefDataType, argDataType;
    var i, n = argDefs.length, m = args.length;
    if (m > n) {
      throw "Function " + funcToken.funcName + " can have at most " + n + " arguments, found: " + m + ".";
    }
    for (i = 0; i < n; i++){
      argDef = argDefs[i];
      if (i < m) {
        arg = args[i];
      }
      else 
      if (argDef.optional !== true) {
        throw "Argument " + i + " for function " + funcToken.funcName + " at " +  funcToken.at + " is missing.";
      }
      argDefDataType = argDef.dataType;
      argDataType = arg.tokenDef.dataType;
      if (argDefDataType && argDataType && argDefDataType !== argDataType) {
        throw "Argument " + i + " for function " + funcToken.funcName + " at " +  funcToken.at + " should have data type " + argDefDataType + ", found: " + argDataType;
      }
    }
  },
  reduceLeft: function(operator){
    var operand = operator.prev;
    this.checkOperand(operator, operand);
    operator.leftOperand = operand;
    operator.prev = operand.prev;
    operand.prev.next = operator;
  },
  reduceRight: function(operator){
    var operand = operator.next
    this.checkOperand(operator, operand);
    operator.rightOperand = operand;
    operator.next = operand.next;
    operand.next.prev = operator;
  },
  parse: function(text){
    var firstToken = this.tokenize(text);
    
    var prevToken = firstToken;
    var prevOperator = firstToken;
    var token = firstToken;
    var tokenDef;
    _scan: do {
      token = token.next;
      if (!token) {
        throw "";
      }
      tokenDef = token.tokenDef;
      if (tokenDef.type.isOperator) {
        var reduced;
        _reduce: while ((prevOperator.tokenDef.leftPrecedence || prevOperator.tokenDef.precedence) > (tokenDef.rightPrecedence || tokenDef.precedence)) {
          if (prevOperator.type === "first" && token.type === "last"){
            prevOperator = token;
          }
          switch (prevOperator.tokenDef.type) {
            case optypes.right:
              if (prevOperator.prevOperator.tokenDef.type.isLeft !== true) {
                throw "Previous operator of right operator is not a left operator." 
              }
              if (prevOperator.prevOperator.tokenDef.right !== prevOperator.type) {
                throw "Left operator does not match right operator" 
              }
              this.reduceLeft(prevOperator);
              this.reduceToOperand(prevOperator);
              if (prevOperator.type === "last") {
                break _scan;
              }
              prevOperator = prevOperator.prevOperator;
              this.reduceRight(prevOperator);
              if (prevOperator.tokenDef.type === optypes.func) {
                prevOperator.funcName = prevOperator.text.split(/\s*\(/)[0];
                this.checkFuncArgs(prevOperator);
              }
              reduced = true;
              break;
            case optypes.binary:
              if (prevOperator.tokenDef.operandDataTypesMustMatch !== false) {
                var rightDataType = prevOperator.next.tokenDef.dataType;
                var leftDataType = prevOperator.prev.tokenDef.dataType;
                if (rightDataType && leftDataType && rightDataType !== leftDataType) {
                  throw "Operands of operator \"" + prevOperator.text + "\" at position " + prevOperator.at + " must have same datatype. Found: " + leftDataType + ", " + rightDataType + ".";
                }
              }
              this.reduceLeft(prevOperator);
              this.reduceRight(prevOperator);
              reduced = true;
              break;
            case optypes.unaryprefix:
              this.reduceRight(prevOperator);
              reduced = true;
              break;
            default:
              reduced = false;
          }
          if (reduced) {
            this.reduceToOperand(prevOperator);
            prevOperator = prevOperator.prevOperator;
            prevOperator.nextOperator = token;
            token.prevOperator = prevOperator;
          }
          else {
            if(prevOperator === token) {
              break;
            }
            else {
              prevOperator = token;
            }
          }
        }
        if (prevOperator === token) {
          break;
        }
        else {
          prevOperator = token;
        }
      }
    } while (true);
    
    if (!prevOperator.leftOperand) {
      throw "Parse error. Missing left parenthesis?";
    }
    var parseTree = this.cleanUpParseTreeNode(prevOperator.leftOperand);
    return parseTree;
  }
};

exports.ODataFilterParser = ODataFilterParser;

}(this));