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

function createCallback(callback, args) {
    var scope, func;
    if (!args) {
    	args = [];
    }
    switch (typeof callback) {
        case "function":
            scope = null;
            func = callback;
            return {
                scope: scope,
                func: func,
                args: args
            };
        case "object":
            if (!callback.scope) {
            	callback.scope = null;
            }
            callback.args = callback.args ? args.concat(callback.args) : callback.args;
            return callback;
    }
    throw "Invalid callback";
}

var Tokenizer;
/**
* Tokenizer implements a powerful general purpose tokenizer based on native javascript regular expressions.
* @class Tokenizer
* @constructor
* @param config object Configuration options. The following
**/
Tokenizer = function(config) {
    this.init(config || {});
};
Tokenizer.prototype = {
    /**
     * Initialize the tokenizer and define which types of tokens should be returned.
     * @method init
     * @param {object} config
     */
    init: function(config) {
        var name,
            tokenDefs = config.tokens || config,
            flags = "g",
            tokenType, tokenDef,
            pattern,
            tokenTypes = this.tokenTypes = {},
            regexp = "",
            group = 0, groupCount,
            attributes, attributeName, attribute,
            callback,
            defaultToken,
            initToken = function(name) {
                tokenDef = tokenDefs[name];
                pattern = (tokenDef.constructor === RegExp ? tokenDef : tokenDef.pattern).source;
                if (pattern === ".") {
                	defaultToken = name;
                }
                if (regexp.length) {
                	regexp += "|";
                }
                regexp += "(" + pattern + ")";
                pattern = pattern.replace(/\\\\/g, "").replace(/\\\(/g, "");
                groupCount = pattern.length - pattern.replace(/\(/g, "").length;
                tokenType = {
                    name: tokenDef.name || name,
                    tokenDef: tokenDef,
                    group: ++group,
                    groupCount: groupCount
                };
                group += groupCount;

                attributes = tokenDef.attributes;
                if (attributes) {
                    for (attributeName in attributes) {
                    	if (attributes.hasOwnProperty(attributeName)) {
                            attribute = attributes[attributeName];
                            switch (typeof attribute) {
                                case "number":
                                    attributes[attributeName] = {
                                        group: parseInt(attribute, 10)
                                    };
                                    break;
                                case "function":
                                    attributes[attributeName] = {
                                        callback: createCallback(attribute, [null])
                                    };
                                    break;
                                case "object":
                                    break;
                            }
                    	}
                    }
                }
                else {
                	tokenDef.attributes = {
                        text: {
                            group: 0
                        }
                    };
                }
                callback = tokenDef.callback;
                if (callback) {
                	tokenType.callback = createCallback(callback, [null, null]);
                }
                tokenTypes[name] = tokenType;
            }
        ;
        for (name in tokenDefs) {
        	if (tokenDefs.hasOwnProperty(name)) {
            	initToken(name);
        	}
        }
        if (!defaultToken) {
            tokenDefs = {
                "default": /.+/
            };
            initToken("default");
        }
        if (config.ignoreCase) {
        	flags += "i";
        }
        this.regexp = new RegExp(regexp, flags);
        if (config.exclude !== undefined) {
          this.exclude(config.exclude);
        }
        if (config.text !== undefined) {
          this.text(config.text);
        }
    },
    /**
     * Set the text that is to be tokenized.
     * @method
     * @param {string} text The text that is to be tokenized.
     * @param {int} from An index to indicate where to start tokenization. Default 0 (Optional).
     * @param {int} to An index indicating up to where the text should be tokenized. Defaults to the entire length of the text (Optional).
     */
    text: function(text, from, to){
        this._text = text;
        this.regexp.lastIndex = this._next = from ? from : 0;
        this.to = to || text.length;
    },
    /**
     * Indicates whether there are more tokens.
     * @method
     * @return boolean
     */
    more: function() {
        return this.regexp.lastIndex < this.to;
    },
    /**
     * Get the current token.
     * @method
     * @return object
     */
    one: function() {
        var match = this.regexp.exec(this._text);
        if (!match) {
        	return null;
        }
        var text = match[0],
            at = match.index,
            name, tokenType, tokenTypeName, group, tokenDef,
            exclude = this._exclude,
            attributes, attribute, attributeValue,
            tokenTypes = this.tokenTypes, token,
            callback, args
        ;
        this._next = at + text.length;
        for (name in tokenTypes) {
            tokenType = tokenTypes[name];
            group = tokenType.group;
            if (text !== match[group]) {
            	continue;
            }
            tokenDef = tokenType.tokenDef;
            tokenTypeName = tokenType.name;
            if (exclude && exclude[tokenTypeName]) {
            	return this.one();
            }
            token = {
                type: tokenTypeName,
                at: at
            };

            attributes = tokenDef.attributes;
            for (name in attributes) {
            	if(attributes.hasOwnProperty(name)) {
                    attribute = attributes[name];
                    if (attribute.group === undefined) {
                      attributeValue = text;
                    }
                    else {
                      attributeValue = match[group + attribute.group];
                    }
                    callback = attribute.callback;
                    if (callback !== undefined) {
                        args = callback.args;
                        args[0] = attributeValue;
                        attributeValue = callback.func.apply(callback.scope, args);
                    }
                    switch (attribute.type) {
                        case "number":
                            attributeValue = Number(attributeValue);
                            break;
                        case "int":
                            attributeValue = parseInt(attributeValue, 10);
                            break;
                        case "float":
                            attributeValue = parseFloat(attributeValue);
                            break;
                        case "date":
                            attributeValue = new Date(attributeValue);
                            break;
                        case "boolean":
                            attributeValue = attributeValue ? true : false;
                            break;
                    }
                    token[name] = attributeValue;
            	}
            }

            callback = tokenType.callback;
            if (callback) {
                args = callback.args;
                args[0] = token;
                args[1] = match.slice(group, group + tokenType.groupCount + 1);
                callback.func.apply(callback.scope, args);
            }
            break;
        }
        return token;
    },
    /**
     * Iterate through tokens and notify a callback for each token.
     * @method
     * @param callback object
     * @return boolean
     */
    each: function(callback) {
        callback = createCallback(callback, [null]);
        var func = callback.func,
            args = callback.args,
            scope = callback.scope,
            token
        ;
        while (this.more()) {
        	token = this.one();
            if (token) {
            	args[0] = token;
                if (func.apply(scope, args) === false) {
                	return false;
                }
            }
        }
        return true;
    },
    /**
     * Return all tokens in an array.
     * @method all
     * @return array
     */
    all: function() {
        var tokens = [];
        this.each(function(token){
            tokens.push(token);
        });
        return tokens;
    },
    /**
     * Specifies which tokens should be filtered out and ignored.
     * @method exclude
     * @param config object
     */
    exclude: function(config) {
        var exclude;
        switch (typeof(config)) {
            case "string":
                (exclude = {})[config] = true;
                break;
            case "object":
                if (config.constructor === Array) {
                    exclude = {};
                    for (var i = 0, n = config.length, v; i < n; i++) {
                        v = config[i];
                        if (typeof(v) !== "string") throw "Invalid argument.";
                        exclude[v] = true;
                    }
                }
                else exclude = config;
                break;
            case "undefined":
                exclude = null;
                break;
            default:
                throw "Invalid argument.";
        }
        this._exclude = exclude;
    }
};

exports.Tokenizer = Tokenizer;

}(this));
